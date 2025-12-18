-- Add columns to google_auth_tokens for multi-account and better tracking
ALTER TABLE google_auth_tokens 
ADD COLUMN IF NOT EXISTS google_email TEXT,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS scopes TEXT[],
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for organization-scoped token lookups
CREATE INDEX IF NOT EXISTS idx_google_auth_tokens_org ON google_auth_tokens(organization_id);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view their own tokens" ON google_auth_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON google_auth_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON google_auth_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON google_auth_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens or org tokens" ON google_auth_tokens;

CREATE POLICY "Users can view their own tokens or org tokens"
ON google_auth_tokens FOR SELECT
USING (
  user_id = auth.uid() 
  OR (organization_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM organization_members 
    WHERE organization_members.organization_id = google_auth_tokens.organization_id 
    AND organization_members.user_id = auth.uid()
  ))
);

CREATE POLICY "Users can insert their own tokens"
ON google_auth_tokens FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tokens"
ON google_auth_tokens FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own tokens"
ON google_auth_tokens FOR DELETE
USING (user_id = auth.uid());