-- Fix search_path for match_notes function
CREATE OR REPLACE FUNCTION match_notes(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_param uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  category_id uuid,
  category_name text,
  similarity float
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.content,
    n.category_id,
    c.name as category_name,
    1 - (ne.embedding <=> query_embedding) as similarity
  FROM note_embeddings ne
  JOIN notes n ON ne.note_id = n.id
  LEFT JOIN categories c ON n.category_id = c.id
  WHERE n.user_id = user_id_param
    AND 1 - (ne.embedding <=> query_embedding) > match_threshold
  ORDER BY ne.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;