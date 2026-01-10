#!/bin/bash
set -e

# Load Configuration
if [ -f "migration.env" ]; then
    source migration.env
else
    echo "Error: migration.env not found. Please copy migration.env.template and configure it."
    exit 1
fi

echo "🚀 Starting Direct Migration..."
echo "Source: $SOURCE_DB_URL"
echo "Target: $TARGET_DB_URL"

# Create logs directory
mkdir -p logs
LOG_FILE="logs/migration-$(date +%Y%m%d_%H%M%S).log"

log() {
    echo "[$(date +%Y-%m-%d\ %H:%M:%S)] $1" | tee -a "$LOG_FILE"
}

# 1. Schema Migration
if [ "$MIGRATE_SCHEMA" = "true" ]; then
    log "📦 Migrating Schema..."
    
    # Dump Schema Only (excluding system schemas)
    # We filter out auth, storage, realtime, extensions as Supabase manages them
    log "   Exporting schema from Source..."
    pg_dump "$SOURCE_DB_URL" \
        --schema-only \
        --no-owner \
        --no-privileges \
        --exclude-schema=auth \
        --exclude-schema=storage \
        --exclude-schema=realtime \
        --exclude-schema=extensions \
        --exclude-schema=graphql \
        --exclude-schema=graphql_public \
        --exclude-schema=net \
        --exclude-schema=pgsodium \
        --exclude-schema=pgbouncer \
        --exclude-schema=pgtle \
        --exclude-schema=supabase_functions \
        --exclude-schema=vault \
        --file=logs/schema_dump.sql

    log "   Applying schema to Target..."
    # We use psql to apply. Errors might occur if objects exist, but we want to proceed.
    # Alternatively, use 'supabase db push' if we trust the local migrations folder more than the source DB.
    # Here we assume we want to clone the SOURCE DB structure.
    psql "$TARGET_DB_URL" -f logs/schema_dump.sql > logs/schema_import.log 2>&1 || log "   ⚠️  Schema import had warnings (check logs/schema_import.log)"
fi

# 2. Data Migration
if [ "$MIGRATE_DATA" = "true" ]; then
    log "💾 Migrating Data (Public Schema)..."
    
    # Dump Data Only (custom format for pg_restore)
    log "   Exporting data from Source..."
    pg_dump "$SOURCE_DB_URL" \
        --data-only \
        --format=custom \
        --no-owner \
        --no-privileges \
        --schema=public \
        --file=logs/data_dump.dump

    log "   Restoring data to Target..."
    # Use pg_restore. We disable triggers to avoid FK issues during load.
    pg_restore --clean --if-exists --no-owner --no-privileges --disable-triggers -d "$TARGET_DB_URL" logs/data_dump.dump > logs/data_import.log 2>&1 || log "   ⚠️  Data import had warnings (check logs/data_import.log)"
fi

# 3. Auth Migration
if [ "$MIGRATE_AUTH" = "true" ]; then
    log "🔐 Migrating Auth Users..."
    # Requires a specialized script because auth schema is protected
    if command -v node >/dev/null 2>&1; then
        # Install dependencies if needed (assuming pg is available or we use a standalone script)
        # We will use a JS script that connects to both and syncs auth.users
        log "   Running auth sync script..."
        node scripts/sync-auth.js "$SOURCE_DB_URL" "$TARGET_DB_URL" >> "$LOG_FILE" 2>&1
    else
        log "   ⚠️  Node.js not found. Skipping Auth Migration."
    fi
fi

# 4. Validation
log "🔍 Validating Migration..."
if command -v node >/dev/null 2>&1; then
    node scripts/validate-migration.js "$SOURCE_DB_URL" "$TARGET_DB_URL" >> "$LOG_FILE" 2>&1
else
    log "   ⚠️  Node.js not found. Skipping Validation."
fi

log "✅ Migration Complete!"
