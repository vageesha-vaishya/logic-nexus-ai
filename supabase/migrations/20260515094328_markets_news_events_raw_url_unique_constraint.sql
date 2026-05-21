-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515094328; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- The partial unique index can't be used as an ON CONFLICT target by supabase-js
-- (which doesn't expose the `index_predicate` clause). Swap it for a regular
-- unique constraint — multiple NULL raw_url rows are still allowed under SQL's
-- "NULL ≠ NULL" rule for unique constraints, so behavior is identical for our
-- ingest dedupe path.

DROP INDEX IF EXISTS markets.news_events_raw_url_uidx;

ALTER TABLE markets.news_events
  ADD CONSTRAINT news_events_raw_url_uniq UNIQUE (raw_url);