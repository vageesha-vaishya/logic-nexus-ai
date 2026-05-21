-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517171931; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- Enable RLS on historical price_history partitions
-- Policy: authenticated users can SELECT (read-only public market data)
-- No INSERT/UPDATE/DELETE — only the service role (via worker) writes price data

ALTER TABLE markets.price_history_y2024 ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.price_history_y2023 ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.price_history_y2022 ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.price_history_y2021 ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.price_history_y2020 ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_history_y2024_select ON markets.price_history_y2024
  FOR SELECT USING (true);

CREATE POLICY price_history_y2023_select ON markets.price_history_y2023
  FOR SELECT USING (true);

CREATE POLICY price_history_y2022_select ON markets.price_history_y2022
  FOR SELECT USING (true);

CREATE POLICY price_history_y2021_select ON markets.price_history_y2021
  FOR SELECT USING (true);

CREATE POLICY price_history_y2020_select ON markets.price_history_y2020
  FOR SELECT USING (true);
