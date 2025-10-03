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
    const { text } = await req.json();
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

    console.log('Processing input:', text);

    // Get user's categories for context
    const { data: categories } = await supabase
      .from('categories')
      .select('name')
      .eq('user_id', user.id);

    const categoryList = categories?.map(c => c.name).join(', ') || 'none';

    // Call Lovable AI to classify and extract data
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a smart assistant that categorizes user input into three types: EVENT, TASK, or NOTE.

Rules:
- EVENT: Contains date/time references, meeting mentions, appointments, schedules
- TASK: Contains action items, to-do items, deadlines, things to complete
- NOTE: General information, thoughts, ideas, learnings

Extract relevant information:
For EVENT: title, date, time, duration, location (if mentioned)
For TASK: title, description, due_date, priority (high/medium/low)
For NOTE: content, suggested category

User's existing categories: ${categoryList}

Respond ONLY with valid JSON in this exact format:
{
  "type": "EVENT|TASK|NOTE",
  "data": {
    // for EVENT
    "title": "string",
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "duration_minutes": number,
    "location": "string or null",
    // for TASK
    "title": "string",
    "description": "string",
    "due_date": "YYYY-MM-DD or null",
    "priority": "high|medium|low",
    // for NOTE
    "content": "string",
    "category": "string (existing or new)"
  }
}`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0].message.content;
    console.log('AI response:', aiContent);

    // Parse the JSON response
    const result = JSON.parse(aiContent);

    return new Response(JSON.stringify(result), {
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
