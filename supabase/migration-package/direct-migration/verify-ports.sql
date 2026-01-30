DO $$
DECLARE
  v_seaport_count int;
  v_airport_count int;
  v_rail_count int;
  v_bad_iata int;
  v_bad_icao int;
  v_bad_unloc int;
  v_country_linked int;
  v_city_linked int;
BEGIN
  SELECT COUNT(*) INTO v_seaport_count FROM public.ports_locations WHERE tenant_id IS NULL AND location_type = 'seaport';
  SELECT COUNT(*) INTO v_airport_count FROM public.ports_locations WHERE tenant_id IS NULL AND location_type = 'airport';
  SELECT COUNT(*) INTO v_rail_count FROM public.ports_locations WHERE tenant_id IS NULL AND location_type = 'railway_terminal';

  SELECT COUNT(*) INTO v_bad_iata FROM public.ports_locations WHERE iata_code IS NOT NULL AND iata_code !~ '^[A-Z]{3}$';
  SELECT COUNT(*) INTO v_bad_icao FROM public.ports_locations WHERE icao_code IS NOT NULL AND icao_code !~ '^[A-Z]{4}$';
  SELECT COUNT(*) INTO v_bad_unloc FROM public.ports_locations WHERE un_locode IS NOT NULL AND un_locode !~ '^[A-Z]{2}[A-Z0-9]{3}$';

  SELECT COUNT(*) INTO v_country_linked FROM public.ports_locations WHERE country_id IS NOT NULL;
  SELECT COUNT(*) INTO v_city_linked FROM public.ports_locations WHERE city_id IS NOT NULL;

  RAISE NOTICE 'Seaports: % | Airports: % | Rail: %', v_seaport_count, v_airport_count, v_rail_count;
  RAISE NOTICE 'Bad IATA: % | Bad ICAO: % | Bad UN/LOCODE: %', v_bad_iata, v_bad_icao, v_bad_unloc;
  RAISE NOTICE 'Linked Countries: % | Linked Cities: %', v_country_linked, v_city_linked;
END $$;

