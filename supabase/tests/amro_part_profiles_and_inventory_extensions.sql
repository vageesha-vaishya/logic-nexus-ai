-- Phase 6 Step 63 — smoke test for amro.part_profiles + amro.inventory_extensions.
--
-- Asserts:
--   A1. life_limited=true without any axis raises check_violation
--       (part_profiles_life_limited_has_axis).
--   A2. Valid life_limited row with life_limit_hours succeeds.
--   A3. UNIQUE (tenant_id, item_id) blocks duplicate profile.
--   A4. calibration_required=true without any interval raises
--       check_violation (part_profiles_calibration_has_interval).
--   A5. storage_temp_min_c > storage_temp_max_c raises
--       check_violation (inventory_extensions_temp_range_sane).
--   A6. Valid inventory_extensions row succeeds.
--   A7. shelf_life_open_days > shelf_life_days raises
--       check_violation (inventory_extensions_open_le_unopened).
--   A8. DELETE FROM uim.item_master cascades to both extension
--       tables (FK ON DELETE CASCADE).
--
-- Self-cleaning. Note: uim.item_master.part_number has a CHECK on
-- the format '^[A-Z0-9-]{3,64}$' — synthetic part numbers use
-- upper(substr(uuid)) to satisfy it.

DO $smoke$
DECLARE
  v_tenant uuid;
  v_item_id uuid := gen_random_uuid();
  v_item2_id uuid := gen_random_uuid();
  v_profile_id uuid;
  v_ext_id uuid;
  v_remaining integer;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;

  INSERT INTO uim.item_master (id, tenant_id, part_number)
  VALUES (v_item_id,  v_tenant, 'SMOKE-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
         (v_item2_id, v_tenant, 'SMOKE-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));

  BEGIN
    INSERT INTO amro.part_profiles (tenant_id, item_id, life_limited) VALUES (v_tenant, v_item_id, true);
    RAISE EXCEPTION 'A1 expected CHECK';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'A1 OK'; END;

  INSERT INTO amro.part_profiles (tenant_id, item_id, regulatory_class, life_limited, life_limit_hours, ata_chapter)
  VALUES (v_tenant, v_item_id, 'rotable', true, 30000, '32-40')
  RETURNING id INTO v_profile_id;
  RAISE NOTICE 'A2 OK';

  BEGIN
    INSERT INTO amro.part_profiles (tenant_id, item_id) VALUES (v_tenant, v_item_id);
    RAISE EXCEPTION 'A3 expected unique';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'A3 OK'; END;

  BEGIN
    INSERT INTO amro.part_profiles (tenant_id, item_id, calibration_required) VALUES (v_tenant, v_item2_id, true);
    RAISE EXCEPTION 'A4 expected CHECK';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'A4 OK'; END;

  BEGIN
    INSERT INTO amro.inventory_extensions (tenant_id, item_id, storage_temp_min_c, storage_temp_max_c)
    VALUES (v_tenant, v_item_id, 25, 5);
    RAISE EXCEPTION 'A5 expected CHECK';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'A5 OK'; END;

  INSERT INTO amro.inventory_extensions (tenant_id, item_id, shelf_life_days, shelf_life_open_days, storage_temp_min_c, storage_temp_max_c, hazmat_class)
  VALUES (v_tenant, v_item_id, 180, 30, 5, 25, '9')
  RETURNING id INTO v_ext_id;
  RAISE NOTICE 'A6 OK';

  BEGIN
    UPDATE amro.inventory_extensions SET shelf_life_open_days = 200 WHERE id = v_ext_id;
    RAISE EXCEPTION 'A7 expected CHECK';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'A7 OK'; END;

  DELETE FROM uim.item_master WHERE id = v_item_id;
  SELECT count(*)::integer INTO v_remaining FROM amro.part_profiles WHERE item_id = v_item_id;
  IF v_remaining <> 0 THEN RAISE EXCEPTION 'A8a remaining=%', v_remaining; END IF;
  SELECT count(*)::integer INTO v_remaining FROM amro.inventory_extensions WHERE item_id = v_item_id;
  IF v_remaining <> 0 THEN RAISE EXCEPTION 'A8b remaining=%', v_remaining; END IF;
  RAISE NOTICE 'A8 OK — CASCADE cleared both extension tables';

  DELETE FROM uim.item_master WHERE id = v_item2_id;

  RAISE NOTICE '=== part_profiles + inventory_extensions SMOKE PASSED (8/8) ===';
END;
$smoke$;
