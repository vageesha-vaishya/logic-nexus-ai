-- Seed/align ocean sub-service types and optional mappings
-- Adds/updates service_types for Break Bulk, LCL, and RORO with codes
-- Optionally links legs (`quotation_version_option_legs`) and services to service_type_id where applicable

BEGIN;

-- Ensure service_types has `code` and uniqueness (idempotent)
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS service_types_code_unique ON public.service_types(code);
UPDATE public.service_types SET code = LOWER(REPLACE(name, ' ', '_')) WHERE code IS NULL;
ALTER TABLE public.service_types ALTER COLUMN code SET NOT NULL;

-- Upsert ocean sub-service types by code
INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('Break Bulk', 'ocean_breakbulk', 'Ocean break bulk (non-containerized)', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('LCL', 'ocean_lcl', 'Less than container load ocean freight', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('RORO', 'ocean_roro', 'Roll-on/roll-off vehicle cargo', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true;

-- Add service_type_id to the current legs table (quotation_version_option_legs) if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotation_version_option_legs'
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotation_version_option_legs
      ADD COLUMN service_type_id uuid NULL REFERENCES public.service_types(id);
    CREATE INDEX IF NOT EXISTS quotation_version_option_legs_service_type_idx
      ON public.quotation_version_option_legs(service_type_id);
  END IF;
END $$;

-- Optionally link services to these new service types where names indicate LCL/RORO/Break Bulk
DO $$
DECLARE
  has_mode boolean;
  has_name boolean;
  has_service_type_id boolean;
  has_service_type_text boolean;
  lcl_id uuid;
  roro_id uuid;
  bb_id uuid;
BEGIN
  SELECT id INTO lcl_id FROM public.service_types WHERE code = 'ocean_lcl' LIMIT 1;
  SELECT id INTO roro_id FROM public.service_types WHERE code = 'ocean_roro' LIMIT 1;
  SELECT id INTO bb_id FROM public.service_types WHERE code = 'ocean_breakbulk' LIMIT 1;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'mode'
  ) INTO has_mode;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'name'
  ) INTO has_name;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_type_id'
  ) INTO has_service_type_id;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_type'
  ) INTO has_service_type_text;

  IF has_service_type_id THEN
    IF has_mode AND has_name THEN
      UPDATE public.services s SET service_type_id = lcl_id
      WHERE s.service_type_id IS NULL AND s.mode::text = 'ocean' AND lower(s.name) LIKE '%lcl%';

      UPDATE public.services s SET service_type_id = roro_id
      WHERE s.service_type_id IS NULL AND s.mode::text = 'ocean' AND lower(s.name) LIKE '%roro%';

      UPDATE public.services s SET service_type_id = bb_id
      WHERE s.service_type_id IS NULL AND s.mode::text = 'ocean' AND (
        lower(s.name) LIKE '%break bulk%' OR lower(s.name) LIKE '%break-bulk%'
      );
    ELSIF has_service_type_text THEN
      -- Fallback: text-based service_type + legacy name field(s)
      UPDATE public.services s SET service_type_id = lcl_id
      WHERE s.service_type_id IS NULL AND s.service_type = 'ocean'
        AND lower(coalesce(s.name, s.service_name, '')) LIKE '%lcl%';

      UPDATE public.services s SET service_type_id = roro_id
      WHERE s.service_type_id IS NULL AND s.service_type = 'ocean'
        AND lower(coalesce(s.name, s.service_name, '')) LIKE '%roro%';

      UPDATE public.services s SET service_type_id = bb_id
      WHERE s.service_type_id IS NULL AND s.service_type = 'ocean'
        AND (
          lower(coalesce(s.name, s.service_name, '')) LIKE '%break bulk%'
          OR lower(coalesce(s.name, s.service_name, '')) LIKE '%break-bulk%'
        );
    END IF;
  END IF;
END $$;

COMMIT;