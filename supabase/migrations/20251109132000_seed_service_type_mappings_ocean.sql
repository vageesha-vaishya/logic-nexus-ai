-- Seed default service type mappings for tenant 9e2686ba
-- Ocean → International Ocean FCL, FCL (Full Container Load), LCL (Less than Container Load)

DO $$
DECLARE
  v_tenant uuid := '9e2686ba'::uuid;
  v_service_type_id uuid;
  v_service_intl_ocean_fcl uuid;
  v_service_fcl uuid;
  v_service_lcl uuid;
BEGIN
  -- Resolve Ocean service type id
  SELECT st.id INTO v_service_type_id
  FROM public.service_types st
  WHERE lower(st.code) = 'ocean'
     OR lower(st.name) = 'ocean'
  LIMIT 1;

  IF v_service_type_id IS NULL THEN
    RAISE NOTICE 'Ocean service type not found. Skipping seed.';
    RETURN;
  END IF;

  -- Resolve service ids by name (case-insensitive)
  SELECT s.id INTO v_service_intl_ocean_fcl
  FROM public.services s
  WHERE lower(s.name) = 'international ocean fcl'
  LIMIT 1;

  SELECT s.id INTO v_service_fcl
  FROM public.services s
  WHERE lower(s.name) LIKE 'fcl%'
  LIMIT 1;

  SELECT s.id INTO v_service_lcl
  FROM public.services s
  WHERE lower(s.name) LIKE 'lcl%'
  LIMIT 1;

  -- Insert mappings with priorities; prefer International Ocean FCL as default
  IF v_service_intl_ocean_fcl IS NOT NULL THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
    VALUES (v_tenant, v_service_type_id, v_service_intl_ocean_fcl, true, 1, true)
    ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Service International Ocean FCL not found.';
  END IF;

  IF v_service_fcl IS NOT NULL THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
    VALUES (v_tenant, v_service_type_id, v_service_fcl, false, 2, true)
    ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Service FCL (Full Container Load) not found.';
  END IF;

  IF v_service_lcl IS NOT NULL THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
    VALUES (v_tenant, v_service_type_id, v_service_lcl, false, 0, true)
    ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Service LCL (Less than Container Load) not found.';
  END IF;
END$$;