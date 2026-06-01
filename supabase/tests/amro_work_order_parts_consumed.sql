-- Phase 6 Step 64 — smoke test for amro.work_order.parts_consumed
-- outbox emitter.
--
-- Asserts:
--   A0. Inserting a work_order_materials row with status='pending'
--       does NOT emit (only the installed transition does).
--   A1. UPDATE status='installed' emits exactly one outbox row.
--   A2. Payload carries work_order_id, part_number, quantity, etc.
--       (the 14 columns in the codegen spec).
--   A3. A second UPDATE that doesn't change status doesn't double-emit.
--   A4. installed → pending → installed re-transition re-emits.
--   A5. The new row surfaces in core.v_cross_module_pending_events.
--
-- Self-cleaning (DELETEs both amro.* mirror and public.* source rows
-- since the dual-write trigger mirrors deletions too).

DO $smoke$
DECLARE
  v_tenant uuid; v_wo_id uuid := gen_random_uuid(); v_mat_id uuid := gen_random_uuid();
  v_outbox_count integer;
  v_outbox_payload jsonb;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;

  INSERT INTO amro.work_order_materials
    (id, tenant_id, work_order_id, part_number, description, quantity, unit_of_measure, status)
  VALUES
    (v_mat_id, v_tenant, v_wo_id, 'SMOKE-PART-001', 'smoke part', 3, 'EA', 'pending');

  SELECT count(*)::integer INTO v_outbox_count
  FROM core.outbox WHERE event_type='amro.work_order.parts_consumed' AND entity_id=v_mat_id;
  IF v_outbox_count <> 0 THEN RAISE EXCEPTION 'A0 expected 0, got %', v_outbox_count; END IF;
  RAISE NOTICE 'A0 OK — no emit on status=pending';

  UPDATE amro.work_order_materials SET status='installed' WHERE id=v_mat_id;
  SELECT count(*)::integer INTO v_outbox_count
  FROM core.outbox WHERE event_type='amro.work_order.parts_consumed' AND entity_id=v_mat_id;
  IF v_outbox_count <> 1 THEN RAISE EXCEPTION 'A1 count=%', v_outbox_count; END IF;
  RAISE NOTICE 'A1 OK — emit on status→installed';

  SELECT payload INTO v_outbox_payload FROM core.outbox
  WHERE event_type='amro.work_order.parts_consumed' AND entity_id=v_mat_id
  ORDER BY occurred_at DESC LIMIT 1;
  IF (v_outbox_payload->>'work_order_id')::uuid <> v_wo_id THEN RAISE EXCEPTION 'A2 wo_id'; END IF;
  IF v_outbox_payload->>'part_number' <> 'SMOKE-PART-001' THEN RAISE EXCEPTION 'A2 part_number'; END IF;
  IF (v_outbox_payload->>'quantity')::integer <> 3 THEN RAISE EXCEPTION 'A2 quantity'; END IF;
  RAISE NOTICE 'A2 OK — payload shape';

  UPDATE amro.work_order_materials SET notes='ping' WHERE id=v_mat_id;
  SELECT count(*)::integer INTO v_outbox_count
  FROM core.outbox WHERE event_type='amro.work_order.parts_consumed' AND entity_id=v_mat_id;
  IF v_outbox_count <> 1 THEN RAISE EXCEPTION 'A3 double-emit count=%', v_outbox_count; END IF;
  RAISE NOTICE 'A3 OK — no double-emit on no-op UPDATE';

  UPDATE amro.work_order_materials SET status='pending' WHERE id=v_mat_id;
  UPDATE amro.work_order_materials SET status='installed' WHERE id=v_mat_id;
  SELECT count(*)::integer INTO v_outbox_count
  FROM core.outbox WHERE event_type='amro.work_order.parts_consumed' AND entity_id=v_mat_id;
  IF v_outbox_count <> 2 THEN RAISE EXCEPTION 'A4 count=%', v_outbox_count; END IF;
  RAISE NOTICE 'A4 OK — re-transition re-emits';

  PERFORM 1 FROM core.v_cross_module_pending_events
  WHERE event_type='amro.work_order.parts_consumed' AND entity_id=v_mat_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'A5 not in pending-events view'; END IF;
  RAISE NOTICE 'A5 OK — visible in v_cross_module_pending_events';

  DELETE FROM core.outbox WHERE entity_id=v_mat_id AND event_type='amro.work_order.parts_consumed';
  DELETE FROM amro.work_order_materials WHERE id=v_mat_id;
  DELETE FROM public.amro_work_order_materials WHERE id=v_mat_id;

  RAISE NOTICE '=== parts_consumed emitter SMOKE PASSED (5/5) ===';
END;
$smoke$;
