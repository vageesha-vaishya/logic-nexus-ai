-- Migration to add normalized container references to shipment_cargo_configurations and shipment_containers
-- Aligns with container_types and container_sizes master data

BEGIN;

-- 1. shipment_cargo_configurations
ALTER TABLE public.shipment_cargo_configurations
ADD COLUMN IF NOT EXISTS container_type_id UUID REFERENCES public.container_types(id),
ADD COLUMN IF NOT EXISTS container_size_id UUID REFERENCES public.container_sizes(id);

-- Backfill based on name matching
UPDATE public.shipment_cargo_configurations scc
SET container_type_id = ct.id
FROM public.container_types ct
WHERE scc.container_type = ct.name
  AND scc.container_type_id IS NULL;

UPDATE public.shipment_cargo_configurations scc
SET container_size_id = cs.id
FROM public.container_sizes cs
WHERE scc.container_size = cs.name
  AND scc.container_size_id IS NULL;

-- 2. shipment_containers
ALTER TABLE public.shipment_containers
ADD COLUMN IF NOT EXISTS container_type_id UUID REFERENCES public.container_types(id),
ADD COLUMN IF NOT EXISTS container_size_id UUID REFERENCES public.container_sizes(id);

-- Backfill based on name matching
-- Note: shipment_containers only has container_type column which might be name or code
-- We try matching against name first
UPDATE public.shipment_containers sc
SET container_type_id = ct.id
FROM public.container_types ct
WHERE sc.container_type = ct.name
  AND sc.container_type_id IS NULL;

-- Also try matching against code if name didn't match
UPDATE public.shipment_containers sc
SET container_type_id = ct.id
FROM public.container_types ct
WHERE sc.container_type = ct.code
  AND sc.container_type_id IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipment_cargo_container_type ON public.shipment_cargo_configurations(container_type_id);
CREATE INDEX IF NOT EXISTS idx_shipment_cargo_container_size ON public.shipment_cargo_configurations(container_size_id);
CREATE INDEX IF NOT EXISTS idx_shipment_containers_container_type ON public.shipment_containers(container_type_id);
CREATE INDEX IF NOT EXISTS idx_shipment_containers_container_size ON public.shipment_containers(container_size_id);

COMMIT;
