-- Phase 6 Step 10 — comms.deliveries retry state.
--
-- The delivery-worker transitions failed sends to status='failed' with
-- a single attempt. Add retry bookkeeping so transient failures get a
-- second chance with exponential backoff, capped to avoid hammering
-- providers on permanent errors.
--
-- Columns:
--   attempt_count   int        how many provider invocations so far
--   next_retry_at   timestamptz when the worker may pick the row up again
--   max_attempts    int        per-row cap (default 5)
--
-- Worker semantics (delivery-worker.ts updated alongside):
--   * Pending pickup: status='pending' AND (next_retry_at IS NULL OR
--                     next_retry_at <= now())
--   * Transient fail: status='pending', attempt_count++,
--                     next_retry_at = now() + backoff(attempt_count)
--   * Permanent fail: status='failed' (attempts exhausted OR explicit
--                     unrecoverable error like 400-bad-request)
--   * Backoff: 30s, 2m, 8m, 30m, 2h — base 4, ceiling capped at 2h
--
-- Hard bounces / complaints / suppressions never enter retry: those go
-- straight to status=failed|suppressed at first attempt.

ALTER TABLE comms.deliveries ADD COLUMN IF NOT EXISTS attempt_count int NOT NULL DEFAULT 0;
ALTER TABLE comms.deliveries ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NOT NULL DEFAULT '-infinity'::timestamptz;
ALTER TABLE comms.deliveries ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 5;

-- '-infinity' sentinel for "ready immediately" — keeps the pickup query
-- to a single inequality rather than (is.null OR <=). PostgREST's .or()
-- with is.null + timestamp literals is brittle; this sidesteps it.

-- Partial index so the worker's pickup query is O(log retry_pending) rather than O(deliveries).
CREATE INDEX IF NOT EXISTS comms_deliveries_retry_ready_idx
  ON comms.deliveries (channel_kind, next_retry_at, created_at)
  WHERE status = 'pending';

COMMENT ON COLUMN comms.deliveries.attempt_count IS
  'Phase 6 Step 10 — provider invocations so far. Increments on every transient failure.';
COMMENT ON COLUMN comms.deliveries.next_retry_at IS
  'Phase 6 Step 10 — earliest time the worker may retry. NULL = ready immediately.';
COMMENT ON COLUMN comms.deliveries.max_attempts IS
  'Phase 6 Step 10 — per-row attempt cap; row moves to status=failed when reached.';
