-- Add organization_id to slack_user_mappings
ALTER TABLE public.slack_user_mappings 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Drop the unique constraint on just slack_user_id and recreate with org context
ALTER TABLE public.slack_user_mappings 
DROP CONSTRAINT IF EXISTS slack_user_mappings_slack_user_id_key;

-- Allow same Slack user to be mapped to different contexts (personal vs org)
CREATE UNIQUE INDEX slack_user_mappings_unique_context 
ON public.slack_user_mappings (slack_user_id, slack_workspace_id, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Update RLS policies to include org access
DROP POLICY IF EXISTS "Users can view their own slack mappings" ON public.slack_user_mappings;
DROP POLICY IF EXISTS "Users can create their own slack mappings" ON public.slack_user_mappings;
DROP POLICY IF EXISTS "Users can delete their own slack mappings" ON public.slack_user_mappings;

CREATE POLICY "Users can view accessible slack mappings"
ON public.slack_user_mappings FOR SELECT
USING (
  auth.uid() = user_id 
  OR (organization_id IS NOT NULL AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

CREATE POLICY "Users can create slack mappings"
ON public.slack_user_mappings FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (organization_id IS NULL OR organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

CREATE POLICY "Users can delete accessible slack mappings"
ON public.slack_user_mappings FOR DELETE
USING (
  auth.uid() = user_id 
  OR (organization_id IS NOT NULL AND is_org_admin(auth.uid(), organization_id))
);