-- Phase 6 Step 13 — compliance.screening.failed / .flagged intent emitter.
--
-- The compliance-api gating consumer writes compliance.screenings rows.
-- When a row transitions to status='failed' or 'flagged' (whether by
-- future provider integration or manual admin decision), the compliance
-- team needs to know. Per compliance.md §5, compliance publishes
-- screening lifecycle events; comms (via core.notifications) delivers.
--
-- Note: the prod compliance.screenings schema diverged from the master
-- plan — uses linked_entity_type/id (not subject_type/id), notes (not
-- decision_notes), no provider column. The trigger uses the live shape;
-- realigning the schema is a separate compliance-api slice.
--
-- Idempotency: WHEN restricts the fire to actual transitions; no-op when
-- OLD.status was already at the target value.

CREATE OR REPLACE FUNCTION public.emit_compliance_screening_outcome_intent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core, compliance
AS $$
DECLARE
  saga_id        uuid := gen_random_uuid();
  intent_kind    text;
  severity       text;
  subject_label  text;
  rendered_html  text;
BEGIN
  IF NEW.status NOT IN ('failed','flagged') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'failed' THEN
    intent_kind := 'compliance.screening.failed';
    severity    := 'critical';
  ELSE
    intent_kind := 'compliance.screening.flagged';
    severity    := 'warning';
  END IF;

  subject_label := COALESCE(NEW.linked_entity_type, 'subject')
                   || ' ' || COALESCE(NEW.linked_entity_id::text, '')
                   || CASE WHEN NEW.search_name IS NOT NULL
                           THEN ' (' || NEW.search_name || ')'
                           ELSE '' END;
  rendered_html :=
    '<p>Compliance screening <strong>' || NEW.status || '</strong> for '
    || subject_label || '.</p>'
    || CASE WHEN NEW.match_score IS NOT NULL
            THEN '<p>Match score: ' || NEW.match_score || '</p>' ELSE '' END
    || CASE WHEN NEW.notes IS NOT NULL
            THEN '<p>Notes: ' || NEW.notes || '</p>' ELSE '' END;

  INSERT INTO core.notifications (
    tenant_id, recipient_role_id,
    subject_type, subject_id,
    intent_kind, severity, payload, correlation_id
  ) VALUES (
    NEW.tenant_id,
    gen_random_uuid(),                      -- marker; payload.role_name drives the fan-out
    'compliance.screening', NEW.id,
    intent_kind, severity,
    jsonb_build_object(
      'role_name',        'compliance_officer',
      'screening_id',     NEW.id,
      'linked_entity_type', NEW.linked_entity_type,
      'linked_entity_id',   NEW.linked_entity_id,
      'search_name',      NEW.search_name,
      'status',           NEW.status,
      'match_score',      NEW.match_score,
      'notes',            NEW.notes,
      'subject',          'Compliance screening ' || NEW.status || ' — ' || subject_label,
      'html',             rendered_html
    ),
    saga_id
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.emit_compliance_screening_outcome_intent() IS
  'Phase 6 Step 13 — emits compliance.screening.failed|flagged core.notifications when compliance.screenings transitions into a non-passed terminal status.';

DROP TRIGGER IF EXISTS trg_emit_compliance_screening_outcome ON compliance.screenings;

CREATE TRIGGER trg_emit_compliance_screening_outcome
  AFTER INSERT OR UPDATE OF status
  ON compliance.screenings
  FOR EACH ROW
  WHEN (NEW.status IN ('failed','flagged'))
  EXECUTE FUNCTION public.emit_compliance_screening_outcome_intent();
