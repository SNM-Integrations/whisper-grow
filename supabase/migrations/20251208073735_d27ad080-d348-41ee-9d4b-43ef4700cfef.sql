-- Fix organizations RLS: allow authenticated users to insert
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix: allow users to select their newly created org immediately
-- by checking if they're the one inserting (via a trigger that auto-adds owner)
DROP POLICY IF EXISTS "Users can view orgs they belong to" ON public.organizations;
CREATE POLICY "Users can view orgs they belong to or just created"
ON public.organizations FOR SELECT
USING (
  public.is_org_member(auth.uid(), id) OR
  -- Allow viewing during the same transaction (for .select() after insert)
  id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Fix organization_members INSERT policy to allow self-insertion as owner
DROP POLICY IF EXISTS "System can insert org members" ON public.organization_members;
CREATE POLICY "Users can add themselves as owner to new org"
ON public.organization_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND 
  (role = 'owner' OR public.is_org_admin(auth.uid(), organization_id))
);