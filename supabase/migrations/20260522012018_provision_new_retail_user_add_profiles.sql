-- Amendment to provision_new_retail_user — handles the public.profiles
-- FK dependency surfaced in implementation testing on 2026-05-22.
-- public.user_roles.user_id references public.profiles(id), not auth.users.
-- Provision needs to create the profiles row first, populating email from
-- auth.users (the post-signup hook fires after auth.users.insert).

CREATE OR REPLACE FUNCTION markets.provision_new_retail_user(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, markets, auth
AS $$
DECLARE
  v_tenant_id     uuid;
  v_franchise_id  uuid;
  v_portfolio_id  uuid;
  v_email         text;
  v_first_name    text;
  v_last_name     text;
  v_instrument_id uuid := 'bb35b9b4-d483-480f-b754-bb828c909c02';
  v_initial_cash  numeric := 100000;
  v_etf_target    numeric := 30000;
  v_ltp           numeric;
  v_qty           numeric;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  -- 1. Resolve SOS Services tenant + SOS-RETAIL franchise.
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'sos-services';
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'SOS Services tenant not found';
  END IF;

  SELECT id INTO v_franchise_id
  FROM public.franchises
  WHERE tenant_id = v_tenant_id AND code = 'SOS-RETAIL';
  IF v_franchise_id IS NULL THEN
    RAISE EXCEPTION 'SOS-RETAIL franchise not found';
  END IF;

  -- 2. Look up email + name from auth.users (NEW STEP).
  SELECT
    u.email,
    NULLIF(u.raw_user_meta_data->>'first_name', ''),
    NULLIF(u.raw_user_meta_data->>'last_name',  '')
  INTO v_email, v_first_name, v_last_name
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'auth.users row not found for user_id %', p_user_id;
  END IF;

  -- 3. public.profiles row (NEW STEP — required by user_roles FK).
  INSERT INTO public.profiles (id, email, first_name, last_name, tenant_id)
  VALUES (p_user_id, v_email, v_first_name, v_last_name, v_tenant_id)
  ON CONFLICT (id) DO NOTHING;

  -- 4. user_roles binding.
  INSERT INTO public.user_roles (user_id, role, tenant_id, franchise_id)
  VALUES (p_user_id, 'user'::public.app_role, v_tenant_id, v_franchise_id)
  ON CONFLICT DO NOTHING;

  -- 5. Default portfolio.
  SELECT id INTO v_portfolio_id
  FROM markets.portfolios
  WHERE owner_user_id = p_user_id
    AND tenant_id     = v_tenant_id
    AND franchise_id  = v_franchise_id
  ORDER BY created_at ASC
  LIMIT 1;

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

  -- 6. paper_capital row.
  INSERT INTO markets.paper_capital (portfolio_id, initial_capital, available_cash)
  VALUES (v_portfolio_id, v_initial_cash, v_initial_cash - v_etf_target)
  ON CONFLICT (portfolio_id) DO NOTHING;

  -- 7. NIFTY 50 ETF seed holding (30%).
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

  -- 8. retail_profile row for the wizard guard.
  INSERT INTO markets.retail_profile (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN v_portfolio_id;
END;
$$;

GRANT EXECUTE ON FUNCTION markets.provision_new_retail_user(uuid) TO service_role;
