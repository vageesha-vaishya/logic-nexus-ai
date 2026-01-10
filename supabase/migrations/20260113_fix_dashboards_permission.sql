-- Fix missing dashboards.view permission for standard roles

-- 1. Ensure the permission definition exists in the catalog
INSERT INTO public.auth_permissions (id, category, description)
VALUES ('dashboards.view', 'Dashboard', 'Access to view dashboards')
ON CONFLICT (id) DO NOTHING;

-- 2. Grant the permission to all standard system roles
-- We use ON CONFLICT DO NOTHING to ensure idempotency
INSERT INTO public.auth_role_permissions (role_id, permission_id)
VALUES 
  ('platform_admin', 'dashboards.view'),
  ('tenant_admin', 'dashboards.view'),
  ('franchise_admin', 'dashboards.view'),
  ('user', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;
