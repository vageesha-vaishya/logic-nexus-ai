-- Phase 1 Slice B Part 2 — shadow-write trigger #15/17
-- public.engine_seed_audit_runs → core.audit_log
--
-- Source schema (per migration 20260404100000_amro_auto_0m3ija_engine_*):
--   id, tenant_id NOT NULL ✓, franchise_id, aircraft_id NOT NULL ✓,
--   seed_label, iteration_no, execution_ms, parameter_count,
--   maintenance_count, performance_count, benchmark_payload jsonb,
--   created_at, created_by
--
-- This is an internal-tool audit (engine seed/benchmark runs against an
-- aircraft). Source has no `action` column — synthesise `'engine_seed_run'`.
-- Low-priority operational audit but worth capturing for reproducibility
-- of seed-data baselines.
--
-- subject_type = 'amro.aircraft'  (the aircraft the seed ran against)
-- subject_id   = aircraft_id
-- action       = 'engine_seed_run'  (synthetic)
-- diff         = NULL
-- metadata     = benchmark_payload + {seed_label, iteration_no, execution_ms,
--                parameter_count, maintenance_count, performance_count, franchise_id}

CREATE OR REPLACE FUNCTION core.shadow_write_from_engine_seed_audit_runs()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.aircraft_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO core.audit_log (
    tenant_id,
    occurred_at,
    actor_user_id,
    actor_kind,
    subject_type,
    subject_id,
    action,
    diff,
    metadata,
    shadow_source_table,
    shadow_source_id,
    retention_class
  ) VALUES (
    NEW.tenant_id,
    NEW.created_at,
    NEW.created_by,
    CASE WHEN NEW.created_by IS NULL THEN 'service' ELSE 'user' END,
    'amro.aircraft',
    NEW.aircraft_id,
    'engine_seed_run',                                              -- synthetic action; source has no action column
    NULL,
    COALESCE(NEW.benchmark_payload, '{}'::jsonb) ||
    jsonb_strip_nulls(jsonb_build_object(
      'seed_label',         NEW.seed_label,
      'iteration_no',       NEW.iteration_no,
      'execution_ms',       NEW.execution_ms,
      'parameter_count',    NEW.parameter_count,
      'maintenance_count',  NEW.maintenance_count,
      'performance_count',  NEW.performance_count,
      'franchise_id',       NEW.franchise_id
    )),
    'public.engine_seed_audit_runs',
    NEW.id::text,
    -- Internal benchmarking — 2 years is plenty for trend analysis.
    'general_2y'
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'shadow_write_from_engine_seed_audit_runs failed for source id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_engine_seed_audit_runs_shadow_to_core
  AFTER INSERT ON public.engine_seed_audit_runs
  FOR EACH ROW EXECUTE FUNCTION core.shadow_write_from_engine_seed_audit_runs();

CREATE OR REPLACE FUNCTION core.audit_shadow_parity_engine_seed_audit_runs(
  p_start timestamptz,
  p_end   timestamptz
) RETURNS TABLE (
  source_rows        bigint,
  shadow_rows        bigint,
  unshadowed_rows    bigint,
  shadow_unique_rows bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
  WITH
    src AS (
      SELECT id::text AS src_id
      FROM public.engine_seed_audit_runs
      WHERE created_at >= p_start AND created_at < p_end
        AND tenant_id IS NOT NULL AND aircraft_id IS NOT NULL
    ),
    shadow AS (
      SELECT shadow_source_id AS src_id
      FROM core.audit_log
      WHERE occurred_at >= p_start AND occurred_at < p_end
        AND shadow_source_table = 'public.engine_seed_audit_runs'
    )
  SELECT
    (SELECT count(*) FROM src),
    (SELECT count(*) FROM shadow),
    (SELECT count(*) FROM src WHERE src_id NOT IN (SELECT src_id FROM shadow)),
    (SELECT count(*) FROM shadow WHERE src_id NOT IN (SELECT src_id FROM src));
$$;

GRANT EXECUTE ON FUNCTION core.audit_shadow_parity_engine_seed_audit_runs
  TO service_role, authenticated;
