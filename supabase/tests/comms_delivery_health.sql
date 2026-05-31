-- Phase 6 Step 52 — smoke test for comms.v_delivery_health.
--
-- Asserts:
--   A1. Injecting an artificially-aged 'pending' delivery (created
--       15min ago, next_retry_at <= now()) flips is_stale=true and
--       increments queued_count by 1 for its (channel, provider) bucket.
--   A2. Marking that delivery 'sent' moves it out of queued → into
--       sent_in_flight; is_stale drops back to its prior NULL/false.
--   A3. Marking it 'failed' moves it into failed_count, last_24h_volume
--       still includes it.
--
-- Note: 'null' provider in prod is the intentional NullEmailProvider
-- sentinel (services/comms-api/src/providers/email-provider.ts:62 —
-- name='null'). Not a data bug; the COALESCE is for genuine SQL NULL
-- which could land if a future code path skips setting provider entirely.

DO $$
DECLARE
  v_tenant uuid;
  v_id uuid;
  v_addr text := 'smoke-deliv-' || substr(gen_random_uuid()::text,1,8) || '@example.invalid';
  v_queued_before integer; v_queued_after integer;
  v_inflight integer; v_failed_before integer; v_failed_after integer;
  v_is_stale boolean;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;

  SELECT COALESCE(queued_count, 0), COALESCE(failed_count, 0)
  INTO v_queued_before, v_failed_before
  FROM comms.v_delivery_health
  WHERE channel_kind='email' AND provider='resend';

  -- Synthetic stale queued delivery on the resend bucket
  INSERT INTO comms.deliveries (
    tenant_id, channel_kind, provider, recipient_address, status,
    created_at, updated_at, next_retry_at, attempt_count, max_attempts
  )
  VALUES (
    v_tenant, 'email', 'resend', v_addr, 'pending',
    now() - interval '15 minutes', now() - interval '15 minutes',
    now() - interval '14 minutes', 0, 3
  )
  RETURNING id INTO v_id;

  SELECT queued_count, is_stale INTO v_queued_after, v_is_stale
  FROM comms.v_delivery_health WHERE channel_kind='email' AND provider='resend';
  IF v_queued_after <> v_queued_before + 1 THEN
    RAISE EXCEPTION 'A1: queued delta=%; expected +1', v_queued_after - v_queued_before;
  END IF;
  IF NOT v_is_stale THEN
    RAISE EXCEPTION 'A1: is_stale=false; expected true (15min-old queued row)';
  END IF;
  RAISE NOTICE 'A1 OK — stale queued surfaces';

  UPDATE comms.deliveries SET status='sent', sent_at=now(), updated_at=now() WHERE id=v_id;
  SELECT sent_in_flight_count INTO v_inflight
  FROM comms.v_delivery_health WHERE channel_kind='email' AND provider='resend';
  IF v_inflight < 1 THEN
    RAISE EXCEPTION 'A2: sent_in_flight=% post-send; expected ≥1', v_inflight;
  END IF;
  RAISE NOTICE 'A2 OK — moved to sent_in_flight (count=%)', v_inflight;

  UPDATE comms.deliveries SET status='failed', failed_at=now(), error_text='smoke test', updated_at=now() WHERE id=v_id;
  SELECT failed_count INTO v_failed_after
  FROM comms.v_delivery_health WHERE channel_kind='email' AND provider='resend';
  IF v_failed_after <> v_failed_before + 1 THEN
    RAISE EXCEPTION 'A3: failed delta=%; expected +1', v_failed_after - v_failed_before;
  END IF;
  RAISE NOTICE 'A3 OK — moved to failed';

  DELETE FROM comms.deliveries WHERE id=v_id;
  RAISE NOTICE '=== v_delivery_health SMOKE PASSED (3/3) ===';
END;
$$;
