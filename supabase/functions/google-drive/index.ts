import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.error("Missing Google OAuth credentials");
    return null;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error("Failed to refresh token:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

async function getValidAccessToken(supabase: any, userId: string): Promise<string | null> {
  const { data: tokenData, error } = await supabase
    .from("google_auth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !tokenData) {
    console.error("No Google tokens found for user:", error);
    return null;
  }

  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);

  // If token is still valid (with 5 min buffer), use it
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return tokenData.access_token;
  }

  // Otherwise refresh it
  console.log("Token expired, refreshing...");
  const newAccessToken = await refreshAccessToken(tokenData.refresh_token);

  if (newAccessToken) {
    // Update stored token
    const newExpiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour from now
    await supabase
      .from("google_auth_tokens")
      .update({
        access_token: newAccessToken,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return newAccessToken;
  }

  return null;
}

async function listSharedDrives(accessToken: string): Promise<any[]> {
  const url = `https://www.googleapis.com/drive/v3/drives?pageSize=100&fields=drives(id,name)`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error("Failed to list shared drives:", await response.text());
    return [];
  }

  const data = await response.json();
  return (data.drives || []).map((drive: any) => ({
    ...drive,
    isSharedDrive: true,
    mimeType: "application/vnd.google-apps.folder",
  }));
}

async function listDriveFolders(accessToken: string, parentId?: string, driveId?: string): Promise<any[]> {
  const query = parentId
    ? `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    : `'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  // Build URL with shared drive support
  let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  
  // If accessing a shared drive, add corpora and driveId
  if (driveId) {
    url += `&corpora=drive&driveId=${driveId}`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error("Failed to list folders:", await response.text());
    return [];
  }

  const data = await response.json();
  return data.files || [];
}

async function listDriveFiles(accessToken: string, folderId: string, driveId?: string): Promise<any[]> {
  const query = `'${folderId}' in parents and trashed=false`;
  let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size)&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  // If accessing a shared drive, add corpora and driveId
  if (driveId) {
    url += `&corpora=drive&driveId=${driveId}`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error("Failed to list files:", await response.text());
    return [];
  }

  const data = await response.json();
  return data.files || [];
}

async function downloadDriveFile(accessToken: string, fileId: string, mimeType: string): Promise<{ content: string | null; blob: Blob | null }> {
  let url: string;
  
  // Google Docs/Sheets/Slides need to be exported
  if (mimeType === "application/vnd.google-apps.document") {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
  } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
  } else if (mimeType === "application/vnd.google-apps.presentation") {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
  } else {
    url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error("Failed to download file:", await response.text());
    return { content: null, blob: null };
  }

  // For text content, return as string
  if (mimeType.startsWith("text/") || 
      mimeType === "application/vnd.google-apps.document" ||
      mimeType === "application/json") {
    const content = await response.text();
    return { content, blob: null };
  }

  // For binary files, return as blob
  const blob = await response.blob();
  return { content: null, blob };
}

async function uploadToDrive(accessToken: string, folderId: string, fileName: string, content: string, mimeType: string): Promise<any | null> {
  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: mimeType,
  };

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    console.error("Failed to upload file:", await response.text());
    return null;
  }

  return await response.json();
}

async function updateDriveFile(accessToken: string, fileId: string, content: string, mimeType: string): Promise<boolean> {
  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": mimeType,
    },
    body: content,
  });

  if (!response.ok) {
    console.error("Failed to update file:", await response.text());
    return false;
  }

  return true;
}

async function createDriveFolder(accessToken: string, folderName: string, parentId?: string): Promise<any | null> {
  const metadata: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    console.error("Failed to create folder:", await response.text());
    return null;
  }

  return await response.json();
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(supabase, user.id);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No Google authentication", needsAuth: true }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const { action, ...params } = await req.json();
    console.log(`Google Drive action: ${action}`, params);

    let result: any;

    switch (action) {
      case "list-shared-drives":
        result = await listSharedDrives(accessToken);
        break;

      case "list-folders":
        result = await listDriveFolders(accessToken, params.parentId, params.driveId);
        break;

      case "list-files":
        if (!params.folderId) {
          return new Response(JSON.stringify({ error: "folderId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await listDriveFiles(accessToken, params.folderId, params.driveId);
        break;

      case "download":
        if (!params.fileId || !params.mimeType) {
          return new Response(JSON.stringify({ error: "fileId and mimeType required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await downloadDriveFile(accessToken, params.fileId, params.mimeType);
        break;

      case "upload":
        if (!params.folderId || !params.fileName || !params.content) {
          return new Response(JSON.stringify({ error: "folderId, fileName, and content required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await uploadToDrive(
          accessToken,
          params.folderId,
          params.fileName,
          params.content,
          params.mimeType || "text/plain"
        );
        break;

      case "update":
        if (!params.fileId || !params.content) {
          return new Response(JSON.stringify({ error: "fileId and content required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await updateDriveFile(
          accessToken,
          params.fileId,
          params.content,
          params.mimeType || "text/plain"
        );
        break;

      case "create-folder":
        if (!params.folderName) {
          return new Response(JSON.stringify({ error: "folderName required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await createDriveFolder(accessToken, params.folderName, params.parentId);
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Google Drive function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
