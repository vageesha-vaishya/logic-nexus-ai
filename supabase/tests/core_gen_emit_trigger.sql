-- Phase 6 Step 55 — smoke test for core.gen_emit_trigger() codegen.
--
-- Asserts:
--   A1. Generating an outbox-emit trigger returns 'created:<fn_name>'.
--   A2. The generated trigger fires on the terminal status transition
--       and writes a core.outbox row with the correct payload columns.
--   A3. Generating a notifications-emit trigger on the same table
--       (different terminal value) also returns 'created:'.
--   A4. The skip-if-null guard suppresses the emit when the referenced
--       column is NULL.
--   A5. Setting the column non-NULL and re-transitioning fires the
--       notification with correct intent_kind / severity / payload /
--       subject_template.
--
-- Self-cleaning: creates a synthetic smoke_test schema + widgets table,
-- DROPs the schema CASCADE at the end.

DO $smoke$
DECLARE
  v_tenant uuid;
  v_row_id uuid;
  v_party_id uuid := gen_random_uuid();
  v_result text;
  v_outbox_count integer; v_notif_count integer;
  v_notif_intent text; v_notif_severity text;
  v_outbox_payload jsonb; v_notif_payload jsonb;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;

  CREATE SCHEMA IF NOT EXISTS smoke_test;
  CREATE TABLE smoke_test.widgets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    customer_id uuid,
    number text,
    amount numeric
  );

  -- A1: outbox codegen
  SELECT core.gen_emit_trigger(jsonb_build_object(
    'trigger_name',      'trg_smoke_widget_shipped',
    'function_name',     'smoke_test.emit_widget_shipped',
    'source_table',      'smoke_test.widgets',
    'transition_column', 'status',
    'terminal_value',    'shipped',
    'emit_to',           'outbox',
    'module',            'smoke',
    'entity_type',       'widget',
    'event_type',        'smoke.widget.shipped',
    'payload_cols',      jsonb_build_array('id', 'number', 'amount')
  )) INTO v_result;
  IF v_result <> 'created:smoke_test.emit_widget_shipped' THEN RAISE EXCEPTION 'A1: %', v_result; END IF;
  RAISE NOTICE 'A1 OK';

  -- A2: outbox trigger fires + payload correct
  INSERT INTO smoke_test.widgets (tenant_id, number, amount) VALUES (v_tenant, 'W-1', 99.99) RETURNING id INTO v_row_id;
  UPDATE smoke_test.widgets SET status='shipped' WHERE id=v_row_id;
  SELECT count(*)::integer INTO v_outbox_count FROM core.outbox WHERE entity_id=v_row_id AND event_type='smoke.widget.shipped';
  SELECT payload INTO v_outbox_payload FROM core.outbox WHERE entity_id=v_row_id AND event_type='smoke.widget.shipped' ORDER BY occurred_at DESC LIMIT 1;
  IF v_outbox_count <> 1 THEN RAISE EXCEPTION 'A2 count=%', v_outbox_count; END IF;
  IF (v_outbox_payload->>'number') <> 'W-1' THEN RAISE EXCEPTION 'A2 number'; END IF;
  IF (v_outbox_payload->>'amount')::numeric <> 99.99 THEN RAISE EXCEPTION 'A2 amount'; END IF;
  RAISE NOTICE 'A2 OK';

  -- A3: notifications codegen
  SELECT core.gen_emit_trigger(jsonb_build_object(
    'trigger_name',      'trg_smoke_widget_failed',
    'function_name',     'smoke_test.emit_widget_failed',
    'source_table',      'smoke_test.widgets',
    'transition_column', 'status',
    'terminal_value',    'failed',
    'skip_if_null_cols', jsonb_build_array('customer_id'),
    'emit_to',           'notifications',
    'intent_kind',       'smoke.widget.failed',
    'subject_type',      'smoke.widget',
    'recipient_col',     'customer_id',
    'severity',          'critical',
    'payload_cols',      jsonb_build_array('id', 'number'),
    'subject_template',  'Widget failed',
    'html_template',     '<p>Widget failed.</p>'
  )) INTO v_result;
  IF v_result <> 'created:smoke_test.emit_widget_failed' THEN RAISE EXCEPTION 'A3: %', v_result; END IF;
  RAISE NOTICE 'A3 OK';

  -- A4: skip-if-null (customer_id is NULL) suppresses emit
  UPDATE smoke_test.widgets SET status='failed' WHERE id=v_row_id;
  SELECT count(*)::integer INTO v_notif_count FROM core.notifications WHERE subject_type='smoke.widget' AND subject_id=v_row_id;
  IF v_notif_count <> 0 THEN RAISE EXCEPTION 'A4 count=%', v_notif_count; END IF;
  RAISE NOTICE 'A4 OK';

  -- A5: set non-NULL, re-transition, emit fires correctly
  UPDATE smoke_test.widgets SET status='draft', customer_id=v_party_id WHERE id=v_row_id;
  UPDATE smoke_test.widgets SET status='failed' WHERE id=v_row_id;
  SELECT count(*)::integer INTO v_notif_count FROM core.notifications WHERE subject_type='smoke.widget' AND subject_id=v_row_id;
  SELECT intent_kind, severity, payload INTO v_notif_intent, v_notif_severity, v_notif_payload
  FROM core.notifications WHERE subject_type='smoke.widget' AND subject_id=v_row_id ORDER BY created_at DESC LIMIT 1;
  IF v_notif_count <> 1 THEN RAISE EXCEPTION 'A5 count=%', v_notif_count; END IF;
  IF v_notif_intent <> 'smoke.widget.failed' THEN RAISE EXCEPTION 'A5 intent'; END IF;
  IF v_notif_severity <> 'critical' THEN RAISE EXCEPTION 'A5 severity'; END IF;
  IF (v_notif_payload->>'subject') <> 'Widget failed' THEN RAISE EXCEPTION 'A5 subject'; END IF;
  RAISE NOTICE 'A5 OK';

  DELETE FROM core.outbox WHERE entity_id=v_row_id AND event_type LIKE 'smoke.%';
  DELETE FROM core.notifications WHERE subject_type='smoke.widget' AND subject_id=v_row_id;
  DROP SCHEMA smoke_test CASCADE;

  RAISE NOTICE '=== gen_emit_trigger SMOKE PASSED (5/5) ===';
END;
$smoke$;
