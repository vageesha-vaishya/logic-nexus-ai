ALTER TABLE public.aircraft
  ALTER COLUMN status SET DEFAULT ('active'::text)::aircraft_status;
