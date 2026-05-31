-- Phase 6 Step 25 — fix compliance.screen_subject ON CONFLICT clause.
--
-- Step 22a wrote:
--   ON CONFLICT ((metadata->>'source_outbox_id')) DO NOTHING
-- which crashes at runtime with:
--   42P10: there is no unique or exclusion constraint matching the ON
--   CONFLICT specification
--
-- The matching index from Step 14's realign (20260530130000) is a
-- partial unique index:
--   CREATE UNIQUE INDEX screenings_source_outbox_id_idx
--     ON compliance.screenings ((metadata->>'source_outbox_id'))
--     WHERE (metadata->>'source_outbox_id') IS NOT NULL;
--
-- For partial indexes, ON CONFLICT must repeat the index predicate so
-- Postgres can infer the right index. The fix is one extra WHERE
-- clause inside the conflict_target; everything else in the function
-- stays exactly as Step 22a wrote it.
--
-- Caught by the gating-saga smoke test (supabase/tests/
-- compliance_gating_saga.sql) on first run against prod.

CREATE OR REPLACE FUNCTION compliance.screen_subject(
  p_tenant_id          uuid,
  p_subject_type       text,
  p_subject_id         uuid,
  p_subject_party_id   uuid,
  p_triggered_by_event text,
  p_source_outbox_id   uuid,
  p_search_name        text,
  p_country_code       text DEFAULT NULL,
  p_threshold          numeric DEFAULT 0.7,
  p_fail_threshold     numeric DEFAULT 0.85,
  p_expiry_days        integer DEFAULT 90
) RETURNS TABLE (
  screening_id uuid,
  status text,
  decision text,
  hit_count integer,
  max_similarity numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = compliance, public, pg_catalog
AS $$
DECLARE
  v_screening_id uuid;
  v_existing_status text;
  v_hits jsonb;
  v_hit_count integer;
  v_max_sim numeric;
  v_status text;
  v_decision text;
BEGIN
  INSERT INTO compliance.screenings (
    tenant_id, subject_type, subject_id, subject_party_id,
    triggered_by_event, status, metadata
  )
  VALUES (
    p_tenant_id, p_subject_type, p_subject_id, p_subject_party_id,
    p_triggered_by_event, 'pending',
    jsonb_build_object('source_outbox_id', p_source_outbox_id::text)
  )
  ON CONFLICT ((metadata->>'source_outbox_id'))
    WHERE (metadata->>'source_outbox_id') IS NOT NULL
    DO NOTHING
  RETURNING id INTO v_screening_id;

  IF v_screening_id IS NULL THEN
    SELECT id, status INTO v_screening_id, v_existing_status
    FROM compliance.screenings
    WHERE (metadata->>'source_outbox_id') = p_source_outbox_id::text
    LIMIT 1;
    IF v_existing_status IS NOT NULL AND v_existing_status <> 'pending' THEN
      RETURN QUERY
        SELECT s.id, s.status, s.decision,
               COALESCE(jsonb_array_length(s.hits), 0),
               COALESCE((s.hits -> 0 ->> 'similarity')::numeric, 0)
        FROM compliance.screenings s WHERE s.id = v_screening_id;
      RETURN;
    END IF;
  END IF;

  IF p_search_name IS NULL OR length(trim(p_search_name)) = 0 THEN
    v_hits := '[]'::jsonb;
    v_hit_count := 0;
    v_max_sim := 0;
  ELSE
    SELECT
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'source_list',  r.source_list,
            'entity_name',  r.entity_name,
            'address',      r.address,
            'country_code', r.country_code,
            'similarity',   r.similarity,
            'remarks',      r.remarks
          )
          ORDER BY r.similarity DESC
        ),
        '[]'::jsonb
      ),
      COUNT(*)::integer,
      COALESCE(MAX(r.similarity), 0)
    INTO v_hits, v_hit_count, v_max_sim
    FROM public.screen_restricted_party(p_search_name, p_country_code, p_threshold) r;
  END IF;

  IF v_hit_count = 0 THEN
    v_status := 'passed';
    v_decision := 'pass';
  ELSIF v_max_sim >= p_fail_threshold THEN
    v_status := 'failed';
    v_decision := 'fail';
  ELSE
    v_status := 'flagged';
    v_decision := 'review_required';
  END IF;

  UPDATE compliance.screenings
  SET
    status     = v_status,
    decision   = v_decision,
    provider   = 'pg_trgm_restricted_party_lists',
    hits       = v_hits,
    decided_at = now(),
    expires_at = now() + make_interval(days => p_expiry_days),
    metadata   = metadata || jsonb_build_object(
                   'hit_count',      v_hit_count,
                   'max_similarity', v_max_sim
                 )
  WHERE id = v_screening_id
    AND status = 'pending';

  RETURN QUERY
    SELECT v_screening_id, v_status, v_decision, v_hit_count, v_max_sim;
END;
$$;

COMMENT ON FUNCTION compliance.screen_subject(uuid,text,uuid,uuid,text,uuid,text,text,numeric,numeric,integer) IS
  'Phase 6 Step 22a + Step 25 — gating saga decision engine. Idempotent per source_outbox_id via partial unique index; runs public.screen_restricted_party and tiers into passed/flagged/failed.';
