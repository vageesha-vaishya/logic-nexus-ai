-- Follow-up #1 — finance.gl_accounts + finance.tenant_tax_rules.
--
-- Unblocks the InvoiceLineClassifyPanel host insertion: the LLM
-- feature classifies invoice lines against a tenant's chart of
-- accounts + tax rules, but neither structure existed in the DB
-- until this migration.
--
-- Design:
--   - finance.gl_accounts: per-tenant chart of accounts. Each row is
--     ONE GL code the tenant uses on invoices / vendor bills /
--     accruals. Type enum mirrors the LLM prompt's enum.
--     `tags` is jsonb so tenants can attach domain-specific routing
--     hints (e.g. ["freight","ocean"]).
--   - finance.tenant_tax_rules: per-tenant tax-application rules.
--     One row per tenant (jurisdiction-scoped). Carries the
--     reverse-charge + zero-rated charge-code lists used by the LLM
--     to decide tax_treatment per invoice line.
--
-- Both tables have tenant RLS. Default seed inserts a baseline
-- chart on tenant_create later; this migration ships schema only.

-- ============================================================
-- 1. finance.gl_accounts
-- ============================================================

CREATE TABLE IF NOT EXISTS finance.gl_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  franchise_id    uuid,
  code            text NOT NULL,
  name            text NOT NULL,
  type            text NOT NULL CHECK (type IN (
    'revenue',
    'cost_of_sales',
    'expense',
    'pass_through_liability',
    'tax_payable',
    'tax_receivable',
    'other'
  )),
  tags            jsonb NOT NULL DEFAULT '[]'::jsonb,
  description     text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid,
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_gl_accounts_tenant_active
  ON finance.gl_accounts (tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_gl_accounts_tenant_type
  ON finance.gl_accounts (tenant_id, type)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_gl_accounts_tags_gin
  ON finance.gl_accounts USING gin (tags);

COMMENT ON TABLE finance.gl_accounts IS
  'Per-tenant chart of accounts. Used by finance.invoice.line_classify '
  'LLM feature to map invoice lines to GL codes.';
COMMENT ON COLUMN finance.gl_accounts.tags IS
  'jsonb string array — domain hints for charge_code → account routing. '
  'Example: ["freight","ocean"] on the "Freight Revenue" account.';

ALTER TABLE finance.gl_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY gl_accounts_tenant_isolation ON finance.gl_accounts
  FOR ALL
  USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid));

-- Service-role bypass for migrations + edge functions running with
-- service role. Both PostgREST + service role inserts use this.
CREATE POLICY gl_accounts_service_bypass ON finance.gl_accounts
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON finance.gl_accounts TO authenticated;
GRANT ALL ON finance.gl_accounts TO service_role;

-- updated_at trigger
CREATE OR REPLACE FUNCTION finance.tg_gl_accounts_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS gl_accounts_set_updated_at ON finance.gl_accounts;
CREATE TRIGGER gl_accounts_set_updated_at
  BEFORE UPDATE ON finance.gl_accounts
  FOR EACH ROW EXECUTE FUNCTION finance.tg_gl_accounts_set_updated_at();

-- ============================================================
-- 2. finance.tenant_tax_rules
-- ============================================================

CREATE TABLE IF NOT EXISTS finance.tenant_tax_rules (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       uuid NOT NULL UNIQUE,
  franchise_id                    uuid,
  jurisdiction                    text NOT NULL CHECK (jurisdiction ~ '^[A-Z]{2}$'),
  tax_label                       text NOT NULL CHECK (tax_label IN (
    'GST', 'VAT', 'Sales Tax', 'Service Tax', 'None'
  )),
  default_rate_pct                numeric(5,2) CHECK (default_rate_pct >= 0 AND default_rate_pct <= 100),
  reverse_charge_applicable_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  zero_rated_charges              jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes                           text,
  is_active                       boolean NOT NULL DEFAULT true,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  created_by                      uuid
);

CREATE INDEX IF NOT EXISTS idx_tenant_tax_rules_jurisdiction
  ON finance.tenant_tax_rules (jurisdiction);

COMMENT ON TABLE finance.tenant_tax_rules IS
  'Per-tenant tax application rules. Used by finance.invoice.line_classify '
  'LLM feature to decide standard / zero_rated / reverse_charge / out_of_scope '
  'tax treatment per invoice line.';
