-- Allow users to view invitations sent to their email
CREATE POLICY "Users can view invitations for their email"
ON public.organization_invitations
FOR SELECT
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Allow users to delete invitations sent to their email (decline)
CREATE POLICY "Users can decline invitations for their email"
ON public.organization_invitations
FOR DELETE
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Allow invited users to add themselves to organization via invitation
CREATE POLICY "Users can accept invitations and join org"
ON public.organization_members
FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM organization_invitations 
    WHERE organization_id = organization_members.organization_id 
    AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND expires_at > now()
  )
);