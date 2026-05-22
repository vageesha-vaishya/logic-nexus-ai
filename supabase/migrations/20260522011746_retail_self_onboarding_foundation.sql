-- Self-onboarding wizard foundation. See
-- docs/plans/2026-05-21-self-onboarding-wizard-design.md.
--
-- Implementation step 1 of 10. Lands four pieces:
--   1. Adds an "SOS-RETAIL" franchise under the existing SOS Services
--      tenant (decision 8a, revised at impl time: an "SOS Services"
--      tenant already existed for legacy logistics; the user chose
--      option b — reuse the tenant, add a retail franchise under it).
--   2. Migrates the 1 user_role + 1 portfolio that lived under the
--      now-defunct "Sthira Retail" tenant to (SOS Services, SOS-RETAIL).
--      Deactivates the Sthira Retail tenant.
--   3. Creates markets.retail_profile for wizard-meta state.
--   4. Adds markets.risk_profiles.starter_template_slug.
--   5. Creates markets.provision_new_retail_user(uuid) function.

-- ─── 1. SOS-RETAIL franchise under existing SOS Services tenant ──────────────
DO $$
DECLARE
  v_sos_tenant_id    uuid;
  v_sthira_tenant_id uuid;
  v_retail_franchise uuid;
BEGIN
  SELECT id INTO v_sos_tenant_id
  FROM public.tenants WHERE slug = 'sos-services';

  IF v_sos_tenant_id IS NULL THEN
    RAISE EXCEPTION 'SOS Services tenant not found — preconditions not met';
  END IF;

  SELECT id INTO v_retail_franchise
  FROM public.franchises
  WHERE tenant_id = v_sos_tenant_id AND code = 'SOS-RETAIL';

  IF v_retail_franchise IS NULL THEN
    INSERT INTO public.franchises (tenant_id, name, code)
    VALUES (v_sos_tenant_id, 'SOS Retail Investments', 'SOS-RETAIL')
    RETURNING id INTO v_retail_franchise;
    RAISE NOTICE 'Created SOS-RETAIL franchise % under SOS Services tenant %', v_retail_franchise, v_sos_tenant_id;
  ELSE
    RAISE NOTICE 'SOS-RETAIL franchise already exists: %', v_retail_franchise;
  END IF;

  -- ── 2. Migrate Sthira Retail residents to SOS Services / SOS-RETAIL ───────
  SELECT id INTO v_sthira_tenant_id
  FROM public.tenants WHERE slug = 'sthira-retail';

  IF v_sthira_tenant_id IS NOT NULL THEN
    UPDATE public.user_roles
    SET tenant_id    = v_sos_tenant_id,
        franchise_id = v_retail_franchise
    WHERE tenant_id  = v_sthira_tenant_id;

    UPDATE markets.portfolios
    SET tenant_id    = v_sos_tenant_id,
        franchise_id = v_retail_franchise
    WHERE tenant_id  = v_sthira_tenant_id;

    UPDATE markets.holdings
    SET tenant_id    = v_sos_tenant_id,
        franchise_id = v_retail_franchise
    WHERE tenant_id  = v_sthira_tenant_id;

    UPDATE markets.broker_portfolio_links
    SET tenant_id    = v_sos_tenant_id,
        franchise_id = v_retail_franchise
    WHERE tenant_id  = v_sthira_tenant_id;

    -- Deactivate the now-empty Sthira Retail tenant. Don't DELETE — keep
    -- audit history of the rename.
    UPDATE public.tenants
    SET is_active = false,
        name      = 'Sthira Retail (deprecated 2026-05-22 → SOS-RETAIL franchise)'
    WHERE id = v_sthira_tenant_id;

    RAISE NOTICE 'Migrated Sthira Retail % residents to SOS-RETAIL under SOS Services', v_sthira_tenant_id;
  END IF;
END $$;