COMMENT ON COLUMN finance.tenant_tax_rules.reverse_charge_applicable_codes IS
  'jsonb string array of charge_code values where the buyer pays tax '
  'authority directly (e.g. ["customs_filing_destination"]).';
COMMENT ON COLUMN finance.tenant_tax_rules.zero_rated_charges IS
  'jsonb string array of charge_code values that are zero-rated for tax '
  '(typical: ["freight"] for export-related lanes).';

ALTER TABLE finance.tenant_tax_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_tax_rules_isolation ON finance.tenant_tax_rules
  FOR ALL
  USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY tenant_tax_rules_service_bypass ON finance.tenant_tax_rules
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON finance.tenant_tax_rules TO authenticated;
GRANT ALL ON finance.tenant_tax_rules TO service_role;

-- updated_at trigger
CREATE OR REPLACE FUNCTION finance.tg_tenant_tax_rules_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tenant_tax_rules_set_updated_at ON finance.tenant_tax_rules;
CREATE TRIGGER tenant_tax_rules_set_updated_at
  BEFORE UPDATE ON finance.tenant_tax_rules
  FOR EACH ROW EXECUTE FUNCTION finance.tg_tenant_tax_rules_set_updated_at();

-- ============================================================
-- 3. Helper: default chart seed for a tenant
-- ============================================================
-- Convenience function to drop a baseline chart onto a tenant that
-- hasn't configured anything yet. Idempotent (skips existing codes).
-- Not auto-called; admin UI invokes this when an operator clicks
-- "Set up default chart".

CREATE OR REPLACE FUNCTION finance.seed_default_chart_for_tenant(p_tenant_id uuid)
RETURNS TABLE (code text, action text) LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, finance AS $$
BEGIN
  RETURN QUERY
  WITH defaults (code, name, type, tags) AS (
    VALUES
      ('4001', 'Freight Revenue',              'revenue',                jsonb_build_array('freight','ocean','air')),
      ('4011', 'Origin Charges Revenue',       'revenue',                jsonb_build_array('thc_origin','handling_origin')),
      ('4012', 'Destination Charges Revenue',  'revenue',                jsonb_build_array('thc_destination','handling_destination')),
      ('4020', 'Documentation Revenue',        'revenue',                jsonb_build_array('documentation')),
      ('4030', 'Customs Brokerage Revenue',    'revenue',                jsonb_build_array('customs_filing_origin','customs_filing_destination')),
      ('4040', 'Fuel Surcharge Revenue',       'revenue',                jsonb_build_array('fuel_surcharge')),
      ('4050', 'Security Surcharge Revenue',   'revenue',                jsonb_build_array('security_surcharge')),
      ('4060', 'Hazmat Surcharge Revenue',     'revenue',                jsonb_build_array('hazmat_surcharge')),
      ('4070', 'Temperature Control Revenue',  'revenue',                jsonb_build_array('temperature_control')),
      ('4080', 'Insurance Revenue',            'revenue',                jsonb_build_array('insurance')),
      ('4090', 'Demurrage Revenue',            'revenue',                jsonb_build_array('demurrage_risk_reserve','detention_risk_reserve')),
      ('5001', 'Carrier Cost of Sales',        'cost_of_sales',          jsonb_build_array('carrier_cost')),
      ('2401', 'Accrued Vendor Costs (Pass-Through)', 'pass_through_liability', jsonb_build_array('vendor_pass_through','passthrough')),
      ('2402', 'Duties & Taxes Recoverable',   'pass_through_liability', jsonb_build_array('duties_taxes_pass_through','duties')),
      ('2410', 'GST/VAT Payable',              'tax_payable',            jsonb_build_array('tax_payable')),
      ('1410', 'GST/VAT Receivable',           'tax_receivable',         jsonb_build_array('tax_receivable')),
      ('4999', 'Other Revenue',                'revenue',                jsonb_build_array('other'))
  ),
  ins AS (
    INSERT INTO finance.gl_accounts (tenant_id, code, name, type, tags, description)
    SELECT p_tenant_id, d.code, d.name, d.type, d.tags,
           'Default chart of accounts — seeded ' || to_char(now(), 'YYYY-MM-DD')
    FROM defaults d
    ON CONFLICT (tenant_id, code) DO NOTHING
    RETURNING code
  )
  SELECT i.code, 'inserted'::text FROM ins i
  UNION ALL
  SELECT d.code, 'skipped_existing'::text
  FROM defaults d
  WHERE NOT EXISTS (
    SELECT 1 FROM ins i WHERE i.code = d.code
  );
