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
    const { code, origin } = await req.json();
    
    if (!code) {
      throw new Error('No authorization code provided');
    }
    
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      console.error('No authorization header in callback');
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Failed to get authenticated user');
      throw new Error('Not authenticated');
    }

    console.log('Processing Google OAuth callback for user:', user.id);

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth credentials not configured');
      throw new Error('Google OAuth credentials not configured');
    }

    // Build redirect URI dynamically to match initial auth URL
    const requestOrigin = origin || req.headers.get('origin') || req.headers.get('referer')?.split('?')[0].replace(/\/$/, '');
    
    if (!requestOrigin) {
      console.error('No origin provided for redirect URI');
      throw new Error('Unable to determine origin for redirect URI');
    }
    
    const redirectUri = `${requestOrigin}/settings?oauth=google`;
    
    console.log('Using redirect URI:', redirectUri);

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange error:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
        redirectUri
      });
      throw new Error(`Failed to exchange authorization code: ${tokenResponse.statusText}`);
    }

    const tokens = await tokenResponse.json();
    console.log('Received tokens from Google:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in
    });

    if (!tokens.access_token) {
      console.error('No access token in response');
      throw new Error('No access token received from Google');
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Store tokens in database - only update refresh_token if provided
    const upsertData: any = {
      user_id: user.id,
      access_token: tokens.access_token,
      expires_at: expiresAt,
    };
    
    // Google only provides refresh_token on first authorization or when prompt=consent
    if (tokens.refresh_token) {
      upsertData.refresh_token = tokens.refresh_token;
    }

    const { error: upsertError } = await supabase
      .from('google_auth_tokens')
      .upsert(upsertData, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error storing tokens:', upsertError);
      throw new Error(`Failed to store tokens: ${upsertError.message}`);
    }

    console.log('Successfully stored Google tokens');

    return new Response(JSON.stringify({ success: true }), {
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
