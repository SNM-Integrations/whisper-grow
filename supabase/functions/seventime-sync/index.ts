import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEVENTIME_API_BASE = "https://app.seventime.se/api/2";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://pccvvqmrwbcdjgkyteqn.supabase.co';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const seventimeApiKey = Deno.env.get('SEVENTIME_API_KEY');

    if (!seventimeApiKey) {
      console.error('SEVENTIME_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'SevenTime API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey!);

    const { contactId, organizationId } = await req.json();

    if (!contactId) {
      return new Response(JSON.stringify({ error: 'contactId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing SevenTime sync for contact:', contactId);

    // Fetch the contact with all details
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      console.error('Error fetching contact:', contactError);
      return new Response(JSON.stringify({ error: 'Contact not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already synced
    if (contact.seventime_customer_id && contact.seventime_workorder_id) {
      return new Response(JSON.stringify({ 
        error: 'Contact already synced to SevenTime',
        customerId: contact.seventime_customer_id,
        workOrderId: contact.seventime_workorder_id
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch SevenTime integration settings
    const settingsQuery = supabaseAdmin
      .from('integration_settings')
      .select('settings')
      .eq('integration_type', 'seventime');

    if (organizationId) {
      settingsQuery.eq('organization_id', organizationId);
    } else {
      settingsQuery.eq('user_id', contact.user_id).is('organization_id', null);
    }

    const { data: settingsData } = await settingsQuery.maybeSingle();
    const settings = (settingsData?.settings || {}) as Record<string, string>;

    const defaultUserId = settings.default_user_id || '';
    const customerResponsibleId = settings.customer_responsible_id || '';
    const partTimeUsers = settings.parttime_users ? settings.parttime_users.split(',').map(s => s.trim()) : [];

    if (!defaultUserId) {
      return new Response(JSON.stringify({ error: 'SevenTime default user ID not configured in settings' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Create Customer in SevenTime
    console.log('Creating customer in SevenTime...');
    
    const customerPayload: Record<string, unknown> = {
      createdByUser: defaultUserId,
      name: contact.name,
      phone: contact.phone || '',
      email: contact.email || '',
      address: contact.address || '',
      zipCode: contact.zip_code || '',
      city: contact.city || '',
      isActive: true,
    };

    // Add personal number for ROT/RUT if provided
    if (contact.personal_number) {
      customerPayload.organizationNumber = contact.personal_number;
      customerPayload.billingSettings = {
        isROTCustomer: true,
        personalNumber: contact.personal_number,
      };
    }

    // Add customer responsible if configured
    if (customerResponsibleId) {
      customerPayload.customerResponsible = customerResponsibleId;
    }

    const customerResponse = await fetch(`${SEVENTIME_API_BASE}/customers/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Secret': seventimeApiKey,
      },
      body: JSON.stringify(customerPayload),
    });

    if (!customerResponse.ok) {
      const errorText = await customerResponse.text();
      console.error('SevenTime customer creation failed:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to create SevenTime customer', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const customerResult = await customerResponse.json();
    const seventimeCustomerId = customerResult._id;
    console.log('Customer created in SevenTime:', seventimeCustomerId);

    // Step 2: Create Work Order in SevenTime
    console.log('Creating work order in SevenTime...');

    // Build description with all relevant info
    const descriptionParts = [];
    if (contact.name) descriptionParts.push(`Kund: ${contact.name}`);
    if (contact.phone) descriptionParts.push(`Telefon: ${contact.phone}`);
    if (contact.address) {
      let fullAddress = contact.address;
      if (contact.zip_code) fullAddress += `, ${contact.zip_code}`;
      if (contact.city) fullAddress += ` ${contact.city}`;
      descriptionParts.push(`Adress: ${fullAddress}`);
    }
    if (contact.job_description) descriptionParts.push(`\nBeskrivning:\n${contact.job_description}`);
    if (contact.rot_rut_info) descriptionParts.push(`\nROT/RUT:\n${contact.rot_rut_info}`);
    if (contact.notes) descriptionParts.push(`\nNoteringar:\n${contact.notes}`);

    const workOrderPayload: Record<string, unknown> = {
      createdByUser: defaultUserId,
      title: contact.name,
      customer: seventimeCustomerId,
      description: descriptionParts.join('\n'),
      users: [defaultUserId],
      marking: contact.name,
    };

    // Add part-time users if configured
    if (partTimeUsers.length > 0) {
      workOrderPayload.partTimeResources = partTimeUsers;
    }

    // Add dates if provided
    if (contact.start_date) {
      workOrderPayload.startDate = contact.start_date;
    }
    if (contact.end_date) {
      workOrderPayload.endDate = contact.end_date;
    }

    // Add estimated time if provided
    if (contact.estimated_hours) {
      workOrderPayload.estimatedTime = contact.estimated_hours;
    }

    const workOrderResponse = await fetch(`${SEVENTIME_API_BASE}/workOrders/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Secret': seventimeApiKey,
      },
      body: JSON.stringify(workOrderPayload),
    });

    if (!workOrderResponse.ok) {
      const errorText = await workOrderResponse.text();
      console.error('SevenTime work order creation failed:', errorText);
      // Still update the customer ID even if work order fails
      await supabaseAdmin
        .from('contacts')
        .update({ seventime_customer_id: seventimeCustomerId })
        .eq('id', contactId);
      
      return new Response(JSON.stringify({ 
        error: 'Failed to create SevenTime work order', 
        details: errorText,
        customerId: seventimeCustomerId 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const workOrderResult = await workOrderResponse.json();
    const seventimeWorkOrderId = workOrderResult._id;
    console.log('Work order created in SevenTime:', seventimeWorkOrderId);

    // Step 3: Update contact with SevenTime IDs
    const { error: updateError } = await supabaseAdmin
      .from('contacts')
      .update({
        seventime_customer_id: seventimeCustomerId,
        seventime_workorder_id: seventimeWorkOrderId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (updateError) {
      console.error('Error updating contact with SevenTime IDs:', updateError);
    }

    console.log('SevenTime sync completed successfully');

    return new Response(JSON.stringify({
      success: true,
      customerId: seventimeCustomerId,
      workOrderId: seventimeWorkOrderId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in seventime-sync:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
