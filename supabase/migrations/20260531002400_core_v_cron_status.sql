-- Phase 6 Step 49 — core.v_cron_status observability view.
--
-- One query answers "is my scheduled job firing? when did it last
-- run? did it succeed?". Built atop pg_cron's cron.job +
-- cron.job_run_details. The latter is per-run history; this view
-- LATERAL-picks the latest row per job and adds the schedule from
-- cron.job so the answer is self-contained.
--
-- Columns chosen for at-a-glance ops:
--   jobid, jobname, schedule  — what's scheduled
--   active                    — is the job enabled?
--   last_run_at               — start_time of the latest run
--   last_status               — 'succeeded' | 'failed' | NULL (never)
--   last_duration_ms          — end_time - start_time
--   last_return_message       — truncated to 200 chars (full text
--                                lives in cron.job_run_details for
--                                deeper drill-down)
--
-- A job that has NEVER run shows last_run_at IS NULL — the LEFT
-- JOIN preserves the row from cron.job. The 2 cron jobs we just
-- shipped (outbox-partition-provisioner: monthly, comms-
-- suppression-gc: daily) will both show NULL until their first
-- fire — June 1 at 02:00 UTC and tomorrow at 03:30 UTC respectively.
--
-- Lock down: pg_cron's catalog tables are privileged. GRANT this
-- view only to service_role so unprivileged sessions can't enumerate
-- the cron landscape. Authenticated users go through ops UIs that
-- already gate on role.

CREATE OR REPLACE VIEW core.v_cron_status AS
SELECT
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  latest.start_time          AS last_run_at,
  latest.status              AS last_status,
  CASE
    WHEN latest.end_time IS NOT NULL AND latest.start_time IS NOT NULL
      THEN (EXTRACT(EPOCH FROM (latest.end_time - latest.start_time)) * 1000)::integer
    ELSE NULL
  END                        AS last_duration_ms,
  LEFT(latest.return_message, 200) AS last_return_message_preview,
  j.command
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT r.start_time, r.end_time, r.status, r.return_message
  FROM cron.job_run_details r
  WHERE r.jobid = j.jobid
  ORDER BY r.start_time DESC NULLS LAST
  LIMIT 1
) latest ON true;

COMMENT ON VIEW core.v_cron_status IS
  'Phase 6 Step 49 — at-a-glance cron job status. LATERAL-picks the latest cron.job_run_details row per cron.job. Service-role only (cron catalog is privileged). Use for "did my partition-provisioner / suppression-GC actually fire?" ops queries.';

REVOKE ALL ON core.v_cron_status FROM PUBLIC;
GRANT  SELECT ON core.v_cron_status TO service_role;
