-- Phase 5 — finance.commissions table for the sales.opportunity.won
-- → finance.commission.computed chain. New canonical table; no public.*
-- source to mirror.
--
-- Each commission row anchors back to the outbox event that produced
-- it via source_outbox_id (UNIQUE constraint). Consumers re-running on
-- the same outbox row do an INSERT ... ON CONFLICT (source_outbox_id)
-- DO NOTHING — idempotent without external locking.
--
-- Commission rate: hardcoded 5% for now. A future slice exposes a
-- finance.commission_rules table for per-tenant / per-product /
-- per-tier rates.

CREATE TABLE finance.commissions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  -- Source opportunity. No FK because public.opportunities is the
  -- canonical source today but sales.opportunities is the future
  -- canonical; either could win. Consumer-side joins still work via
  -- the id alone.
  opportunity_id    uuid NOT NULL,
  account_id        uuid,
  -- The salesperson who earned the commission (opportunity.owner_id
  -- at win time).
  owner_id          uuid,
  -- Financial fields. amount_base is the opportunity value the commission
  -- was computed against; amount is the commission itself; rate_percent
  -- is the rate applied (e.g., 5.00 for 5%).
  amount_base       numeric(14,2),
  rate_percent      numeric(5,2) NOT NULL DEFAULT 5.00,
  amount            numeric(14,2) NOT NULL,
  currency          text NOT NULL DEFAULT 'INR',
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
  computed_at       timestamptz NOT NULL DEFAULT now(),
  -- Idempotency anchor: the core.outbox.id that produced this row.
  -- UNIQUE so re-processing the same event can't double-create.
  source_outbox_id  uuid UNIQUE,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE finance.commissions IS
  'Phase 5 cross-module chain — sales.opportunity.won → finance.commission.computed. source_outbox_id anchors idempotency.';

CREATE INDEX finance_commissions_tenant_status_idx ON finance.commissions (tenant_id, status, computed_at DESC);
CREATE INDEX finance_commissions_owner_idx         ON finance.commissions (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX finance_commissions_opportunity_idx   ON finance.commissions (opportunity_id);

ALTER TABLE finance.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_commissions_tenant_select ON finance.commissions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_finance_commissions_updated_at
  BEFORE UPDATE ON finance.commissions
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON finance.commissions TO authenticated;
GRANT ALL    ON finance.commissions TO service_role;
