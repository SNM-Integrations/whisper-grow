-- Add unique constraint for upsert on google_auth_tokens
-- This allows storing one token per user per organization (or null for personal)
CREATE UNIQUE INDEX google_auth_tokens_user_org_unique 
ON public.google_auth_tokens (user_id, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));