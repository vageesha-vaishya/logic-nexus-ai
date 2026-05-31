-- Phase 6 Step 22a — compliance.screen_subject(...) decision engine.
--
-- The compliance-api gating-consumer's job per master plan §7.4 is to
-- drain core.outbox events and produce screening decisions. Step 19's
-- emitter writes events; Step 20 makes them visible to the consumer;
-- this function is the actual decision logic. The consumer TS shrinks
-- to "poll → for each event call this rpc → mark outbox published".
--
-- One SECURITY DEFINER call per event so the whole insert-or-update-
-- and-decide flow is one Postgres transaction. The unique partial
-- index on (metadata->>'source_outbox_id') (added in Step 14's
-- realign) prevents double-insert if a poll re-runs after the
-- consumer crashed mid-tick.
--
-- Provider: public.screen_restricted_party (added in
-- 20260205100000_compliance_screening_module.sql) — pg_trgm similarity
-- against compliance.restricted_party_lists (7 prod rows of OFAC/BIS
-- entries). Returns up to 20 hits ≥ p_threshold. Caller passes
-- p_threshold=0.7 here; tier into 'flagged' vs 'failed' on max
-- similarity ≥ 0.85.
--
-- Thresholds:
--   - 0 hits      → passed   (decision='pass',           expires +90d)
--   - max < 0.85  → flagged  (decision='review_required', expires +90d)
--   - max ≥ 0.85  → failed   (decision='fail',            expires +90d)
--
-- 90-day expiry per compliance.md §9.5 sanctions class. expires_at
-- past current time → compliance.is_party_blocked treats the row as
-- stale (fails open); re-screening then re-emits the same source
-- event via a manual UI re-screen (out of scope this slice).

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
  -- ────────────────────────────────────────────────────────────────
  -- 1. Insert pending screening row (or noop if this outbox event was
  -- already consumed by a prior tick — the unique partial index on
  -- (metadata->>'source_outbox_id') enforces idempotency).
  -- ────────────────────────────────────────────────────────────────
  INSERT INTO compliance.screenings (
    tenant_id, subject_type, subject_id, subject_party_id,
    triggered_by_event, status, metadata
  )
  VALUES (
    p_tenant_id, p_subject_type, p_subject_id, p_subject_party_id,
    p_triggered_by_event, 'pending',
    jsonb_build_object('source_outbox_id', p_source_outbox_id::text)
  )
  ON CONFLICT ((metadata->>'source_outbox_id')) DO NOTHING
  RETURNING id INTO v_screening_id;

  -- INSERT was suppressed: look up the existing row.
  IF v_screening_id IS NULL THEN
    SELECT id, status INTO v_screening_id, v_existing_status
    FROM compliance.screenings
    WHERE (metadata->>'source_outbox_id') = p_source_outbox_id::text
    LIMIT 1;
    -- Already decided on a prior tick — return what we have, don't
    -- re-screen.
    IF v_existing_status IS NOT NULL AND v_existing_status <> 'pending' THEN
      RETURN QUERY
        SELECT s.id, s.status, s.decision,
               COALESCE(jsonb_array_length(s.hits), 0),
               COALESCE((s.hits -> 0 ->> 'similarity')::numeric, 0)
        FROM compliance.screenings s WHERE s.id = v_screening_id;
      RETURN;
    END IF;
  END IF;

  -- ────────────────────────────────────────────────────────────────
  -- 2. Run the screening provider (pg_trgm against restricted_party_
  -- lists). Empty / null search_name → no-op decision='pass'.
  -- ────────────────────────────────────────────────────────────────
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

  -- ────────────────────────────────────────────────────────────────
  -- 3. Compute decision from hits.
  -- ────────────────────────────────────────────────────────────────
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

  -- ────────────────────────────────────────────────────────────────
  -- 4. Update the pending row with the terminal decision.
  -- ────────────────────────────────────────────────────────────────
  UPDATE compliance.screenings
  SET
    status     = v_status,
    decision   = v_decision,
    provider   = 'pg_trgm_restricted_party_lists',
    hits       = v_hits,
    decided_at = now(),
    expires_at = now() + make_interval(days => p_expiry_days),
    -- Preserve any other metadata keys callers may add later.
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
  'Phase 6 Step 22a — compliance gating saga decision engine. Idempotent per source_outbox_id; runs public.screen_restricted_party and tiers the result into passed/flagged/failed. Called once per outbox event by the compliance-api gating-consumer.';

GRANT EXECUTE ON FUNCTION compliance.screen_subject(uuid,text,uuid,uuid,text,uuid,text,text,numeric,numeric,integer) TO service_role;
