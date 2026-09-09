-- Root-cause fix — platform.llm_usage stopped accepting writes 2026-07-01.
--
-- platform.llm_usage is RANGE-partitioned by (ts), but only three partitions
-- were ever created (2026-04, -05, -06 — see 20260515053541), with no
-- ongoing provisioning and no DEFAULT partition as a safety net. Every
-- insert with ts >= 2026-07-01 has failed with "no partition of relation
-- ""llm_usage"" found for row", silently swallowed by
-- _shared/llm-gateway.ts's recordUsage() (`if (error) ctx.logger?.warn(...)`
-- — never thrown, never surfacing to a caller or an alert). This is why the
-- last row is 2026-06-30 23:47:04, right at the boundary, and why a
-- confirmed 2026-09-01 06:47:04 markets-* invocation (matching
-- platform.access_log and llm_provider_configs.last_used_at) produced no
-- usage row: the LLM call itself succeeded and returned normally; only the
-- cost-tracking side-effect silently disappeared.
--
-- Mirrors core.outbox's existing, already-proven fix for the identical
-- problem (20260531001700_core_outbox_partition_autoprovisioner.sql):
-- an idempotent per-month provisioner, a look-ahead wrapper that keeps a
-- 3-month buffer, and a monthly cron job. Backfills the missing months
-- (2026-07 through whatever ensure_llm_usage_partitions_ahead(3) covers as
-- of today) immediately so writes resume without waiting for the next
-- cron tick.

-- ══════════════════════════════════════════════════════════════════════
-- 1. Per-month idempotent provisioner
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION platform.ensure_llm_usage_partition_for(p_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = platform, pg_catalog
AS $$
DECLARE
  v_year  int := extract(year  from p_date)::int;
  v_month int := extract(month from p_date)::int;
  v_part_name  text := format('llm_usage_y%sm%s', v_year, lpad(v_month::text, 2, '0'));
  v_qualified  text := 'platform.' || v_part_name;
  v_from_date  date := make_date(v_year, v_month, 1);
  v_to_date    date := (v_from_date + interval '1 month')::date;
BEGIN
  IF to_regclass(v_qualified) IS NOT NULL THEN
    RETURN 'already_exists:' || v_part_name;
  END IF;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS platform.%I PARTITION OF platform.llm_usage FOR VALUES FROM (%L) TO (%L)',
    v_part_name, v_from_date::text, v_to_date::text
  );
  EXECUTE format('ALTER TABLE platform.%I ENABLE ROW LEVEL SECURITY', v_part_name);
  EXECUTE format(
    'CREATE POLICY %I ON platform.%I FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))',
    v_part_name || '_owner_select', v_part_name
  );
  EXECUTE format('GRANT SELECT ON platform.%I TO authenticated', v_part_name);
  EXECUTE format('GRANT ALL    ON platform.%I TO service_role',  v_part_name);

  RAISE NOTICE 'ensure_llm_usage_partition_for: created % covering % .. %',
    v_part_name, v_from_date, v_to_date;
  RETURN 'created:' || v_part_name;
END;
$$;

COMMENT ON FUNCTION platform.ensure_llm_usage_partition_for(date) IS
  'Idempotently creates the platform.llm_usage monthly partition for whatever month p_date falls in, with the same per-partition RLS/policy/grants as the original migration (20260515053541). Returns ''created:NAME'' or ''already_exists:NAME''.';

REVOKE EXECUTE ON FUNCTION platform.ensure_llm_usage_partition_for(date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION platform.ensure_llm_usage_partition_for(date) TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. Look-ahead wrapper (the cron entry calls this)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION platform.ensure_llm_usage_partitions_ahead(
  p_months_ahead int DEFAULT 3
) RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = platform, pg_catalog
AS $$
DECLARE
  i int;
  v_result text;
BEGIN
  IF p_months_ahead < 0 OR p_months_ahead > 24 THEN
    RAISE EXCEPTION 'ensure_llm_usage_partitions_ahead: p_months_ahead must be 0..24; got %', p_months_ahead;
  END IF;

  FOR i IN 0 .. p_months_ahead LOOP
    v_result := platform.ensure_llm_usage_partition_for((current_date + (i || ' months')::interval)::date);
    RETURN NEXT v_result;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION platform.ensure_llm_usage_partitions_ahead(int) IS
  'Ensures partitions exist for the current month plus the next p_months_ahead months. Default 3 means the buffer never dips below 3 months. Called by the llm-usage-partition-provisioner cron.';

REVOKE EXECUTE ON FUNCTION platform.ensure_llm_usage_partitions_ahead(int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION platform.ensure_llm_usage_partitions_ahead(int) TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Monthly cron schedule
-- ══════════════════════════════════════════════════════════════════════

-- 02:00 UTC on the 1st of each month. cron.schedule is idempotent on
-- jobname (re-running this migration updates the existing entry).
SELECT cron.schedule(
  'llm-usage-partition-provisioner',
  '0 2 1 * *',
  $cron$ SELECT platform.ensure_llm_usage_partitions_ahead(3); $cron$
);

-- ══════════════════════════════════════════════════════════════════════
-- 4. Immediate backfill — don't wait for the next cron tick
-- ══════════════════════════════════════════════════════════════════════

SELECT platform.ensure_llm_usage_partitions_ahead(3);
