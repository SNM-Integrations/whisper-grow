-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create note_embeddings table to store vector representations of notes
CREATE TABLE public.note_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  embedding vector(768),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(note_id)
);

-- Enable RLS on note_embeddings
ALTER TABLE public.note_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies for note_embeddings
CREATE POLICY "Users can view embeddings for their own notes"
  ON public.note_embeddings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_embeddings.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert embeddings for their own notes"
  ON public.note_embeddings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_embeddings.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Create note_connections table for knowledge graph relationships
CREATE TABLE public.note_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  target_note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  similarity_score NUMERIC(5,4),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_note_id, target_note_id)
);

-- Enable RLS on note_connections
ALTER TABLE public.note_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies for note_connections
CREATE POLICY "Users can view connections for their own notes"
  ON public.note_connections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_connections.source_note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert connections for their own notes"
  ON public.note_connections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes
      WHERE notes.id = note_connections.source_note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Create index for faster vector similarity searches
CREATE INDEX note_embeddings_embedding_idx ON public.note_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for note_id lookups
CREATE INDEX note_embeddings_note_id_idx ON public.note_embeddings(note_id);

-- Create indexes for note_connections
CREATE INDEX note_connections_source_idx ON public.note_connections(source_note_id);
CREATE INDEX note_connections_target_idx ON public.note_connections(target_note_id);