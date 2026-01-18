-- Add service_type_id FK to service_type_mappings and create ocean sub-service mappings

-- 1) Add service_type_id column to service_type_mappings
ALTER TABLE public.service_type_mappings 
ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);

-- 2) Create index for lookups
CREATE INDEX IF NOT EXISTS service_type_mappings_service_type_id_idx 
ON public.service_type_mappings(service_type_id);

-- 3) Populate service_type_id based on existing service_type text values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_type_mappings'
      AND column_name = 'service_type'
  ) THEN
    EXECUTE $sql$
      UPDATE public.service_type_mappings stm
      SET service_type_id = st.id
      FROM public.service_types st
      WHERE stm.service_type_id IS NULL
        AND (
          st.code = stm.service_type
          OR LOWER(REPLACE(st.name, ' ', '_')) = LOWER(stm.service_type)
        )
    $sql$;
  END IF;
END $$;

-- 4) Create mappings for ocean sub-services using INSERT with NOT EXISTS checks

-- LCL → match service name first (priority 0)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_lcl'
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%lcl%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%less%than%container%load%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- LCL → fallback to generic ocean services (priority 10)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_lcl'
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- RORO → match service name first (priority 0)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_roro'
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%roro%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%ro/ro%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%roll%on%roll%off%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- RORO → fallback to generic ocean services (priority 10)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_roro'
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_roro')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- Break Bulk → match service name first (priority 0)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_breakbulk'
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%break bulk%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%break-bulk%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%breakbulk%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- Break Bulk → fallback to generic ocean services (priority 10)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_breakbulk'
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_breakbulk')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );
