BEGIN;

ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS job_position TEXT,
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS address_line1 TEXT,
ADD COLUMN IF NOT EXISTS address_line2 TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS salesperson_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sales_team TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::TEXT[],
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE public.leads
SET company_name = company
WHERE company_name IS NULL
AND company IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_priority_check') THEN
    ALTER TABLE public.leads
    ADD CONSTRAINT leads_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'critical'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_description_length_check') THEN
    ALTER TABLE public.leads
    ADD CONSTRAINT leads_description_length_check
    CHECK (description IS NULL OR char_length(description) <= 5000);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_notes_length_check') THEN
    ALTER TABLE public.leads
    ADD CONSTRAINT leads_notes_length_check
    CHECK (notes IS NULL OR char_length(notes) <= 10000);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_company_name ON public.leads(company_name);
CREATE INDEX IF NOT EXISTS idx_leads_salesperson_id ON public.leads(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON public.leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_tags_gin ON public.leads USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_leads_contact_name ON public.leads(contact_name);
CREATE INDEX IF NOT EXISTS idx_leads_city_state ON public.leads(city, state);

COMMIT;
