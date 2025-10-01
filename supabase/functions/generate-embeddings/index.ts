import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { noteId, content } = await req.json();

    if (!noteId || !content) {
      return new Response(
        JSON.stringify({ error: 'noteId and content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify note ownership
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('user_id')
      .eq('id', noteId)
      .single();

    if (noteError || !note) {
      return new Response(
        JSON.stringify({ error: 'Note not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (note.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized access to note' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating embedding for note:', noteId);

    // Generate embedding using OpenAI
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: content,
        model: 'text-embedding-3-small',
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('OpenAI embedding error:', embeddingResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate embedding' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    console.log('Embedding generated, length:', embedding.length);

    // Store embedding in database
    const { error: insertError } = await supabase
      .from('note_embeddings')
      .upsert({
        note_id: noteId,
        embedding: embedding,
      });

    if (insertError) {
      console.error('Error storing embedding:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to store embedding' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Embedding stored successfully');

    return new Response(
      JSON.stringify({ success: true, noteId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-embeddings function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});