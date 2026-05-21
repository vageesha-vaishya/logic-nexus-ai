-- Post-launch hardening from docs/security/2026-05-21-rls-audit.md.
-- Fixes the three real findings + the two cosmetic-duplicate findings.
-- Idempotent via DROP POLICY IF EXISTS + CREATE POLICY.

-- ─── Finding #1 — ai_briefs INSERT had WITH CHECK true ───────────────────
-- Anyone authenticated could insert briefs claiming any owner_user_id.
-- Pollution risk, not leak risk (SELECT correctly scopes). Restrict to
-- service role; if a UI path needs to insert briefs in future, add an
-- explicit owner_user_id = auth.uid() policy.
DROP POLICY IF EXISTS "service role inserts briefs"  ON markets.ai_briefs;
DROP POLICY IF EXISTS ai_briefs_service_insert       ON markets.ai_briefs;
CREATE POLICY ai_briefs_service_insert
  ON markets.ai_briefs
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

-- ─── Finding #2 — signals_macro_context INSERT had WITH CHECK true ───────
-- Same pattern, same fix.
DROP POLICY IF EXISTS "service insert macro context"        ON markets.signals_macro_context;
DROP POLICY IF EXISTS signals_macro_context_service_insert  ON markets.signals_macro_context;
CREATE POLICY signals_macro_context_service_insert
  ON markets.signals_macro_context
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

-- ─── Finding #3 — signals_macro_context SELECT referenced missing col ────
-- Original policy ran `tenant_id = (SELECT tenant_id FROM auth.users
-- WHERE users.id = auth.uid())`. `auth.users.tenant_id` does not exist
-- on prod — verified via information_schema. The first branch errors;
-- only `tenant_id IS NULL` rows are visible. Rewrite to scope via the
-- existing public.user_roles join.
DROP POLICY IF EXISTS "tenant read macro context"             ON markets.signals_macro_context;
DROP POLICY IF EXISTS signals_macro_context_tenant_read       ON markets.signals_macro_context;
CREATE POLICY signals_macro_context_tenant_read
  ON markets.signals_macro_context
  FOR SELECT
  TO public
  USING (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id  = auth.uid()
        AND ur.tenant_id = signals_macro_context.tenant_id
    )
  );

-- ─── Finding #4 — markets.holdings had 8 policies in 2 redundant sets ────
-- Keep the `_owner_*` set (TO authenticated, uses SELECT-subquery form
-- of auth.uid() which is evaluated once per query). Drop the `_own` set
-- (TO public, no role grant — equivalent semantics but slower
-- per-row eval and confusing maintenance trap).
DROP POLICY IF EXISTS holdings_select_own  ON markets.holdings;
DROP POLICY IF EXISTS holdings_insert_own  ON markets.holdings;
DROP POLICY IF EXISTS holdings_update_own  ON markets.holdings;
DROP POLICY IF EXISTS holdings_delete_own  ON markets.holdings;

-- ─── Finding #5 — markets.push_tokens had 2 identical ALL policies ───────
-- Keep "Users manage own push tokens" (TO authenticated, has WITH CHECK).
-- Drop "users own push tokens" (TO public, no WITH CHECK).
DROP POLICY IF EXISTS "users own push tokens"  ON markets.push_tokens;
