-- Add service_type_id FK and create ocean sub-service mappings using text-based service_type

-- 1) Add service_type_id column for future FK-based lookups
ALTER TABLE public.service_type_mappings 
ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);

CREATE INDEX IF NOT EXISTS service_type_mappings_service_type_id_idx 
ON public.service_type_mappings(service_type_id);

-- 2) Create unique constraint on text-based columns (tenant_id, service_type, service_id)
CREATE UNIQUE INDEX IF NOT EXISTS service_type_mappings_tenant_type_service_text_unique
ON public.service_type_mappings(tenant_id, service_type, service_id);

-- 3) Populate service_type_id for existing records based on service_type text
UPDATE public.service_type_mappings stm
SET service_type_id = st.id
FROM public.service_types st
WHERE stm.service_type_id IS NULL
  AND (st.code = stm.service_type 
       OR LOWER(REPLACE(st.name, ' ', '_')) = LOWER(stm.service_type));

-- 4) Create mappings for LCL services
INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
SELECT s.tenant_id, 'ocean_lcl', s.id, false, 0, true
FROM public.services s
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%lcl%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%less%than%container%load%')
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- LCL fallback
INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, 'ocean_lcl', s.id, false, 10, true
FROM public.services s
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type = 'ocean_lcl'
      AND m.service_id = s.id
  )
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- 5) Create mappings for RORO services
INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
SELECT s.tenant_id, 'ocean_roro', s.id, false, 0, true
FROM public.services s
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%roro%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%ro/ro%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%roll%on%roll%off%')
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- RORO fallback
INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, 'ocean_roro', s.id, false, 10, true
FROM public.services s
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_roro')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type = 'ocean_roro'
      AND m.service_id = s.id
  )
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- 6) Create mappings for Break Bulk services
INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
SELECT s.tenant_id, 'ocean_breakbulk', s.id, false, 0, true
FROM public.services s
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%break bulk%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%break-bulk%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%breakbulk%')
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- Break Bulk fallback
INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, 'ocean_breakbulk', s.id, false, 10, true
FROM public.services s
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_breakbulk')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type = 'ocean_breakbulk'
      AND m.service_id = s.id
  )
ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

-- 7) Populate service_type_id for the newly inserted records
UPDATE public.service_type_mappings stm
SET service_type_id = st.id
FROM public.service_types st
WHERE stm.service_type_id IS NULL
  AND st.code = stm.service_type;