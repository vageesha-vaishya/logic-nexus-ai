-- Phase 6 Step 57 — core.gen_dual_write_trigger() codegen.
--
-- Companion to Step 55's emit-trigger codegen. Every Phase 2/4/5/6
-- canonical-mirror dual-write follows the same shape (see
-- supabase/migrations/20260529300000_create_compliance_schema_and_
-- base_tables.sql:154-188 for the existing reference pattern):
--
--   AFTER INSERT OR UPDATE OR DELETE ON <source>
--     DELETE  → DELETE FROM target WHERE id = OLD.id
--     INSERT  → INSERT INTO target SELECT NEW.* ON CONFLICT (id) DO NOTHING
--     UPDATE  → DELETE FROM target WHERE id = NEW.id;
--                INSERT INTO target SELECT NEW.*
--     EXCEPTION WHEN OTHERS → RAISE WARNING; RETURN
--
-- The 2026-06-01 audit identified 90+ table mirrors still needed:
-- amro (CREATE SCHEMA amro + 52 mirrors), uim (CREATE SCHEMA uim +
-- 23 mirrors), quotation (12 mirrors), finance (~10 missing tables).
-- Codegen makes each mirror a 2-line invocation instead of a 35-line
-- DO-block + format() ladder.
--
-- Spec (jsonb):
--   source_table     text  qualified, required (e.g. 'public.compliance_records')
--   target_table     text  qualified, required (e.g. 'compliance.records')
--   function_name    text  optional — defaults to
--                          <target_schema>.dual_write_from_<source_basename>
--   trigger_name     text  optional — defaults to
--                          trg_<source_basename>_dual_write_to_<target_schema>
--   conflict_action  text  optional — 'noop' (default; existing pattern)
--                          | 'replace' (DELETE+INSERT on conflict too;
--                          for tables where source rewrites land repeatedly).
--
-- Assumes id PK + identical column shape (the LIKE pattern used
-- across all current dual-writes). Column-mapped variants are a v2.

CREATE OR REPLACE FUNCTION core.gen_dual_write_trigger(p_spec jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_catalog
AS $outer$
DECLARE
  v_source_table    text := p_spec->>'source_table';
  v_target_table    text := p_spec->>'target_table';
  v_function_name   text := p_spec->>'function_name';
  v_trigger_name    text := p_spec->>'trigger_name';
  v_conflict_action text := COALESCE(p_spec->>'conflict_action', 'noop');

  v_source_schema  text;
  v_source_base    text;
  v_target_schema  text;
  v_target_base    text;

  v_insert_block text;
  v_fn_sql       text;
  v_warn_format  text;
BEGIN
  -- ──────────────────────────────────────────────────────────────────
  -- Validate
  -- ──────────────────────────────────────────────────────────────────
  IF v_source_table IS NULL OR v_target_table IS NULL THEN
    RAISE EXCEPTION 'gen_dual_write_trigger: source_table + target_table required';
  END IF;
  IF v_conflict_action NOT IN ('noop', 'replace') THEN
    RAISE EXCEPTION 'gen_dual_write_trigger: conflict_action must be noop|replace; got %', v_conflict_action;
  END IF;
  IF to_regclass(v_source_table) IS NULL THEN
    RAISE EXCEPTION 'gen_dual_write_trigger: source_table % not found', v_source_table;
  END IF;
  IF to_regclass(v_target_table) IS NULL THEN
    RAISE EXCEPTION 'gen_dual_write_trigger: target_table % not found', v_target_table;
  END IF;

  -- Parse schema + basename. Inputs are guaranteed qualified by the
  -- to_regclass checks above.
  v_source_schema := split_part(v_source_table, '.', 1);
  v_source_base   := split_part(v_source_table, '.', 2);
  v_target_schema := split_part(v_target_table, '.', 1);
  v_target_base   := split_part(v_target_table, '.', 2);

  -- Derive defaults
  IF v_function_name IS NULL THEN
    v_function_name := v_target_schema || '.dual_write_from_' || v_source_base;
  END IF;
  IF v_trigger_name IS NULL THEN
    v_trigger_name := 'trg_' || v_source_base || '_dual_write_to_' || v_target_schema;
  END IF;

  -- ──────────────────────────────────────────────────────────────────
  -- INSERT branch behavior
  -- ──────────────────────────────────────────────────────────────────
  IF v_conflict_action = 'noop' THEN
    v_insert_block :=
      'INSERT INTO ' || v_target_table || ' SELECT NEW.* ON CONFLICT (id) DO NOTHING;';
  ELSE  -- replace
    v_insert_block :=
      'DELETE FROM ' || v_target_table || ' WHERE id = NEW.id; '
      || 'INSERT INTO ' || v_target_table || ' SELECT NEW.*;';
  END IF;

  v_warn_format := v_function_name || ' (op=%, id=%) failed: %';

  -- ──────────────────────────────────────────────────────────────────
  -- Compose fn CREATE statement
  -- ──────────────────────────────────────────────────────────────────
  v_fn_sql :=
    'CREATE OR REPLACE FUNCTION ' || v_function_name || '() '
    || 'RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER '
    || 'SET search_path = ' || v_target_schema || ', pg_catalog '
    || 'AS $trg$ BEGIN '
    || 'IF TG_OP = ''DELETE'' THEN '
    ||   'DELETE FROM ' || v_target_table || ' WHERE id = OLD.id; '
    || 'ELSIF TG_OP = ''INSERT'' THEN '
    ||   v_insert_block || ' '
    || 'ELSIF TG_OP = ''UPDATE'' THEN '
    ||   'DELETE FROM ' || v_target_table || ' WHERE id = NEW.id; '
    ||   'INSERT INTO ' || v_target_table || ' SELECT NEW.*; '
    || 'END IF; '
    || 'RETURN COALESCE(NEW, OLD); '
    || 'EXCEPTION WHEN OTHERS THEN '
    || 'RAISE WARNING ' || quote_literal(v_warn_format) || ', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM; '
    || 'RETURN COALESCE(NEW, OLD); '
    || 'END; $trg$';

  -- ──────────────────────────────────────────────────────────────────
  -- Execute
  -- ──────────────────────────────────────────────────────────────────
  EXECUTE v_fn_sql;
  EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(v_trigger_name) || ' ON ' || v_source_table;
  EXECUTE 'CREATE TRIGGER ' || quote_ident(v_trigger_name)
       || ' AFTER INSERT OR UPDATE OR DELETE ON ' || v_source_table
       || ' FOR EACH ROW EXECUTE FUNCTION ' || v_function_name || '()';

  RAISE NOTICE 'gen_dual_write_trigger: created % (% → %)',
    v_function_name, v_source_table, v_target_table;
  RETURN 'created:' || v_function_name;
END;
$outer$;

COMMENT ON FUNCTION core.gen_dual_write_trigger(jsonb) IS
  'Phase 6 Step 57 — codegen for canonical-mirror dual-write triggers. Takes {source_table, target_table, [function_name], [trigger_name], [conflict_action]} and produces the AFTER INSERT|UPDATE|DELETE trigger that mirrors source→target. Assumes id PK + identical column shape. Companion to Step 55''s emit-trigger codegen.';

REVOKE EXECUTE ON FUNCTION core.gen_dual_write_trigger(jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION core.gen_dual_write_trigger(jsonb) TO service_role;
