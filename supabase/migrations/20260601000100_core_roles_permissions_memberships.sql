-- Phase 6 Step 56 — core.roles / core.permissions / core.memberships
-- schema per core.md §3.1.
--
-- Today's reality: public.user_roles holds (user_id, role enum,
-- tenant_id, …) where `role` is a single hardcoded enum value
-- (tenant_admin | platform_admin | sales_manager | user | viewer |
-- franchise_admin | platform_domain_admin | compliance_officer).
-- This means:
--   - Roles can't be created per-tenant
--   - Permissions are baked into code instead of data
--   - Custom roles ("warehouse_supervisor for Acme only") are
--     impossible
--   - The /admin/roles UI from core §10.6 has nothing to back it
--
-- §3.1 model: roles are first-class rows (global + per-tenant);
-- permissions are (resource, action) tuples attached to roles;
-- memberships are (tenant, user, role) edges.
--
-- This migration creates the schema + seeds the 7 well-known global
-- roles + their permissions, but does NOT backfill from public.user_
-- roles or wire dual-writes — those are a follow-up slice so this
-- slice stays bounded. core.has_module_access continues to read
-- public.user_roles via has_role() until the bridge lands.
--
-- Resource convention: "<module>:<entity>" e.g. "crm:lead",
-- "finance:invoice", "compliance:screening". Actions are typically
-- 'read' / 'write' / 'delete' / 'override' (compliance only).

-- ══════════════════════════════════════════════════════════════════════
-- 1. core.roles
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE core.roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = global/system role available to all tenants
  -- non-NULL = tenant-defined custom role
  tenant_id    uuid,
  name         text NOT NULL,
  description  text,
  is_system    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.roles IS
  'Phase 6 Step 56 — first-class roles, per core.md §3.1. tenant_id NULL = global system role; tenant-scoped roles otherwise. is_system flag protects seed rows from deletion via app code.';

-- Global roles: unique by name. Tenant roles: unique within tenant.
CREATE UNIQUE INDEX roles_global_name_uniq
  ON core.roles (name) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX roles_tenant_name_uniq
  ON core.roles (tenant_id, name) WHERE tenant_id IS NOT NULL;

CREATE INDEX roles_tenant_idx ON core.roles (tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE core.roles ENABLE ROW LEVEL SECURITY;
-- Global roles readable by everyone; tenant roles readable by tenant members.
CREATE POLICY roles_global_read ON core.roles
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_core_roles_updated_at
  BEFORE UPDATE ON core.roles
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON core.roles TO authenticated;
GRANT ALL    ON core.roles TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. core.permissions
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE core.permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    uuid NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
  -- "<module>:<entity>" e.g. "crm:lead", "compliance:screening"
  -- Also accepts wildcard "<module>:*" or "*:*" (god mode).
  resource   text NOT NULL,
  -- 'read' | 'write' | 'delete' | 'override' (compliance) | '*' (any)
  action     text NOT NULL
             CHECK (action IN ('read','write','delete','override','*')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, resource, action)
);

COMMENT ON TABLE core.permissions IS
  'Phase 6 Step 56 — fine-grained permissions per role. resource follows <module>:<entity> convention; wildcards <module>:* and *:* permitted. action constrained to read/write/delete/override/*.';

CREATE INDEX permissions_role_idx ON core.permissions (role_id);
CREATE INDEX permissions_resource_idx ON core.permissions (resource, action);

ALTER TABLE core.permissions ENABLE ROW LEVEL SECURITY;
-- Visible alongside the role they belong to.
CREATE POLICY permissions_via_role ON core.permissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM core.roles r
    WHERE r.id = permissions.role_id
      AND (r.tenant_id IS NULL OR r.tenant_id = public.get_user_tenant_id((SELECT auth.uid())))
  ));

GRANT SELECT ON core.permissions TO authenticated;
GRANT ALL    ON core.permissions TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. core.memberships
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE core.memberships (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  user_id             uuid NOT NULL,
  role_id             uuid NOT NULL REFERENCES core.roles(id) ON DELETE RESTRICT,
  status              text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','suspended','pending')),
  granted_by_user_id  uuid,
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, role_id)
);

