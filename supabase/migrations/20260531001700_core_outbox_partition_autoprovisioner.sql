-- Phase 6 Step 41 — outbox partition auto-provisioner + monthly cron.
--
-- Closes the Step 36 follow-up TODO. With this in place the
-- core.outbox partition list is self-maintaining; the manual
-- "extend by N months" migration dance never has to happen again.
--
-- Three pieces:
--
-- 1. core.ensure_outbox_partition_for(p_date)
--    Idempotently creates the partition for whatever month p_date
--    falls in. Matches the existing outbox_yYYYYmMM naming exactly
--    (see 20260528130000_create_core_outbox.sql lines 42-50) and
--    applies the same per-partition setup the original migration
--    did: ENABLE RLS + GRANT ALL TO service_role.
--
--    Returns text — 'created' or 'already_exists'. Smoke tests +
--    observability queries can act on the return value without
--    re-querying pg_inherits.
--
-- 2. core.ensure_outbox_partitions_ahead(p_months_ahead)
--    Loops 0..p_months_ahead calling fn (1) for each. Default 3
--    months so the buffer never dips below 3.
--
-- 3. cron.schedule('outbox-partition-provisioner', '0 2 1 * *', ...)
--    02:00 UTC on the 1st of each month — well before any
--    rollover risk (a write dated within the new month would
--    only happen after the 1st rolls over locally). Calls the
--    wrapper from (2). The cron daemon runs as the database
--    owner; the fns are SECURITY DEFINER so the owner's CREATE
--    on schema 'core' is what gets used regardless of caller.

-- ══════════════════════════════════════════════════════════════════════
-- 1. Per-month idempotent provisioner
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.ensure_outbox_partition_for(p_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_year  int := extract(year  from p_date)::int;
  v_month int := extract(month from p_date)::int;
  v_part_name  text := format('outbox_y%sm%s', v_year, lpad(v_month::text, 2, '0'));
  v_qualified  text := 'core.' || v_part_name;
  v_from_date  date := make_date(v_year, v_month, 1);
  v_to_date    date := (v_from_date + interval '1 month')::date;
BEGIN
  IF to_regclass(v_qualified) IS NOT NULL THEN
    RETURN 'already_exists:' || v_part_name;
  END IF;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS core.%I PARTITION OF core.outbox FOR VALUES FROM (%L) TO (%L)',
    v_part_name, v_from_date::text, v_to_date::text
  );
  EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY', v_part_name);
  EXECUTE format('GRANT ALL ON core.%I TO service_role',          v_part_name);

  RAISE NOTICE 'ensure_outbox_partition_for: created % covering % .. %',
    v_part_name, v_from_date, v_to_date;
  RETURN 'created:' || v_part_name;
END;
$$;

COMMENT ON FUNCTION core.ensure_outbox_partition_for(date) IS
  'Phase 6 Step 41 — idempotently creates the core.outbox monthly partition for whatever month p_date falls in. Matches the existing outbox_yYYYYmMM naming + ENABLE RLS + GRANT. Returns ''created:NAME'' or ''already_exists:NAME''.';

REVOKE EXECUTE ON FUNCTION core.ensure_outbox_partition_for(date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION core.ensure_outbox_partition_for(date) TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. Look-ahead wrapper (the cron entry calls this)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.ensure_outbox_partitions_ahead(
  p_months_ahead int DEFAULT 3
) RETURNS SETOF text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  i int;
  v_result text;
BEGIN
  IF p_months_ahead < 0 OR p_months_ahead > 24 THEN
    RAISE EXCEPTION 'ensure_outbox_partitions_ahead: p_months_ahead must be 0..24; got %', p_months_ahead;
  END IF;

  FOR i IN 0 .. p_months_ahead LOOP
    v_result := core.ensure_outbox_partition_for((current_date + (i || ' months')::interval)::date);
    RETURN NEXT v_result;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION core.ensure_outbox_partitions_ahead(int) IS
  'Phase 6 Step 41 — ensures partitions exist for the current month plus the next p_months_ahead months. Default 3 means the buffer never dips below 3 months. Called by the outbox-partition-provisioner cron.';

REVOKE EXECUTE ON FUNCTION core.ensure_outbox_partitions_ahead(int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION core.ensure_outbox_partitions_ahead(int) TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Monthly cron schedule
-- ══════════════════════════════════════════════════════════════════════

-- 02:00 UTC on the 1st of each month. cron.schedule is idempotent on
-- jobname (re-running this migration updates the existing entry).
SELECT cron.schedule(
  'outbox-partition-provisioner',
  '0 2 1 * *',
  $cron$ SELECT core.ensure_outbox_partitions_ahead(3); $cron$
);
