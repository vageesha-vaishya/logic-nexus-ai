-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260518163219; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

CREATE TABLE IF NOT EXISTS markets.behavioral_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type      text NOT NULL CHECK (event_type IN (
    'yellow_alert', 'orange_alert', 'red_alert', 'cooling_off',
    'education_shown', 'panic_sell_intercepted', 'cooling_off_waited'
  )),
  severity        text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE markets.behavioral_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'markets' AND tablename = 'behavioral_events'
      AND policyname = 'Users manage own behavioral events'
  ) THEN
    CREATE POLICY "Users manage own behavioral events"
      ON markets.behavioral_events FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS idx_behavioral_events_user_unacked
  ON markets.behavioral_events (user_id, created_at DESC)
  WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_behavioral_events_education
  ON markets.behavioral_events (user_id, (metadata->>'education_id'))
  WHERE event_type = 'education_shown';