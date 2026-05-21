-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515094014; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Unique index on raw_url enables ON CONFLICT DO NOTHING in markets-ingest-news.
-- This replaces the previous "IN (long list)" dedupe query that blew past the
-- PostgREST URL-length limit once we started ingesting feeds with longer URLs
-- (Economic Times article URLs run ~150 chars; 50 items × 4 feeds = ~30 KB).
CREATE UNIQUE INDEX IF NOT EXISTS news_events_raw_url_uidx
  ON markets.news_events (raw_url)
  WHERE raw_url IS NOT NULL;