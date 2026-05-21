-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517113338; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Fix 1: Add unique constraint so signal upserts work correctly
CREATE UNIQUE INDEX IF NOT EXISTS uq_signals_instrument_strategy
  ON markets.signals (instrument_id, strategy_id);

-- Fix 2: Enable REPLICA IDENTITY FULL on price_alerts so Supabase Realtime
-- row-level filters work (required for status=eq.triggered filter)
ALTER TABLE markets.price_alerts REPLICA IDENTITY FULL;