COMMENT ON TABLE core.memberships IS
  'Phase 6 Step 56 — (tenant, user, role) edges per core.md §3.1. A user can hold multiple roles per tenant. Status gates whether the membership is active; expires_at allows temporary delegations.';

CREATE INDEX memberships_tenant_user_idx ON core.memberships (tenant_id, user_id)
  WHERE status = 'active';
CREATE INDEX memberships_role_idx ON core.memberships (role_id)
  WHERE status = 'active';

ALTER TABLE core.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_tenant_read ON core.memberships
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_core_memberships_updated_at
  BEFORE UPDATE ON core.memberships
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON core.memberships TO authenticated;
GRANT ALL    ON core.memberships TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 4. Seed global system roles
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO core.roles (name, description, is_system) VALUES
  ('platform_admin',     'Full platform access; god mode',                                 true),
  ('tenant_admin',       'Full tenant-level access; manages users + tenant settings',      true),
  ('compliance_officer', 'Override compliance screenings + view all audit logs',           true),
  ('sales_manager',      'CRM + Sales + Quotation read/write; manages team pipeline',      true),
  ('logistics_ops',      'Logistics read/write; shipments + carriers + customs',           true),
  ('billing_admin',      'Finance read/write; invoices + payments + GL + dunning',         true),
  ('user',               'Basic authenticated user; read-only across enabled modules',     true),
  ('viewer',             'Read-only across all readable resources',                        true)
ON CONFLICT (name) WHERE tenant_id IS NULL DO NOTHING;

-- Seed permissions per role
DO $seed$
DECLARE
  v_platform_admin_id     uuid;
  v_tenant_admin_id       uuid;
  v_compliance_officer_id uuid;
  v_sales_manager_id      uuid;
  v_logistics_ops_id      uuid;
  v_billing_admin_id      uuid;
  v_user_id               uuid;
  v_viewer_id             uuid;
