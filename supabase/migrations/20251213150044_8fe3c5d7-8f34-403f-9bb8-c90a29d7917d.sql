-- Link Slack users to app users
CREATE TABLE public.slack_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  slack_user_id TEXT NOT NULL UNIQUE,
  slack_workspace_id TEXT NOT NULL,
  slack_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.slack_user_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own slack mappings"
ON public.slack_user_mappings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own slack mappings"
ON public.slack_user_mappings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own slack mappings"
ON public.slack_user_mappings FOR DELETE
USING (auth.uid() = user_id);

-- Track Slack threads → conversations
CREATE TABLE public.slack_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  slack_channel_id TEXT NOT NULL,
  slack_thread_ts TEXT,
  slack_workspace_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slack_channel_id, slack_thread_ts, slack_workspace_id)
);

-- Enable RLS
ALTER TABLE public.slack_conversations ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role will bypass for edge function)
CREATE POLICY "Users can view slack conversations they own"
ON public.slack_conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = slack_conversations.conversation_id
    AND c.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_slack_user_mappings_updated_at
BEFORE UPDATE ON public.slack_user_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();