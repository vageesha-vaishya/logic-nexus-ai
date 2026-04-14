BEGIN;

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS aircraft_template_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'aircraft_aircraft_template_id_fkey'
      AND conrelid = 'public.aircraft'::regclass
  ) THEN
    ALTER TABLE public.aircraft
      ADD CONSTRAINT aircraft_aircraft_template_id_fkey
        FOREIGN KEY (aircraft_template_id)
        REFERENCES public.aircraft_template (id)
        ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
