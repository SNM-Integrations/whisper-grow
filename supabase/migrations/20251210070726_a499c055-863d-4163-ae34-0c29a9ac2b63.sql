-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  visibility resource_visibility NOT NULL DEFAULT 'personal',
  assigned_to UUID,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project_documents table for both files and rich text docs
CREATE TYPE public.document_type AS ENUM ('file', 'document');

CREATE TABLE public.project_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type document_type NOT NULL DEFAULT 'document',
  name TEXT NOT NULL,
  content TEXT, -- For rich text documents
  file_path TEXT, -- For uploaded files
  file_size BIGINT, -- File size in bytes
  mime_type TEXT, -- MIME type for files
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add project_id to tasks table
ALTER TABLE public.tasks ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add project_id to calendar_events table
ALTER TABLE public.calendar_events ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Add project_id to deals table
ALTER TABLE public.deals ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- Enable RLS on projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can create their own projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view accessible projects"
ON public.projects FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  ((visibility = 'organization') AND (organization_id IN (SELECT get_user_org_ids(auth.uid()))))
);

CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
ON public.projects FOR DELETE
USING (auth.uid() = user_id);

-- Enable RLS on project_documents
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- Project documents policies (access through project ownership)
CREATE POLICY "Users can create documents in their projects"
ON public.project_documents FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
);

CREATE POLICY "Users can view documents in accessible projects"
ON public.project_documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id 
    AND (
      p.user_id = auth.uid() OR 
      (p.visibility = 'organization' AND p.organization_id IN (SELECT get_user_org_ids(auth.uid())))
    )
  )
);

CREATE POLICY "Users can update documents in their projects"
ON public.project_documents FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
);

CREATE POLICY "Users can delete documents in their projects"
ON public.project_documents FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
);

-- Create updated_at triggers
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_documents_updated_at
BEFORE UPDATE ON public.project_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);

-- Storage policies for project files
CREATE POLICY "Users can upload to their projects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their project files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their project files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-files' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);