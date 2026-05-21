-- App-wide status banner for the Sthira retail surface. Operator inserts
-- a row (or sets is_active=true on an existing one) to push "worker
-- maintenance 8–10pm IST" / "trading paused" / "Zerodha login refresh
-- required" etc. to every connected user without a rebuild.
--
-- Read by useAppStatusBanner() hook (5-min staleTime), rendered above
-- OfflineBanner in RetailNavLayout. Closed-beta dealbreaker #27.

CREATE TABLE IF NOT EXISTS markets.app_status_banners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message     text NOT NULL,
  severity    text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  starts_at   timestamptz NOT NULL DEFAULT now(),
  ends_at     timestamptz,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid -- nullable for operator inserts via Studio
);

COMMENT ON TABLE markets.app_status_banners IS
  'Operator-driven status banners shown across the retail surface. ends_at NULL means "until manually deactivated".';

CREATE INDEX IF NOT EXISTS app_status_banners_active_window_idx
  ON markets.app_status_banners (starts_at DESC)
  WHERE is_active = true;

ALTER TABLE markets.app_status_banners ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read; writes are operator-only via service
-- role (Supabase Studio uses service role; no public write path needed).
CREATE POLICY "app_status_banners_authenticated_read"
  ON markets.app_status_banners
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "app_status_banners_service_write"
  ON markets.app_status_banners
  FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
