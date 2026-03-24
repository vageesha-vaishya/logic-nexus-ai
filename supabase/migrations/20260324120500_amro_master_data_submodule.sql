-- DB-VERIFICATION: amro-master-data-submodule-reviewed
-- DB-ARCH-APPROVAL: amro-master-data-submodule-approved

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS configuration_code text,
  ADD COLUMN IF NOT EXISTS maintenance_program text;

ALTER TABLE public.parts_inventory
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS unit_of_measure text NOT NULL DEFAULT 'EA',
  ADD COLUMN IF NOT EXISTS min_stock_level integer NOT NULL DEFAULT 0 CHECK (min_stock_level >= 0),
  ADD COLUMN IF NOT EXISTS supplier_name text;

CREATE TABLE IF NOT EXISTS public.maintenance_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  facility_code text NOT NULL,
  name text NOT NULL,
  facility_type text NOT NULL CHECK (facility_type IN ('line', 'base', 'component_shop', 'engine_shop', 'structures', 'avionics', 'other')),
  station_code text NOT NULL,
  location_city text,
  location_country text,
  timezone text NOT NULL DEFAULT 'UTC',
  contact_name text,
  contact_email text,
  contact_phone text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_maintenance_facilities_tenant_code UNIQUE (tenant_id, facility_code)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_facilities_tenant_id ON public.maintenance_facilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_facilities_station_code ON public.maintenance_facilities(station_code);
CREATE INDEX IF NOT EXISTS idx_maintenance_facilities_active ON public.maintenance_facilities(is_active);

CREATE TABLE IF NOT EXISTS public.work_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  facility_id uuid REFERENCES public.maintenance_facilities(id) ON DELETE SET NULL,
  facility_code text,
  work_center_code text NOT NULL,
  name text NOT NULL,
  center_type text NOT NULL CHECK (center_type IN ('airframe', 'engine', 'avionics', 'sheet_metal', 'paint', 'nondestructive_test', 'other')),
  station_code text NOT NULL,
  capacity_hours_per_day numeric(6, 2) NOT NULL DEFAULT 8 CHECK (capacity_hours_per_day > 0),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_work_centers_tenant_code UNIQUE (tenant_id, work_center_code)
);

CREATE INDEX IF NOT EXISTS idx_work_centers_tenant_id ON public.work_centers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_centers_station_code ON public.work_centers(station_code);
CREATE INDEX IF NOT EXISTS idx_work_centers_active ON public.work_centers(is_active);

CREATE TABLE IF NOT EXISTS public.skill_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  skill_code text NOT NULL,
  description text NOT NULL,
  skill_family text,
  license_authority text,
  is_certification_required boolean NOT NULL DEFAULT false,
  validity_period_months integer CHECK (validity_period_months IS NULL OR validity_period_months > 0),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_skill_codes_tenant_code UNIQUE (tenant_id, skill_code)
);

CREATE INDEX IF NOT EXISTS idx_skill_codes_tenant_id ON public.skill_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_codes_family ON public.skill_codes(skill_family);
CREATE INDEX IF NOT EXISTS idx_skill_codes_active ON public.skill_codes(is_active);

ALTER TABLE public.maintenance_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amro_platform_admin_access ON public.maintenance_facilities;
CREATE POLICY amro_platform_admin_access
  ON public.maintenance_facilities
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.maintenance_facilities;
CREATE POLICY amro_tenant_franchise_scope
  ON public.maintenance_facilities
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS amro_platform_admin_access ON public.work_centers;
CREATE POLICY amro_platform_admin_access
  ON public.work_centers
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.work_centers;
CREATE POLICY amro_tenant_franchise_scope
  ON public.work_centers
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS amro_platform_admin_access ON public.skill_codes;
CREATE POLICY amro_platform_admin_access
  ON public.skill_codes
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.skill_codes;
CREATE POLICY amro_tenant_franchise_scope
  ON public.skill_codes
  FOR ALL
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  )
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND (
      public.get_user_franchise_id(auth.uid()) IS NULL
      OR franchise_id IS NULL
      OR franchise_id = public.get_user_franchise_id(auth.uid())
    )
  );
