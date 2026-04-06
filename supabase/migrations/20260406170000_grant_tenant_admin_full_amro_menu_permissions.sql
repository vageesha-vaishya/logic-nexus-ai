DO $migration$
BEGIN
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

  INSERT INTO public.auth_role_permissions (role_id, permission_id)
  VALUES
    ('tenant_admin', 'view_amro_dashboard'),
    ('tenant_admin', 'create_maintenance_request'),
    ('tenant_admin', 'edit_aircraft_records'),
    ('tenant_admin', 'delete_flight_logs'),
    ('tenant_admin', 'approve_work_orders')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'auth_role_permissions'
      AND column_name = 'is_denied'
  ) THEN
    UPDATE public.auth_role_permissions
    SET is_denied = false
    WHERE role_id = 'tenant_admin'
      AND permission_id IN (
        'view_amro_dashboard',
        'create_maintenance_request',
        'edit_aircraft_records',
        'delete_flight_logs',
        'approve_work_orders'
      );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'auth_role_permissions'
      AND column_name = 'scope_level'
  ) THEN
    UPDATE public.auth_role_permissions
    SET scope_level = COALESCE(scope_level, 'tenant')
    WHERE role_id = 'tenant_admin'
      AND permission_id IN (
        'view_amro_dashboard',
        'create_maintenance_request',
        'edit_aircraft_records',
        'delete_flight_logs',
        'approve_work_orders'
      );
  END IF;
END
$migration$;
