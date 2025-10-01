-- Update note_embeddings vector dimension to match OpenAI text-embedding-3-small (1536)
ALTER TABLE public.note_embeddings
ALTER COLUMN embedding TYPE vector(1536);

-- No data migration needed since table is currently empty per recent queries.
-- RLS and functions remain unchanged.