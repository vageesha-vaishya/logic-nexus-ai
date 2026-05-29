-- Phase 4 CRM Step 3 — crm.activities (union of public.activities + public.lead_activities)
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 4
--
-- Two source tables converge into one CRM activity log:
--   - public.activities (55 rows) — full CRM task/touchpoint model with
--     subject/description/due_date/status/priority and four FK columns
--     (account_id, contact_id, lead_id, opportunity_id).
--   - public.lead_activities (9 rows) — slim event log with lead_id +
--     text type + jsonb metadata.
--
-- crm.activities keeps the full-shape columns from public.activities AND
-- captures lead_activities entries by setting only lead_id + activity_type
-- + metadata. Polymorphic subject_type/subject_id pair added per §2.4
-- convention — future readers can JOIN on those without knowing whether
-- the original FK was on lead_id or opportunity_id.
--
-- public.activities + public.lead_activities stay authoritative for
-- writes during this phase; dual-write triggers mirror live writes into
-- crm.activities. Reads can migrate to crm.activities at the consumer's
-- pace.

-- ══════════════════════════════════════════════════════════════════════
-- 1. crm.activities
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE crm.activities (
  id              uuid PRIMARY KEY,
  tenant_id       uuid NOT NULL,
  franchise_id    uuid,
  -- Polymorphic subject per §2.4: ('sales.lead', uuid), ('sales.opportunity', uuid),
  -- ('core.party', uuid), etc. Populated for new writes; legacy rows
  -- backfilled with whichever FK is non-null in priority order
  -- opportunity > lead > contact > account.
  subject_type    text,
  subject_id      uuid,
  -- activity_type is text rather than the source enum to avoid bringing
  -- the USER-DEFINED type into crm.* namespace. lead_activities.type
  -- (plain text) flows through verbatim; activities.activity_type (enum)
  -- gets ::text cast at backfill + trigger time.
  activity_type   text NOT NULL,
  status          text,
  priority        text,
  subject         text,
  description     text,
  due_date        timestamptz,
  completed_at    timestamptz,
  assigned_to     uuid,
  created_by      uuid,
  -- Legacy FK columns preserved verbatim for the transition. The parked
  -- Step 9 DROP migration rewires these to core.parties / future sales.*
  -- when those schemas land.
  account_id      uuid,
  contact_id      uuid,
  lead_id         uuid,
  opportunity_id  uuid,
  custom_fields   jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- metadata jsonb captures the lead_activities source field; new writes
  -- from public.activities don't populate it.
  metadata        jsonb,
  -- Tracks which source each row came from. Useful for the migration
  -- audit + future deduplication.
  source_table    text NOT NULL CHECK (source_table IN ('public.activities','public.lead_activities','crm.native')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE crm.activities IS
  'Phase 4 CRM Step 3 — unified CRM activity log. Backfills from public.activities (full model) + public.lead_activities (event log). Polymorphic subject_type/subject_id per §2.4; legacy FK columns retained for transition.';

CREATE INDEX activities_tenant_due_idx       ON crm.activities (tenant_id, due_date DESC) WHERE due_date IS NOT NULL;
CREATE INDEX activities_subject_idx          ON crm.activities (tenant_id, subject_type, subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX activities_assigned_idx         ON crm.activities (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX activities_lead_idx             ON crm.activities (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX activities_opportunity_idx      ON crm.activities (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX activities_open_tasks_idx       ON crm.activities (tenant_id, assigned_to, due_date) WHERE completed_at IS NULL;

ALTER TABLE crm.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY activities_tenant_select ON crm.activities
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_crm_activities_updated_at
  BEFORE UPDATE ON crm.activities
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON crm.activities TO authenticated;
GRANT ALL    ON crm.activities TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. Backfill from public.activities → crm.activities
-- ══════════════════════════════════════════════════════════════════════
--
-- subject_type/subject_id derived from the first non-null FK in order:
-- opportunity > lead > contact > account. activity_type cast from enum.

INSERT INTO crm.activities (
  id, tenant_id, franchise_id,
  subject_type, subject_id,
  activity_type, status, priority,
  subject, description, due_date, completed_at,
  assigned_to, created_by,
  account_id, contact_id, lead_id, opportunity_id,
  custom_fields, source_table, created_at, updated_at
)
SELECT
  a.id, a.tenant_id, a.franchise_id,
  CASE
    WHEN a.opportunity_id IS NOT NULL THEN 'sales.opportunity'
    WHEN a.lead_id        IS NOT NULL THEN 'sales.lead'
    WHEN a.contact_id     IS NOT NULL THEN 'core.party'
    WHEN a.account_id     IS NOT NULL THEN 'core.party'
    ELSE NULL
  END,
  COALESCE(a.opportunity_id, a.lead_id, a.contact_id, a.account_id),
  a.activity_type::text, a.status::text, a.priority::text,
  a.subject, a.description, a.due_date, a.completed_at,
  a.assigned_to, a.created_by,
  a.account_id, a.contact_id, a.lead_id, a.opportunity_id,
  COALESCE(a.custom_fields, '{}'::jsonb),
  'public.activities',
  COALESCE(a.created_at, now()), COALESCE(a.updated_at, now())
FROM public.activities a
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Backfill from public.lead_activities → crm.activities
-- ══════════════════════════════════════════════════════════════════════
--
-- Slim source: synthesize subject from type for display continuity.
-- Skips rows with NULL tenant_id (lead_activities allows NULL there;
-- crm.activities does not). Updated_at = created_at since lead_activities
-- has no updated_at column.

INSERT INTO crm.activities (
  id, tenant_id, franchise_id,
  subject_type, subject_id,
  activity_type, status, priority,
  subject, description, due_date, completed_at,
  assigned_to, created_by,
  account_id, contact_id, lead_id, opportunity_id,
  custom_fields, metadata, source_table, created_at, updated_at
)
SELECT
  la.id, la.tenant_id, NULL,
  'sales.lead', la.lead_id,
  la.type, NULL, NULL,
  -- Synthesise a human-readable subject. Future UI cleanup can render
  -- from metadata directly.
  initcap(replace(la.type, '_', ' ')),
  NULL, NULL, NULL,
  NULL, NULL,
  NULL, NULL, la.lead_id, NULL,
  '{}'::jsonb,
  la.metadata,
  'public.lead_activities',
  COALESCE(la.created_at, now()),
  COALESCE(la.created_at, now())
FROM public.lead_activities la
WHERE la.tenant_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 4. Dual-write triggers
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION crm.dual_write_from_activities()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = crm, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm.activities (
      id, tenant_id, franchise_id,
      subject_type, subject_id,
      activity_type, status, priority,
      subject, description, due_date, completed_at,
      assigned_to, created_by,
      account_id, contact_id, lead_id, opportunity_id,
      custom_fields, source_table, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.tenant_id, NEW.franchise_id,
      CASE
        WHEN NEW.opportunity_id IS NOT NULL THEN 'sales.opportunity'
        WHEN NEW.lead_id        IS NOT NULL THEN 'sales.lead'
        WHEN NEW.contact_id     IS NOT NULL THEN 'core.party'
        WHEN NEW.account_id     IS NOT NULL THEN 'core.party'
        ELSE NULL
      END,
      COALESCE(NEW.opportunity_id, NEW.lead_id, NEW.contact_id, NEW.account_id),
      NEW.activity_type::text, NEW.status::text, NEW.priority::text,
      NEW.subject, NEW.description, NEW.due_date, NEW.completed_at,
      NEW.assigned_to, NEW.created_by,
      NEW.account_id, NEW.contact_id, NEW.lead_id, NEW.opportunity_id,
      COALESCE(NEW.custom_fields, '{}'::jsonb),
      'public.activities',
      COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
    )
    ON CONFLICT (id) DO UPDATE SET
      activity_type = EXCLUDED.activity_type,
      status        = EXCLUDED.status,
      priority      = EXCLUDED.priority,
      subject       = EXCLUDED.subject,
      description   = EXCLUDED.description,
      due_date      = EXCLUDED.due_date,
      completed_at  = EXCLUDED.completed_at,
      assigned_to   = EXCLUDED.assigned_to,
      custom_fields = EXCLUDED.custom_fields,
      updated_at    = EXCLUDED.updated_at;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE crm.activities SET
      tenant_id     = NEW.tenant_id,
      franchise_id  = NEW.franchise_id,
      subject_type  = CASE
                        WHEN NEW.opportunity_id IS NOT NULL THEN 'sales.opportunity'
                        WHEN NEW.lead_id        IS NOT NULL THEN 'sales.lead'
                        WHEN NEW.contact_id     IS NOT NULL THEN 'core.party'
                        WHEN NEW.account_id     IS NOT NULL THEN 'core.party'
                        ELSE NULL
                      END,
      subject_id    = COALESCE(NEW.opportunity_id, NEW.lead_id, NEW.contact_id, NEW.account_id),
      activity_type = NEW.activity_type::text,
      status        = NEW.status::text,
      priority      = NEW.priority::text,
      subject       = NEW.subject,
      description   = NEW.description,
      due_date      = NEW.due_date,
      completed_at  = NEW.completed_at,
      assigned_to   = NEW.assigned_to,
      created_by    = NEW.created_by,
      account_id    = NEW.account_id,
      contact_id    = NEW.contact_id,
      lead_id       = NEW.lead_id,
      opportunity_id = NEW.opportunity_id,
      custom_fields = COALESCE(NEW.custom_fields, '{}'::jsonb),
      updated_at    = COALESCE(NEW.updated_at, now())
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM crm.activities WHERE id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_activities (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_activities_dual_write_to_crm
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION crm.dual_write_from_activities();

CREATE OR REPLACE FUNCTION crm.dual_write_from_lead_activities()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = crm, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tenant_id IS NULL THEN
      RETURN NEW;  -- crm.activities requires non-null tenant_id
    END IF;
    INSERT INTO crm.activities (
      id, tenant_id, subject_type, subject_id,
      activity_type, subject,
      lead_id, custom_fields, metadata, source_table,
      created_at, updated_at
    ) VALUES (
      NEW.id, NEW.tenant_id, 'sales.lead', NEW.lead_id,
      NEW.type, initcap(replace(NEW.type, '_', ' ')),
      NEW.lead_id, '{}'::jsonb, NEW.metadata, 'public.lead_activities',
      COALESCE(NEW.created_at, now()), COALESCE(NEW.created_at, now())
    )
    ON CONFLICT (id) DO UPDATE SET
      activity_type = EXCLUDED.activity_type,
      metadata      = EXCLUDED.metadata,
      updated_at    = now();
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE crm.activities SET
      tenant_id     = NEW.tenant_id,
      subject_id    = NEW.lead_id,
      activity_type = NEW.type,
      lead_id       = NEW.lead_id,
      metadata      = NEW.metadata,
      updated_at    = now()
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM crm.activities WHERE id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_lead_activities (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_lead_activities_dual_write_to_crm
  AFTER INSERT OR UPDATE OR DELETE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION crm.dual_write_from_lead_activities();

-- ══════════════════════════════════════════════════════════════════════
-- 5. Drift helper
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION crm.activities_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = crm, public, pg_catalog AS $$
  SELECT 'activities_minus_crm_activities_public',
         (SELECT count(*) FROM public.activities)
       - (SELECT count(*) FROM crm.activities WHERE source_table='public.activities')
  UNION ALL
  SELECT 'lead_activities_minus_crm_activities_lead',
         (SELECT count(*) FROM public.lead_activities WHERE tenant_id IS NOT NULL)
       - (SELECT count(*) FROM crm.activities WHERE source_table='public.lead_activities');
$$;

COMMENT ON FUNCTION crm.activities_drift_check IS
  'Phase 4 CRM Step 3 drift monitor. Both deltas should remain 0.';

GRANT EXECUTE ON FUNCTION crm.activities_drift_check TO service_role;
