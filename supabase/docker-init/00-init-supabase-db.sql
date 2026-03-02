-- Ensure supabase_admin user exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'supabase_admin') THEN
      CREATE ROLE supabase_admin LOGIN PASSWORD 'postgres' SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS;
   END IF;
END
$do$;

-- Create _supabase database if it doesn't exist
SELECT 'CREATE DATABASE _supabase OWNER supabase_admin'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '_supabase')\gexec
