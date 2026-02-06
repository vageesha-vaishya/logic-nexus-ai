
BEGIN;

-- Relax constraints on legacy columns to support new schema usage
ALTER TABLE public.duty_rates ALTER COLUMN country_code DROP NOT NULL;
ALTER TABLE public.duty_rates ALTER COLUMN rate_value DROP NOT NULL;

COMMIT;
