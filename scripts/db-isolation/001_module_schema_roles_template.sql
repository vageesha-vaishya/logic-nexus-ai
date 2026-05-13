-- Template: module schema + least-privilege role bootstrap
-- Usage:
--   psql "$DATABASE_URL" -v module_name='crm' -f 001_module_schema_roles_template.sql

\set ON_ERROR_STOP on

DO $$
DECLARE
  module_name text := :'module_name';
  schema_name text := format('module_%s', module_name);
  role_ro text := format('module_%s_ro', module_name);
  role_rw text := format('module_%s_rw', module_name);
  role_admin text := format('module_%s_admin', module_name);
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

  EXECUTE format('DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = %L) THEN CREATE ROLE %I; END IF; END $$', role_ro, role_ro);
  EXECUTE format('DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = %L) THEN CREATE ROLE %I; END IF; END $$', role_rw, role_rw);
  EXECUTE format('DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = %L) THEN CREATE ROLE %I; END IF; END $$', role_admin, role_admin);

  EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I, %I, %I', schema_name, role_ro, role_rw, role_admin);

  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO %I', schema_name, role_ro);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', schema_name, role_rw);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO %I', schema_name, role_admin);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO %I, %I', schema_name, role_rw, role_admin);
END$$;
