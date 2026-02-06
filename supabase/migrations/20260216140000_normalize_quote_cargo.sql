
-- Migration to add normalized container references to quote_cargo_configurations
-- Aligns with container_types and container_sizes master data

BEGIN;

-- Add foreign key columns
ALTER TABLE public.quote_cargo_configurations
ADD COLUMN IF NOT EXISTS container_type_id UUID REFERENCES public.container_types(id),
ADD COLUMN IF NOT EXISTS container_size_id UUID REFERENCES public.container_sizes(id);

-- Optional: Try to backfill IDs based on names (best effort)
-- This assumes names match exactly. If not, they remain null which is fine as we still have the text columns.
UPDATE public.quote_cargo_configurations qcc
SET container_type_id = ct.id
FROM public.container_types ct
WHERE qcc.container_type = ct.name
  AND qcc.container_type_id IS NULL;

UPDATE public.quote_cargo_configurations qcc
SET container_size_id = cs.id
FROM public.container_sizes cs
WHERE qcc.container_size = cs.name
  AND qcc.container_size_id IS NULL;

COMMIT;
