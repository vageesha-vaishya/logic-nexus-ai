-- DB-VERIFICATION:
-- DB-ARCH-APPROVAL:
--
-- Note: targets grandfathered public.* tables per ADR-001 forward-only policy.
-- When the public->platform retrofit epic runs, these triggers move with the tables.
--
-- Enforces mandatory tenant->franchise hierarchy and strict role scoping rules.
-- Key guarantees:
-- 1) Every tenant must have >= 1 franchise (deferred trigger on tenants INSERT/UPDATE).
-- 2) Cannot delete the last franchise of a tenant (trigger on franchises DELETE).
-- 3) user_roles scope must be structurally valid:
--    - platform_admin         : no tenant_id, no franchise_id, no domain
--    - platform_domain_admin  : no tenant_id, no franchise_id; domain REQUIRED
--                               (domain-scoped platform role — e.g., 'markets', 'amro')
--    - tenant_admin           : tenant_id required; franchise_id NULL; domain NULL
--    - franchise_admin / manager / operator (and any future role):
--                               tenant_id + franchise_id required, franchise must
--                               belong to tenant; domain NULL.

------------------------------------------------------------------------------
-- 1. Add `domain` column to user_roles to support domain-scoped platform role
------------------------------------------------------------------------------
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS domain TEXT NULL;

COMMENT ON COLUMN public.user_roles.domain IS
  'Domain name when role is platform_domain_admin (e.g., ''markets'', ''amro''). MUST be NULL for all other roles. Forward-compatible with a future platform.domains registry / FK.';

------------------------------------------------------------------------------
-- 2. Trigger function: enforce that a tenant has at least one franchise
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_enforce_tenant_has_franchise()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.franchises f
    WHERE f.tenant_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Tenant % must have at least one associated franchise before commit', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_require_franchise_ins ON public.tenants;
DROP TRIGGER IF EXISTS trg_tenants_require_franchise_upd ON public.tenants;

CREATE CONSTRAINT TRIGGER trg_tenants_require_franchise_ins
AFTER INSERT ON public.tenants
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_tenant_has_franchise();

CREATE CONSTRAINT TRIGGER trg_tenants_require_franchise_upd
AFTER UPDATE ON public.tenants
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.trg_enforce_tenant_has_franchise();

------------------------------------------------------------------------------
-- 3. Trigger function: prevent deletion of the last franchise of a tenant
------------------------------------------------------------------------------
-- Allows deletion when the parent tenant is itself being deleted in the same
-- transaction (cascade scenario): if the tenant row no longer exists, we let
-- the franchise delete proceed.
CREATE OR REPLACE FUNCTION public.trg_prevent_last_franchise_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants WHERE id = OLD.tenant_id
  ) THEN
    -- Tenant is gone (or being deleted in this tx); allow the franchise delete.
    RETURN OLD;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.franchises
    WHERE tenant_id = OLD.tenant_id AND id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete the last franchise of tenant %. Every tenant must retain at least one franchise.', OLD.tenant_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_franchises_prevent_last_delete ON public.franchises;
CREATE TRIGGER trg_franchises_prevent_last_delete
BEFORE DELETE ON public.franchises
FOR EACH ROW
EXECUTE FUNCTION public.trg_prevent_last_franchise_delete();

