-- Add missing container_size column to shipment_containers
-- This is required by the sync_shipment_container_columns trigger

ALTER TABLE public.shipment_containers
ADD COLUMN IF NOT EXISTS container_size TEXT;

-- Backfill container_size based on container_size_id if available
UPDATE public.shipment_containers sc
SET container_size = cs.name
FROM public.container_sizes cs
WHERE sc.container_size_id = cs.id
  AND sc.container_size IS NULL;
