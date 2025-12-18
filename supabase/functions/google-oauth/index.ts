import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

// Scopes for Google Drive + Calendar access
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  try {
    // Handle OAuth callback (GET request with code parameter)
    if (req.method === "GET" && url.searchParams.has("code")) {
      const code = url.searchParams.get("code")!;
      const state = url.searchParams.get("state"); // Contains user_id or user_id:org_id
      
      if (!state) {
        return new Response("Missing state parameter", { status: 400 });
      }

      // Parse state - may be "user_id" or "user_id:org_id"
      const stateParts = state.split(":");
      const userId = stateParts[0];
      const organizationId = stateParts[1] || null;

      console.log("OAuth callback received, user:", userId, "org:", organizationId);

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: `${SUPABASE_URL}/functions/v1/google-oauth`,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", errorText);
        return new Response(`Token exchange failed: ${errorText}`, { status: 400 });
      }

      const tokens = await tokenResponse.json();
      console.log("Tokens received successfully");

      // Fetch user's Google email
      let googleEmail = null;
      try {
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          googleEmail = userInfo.email;
          console.log("Google email fetched:", googleEmail);
        }
      } catch (e) {
        console.error("Failed to fetch Google user info:", e);
      }

      // Create Supabase client with service role
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, supabaseKey);

      // Calculate expiry time
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      // Store tokens in database with organization context
      const tokenData: Record<string, unknown> = {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt.toISOString(),
        google_email: googleEmail,
        scopes: SCOPES.split(" "),
        updated_at: new Date().toISOString(),
      };

      if (organizationId) {
        tokenData.organization_id = organizationId;
      }

      // Delete existing token for this user/org combination, then insert new one
      // This avoids the complex upsert constraint issues with nullable columns
      const deleteQuery = supabase
        .from("google_auth_tokens")
        .delete()
        .eq("user_id", userId);
      
      if (organizationId) {
        deleteQuery.eq("organization_id", organizationId);
      } else {
        deleteQuery.is("organization_id", null);
      }
      
      await deleteQuery;
      
      // Now insert the new token
      const { error: insertError } = await supabase
        .from("google_auth_tokens")
        .insert(tokenData);

      if (insertError) {
        console.error("Failed to store tokens:", insertError);
        return new Response(`Failed to store tokens: ${insertError.message}`, { status: 500 });
      }

      console.log("Tokens stored successfully for user:", userId, "org:", organizationId, "email:", googleEmail);

      // Redirect back to app with success
      const appUrl = req.headers.get("origin") || "https://whisper-grow.lovable.app";
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${appUrl}/?google_auth=success`,
        },
      });
    }

    // Handle authorization URL request (POST)
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, supabaseKey);
      
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get organization_id from body if provided
      let organizationId: string | null = null;
      try {
        const body = await req.json();
        organizationId = body.organization_id || null;
      } catch {
        // No body or invalid JSON, that's fine
      }

      // Create state that includes both user_id and organization_id
      const state = organizationId 
        ? `${user.id}:${organizationId}` 
        : user.id;

      // Generate authorization URL
      const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth`;
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      console.log("=== OAUTH DEBUG ===");
      console.log("SUPABASE_URL:", SUPABASE_URL);
      console.log("Redirect URI:", redirectUri);
      console.log("Client ID:", GOOGLE_CLIENT_ID);
      console.log("Full auth URL:", authUrl.toString());
      console.log("User:", user.id, "Org:", organizationId);
      console.log("===================");

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("OAuth error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
