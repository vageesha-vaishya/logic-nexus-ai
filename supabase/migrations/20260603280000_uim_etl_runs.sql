-- Phase 7 UIM Step 4b.14 follow-up — DB-backed ETL scheduler runs.
--
-- The 4b.14 in-memory queue did not survive process restarts. This
-- migration adds uim.etl_runs as the persistence target; the
-- service-side adapter (services/uim-api/src/services/etl-persistence.ts)
-- upserts every run save into this table and loads on startup.
--
-- Column types mirror the in-memory UimEtlRun shape verbatim — text
-- for timestamps so we preserve the legacy ISO-string contract,
-- bigint for next_attempt_at (epoch ms) + duration_ms + records_*
-- to match the in-memory Number() coercions.

SET search_path = public;

BEGIN;

CREATE TABLE IF NOT EXISTS uim.etl_runs (
  run_id              text        PRIMARY KEY,
  tenant_id           uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id        uuid,
  source              text        NOT NULL,
  window_start        text        NOT NULL,
  window_end          text        NOT NULL,
  trigger             text        NOT NULL CHECK (trigger IN ('manual','scheduled')),
  status              text        NOT NULL DEFAULT 'queued'
                                  CHECK (status IN ('queued','running','completed','retry_scheduled','failed')),
  attempts            int         NOT NULL DEFAULT 0,
  max_attempts        int         NOT NULL DEFAULT 4,
  next_attempt_at     bigint      NOT NULL,
  queued_at           text        NOT NULL,
  started_at          text,
  completed_at        text,
  duration_ms         bigint,
  records_extracted   bigint,
  records_transformed bigint,
  records_loaded      bigint,
  last_error          text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE uim.etl_runs IS
  'Phase 7 UIM Step 4b.14 follow-up: persistence for the ETL scheduler in-memory queue. Service code uses the same UimEtlRun shape; columns mirror the in-memory record 1:1 so the adapter is a thin upsert.';

CREATE INDEX IF NOT EXISTS idx_uim_etl_runs_tenant
  ON uim.etl_runs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_uim_etl_runs_status_next
  ON uim.etl_runs (status, next_attempt_at)
  WHERE status IN ('queued','retry_scheduled');

CREATE INDEX IF NOT EXISTS idx_uim_etl_runs_queued_at
  ON uim.etl_runs (queued_at DESC);

ALTER TABLE uim.etl_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY uim_etl_runs_tenant_read ON uim.etl_runs
  FOR SELECT USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE OR REPLACE FUNCTION uim.tg_touch_etl_runs()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS uim_etl_runs_touch ON uim.etl_runs;
CREATE TRIGGER uim_etl_runs_touch
  BEFORE UPDATE ON uim.etl_runs
  FOR EACH ROW
  EXECUTE FUNCTION uim.tg_touch_etl_runs();

COMMIT;
