import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { noteId } = await req.json();

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

    // Get the note's embedding
    const { data: noteEmbedding, error: embeddingError } = await supabase
      .from('note_embeddings')
      .select('embedding')
      .eq('note_id', noteId)
      .single();

    if (embeddingError || !noteEmbedding) {
      return new Response(
        JSON.stringify({ error: 'Note embedding not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find similar notes using the match_notes function
    const { data: similarNotes, error: matchError } = await supabase.rpc('match_notes', {
      query_embedding: noteEmbedding.embedding,
      match_threshold: 0.7, // 70% similarity threshold
      match_count: 10,
      user_id_param: user.id
    });

    if (matchError) {
      console.error('Error finding similar notes:', matchError);
      return new Response(
        JSON.stringify({ error: 'Failed to find similar notes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out the source note itself and create bidirectional connections
    const connections = similarNotes
      .filter((note: any) => note.id !== noteId)
      .map((note: any) => ({
        source_note_id: noteId,
        target_note_id: note.id,
        similarity_score: note.similarity
      }));

    // Delete existing connections for this note
    await supabase
      .from('note_connections')
      .delete()
      .eq('source_note_id', noteId);

    // Insert new connections
    if (connections.length > 0) {
      const { error: insertError } = await supabase
        .from('note_connections')
        .insert(connections);

      if (insertError) {
        console.error('Error inserting connections:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create connections' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        connectionsCreated: connections.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in auto-link-notes:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
