-- Seed default service type mappings for tenant 9e2686ba
-- Air → International Air, Express

DO $$
DECLARE
  v_service_type_id uuid;
  v_service_international_air uuid;
  v_service_express uuid;
BEGIN
  -- Resolve Air service type id
  SELECT st.id INTO v_service_type_id
  FROM public.service_types st
  WHERE lower(st.code) = 'air'
     OR lower(st.name) = 'air'
  LIMIT 1;

  IF v_service_type_id IS NULL THEN
    RAISE NOTICE 'Air service type not found. Skipping seed.';
    RETURN;
  END IF;

  -- Resolve service ids by name (case-insensitive exact or like)
  SELECT s.id INTO v_service_international_air
  FROM public.services s
  WHERE lower(s.service_name) = 'international air'
     OR lower(s.service_name) LIKE 'international air%'
  LIMIT 1;

  SELECT s.id INTO v_service_express
  FROM public.services s
  WHERE lower(s.service_name) = 'express'
     OR lower(s.service_name) LIKE 'express%'
  LIMIT 1;

  -- Insert mappings with priorities; prefer International Air as default
  IF v_service_international_air IS NOT NULL THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
    SELECT t.id, v_service_type_id, v_service_international_air, true, 1, true
    FROM public.tenants t
    ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Service International Air not found.';
  END IF;

  IF v_service_express IS NOT NULL THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
    SELECT t.id, v_service_type_id, v_service_express, false, 2, true
    FROM public.tenants t
    ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Service Express not found.';
  END IF;
END$$;
