#!/bin/bash

# Cleanup Existing Database Objects
# Safely removes existing tables, functions, and data before migration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load configuration
source new-supabase-config.env

log() {
    echo -e "${GREEN}[$(date +%Y-%m-%d\ %H:%M:%S)]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log "Starting database cleanup..."

# Drop all tables in public schema (cascade to remove dependencies)
log "Dropping existing tables..."
psql "$NEW_DB_URL" <<SQL
DO \$\$
DECLARE
    r RECORD;
BEGIN
    -- Drop all tables
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Dropped table: %', r.tablename;
    END LOOP;
END \$\$;
SQL

# Drop all views
log "Dropping existing views..."
psql "$NEW_DB_URL" <<SQL
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT viewname FROM pg_views WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
        RAISE NOTICE 'Dropped view: %', r.viewname;
    END LOOP;
END \$\$;
SQL

# Drop all functions
log "Dropping existing functions..."
psql "$NEW_DB_URL" <<SQL
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT proname, oidvectortypes(proargtypes) as argtypes
        FROM pg_proc 
        INNER JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
        WHERE pg_namespace.nspname = 'public'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.argtypes || ') CASCADE';
        RAISE NOTICE 'Dropped function: %', r.proname;
    END LOOP;
END \$\$;
SQL

# Drop all types
log "Dropping existing custom types..."
psql "$NEW_DB_URL" <<SQL
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT typname 
        FROM pg_type 
        WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        AND typtype = 'e'
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
        RAISE NOTICE 'Dropped type: %', r.typname;
    END LOOP;
END \$\$;
SQL

# Drop all sequences
log "Dropping existing sequences..."
psql "$NEW_DB_URL" <<SQL
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequence_name) || ' CASCADE';
        RAISE NOTICE 'Dropped sequence: %', r.sequence_name;
    END LOOP;
END \$\$;
SQL

# Clean storage buckets (if any exist)
log "Cleaning storage buckets..."
psql "$NEW_DB_URL" <<SQL
DO \$\$
BEGIN
    -- Empty and delete all buckets
    DELETE FROM storage.objects;
    DELETE FROM storage.buckets;
    RAISE NOTICE 'Cleaned storage buckets';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'No storage to clean or permission denied';
END \$\$;
SQL

log "✓ Database cleanup completed successfully"
log "Database is now ready for fresh migration"