END $$;

COMMENT ON FUNCTION finance.seed_default_chart_for_tenant IS
  'Idempotent seed: drops a 17-row baseline chart for a tenant. Skips '
  'codes already present so re-running is safe. Returns per-code action.';

GRANT EXECUTE ON FUNCTION finance.seed_default_chart_for_tenant(uuid) TO authenticated, service_role;

-- ============================================================
-- 4. Helper: default tax rules for a tenant (IN/US/EU presets)
-- ============================================================

CREATE OR REPLACE FUNCTION finance.seed_default_tax_rules_for_tenant(
  p_tenant_id    uuid,
  p_jurisdiction text DEFAULT 'IN'
)
RETURNS finance.tenant_tax_rules LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, finance AS $$
DECLARE
  v_row finance.tenant_tax_rules;
BEGIN
  IF p_jurisdiction NOT IN ('IN', 'US', 'DE', 'NL', 'FR', 'GB', 'AE', 'SG') THEN
    RAISE EXCEPTION 'Unsupported preset jurisdiction: %', p_jurisdiction;
  END IF;

  INSERT INTO finance.tenant_tax_rules (
    tenant_id, jurisdiction, tax_label, default_rate_pct,
    reverse_charge_applicable_codes, zero_rated_charges, notes
  ) VALUES (
    p_tenant_id,
    p_jurisdiction,
    CASE p_jurisdiction
      WHEN 'IN' THEN 'GST'
      WHEN 'US' THEN 'Sales Tax'
      WHEN 'AE' THEN 'VAT'
      WHEN 'SG' THEN 'GST'
      ELSE 'VAT'
    END,
    CASE p_jurisdiction
      WHEN 'IN' THEN 18.00
      WHEN 'US' THEN NULL  -- state-by-state, no platform default
      WHEN 'DE' THEN 19.00
      WHEN 'NL' THEN 21.00
      WHEN 'FR' THEN 20.00
      WHEN 'GB' THEN 20.00
      WHEN 'AE' THEN 5.00
      WHEN 'SG' THEN 9.00
      ELSE NULL
    END,
    CASE p_jurisdiction
      WHEN 'IN' THEN jsonb_build_array('customs_filing_destination')
      WHEN 'DE' THEN jsonb_build_array('customs_filing_destination')
      WHEN 'NL' THEN jsonb_build_array('customs_filing_destination')
      WHEN 'FR' THEN jsonb_build_array('customs_filing_destination')
      ELSE '[]'::jsonb
    END,
    CASE p_jurisdiction
      WHEN 'IN' THEN jsonb_build_array('freight','thc_origin','fuel_surcharge')
      WHEN 'DE' THEN jsonb_build_array('freight')
      WHEN 'NL' THEN jsonb_build_array('freight')
      WHEN 'AE' THEN jsonb_build_array('freight')
      ELSE '[]'::jsonb
    END,
    'Seeded default tax rules for ' || p_jurisdiction || ' on ' || to_char(now(), 'YYYY-MM-DD')
  )
  ON CONFLICT (tenant_id) DO UPDATE
    SET jurisdiction = EXCLUDED.jurisdiction,
        tax_label    = EXCLUDED.tax_label,
        default_rate_pct = EXCLUDED.default_rate_pct,
        reverse_charge_applicable_codes = EXCLUDED.reverse_charge_applicable_codes,
        zero_rated_charges = EXCLUDED.zero_rated_charges,
        notes = EXCLUDED.notes
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

COMMENT ON FUNCTION finance.seed_default_tax_rules_for_tenant IS
  'Apply a preset tax rule for a tenant. Supports IN/US/DE/NL/FR/GB/AE/SG '
  'with sensible defaults. Upserts on tenant_id so re-running overrides.';

GRANT EXECUTE ON FUNCTION finance.seed_default_tax_rules_for_tenant(uuid, text) TO authenticated, service_role;
