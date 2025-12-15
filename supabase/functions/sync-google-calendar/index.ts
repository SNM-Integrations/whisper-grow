import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader! } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { after, before, viewMode, organizationId } = await req.json();

    console.log(`Syncing calendar for ${viewMode} view: ${after} to ${before}`);

    // Get user's n8n settings to find MCP endpoint
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Build the query for integration settings
    let settingsQuery = supabaseAdmin
      .from("integration_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("integration_type", "n8n");
    
    if (organizationId) {
      settingsQuery = settingsQuery.eq("organization_id", organizationId);
    } else {
      settingsQuery = settingsQuery.is("organization_id", null);
    }
    
    const { data: settings, error: settingsError } = await settingsQuery.single();
    
    if (settingsError || !settings) {
      console.log("No n8n integration settings found, using MCP connector");
      // Fall back to trying MCP connector directly
    }

    // Use n8n MCP to get calendar events
    // The MCP connector on Lovable side handles the actual n8n call
    // We need to call the Get_many_events_in_Google_Calendar tool
    
    // For now, let's call the MCP endpoint directly if configured
    const mcpUrl = (settings?.settings as Record<string, string>)?.mcpUrl;
    
    if (!mcpUrl) {
      console.log("No MCP URL configured, cannot sync calendar");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No n8n MCP integration configured. Please configure n8n in Settings > Integrations.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call n8n to get Google Calendar events
    console.log("Calling n8n MCP to fetch calendar events...");
    
    const n8nResponse = await fetch(mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "Get_many_events_in_Google_Calendar",
          arguments: {
            Calendar: "primary",
            Return_All: false,
            After: after,
            Before: before,
          },
        },
      }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error("n8n MCP error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch from Google Calendar via n8n" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const n8nData = await n8nResponse.json();
    console.log("n8n response:", JSON.stringify(n8nData));

    // Parse the result - n8n MCP returns events in result.content
    let events: Array<{
      id: string;
      summary: string;
      description?: string;
      location?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
    }> = [];
    
    if (n8nData.result?.content) {
      // The content might be a JSON string or already parsed
      const content = n8nData.result.content;
      if (Array.isArray(content) && content[0]?.text) {
        try {
          events = JSON.parse(content[0].text);
        } catch {
          console.log("Could not parse events from text, trying direct");
          events = content;
        }
      } else if (Array.isArray(content)) {
        events = content;
      }
    }

    console.log(`Found ${events.length} events from Google Calendar`);

    // Upsert events into calendar_events table
    let synced = 0;
    for (const event of events) {
      const googleEventId = event.id;
      const title = event.summary || "Untitled Event";
      const description = event.description || null;
      const location = event.location || null;
      
      // Parse start/end times
      const startTime = event.start?.dateTime || event.start?.date;
      const endTime = event.end?.dateTime || event.end?.date;
      
      if (!startTime || !endTime) {
        console.log(`Skipping event ${googleEventId} - missing start/end time`);
        continue;
      }

      // Check if event already exists
      const { data: existing } = await supabaseAdmin
        .from("calendar_events")
        .select("id")
        .eq("google_event_id", googleEventId)
        .eq("user_id", user.id)
        .single();

      if (existing) {
        // Update existing event
        await supabaseAdmin
          .from("calendar_events")
          .update({
            title,
            description,
            location,
            start_time: startTime,
            end_time: endTime,
            is_synced: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        console.log(`Updated event: ${title}`);
      } else {
        // Insert new event
        const { error: insertError } = await supabaseAdmin
          .from("calendar_events")
          .insert({
            user_id: user.id,
            google_event_id: googleEventId,
            google_calendar_id: "primary",
            title,
            description,
            location,
            start_time: startTime,
            end_time: endTime,
            is_synced: true,
            visibility: organizationId ? "organization" : "personal",
            organization_id: organizationId || null,
          });
        
        if (insertError) {
          console.error(`Failed to insert event ${title}:`, insertError);
        } else {
          console.log(`Created event: ${title}`);
          synced++;
        }
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${synced} new events for ${viewMode} view`,
        total: events.length,
        synced,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
