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

    // Get tokens from database
    const { data: tokens, error: tokensError } = await db
      .from('google_auth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tokensError) throw tokensError;

    if (!tokens) {
      return new Response(JSON.stringify({ 
        connected: false,
        message: 'Not connected to Google Calendar'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if token is expired
    const expiresAt = new Date(tokens.expires_at);
    const now = new Date();
    const isExpired = expiresAt <= now;

    let accessToken = tokens.access_token;
    let refreshed = false;
    let reconsentRequired = false;

    // If token is expired, try to refresh it
    if (isExpired) {
      console.log('Access token expired, attempting refresh...');
      try {
        const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
        const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
        
        if (!clientId || !clientSecret) {
          throw new Error('Google OAuth credentials not configured');
        }

        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: tokens.refresh_token,
          }),
        });

        if (!refreshResponse.ok) {
          const errorData = await refreshResponse.json();
          console.error('Token refresh failed:', errorData);
          
          if (errorData.error === 'invalid_grant') {
            reconsentRequired = true;
            return new Response(JSON.stringify({ 
              connected: false,
              reconsentRequired: true,
              message: 'Refresh token invalid or revoked. Please reconnect your Google Calendar.'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          throw new Error(`Token refresh failed: ${errorData.error || 'Unknown error'}`);
        }

        const refreshData = await refreshResponse.json();
        accessToken = refreshData.access_token;
        const newExpiresAt = new Date(now.getTime() + (refreshData.expires_in * 1000));

        // Update tokens in database
        const { error: updateError } = await db
          .from('google_auth_tokens')
          .update({
            access_token: accessToken,
            expires_at: newExpiresAt.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Failed to update tokens:', updateError);
          throw updateError;
        }

        refreshed = true;
        console.log('Access token refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh token:', error);
        // If refresh fails for reasons other than invalid_grant, continue with expired token
        // The sync functions will handle the refresh themselves
      }
    }

    // Get user info from Google
    let userEmail = null;
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        userEmail = userInfo.email;
      }
    } catch (error) {
      console.error('Failed to fetch Google user info:', error);
    }

    return new Response(JSON.stringify({ 
      connected: true,
      email: userEmail,
      expiresAt: tokens.expires_at,
      createdAt: tokens.created_at,
      updatedAt: tokens.updated_at,
      isExpired: !refreshed && isExpired,
      needsRefresh: !refreshed && (expiresAt.getTime() - now.getTime()) < 5 * 60 * 1000,
      refreshed,
      reconsentRequired
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error checking connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