BEGIN
  SELECT id INTO v_platform_admin_id     FROM core.roles WHERE name='platform_admin'     AND tenant_id IS NULL;
  SELECT id INTO v_tenant_admin_id       FROM core.roles WHERE name='tenant_admin'       AND tenant_id IS NULL;
  SELECT id INTO v_compliance_officer_id FROM core.roles WHERE name='compliance_officer' AND tenant_id IS NULL;
  SELECT id INTO v_sales_manager_id      FROM core.roles WHERE name='sales_manager'      AND tenant_id IS NULL;
  SELECT id INTO v_logistics_ops_id      FROM core.roles WHERE name='logistics_ops'      AND tenant_id IS NULL;
  SELECT id INTO v_billing_admin_id      FROM core.roles WHERE name='billing_admin'      AND tenant_id IS NULL;
  SELECT id INTO v_user_id               FROM core.roles WHERE name='user'               AND tenant_id IS NULL;
  SELECT id INTO v_viewer_id             FROM core.roles WHERE name='viewer'             AND tenant_id IS NULL;

  -- platform_admin: god mode
  INSERT INTO core.permissions (role_id, resource, action) VALUES
    (v_platform_admin_id, '*:*', '*')
  ON CONFLICT DO NOTHING;

  -- tenant_admin: everything within tenant
  INSERT INTO core.permissions (role_id, resource, action) VALUES
    (v_tenant_admin_id, '*:*', '*')
  ON CONFLICT DO NOTHING;

  -- compliance_officer
  INSERT INTO core.permissions (role_id, resource, action) VALUES
    (v_compliance_officer_id, 'compliance:*',           'read'),
    (v_compliance_officer_id, 'compliance:screening',   'override'),
    (v_compliance_officer_id, 'compliance:screening',   'write'),
    (v_compliance_officer_id, 'core:audit_log',         'read'),
    (v_compliance_officer_id, 'crm:*',                  'read'),
    (v_compliance_officer_id, 'sales:*',                'read'),
    (v_compliance_officer_id, 'quotation:*',            'read'),
    (v_compliance_officer_id, 'logistics:*',            'read'),
    (v_compliance_officer_id, 'finance:*',              'read')
  ON CONFLICT DO NOTHING;

  -- sales_manager
  INSERT INTO core.permissions (role_id, resource, action) VALUES
    (v_sales_manager_id, 'crm:*',       'read'),
    (v_sales_manager_id, 'crm:*',       'write'),
    (v_sales_manager_id, 'sales:*',     'read'),
    (v_sales_manager_id, 'sales:*',     'write'),
    (v_sales_manager_id, 'quotation:*', 'read'),
    (v_sales_manager_id, 'quotation:*', 'write'),
    (v_sales_manager_id, 'logistics:*', 'read'),
    (v_sales_manager_id, 'finance:invoice', 'read')
  ON CONFLICT DO NOTHING;

  -- logistics_ops
  INSERT INTO core.permissions (role_id, resource, action) VALUES
    (v_logistics_ops_id, 'logistics:*', 'read'),
    (v_logistics_ops_id, 'logistics:*', 'write'),
    (v_logistics_ops_id, 'crm:account', 'read'),
    (v_logistics_ops_id, 'crm:contact', 'read'),
    (v_logistics_ops_id, 'quotation:*', 'read')
  ON CONFLICT DO NOTHING;

  -- billing_admin
  INSERT INTO core.permissions (role_id, resource, action) VALUES
    (v_billing_admin_id, 'finance:*',     'read'),
    (v_billing_admin_id, 'finance:*',     'write'),
    (v_billing_admin_id, 'crm:account',   'read'),
    (v_billing_admin_id, 'quotation:*',   'read'),
    (v_billing_admin_id, 'logistics:*',   'read')
  ON CONFLICT DO NOTHING;

  -- user (basic read-only across enabled modules)
  INSERT INTO core.permissions (role_id, resource, action) VALUES
    (v_user_id, 'crm:*',         'read'),
    (v_user_id, 'sales:*',       'read'),
    (v_user_id, 'quotation:*',   'read'),
    (v_user_id, 'logistics:*',   'read'),
    (v_user_id, 'finance:invoice', 'read')
  ON CONFLICT DO NOTHING;

  -- viewer (read-only everywhere)
  INSERT INTO core.permissions (role_id, resource, action) VALUES
    (v_viewer_id, '*:*', 'read')
  ON CONFLICT DO NOTHING;
END;
$seed$;

-- ══════════════════════════════════════════════════════════════════════
-- 5. core.user_has_permission RPC
-- ══════════════════════════════════════════════════════════════════════
--
-- The permission-check helper. Joins membership → role → permissions
-- with wildcard matching:
--   - Exact match: resource='crm:lead' AND action='read'
--   - Module wildcard: resource='crm:*' covers 'crm:<anything>'
--   - Global wildcard: resource='*:*' covers everything (god mode)
--   - Action wildcard: action='*' covers any action

CREATE OR REPLACE FUNCTION core.user_has_permission(
  p_tenant_id uuid,
  p_user_id   uuid,
  p_resource  text,
  p_action    text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM core.memberships m
    JOIN core.permissions p ON p.role_id = m.role_id
    WHERE m.tenant_id = p_tenant_id
      AND m.user_id   = p_user_id
      AND m.status    = 'active'
      AND (m.expires_at IS NULL OR m.expires_at > now())
      AND (
        -- Resource match (exact, module-wildcard, or global-wildcard)
        p.resource = p_resource
        OR p.resource = split_part(p_resource, ':', 1) || ':*'
        OR p.resource = '*:*'
      )
      AND (
        p.action = p_action
        OR p.action = '*'
      )
  );
$$;

COMMENT ON FUNCTION core.user_has_permission(uuid, uuid, text, text) IS
  'Phase 6 Step 56 — permission check joining memberships → roles → permissions with wildcard matching (resource: exact | module:* | *:*; action: exact | *). Returns TRUE if any of the user''s active memberships grants the requested (resource, action).';

REVOKE EXECUTE ON FUNCTION core.user_has_permission(uuid, uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION core.user_has_permission(uuid, uuid, text, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION core.user_has_permission(uuid, uuid, text, text) TO service_role;
