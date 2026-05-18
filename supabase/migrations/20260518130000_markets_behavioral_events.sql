-- markets.behavioral_events — backing store for the retail behavioral layer.
--
-- Records loss-aversion alert acknowledgements, cooling-off interactions,
-- and education-card "seen" flags. Surfaced via /v1/retail/behavioral/*.

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
      ON markets.behavioral_events
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- Hot path: latest unacknowledged event per user
CREATE INDEX IF NOT EXISTS idx_behavioral_events_user_unacked
  ON markets.behavioral_events (user_id, created_at DESC)
  WHERE acknowledged_at IS NULL;

-- education_shown dedup: one row per user per education_id
CREATE INDEX IF NOT EXISTS idx_behavioral_events_education
  ON markets.behavioral_events (user_id, (metadata->>'education_id'))
  WHERE event_type = 'education_shown';
