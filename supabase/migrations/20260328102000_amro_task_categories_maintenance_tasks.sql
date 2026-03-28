BEGIN;

CREATE TABLE IF NOT EXISTS public.task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id integer GENERATED ALWAYS AS IDENTITY UNIQUE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  code varchar(10) NOT NULL,
  name varchar(100) NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_task_categories_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_task_categories_tenant_id ON public.task_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_franchise_id ON public.task_categories(franchise_id);

CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id integer GENERATED ALWAYS AS IDENTITY UNIQUE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  code_form_no varchar(50),
  ata_code varchar(10),
  reference_amp varchar(100),
  description text,
  category_code varchar(10),
  estimated_man_hours decimal(5, 2),
  revision_status varchar(100),
  interval_hours integer,
  interval_cycles integer,
  interval_months integer,
  is_mandatory boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_maintenance_tasks_category_code
    FOREIGN KEY (tenant_id, category_code)
    REFERENCES public.task_categories(tenant_id, code)
    ON DELETE RESTRICT,
  CONSTRAINT uq_maintenance_tasks_tenant_ata_ref UNIQUE (tenant_id, ata_code, reference_amp)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_tenant_id ON public.maintenance_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_franchise_id ON public.maintenance_tasks(franchise_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_category_code ON public.maintenance_tasks(category_code);
CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_ata_code ON public.maintenance_tasks(ata_code);

INSERT INTO public.task_categories (
  tenant_id,
  franchise_id,
  code,
  name,
  description,
  is_active
)
VALUES
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, 'LUB', 'Lubrication', 'Applying lubricant to reduce friction and wear.', true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, 'SVC', 'Servicing', 'Replenishing consumables such as fluids and gases.', true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, 'OPC', 'Operational Check', 'A task to determine if an item is fulfilling its intended purpose.', true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, 'FNC', 'Functional Check', 'A quantitative check to determine if a system performs within specific limits.', true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, 'GVI', 'General Visual Inspection', 'A visual examination of an interior or exterior area to detect obvious damage or leaks.', true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, 'VCK', 'Visual Check', 'A quick visual verification of condition, installation, and obvious defects.', true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, 'DET', 'Detailed Inspection', 'An intensive examination of a specific item, installation, or assembly to detect damage or failure.', true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, 'SDI', 'Special Detailed Inspection', 'An intensive examination of a specific item using NDT (Non-Destructive Testing) techniques.', true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, 'RST', 'Restoration', 'Reworking an item to a specific standard to extend its life.', true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, 'DIS', 'Discard', 'The removal of an item from service at a specified life limit.', true)
ON CONFLICT (tenant_id, code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.maintenance_tasks (
  tenant_id,
  franchise_id,
  code_form_no,
  ata_code,
  reference_amp,
  description,
  category_code,
  estimated_man_hours,
  revision_status,
  interval_hours,
  interval_cycles,
  interval_months,
  is_mandatory
)
VALUES
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, NULL, '12', 'AMM 12-B-12-10-03', 'Engine Oil - Servicing', 'SVC', NULL, NULL, 300, NULL, NULL, true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, NULL, '24', 'AMM 12-B-24-00-00', 'Electrical Power - Operational Check', 'OPC', NULL, NULL, 600, NULL, NULL, true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, NULL, '27', 'AMM 12-A-27-20-05', 'Rudder Cable Quadrant - Examine', 'DET', NULL, NULL, NULL, 12500, NULL, true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, NULL, '32', 'AMM 12-B-32-10-00', 'Main Landing Gear - Lubrication', 'LUB', NULL, NULL, 300, NULL, NULL, true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, NULL, '53', 'AMM 12-C-04-00-00', 'Fuselage Structure - Detailed Inspection', 'DET', NULL, NULL, 20000, NULL, NULL, true),
  ('e42ec6fd-6b88-4721-befe-4443d9743120', NULL, NULL, '71', 'SB 71-009', 'Engine Mounting Frame - NDT SDI', 'SDI', NULL, NULL, 5000, NULL, NULL, true)
ON CONFLICT (tenant_id, ata_code, reference_amp) DO UPDATE
SET
  code_form_no = EXCLUDED.code_form_no,
  description = EXCLUDED.description,
  category_code = EXCLUDED.category_code,
  estimated_man_hours = EXCLUDED.estimated_man_hours,
  revision_status = EXCLUDED.revision_status,
  interval_hours = EXCLUDED.interval_hours,
  interval_cycles = EXCLUDED.interval_cycles,
  interval_months = EXCLUDED.interval_months,
  is_mandatory = EXCLUDED.is_mandatory;

ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amro_platform_admin_access ON public.task_categories;
CREATE POLICY amro_platform_admin_access
  ON public.task_categories
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.task_categories;
CREATE POLICY amro_tenant_franchise_scope
  ON public.task_categories
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

DROP POLICY IF EXISTS amro_platform_admin_access ON public.maintenance_tasks;
CREATE POLICY amro_platform_admin_access
  ON public.maintenance_tasks
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.maintenance_tasks;
CREATE POLICY amro_tenant_franchise_scope
  ON public.maintenance_tasks
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

COMMIT;
