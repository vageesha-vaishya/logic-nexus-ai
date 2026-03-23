-- DB-VERIFICATION: pending-execution-required
-- DB-ARCH-APPROVAL: pending-review-required

ALTER TABLE public.auth_role_permissions
  ADD COLUMN IF NOT EXISTS scope_level text NULL,
  ADD COLUMN IF NOT EXISTS tenant_id uuid NULL,
  ADD COLUMN IF NOT EXISTS franchise_id uuid NULL,
  ADD COLUMN IF NOT EXISTS is_denied boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'auth_role_permissions_scope_level_check'
      AND conrelid = 'public.auth_role_permissions'::regclass
  ) THEN
    ALTER TABLE public.auth_role_permissions
      ADD CONSTRAINT auth_role_permissions_scope_level_check
      CHECK (scope_level IS NULL OR scope_level IN ('global', 'tenant', 'franchisee'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auth_role_permissions_scope
  ON public.auth_role_permissions (role_id, scope_level, tenant_id, franchise_id);

CREATE INDEX IF NOT EXISTS idx_auth_role_permissions_denied
  ON public.auth_role_permissions (is_denied);

INSERT INTO public.auth_permissions (id, category, description)
VALUES
  ('view_amro_dashboard', 'AMRO', 'View AMRO dashboard'),
  ('create_maintenance_request', 'AMRO', 'Create maintenance requests'),
  ('edit_aircraft_records', 'AMRO', 'Edit aircraft records'),
  ('delete_flight_logs', 'AMRO', 'Delete flight logs'),
  ('approve_work_orders', 'AMRO', 'Approve work orders')
ON CONFLICT (id) DO UPDATE
SET
  category = EXCLUDED.category,
  description = EXCLUDED.description;

INSERT INTO public.auth_role_permissions (role_id, permission_id, scope_level, is_denied)
VALUES
  ('platform_admin', 'view_amro_dashboard', 'global', false),
  ('platform_admin', 'create_maintenance_request', 'global', false),
  ('platform_admin', 'edit_aircraft_records', 'global', false),
  ('platform_admin', 'delete_flight_logs', 'global', false),
  ('platform_admin', 'approve_work_orders', 'global', false),

  ('super_admin', 'view_amro_dashboard', 'global', false),
  ('super_admin', 'create_maintenance_request', 'global', false),
  ('super_admin', 'edit_aircraft_records', 'global', false),
  ('super_admin', 'delete_flight_logs', 'global', false),
  ('super_admin', 'approve_work_orders', 'global', false),

  ('tenant_admin', 'view_amro_dashboard', 'tenant', false),
  ('tenant_admin', 'create_maintenance_request', 'tenant', false),
  ('tenant_admin', 'edit_aircraft_records', 'tenant', false),
  ('tenant_admin', 'approve_work_orders', 'tenant', false),

  ('franchise_admin', 'view_amro_dashboard', 'franchisee', false),
  ('franchise_admin', 'create_maintenance_request', 'franchisee', false),
  ('franchise_admin', 'edit_aircraft_records', 'franchisee', false),

  ('user', 'view_amro_dashboard', 'franchisee', false)
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  scope_level = EXCLUDED.scope_level,
  is_denied = EXCLUDED.is_denied;
