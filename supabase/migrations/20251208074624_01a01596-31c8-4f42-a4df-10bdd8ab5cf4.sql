-- Fix organization_members INSERT policies
DROP POLICY IF EXISTS "Users can add themselves as owner to new org" ON public.organization_members;

CREATE POLICY "Users can add themselves as owner to new org"
ON public.organization_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND role = 'owner'
);

-- Separate policy for admins adding other members
CREATE POLICY "Admins can add members to their org"
ON public.organization_members FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_admin(auth.uid(), organization_id) AND role != 'owner'
);

-- Create atomic org creation function
CREATE OR REPLACE FUNCTION public.create_organization(org_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  org_slug TEXT;
BEGIN
  org_slug := lower(regexp_replace(org_name, '[^a-zA-Z0-9]+', '-', 'g'));
  
  INSERT INTO organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO new_org_id;
  
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org_id, auth.uid(), 'owner');
  
  RETURN new_org_id;
END;
$$;