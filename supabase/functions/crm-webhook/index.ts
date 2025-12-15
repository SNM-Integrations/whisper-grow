import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://pccvvqmrwbcdjgkyteqn.supabase.co';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('CRM webhook received:', JSON.stringify(body, null, 2));

    // Validate required fields
    const { name, email, phone, company, role, notes, tags, contact_type, user_id, organization_id, visibility } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prepare contact data
    const contactData: Record<string, unknown> = {
      name: name.trim().substring(0, 100),
      user_id,
      contact_type: contact_type || 'contact',
      visibility: visibility || 'personal',
    };

    // Add optional fields if provided
    if (email) contactData.email = email.trim().substring(0, 255);
    if (phone) contactData.phone = phone.trim().substring(0, 50);
    if (company) contactData.company = company.trim().substring(0, 100);
    if (role) contactData.role = role.trim().substring(0, 100);
    if (notes) contactData.notes = notes.trim().substring(0, 5000);
    if (tags && Array.isArray(tags)) contactData.tags = tags.map((t: string) => t.trim().substring(0, 50));
    if (organization_id) {
      contactData.organization_id = organization_id;
      contactData.visibility = 'organization';
    }

    // Insert contact
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .insert(contactData)
      .select()
      .single();

    if (error) {
      console.error('Error inserting contact:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Contact created:', data.id);

    return new Response(JSON.stringify({ success: true, contact: data }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('CRM webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
