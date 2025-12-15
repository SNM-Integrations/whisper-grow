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
    const { name, email, phone, company, role, notes, tags, contact_type, user_id, organization_id, visibility, website, industry } = body;

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

    let companyRecord = null;

    // If company name provided, look up or create company
    if (company) {
      const companyName = company.trim().substring(0, 100);
      
      // Build query to find existing company
      let companyQuery = supabaseAdmin
        .from('companies')
        .select('*')
        .eq('name', companyName)
        .eq('user_id', user_id);
      
      if (organization_id) {
        companyQuery = companyQuery.eq('organization_id', organization_id);
      }
      
      const { data: existingCompany, error: lookupError } = await companyQuery.maybeSingle();
      
      if (lookupError) {
        console.error('Error looking up company:', lookupError);
      }

      if (existingCompany) {
        companyRecord = existingCompany;
        console.log('Found existing company:', companyRecord.id);
      } else {
        // Create new company
        const companyData: Record<string, unknown> = {
          name: companyName,
          user_id,
          company_type: 'lead',
          visibility: organization_id ? 'organization' : (visibility || 'personal'),
        };
        
        if (organization_id) companyData.organization_id = organization_id;
        if (website) companyData.website = website.trim().substring(0, 255);
        if (industry) companyData.industry = industry.trim().substring(0, 100);

        const { data: newCompany, error: createError } = await supabaseAdmin
          .from('companies')
          .insert(companyData)
          .select()
          .single();

        if (createError) {
          console.error('Error creating company:', createError);
        } else {
          companyRecord = newCompany;
          console.log('Created new company:', companyRecord.id);
        }
      }
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

    return new Response(JSON.stringify({ 
      success: true, 
      contact: data,
      company: companyRecord,
      company_created: companyRecord && !companyRecord.created_at ? false : !!companyRecord
    }), {
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
