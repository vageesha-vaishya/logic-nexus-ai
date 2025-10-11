-- Remove duplicate carrier names, keeping only the oldest entry per tenant
BEGIN;

-- Delete duplicates, keeping only the one with the smallest id (oldest)
DELETE FROM public.carriers c1
WHERE EXISTS (
  SELECT 1 FROM public.carriers c2
  WHERE c1.tenant_id = c2.tenant_id
    AND c1.carrier_name = c2.carrier_name
    AND c1.id > c2.id
);

-- Add a unique constraint to prevent future duplicates
ALTER TABLE public.carriers DROP CONSTRAINT IF EXISTS carriers_unique_name_per_tenant;
ALTER TABLE public.carriers
  ADD CONSTRAINT carriers_unique_name_per_tenant 
  UNIQUE (tenant_id, carrier_name);

COMMIT;