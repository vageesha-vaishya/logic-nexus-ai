-- Phase 1.1 — core.outbox (transactional event outbox)
-- Per master design doc §5 / §6 / core.md §3.7
--
-- Every state change in a business module writes the entity update + an outbox
-- row in the SAME transaction. A per-service poller ships rows where
-- published_at IS NULL to Kafka, then marks them. Replaces today's at-most-once
-- "fire from app code" pattern in services/crm-api/src/events/.
--
-- Columns map 1:1 to the §2.4 universal event envelope so the publish path is
-- a simple SELECT.
--
-- Partitioned monthly by occurred_at to keep indexes small. Initial partitions
-- cover backfill + current + next 3 months; a roll-over job (Phase 1 follow-up)
-- creates new partitions on schedule.

CREATE TABLE core.outbox (
  id             uuid         NOT NULL,
  tenant_id      uuid         NOT NULL,
  module         text         NOT NULL,            -- 'crm','sales','quotation','logistics','finance','compliance','comms','amro','uim','markets','core'
  entity_type    text         NOT NULL,            -- singular lowercase, no schema prefix
  event_type     text         NOT NULL,            -- past-tense verb
  entity_id      uuid         NOT NULL,
  occurred_at    timestamptz  NOT NULL DEFAULT now(),
  version        int          NOT NULL DEFAULT 1
                              CHECK (version >= 1),
  payload        jsonb        NOT NULL,
  metadata       jsonb        NOT NULL DEFAULT '{}',
  published_at   timestamptz,                       -- NULL = not yet shipped to Kafka
  PRIMARY KEY (tenant_id, occurred_at, id)
) PARTITION BY RANGE (occurred_at);

COMMENT ON TABLE core.outbox IS
  'Transactional event outbox. Per master §5.1 — same-transaction writes guarantee at-least-once delivery; consumers dedupe via core.idempotency_keys.';

COMMENT ON COLUMN core.outbox.published_at IS
  'NULL = not yet picked up by the poller. Set to now() once shipped to Kafka. Never updated after.';

COMMENT ON COLUMN core.outbox.metadata IS
  'Envelope metadata: {actor_user_id, actor_kind, correlation_id, causation_id, tracing?}. Schema-validated at producer time by @platform/event-contracts.';

-- Initial partitions: previous month (back-dated event ingestion), current month, +3 months ahead
CREATE TABLE core.outbox_y2026m04 PARTITION OF core.outbox
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE core.outbox_y2026m05 PARTITION OF core.outbox
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE core.outbox_y2026m06 PARTITION OF core.outbox
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE core.outbox_y2026m07 PARTITION OF core.outbox
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE core.outbox_y2026m08 PARTITION OF core.outbox
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

-- The hot read path: pollers query unpublished rows ordered by occurred_at.
-- Partial index keeps it tiny — typical row count is "current backlog only".
CREATE INDEX outbox_unpublished_idx
  ON core.outbox (occurred_at)
  WHERE published_at IS NULL;

-- Per-tenant + per-topic browsing
CREATE INDEX outbox_tenant_topic_idx
  ON core.outbox (tenant_id, module, entity_type, event_type, occurred_at DESC);

-- Saga reconstruction via correlation_id (master §5.9)
CREATE INDEX outbox_correlation_idx
  ON core.outbox ((metadata->>'correlation_id'))
  WHERE metadata ? 'correlation_id';

-- RLS: outbox is internal infrastructure. Only service_role accesses it; the
-- per-service poller code runs as service_role. No authenticated reads.
ALTER TABLE core.outbox            ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox_y2026m04   ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox_y2026m05   ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox_y2026m06   ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox_y2026m07   ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox_y2026m08   ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated — RLS denies by default.

-- Grants
GRANT ALL ON core.outbox            TO service_role;
GRANT ALL ON core.outbox_y2026m04   TO service_role;
GRANT ALL ON core.outbox_y2026m05   TO service_role;
GRANT ALL ON core.outbox_y2026m06   TO service_role;
GRANT ALL ON core.outbox_y2026m07   TO service_role;
GRANT ALL ON core.outbox_y2026m08   TO service_role;

-- Default privileges so future partitions inherit grants without re-running this migration
ALTER DEFAULT PRIVILEGES IN SCHEMA core
  GRANT ALL ON TABLES TO service_role;
