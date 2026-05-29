-- Phase 2 Step 6 — dual-write triggers: public.accounts / public.contacts → core.parties
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 2
--
-- Writes still target public.accounts / public.contacts (those tables stay
-- authoritative for the CRM-only columns until Phase 4 splits them). These
-- triggers AFTER each write mirror the identity slice into core.parties so
-- the v_accounts / v_contacts read path (Step 4) stays consistent with the
-- source even as live writes land on the legacy tables.
--
-- Pattern matches the Phase 1 dual_write_platform_domains_family triggers:
--   - AFTER INSERT / UPDATE / DELETE
--   - SECURITY DEFINER so RLS on core.parties doesn't block the mirror
--   - EXCEPTION → RAISE WARNING + RETURN, never block the source write
--
-- core.parties.id matches the source id (Step 2 backfill kept them aligned).
-- The trigger uses INSERT … ON CONFLICT (id) DO UPDATE so initial-state and
-- ongoing writes both land on the same row.
--
-- core.party_relationships is maintained by the contacts trigger for the
-- employs edge (organization → person). When contact.account_id changes,
-- the old employs row is deleted and a new one inserted.

-- ══════════════════════════════════════════════════════════════════════
-- public.accounts → core.parties (party_type='organization')
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.dual_write_from_accounts()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO core.parties (
      id, tenant_id, party_type, display_name, legal_name,
      status, external_refs, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.tenant_id, 'organization',
      NEW.name, NEW.name,
      CASE WHEN NEW.active IS FALSE THEN 'archived' ELSE 'active' END,
      jsonb_strip_nulls(jsonb_build_object(
        'legacy_account_number', NEW.account_number,
        'legacy_account_site',   NEW.account_site,
        'legacy_tax_id',         NEW.tax_id,
        'legacy_franchise_id',   NEW.franchise_id::text,
        'legacy_website',        NEW.website
      )),
      COALESCE(NEW.created_at, now()),
      COALESCE(NEW.updated_at, now())
    )
    ON CONFLICT (id) DO UPDATE SET
      tenant_id     = EXCLUDED.tenant_id,
      display_name  = EXCLUDED.display_name,
      legal_name    = EXCLUDED.legal_name,
      status        = EXCLUDED.status,
      external_refs = EXCLUDED.external_refs,
      updated_at    = EXCLUDED.updated_at;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE core.parties SET
      tenant_id     = NEW.tenant_id,
      display_name  = NEW.name,
      legal_name    = NEW.name,
      status        = CASE WHEN NEW.active IS FALSE THEN 'archived' ELSE 'active' END,
      external_refs = jsonb_strip_nulls(jsonb_build_object(
        'legacy_account_number', NEW.account_number,
        'legacy_account_site',   NEW.account_site,
        'legacy_tax_id',         NEW.tax_id,
        'legacy_franchise_id',   NEW.franchise_id::text,
        'legacy_website',        NEW.website
      )),
      updated_at    = COALESCE(NEW.updated_at, now())
    WHERE id = NEW.id;
    -- Race condition: if the party row was deleted while public.accounts
    -- still has it, fall back to an insert. Rare but possible during
    -- migrations.
    IF NOT FOUND THEN
      INSERT INTO core.parties (
        id, tenant_id, party_type, display_name, legal_name,
        status, external_refs, created_at, updated_at
      ) VALUES (
        NEW.id, NEW.tenant_id, 'organization',
        NEW.name, NEW.name,
        CASE WHEN NEW.active IS FALSE THEN 'archived' ELSE 'active' END,
        jsonb_strip_nulls(jsonb_build_object(
          'legacy_account_number', NEW.account_number,
          'legacy_account_site',   NEW.account_site,
          'legacy_tax_id',         NEW.tax_id,
          'legacy_franchise_id',   NEW.franchise_id::text,
          'legacy_website',        NEW.website
        )),
        COALESCE(NEW.created_at, now()),
        COALESCE(NEW.updated_at, now())
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM core.parties WHERE id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_accounts (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_accounts_dual_write_to_core
  AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION core.dual_write_from_accounts();

COMMENT ON FUNCTION core.dual_write_from_accounts IS
  'Phase 2 Step 6 — mirror INSERT/UPDATE/DELETE on public.accounts into core.parties (party_type=organization). Fail-open: WARNING on error so the source write never blocks.';

-- ══════════════════════════════════════════════════════════════════════
-- public.contacts → core.parties (party_type='person')
--                  + core.party_relationships (employs edge)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.dual_write_from_contacts()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_display_name text;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_display_name := NULLIF(TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), '');
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO core.parties (
      id, tenant_id, party_type, display_name, first_name, last_name,
      status, external_refs, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.tenant_id, 'person',
      v_display_name, NEW.first_name, NEW.last_name, 'active',
      jsonb_strip_nulls(jsonb_build_object(
        'legacy_franchise_id', NEW.franchise_id::text,
        'legacy_linkedin_url', NEW.linkedin_url
      )),
      COALESCE(NEW.created_at, now()),
      COALESCE(NEW.updated_at, now())
    )
    ON CONFLICT (id) DO UPDATE SET
      tenant_id     = EXCLUDED.tenant_id,
      display_name  = EXCLUDED.display_name,
      first_name    = EXCLUDED.first_name,
      last_name     = EXCLUDED.last_name,
      external_refs = EXCLUDED.external_refs,
      updated_at    = EXCLUDED.updated_at;

    -- employs edge (organization → person)
    IF NEW.account_id IS NOT NULL THEN
      INSERT INTO core.party_relationships (
        tenant_id, from_party_id, to_party_id, relationship_type, metadata
      ) VALUES (
        NEW.tenant_id, NEW.account_id, NEW.id, 'employs',
        jsonb_strip_nulls(jsonb_build_object(
          'legacy_title',       NEW.title,
          'legacy_department',  NEW.department,
          'legacy_is_primary',  NEW.is_primary
        ))
      )
      ON CONFLICT ON CONSTRAINT party_relationships_uniq DO NOTHING;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE core.parties SET
      tenant_id     = NEW.tenant_id,
      display_name  = v_display_name,
      first_name    = NEW.first_name,
      last_name     = NEW.last_name,
      external_refs = jsonb_strip_nulls(jsonb_build_object(
        'legacy_franchise_id', NEW.franchise_id::text,
        'legacy_linkedin_url', NEW.linkedin_url
      )),
      updated_at    = COALESCE(NEW.updated_at, now())
    WHERE id = NEW.id;
    IF NOT FOUND THEN
      INSERT INTO core.parties (
        id, tenant_id, party_type, display_name, first_name, last_name,
        status, external_refs, created_at, updated_at
      ) VALUES (
        NEW.id, NEW.tenant_id, 'person',
        v_display_name, NEW.first_name, NEW.last_name, 'active',
        jsonb_strip_nulls(jsonb_build_object(
          'legacy_franchise_id', NEW.franchise_id::text,
          'legacy_linkedin_url', NEW.linkedin_url
        )),
        COALESCE(NEW.created_at, now()),
        COALESCE(NEW.updated_at, now())
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;

    -- employs edge maintenance
    IF NEW.account_id IS DISTINCT FROM OLD.account_id THEN
      -- account changed — drop the old edge, insert the new one
      IF OLD.account_id IS NOT NULL THEN
        DELETE FROM core.party_relationships
        WHERE from_party_id     = OLD.account_id
          AND to_party_id       = OLD.id
          AND relationship_type = 'employs';
      END IF;
      IF NEW.account_id IS NOT NULL THEN
        INSERT INTO core.party_relationships (
          tenant_id, from_party_id, to_party_id, relationship_type, metadata
        ) VALUES (
          NEW.tenant_id, NEW.account_id, NEW.id, 'employs',
          jsonb_strip_nulls(jsonb_build_object(
            'legacy_title',      NEW.title,
            'legacy_department', NEW.department,
            'legacy_is_primary', NEW.is_primary
          ))
        )
        ON CONFLICT ON CONSTRAINT party_relationships_uniq DO NOTHING;
      END IF;
    ELSIF NEW.account_id IS NOT NULL THEN
      -- account_id unchanged but title/department/is_primary may have moved.
      UPDATE core.party_relationships SET
        metadata = jsonb_strip_nulls(jsonb_build_object(
          'legacy_title',      NEW.title,
          'legacy_department', NEW.department,
          'legacy_is_primary', NEW.is_primary
        )),
        updated_at = now()
      WHERE from_party_id     = NEW.account_id
        AND to_party_id       = NEW.id
        AND relationship_type = 'employs';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM core.parties WHERE id = OLD.id;
    -- party_relationships rows cascade via FK ON DELETE CASCADE.
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_contacts (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_contacts_dual_write_to_core
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION core.dual_write_from_contacts();

COMMENT ON FUNCTION core.dual_write_from_contacts IS
  'Phase 2 Step 6 — mirror INSERT/UPDATE/DELETE on public.contacts into core.parties (party_type=person) and core.party_relationships (employs edge). Fail-open: WARNING on error so the source write never blocks.';

-- ══════════════════════════════════════════════════════════════════════
-- Parity helper for live monitoring
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.parties_drift_check()
RETURNS TABLE (
  metric  text,
  delta   bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, public, pg_catalog
AS $$
  SELECT 'accounts_minus_orgs',
         (SELECT count(*) FROM public.accounts)
       - (SELECT count(*) FROM core.parties WHERE party_type='organization')
  UNION ALL
  SELECT 'contacts_minus_persons',
         (SELECT count(*) FROM public.contacts)
       - (SELECT count(*) FROM core.parties WHERE party_type='person')
  UNION ALL
  SELECT 'contacts_with_account_minus_employs',
         (SELECT count(*) FROM public.contacts WHERE account_id IS NOT NULL)
       - (SELECT count(*) FROM core.party_relationships WHERE relationship_type='employs');
$$;

COMMENT ON FUNCTION core.parties_drift_check IS
  'Phase 2 Step 6 — drift monitor. All three rows should return delta=0 if dual-write triggers are healthy. Non-zero values mean either a missed sync (triggered failure) or a backfill gap. Run on schedule and alert on any non-zero row.';

GRANT EXECUTE ON FUNCTION core.parties_drift_check TO service_role;
