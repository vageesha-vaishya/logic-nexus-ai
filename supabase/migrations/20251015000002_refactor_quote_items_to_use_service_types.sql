BEGIN;

-- Add the new service_type_id column to the quote_items table
ALTER TABLE public.quote_items
ADD COLUMN service_type_id UUID REFERENCES public.service_types(id);

-- Update the new column with data from the quotes table
UPDATE public.quote_items qi
SET service_type_id = q.service_type_id
FROM public.quotes q
WHERE qi.quote_id = q.id;

-- Drop the old mode column
ALTER TABLE public.quote_items
DROP COLUMN mode;

COMMIT;