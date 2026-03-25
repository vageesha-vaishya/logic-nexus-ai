DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'aircraft_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.aircraft_type AS ENUM ('NarrowBody', 'RegionalJet', 'Turboprop', 'WideBody', 'auto_seeded');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['NarrowBody', 'RegionalJet', 'Turboprop', 'WideBody', 'auto_seeded'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'aircraft_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.aircraft_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;
