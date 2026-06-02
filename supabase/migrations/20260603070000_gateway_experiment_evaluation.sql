-- LLM Gateway P3.5 — experiment evaluation + winner promotion.
-- Per design §5.6. The chi-square + p-value math lives in the Node
-- service; SQL just aggregates the 2×2 contingency table and provides
-- an atomic promotion RPC.

-- ── 1. Aggregate latest outcomes per invocation, grouped by variant. ──
-- Returns one row per experiment evaluation. "Latest outcome wins" so
-- a user who first rejected then accepted ends up counted as accepted.
-- "ignored" rows are excluded from accept/reject counts (per design)
-- but included in `total_outcomes` so callers can see coverage.
CREATE OR REPLACE FUNCTION gateway.evaluate_experiment(p_experiment_id uuid)
RETURNS TABLE (
  experiment_id          uuid,
  prompt_key             text,
  variant_a_version_id   uuid,
  variant_b_version_id   uuid,
  traffic_split          numeric,
  status                 text,
  target_invocations     integer,
  invocations_a          bigint,
  invocations_b          bigint,
  accepted_a             bigint,
  accepted_b             bigint,
  rejected_a             bigint,
  rejected_b             bigint,
  ignored_a              bigint,
  ignored_b              bigint,
  total_outcomes_a       bigint,
  total_outcomes_b       bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, gateway
AS $$
DECLARE
  exp_row gateway.prompt_experiments%ROWTYPE;
BEGIN
  SELECT * INTO exp_row FROM gateway.prompt_experiments WHERE id = p_experiment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'experiment % not found', p_experiment_id;
  END IF;

  RETURN QUERY
  WITH inv_counts AS (
    SELECT
      variant_label,
      COUNT(*) AS n
    FROM gateway.llm_invocations
    WHERE gateway.llm_invocations.experiment_id = p_experiment_id
    GROUP BY variant_label
  ),
  latest_outcomes AS (
    -- For each invocation, take the most recent outcome row.
    SELECT DISTINCT ON (o.invocation_id)
      o.invocation_id, o.variant_label, o.kind
    FROM gateway.outcomes o
    WHERE o.experiment_id = p_experiment_id
    ORDER BY o.invocation_id, o.created_at DESC
  ),
  outcome_counts AS (
    SELECT
      variant_label,
      COUNT(*) FILTER (WHERE kind IN ('accepted','accepted_after_edit'))    AS accepted,
      COUNT(*) FILTER (WHERE kind IN ('rejected','overridden'))             AS rejected,
      COUNT(*) FILTER (WHERE kind = 'ignored')                              AS ignored,
      COUNT(*)                                                              AS total_outcomes
    FROM latest_outcomes
    GROUP BY variant_label
  )
  SELECT
    exp_row.id,
    exp_row.prompt_key,
    exp_row.variant_a_version_id,
    exp_row.variant_b_version_id,
    exp_row.traffic_split,
    exp_row.status,
    exp_row.target_invocations,
    COALESCE((SELECT n FROM inv_counts WHERE variant_label = 'a'), 0)::bigint,
    COALESCE((SELECT n FROM inv_counts WHERE variant_label = 'b'), 0)::bigint,
    COALESCE((SELECT accepted FROM outcome_counts WHERE variant_label = 'a'), 0)::bigint,
    COALESCE((SELECT accepted FROM outcome_counts WHERE variant_label = 'b'), 0)::bigint,
    COALESCE((SELECT rejected FROM outcome_counts WHERE variant_label = 'a'), 0)::bigint,
    COALESCE((SELECT rejected FROM outcome_counts WHERE variant_label = 'b'), 0)::bigint,
    COALESCE((SELECT ignored FROM outcome_counts WHERE variant_label = 'a'), 0)::bigint,
    COALESCE((SELECT ignored FROM outcome_counts WHERE variant_label = 'b'), 0)::bigint,
    COALESCE((SELECT total_outcomes FROM outcome_counts WHERE variant_label = 'a'), 0)::bigint,
    COALESCE((SELECT total_outcomes FROM outcome_counts WHERE variant_label = 'b'), 0)::bigint;
END;
$$;

REVOKE ALL ON FUNCTION gateway.evaluate_experiment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gateway.evaluate_experiment(uuid) TO service_role;

COMMENT ON FUNCTION gateway.evaluate_experiment IS
  'Returns 2×2 contingency table for an experiment: invocations + latest-outcome counts per variant. Chi-square test runs Node-side.';


-- ── 2. Atomic winner promotion. ──
-- Sets gateway.prompts.active_version_id to the winning version,
-- supersedes any other 'active' versions of that prompt, marks the
-- experiment as completed with winner_version_id + ended_at.
-- Caller (the Node service) is responsible for the significance check.
CREATE OR REPLACE FUNCTION gateway.promote_experiment_winner(
  p_experiment_id uuid,
  p_winner_version_id uuid
)
RETURNS TABLE (
  experiment_id    uuid,
  prompt_key       text,
  winner_version_id uuid,
  prior_active_version_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, gateway
AS $$
DECLARE
  exp_row gateway.prompt_experiments%ROWTYPE;
  v_prior_active uuid;
BEGIN
  SELECT * INTO exp_row FROM gateway.prompt_experiments WHERE id = p_experiment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'experiment % not found', p_experiment_id;
  END IF;
  IF exp_row.status <> 'active' THEN
    RAISE EXCEPTION 'experiment % is not active (status=%)', p_experiment_id, exp_row.status;
  END IF;
  IF p_winner_version_id NOT IN (exp_row.variant_a_version_id, exp_row.variant_b_version_id) THEN
    RAISE EXCEPTION 'winner % is not one of the experiment variants', p_winner_version_id;
  END IF;

  -- Capture prior active so the caller can audit the swap.
  SELECT active_version_id INTO v_prior_active
    FROM gateway.prompts WHERE key = exp_row.prompt_key;

  -- Flip active to winner and supersede the prior active version.
  UPDATE gateway.prompt_versions
    SET status = 'superseded'
    WHERE prompt_key = exp_row.prompt_key
      AND status = 'active'
      AND id <> p_winner_version_id;
  UPDATE gateway.prompt_versions
    SET status = 'active', promoted_at = COALESCE(promoted_at, now()), promoted_by_user_id = auth.uid()
    WHERE id = p_winner_version_id;
  UPDATE gateway.prompts
    SET active_version_id = p_winner_version_id
    WHERE key = exp_row.prompt_key;

  UPDATE gateway.prompt_experiments
    SET status = 'completed',
        winner_version_id = p_winner_version_id,
        ended_at = now()
    WHERE id = p_experiment_id;

  RETURN QUERY SELECT exp_row.id, exp_row.prompt_key, p_winner_version_id, v_prior_active;
END;
$$;

REVOKE ALL ON FUNCTION gateway.promote_experiment_winner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gateway.promote_experiment_winner(uuid, uuid) TO service_role;

COMMENT ON FUNCTION gateway.promote_experiment_winner IS
  'Atomically flip prompts.active_version_id to the winning variant, supersede the prior active, and mark the experiment completed.';
