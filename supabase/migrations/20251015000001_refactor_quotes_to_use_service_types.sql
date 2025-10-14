BEGIN;

-- Add the new service_type_id column to the quotes table
ALTER TABLE public.quotes
ADD COLUMN service_type_id UUID REFERENCES public.service_types(id);

-- Update the new column with data from the old mode column
UPDATE public.quotes q
SET service_type_id = st.id
FROM public.service_types st
WHERE st.name = q.mode::text;

-- Drop the old mode column
ALTER TABLE public.quotes
DROP COLUMN mode;

COMMIT;