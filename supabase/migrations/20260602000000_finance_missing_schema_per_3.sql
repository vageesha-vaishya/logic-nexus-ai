-- Phase 6 Slice A — finance schema gap-fill per finance.md §3.
--
-- Adds the 13 tables called out as missing in the 2026-06-01 audit
-- but specified in finance.md §3 (credit_notes/refunds/amendments,
-- payment_allocations + webhook_events, tax exemption + calculations,
-- pricing-tier configs + ranges + margin_rules, periods, dunning).
--
-- Out of scope this slice (separate work):
--   - finance.invoices column realignment (customer_id → customer_party_id;
--     add finalized_at + finalized_by_user_id) — that's a Phase 2/4-style
--     dual-write+backfill slice
--   - RLS UPDATE-after-finalize policy from §4 (depends on finalized_at)
--   - Razorpay webhook handler (services/finance-api; separate slice)
--
-- All tables tenant-scoped. RLS tenant_select for authenticated;
-- service_role full. Indexes on FK + common query paths.

-- ══════════════════════════════════════════════════════════════════════
-- 1. finance.periods (GL period closes)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.periods (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  name         text NOT NULL,                              -- e.g. '2026-Q1' or '2026-05'
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','closing','closed')),
  closed_at    timestamptz,
  closed_by_user_id uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name),
  CONSTRAINT periods_range_sane CHECK (start_date <= end_date)
);
CREATE INDEX periods_tenant_dates_idx ON finance.periods (tenant_id, end_date DESC);
ALTER TABLE finance.periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY periods_tenant_select ON finance.periods FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_finance_periods_updated_at BEFORE UPDATE ON finance.periods
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON finance.periods TO authenticated;
GRANT ALL    ON finance.periods TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. finance.invoice_amendments (post-finalize correction trail)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.invoice_amendments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  invoice_id      uuid NOT NULL REFERENCES finance.invoices(id) ON DELETE RESTRICT,
  amendment_kind  text NOT NULL CHECK (amendment_kind IN ('credit_note','debit_note','correction')),
  reason          text NOT NULL,
  total_delta     numeric NOT NULL,                        -- positive = increase to payable; negative = credit
  issued_at       timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_amendments_reason_not_blank CHECK (length(trim(reason)) > 0)
);
CREATE INDEX invoice_amendments_invoice_idx ON finance.invoice_amendments (invoice_id, issued_at DESC);
CREATE INDEX invoice_amendments_tenant_idx  ON finance.invoice_amendments (tenant_id, issued_at DESC);
ALTER TABLE finance.invoice_amendments ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_amendments_tenant_select ON finance.invoice_amendments FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
GRANT SELECT ON finance.invoice_amendments TO authenticated;
GRANT ALL    ON finance.invoice_amendments TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. finance.payment_allocations (one payment → many invoices, splits)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.payment_allocations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  payment_id        uuid NOT NULL REFERENCES finance.payments(id) ON DELETE RESTRICT,
  invoice_id        uuid NOT NULL REFERENCES finance.invoices(id) ON DELETE RESTRICT,
  allocated_amount  numeric NOT NULL CHECK (allocated_amount > 0),
  allocated_at      timestamptz NOT NULL DEFAULT now(),
  allocated_by_user_id uuid,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_allocations_payment_idx ON finance.payment_allocations (payment_id);
CREATE INDEX payment_allocations_invoice_idx ON finance.payment_allocations (invoice_id);
ALTER TABLE finance.payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_allocations_tenant_select ON finance.payment_allocations FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
GRANT SELECT ON finance.payment_allocations TO authenticated;
GRANT ALL    ON finance.payment_allocations TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 4. finance.payment_webhook_events (Razorpay/Stripe inbound, raw payload retained)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.payment_webhook_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  gateway             text NOT NULL,                       -- 'razorpay','stripe',...
  event_type          text NOT NULL,                       -- 'payment.captured','refund.processed',...
  gateway_event_id    text,                                -- vendor's id; dedupe key
  raw_payload         jsonb NOT NULL,
  signature_verified  boolean NOT NULL DEFAULT false,
  received_at         timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  processing_status   text NOT NULL DEFAULT 'pending'
                        CHECK (processing_status IN ('pending','processing','succeeded','failed','ignored')),
  processing_error    text,
  related_payment_id  uuid REFERENCES finance.payments(id) ON DELETE SET NULL,
  related_refund_id   uuid,                                -- FK added after refunds table created (below)
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway, gateway_event_id)                       -- dedupe via vendor id
);
CREATE INDEX payment_webhook_events_tenant_received_idx
  ON finance.payment_webhook_events (tenant_id, received_at DESC);
CREATE INDEX payment_webhook_events_processing_idx
  ON finance.payment_webhook_events (processing_status, received_at)
  WHERE processing_status IN ('pending','processing');
