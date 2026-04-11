BEGIN;

DO $$
DECLARE
  lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'aircraft_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.aircraft_type AS ENUM ('NarrowBody', 'RegionalJet', 'Turboprop', 'WideBody', 'auto_seeded');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['NarrowBody', 'RegionalJet', 'Turboprop', 'WideBody', 'auto_seeded'] LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'aircraft_type'
          AND n.nspname = 'public'
          AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.aircraft_type ADD VALUE ' || quote_literal(lbl);
      END IF;
    END LOOP;
  END IF;
END $$;

ALTER TABLE public.assembly_models
  ADD COLUMN IF NOT EXISTS aircraft_type public.aircraft_type;

DO $$
DECLARE
  v_udt_name text;
BEGIN
  SELECT c.udt_name
  INTO v_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'assembly_models'
    AND c.column_name = 'aircraft_type';

  IF v_udt_name IS NOT NULL AND v_udt_name <> 'aircraft_type' THEN
    ALTER TABLE public.assembly_models
      ALTER COLUMN aircraft_type TYPE public.aircraft_type
      USING (
        CASE
          WHEN aircraft_type IS NULL THEN NULL
          WHEN aircraft_type::text IN ('NarrowBody', 'RegionalJet', 'Turboprop', 'WideBody', 'auto_seeded')
            THEN aircraft_type::text::public.aircraft_type
          ELSE NULL
        END
      );
  END IF;
END $$;

COMMIT;
