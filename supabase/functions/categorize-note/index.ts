import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { noteContent, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch existing categories for this user
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('name')
      .eq('user_id', userId);

    const categoryList = existingCategories?.map(c => c.name).join(', ') || 'none yet';

    // Use AI to categorize the note
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `You are a smart categorization assistant for a personal knowledge management system. Your job is to analyze notes and suggest the most appropriate category.

Existing categories: ${categoryList}

Rules:
1. If the note fits an existing category, return that category name
2. If no existing category fits well, suggest a new meaningful category name
3. Category names should be clear, concise, and descriptive (1-3 words)
4. Return ONLY the category name, nothing else`
          },
          {
            role: 'user',
            content: `Categorize this note: "${noteContent}"`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get AI categorization');
    }

    const aiResponse = await response.json();
    const suggestedCategory = aiResponse.choices[0].message.content.trim();

    // Check if category exists, create if not
    let categoryId;
    const { data: existingCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('name', suggestedCategory)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingCategory) {
      categoryId = existingCategory.id;
    } else {
      const { data: newCategory, error: createError } = await supabase
        .from('categories')
        .insert({ name: suggestedCategory, user_id: userId })
        .select('id')
        .single();

      if (createError) throw createError;
      categoryId = newCategory.id;
    }

    return new Response(
      JSON.stringify({ 
        categoryId, 
        categoryName: suggestedCategory 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in categorize-note function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});