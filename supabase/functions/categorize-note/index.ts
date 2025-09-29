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
    const { noteContent } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Extract user ID from JWT token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Fetch user's AI settings
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('model, temperature, system_prompt')
      .eq('user_id', userId)
      .maybeSingle();

    // Use custom settings or defaults
    const model = aiSettings?.model || 'google/gemini-2.5-flash';
    const temperature = aiSettings?.temperature || 0.3;
    const systemPrompt = aiSettings?.system_prompt || `You are a smart categorization assistant for a personal knowledge management system. Your job is to analyze notes and suggest the most appropriate category.

Rules:
1. If the note fits an existing category, return that category name
2. If no existing category fits well, suggest a new meaningful category name
3. Category names should be clear, concise, and descriptive (1-3 words)
4. Return ONLY the category name, nothing else`;

    // Fetch existing categories for this user
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('name')
      .eq('user_id', userId);

    const categoryList = existingCategories?.map(c => c.name).join(', ') || 'none yet';

    // Generate embedding for the new note first
    const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: noteContent,
        model: 'text-embedding-3-small',
      }),
    });

    let similarNotesContext = '';
    
    if (embeddingResponse.ok) {
      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Find similar notes using vector similarity
      const { data: similarNotes } = await supabase.rpc('match_notes', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 5,
        user_id_param: userId,
      });

      if (similarNotes && similarNotes.length > 0) {
        const noteContexts = similarNotes
          .map((note: any) => `- ${note.content.substring(0, 150)}... (Category: ${note.category_name || 'Uncategorized'})`)
          .join('\n');
        
        similarNotesContext = `\n\nRelevant past notes from the user:\n${noteContexts}`;
        console.log(`Found ${similarNotes.length} similar notes for context`);
      }
    }

    console.log(`Using AI settings - Model: ${model}, Temperature: ${temperature}`);

    // Use AI to categorize the note with RAG context
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}

Existing categories: ${categoryList}${similarNotesContext}`
          },
          {
            role: 'user',
            content: `Categorize this note: "${noteContent}"`
          }
        ],
        temperature,
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