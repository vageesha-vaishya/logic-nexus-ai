-- Phase 6 Step 36 — extend core.outbox monthly partitions through 2027 Q1.
--
-- The original create migration (20260528130000) provisioned m04-m08
-- (Apr-Aug 2026). At apply time today (2026-05-31) the buffer is 3
-- months. Past 2026-08-31, every INSERT INTO core.outbox would fall
-- outside the partition range, and the saga emitter triggers each
-- have an EXCEPTION WHEN OTHERS … RAISE WARNING; RETURN NEW clause
-- (intentional — saga producers must never block the source-of-truth
-- write — see core.emit_opportunity_won / emit_shipment_delivered /
-- emit_lead_created / emit_do_not_contact_set). Result: events would
-- silently get swallowed; consumers would see no work, no warning
-- visible to operators except in pg log files.
--
-- This migration adds 7 partitions: Sep-Dec 2026 + Jan-Mar 2027.
-- After apply the buffer is ~10 months. A maintenance cron that
-- auto-provisions the next partition before each month boundary is
-- the right long-term solution (separate slice); for now this buys
-- enough runway to plan that work without a deadline.
--
-- Mirrors the original migration's per-partition pattern exactly:
-- explicit ENABLE RLS (parent's RLS does not propagate to children
-- in PG ≥11 — policies inherit but ENABLED flag does not) and
-- explicit GRANT (the ALTER DEFAULT PRIVILEGES line in the original
-- only covers objects created by the same DB user, so don't rely
-- on it across migration sessions).

CREATE TABLE IF NOT EXISTS core.outbox_y2026m09 PARTITION OF core.outbox
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS core.outbox_y2026m10 PARTITION OF core.outbox
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS core.outbox_y2026m11 PARTITION OF core.outbox
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS core.outbox_y2026m12 PARTITION OF core.outbox
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS core.outbox_y2027m01 PARTITION OF core.outbox
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE IF NOT EXISTS core.outbox_y2027m02 PARTITION OF core.outbox
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE IF NOT EXISTS core.outbox_y2027m03 PARTITION OF core.outbox
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

ALTER TABLE core.outbox_y2026m09 ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox_y2026m10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox_y2026m11 ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox_y2026m12 ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox_y2027m01 ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox_y2027m02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.outbox_y2027m03 ENABLE ROW LEVEL SECURITY;

GRANT ALL ON core.outbox_y2026m09 TO service_role;
GRANT ALL ON core.outbox_y2026m10 TO service_role;
GRANT ALL ON core.outbox_y2026m11 TO service_role;
GRANT ALL ON core.outbox_y2026m12 TO service_role;
GRANT ALL ON core.outbox_y2027m01 TO service_role;
GRANT ALL ON core.outbox_y2027m02 TO service_role;
GRANT ALL ON core.outbox_y2027m03 TO service_role;
