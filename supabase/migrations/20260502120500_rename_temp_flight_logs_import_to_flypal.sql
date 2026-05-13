DO $$
BEGIN
  IF to_regclass('public.temp_flight_logs_import') IS NOT NULL
     AND to_regclass('public.flypal_flight_logs_import') IS NULL THEN
    EXECUTE 'ALTER TABLE public.temp_flight_logs_import RENAME TO flypal_flight_logs_import';
  END IF;
END
$$;
