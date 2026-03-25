-- DB-VERIFICATION: amro-manufacturers-master-data-reviewed
-- DB-ARCH-APPROVAL: amro-manufacturers-master-data-approved
-- SCHEMA-OVERLAP-ANALYSIS: Reviewed aircraft manufacturer text column and existing AMRO master data tables (suppliers, maintenance_facilities, work_centers, skill_codes); no normalized manufacturer registry exists.
-- EXTENSION-ASSESSMENT: Extending aircraft manufacturer text alone cannot support active/inactive governance or cross-module reuse.
-- EXTENSION-RATIONALE: New manufacturers table required to enforce referential integrity, active status checks, and shared manufacturer lookups.

CREATE TABLE IF NOT EXISTS public.manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_code text NOT NULL,
  name text NOT NULL,
  country text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_manufacturers_code_active
  ON public.manufacturers(manufacturer_code)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_manufacturers_name_active
  ON public.manufacturers(lower(name))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_manufacturers_is_active ON public.manufacturers(is_active);
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON public.manufacturers(lower(name));

ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amro_platform_admin_access ON public.manufacturers;
CREATE POLICY amro_platform_admin_access
  ON public.manufacturers
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_authenticated_access ON public.manufacturers;
CREATE POLICY amro_authenticated_access
  ON public.manufacturers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL;

WITH source AS (
  SELECT
    manufacturer,
    left(regexp_replace(upper(manufacturer), '[^A-Z0-9]+', '_', 'g'), 18) || '-' || substring(md5(manufacturer), 1, 4) AS manufacturer_code
  FROM public.aircraft
  WHERE manufacturer IS NOT NULL AND btrim(manufacturer) <> ''
  GROUP BY manufacturer
),
deduped AS (
  SELECT DISTINCT ON (manufacturer_code)
    manufacturer,
    manufacturer_code
  FROM source
  ORDER BY manufacturer_code, manufacturer
),
inserted AS (
  INSERT INTO public.manufacturers (manufacturer_code, name, is_active, metadata)
  SELECT
    manufacturer_code,
    manufacturer,
    true,
    jsonb_build_object('source', 'aircraft_backfill')
  FROM deduped
  ON CONFLICT (manufacturer_code) WHERE deleted_at IS NULL DO UPDATE
  SET
    name = EXCLUDED.name,
    is_active = true,
    updated_at = now(),
    deleted_at = NULL
  RETURNING id, name
)
UPDATE public.aircraft AS aircraft
SET manufacturer_id = manufacturers.id
FROM public.manufacturers AS manufacturers
WHERE aircraft.manufacturer_id IS NULL
  AND lower(btrim(aircraft.manufacturer)) = lower(btrim(manufacturers.name));

CREATE INDEX IF NOT EXISTS idx_aircraft_manufacturer_id ON public.aircraft(manufacturer_id);
