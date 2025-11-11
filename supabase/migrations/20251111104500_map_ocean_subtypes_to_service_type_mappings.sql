-- Map Ocean sub-services (Break Bulk, LCL, RORO) to service_type_mappings
-- Idempotently ensures service_types exist and creates tenant-scoped mappings
-- so Quote Composer can reflect these service types via FK lookups.

BEGIN;

-- 1) Ensure service_types has codes and entries for the three sub-services
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS service_types_code_unique ON public.service_types(code);
UPDATE public.service_types SET code = LOWER(REPLACE(name, ' ', '_')) WHERE code IS NULL;
ALTER TABLE public.service_types ALTER COLUMN code SET NOT NULL;

-- Upsert service types by code
INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('Break Bulk', 'ocean_breakbulk', 'Ocean break bulk (non-containerized)', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('LCL', 'ocean_lcl', 'Less than container load ocean freight', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('RORO', 'ocean_roro', 'Roll-on/roll-off vehicle cargo', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true;

-- Fetch IDs for later use
WITH st AS (
  SELECT id, code FROM public.service_types WHERE code IN ('ocean_breakbulk','ocean_lcl','ocean_roro')
)
SELECT 1;

-- 2) Create mappings for tenant services: pattern-first, with safe fallbacks to generic ocean
-- Assumptions:
-- - services.service_name contains the human label (used by UI)
-- - services.service_type contains broad mode values like 'ocean', 'ocean_freight', 'ocean_lcl', 'ocean_roro'
-- - service_type_mappings has been normalized to use service_type_id (FK) and unique index (tenant_id, service_type_id, service_id)

-- LCL → match name first
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_lcl'
WHERE s.tenant_id IS NOT NULL
  AND (lower(coalesce(s.service_name, '')) LIKE '%lcl%'
       OR lower(coalesce(s.service_name, '')) LIKE '%less%than%container%load%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id AND m.service_id = s.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;

-- LCL → fallback to generic ocean services where no explicit LCL match exists
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_lcl'
WHERE s.tenant_id IS NOT NULL
  AND lower(coalesce(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl','ocean_roro')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;

-- RORO → match name first
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_roro'
WHERE s.tenant_id IS NOT NULL
  AND (lower(coalesce(s.service_name, '')) LIKE '%roro%'
       OR lower(coalesce(s.service_name, '')) LIKE '%ro/ro%'
       OR lower(coalesce(s.service_name, '')) LIKE '%roll%on%roll%off%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id AND m.service_id = s.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;

-- RORO → fallback to generic ocean services where no explicit RORO match exists
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_roro'
WHERE s.tenant_id IS NOT NULL
  AND lower(coalesce(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl','ocean_roro')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;

-- Break Bulk → match name first
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_breakbulk'
WHERE s.tenant_id IS NOT NULL
  AND (
    lower(coalesce(s.service_name, '')) LIKE '%break bulk%'
    OR lower(coalesce(s.service_name, '')) LIKE '%break-bulk%'
    OR lower(coalesce(s.service_name, '')) LIKE '%breakbulk%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id AND m.service_id = s.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;

-- Break Bulk → fallback to generic ocean services where no explicit Break Bulk match exists
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_breakbulk'
WHERE s.tenant_id IS NOT NULL
  AND lower(coalesce(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl','ocean_roro')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;

COMMIT;