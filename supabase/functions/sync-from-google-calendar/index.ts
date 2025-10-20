import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract the JWT token and create an RLS-aware client for DB access
    const token = authHeader.replace('Bearer ', '');
    const db = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Not authenticated');

    console.log('Syncing events from Google Calendar');

    // Get Google tokens
    const { data: tokens, error: tokensError } = await db
      .from('google_auth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokensError || !tokens) {
      throw new Error('Google Calendar not connected');
    }

    // Check if token is expired and refresh if needed
    let accessToken = tokens.access_token;
    if (new Date(tokens.expires_at) < new Date()) {
      console.log('Refreshing expired Google token');
      const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
      const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          refresh_token: tokens.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      const newTokens = await refreshResponse.json();
      accessToken = newTokens.access_token;

      // Update stored tokens
      await db
        .from('google_auth_tokens')
        .update({
          access_token: newTokens.access_token,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        })
        .eq('user_id', user.id);
    }

    // Get events from Google Calendar (next 30 days)
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const googleResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error('Google Calendar API error:', errorText);
      throw new Error('Failed to fetch from Google Calendar');
    }

    const googleData = await googleResponse.json();
    const googleEvents = googleData.items || [];
    console.log(`Found ${googleEvents.length} events in Google Calendar`);

    let syncedCount = 0;
    for (const googleEvent of googleEvents) {
      if (!googleEvent.start?.dateTime || !googleEvent.end?.dateTime) {
        continue; // Skip all-day events
      }

      // Check if event already exists
      const { data: existing } = await db
        .from('calendar_events')
        .select('id')
        .eq('google_event_id', googleEvent.id)
        .eq('user_id', user.id)
        .maybeSingle();

      const eventData = {
        user_id: user.id,
        title: googleEvent.summary || 'Untitled Event',
        description: googleEvent.description || null,
        start_time: googleEvent.start.dateTime,
        end_time: googleEvent.end.dateTime,
        location: googleEvent.location || null,
        google_event_id: googleEvent.id,
        is_synced: true,
      };

      if (existing) {
        // Update existing event
        await db
          .from('calendar_events')
          .update(eventData)
          .eq('id', existing.id);
      } else {
        // Create new event
        await db
          .from('calendar_events')
          .insert(eventData);
        syncedCount++;
      }
    }

    console.log(`Successfully synced ${syncedCount} new events from Google Calendar`);

    return new Response(JSON.stringify({ success: true, syncedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
