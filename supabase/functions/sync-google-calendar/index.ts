import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshAccessToken(refreshToken: string) {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const tokens = await response.json();
  return tokens;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { action, eventData } = await req.json();

    // Get user's Google tokens
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('google_auth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Google Calendar not connected');
    }

    let accessToken = tokenData.access_token;

    // Refresh token if expired
    if (new Date(tokenData.expires_at) <= new Date()) {
      const newTokens = await refreshAccessToken(tokenData.refresh_token);
      accessToken = newTokens.access_token;

      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      await supabaseClient
        .from('google_auth_tokens')
        .update({
          access_token: newTokens.access_token,
          expires_at: expiresAt.toISOString(),
        })
        .eq('user_id', user.id);
    }

    if (action === 'import') {
      // Import events from Google Calendar
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const googleEvents = await response.json();

      if (googleEvents.items) {
        const eventsToInsert = googleEvents.items.map((event: any) => ({
          user_id: user.id,
          title: event.summary || 'Untitled',
          description: event.description || null,
          start_time: event.start.dateTime || event.start.date,
          end_time: event.end.dateTime || event.end.date,
          location: event.location || null,
          google_event_id: event.id,
          google_calendar_id: 'primary',
          is_synced: true,
        }));

        const { error: insertError } = await supabaseClient
          .from('calendar_events')
          .upsert(eventsToInsert, { onConflict: 'google_event_id' });

        if (insertError) throw insertError;

        console.log(`Imported ${eventsToInsert.length} events for user:`, user.id);
        return new Response(
          JSON.stringify({ success: true, imported: eventsToInsert.length }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'export' && eventData) {
      // Export event to Google Calendar
      const googleEvent = {
        summary: eventData.title,
        description: eventData.description,
        start: { dateTime: eventData.start_time },
        end: { dateTime: eventData.end_time },
        location: eventData.location,
      };

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(googleEvent),
        }
      );

      const createdEvent = await response.json();

      // Update local event with Google event ID
      const { error: updateError } = await supabaseClient
        .from('calendar_events')
        .update({
          google_event_id: createdEvent.id,
          google_calendar_id: 'primary',
          is_synced: true,
        })
        .eq('id', eventData.id);

      if (updateError) throw updateError;

      console.log('Exported event to Google Calendar:', createdEvent.id);
      return new Response(
        JSON.stringify({ success: true, googleEventId: createdEvent.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-google-calendar:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});