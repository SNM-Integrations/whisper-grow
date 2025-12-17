-- Add company_id foreign key to contacts table
ALTER TABLE public.contacts 
ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_contacts_company_id ON public.contacts(company_id);