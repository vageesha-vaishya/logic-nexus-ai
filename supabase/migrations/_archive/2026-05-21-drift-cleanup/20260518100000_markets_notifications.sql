-- markets.notifications — unified in-app notification feed.
--
-- Scope: in-app only. Delivered via Supabase Realtime to a logged-in frontend.
-- Does NOT deliver system push to backgrounded mobile apps — that requires
-- FCM (Android) or APNs (iOS) and is intentionally deferred. When/if FCM is
-- added, a separate delivery worker can consume rows from this table and
-- fan out to device tokens; the table itself remains the source of truth.

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

CREATE POLICY "users read own notifications"
  ON markets.notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users update own notifications"
  ON markets.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own notifications"
  ON markets.notifications
  FOR DELETE
  USING (user_id = auth.uid());

-- Inserts are performed by the worker using the service role, which bypasses
-- RLS. No INSERT policy is needed for end users; we deliberately prevent
-- client-side notification creation.

-- Realtime: emit full row payloads so the frontend can render without a
-- follow-up fetch.
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
