-- Phase 1 Slice C extension — comms schema bootstrap
-- Per master design doc §7.4 + comms-infrastructure.md
--
-- This migration creates only the schema container. The full set of comms.*
-- business tables (email_accounts, threads, messages, etc.) lands in Phase 6
-- when services/comms-api/ is built. For Phase 1 Slice C we add only the
-- minimum tables needed to close the three CRITICAL issues from
-- comms-infrastructure.md §3:
--
--   G-CR-1: plaintext credentials → core.secrets (added in companion migration)
--   G-CR-2: no bounce ingestion → comms.deliveries + comms.delivery_events
--   G-CR-3: no suppression list → comms.suppressions
--
-- See: docs/plans/2026-05-28-modules/comms.md §3 target schema
--      docs/plans/2026-05-28-modules/comms-infrastructure.md §4

CREATE SCHEMA IF NOT EXISTS comms;

COMMENT ON SCHEMA comms IS
  'Communications module — email/SMS/WhatsApp/push delivery layer. Phase 1 Slice C bootstraps suppressions + deliveries + delivery_events for Resend webhook ingestion; the rest of the schema lands with services/comms-api/ in Phase 6. See docs/plans/2026-05-28-modules/comms.md and comms-infrastructure.md.';

-- Grants
GRANT USAGE ON SCHEMA comms TO postgres;
GRANT USAGE ON SCHEMA comms TO anon;
GRANT USAGE ON SCHEMA comms TO authenticated;
GRANT USAGE ON SCHEMA comms TO service_role;

-- Default privileges so future tables inherit grants
ALTER DEFAULT PRIVILEGES IN SCHEMA comms
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA comms
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA comms
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
