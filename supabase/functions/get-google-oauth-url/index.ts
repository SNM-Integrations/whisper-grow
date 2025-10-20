import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    
    if (!GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID not configured');
      throw new Error('Google OAuth not configured. Please set GOOGLE_CLIENT_ID secret.');
    }

    // Get origin from request body
    const body = await req.json().catch(() => ({}));
    const origin = body.origin;
    
    if (!origin) {
      console.error('No origin provided in request');
      throw new Error('Origin is required for OAuth redirect');
    }
    
    // Build the redirect URI - this MUST match exactly what's in Google Cloud Console
    const redirectUri = `${origin}/settings`;
    
    const scope = 'https://www.googleapis.com/auth/calendar';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

    console.log('Generated OAuth URL:', {
      origin,
      redirectUri,
      clientIdConfigured: !!GOOGLE_CLIENT_ID
    });

    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-google-oauth-url:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
