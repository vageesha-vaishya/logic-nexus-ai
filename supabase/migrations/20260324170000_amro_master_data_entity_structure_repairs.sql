-- DB-VERIFICATION: amro-master-data-entity-structure-repairs-reviewed
-- DB-ARCH-APPROVAL: amro-master-data-entity-structure-repairs-approved

CREATE TABLE IF NOT EXISTS public.shift_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  station_code text NOT NULL,
  shift_name text NOT NULL,
  shift_start_time time NOT NULL,
  shift_end_time time NOT NULL,
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT ck_shift_calendars_effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT ck_shift_calendars_shift_window_nonzero CHECK (shift_start_time <> shift_end_time)
);

CREATE TABLE IF NOT EXISTS public.regulator_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  regulator_code text NOT NULL,
  regulator_name text NOT NULL,
  jurisdiction text NOT NULL,
  policy_version text NOT NULL,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT uq_regulator_profiles_tenant_code UNIQUE (tenant_id, regulator_code),
  CONSTRAINT ck_regulator_profiles_effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

ALTER TABLE public.shift_calendars
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.shift_calendars
  DROP CONSTRAINT IF EXISTS ck_shift_calendars_shift_window_nonzero;
ALTER TABLE public.shift_calendars
  ADD CONSTRAINT ck_shift_calendars_shift_window_nonzero
  CHECK (shift_start_time <> shift_end_time);

DROP INDEX IF EXISTS public.uq_shift_calendars_unique_shift;
CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_calendars_tenant_franchise_station_shift_effective_active
  ON public.shift_calendars (
    tenant_id,
    COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid),
    station_code,
    shift_name,
    effective_from
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shift_calendars_tenant_active
  ON public.shift_calendars (tenant_id, is_active)
  WHERE deleted_at IS NULL AND is_active = true;

ALTER TABLE public.regulator_profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.regulator_profiles
  DROP CONSTRAINT IF EXISTS uq_regulator_profiles_tenant_code;

CREATE UNIQUE INDEX IF NOT EXISTS uq_regulator_profiles_tenant_franchise_code_policy_active
  ON public.regulator_profiles (
    tenant_id,
    COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid),
    regulator_code,
    policy_version
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_regulator_profiles_tenant_active
  ON public.regulator_profiles (tenant_id, is_active)
  WHERE deleted_at IS NULL AND is_active = true;

DROP INDEX IF EXISTS public.uq_work_package_templates_tenant_franchise_code_version;
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_package_templates_tenant_franchise_code_version_active
  ON public.work_package_templates (
    tenant_id,
    COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid),
    template_code,
    version
  )
  WHERE deleted_at IS NULL;

ALTER TABLE public.work_package_templates
  DROP CONSTRAINT IF EXISTS ck_work_package_templates_scope_json_array;
ALTER TABLE public.work_package_templates
  ADD CONSTRAINT ck_work_package_templates_scope_json_array
  CHECK (jsonb_typeof(scope_json) = 'array');

ALTER TABLE public.work_package_templates
  DROP CONSTRAINT IF EXISTS ck_work_package_templates_tasks_json_array;
ALTER TABLE public.work_package_templates
  ADD CONSTRAINT ck_work_package_templates_tasks_json_array
  CHECK (jsonb_typeof(tasks_json) = 'array');