------------------------------------------------------------------------------
-- 4. Trigger function: validate user_roles scope per role
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_validate_user_roles_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_franchise_tenant_id UUID;
BEGIN
  IF NEW.role IS NULL THEN
    RAISE EXCEPTION 'user_roles.role cannot be NULL';
  END IF;

  -- platform_admin: globally scoped; no tenant, no franchise, no domain.
  IF NEW.role = 'platform_admin'::public.app_role THEN
    IF NEW.tenant_id IS NOT NULL OR NEW.franchise_id IS NOT NULL THEN
      RAISE EXCEPTION 'platform_admin role cannot have tenant_id/franchise_id';
    END IF;
    IF NEW.domain IS NOT NULL THEN
      RAISE EXCEPTION 'platform_admin role cannot be domain-scoped (domain must be NULL)';
    END IF;
    RETURN NEW;
  END IF;

  -- platform_domain_admin: domain-scoped platform role; domain REQUIRED;
  -- no tenant_id, no franchise_id.
  IF NEW.role = 'platform_domain_admin'::public.app_role THEN
    IF NEW.tenant_id IS NOT NULL OR NEW.franchise_id IS NOT NULL THEN
      RAISE EXCEPTION 'platform_domain_admin role cannot have tenant_id/franchise_id';
    END IF;
    IF NEW.domain IS NULL OR length(trim(NEW.domain)) = 0 THEN
      RAISE EXCEPTION 'platform_domain_admin role requires a non-empty domain';
    END IF;
    RETURN NEW;
  END IF;

  -- tenant_admin: tenant-wide; tenant_id required, franchise_id and domain NULL.
  IF NEW.role = 'tenant_admin'::public.app_role THEN
    IF NEW.tenant_id IS NULL THEN
      RAISE EXCEPTION 'tenant_admin role requires tenant_id';
    END IF;
    IF NEW.franchise_id IS NOT NULL THEN
      RAISE EXCEPTION 'tenant_admin role cannot be franchise-scoped';
    END IF;
    IF NEW.domain IS NOT NULL THEN
      RAISE EXCEPTION 'tenant_admin role cannot be domain-scoped (domain must be NULL)';
    END IF;
    RETURN NEW;
  END IF;

  -- All other roles: franchise-scoped within a tenant. tenant_id + franchise_id
  -- required; franchise must belong to tenant; domain must be NULL.
  IF NEW.tenant_id IS NULL OR NEW.franchise_id IS NULL THEN
    RAISE EXCEPTION 'Role % requires both tenant_id and franchise_id', NEW.role;
  END IF;

  IF NEW.domain IS NOT NULL THEN
    RAISE EXCEPTION 'Role % cannot be domain-scoped (domain must be NULL)', NEW.role;
  END IF;

  SELECT f.tenant_id INTO v_franchise_tenant_id
  FROM public.franchises f
  WHERE f.id = NEW.franchise_id;

  IF v_franchise_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid franchise_id % for role %', NEW.franchise_id, NEW.role;
  END IF;

  IF v_franchise_tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Franchise % does not belong to tenant %', NEW.franchise_id, NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_validate_scope ON public.user_roles;
CREATE TRIGGER trg_user_roles_validate_scope
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.trg_validate_user_roles_scope();

------------------------------------------------------------------------------
-- 5. Pre-flight: refuse to apply if existing data violates the invariants
------------------------------------------------------------------------------
DO $$
DECLARE
  v_invalid_tenants INT;
  v_invalid_roles INT;
BEGIN
  -- 5a. Every tenant must already have at least one franchise.
  SELECT COUNT(*) INTO v_invalid_tenants
  FROM public.tenants t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.franchises f WHERE f.tenant_id = t.id
  );

  IF v_invalid_tenants > 0 THEN
    RAISE EXCEPTION 'Found % tenant(s) without a franchise. Create at least one franchise per tenant before applying this migration.', v_invalid_tenants;
  END IF;

  -- 5b. Every user_roles row must satisfy its role's scoping rules.
  SELECT COUNT(*) INTO v_invalid_roles
  FROM public.user_roles ur
  LEFT JOIN public.franchises f ON f.id = ur.franchise_id
  WHERE
    -- platform_admin: no tenant_id, no franchise_id, no domain
    (
      ur.role = 'platform_admin'::public.app_role
      AND (ur.tenant_id IS NOT NULL OR ur.franchise_id IS NOT NULL OR ur.domain IS NOT NULL)
    )
    -- platform_domain_admin: no tenant_id, no franchise_id, domain REQUIRED
    OR (
      ur.role = 'platform_domain_admin'::public.app_role
      AND (
        ur.tenant_id IS NOT NULL
        OR ur.franchise_id IS NOT NULL
        OR ur.domain IS NULL
        OR length(trim(ur.domain)) = 0
      )
    )
    -- tenant_admin: tenant_id required, franchise_id NULL, domain NULL
    OR (
      ur.role = 'tenant_admin'::public.app_role
      AND (
        ur.tenant_id IS NULL
        OR ur.franchise_id IS NOT NULL
        OR ur.domain IS NOT NULL
      )
    )
    -- All other roles: tenant_id + franchise_id required, franchise must belong
    -- to tenant, domain NULL.
    OR (
      ur.role NOT IN (
        'platform_admin'::public.app_role,
        'platform_domain_admin'::public.app_role,
        'tenant_admin'::public.app_role
      )
      AND (
        ur.tenant_id IS NULL
        OR ur.franchise_id IS NULL
        OR ur.domain IS NOT NULL
        OR f.tenant_id IS DISTINCT FROM ur.tenant_id
      )
    );

  IF v_invalid_roles > 0 THEN
    RAISE EXCEPTION 'Found % invalid user_roles row(s) violating tenant/franchise/domain scoping. Fix them before applying this migration.', v_invalid_roles;
  END IF;
END $$;
