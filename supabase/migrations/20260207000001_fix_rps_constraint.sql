
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rps_watch_list_name_key'
    ) THEN
        ALTER TABLE public.rps_watch_list ADD CONSTRAINT rps_watch_list_name_key UNIQUE (name);
    END IF;
END $$;

COMMIT;
