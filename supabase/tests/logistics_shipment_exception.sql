-- Phase 6 Step 54 — smoke test for logistics.shipment.exception emit.
--
-- Asserts:
--   A1. UPDATE public.shipments SET status='exception' on an in_transit
--       shipment inserts exactly one core.notifications row.
--   A2. recipient_party_id = account_id (the customer), severity =
--       'critical', payload carries shipment_id/number/route/ETA/etc,
--       subject is the dunning-style summary.
--   A3. An UPDATE that DOESN'T change status doesn't double-emit.
--   A4. Transition out (in_transit) and back (exception) re-emits.
--
-- Note: shipment_type enum is ocean_freight | air_freight |
-- inland_trucking | railway_transport | courier | movers_packers
-- (not 'ocean' — caught on first run). The test uses ocean_freight.

DO $$
DECLARE
  v_tenant uuid; v_franchise uuid;
  v_account_id uuid; v_shipment_id uuid;
  v_count integer; v_recipient uuid; v_payload jsonb; v_severity text;
BEGIN
  SELECT t.id, f.id INTO v_tenant, v_franchise
  FROM public.tenants t JOIN public.franchises f ON f.tenant_id=t.id
  ORDER BY t.created_at, f.created_at LIMIT 1;

  INSERT INTO public.accounts (tenant_id, franchise_id, name)
  VALUES (v_tenant, v_franchise, 'SMOKE-EXC-ACCT-' || gen_random_uuid()::text)
  RETURNING id INTO v_account_id;

  INSERT INTO public.shipments (tenant_id, franchise_id, shipment_number, shipment_type,
                                 status, account_id, origin_address, destination_address,
                                 current_status_description, estimated_delivery_date)
  VALUES (v_tenant, v_franchise, 'SMK-' || substr(gen_random_uuid()::text,1,8), 'ocean_freight',
          'in_transit', v_account_id, '{}'::jsonb, '{}'::jsonb,
          'Container delayed at port', now() + interval '5 days')
  RETURNING id INTO v_shipment_id;

  UPDATE public.shipments SET status='exception' WHERE id=v_shipment_id;
  SELECT count(*)::integer INTO v_count FROM core.notifications
  WHERE subject_type='logistics.shipment' AND subject_id=v_shipment_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'A1: count=%', v_count; END IF;
  RAISE NOTICE 'A1 OK — one notification on transition';

  SELECT recipient_party_id, payload, severity INTO v_recipient, v_payload, v_severity
  FROM core.notifications WHERE subject_type='logistics.shipment' AND subject_id=v_shipment_id;
  IF v_recipient <> v_account_id THEN RAISE EXCEPTION 'A2 recipient'; END IF;
  IF v_severity <> 'critical' THEN RAISE EXCEPTION 'A2 severity=%', v_severity; END IF;
  IF (v_payload->>'shipment_id')::uuid <> v_shipment_id THEN RAISE EXCEPTION 'A2 payload'; END IF;
  IF v_payload->>'subject' NOT LIKE 'Shipment %exception flagged' THEN RAISE EXCEPTION 'A2 subject'; END IF;
  RAISE NOTICE 'A2 OK — recipient=party, severity=critical, payload+subject correct';

  UPDATE public.shipments SET current_status_description='still stuck' WHERE id=v_shipment_id;
  SELECT count(*)::integer INTO v_count FROM core.notifications
  WHERE subject_type='logistics.shipment' AND subject_id=v_shipment_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'A3 double-emit'; END IF;
  RAISE NOTICE 'A3 OK — no double-emit on no-op UPDATE';

  UPDATE public.shipments SET status='in_transit' WHERE id=v_shipment_id;
  UPDATE public.shipments SET status='exception'  WHERE id=v_shipment_id;
  SELECT count(*)::integer INTO v_count FROM core.notifications
  WHERE subject_type='logistics.shipment' AND subject_id=v_shipment_id;
  IF v_count <> 2 THEN RAISE EXCEPTION 'A4 count=%', v_count; END IF;
  RAISE NOTICE 'A4 OK — re-transition re-emits';

  DELETE FROM comms.deliveries WHERE notification_id IN (
    SELECT id FROM core.notifications WHERE subject_type='logistics.shipment' AND subject_id=v_shipment_id
  );
  DELETE FROM core.notifications WHERE subject_type='logistics.shipment' AND subject_id=v_shipment_id;
  DELETE FROM public.shipments WHERE id=v_shipment_id;
  DELETE FROM crm.account_extensions WHERE party_id=v_account_id;
  DELETE FROM public.accounts WHERE id=v_account_id;

  RAISE NOTICE '=== SHIPMENT EXCEPTION SMOKE PASSED (4/4) ===';
END;
$$;
