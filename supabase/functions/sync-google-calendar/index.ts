import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function getValidAccessToken(supabase: any, userId: string, organizationId?: string): Promise<string | null> {
  // Try to get org-specific token first, then personal token
  let query = supabase
    .from("google_auth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  } else {
    query = query.is("organization_id", null);
  }

  const { data: tokenData, error } = await query.maybeSingle();

  // If no org token, try personal token
  if (!tokenData && organizationId) {
    const { data: personalToken } = await supabase
      .from("google_auth_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .is("organization_id", null)
      .maybeSingle();
    
    if (personalToken) {
      return getValidTokenFromData(supabase, userId, personalToken);
    }
  }

  if (error || !tokenData) {
    console.error("No Google tokens found for user:", error);
    return null;
  }

  return getValidTokenFromData(supabase, userId, tokenData);
}

async function getValidTokenFromData(supabase: any, userId: string, tokenData: any): Promise<string | null> {
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
    const newExpiresAt = new Date(Date.now() + 3600 * 1000);
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

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

async function fetchCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  calendarId: string = "primary"
): Promise<GoogleCalendarEvent[]> {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to fetch calendar events:", errorText);
    throw new Error(`Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
}

async function listCalendars(accessToken: string): Promise<any[]> {
  const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error("Failed to list calendars:", await response.text());
    return [];
  }

  const data = await response.json();
  return data.items || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, after, before, viewMode, organizationId, calendarId } = await req.json();
    console.log(`Calendar action: ${action || 'sync'}, view: ${viewMode}, range: ${after} to ${before}`);

    // Get valid access token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const accessToken = await getValidAccessToken(supabaseAdmin, user.id, organizationId);
    
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No Google authentication", needsAuth: true }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle different actions
    if (action === "list-calendars") {
      const calendars = await listCalendars(accessToken);
      return new Response(JSON.stringify({ success: true, data: calendars }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default action: sync events
    const timeMin = new Date(after).toISOString();
    const timeMax = new Date(before).toISOString();

    // Fetch events from Google Calendar
    const googleEvents = await fetchCalendarEvents(accessToken, timeMin, timeMax, calendarId || "primary");
    console.log(`Fetched ${googleEvents.length} events from Google Calendar`);

    // Upsert events to our database
    let synced = 0;
    for (const event of googleEvents) {
      const startTime = event.start.dateTime || `${event.start.date}T00:00:00Z`;
      const endTime = event.end.dateTime || `${event.end.date}T23:59:59Z`;

      const eventData = {
        user_id: user.id,
        google_event_id: event.id,
        google_calendar_id: calendarId || "primary",
        title: event.summary || "Untitled Event",
        description: event.description || null,
        location: event.location || null,
        start_time: startTime,
        end_time: endTime,
        is_synced: true,
        organization_id: organizationId || null,
        visibility: organizationId ? "organization" : "personal",
        updated_at: new Date().toISOString(),
      };

      // Try to update existing event, or insert new one
      const { data: existing } = await supabaseAdmin
        .from("calendar_events")
        .select("id")
        .eq("user_id", user.id)
        .eq("google_event_id", event.id)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from("calendar_events")
          .update(eventData)
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("calendar_events")
          .insert(eventData);
      }
      synced++;
    }

    console.log(`Synced ${synced} events to database`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced,
        message: `Synced ${synced} events from Google Calendar`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Calendar sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
