-- Phase 1.2 — core.idempotency_keys
-- Per master design doc §5.2.
--
-- Every ACL writes the inbound event.id to this table BEFORE processing.
-- If the key exists (PK conflict), the event is dropped — at-least-once Kafka
-- delivery + this table = exactly-once effects.

CREATE TABLE core.idempotency_keys (
  -- Composite key: '<consumer_module>:<event.id>' per master §5.2 recipe.
  -- Plain text rather than a struct so the constraint is portable across
  -- module-specific shapes (e.g. webhook receivers use 'uim:<gateway>:<id>').
  key            text         PRIMARY KEY,
  tenant_id      uuid,
  recorded_at    timestamptz  NOT NULL DEFAULT now(),
  -- Optional summary of what the consumer did with the event — useful for
  -- debugging duplicates and for the Improver Agent reading historical
  -- consumer behaviour.
  result_summary jsonb
);

COMMENT ON TABLE core.idempotency_keys IS
  'Consumer-side dedup ledger. Insert key before processing; PK conflict = drop. Per master §5.2.';

CREATE INDEX idempotency_keys_tenant_recorded_idx
  ON core.idempotency_keys (tenant_id, recorded_at DESC)
  WHERE tenant_id IS NOT NULL;

-- Cleanup index: a periodic job deletes rows older than the longest
-- Kafka retention window (30 days). Indexed on recorded_at so the
-- range scan during cleanup stays cheap. (Partial-WHERE with now() is
-- not IMMUTABLE, so Postgres rejects it.)
CREATE INDEX idempotency_keys_old_idx
  ON core.idempotency_keys (recorded_at);

ALTER TABLE core.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Internal infrastructure — service_role only.
GRANT ALL ON core.idempotency_keys TO service_role;
