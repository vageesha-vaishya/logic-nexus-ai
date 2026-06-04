-- Directive Applicability S3 — eval jobs queue table.
-- Per docs/plans/2026-06-04-directive-applicability-surface-design.md slice S3.
--
-- Replaces the deferred BullMQ batch worker with a setInterval
-- polling worker that reads from this table. Same shape as the
-- existing Phase 8d core.outbox poller pattern in services/amro-api.
--
-- Rationale: amro-api doesn't have BullMQ wired up (no Redis dep),
-- but does have setInterval polling for the outbox. Reusing that
-- pattern avoids a new infra dep + Redis runtime.

CREATE TABLE IF NOT EXISTS amro.applicability_eval_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  franchise_id    uuid,

  -- Job scope: ONE of these two patterns
  --   directive_id only → fan-out vs all active aircraft in tenant
  --   aircraft_id only  → fan-out vs all active directives in tenant
  --   both present       → one-shot pair (same as POST /check, but async)
  directive_id    uuid REFERENCES public.directives(id),
  aircraft_id     uuid REFERENCES public.aircraft(id),

  -- Trigger metadata
  trigger_kind    text NOT NULL CHECK (trigger_kind IN (
    'directive_published',
    'aircraft_entered_service',
    'manual_batch',
    'periodic_rerun'
  )),
  requested_by    uuid REFERENCES auth.users(id),
  requested_at    timestamptz NOT NULL DEFAULT now(),

  -- Lifecycle
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'cancelled'
  )),
  claimed_at      timestamptz,
  claimed_by      text,  -- worker instance id (env hostname)
  started_at      timestamptz,
  completed_at    timestamptz,
  attempts        int NOT NULL DEFAULT 0,
  max_attempts    int NOT NULL DEFAULT 3,
  last_error      text,

  -- Result summary (populated on completion)
  verdicts_created int,
  verdicts_failed  int,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT scope_at_least_one CHECK (
    directive_id IS NOT NULL OR aircraft_id IS NOT NULL
  )
);

COMMENT ON TABLE amro.applicability_eval_jobs IS
  'Queue table for asynchronous directive × aircraft applicability '
  'evaluation. Drained by services/amro-api/workers/applicability-worker. '
  'See docs/plans/2026-06-04-directive-applicability-surface-design.md.';

COMMENT ON COLUMN amro.applicability_eval_jobs.trigger_kind IS
  'directive_published: emitted when a new directive is added/revised. '
  'aircraft_entered_service: emitted when a new aircraft is added. '
  'manual_batch: operator-triggered ad-hoc batch (e.g. from the '
  '/queue-fleet REST endpoint). periodic_rerun: cron-driven re-eval '
  'for drift detection.';

-- ── Indexes ─────────────────────────────────────────────────────────

-- Worker claim query: pending jobs FOR UPDATE SKIP LOCKED
CREATE INDEX IF NOT EXISTS idx_app_eval_jobs_pending_oldest
  ON amro.applicability_eval_jobs (status, requested_at)
  WHERE status = 'pending';

-- Stuck-job recovery: in_progress past a deadline
CREATE INDEX IF NOT EXISTS idx_app_eval_jobs_stuck
  ON amro.applicability_eval_jobs (status, claimed_at)
  WHERE status = 'in_progress';

-- Operator queue view by tenant
CREATE INDEX IF NOT EXISTS idx_app_eval_jobs_tenant_recent
  ON amro.applicability_eval_jobs (tenant_id, requested_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────

ALTER TABLE amro.applicability_eval_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_eval_jobs_tenant_isolation
  ON amro.applicability_eval_jobs FOR ALL
  USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY app_eval_jobs_service_bypass
  ON amro.applicability_eval_jobs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON amro.applicability_eval_jobs TO authenticated;
GRANT ALL ON amro.applicability_eval_jobs TO service_role;

-- updated_at trigger
CREATE OR REPLACE FUNCTION amro.tg_app_eval_jobs_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS app_eval_jobs_set_updated_at
  ON amro.applicability_eval_jobs;
CREATE TRIGGER app_eval_jobs_set_updated_at
  BEFORE UPDATE ON amro.applicability_eval_jobs
  FOR EACH ROW EXECUTE FUNCTION amro.tg_app_eval_jobs_set_updated_at();

-- ── Atomic claim helper ─────────────────────────────────────────────
-- Claims up to p_limit pending jobs for a worker. Atomic via UPDATE
-- ... FROM (SELECT ... FOR UPDATE SKIP LOCKED). Returns the claimed rows
-- so the worker can process them in this single transaction round-trip.

CREATE OR REPLACE FUNCTION amro.claim_applicability_eval_jobs(
  p_worker_id text,
  p_limit     int DEFAULT 5
)
RETURNS SETOF amro.applicability_eval_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, amro AS $$
BEGIN
  RETURN QUERY
  UPDATE amro.applicability_eval_jobs
     SET status     = 'in_progress',
         claimed_at = now(),
         claimed_by = p_worker_id,
         started_at = now(),
         attempts   = attempts + 1
   WHERE id IN (
     SELECT j.id
       FROM amro.applicability_eval_jobs j
      WHERE j.status = 'pending'
        AND j.attempts < j.max_attempts
      ORDER BY j.requested_at
      LIMIT p_limit
      FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
END $$;

COMMENT ON FUNCTION amro.claim_applicability_eval_jobs IS
  'Atomic claim of up to p_limit pending jobs. Uses FOR UPDATE SKIP '
  'LOCKED so multiple worker instances can run concurrently without '
  'collision. Increments attempts so failed jobs retried up to '
  'max_attempts.';

GRANT EXECUTE ON FUNCTION amro.claim_applicability_eval_jobs(text, int)
  TO service_role;

-- ── Stuck-job recovery helper ───────────────────────────────────────
-- Resets in_progress jobs older than the deadline back to 'pending'.
-- Called occasionally by the worker to recover from crashed instances.

CREATE OR REPLACE FUNCTION amro.recover_stuck_applicability_eval_jobs(
  p_deadline_minutes int DEFAULT 15
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, amro AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE amro.applicability_eval_jobs
     SET status     = 'pending',
         claimed_at = NULL,
         claimed_by = NULL,
         started_at = NULL,
         last_error = 'Reset from in_progress after deadline timeout'
   WHERE status = 'in_progress'
     AND claimed_at < now() - (p_deadline_minutes || ' minutes')::interval;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

COMMENT ON FUNCTION amro.recover_stuck_applicability_eval_jobs IS
  'Reset stuck in_progress jobs back to pending. Defends against '
  'worker crashes / SIGKILL where the worker never marked the job '
  'completed or failed. Worker calls this every N ticks.';

GRANT EXECUTE ON FUNCTION amro.recover_stuck_applicability_eval_jobs(int)
  TO service_role;