ALTER TABLE finance.payment_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_webhook_events_tenant_select ON finance.payment_webhook_events FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
GRANT SELECT ON finance.payment_webhook_events TO authenticated;
GRANT ALL    ON finance.payment_webhook_events TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 5. finance.credit_notes
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.credit_notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  credit_note_number  text NOT NULL,
  invoice_id          uuid NOT NULL REFERENCES finance.invoices(id) ON DELETE RESTRICT,
  amount              numeric NOT NULL CHECK (amount > 0),
  currency            text NOT NULL,
  reason              text,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  issued_by_user_id   uuid,
  status              text NOT NULL DEFAULT 'issued'
                        CHECK (status IN ('issued','applied','voided')),
  applied_at          timestamptz,
  void_reason         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, credit_note_number)
);
CREATE INDEX credit_notes_invoice_idx ON finance.credit_notes (invoice_id);
CREATE INDEX credit_notes_tenant_status_idx ON finance.credit_notes (tenant_id, status, issued_at DESC);
ALTER TABLE finance.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_notes_tenant_select ON finance.credit_notes FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_finance_credit_notes_updated_at BEFORE UPDATE ON finance.credit_notes
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON finance.credit_notes TO authenticated;
GRANT ALL    ON finance.credit_notes TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 6. finance.refunds
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.refunds (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  payment_id         uuid NOT NULL REFERENCES finance.payments(id) ON DELETE RESTRICT,
  amount             numeric NOT NULL CHECK (amount > 0),
  currency           text NOT NULL,
  reason             text,
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','processing','succeeded','failed','cancelled')),
  gateway_refund_id  text,
  issued_at          timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz,
  failure_reason     text,
  initiated_by_user_id uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_payment_idx ON finance.refunds (payment_id);
CREATE INDEX refunds_tenant_status_idx ON finance.refunds (tenant_id, status, issued_at DESC);
ALTER TABLE finance.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_tenant_select ON finance.refunds FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_finance_refunds_updated_at BEFORE UPDATE ON finance.refunds
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON finance.refunds TO authenticated;
GRANT ALL    ON finance.refunds TO service_role;

-- Now add the deferred FK on payment_webhook_events.related_refund_id
ALTER TABLE finance.payment_webhook_events
  ADD CONSTRAINT payment_webhook_events_related_refund_fk
  FOREIGN KEY (related_refund_id) REFERENCES finance.refunds(id) ON DELETE SET NULL;

-- ══════════════════════════════════════════════════════════════════════
-- 7. finance.tax_exemption_certificates
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.tax_exemption_certificates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  customer_party_id   uuid NOT NULL,                       -- references core.parties.id
  jurisdiction_id     uuid REFERENCES finance.tax_jurisdictions(id) ON DELETE RESTRICT,
  certificate_number  text NOT NULL,
  certificate_kind    text,                                -- 'reseller','non_profit','government','export','other'
  valid_from          date NOT NULL,
  valid_to            date,
  file_id             uuid REFERENCES core.files(id) ON DELETE SET NULL,
  notes               text,
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','expired','revoked')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_exempt_cert_dates_sane CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX tax_exempt_cert_customer_idx ON finance.tax_exemption_certificates
  (tenant_id, customer_party_id, status) WHERE status = 'active';
CREATE INDEX tax_exempt_cert_jurisdiction_idx ON finance.tax_exemption_certificates (jurisdiction_id);
ALTER TABLE finance.tax_exemption_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_exempt_cert_tenant_select ON finance.tax_exemption_certificates FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_finance_tax_exempt_cert_updated_at BEFORE UPDATE ON finance.tax_exemption_certificates
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON finance.tax_exemption_certificates TO authenticated;
GRANT ALL    ON finance.tax_exemption_certificates TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 8. finance.tax_calculations (computed-tax audit trail)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.tax_calculations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  source_kind     text NOT NULL,                           -- 'invoice','invoice_line','quote','manual'
  source_id       uuid NOT NULL,
  tax_code_id     uuid REFERENCES finance.tax_codes(id) ON DELETE RESTRICT,
  taxable_amount  numeric NOT NULL,
  tax_amount      numeric NOT NULL,
  rate_percent    numeric,                                 -- captured-at-time rate for auditability
  jurisdiction_id uuid REFERENCES finance.tax_jurisdictions(id) ON DELETE RESTRICT,
  exemption_certificate_id uuid REFERENCES finance.tax_exemption_certificates(id) ON DELETE SET NULL,
  calculated_at   timestamptz NOT NULL DEFAULT now(),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tax_calculations_source_idx ON finance.tax_calculations (tenant_id, source_kind, source_id);
CREATE INDEX tax_calculations_code_idx   ON finance.tax_calculations (tax_code_id);
ALTER TABLE finance.tax_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_calculations_tenant_select ON finance.tax_calculations FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
GRANT SELECT ON finance.tax_calculations TO authenticated;
GRANT ALL    ON finance.tax_calculations TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 9. finance.margin_rules
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.margin_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  name             text NOT NULL,
  criteria         jsonb NOT NULL DEFAULT '{}'::jsonb,     -- {customer_segment, product_class, route, ...}
  margin_percent   numeric NOT NULL CHECK (margin_percent >= 0),
  priority         integer NOT NULL DEFAULT 100,           -- lower = higher priority
  is_active        boolean NOT NULL DEFAULT true,
  effective_from   date,
  effective_to     date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name),
  CONSTRAINT margin_rules_dates_sane CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);
