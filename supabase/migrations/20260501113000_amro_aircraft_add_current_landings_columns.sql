BEGIN;

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS current_landings integer NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_landings_since_new integer NULL DEFAULT 0;

COMMIT;
