-- Phase 1 Addendum T19 — Portfolio Health Diagnostic.
--
-- One LLM-interpreted diagnostic per user per day. The payload is
-- structured JSON (headline / findings / suggested_actions) that the
-- frontend renders as a card on the Home tab. Re-runs in the same day
-- are idempotent: we upsert on (user_id, generated_on) so a refresh
-- never bills the user twice or duplicates the row.

CREATE TABLE IF NOT EXISTS markets.portfolio_diagnostics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  generated_on  date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  payload       jsonb NOT NULL,
  source        text NOT NULL DEFAULT 'llm'
                CHECK (source IN ('llm', 'fallback', 'error')),
  llm_provider  text,
  llm_model     text,
  input_tokens  integer,
  output_tokens integer,
  cost_usd      numeric(10, 6),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS portfolio_diagnostics_user_day_uidx
  ON markets.portfolio_diagnostics (user_id, generated_on);

CREATE INDEX IF NOT EXISTS portfolio_diagnostics_user_time_idx
  ON markets.portfolio_diagnostics (user_id, generated_at DESC);

ALTER TABLE markets.portfolio_diagnostics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'markets' AND tablename = 'portfolio_diagnostics'
      AND policyname = 'Users read own diagnostics'
  ) THEN
    CREATE POLICY "Users read own diagnostics"
      ON markets.portfolio_diagnostics
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END$$;
