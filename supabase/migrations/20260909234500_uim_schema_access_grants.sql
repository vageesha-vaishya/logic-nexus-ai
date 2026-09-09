-- Root-cause fix — the entire `uim` schema (23 tables backing the uim-api
-- microservice) has never had USAGE granted to service_role or
-- authenticated. Found while sweeping for the same missing-sequence-grant
-- bug class fixed for platform.llm_usage/access_log/audit_log
-- (20260909230000/231500/233000); this turned out to be a bigger, deeper
-- version of the same underlying problem.
--
-- Confirmed live: uim.integration_log has zero rows, ever, and a real
-- rollback-wrapped INSERT as service_role failed with "permission denied
-- for schema uim" -- not just a missing sequence grant, the schema itself
-- was never opened up, despite the uim-api container running healthy the
-- whole time. Table-level grants exist correctly on most of the 23 tables
-- (per the original migration), but without schema USAGE none of them
-- were ever actually reachable -- Postgres checks schema USAGE before it
-- even looks at table-level ACLs.
--
-- Two narrower gaps found in the same sweep, on top of the schema-level one:
--   1. uim.integration_log.id defaults to nextval() against
--      platform.integration_log_id_seq (a cross-schema sequence shared
--      with the legacy platform.integration_log table) -- same missing-
--      USAGE-on-sequence bug as the other three tables fixed today.
--   2. etl_runs, qa_signoffs, sync_conflicts, and webhook_outbox never got
--      any service_role/authenticated table grant at all (only
--      supabase_admin), unlike their sibling tables (e.g. integration_dlq,
--      webhook_subscriptions) which correctly got
--      `service_role: SELECT,INSERT,UPDATE,DELETE`. All four already have
--      a tenant-scoped RLS SELECT policy for {public} -- a policy with no
--      underlying table grant is inert, so this was designed to allow
--      authenticated SELECT + service_role CRUD and just never got wired.
--
-- (`flypal_configured_directives`, `flypal_directives`,
-- `flypal_pilot_log_book`, `flypal_pilot_log_book_import_errors` were also
-- flagged by the initial sweep query but are NOT part of this bug: their
-- id-like columns are GENERATED ALWAYS AS IDENTITY, not classic
-- nextval()-as-default, and Postgres does not require caller-side sequence
-- privilege for identity-column generation -- confirmed by a real
-- rollback-wrapped INSERT succeeding as service_role with no grant.)

GRANT USAGE ON SCHEMA uim TO service_role, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON uim.etl_runs, uim.qa_signoffs, uim.sync_conflicts, uim.webhook_outbox TO service_role;
GRANT SELECT ON uim.etl_runs, uim.qa_signoffs, uim.sync_conflicts, uim.webhook_outbox TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE platform.integration_log_id_seq TO service_role;
