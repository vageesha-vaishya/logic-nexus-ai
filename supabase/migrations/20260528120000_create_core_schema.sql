-- Phase 0.10 — Empty core.* schema
-- Per master design doc §7.4 Phase 0 gating exit criteria:
-- "an empty core.* schema exists"
--
-- This migration creates only the schema container. Tables land in Phase 1:
--   - core.audit_log + triggers (lift from public.audit_log et al.)
--   - core.outbox + poller infra
--   - core.idempotency_keys, core.feature_flags
--   - core.llm_provider_configs, core.llm_usage (lift from platform.*)
--   - core.domains (lift from platform_domains family)
--   - core.secrets, core.notifications, core.files / core.file_links
--
-- Then Phase 2 adds the load-bearing party tables:
--   - core.parties, core.party_relationships
--   - core.account_extensions, core.contact_extensions (via crm.*)
--
-- See: docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 0/1/2
--      docs/plans/2026-05-28-modules/core.md §3 target schema

CREATE SCHEMA IF NOT EXISTS core;

COMMENT ON SCHEMA core IS
  'Platform Core — identity, parties, addresses, tags, files, audit, outbox, notifications, tenants, users, llm_provider_configs, llm_usage, domains. Owned by no business module; the only legal cross-schema FK target for every <module>.* schema. See docs/plans/2026-05-28-modules/core.md';

-- Grant usage to standard Supabase roles. Per-table grants come with each
-- table's own migration. RLS handles authorization.
GRANT USAGE ON SCHEMA core TO postgres;
GRANT USAGE ON SCHEMA core TO anon;
GRANT USAGE ON SCHEMA core TO authenticated;
GRANT USAGE ON SCHEMA core TO service_role;

-- Default privileges so future tables don't need explicit grants for new objects.
ALTER DEFAULT PRIVILEGES IN SCHEMA core
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA core
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA core
  GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
