-- Phase 6 Step 52 — comms.v_delivery_health worker status view.
--
-- Mirrors core.v_outbox_health (Step 51) but for the comms delivery
-- worker side. Completes the operational observability triple:
--
--   outbox consumer health  (v_outbox_health)
--     → comms dispatcher    (fans intent → deliveries)
--       → delivery worker   (THIS view)
--
-- If delivery-worker.ts crashes or a provider goes down, this
-- surfaces queue depth + per-channel/provider lag in one query.
--
-- Status taxonomy (from comms.deliveries CHECK constraint):
--   pending     - awaiting dispatch (queued or in backoff)
--   sent        - handed to provider, no confirmation yet
--   delivered   - provider confirmed (Resend "delivered" webhook etc)
--   opened, clicked - engagement events
--   bounced     - bounce_kind says hard|soft|permanent|transient
--   complained  - recipient marked as spam
--   failed      - retry budget exhausted
--   suppressed  - pre-send blocked by comms.suppressions
--
-- Pending sub-state (worker-relevant):
--   queued        = status='pending' AND next_retry_at <= now()
--                   (ready for the worker's next tick)
--   backing_off   = status='pending' AND next_retry_at  > now()
--                   (waiting for retry window — last attempt failed)
--
-- Stale threshold: queued > 10 minutes. The worker polls every few
-- seconds; anything sitting queued past 10min means the worker is
-- down OR the provider is consistently rejecting at the network
-- layer (DNS, SMTP handshake) without surfacing per-row errors.

CREATE OR REPLACE VIEW comms.v_delivery_health AS
SELECT
  d.channel_kind,
  COALESCE(d.provider, '(unset)') AS provider,
  count(*)::integer AS total_count,
  count(*) FILTER (
    WHERE d.status = 'pending' AND d.next_retry_at <= now()
  )::integer AS queued_count,
  count(*) FILTER (
    WHERE d.status = 'pending' AND d.next_retry_at  > now()
  )::integer AS backing_off_count,
  count(*) FILTER (
    WHERE d.status = 'sent' AND d.delivered_at IS NULL
                            AND d.bounced_at  IS NULL
                            AND d.failed_at   IS NULL
  )::integer AS sent_in_flight_count,
  count(*) FILTER (WHERE d.status = 'delivered')  ::integer AS delivered_count,
  count(*) FILTER (WHERE d.status = 'bounced'
                    AND d.bounce_kind = 'hard')   ::integer AS bounced_hard_count,
  count(*) FILTER (WHERE d.status = 'complained') ::integer AS complained_count,
  count(*) FILTER (WHERE d.status = 'failed')     ::integer AS failed_count,
  count(*) FILTER (WHERE d.status = 'suppressed') ::integer AS suppressed_count,
  count(*) FILTER (WHERE d.created_at > now() - interval '24 hours')::integer
    AS last_24h_volume,
  EXTRACT(EPOCH FROM (
    now() - MIN(d.created_at) FILTER (
      WHERE d.status = 'pending' AND d.next_retry_at <= now()
    )
  ))::integer AS oldest_queued_age_seconds,
  -- Stale = anything queued > 10 minutes (matches the v_outbox_health
  -- threshold; consumers poll on the order of seconds, not minutes).
  (
    EXTRACT(EPOCH FROM (
      now() - MIN(d.created_at) FILTER (
        WHERE d.status = 'pending' AND d.next_retry_at <= now()
      )
    )) > 600
  )::boolean AS is_stale
FROM comms.deliveries d
GROUP BY d.channel_kind, COALESCE(d.provider, '(unset)')
ORDER BY d.channel_kind, provider;

COMMENT ON VIEW comms.v_delivery_health IS
  'Phase 6 Step 52 — comms delivery worker health per (channel_kind, provider). queued = pending+ready; backing_off = pending+future-retry; sent_in_flight = sent without final state. is_stale=true means queued > 10 minutes (worker may be down or provider unreachable). NULL is_stale = no queued rows to evaluate.';

REVOKE ALL  ON comms.v_delivery_health FROM PUBLIC;
GRANT SELECT ON comms.v_delivery_health TO service_role;
