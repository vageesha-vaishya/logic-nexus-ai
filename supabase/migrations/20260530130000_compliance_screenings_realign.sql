-- Phase 6 Step 14 — compliance.screenings realignment with master plan.
--
-- The compliance-api gating-consumer's INSERT references canonical
-- columns (subject_type, subject_id, subject_party_id,
-- triggered_by_event, metadata) that don't exist on prod's
-- compliance.screenings. The table was migrated under an older shape
-- (linked_entity_type/id, notes) and Phase 6 Step 1 mirrored those.
--
-- Realignment additive — keep legacy columns for the existing
-- screening UI; add canonical columns the gating-consumer + downstream
-- saga writes; backfill canonical from legacy; relax franchise_id
-- NOT NULL (cross-module events have no franchise scope at intent
-- time); keep a forward sync trigger so legacy and canonical stay
-- consistent until the legacy columns are dropped in a later slice.

ALTER TABLE compliance.screenings
  ADD COLUMN IF NOT EXISTS subject_type        text,
  ADD COLUMN IF NOT EXISTS subject_id          uuid,
  ADD COLUMN IF NOT EXISTS subject_party_id    uuid,
  ADD COLUMN IF NOT EXISTS rule_id             uuid,
  ADD COLUMN IF NOT EXISTS triggered_by_event  text,
  ADD COLUMN IF NOT EXISTS provider            text,
  ADD COLUMN IF NOT EXISTS provider_request_id text,
  ADD COLUMN IF NOT EXISTS hits                jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS decision            text,
  ADD COLUMN IF NOT EXISTS decided_by_user_id  uuid,
  ADD COLUMN IF NOT EXISTS decided_at          timestamptz,
  ADD COLUMN IF NOT EXISTS decision_notes      text,
  ADD COLUMN IF NOT EXISTS evidence_file_ids   uuid[],
  ADD COLUMN IF NOT EXISTS expires_at          timestamptz,
  ADD COLUMN IF NOT EXISTS metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at          timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz NOT NULL DEFAULT now();

-- Backfill canonical from legacy for the 2 existing prod rows + any
-- future row that arrives via the legacy UI path.
UPDATE compliance.screenings
SET subject_type   = COALESCE(subject_type, linked_entity_type),
    subject_id     = COALESCE(subject_id,   linked_entity_id),
    decision_notes = COALESCE(decision_notes, notes)
WHERE (subject_type IS NULL AND linked_entity_type IS NOT NULL)
   OR (subject_id   IS NULL AND linked_entity_id   IS NOT NULL)
   OR (decision_notes IS NULL AND notes IS NOT NULL);

-- Cross-module events have no franchise scope at intent time. The
-- gating-consumer pre-dates a franchise-resolution step, so the
-- producer side needs nullable franchise_id. Existing rows keep their
-- franchise_id; the constraint just stops blocking new inserts.
-- Same story for search_name: legacy UI concept that the platform-level
-- consumer doesn't have; the sync trigger fills it from subject_type +
-- subject_id so list views always have a label.
ALTER TABLE compliance.screenings ALTER COLUMN franchise_id DROP NOT NULL;
ALTER TABLE compliance.screenings ALTER COLUMN search_name  DROP NOT NULL;

-- Keep legacy + canonical in sync. Either-direction trigger so the
-- existing UI (which writes linked_entity_*, notes) still produces
-- canonical-shape rows, and the gating-consumer (which writes
-- subject_*, decision_notes) backfills legacy for the UI.
CREATE OR REPLACE FUNCTION compliance.screenings_legacy_canonical_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subject_type   IS NULL AND NEW.linked_entity_type IS NOT NULL THEN
    NEW.subject_type := NEW.linked_entity_type;
  END IF;
  IF NEW.linked_entity_type IS NULL AND NEW.subject_type IS NOT NULL THEN
    NEW.linked_entity_type := NEW.subject_type;
  END IF;

  IF NEW.subject_id IS NULL AND NEW.linked_entity_id IS NOT NULL THEN
    NEW.subject_id := NEW.linked_entity_id;
  END IF;
  IF NEW.linked_entity_id IS NULL AND NEW.subject_id IS NOT NULL THEN
    NEW.linked_entity_id := NEW.subject_id;
  END IF;

  IF NEW.decision_notes IS NULL AND NEW.notes IS NOT NULL THEN
    NEW.decision_notes := NEW.notes;
  END IF;
  IF NEW.notes IS NULL AND NEW.decision_notes IS NOT NULL THEN
    NEW.notes := NEW.decision_notes;
  END IF;

  -- Legacy UI requires a search_name; platform-level gating-consumer
  -- doesn't have one. Synthesize from subject_type:subject_id so list
  -- views always have a label.
  IF NEW.search_name IS NULL THEN
    NEW.search_name := COALESCE(NEW.subject_type, 'entity') || ':' || COALESCE(NEW.subject_id::text, 'unknown');
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_screenings_legacy_canonical_sync ON compliance.screenings;
CREATE TRIGGER trg_screenings_legacy_canonical_sync
  BEFORE INSERT OR UPDATE ON compliance.screenings
  FOR EACH ROW EXECUTE FUNCTION compliance.screenings_legacy_canonical_sync();

-- Lookup index on the canonical (subject_type, subject_id) — the saga's
-- gate-read API will query by these.
CREATE INDEX IF NOT EXISTS screenings_canonical_subject_idx
  ON compliance.screenings (tenant_id, subject_type, subject_id, created_at DESC)
  WHERE subject_type IS NOT NULL;

-- Idempotency on the gating insert: same outbox event can't double-insert.
CREATE UNIQUE INDEX IF NOT EXISTS screenings_source_outbox_id_idx
  ON compliance.screenings ((metadata->>'source_outbox_id'))
  WHERE (metadata->>'source_outbox_id') IS NOT NULL;

COMMENT ON COLUMN compliance.screenings.subject_type IS
  'Phase 6 Step 14 — canonical subject_type (master plan); kept in sync with linked_entity_type via trigger until legacy is dropped.';
COMMENT ON COLUMN compliance.screenings.subject_id IS
  'Phase 6 Step 14 — canonical subject_id; mirror of linked_entity_id via sync trigger.';
COMMENT ON COLUMN compliance.screenings.metadata IS
  'Phase 6 Step 14 — gating-saga metadata bag. Carries source_outbox_id for re-poll idempotency.';
