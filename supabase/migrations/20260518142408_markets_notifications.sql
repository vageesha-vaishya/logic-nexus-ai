-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260518142408; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- markets.notifications — unified in-app notification feed.
--
-- In-app only. Delivered via Supabase Realtime to a logged-in frontend.
-- Backgrounded mobile system push requires FCM/APNs and is deferred.

CREATE TABLE IF NOT EXISTS markets.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      text NOT NULL
                CHECK (category IN ('alert', 'order_fill', 'sip', 'risk', 'rebalance', 'system')),
  severity      text NOT NULL DEFAULT 'info'
                CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  title         text NOT NULL,
  body          text NOT NULL,
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  link_url      text,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON markets.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_user_recent_idx
  ON markets.notifications (user_id, created_at DESC);

ALTER TABLE markets.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'markets' AND tablename = 'notifications'
      AND policyname = 'users read own notifications'
  ) THEN
    CREATE POLICY "users read own notifications"
      ON markets.notifications
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'markets' AND tablename = 'notifications'
      AND policyname = 'users update own notifications'
  ) THEN
    CREATE POLICY "users update own notifications"
      ON markets.notifications
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'markets' AND tablename = 'notifications'
      AND policyname = 'users delete own notifications'
  ) THEN
    CREATE POLICY "users delete own notifications"
      ON markets.notifications
      FOR DELETE
      USING (user_id = auth.uid());
  END IF;
END$$;

ALTER TABLE markets.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'markets'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE markets.notifications';
  END IF;
END$$;