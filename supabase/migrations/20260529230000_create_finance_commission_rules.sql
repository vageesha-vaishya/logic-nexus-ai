-- Phase 5 — per-tenant commission rules + resolver.
--
-- Replaces the hardcoded 5% in the cross-module consumer with a
-- table-driven configuration. Each tenant can define multiple rules
-- scoped by (owner, account, time window). The resolver picks the
-- best-matching active rule for a given commission computation; if no
-- rule matches, the consumer falls back to the env default
-- (FINANCE_COMMISSION_RATE_PERCENT, also 5%).
--
-- Specificity ordering: rules with both scopes match > rules with one
-- scope match > pure-wildcard. Ties broken by priority ASC (lower wins)
-- then by effective_from DESC (newest wins).

CREATE TABLE finance.commission_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  name            text NOT NULL,
  rate_percent    numeric(5,2) NOT NULL CHECK (rate_percent >= 0 AND rate_percent <= 100),
  -- Scoping (NULL = wildcard "applies to everything")
  account_id      uuid,
  owner_id        uuid,
  -- Time validity
  effective_from  timestamptz NOT NULL DEFAULT now(),
  effective_to    timestamptz,
  -- Priority: lower = higher priority. Used as the first tiebreaker.
  priority        integer NOT NULL DEFAULT 100,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

COMMENT ON TABLE finance.commission_rules IS
  'Phase 5 — per-tenant configurable commission rates. The cross-module consumer calls finance.resolve_commission_rate() to look up the best-matching active rule.';

CREATE INDEX commission_rules_tenant_active_idx
  ON finance.commission_rules (tenant_id, effective_from DESC)
  WHERE status = 'active';
CREATE INDEX commission_rules_owner_idx
  ON finance.commission_rules (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX commission_rules_account_idx
  ON finance.commission_rules (account_id) WHERE account_id IS NOT NULL;

ALTER TABLE finance.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY commission_rules_tenant_select ON finance.commission_rules
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY commission_rules_tenant_insert ON finance.commission_rules
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY commission_rules_tenant_update ON finance.commission_rules
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())))
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY commission_rules_tenant_delete ON finance.commission_rules
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_commission_rules_updated_at
  BEFORE UPDATE ON finance.commission_rules
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON finance.commission_rules TO authenticated;
GRANT ALL ON finance.commission_rules TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- Resolver
-- ══════════════════════════════════════════════════════════════════════
--
-- Returns the best-matching active rule's rate_percent, or NULL if no
-- rule matches. NULL signals the consumer to use its env-default.
--
-- The ORDER BY combines specificity (more scope matches first) with
-- priority and recency. SECURITY DEFINER so service_role can call it
-- without inheriting the caller's RLS scope — the resolver is meant
-- to be called from the consumer with a known tenant context.

CREATE OR REPLACE FUNCTION finance.resolve_commission_rate(
  p_tenant_id     uuid,
  p_owner_id      uuid,
  p_account_id    uuid,
  p_occurred_at   timestamptz DEFAULT now()
) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = finance, pg_catalog AS $$
  SELECT rate_percent
  FROM finance.commission_rules
  WHERE tenant_id = p_tenant_id
    AND status = 'active'
    AND effective_from <= p_occurred_at
    AND (effective_to IS NULL OR effective_to > p_occurred_at)
    AND (owner_id IS NULL OR owner_id = p_owner_id)
    AND (account_id IS NULL OR account_id = p_account_id)
  ORDER BY
    -- Specificity: more NOT-NULL scope columns = more specific
    (CASE WHEN owner_id   IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN account_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
    priority ASC,
    effective_from DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION finance.resolve_commission_rate IS
  'Phase 5 commission-rule resolver. Returns the best-matching active rule rate, or NULL if none matches (consumer then falls back to its env default).';

GRANT EXECUTE ON FUNCTION finance.resolve_commission_rate TO authenticated;
GRANT EXECUTE ON FUNCTION finance.resolve_commission_rate TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- Track which rule produced each commission (back-link)
-- ══════════════════════════════════════════════════════════════════════
--
-- Lets a future "explain this commission" UI show "computed from rule
-- <name>". NULL = the consumer used its env-default (no rule matched).

ALTER TABLE finance.commissions
  ADD COLUMN IF NOT EXISTS commission_rule_id uuid REFERENCES finance.commission_rules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS finance_commissions_rule_idx
  ON finance.commissions (commission_rule_id) WHERE commission_rule_id IS NOT NULL;