CREATE INDEX margin_rules_tenant_active_idx ON finance.margin_rules (tenant_id, priority)
  WHERE is_active = true;
ALTER TABLE finance.margin_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY margin_rules_tenant_select ON finance.margin_rules FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_finance_margin_rules_updated_at BEFORE UPDATE ON finance.margin_rules
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON finance.margin_rules TO authenticated;
GRANT ALL    ON finance.margin_rules TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 10. finance.pricing_tier_configs (consolidates legacy charge_tier_*)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.pricing_tier_configs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  name         text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('weight_break','volume','revenue','duration','distance')),
  description  text,
  is_active    boolean NOT NULL DEFAULT true,
  effective_from date,
  effective_to   date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX pricing_tier_configs_tenant_kind_idx ON finance.pricing_tier_configs (tenant_id, kind)
  WHERE is_active = true;
ALTER TABLE finance.pricing_tier_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY pricing_tier_configs_tenant_select ON finance.pricing_tier_configs FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_finance_pricing_tier_configs_updated_at BEFORE UPDATE ON finance.pricing_tier_configs
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON finance.pricing_tier_configs TO authenticated;
GRANT ALL    ON finance.pricing_tier_configs TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 11. finance.pricing_tier_ranges (per-tier brackets)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.pricing_tier_ranges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_config_id  uuid NOT NULL REFERENCES finance.pricing_tier_configs(id) ON DELETE CASCADE,
  lower_bound     numeric NOT NULL,
  upper_bound     numeric,                                  -- NULL = unbounded top range
  rate            numeric NOT NULL,
  rate_kind       text NOT NULL DEFAULT 'per_unit'
                    CHECK (rate_kind IN ('per_unit','flat','percent')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pricing_tier_ranges_bounds_sane CHECK (upper_bound IS NULL OR upper_bound > lower_bound)
);
CREATE INDEX pricing_tier_ranges_config_idx ON finance.pricing_tier_ranges (tier_config_id, lower_bound);
ALTER TABLE finance.pricing_tier_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY pricing_tier_ranges_via_config_select ON finance.pricing_tier_ranges FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM finance.pricing_tier_configs c
    WHERE c.id = pricing_tier_ranges.tier_config_id
      AND c.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  ));
GRANT SELECT ON finance.pricing_tier_ranges TO authenticated;
GRANT ALL    ON finance.pricing_tier_ranges TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 12. finance.dunning_policies (configurable dunning sequences)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.dunning_policies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  name           text NOT NULL,
  steps          jsonb NOT NULL DEFAULT '[]'::jsonb,
                   -- [{day_offset, action: 'email'|'sms'|'manual', template_id?, severity?}]
  is_active      boolean NOT NULL DEFAULT true,
  description    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX dunning_policies_tenant_idx ON finance.dunning_policies (tenant_id) WHERE is_active = true;
ALTER TABLE finance.dunning_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY dunning_policies_tenant_select ON finance.dunning_policies FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_finance_dunning_policies_updated_at BEFORE UPDATE ON finance.dunning_policies
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON finance.dunning_policies TO authenticated;
GRANT ALL    ON finance.dunning_policies TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 13. finance.dunning_runs (per-invoice dunning progress)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE finance.dunning_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  invoice_id        uuid NOT NULL REFERENCES finance.invoices(id) ON DELETE RESTRICT,
  policy_id         uuid NOT NULL REFERENCES finance.dunning_policies(id) ON DELETE RESTRICT,
  current_step      integer NOT NULL DEFAULT 0,
  last_action_at    timestamptz,
  next_action_at    timestamptz,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','paused','completed','stopped')),
  stopped_reason    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, policy_id)                            -- one active run per (invoice, policy)
);
CREATE INDEX dunning_runs_due_idx ON finance.dunning_runs (next_action_at)
  WHERE status = 'active' AND next_action_at IS NOT NULL;
CREATE INDEX dunning_runs_tenant_idx ON finance.dunning_runs (tenant_id, status);
ALTER TABLE finance.dunning_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY dunning_runs_tenant_select ON finance.dunning_runs FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_finance_dunning_runs_updated_at BEFORE UPDATE ON finance.dunning_runs
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON finance.dunning_runs TO authenticated;
GRANT ALL    ON finance.dunning_runs TO service_role;
