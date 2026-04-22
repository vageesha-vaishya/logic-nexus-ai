-- Add tenant_id to cities unique index scope

BEGIN;

DROP INDEX IF EXISTS public.cities_country_state_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS cities_tenant_country_state_name_unique
  ON public.cities
  USING btree (tenant_id, country_id, state_id, name)
  TABLESPACE pg_default;

COMMIT;
