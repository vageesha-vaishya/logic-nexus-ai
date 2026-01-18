DO $$
DECLARE
  tenant_nullable text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'carriers'
      AND column_name = 'carrier_type'
  ) THEN
    ALTER TABLE public.carriers
      ADD COLUMN carrier_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'carriers'
      AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.carriers
      ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  SELECT is_nullable
  INTO tenant_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'carriers'
    AND column_name = 'tenant_id';

  IF tenant_nullable IS NULL OR tenant_nullable = 'YES' THEN
    INSERT INTO carriers (carrier_name, carrier_type, is_active) VALUES
      -- Ocean Carriers
      ('Mediterranean Shipping Company (MSC)', 'ocean', true),
      ('Maersk', 'ocean', true),
      ('CMA CGM', 'ocean', true),
      ('COSCO Shipping Lines', 'ocean', true),
      ('Hapag-Lloyd', 'ocean', true),
      ('Ocean Network Express (ONE)', 'ocean', true),
      ('Evergreen Marine Corporation', 'ocean', true),
      ('HMM Co. Ltd.', 'ocean', true),
      ('Zim Integrated Shipping Services', 'ocean', true),
      ('Yang Ming Marine Transport Corporation', 'ocean', true),

      -- Air Cargo Carriers
      ('FedEx Express', 'air_cargo', true),
      ('UPS Airlines', 'air_cargo', true),
      ('DHL Aviation', 'air_cargo', true),
      ('Qatar Airways Cargo', 'air_cargo', true),
      ('Emirates SkyCargo', 'air_cargo', true),
      ('Cathay Pacific Cargo', 'air_cargo', true),
      ('Lufthansa Cargo', 'air_cargo', true),
      ('Korean Air Cargo', 'air_cargo', true),
      ('Singapore Airlines Cargo', 'air_cargo', true),
      ('Cargolux', 'air_cargo', true),

      -- Trucking & Courier Companies
      ('UPS', 'courier', true),
      ('FedEx', 'courier', true),
      ('XPO Logistics', 'trucking', true),
      ('J.B. Hunt Transport Services', 'trucking', true),
      ('Knight-Swift Transportation', 'trucking', true),
      ('Schneider National', 'trucking', true),
      ('Werner Enterprises', 'trucking', true),
      ('U.S. Xpress Enterprises', 'trucking', true),
      ('Old Dominion Freight Line', 'trucking', true),
      ('YRC Worldwide', 'trucking', true),

      -- Movers and Packers
      ('Allied Van Lines', 'movers_and_packers', true),
      ('North American Van Lines', 'movers_and_packers', true),
      ('Atlas Van Lines', 'movers_and_packers', true),
      ('United Van Lines', 'movers_and_packers', true),
      ('Mayflower Transit', 'movers_and_packers', true);
  END IF;
END $$;
