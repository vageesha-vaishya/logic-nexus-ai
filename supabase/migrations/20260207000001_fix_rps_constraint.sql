
BEGIN;
ALTER TABLE public.rps_watch_list ADD CONSTRAINT rps_watch_list_name_key UNIQUE (name);
COMMIT;
