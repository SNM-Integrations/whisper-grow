-- Fix RLS policies to allow org members to update/delete organization resources
-- Currently only the creator (user_id) can modify, but org members should be able to modify org resources

-- ============ TASKS ============
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
CREATE POLICY "Users can update accessible tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;
CREATE POLICY "Users can delete accessible tasks" 
ON public.tasks 
FOR DELETE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

-- ============ CALENDAR EVENTS ============
DROP POLICY IF EXISTS "Users can update their own events" ON public.calendar_events;
CREATE POLICY "Users can update accessible events" 
ON public.calendar_events 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Users can delete their own events" ON public.calendar_events;
CREATE POLICY "Users can delete accessible events" 
ON public.calendar_events 
FOR DELETE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

-- ============ DEALS ============
DROP POLICY IF EXISTS "Users can update their own deals" ON public.deals;
CREATE POLICY "Users can update accessible deals" 
ON public.deals 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Users can delete their own deals" ON public.deals;
CREATE POLICY "Users can delete accessible deals" 
ON public.deals 
FOR DELETE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

-- ============ CONTACTS ============
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
CREATE POLICY "Users can update accessible contacts" 
ON public.contacts 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;
CREATE POLICY "Users can delete accessible contacts" 
ON public.contacts 
FOR DELETE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

-- ============ COMPANIES ============
DROP POLICY IF EXISTS "Users can update their own companies" ON public.companies;
CREATE POLICY "Users can update accessible companies" 
ON public.companies 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Users can delete their own companies" ON public.companies;
CREATE POLICY "Users can delete accessible companies" 
ON public.companies 
FOR DELETE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

-- ============ PROJECTS ============
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update accessible projects" 
ON public.projects 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete accessible projects" 
ON public.projects 
FOR DELETE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

-- ============ NOTES ============
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
CREATE POLICY "Users can update accessible notes" 
ON public.notes 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
CREATE POLICY "Users can delete accessible notes" 
ON public.notes 
FOR DELETE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

-- ============ CONVERSATIONS ============
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
CREATE POLICY "Users can update accessible conversations" 
ON public.conversations 
FOR UPDATE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;
CREATE POLICY "Users can delete accessible conversations" 
ON public.conversations 
FOR DELETE 
USING (
  (auth.uid() = user_id) OR 
  (visibility = 'organization' AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);

-- ============ PROJECT DOCUMENTS ============
DROP POLICY IF EXISTS "Users can update documents in their projects" ON public.project_documents;
CREATE POLICY "Users can update documents in accessible projects" 
ON public.project_documents 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id
    AND (
      p.user_id = auth.uid() OR 
      (p.visibility = 'organization' AND p.organization_id IN (SELECT get_user_org_ids(auth.uid())))
    )
  )
);

DROP POLICY IF EXISTS "Users can delete documents in their projects" ON public.project_documents;
CREATE POLICY "Users can delete documents in accessible projects" 
ON public.project_documents 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_documents.project_id
    AND (
      p.user_id = auth.uid() OR 
      (p.visibility = 'organization' AND p.organization_id IN (SELECT get_user_org_ids(auth.uid())))
    )
  )
);