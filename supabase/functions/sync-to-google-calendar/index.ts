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
    const { eventId } = await req.json();
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    console.log('Syncing event to Google Calendar:', eventId);

    // Get the event
    const { data: event, error: eventError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single();

    if (eventError || !event) {
      throw new Error('Event not found');
    }

    // Get Google tokens
    const { data: tokens, error: tokensError } = await supabase
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
      await supabase
        .from('google_auth_tokens')
        .update({
          access_token: newTokens.access_token,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        })
        .eq('user_id', user.id);
    }

    // Prepare Google Calendar event
    const googleEvent = {
      summary: event.title,
      description: event.description || '',
      location: event.location || '',
      start: {
        dateTime: event.start_time,
        timeZone: 'UTC',
      },
      end: {
        dateTime: event.end_time,
        timeZone: 'UTC',
      },
    };

    let googleResponse;
    if (event.google_event_id) {
      // Update existing event
      console.log('Updating existing Google Calendar event');
      googleResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.google_event_id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(googleEvent),
        }
      );
    } else {
      // Create new event
      console.log('Creating new Google Calendar event');
      googleResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(googleEvent),
        }
      );
    }

    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.error('Google Calendar API error:', errorText);
      throw new Error('Failed to sync to Google Calendar');
    }

    const googleData = await googleResponse.json();
    console.log('Successfully synced to Google Calendar:', googleData.id);

    // Update local event with Google event ID
    await supabase
      .from('calendar_events')
      .update({
        google_event_id: googleData.id,
        is_synced: true,
      })
      .eq('id', eventId);

    return new Response(JSON.stringify({ success: true, googleEventId: googleData.id }), {
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
