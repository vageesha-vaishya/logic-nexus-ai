-- Phase 6 Step 55 — core.gen_emit_trigger() codegen for status-
-- transition emit triggers.
--
-- Every emit trigger we've shipped (Steps 5, 19, 28, 42, 53, 54)
-- follows the same skeleton: status-transition guard, skip-if-null
-- recipient guard, INSERT into core.outbox or core.notifications,
-- EXCEPTION WHEN OTHERS RAISE WARNING. ~15-20 more triggers are
-- needed per the 2026-06-01 §10 audit; copy-paste drift is the
-- biggest regression risk. This codegen produces both shapes from
-- one fn so drift becomes structurally impossible.
--
-- Spec (jsonb): trigger_name, function_name, source_table,
-- transition_column, terminal_value, skip_if_null_cols (text[]),
-- emit_to ('outbox'|'notifications'), payload_cols (text[]).
-- Outbox-specific: module, entity_type, event_type.
-- Notifications-specific: intent_kind, subject_type, recipient_col,
-- severity, subject_template, html_template.

CREATE OR REPLACE FUNCTION core.gen_emit_trigger(p_spec jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_catalog
AS $outer$
DECLARE
  v_trigger_name      text := p_spec->>'trigger_name';
  v_function_name     text := p_spec->>'function_name';
  v_source_table      text := p_spec->>'source_table';
  v_transition_col    text := p_spec->>'transition_column';
  v_terminal_value    text := p_spec->>'terminal_value';
  v_skip_if_null_cols text[] := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(p_spec->'skip_if_null_cols')),
    ARRAY[]::text[]
  );
  v_emit_to           text := p_spec->>'emit_to';
  v_payload_cols      text[] := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(p_spec->'payload_cols')),
    ARRAY[]::text[]
  );
  v_module      text := p_spec->>'module';
  v_entity_type text := p_spec->>'entity_type';
  v_event_type  text := p_spec->>'event_type';
  v_intent_kind     text := p_spec->>'intent_kind';
  v_subject_type    text := p_spec->>'subject_type';
  v_recipient_col   text := p_spec->>'recipient_col';
  v_severity        text := p_spec->>'severity';
  v_subject_tmpl    text := p_spec->>'subject_template';
  v_html_tmpl       text := p_spec->>'html_template';
  v_skip_clauses  text := '';
  v_payload_pairs text := '';
  v_emit_block    text;
  v_fn_sql        text;
  v_col           text;
  v_recipient_expr text;
  v_warn_format   text;
