
BEGIN;

-- Add missing columns to shipments table to support invoicing and duty flow
ALTER TABLE public.shipments 
ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS incoterms TEXT;

COMMIT;
