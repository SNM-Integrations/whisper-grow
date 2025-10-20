-- Fix: create policies using correct pg_policies column names

-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.google_auth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.google_auth_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'google_auth_tokens' AND policyname = 'Users can view their own google tokens'
  ) THEN
    CREATE POLICY "Users can view their own google tokens"
    ON public.google_auth_tokens
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'google_auth_tokens' AND policyname = 'Users can insert their own google tokens'
  ) THEN
    CREATE POLICY "Users can insert their own google tokens"
    ON public.google_auth_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'google_auth_tokens' AND policyname = 'Users can update their own google tokens'
  ) THEN
    CREATE POLICY "Users can update their own google tokens"
    ON public.google_auth_tokens
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'google_auth_tokens' AND policyname = 'Users can delete their own google tokens'
  ) THEN
    CREATE POLICY "Users can delete their own google tokens"
    ON public.google_auth_tokens
    FOR DELETE
    USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_google_auth_tokens_updated_at'
  ) THEN
    CREATE TRIGGER trg_google_auth_tokens_updated_at
    BEFORE UPDATE ON public.google_auth_tokens
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;