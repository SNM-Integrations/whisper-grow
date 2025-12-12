-- Add Drive file ID to project_documents for sync tracking
ALTER TABLE public.project_documents ADD COLUMN IF NOT EXISTS drive_file_id TEXT;