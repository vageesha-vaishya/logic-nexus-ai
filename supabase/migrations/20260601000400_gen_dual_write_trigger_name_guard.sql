-- Phase 6 Step 59 — name-truncation guard for gen_dual_write_trigger.
--
-- Step 58 surfaced: the trigger name
--   trg_amro_predictive_maintenance_recommendations_dual_write_to_amro
-- is 66 chars; PG's NAMEDATALEN is 63, so the name was silently
-- truncated to '..._dual_write_to_a'. The trigger still fires
-- (dual-write works), but: (a) any LIKE-suffix automation
-- ('LIKE %_dual_write_to_amro') misses it, and (b) two long source
-- tables could collide on the same truncated prefix and the second
-- gen_dual_write_trigger call would silently overwrite the first.
--
-- This update replaces the codegen with a length-aware derivation:
--   1. Compute the long-form name (trg_<src>_dual_write_to_<tgt>).
--   2. If ≤63, use it (existing behavior).
--   3. Else compress to short form (trg_<src>_dw_<tgt>) — saves
--      11 chars. Same for function name (dual_write_from →
--      dual_write).
--   4. If STILL >63, append 8-char md5-hash suffix and trim
--      basename to fit.
--   5. If even that can't fit, RAISE with a clear error.
--
-- Then: drop the truncated trigger from Step 58 + re-invoke the
-- codegen so it gets the compressed name. Final state: 32 dual-write
-- triggers, all with consistent (long or compressed) naming.

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
  v_source_schema   text;
  v_source_base     text;
  v_target_schema   text;
  v_target_base     text;
  v_insert_block    text;
  v_fn_sql          text;
  v_warn_format     text;
  v_max_ident       constant integer := 63;
  v_hash            text;
