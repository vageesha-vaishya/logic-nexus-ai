-- Transport Modes Constraints: Uniqueness and Icon Validation
-- Adds DB-level protections for duplicate codes and invalid icon names
-- Applies to both public.transport_modes and public.service_modes (if they exist)
-- Case-insensitive uniqueness on code via LOWER(code)
-- Icon name restricted to known set or NULL
-- Safe to re-run: checks existence before creating

BEGIN;

-- Helper: create unique index on LOWER(code) if table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'transport_modes' AND table_type = 'BASE TABLE'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS transport_modes_code_unique
      ON public.transport_modes (LOWER(code));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'service_modes' AND table_type = 'BASE TABLE'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS service_modes_code_unique
      ON public.service_modes (LOWER(code));
  END IF;
END $$;

-- Helper: add icon_name check constraint to restrict to known set (or NULL)
-- Known set (must match UI options): Ship, Plane, Truck, Train, Package, Waves, Container, Navigation, Anchor, Bus, Network
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'transport_modes' AND table_type = 'BASE TABLE'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'transport_modes_icon_name_check'
    ) THEN
      ALTER TABLE public.transport_modes
        ADD CONSTRAINT transport_modes_icon_name_check
        CHECK (
          icon_name IS NULL OR icon_name IN (
            'Ship','Plane','Truck','Train','Package','Waves',
            'Container','Navigation','Anchor','Bus','Network'
          )
        );
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'service_modes' AND table_type = 'BASE TABLE'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'service_modes_icon_name_check'
    ) THEN
      ALTER TABLE public.service_modes
        ADD CONSTRAINT service_modes_icon_name_check
        CHECK (
          icon_name IS NULL OR icon_name IN (
            'Ship','Plane','Truck','Train','Package','Waves',
            'Container','Navigation','Anchor','Bus','Network'
          )
        );
    END IF;
  END IF;
END $$;

COMMIT;
