-- Support batch directive id matching for flypal.flypal_configured_directives
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: not-required-no-create-table

BEGIN;

CREATE SCHEMA IF NOT EXISTS flypal;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'flypal'
      AND table_name = 'flypal_configured_directives'
      AND column_name = 'processed_on'
      AND data_type = 'date'
  ) THEN
    ALTER TABLE flypal.flypal_configured_directives
      ALTER COLUMN processed_on TYPE timestamptz
      USING processed_on::timestamptz;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_pending_match
  ON flypal.flypal_configured_directives (
    tenant_id,
    assembly_models,
    directive_no,
    reference_amp,
    category_code,
    ata_code
  )
  WHERE coalesce(is_row_processed_success, false) = false;

CREATE INDEX IF NOT EXISTS idx_directives_match_lookup
  ON public.directives (
    tenant_id,
    assembly_models,
    directive_no,
    reference_amp,
    category_code,
    ata_code
  );

COMMENT ON COLUMN flypal.flypal_configured_directives.processed_on IS
  'Timestamp of last matching/processing attempt for configured directives.';

CREATE OR REPLACE FUNCTION public.flypal_configured_directives_id_match_batch(
  p_batch_size integer DEFAULT 1000
)
RETURNS TABLE (
  row_id text,
  is_success boolean,
  failure_reason text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, flypal
AS $$
  WITH candidate_rows AS (
    SELECT
      f.id,
      f.tenant_id,
      f.assembly_models,
      f.directive_no,
      f.reference_amp,
      f.category_code,
      f.ata_code
    FROM flypal.flypal_configured_directives f
    WHERE coalesce(f.is_row_processed_success, false) = false
    ORDER BY f.frequency_sequence ASC NULLS LAST, f.id ASC
    LIMIT greatest(1, least(coalesce(p_batch_size, 1000), 5000))
    FOR UPDATE SKIP LOCKED
  ),
  matched AS (
    SELECT
      c.id AS cfg_id,
      count(d.id) AS match_count,
      (array_agg(d.id ORDER BY d.id))[1] AS matched_directive_id
    FROM candidate_rows c
    LEFT JOIN public.directives d
      ON d.tenant_id IS NOT DISTINCT FROM c.tenant_id
     AND d.assembly_models IS NOT DISTINCT FROM c.assembly_models
     AND d.directive_no IS NOT DISTINCT FROM c.directive_no
     AND d.reference_amp IS NOT DISTINCT FROM c.reference_amp
     AND d.category_code IS NOT DISTINCT FROM c.category_code
     AND d.ata_code IS NOT DISTINCT FROM c.ata_code
    GROUP BY c.id
  ),
  updated AS (
    UPDATE flypal.flypal_configured_directives f
    SET
      directive_id = CASE
        WHEN m.match_count = 1 THEN m.matched_directive_id
        ELSE NULL
      END,
      is_row_processed_success = (m.match_count = 1),
      failure_reason = CASE
        WHEN m.match_count = 1 THEN NULL
        WHEN m.match_count = 0 THEN 'No matching directives row found'
        ELSE format('Multiple directives rows matched (%s)', m.match_count)
      END,
      processed_on = now()
    FROM matched m
    WHERE f.id = m.cfg_id
    RETURNING
      f.id::text AS row_id,
      f.is_row_processed_success AS is_success,
      f.failure_reason
  )
  SELECT
    u.row_id,
    u.is_success,
    u.failure_reason
  FROM updated u;
$$;

REVOKE ALL ON FUNCTION public.flypal_configured_directives_id_match_batch(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flypal_configured_directives_id_match_batch(integer) TO service_role;

COMMIT;
