-- Fix missing dashboards.view permission for platform_admin

-- 1. Ensure the permission exists in auth_permissions
INSERT INTO auth_permissions (id, category, description)
VALUES ('dashboards.view', 'Dashboard', 'View dashboards')
ON CONFLICT (id) DO NOTHING;

-- 2. Grant the permission to platform_admin role
-- Note: platform_admin has implicit full access in code, but explicit permission
-- ensures dynamic permission checks work correctly without code overrides.
INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('platform_admin', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Also grant to tenant_admin and franchise_admin if appropriate
INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('tenant_admin', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('franchise_admin', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Grant to user role (standard users usually need dashboard access)
INSERT INTO auth_role_permissions (role_id, permission_id)
VALUES ('user', 'dashboards.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;
