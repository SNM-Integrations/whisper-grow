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

    // Get user info from Google
    let userEmail = null;
    if (!isExpired) {
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`
          }
        });

        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json();
          userEmail = userInfo.email;
        }
      } catch (error) {
        console.error('Failed to fetch Google user info:', error);
      }
    }

    return new Response(JSON.stringify({ 
      connected: true,
      email: userEmail,
      expiresAt: tokens.expires_at,
      createdAt: tokens.created_at,
      updatedAt: tokens.updated_at,
      isExpired,
      needsRefresh: isExpired || (expiresAt.getTime() - now.getTime()) < 5 * 60 * 1000 // Less than 5 minutes
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
