-- Fix carrier mode mapping
-- The frontend requests 'ocean' mode but many carriers might be missing this specific value
-- or have it set to 'sea' or NULL.

BEGIN;

-- Update well-known Ocean carriers to ensure they have mode = 'ocean'
UPDATE public.carriers
SET mode = 'ocean'
WHERE 
  (
    carrier_name ILIKE '%Maersk%' OR 
    carrier_name ILIKE '%MSC%' OR 
    carrier_name ILIKE '%CMA CGM%' OR 
    carrier_name ILIKE '%COSCO%' OR 
    carrier_name ILIKE '%Hapag-Lloyd%' OR 
    carrier_name ILIKE '%ONE%' OR 
    carrier_name ILIKE '%Evergreen%' OR 
    carrier_name ILIKE '%HMM%' OR 
    carrier_name ILIKE '%ZIM%' OR 
    carrier_name ILIKE '%Yang Ming%' OR
    carrier_name ILIKE '%Mediterranean%'
  )
  AND (mode IS NULL OR mode != 'ocean');

-- Update Air carriers
UPDATE public.carriers
SET mode = 'air'
WHERE 
  (
    carrier_name ILIKE '%Air%' OR 
    carrier_name ILIKE '%Cargo%' OR
    carrier_name ILIKE '%FedEx%' OR
    carrier_name ILIKE '%UPS%' OR
    carrier_name ILIKE '%DHL%' OR
    carrier_name ILIKE '%Emirates%' OR
    carrier_name ILIKE '%Lufthansa%' OR
    carrier_name ILIKE '%Cathay%'
  )
  AND (mode IS NULL OR mode != 'air');

COMMIT;
