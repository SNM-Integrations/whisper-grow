-- Add notification settings to tasks
-- This will store an array of notification intervals like ['24h', '48h', '1w']
ALTER TABLE public.tasks 
ADD COLUMN notification_settings text[] DEFAULT '{}';

-- Add a column to track which notifications have been sent to avoid duplicates
ALTER TABLE public.tasks 
ADD COLUMN notifications_sent text[] DEFAULT '{}';

-- Add org Slack channel configuration to integration_settings
-- This will be used by organizations to specify their notification channel