-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516011400; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- Add plain UNIQUE(symbol, exchange) so PostgREST onConflict works for MF/equity upserts.
-- The existing instruments_unique_contract_idx (with COALESCE) covers F&O; this covers
-- equity, ETF, MF, index, and any instrument where expiry/strike are NULL.
ALTER TABLE markets.instruments
  ADD CONSTRAINT instruments_symbol_exchange_key UNIQUE (symbol, exchange);
