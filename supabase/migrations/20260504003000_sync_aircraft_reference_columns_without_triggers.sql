-- DB-VERIFICATION: aircraft-reference-column-sync-reviewed-without-triggers
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- Guardrails: required tables must exist before installing sync mechanism.
DO $$
BEGIN
  IF to_regclass('public.aircraft') IS NULL THEN
    RAISE EXCEPTION 'Table public.aircraft does not exist.';
  END IF;
  IF to_regclass('public.aircraft_operators') IS NULL THEN
    RAISE EXCEPTION 'Table public.aircraft_operators does not exist.';
  END IF;
  IF to_regclass('public.aircraft_owners') IS NULL THEN
    RAISE EXCEPTION 'Table public.aircraft_owners does not exist.';
  END IF;
  IF to_regclass('public.airports') IS NULL THEN
    RAISE EXCEPTION 'Table public.airports does not exist.';
  END IF;
END
$$;

-- SQL-first synchronization function (no triggers).
-- Keeps aircraft.operator_code and aircraft.base_location aligned with selected UUID references.
-- Also nulls aircraft.aircraft_owners_id when it points to a cross-tenant or missing owner row.
CREATE OR REPLACE FUNCTION public.sync_aircraft_reference_columns(
  p_tenant_id uuid DEFAULT NULL,
  p_aircraft_ids uuid[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH resolved AS (
    SELECT
      a.id,
      (
        SELECT ao.operator_code
        FROM public.aircraft_operators ao
        WHERE ao.id = a.aircraft_operators_id
          AND ao.tenant_id = a.tenant_id
          AND (
            a.franchise_id IS NULL
            OR ao.franchise_id IS NULL
            OR ao.franchise_id = a.franchise_id
          )
        LIMIT 1
      ) AS resolved_operator_code,
      (
        SELECT COALESCE(
          NULLIF(UPPER(BTRIM(ap.iata_code)), ''),
          NULLIF(UPPER(BTRIM(ap.icao_code)), ''),
          NULLIF(BTRIM(ap.name), '')
        )
        FROM public.airports ap
        WHERE ap.id = a.aircraft_base_location_id
          AND ap.tenant_id = a.tenant_id
          AND (
            a.franchise_id IS NULL
            OR ap.franchise_id IS NULL
            OR ap.franchise_id = a.franchise_id
          )
        LIMIT 1
      ) AS resolved_base_location,
      (
        SELECT ow.id
        FROM public.aircraft_owners ow
        WHERE ow.id = a.aircraft_owners_id
          AND ow.tenant_id = a.tenant_id
          AND (
            a.franchise_id IS NULL
            OR ow.franchise_id IS NULL
            OR ow.franchise_id = a.franchise_id
          )
        LIMIT 1
      ) AS resolved_owner_id
    FROM public.aircraft a
    WHERE (p_tenant_id IS NULL OR a.tenant_id = p_tenant_id)
      AND (p_aircraft_ids IS NULL OR a.id = ANY (p_aircraft_ids))
  ),
  changed AS (
    SELECT
      r.id,
      r.resolved_operator_code,
      r.resolved_base_location,
      r.resolved_owner_id
    FROM resolved r
    JOIN public.aircraft a ON a.id = r.id
    WHERE a.operator_code IS DISTINCT FROM r.resolved_operator_code
       OR a.base_location IS DISTINCT FROM r.resolved_base_location
       OR a.aircraft_owners_id IS DISTINCT FROM r.resolved_owner_id
  )
  UPDATE public.aircraft a
  SET
    operator_code = c.resolved_operator_code,
    base_location = c.resolved_base_location,
    aircraft_owners_id = c.resolved_owner_id
  FROM changed c
  WHERE a.id = c.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.sync_aircraft_reference_columns(uuid, uuid[])
IS 'Synchronizes aircraft.operator_code, aircraft.base_location, and aircraft.aircraft_owners_id from UUID reference columns without using triggers.';

-- Initial backfill so existing rows become consistent immediately.
SELECT public.sync_aircraft_reference_columns();

-- Optional automatic sync cadence using pg_cron (if extension is available and permitted).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'sync-aircraft-reference-columns'
    ) THEN
      PERFORM cron.schedule(
        'sync-aircraft-reference-columns',
        '*/2 * * * *',
        'SELECT public.sync_aircraft_reference_columns();'
      );
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron schedule was not installed: %', SQLERRM;
END
$$;

-- Validation output for migration logs.
SELECT
  public.sync_aircraft_reference_columns() AS updated_rows_after_install,
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'sync_aircraft_reference_columns'
  ) AS sync_function_exists;

COMMIT;

-- Canonical SQL pattern for application writes (no trigger dependency):
-- WITH upserted AS (
--   INSERT INTO public.aircraft (...)
--   VALUES (...)
--   ON CONFLICT (id) DO UPDATE SET ...
--   RETURNING id
-- )
-- SELECT public.sync_aircraft_reference_columns(NULL, ARRAY(SELECT id FROM upserted));
