-- Phase 6 Step 7 — populate core.parties.external_refs.legacy_contact_id.
--
-- The existing core.dual_write_from_contacts trigger creates a 1:1
-- core.parties row on every public.contacts INSERT with id = NEW.id.
-- All 9,417 person parties already match a contact by ID (verified
-- 2026-05-30). That equality is convention, not contract — surface it
-- as an explicit external_refs key so downstream resolvers don't
-- depend on the implementation detail.
--
-- Two changes:
--   1. Backfill external_refs.legacy_contact_id = id::text on every
--      person party that has a matching contact.
--   2. Extend core.dual_write_from_contacts to set legacy_contact_id
--      on INSERT + UPDATE so new contacts inherit the ref automatically.
--
-- After this, the recipient resolver in services/comms-api/ can follow
-- recipient_party_id → external_refs.legacy_contact_id → contacts.email
-- without needing to know parties.id == contacts.id.

-- ── 1. Backfill ────────────────────────────────────────────────────────
UPDATE core.parties p
SET external_refs = COALESCE(p.external_refs, '{}'::jsonb)
                    || jsonb_build_object('legacy_contact_id', p.id::text)
WHERE p.party_type = 'person'
  AND (p.external_refs->>'legacy_contact_id') IS NULL
  AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p.id);

-- ── 2. Forward sync: extend the existing dual-write to stamp the ref ──
CREATE OR REPLACE FUNCTION core.dual_write_from_contacts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'core', 'pg_catalog'
AS $function$
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
        'legacy_contact_id',  NEW.id::text,
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
        'legacy_contact_id',  NEW.id::text,
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
          'legacy_contact_id',  NEW.id::text,
          'legacy_franchise_id', NEW.franchise_id::text,
          'legacy_linkedin_url', NEW.linkedin_url
        )),
        COALESCE(NEW.created_at, now()),
        COALESCE(NEW.updated_at, now())
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;

    IF NEW.account_id IS DISTINCT FROM OLD.account_id THEN
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
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_contacts (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ── 3. Lookup index (small, only on populated rows) ───────────────────
CREATE INDEX IF NOT EXISTS parties_legacy_contact_id_idx
  ON core.parties ((external_refs->>'legacy_contact_id'))
  WHERE party_type = 'person'
    AND (external_refs->>'legacy_contact_id') IS NOT NULL;