BEGIN
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

  v_source_schema := split_part(v_source_table, '.', 1);
  v_source_base   := split_part(v_source_table, '.', 2);
  v_target_schema := split_part(v_target_table, '.', 1);
  v_target_base   := split_part(v_target_table, '.', 2);

  -- ──────────────────────────────────────────────────────────────────
  -- Name derivation with NAMEDATALEN guard
  -- ──────────────────────────────────────────────────────────────────
  -- Function name: <target_schema>.<basename>; the schema isn't part
  -- of the identifier length check (PG's 63-char limit is per-name).
  -- The basename below is the identifier that PG truncates.
  IF v_function_name IS NULL THEN
    -- Long form: dual_write_from_<source_base>
    IF length('dual_write_from_' || v_source_base) <= v_max_ident THEN
      v_function_name := v_target_schema || '.dual_write_from_' || v_source_base;
    -- Compressed: dw_from_<source_base>
    ELSIF length('dw_from_' || v_source_base) <= v_max_ident THEN
      v_function_name := v_target_schema || '.dw_from_' || v_source_base;
    ELSE
      -- Hash-suffix fallback. Take 8 chars of md5(source_base) and
      -- trim basename to fit alongside.
      v_hash := substring(md5(v_source_base) FROM 1 FOR 8);
      v_function_name := v_target_schema || '.dw_'
        || substring(v_source_base FROM 1 FOR v_max_ident - length('dw__' || v_hash))
        || '_' || v_hash;
      IF length(split_part(v_function_name, '.', 2)) > v_max_ident THEN
        RAISE EXCEPTION 'gen_dual_write_trigger: cannot derive a function name for source % under % chars even with hash suffix', v_source_base, v_max_ident;
      END IF;
    END IF;
  END IF;

  IF v_trigger_name IS NULL THEN
    -- Long form: trg_<source_base>_dual_write_to_<target_schema>
    IF length('trg_' || v_source_base || '_dual_write_to_' || v_target_schema) <= v_max_ident THEN
      v_trigger_name := 'trg_' || v_source_base || '_dual_write_to_' || v_target_schema;
    -- Compressed: trg_<source_base>_dw_<target_schema>
    ELSIF length('trg_' || v_source_base || '_dw_' || v_target_schema) <= v_max_ident THEN
      v_trigger_name := 'trg_' || v_source_base || '_dw_' || v_target_schema;
    ELSE
      v_hash := substring(md5(v_source_base) FROM 1 FOR 8);
      v_trigger_name := 'trg_'
        || substring(v_source_base FROM 1 FOR v_max_ident - length('trg__dw__' || v_target_schema || '_' || v_hash))
        || '_dw_' || v_target_schema || '_' || v_hash;
      IF length(v_trigger_name) > v_max_ident THEN
        RAISE EXCEPTION 'gen_dual_write_trigger: cannot derive a trigger name for source % → schema % under % chars even with hash suffix', v_source_base, v_target_schema, v_max_ident;
      END IF;
    END IF;
  END IF;

  -- Final safety net (covers caller-provided names too)
  IF length(split_part(v_function_name, '.', 2)) > v_max_ident THEN
    RAISE EXCEPTION 'gen_dual_write_trigger: function_name basename % exceeds % chars', split_part(v_function_name, '.', 2), v_max_ident;
  END IF;
  IF length(v_trigger_name) > v_max_ident THEN
    RAISE EXCEPTION 'gen_dual_write_trigger: trigger_name % exceeds % chars', v_trigger_name, v_max_ident;
  END IF;

  IF v_conflict_action = 'noop' THEN
    v_insert_block := 'INSERT INTO ' || v_target_table || ' SELECT NEW.* ON CONFLICT (id) DO NOTHING;';
  ELSE
    v_insert_block := 'DELETE FROM ' || v_target_table || ' WHERE id = NEW.id; '
                   || 'INSERT INTO ' || v_target_table || ' SELECT NEW.*;';
  END IF;

  v_warn_format := v_function_name || ' (op=%, id=%) failed: %';

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

  EXECUTE v_fn_sql;
  EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(v_trigger_name) || ' ON ' || v_source_table;
  EXECUTE 'CREATE TRIGGER ' || quote_ident(v_trigger_name)
       || ' AFTER INSERT OR UPDATE OR DELETE ON ' || v_source_table
       || ' FOR EACH ROW EXECUTE FUNCTION ' || v_function_name || '()';

  RAISE NOTICE 'gen_dual_write_trigger: created % (% → %)', v_function_name, v_source_table, v_target_table;
  RETURN 'created:' || v_function_name;
END;
$outer$;

COMMENT ON FUNCTION core.gen_dual_write_trigger(jsonb) IS
  'Phase 6 Step 57 + Step 59 — codegen for canonical-mirror dual-write triggers with NAMEDATALEN-aware name derivation. Long form (dual_write_to_) used when it fits; compressed (dw_) when long form exceeds 63; md5-hash fallback otherwise.';

-- ══════════════════════════════════════════════════════════════════════
-- Fix Step 58 fallout: drop truncated trigger + regenerate compressed
-- ══════════════════════════════════════════════════════════════════════

-- Drop the truncated trigger explicitly (it has the 63-char truncated name).
DO $cleanup$
DECLARE
  v_trigger_name text;
BEGIN
  SELECT t.tgname INTO v_trigger_name
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public'
    AND c.relname='amro_predictive_maintenance_recommendations'
    AND t.tgname LIKE 'trg_amro_predictive_maintenance_recommendations_dual_write_to%'
    AND NOT t.tgisinternal
  LIMIT 1;

  IF v_trigger_name IS NOT NULL THEN
    EXECUTE format('DROP TRIGGER %I ON public.amro_predictive_maintenance_recommendations', v_trigger_name);
    RAISE NOTICE 'dropped truncated trigger %', v_trigger_name;

    -- Also drop the orphan function. Name is well-defined because it didn't
    -- have a separator-prefix problem (functions in PG ≥10 fit within 63
    -- because schema prefix doesn't count toward identifier length).
    DROP FUNCTION IF EXISTS amro.dual_write_from_amro_predictive_maintenance_recommendations() CASCADE;
  END IF;
END $cleanup$;

-- Regenerate using the new length-aware codegen
SELECT core.gen_dual_write_trigger(jsonb_build_object(
  'source_table', 'public.amro_predictive_maintenance_recommendations',
  'target_table', 'amro.predictive_maintenance_recommendations'
));
