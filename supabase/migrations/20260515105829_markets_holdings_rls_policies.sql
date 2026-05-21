-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515105829; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- markets.holdings was missing RLS policies — JWT clients got 0 rows.
-- Add standard owner-scoped policies matching the pattern used by
-- markets.portfolios and markets.watchlists.

CREATE POLICY "holdings_select_own"
  ON markets.holdings
  FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "holdings_insert_own"
  ON markets.holdings
  FOR INSERT
  WITH CHECK (
    owner_user_id = auth.uid()
  );

CREATE POLICY "holdings_update_own"
  ON markets.holdings
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "holdings_delete_own"
  ON markets.holdings
  FOR DELETE
  USING (owner_user_id = auth.uid());