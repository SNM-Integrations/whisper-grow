-- Add missing UPDATE and DELETE RLS policies for note_embeddings
CREATE POLICY "Users can update embeddings for their own notes"
ON note_embeddings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM notes
    WHERE notes.id = note_embeddings.note_id
    AND notes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete embeddings for their own notes"
ON note_embeddings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM notes
    WHERE notes.id = note_embeddings.note_id
    AND notes.user_id = auth.uid()
  )
);

-- Add missing UPDATE and DELETE RLS policies for note_connections
CREATE POLICY "Users can update connections for their own notes"
ON note_connections
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM notes
    WHERE notes.id = note_connections.source_note_id
    AND notes.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete connections for their own notes"
ON note_connections
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM notes
    WHERE notes.id = note_connections.source_note_id
    AND notes.user_id = auth.uid()
  )
);