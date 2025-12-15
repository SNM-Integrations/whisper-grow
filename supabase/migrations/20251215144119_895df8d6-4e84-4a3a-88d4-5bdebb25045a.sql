-- Add SevenTime integration fields to contacts table
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS personal_number text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS zip_code text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS job_description text,
ADD COLUMN IF NOT EXISTS rot_rut_info text,
ADD COLUMN IF NOT EXISTS estimated_hours numeric,
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS seventime_customer_id text,
ADD COLUMN IF NOT EXISTS seventime_workorder_id text;