-- Template: cross-schema query audit objects
-- Requires pgAudit or custom logging integration by platform DBA team.

\set ON_ERROR_STOP on

CREATE SCHEMA IF NOT EXISTS module_audit;

CREATE TABLE IF NOT EXISTS module_audit.cross_schema_query_audit (
  audit_id bigserial PRIMARY KEY,
  db_user text NOT NULL,
  executed_at timestamptz NOT NULL DEFAULT now(),
  query_text text NOT NULL,
  execution_ms numeric(12,3) NOT NULL,
  source_app text,
  correlation_id text,
  source_schema text,
  target_schema text
);

COMMENT ON TABLE module_audit.cross_schema_query_audit IS
'Audit trail for cross-schema query execution including user, timestamp, text, and duration.';
