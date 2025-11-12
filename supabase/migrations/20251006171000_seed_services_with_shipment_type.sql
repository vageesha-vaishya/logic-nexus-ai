-- Add shipment_type to services and seed sample services per tenant
BEGIN;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'shipment_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.shipment_type AS ENUM ('ocean_freight','air_freight','inland_trucking','railway_transport','courier','movers_packers');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['ocean_freight','air_freight','inland_trucking','railway_transport','courier','movers_packers'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'shipment_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.shipment_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

-- Add column to services (safe if already exists)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS shipment_type public.shipment_type;

-- Populate shipment_type from existing columns if present
DO $$
DECLARE
  has_service_type boolean;
  has_mode boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_type'
  ) INTO has_service_type;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'mode'
  ) INTO has_mode;

  IF has_service_type THEN
    UPDATE public.services s
    SET shipment_type = CASE s.service_type
      WHEN 'ocean' THEN 'ocean_freight'::public.shipment_type
      WHEN 'air' THEN 'air_freight'::public.shipment_type
      WHEN 'trucking' THEN 'inland_trucking'::public.shipment_type
      WHEN 'courier' THEN 'courier'::public.shipment_type
      WHEN 'moving' THEN 'movers_packers'::public.shipment_type
      WHEN 'railway_transport' THEN 'railway_transport'::public.shipment_type
      ELSE NULL
    END
    WHERE shipment_type IS NULL;
  ELSIF has_mode THEN
    UPDATE public.services s
    SET shipment_type = CASE s.mode::text
      WHEN 'ocean' THEN 'ocean_freight'::public.shipment_type
      WHEN 'air' THEN 'air_freight'::public.shipment_type
      WHEN 'inland_trucking' THEN 'inland_trucking'::public.shipment_type
      WHEN 'courier' THEN 'courier'::public.shipment_type
      WHEN 'movers_packers' THEN 'movers_packers'::public.shipment_type
      ELSE NULL
    END
    WHERE shipment_type IS NULL;
  END IF;
END $$;

-- Seed sample services per tenant referencing shipment_type
DO $$
DECLARE
  has_old_schema boolean; -- service_code/service_name
  has_mode_schema boolean; -- mode/name
  rec RECORD;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_code'
  ) INTO has_old_schema;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'mode'
  ) INTO has_mode_schema;

  FOR rec IN SELECT id AS tenant_id FROM public.tenants LOOP
    IF has_old_schema THEN
      -- Old schema (service_code/service_name/service_type)
      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'OCEAN_STD', 'Ocean Freight - Standard', 'ocean',
             'FCL/LCL ocean freight', 1200, 'per container', 25,
             true, '{"container":"20ft"}'::jsonb,
             'ocean_freight'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'OCEAN_STD'
      );

      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'AIR_EXP', 'Air Freight - Express', 'air',
             'Priority air freight', 5, 'per kg', 3,
             true, '{"max_weight_kg":500}'::jsonb,
             'air_freight'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'AIR_EXP'
      );

      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'TRUCK_LTL', 'Inland Trucking - LTL', 'trucking',
             'Domestic road transport LTL', 2, 'per mile', 5,
             true, '{"equipment":"box_truck"}'::jsonb,
             'inland_trucking'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'TRUCK_LTL'
      );

      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'COURIER_STD', 'Courier - Standard Parcel', 'courier',
             'Door-to-door parcel delivery', 10, 'per parcel', 2,
             true, '{"tracking":true}'::jsonb,
             'courier'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'COURIER_STD'
      );

      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'MOVE_PACK', 'Movers & Packers - Residential', 'moving',
             'Pack and move household goods', 1500, 'per job', 3,
             true, '{"includes_packing":true}'::jsonb,
             'movers_packers'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'MOVE_PACK'
      );

      INSERT INTO public.services (
        tenant_id, service_code, service_name, service_type,
        description, base_price, pricing_unit, transit_time_days,
        is_active, metadata, shipment_type
      )
      SELECT rec.tenant_id, 'RAIL_STD', 'Railways - Standard', 'railway_transport',
             'Intermodal rail transport', 800, 'per container', 10,
             true, '{"waybill_required":true}'::jsonb,
             'railway_transport'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.service_code = 'RAIL_STD'
      );

    ELSIF has_mode_schema THEN
      -- New schema (mode/name)
      INSERT INTO public.services (
        tenant_id, mode, name, description, transit_profile, is_active, shipment_type
      )
      SELECT rec.tenant_id, 'ocean'::public.transport_mode, 'Ocean Freight - Standard',
             'FCL/LCL ocean freight', '{"days":25,"unit":"per container"}'::jsonb,
             true, 'ocean_freight'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.name = 'Ocean Freight - Standard'
      );

      INSERT INTO public.services (
        tenant_id, mode, name, description, transit_profile, is_active, shipment_type
      )
      SELECT rec.tenant_id, 'air'::public.transport_mode, 'Air Freight - Express',
             'Priority air freight for urgent shipments', '{"days":3,"unit":"per kg"}'::jsonb,
             true, 'air_freight'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.name = 'Air Freight - Express'
      );

      INSERT INTO public.services (
        tenant_id, mode, name, description, transit_profile, is_active, shipment_type
      )
      SELECT rec.tenant_id, 'inland_trucking'::public.transport_mode, 'Inland Trucking - LTL',
             'Less-than-truckload domestic road transport', '{"days":5,"unit":"per mile"}'::jsonb,
             true, 'inland_trucking'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.name = 'Inland Trucking - LTL'
      );

      INSERT INTO public.services (
        tenant_id, mode, name, description, transit_profile, is_active, shipment_type
      )
      SELECT rec.tenant_id, 'courier'::public.transport_mode, 'Courier - Standard Parcel',
             'Door-to-door parcel delivery', '{"days":2,"unit":"per parcel"}'::jsonb,
             true, 'courier'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.name = 'Courier - Standard Parcel'
      );

      INSERT INTO public.services (
        tenant_id, mode, name, description, transit_profile, is_active, shipment_type
      )
      SELECT rec.tenant_id, 'movers_packers'::public.transport_mode, 'Movers & Packers - Residential',
             'Pack and move residential goods', '{"days":3,"unit":"per job"}'::jsonb,
             true, 'movers_packers'::public.shipment_type
      WHERE NOT EXISTS (
        SELECT 1 FROM public.services s
        WHERE s.tenant_id = rec.tenant_id AND s.name = 'Movers & Packers - Residential'
      );
    END IF;
  END LOOP;

  -- Make the column NOT NULL once populated
  ALTER TABLE public.services
    ALTER COLUMN shipment_type SET NOT NULL;
END $$;

COMMIT;