BEGIN
  -- Validate
  IF v_trigger_name IS NULL OR v_function_name IS NULL OR v_source_table IS NULL
     OR v_transition_col IS NULL OR v_terminal_value IS NULL THEN
    RAISE EXCEPTION 'gen_emit_trigger: trigger_name, function_name, source_table, transition_column, terminal_value all required';
  END IF;
  IF v_emit_to NOT IN ('outbox', 'notifications') THEN
    RAISE EXCEPTION 'gen_emit_trigger: emit_to must be outbox|notifications; got %', v_emit_to;
  END IF;
  IF v_emit_to = 'outbox' AND (v_module IS NULL OR v_entity_type IS NULL OR v_event_type IS NULL) THEN
    RAISE EXCEPTION 'gen_emit_trigger: outbox emit requires module + entity_type + event_type';
  END IF;
  IF v_emit_to = 'notifications' AND (v_intent_kind IS NULL OR v_subject_type IS NULL OR v_severity IS NULL) THEN
    RAISE EXCEPTION 'gen_emit_trigger: notifications emit requires intent_kind + subject_type + severity';
  END IF;

  -- Build skip-if-null clauses
  FOREACH v_col IN ARRAY v_skip_if_null_cols LOOP
    v_skip_clauses := v_skip_clauses
      || '  IF NEW.' || quote_ident(v_col) || ' IS NULL THEN RETURN NEW; END IF;' || chr(10);
  END LOOP;

  -- Build payload jsonb_build_object pairs
  FOR i IN 1..GREATEST(COALESCE(array_length(v_payload_cols, 1), 0), 0) LOOP
    v_col := v_payload_cols[i];
    IF length(v_payload_pairs) > 0 THEN v_payload_pairs := v_payload_pairs || ', '; END IF;
    v_payload_pairs := v_payload_pairs || quote_literal(v_col) || ', NEW.' || quote_ident(v_col);
  END LOOP;
  IF v_emit_to = 'notifications' AND v_subject_tmpl IS NOT NULL THEN
    IF length(v_payload_pairs) > 0 THEN v_payload_pairs := v_payload_pairs || ', '; END IF;
    v_payload_pairs := v_payload_pairs || quote_literal('subject') || ', ' || quote_literal(v_subject_tmpl);
  END IF;
  IF v_emit_to = 'notifications' AND v_html_tmpl IS NOT NULL THEN
    IF length(v_payload_pairs) > 0 THEN v_payload_pairs := v_payload_pairs || ', '; END IF;
    v_payload_pairs := v_payload_pairs || quote_literal('html') || ', ' || quote_literal(v_html_tmpl);
  END IF;
  IF length(v_payload_pairs) = 0 THEN
    -- jsonb_build_object() needs an even arg count; empty payload = empty object
    v_payload_pairs := '';
  END IF;

  -- Build emit INSERT block
  IF v_emit_to = 'outbox' THEN
    v_emit_block :=
      '  INSERT INTO core.outbox (id, tenant_id, module, entity_type, event_type, entity_id, occurred_at, version, payload, metadata) '
      || 'VALUES (gen_random_uuid(), NEW.tenant_id, '
      || quote_literal(v_module) || ', '
      || quote_literal(v_entity_type) || ', '
      || quote_literal(v_event_type) || ', '
      || 'NEW.id, now(), 1, jsonb_build_object(' || v_payload_pairs || '), '
      || 'jsonb_build_object(' || quote_literal('source') || ', ' || quote_literal(v_source_table)
      || ', ' || quote_literal('trigger') || ', ' || quote_literal(v_function_name) || '));';
  ELSE
    v_recipient_expr := CASE WHEN v_recipient_col IS NULL THEN 'NULL'
                             ELSE 'NEW.' || quote_ident(v_recipient_col) END;
    v_emit_block :=
      '  INSERT INTO core.notifications (tenant_id, recipient_party_id, subject_type, subject_id, intent_kind, severity, payload, correlation_id) '
      || 'VALUES (NEW.tenant_id, ' || v_recipient_expr || ', '
      || quote_literal(v_subject_type) || ', NEW.id, '
      || quote_literal(v_intent_kind) || ', '
      || quote_literal(v_severity) || ', jsonb_build_object(' || v_payload_pairs || '), '
      || 'gen_random_uuid());';
  END IF;

  -- Warning message format string (RAISE WARNING uses %)
  v_warn_format := v_function_name || ' (id=%, tenant=%) failed: %';

  -- Build complete CREATE FUNCTION SQL
  v_fn_sql :=
    'CREATE OR REPLACE FUNCTION ' || v_function_name || '() '
    || 'RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER '
    || 'SET search_path = core, public, pg_catalog '
    || 'AS $trg$ BEGIN '
    || 'IF NEW.' || quote_ident(v_transition_col) || ' IS DISTINCT FROM ' || quote_literal(v_terminal_value) || ' THEN RETURN NEW; END IF; '
    || 'IF TG_OP = ''UPDATE'' AND OLD.' || quote_ident(v_transition_col) || ' = ' || quote_literal(v_terminal_value) || ' THEN RETURN NEW; END IF; '
    || v_skip_clauses
    || v_emit_block
    || ' RETURN NEW; '
    || 'EXCEPTION WHEN OTHERS THEN '
    || 'RAISE WARNING ' || quote_literal(v_warn_format) || ', NEW.id, NEW.tenant_id, SQLERRM; '
    || 'RETURN NEW; '
    || 'END; $trg$';

  -- Execute the generated CREATE FUNCTION + DROP/CREATE TRIGGER
  EXECUTE v_fn_sql;
  EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(v_trigger_name) || ' ON ' || v_source_table;
  EXECUTE 'CREATE TRIGGER ' || quote_ident(v_trigger_name)
       || ' AFTER INSERT OR UPDATE OF ' || quote_ident(v_transition_col)
       || ' ON ' || v_source_table
       || ' FOR EACH ROW WHEN (NEW.' || quote_ident(v_transition_col) || ' = ' || quote_literal(v_terminal_value) || ')'
       || ' EXECUTE FUNCTION ' || v_function_name || '()';

  RAISE NOTICE 'gen_emit_trigger: created % on %', v_function_name, v_source_table;
  RETURN 'created:' || v_function_name;
END;
$outer$;

COMMENT ON FUNCTION core.gen_emit_trigger(jsonb) IS
  'Phase 6 Step 55 — codegen for status-transition emit triggers. Takes a declarative jsonb spec and produces either an outbox-emit or notifications-emit trigger via EXECUTE. Eliminates copy-paste drift across ~15-20 remaining emit triggers identified by the 2026-06-01 §10 audit.';

REVOKE EXECUTE ON FUNCTION core.gen_emit_trigger(jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION core.gen_emit_trigger(jsonb) TO service_role;
