-- Phase 1 Slice E Part 1 — dual-write triggers (public.platform_domains family → core.*)
--
-- During the cutover window (between this migration and Slice E Part 2
-- frontend cutover), writes to the legacy public.* tables also write to
-- core.*. Reads still go to public.* until Part 2 flips them. Once Part 2
-- ships and a 30-day no-direct-read window passes, the public.* tables
-- can be dropped (separate migration).
--
-- Pattern matches shadow-write audit triggers from earlier Slice B batches:
--   AFTER INSERT/UPDATE/DELETE; EXCEPTION → RAISE WARNING + RETURN — never
--   blocks the source write.

-- ── core.domains ←  public.platform_domains ──────────────────────────────

CREATE OR REPLACE FUNCTION core.dual_write_from_platform_domains()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO core.domains (
      id, code, key, name, description, owner, status,
      deployment_target, repository_url, swagger_endpoint,
      is_active, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.code, NEW.key, NEW.name, NEW.description, NEW.owner,
      COALESCE(NEW.status, 'planned'),
      NEW.deployment_target, NEW.repository_url, NEW.swagger_endpoint,
      COALESCE(NEW.is_active, true),
      COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
    )
    ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE core.domains SET
      code               = NEW.code,
      key                = NEW.key,
      name               = NEW.name,
      description        = NEW.description,
      owner              = NEW.owner,
      status             = COALESCE(NEW.status, 'planned'),
      deployment_target  = NEW.deployment_target,
      repository_url     = NEW.repository_url,
      swagger_endpoint   = NEW.swagger_endpoint,
      is_active          = COALESCE(NEW.is_active, true),
      updated_at         = COALESCE(NEW.updated_at, now())
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM core.domains WHERE id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_platform_domains (op=%) failed: %', TG_OP, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_platform_domains_dual_write_to_core
  AFTER INSERT OR UPDATE OR DELETE ON public.platform_domains
  FOR EACH ROW EXECUTE FUNCTION core.dual_write_from_platform_domains();

-- ── core.domain_config ←  public.domain_config ──────────────────────────

CREATE OR REPLACE FUNCTION core.dual_write_from_domain_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO core.domain_config (id, domain_id, environment, config, created_at, updated_at)
    VALUES (NEW.id, NEW.domain_id, NEW.environment, COALESCE(NEW.config, '{}'::jsonb),
            COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()))
    ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE core.domain_config SET
      domain_id    = NEW.domain_id,
      environment  = NEW.environment,
      config       = COALESCE(NEW.config, '{}'::jsonb),
      updated_at   = COALESCE(NEW.updated_at, now())
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM core.domain_config WHERE id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_domain_config (op=%) failed: %', TG_OP, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_domain_config_dual_write_to_core
  AFTER INSERT OR UPDATE OR DELETE ON public.domain_config
  FOR EACH ROW EXECUTE FUNCTION core.dual_write_from_domain_config();

-- ── core.domain_metadata ←  public.domain_metadata ──────────────────────

CREATE OR REPLACE FUNCTION core.dual_write_from_domain_metadata()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO core.domain_metadata (id, domain_id, key, value, created_at, updated_at)
    VALUES (NEW.id, NEW.domain_id, NEW.key, NEW.value,
            COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()))
    ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE core.domain_metadata SET
      domain_id    = NEW.domain_id,
      key          = NEW.key,
      value        = NEW.value,
      updated_at   = COALESCE(NEW.updated_at, now())
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM core.domain_metadata WHERE id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_domain_metadata (op=%) failed: %', TG_OP, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_domain_metadata_dual_write_to_core
  AFTER INSERT OR UPDATE OR DELETE ON public.domain_metadata
  FOR EACH ROW EXECUTE FUNCTION core.dual_write_from_domain_metadata();

-- ── core.domain_relationships ←  public.domain_relationships ────────────

CREATE OR REPLACE FUNCTION core.dual_write_from_domain_relationships()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO core.domain_relationships (id, source_domain_id, target_domain_id, relationship_type, description, created_at)
    VALUES (NEW.id, NEW.source_domain_id, NEW.target_domain_id, NEW.relationship_type, NEW.description, COALESCE(NEW.created_at, now()))
    ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE core.domain_relationships SET
      source_domain_id    = NEW.source_domain_id,
      target_domain_id    = NEW.target_domain_id,
      relationship_type   = NEW.relationship_type,
      description         = NEW.description
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM core.domain_relationships WHERE id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_domain_relationships (op=%) failed: %', TG_OP, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_domain_relationships_dual_write_to_core
  AFTER INSERT OR UPDATE OR DELETE ON public.domain_relationships
  FOR EACH ROW EXECUTE FUNCTION core.dual_write_from_domain_relationships();

-- ── core.user_domain_assignments ←  public.user_domain_assignments ──────

CREATE OR REPLACE FUNCTION core.dual_write_from_user_domain_assignments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO core.user_domain_assignments (id, user_id, tenant_id, domain_id, assigned_by, is_active, created_at, updated_at)
    VALUES (NEW.id, NEW.user_id, NEW.tenant_id, NEW.domain_id, NEW.assigned_by,
            COALESCE(NEW.is_active, true),
            COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()))
    ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE core.user_domain_assignments SET
      user_id      = NEW.user_id,
      tenant_id    = NEW.tenant_id,
      domain_id    = NEW.domain_id,
      assigned_by  = NEW.assigned_by,
      is_active    = COALESCE(NEW.is_active, true),
      updated_at   = COALESCE(NEW.updated_at, now())
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM core.user_domain_assignments WHERE id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_user_domain_assignments (op=%) failed: %', TG_OP, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_user_domain_assignments_dual_write_to_core
  AFTER INSERT OR UPDATE OR DELETE ON public.user_domain_assignments
  FOR EACH ROW EXECUTE FUNCTION core.dual_write_from_user_domain_assignments();

-- ── core.tenant_domain_assignments ←  public.tenant_domain_assignments ──

CREATE OR REPLACE FUNCTION core.dual_write_from_tenant_domain_assignments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO core.tenant_domain_assignments (id, tenant_id, domain_id, is_active, created_by, created_at, updated_at)
    VALUES (NEW.id, NEW.tenant_id, NEW.domain_id,
            COALESCE(NEW.is_active, true), NEW.created_by,
            COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()))
    ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE core.tenant_domain_assignments SET
      tenant_id     = NEW.tenant_id,
      domain_id     = NEW.domain_id,
      is_active     = COALESCE(NEW.is_active, true),
      created_by    = NEW.created_by,
      updated_at    = COALESCE(NEW.updated_at, now())
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM core.tenant_domain_assignments WHERE id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_tenant_domain_assignments (op=%) failed: %', TG_OP, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_tenant_domain_assignments_dual_write_to_core
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_domain_assignments
  FOR EACH ROW EXECUTE FUNCTION core.dual_write_from_tenant_domain_assignments();
