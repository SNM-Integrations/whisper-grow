-- Add Google Drive folder link to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS drive_folder_name TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS drive_last_synced_at TIMESTAMP WITH TIME ZONE;