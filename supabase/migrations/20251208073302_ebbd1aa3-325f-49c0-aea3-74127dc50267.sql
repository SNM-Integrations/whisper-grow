-- Create app roles enum for organizations
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

-- Create visibility enum for resources
CREATE TYPE public.resource_visibility AS ENUM ('personal', 'organization');

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Organization members table
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  role org_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Organization invitations table
CREATE TABLE public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role org_role NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

-- Add organization columns to existing tables
ALTER TABLE public.conversations 
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN visibility resource_visibility NOT NULL DEFAULT 'personal';

ALTER TABLE public.tasks 
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN visibility resource_visibility NOT NULL DEFAULT 'personal';

ALTER TABLE public.notes 
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN visibility resource_visibility NOT NULL DEFAULT 'personal';

ALTER TABLE public.contacts 
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN visibility resource_visibility NOT NULL DEFAULT 'personal';

ALTER TABLE public.companies 
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN visibility resource_visibility NOT NULL DEFAULT 'personal';

ALTER TABLE public.deals 
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN visibility resource_visibility NOT NULL DEFAULT 'personal';

ALTER TABLE public.calendar_events 
  ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN visibility resource_visibility NOT NULL DEFAULT 'personal';

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Security definer function to check org membership
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- Function to check org admin/owner status
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id 
    AND organization_id = _org_id 
    AND role IN ('owner', 'admin')
  )
$$;

-- Function to get user's org IDs
CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id
$$;

-- Organizations RLS policies
CREATE POLICY "Users can view orgs they belong to"
ON public.organizations FOR SELECT
USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Org admins can update their org"
ON public.organizations FOR UPDATE
USING (public.is_org_admin(auth.uid(), id));

CREATE POLICY "Org owners can delete their org"
ON public.organizations FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.organization_members
  WHERE user_id = auth.uid() AND organization_id = id AND role = 'owner'
));

-- Organization members RLS policies
CREATE POLICY "Members can view their org members"
ON public.organization_members FOR SELECT
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "System can insert org members"
ON public.organization_members FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can update org members"
ON public.organization_members FOR UPDATE
USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can remove org members"
ON public.organization_members FOR DELETE
USING (public.is_org_admin(auth.uid(), organization_id) OR user_id = auth.uid());

-- Organization invitations RLS policies
CREATE POLICY "Admins can view org invitations"
ON public.organization_invitations FOR SELECT
USING (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can create invitations"
ON public.organization_invitations FOR INSERT
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Admins can delete invitations"
ON public.organization_invitations FOR DELETE
USING (public.is_org_admin(auth.uid(), organization_id));

-- Update trigger for organizations
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Drop and recreate RLS policies for conversations to handle org visibility
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view accessible conversations"
ON public.conversations FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT public.get_user_org_ids(auth.uid())))
);

-- Drop and recreate RLS policies for tasks to handle org visibility
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
CREATE POLICY "Users can view accessible tasks"
ON public.tasks FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT public.get_user_org_ids(auth.uid())))
);

-- Drop and recreate RLS policies for notes to handle org visibility
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
CREATE POLICY "Users can view accessible notes"
ON public.notes FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT public.get_user_org_ids(auth.uid())))
);

-- Drop and recreate RLS policies for contacts to handle org visibility
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
CREATE POLICY "Users can view accessible contacts"
ON public.contacts FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT public.get_user_org_ids(auth.uid())))
);

-- Drop and recreate RLS policies for companies to handle org visibility
DROP POLICY IF EXISTS "Users can view their own companies" ON public.companies;
CREATE POLICY "Users can view accessible companies"
ON public.companies FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT public.get_user_org_ids(auth.uid())))
);

-- Drop and recreate RLS policies for deals to handle org visibility
DROP POLICY IF EXISTS "Users can view their own deals" ON public.deals;
CREATE POLICY "Users can view accessible deals"
ON public.deals FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT public.get_user_org_ids(auth.uid())))
);

-- Drop and recreate RLS policies for calendar_events to handle org visibility
DROP POLICY IF EXISTS "Users can view their own events" ON public.calendar_events;
CREATE POLICY "Users can view accessible events"
ON public.calendar_events FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT public.get_user_org_ids(auth.uid())))
);