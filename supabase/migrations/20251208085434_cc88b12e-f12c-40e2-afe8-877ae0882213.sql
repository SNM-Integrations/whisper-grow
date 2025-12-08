-- Add contact_type enum (contact = close network, lead = sales lead)
CREATE TYPE public.contact_type AS ENUM ('contact', 'lead');

-- Add company_type enum (lead = prospective, client = existing customer)
CREATE TYPE public.company_type AS ENUM ('lead', 'client');

-- Add contact_type to contacts table
ALTER TABLE public.contacts ADD COLUMN contact_type public.contact_type NOT NULL DEFAULT 'contact';

-- Add company_type to companies table
ALTER TABLE public.companies ADD COLUMN company_type public.company_type NOT NULL DEFAULT 'lead';

-- Add assigned_to column for delegation to tasks
ALTER TABLE public.tasks ADD COLUMN assigned_to uuid;

-- Add assigned_to column for delegation to deals
ALTER TABLE public.deals ADD COLUMN assigned_to uuid;

-- Add assigned_to column for delegation to calendar_events
ALTER TABLE public.calendar_events ADD COLUMN assigned_to uuid;

-- Add assigned_to column for delegation to contacts
ALTER TABLE public.contacts ADD COLUMN assigned_to uuid;

-- Add assigned_to column for delegation to companies
ALTER TABLE public.companies ADD COLUMN assigned_to uuid;