-- Create integration settings table for per-account/org API configuration
CREATE TABLE public.integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL, -- 'google', 'n8n', etc.
  settings JSONB NOT NULL DEFAULT '{}', -- Encrypted-at-rest by Supabase
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, integration_type)
);

-- Enable RLS
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Users can view their own settings or org settings they belong to
CREATE POLICY "Users can view their integration settings"
ON public.integration_settings
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (organization_id IS NOT NULL AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

-- Users can create their own settings
CREATE POLICY "Users can create their integration settings"
ON public.integration_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings or org settings if admin
CREATE POLICY "Users can update their integration settings"
ON public.integration_settings
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR (organization_id IS NOT NULL AND is_org_admin(auth.uid(), organization_id))
);

-- Users can delete their own settings or org settings if admin
CREATE POLICY "Users can delete their integration settings"
ON public.integration_settings
FOR DELETE
USING (
  auth.uid() = user_id 
  OR (organization_id IS NOT NULL AND is_org_admin(auth.uid(), organization_id))
);

-- Add trigger for updated_at
CREATE TRIGGER update_integration_settings_updated_at
BEFORE UPDATE ON public.integration_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();