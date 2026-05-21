-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516065034; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- Add historical year partitions needed for 2-year OHLCV backfill
CREATE TABLE IF NOT EXISTS markets.price_history_y2024
  PARTITION OF markets.price_history
  FOR VALUES FROM ('2024-01-01 00:00:00+00') TO ('2025-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS markets.price_history_y2023
  PARTITION OF markets.price_history
  FOR VALUES FROM ('2023-01-01 00:00:00+00') TO ('2024-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS markets.price_history_y2022
  PARTITION OF markets.price_history
  FOR VALUES FROM ('2022-01-01 00:00:00+00') TO ('2023-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS markets.price_history_y2021
  PARTITION OF markets.price_history
  FOR VALUES FROM ('2021-01-01 00:00:00+00') TO ('2022-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS markets.price_history_y2020
  PARTITION OF markets.price_history
  FOR VALUES FROM ('2020-01-01 00:00:00+00') TO ('2021-01-01 00:00:00+00');
