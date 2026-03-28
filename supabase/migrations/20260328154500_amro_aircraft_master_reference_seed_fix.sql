BEGIN;

DO $$
DECLARE
  actor_user_id uuid;
  seed_tenant_id uuid;
  airframe_type_id uuid;
BEGIN
  SELECT id
  INTO actor_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF actor_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row exists; aircraft master reference seed requires at least one user';
  END IF;

  SELECT id
  INTO seed_tenant_id
  FROM public.tenants
  ORDER BY created_at ASC
  LIMIT 1;

  IF seed_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No public.tenants row exists; aircraft master reference seed requires at least one tenant';
  END IF;

  INSERT INTO public.manufacturers (
    tenant_id,
    manufacturer_code,
    name,
    is_active,
    metadata,
    created_by,
    updated_by
  )
  VALUES
    (seed_tenant_id, 'AIR', 'Airbus', true, jsonb_build_object('seed_source', 'amro_aircraft_master_reference_seed_fix'), actor_user_id, actor_user_id),
    (seed_tenant_id, 'BOE', 'Boeing', true, jsonb_build_object('seed_source', 'amro_aircraft_master_reference_seed_fix'), actor_user_id, actor_user_id),
    (seed_tenant_id, 'EMB', 'Embraer', true, jsonb_build_object('seed_source', 'amro_aircraft_master_reference_seed_fix'), actor_user_id, actor_user_id),
    (seed_tenant_id, 'ATR', 'ATR', true, jsonb_build_object('seed_source', 'amro_aircraft_master_reference_seed_fix'), actor_user_id, actor_user_id)
  ON CONFLICT (tenant_id, manufacturer_code) WHERE deleted_at IS NULL DO UPDATE
  SET
    name = EXCLUDED.name,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL;

  INSERT INTO public.assembly_types (
    tenant_id,
    assembly_code,
    name,
    description,
    is_active,
    metadata,
    created_by,
    updated_by
  )
  VALUES (
    seed_tenant_id,
    'AIRFRAME',
    'Airframe',
    'Aircraft structure and certified type-level configuration reference.',
    true,
    jsonb_build_object('seed_source', 'amro_aircraft_master_reference_seed_fix'),
    actor_user_id,
    actor_user_id
  )
  ON CONFLICT (tenant_id, assembly_code) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  SELECT id
  INTO airframe_type_id
  FROM public.assembly_types
  WHERE tenant_id = seed_tenant_id
    AND assembly_code = 'AIRFRAME'
  LIMIT 1;

  IF airframe_type_id IS NULL THEN
    RAISE EXCEPTION 'AIRFRAME assembly type not found after upsert';
  END IF;

  WITH model_seed AS (
    SELECT manufacturer_code, model_code, model_name FROM (VALUES
      ('AIR', 'A320-200', 'A320-200'),
      ('BOE', 'B737-800', 'B737-800'),
      ('EMB', 'E190-E2', 'E190-E2'),
      ('ATR', 'ATR72-600', 'ATR72-600')
    ) AS data(manufacturer_code, model_code, model_name)
  )
  INSERT INTO public.assembly_models (
    tenant_id,
    manufacturer_id,
    assembly_type_id,
    model_code,
    name,
    primary_model,
    description,
    is_active,
    metadata,
    created_by,
    updated_by
  )
  SELECT
    seed_tenant_id,
    manufacturer.id,
    airframe_type_id,
    model_seed.model_code,
    model_seed.model_name,
    model_seed.model_name,
    format('%s aircraft model reference', model_seed.model_name),
    true,
    jsonb_build_object('seed_source', 'amro_aircraft_master_reference_seed_fix'),
    actor_user_id,
    actor_user_id
  FROM model_seed
  JOIN public.manufacturers AS manufacturer
    ON manufacturer.manufacturer_code = model_seed.manufacturer_code
   AND manufacturer.tenant_id = seed_tenant_id
   AND manufacturer.deleted_at IS NULL
  ON CONFLICT (tenant_id, manufacturer_id, assembly_type_id, model_code) DO UPDATE
  SET
    name = EXCLUDED.name,
    primary_model = EXCLUDED.primary_model,
    description = EXCLUDED.description,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  UPDATE public.aircraft AS aircraft_record
  SET
    manufacturer_id = manufacturer.id,
    updated_by = COALESCE(aircraft_record.updated_by, actor_user_id),
    updated_at = now()
  FROM public.manufacturers AS manufacturer
  WHERE manufacturer.deleted_at IS NULL
    AND aircraft_record.tenant_id = seed_tenant_id
    AND manufacturer.tenant_id = aircraft_record.tenant_id
    AND (
      lower(COALESCE(aircraft_record.manufacturer, '')) = lower(manufacturer.name)
      OR lower(COALESCE(aircraft_record.manufacturer, '')) = lower(manufacturer.manufacturer_code)
    )
    AND aircraft_record.manufacturer_id IS DISTINCT FROM manufacturer.id;
END $$;

COMMIT;
