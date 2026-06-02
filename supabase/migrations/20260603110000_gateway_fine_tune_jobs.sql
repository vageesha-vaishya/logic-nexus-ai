-- LLM Gateway §9.1 — fine-tuning job storage.
-- Per design §9.1. Storage + lifecycle status only; provider submission
-- (OpenAI's /fine_tuning/jobs API + Anthropic's training endpoint when
-- they ship one) is a follow-up slice — adapters need API keys with
-- training quota, and we want to ship the contract independent of that.

CREATE TABLE gateway.fine_tune_jobs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL,
  provider_kind            text NOT NULL CHECK (provider_kind IN
                             ('anthropic','openai','google_gemini','mistral')),
  base_model_id            text NOT NULL,
  fine_tuned_model_id      text,                           -- set when training completes
  provider_job_id          text,                           -- vendor's training job id
  dataset_url              text,                            -- gs:// / s3:// / signed-supabase url
  dataset_format           text CHECK (dataset_format IS NULL OR dataset_format IN ('jsonl','parquet','csv')),
  hyperparameters          jsonb NOT NULL DEFAULT '{}'::jsonb,
                           -- { n_epochs, batch_size, learning_rate_multiplier, suffix?, ... }
  status                   text NOT NULL DEFAULT 'queued'
                             CHECK (status IN
                               ('queued','preparing','training','succeeded','failed','cancelled')),
  status_message           text,                            -- failure reason / progress note
  result_metrics           jsonb NOT NULL DEFAULT '{}'::jsonb,
                           -- vendor-returned eval metrics (loss, accuracy, etc.)
  created_by_user_id       uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  started_at               timestamptz,
  finished_at              timestamptz,
  cancelled_at             timestamptz,
  cancel_reason            text
);
CREATE INDEX fine_tune_jobs_tenant_idx ON gateway.fine_tune_jobs (tenant_id, created_at DESC);
CREATE INDEX fine_tune_jobs_status_idx ON gateway.fine_tune_jobs (status, created_at DESC);
CREATE INDEX fine_tune_jobs_provider_idx
  ON gateway.fine_tune_jobs (provider_kind, provider_job_id) WHERE provider_job_id IS NOT NULL;

ALTER TABLE gateway.fine_tune_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON gateway.fine_tune_jobs TO service_role;

CREATE TRIGGER trg_gw_ftj_updated_at BEFORE UPDATE ON gateway.fine_tune_jobs
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

CREATE POLICY fine_tune_jobs_tenant_select ON gateway.fine_tune_jobs FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