-- ─── 3. markets.retail_profile (wizard-meta state) ───────────────────────────
CREATE TABLE IF NOT EXISTS markets.retail_profile (
  user_id                uuid PRIMARY KEY,
  disclosure_accepted_at timestamptz,
  tour_completed         boolean NOT NULL DEFAULT false,
  nominee                jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE markets.retail_profile IS
  'Wizard-meta state for the retail self-onboarding flow. Separate from risk_profiles (which holds investment-meta: risk tag, quiz answers, goals).';

ALTER TABLE markets.retail_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY retail_profile_owner_select
  ON markets.retail_profile FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY retail_profile_owner_insert
  ON markets.retail_profile FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY retail_profile_owner_update
  ON markets.retail_profile FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY retail_profile_service_role_all
  ON markets.retail_profile FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 4. risk_profiles.starter_template_slug ──────────────────────────────────
ALTER TABLE markets.risk_profiles
  ADD COLUMN IF NOT EXISTS starter_template_slug text;

COMMENT ON COLUMN markets.risk_profiles.starter_template_slug IS
  'Slug of the portfolio template the user picked at step 6 of the self-onboarding wizard (e.g., conservative / balanced / growth).';

-- ─── 5. provision_new_retail_user(user_id) ───────────────────────────────────
-- Single transaction, idempotent. Called by the post-signup Auth-hook
-- edge function (decision 7b) and by the worker retry endpoint (7c
-- fallback when the hook fails).
--
-- NOTE: amended by 20260522012018_provision_new_retail_user_add_profiles.sql
-- to also create the public.profiles row required by user_roles FK.
-- This version is the initial drop; the next migration replaces it.
CREATE OR REPLACE FUNCTION markets.provision_new_retail_user(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, markets
AS $$
DECLARE
  v_tenant_id     uuid;
  v_franchise_id  uuid;
  v_portfolio_id  uuid;
  v_instrument_id uuid := 'bb35b9b4-d483-480f-b754-bb828c909c02';
  v_initial_cash  numeric := 100000;
  v_etf_target    numeric := 30000;
  v_ltp           numeric;
  v_qty           numeric;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'sos-services';
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'SOS Services tenant not found'; END IF;

  SELECT id INTO v_franchise_id
  FROM public.franchises
  WHERE tenant_id = v_tenant_id AND code = 'SOS-RETAIL';
  IF v_franchise_id IS NULL THEN RAISE EXCEPTION 'SOS-RETAIL franchise not found'; END IF;

  INSERT INTO public.user_roles (user_id, role, tenant_id, franchise_id)
  VALUES (p_user_id, 'user'::public.app_role, v_tenant_id, v_franchise_id)
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_portfolio_id
  FROM markets.portfolios
  WHERE owner_user_id = p_user_id AND tenant_id = v_tenant_id AND franchise_id = v_franchise_id
  ORDER BY created_at ASC LIMIT 1;

  IF v_portfolio_id IS NULL THEN
    INSERT INTO markets.portfolios (
      tenant_id, franchise_id, owner_user_id,
      name, mode, base_currency, holder_type, metadata
    )
    VALUES (
      v_tenant_id, v_franchise_id, p_user_id,
      'My Portfolio', 'paper', 'INR', 'self_directed',
      jsonb_build_object('source', 'self-onboarding', 'created_via', 'provision_new_retail_user')
    )
    RETURNING id INTO v_portfolio_id;
  END IF;

  INSERT INTO markets.paper_capital (portfolio_id, initial_capital, available_cash)
  VALUES (v_portfolio_id, v_initial_cash, v_initial_cash - v_etf_target)
  ON CONFLICT (portfolio_id) DO NOTHING;

  SELECT close INTO v_ltp
  FROM markets.price_history_y2026
  WHERE instrument_id = v_instrument_id
  ORDER BY ts DESC LIMIT 1;

  IF v_ltp IS NOT NULL AND v_ltp > 0 THEN
    v_qty := floor(v_etf_target / v_ltp);
    IF v_qty > 0 THEN
      INSERT INTO markets.holdings (
        portfolio_id, instrument_id, owner_user_id, tenant_id, franchise_id,
        qty, avg_cost, asset_class, metadata
      )
      VALUES (
        v_portfolio_id, v_instrument_id, p_user_id, v_tenant_id, v_franchise_id,
        v_qty, v_ltp, 'equity',
        jsonb_build_object('source', 'onboarding-seed', 'target_allocation_pct', 30)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  INSERT INTO markets.retail_profile (user_id) VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN v_portfolio_id;
END;
$$;

COMMENT ON FUNCTION markets.provision_new_retail_user(uuid) IS
  'Eagerly provisions a new retail user: user_roles binding to SOS Services + SOS-RETAIL, paper portfolio, ₹1L paper_capital, 30% NIFTY 50 ETF seed holding, retail_profile row. Idempotent. Returns portfolio_id.';

GRANT EXECUTE ON FUNCTION markets.provision_new_retail_user(uuid) TO service_role;
