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
    const systemPrompt = aiSettings?.system_prompt || `You are an intelligent categorization assistant for a personal knowledge management system. Your role is to analyze notes and suggest the most semantically appropriate category based on the user's existing knowledge structure and patterns.

CONTEXT UNDERSTANDING:
- You will receive the user's existing categories
- You will see similar notes the user has written before (with their categories)
- Use this context to understand the user's categorization preferences and knowledge structure
- The similar notes show what the user considers related content

CATEGORIZATION PRINCIPLES:

1. CONSISTENCY FIRST
   - Strongly prefer existing categories when the note's core concept aligns with them
   - Look at how similar past notes were categorized as a guide
   - Maintain the user's established taxonomy and naming conventions
   - Don't create variations of existing categories (e.g., avoid "JavaScript Tips" if "JavaScript" exists)

2. SEMANTIC MATCHING
   - Focus on the note's primary topic or intent, not just keywords
   - Consider the broader domain or field the note belongs to
   - Match based on conceptual similarity, not surface-level text matching
   - A note about "React hooks" belongs in "React" or "Frontend", not necessarily "Hooks"

3. WHEN TO CREATE NEW CATEGORIES
   Only create a new category when:
   - The note covers a genuinely distinct topic not represented by existing categories
   - The concept is substantial enough to warrant its own category (not a one-off topic)
   - The new category would be useful for organizing future related notes
   - Similar past notes show this is a recurring theme without a category

4. CATEGORY NAMING BEST PRACTICES
   - Use 1-3 words maximum
   - Choose broad, reusable names over hyper-specific ones
   - Prefer established domain terminology (e.g., "Machine Learning" over "AI Stuff")
   - Use singular form unless the category is inherently plural (e.g., "Recipe" not "Recipes")
   - Be descriptive but concise (e.g., "Home Improvement" not "House Projects And Fixes")
   - Capitalize properly (title case)

5. DECISION-MAKING HIERARCHY
   a) If similar notes exist with categories → strongly consider those categories
   b) If multiple existing categories fit → choose the most specific relevant one
   c) If no existing category fits well → evaluate if this is a recurring topic
   d) If truly novel and likely recurring → create a clear, reusable category name

CRITICAL OUTPUT REQUIREMENT:
- Return ONLY the category name
- No explanations, no punctuation, no additional text
- Just the category name exactly as it should appear

Examples of good categorization thinking:
- Note about "setting up Docker containers" → "DevOps" (if exists) rather than creating "Docker" or "Containers"
- Note about "morning routine ideas" → "Personal Development" (if exists) rather than "Routines" or "Mornings"
- Note about "fixing kitchen sink" → "Home Improvement" (if exists) rather than "Repairs" or "Kitchen"
- Note about a specific book insight → "Books" or "Reading" rather than the book's title`;

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