#!/bin/bash

# Migration Verification Script
# Verifies data integrity and completeness

set -e

# Ensure we run from the script directory so relative paths work
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load config
if [[ ! -f "new-supabase-config.env" ]]; then
    echo "new-supabase-config.env not found in $PWD" >&2
    exit 1
fi
source new-supabase-config.env

log() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

echo ""
echo "=========================================="
echo "  Migration Verification"
echo "=========================================="
echo ""

# Test 1: Connection
info "Test 1: Database Connection"
USE_REST_FALLBACK=false
if psql "$NEW_DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
    log "Database connection successful"
else
    warn "Cannot connect to database via psql; switching to REST fallback"
    USE_REST_FALLBACK=true
fi

# REST helpers (fallback when psql is unavailable)
rest_status() {
    local table="$1"
    curl -s -o /dev/null -w "%{http_code}" \
        -H "apikey: $NEW_SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $NEW_SUPABASE_SERVICE_ROLE_KEY" \
        "$NEW_SUPABASE_URL/rest/v1/$table?select=*&limit=1"
}

rest_count() {
    local table="$1"
    local header
    header=$(curl -s -I \
        -H "apikey: $NEW_SUPABASE_SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $NEW_SUPABASE_SERVICE_ROLE_KEY" \
        -H "Prefer: count=exact" \
        "$NEW_SUPABASE_URL/rest/v1/$table?select=*&limit=1" | grep -i "Content-Range")
    echo "$header" | awk -F'/' '{print $2}' | tr -d '\r'
}

# Test 2: Tables exist
info ""
info "Test 2: Table Existence"
EXPECTED_TABLES=(
    "tenants" "franchises" "profiles" "user_roles"
    "accounts" "contacts" "leads" "opportunities"
    "quotes" "shipments" "activities"
)

for table in "${EXPECTED_TABLES[@]}"; do
    if [[ "$USE_REST_FALLBACK" == "true" ]]; then
        status=$(rest_status "$table")
        if [[ "$status" == "200" || "$status" == "206" ]]; then
            log "Table reachable via REST: $table"
        else
            error "Table not reachable via REST ($status): $table"
        fi
    else
        if psql "$NEW_DB_URL" -t -c "SELECT to_regclass('public.$table')" | grep -q "$table"; then
            log "Table exists: $table"
        else
            error "Missing table: $table"
        fi
    fi
done

# Test 3: Row counts
info ""
info "Test 3: Data Verification (Row Counts)"
echo ""

if [[ "$USE_REST_FALLBACK" == "true" ]]; then
    for table in currencies service_types service_type_mappings cargo_types package_categories package_sizes container_types container_sizes ports_locations; do
        cnt=$(rest_count "$table")
        if [[ -n "$cnt" ]]; then
            echo "public.$table | row_count=$cnt"
        else
            echo "public.$table | row_count=? (REST count unavailable)"
        fi
    done
else
    psql "$NEW_DB_URL" << 'EOF'
SELECT 
    schemaname || '.' || tablename AS table_name,
    n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_live_tup > 0
ORDER BY n_live_tup DESC
LIMIT 20;
EOF
fi

# Test 4: RLS Policies
info ""
info "Test 4: RLS Policies"
if [[ "$USE_REST_FALLBACK" == "true" ]]; then
    warn "RLS policy count not available via REST fallback"
    RLS_COUNT="N/A"
else
    RLS_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';")
    if [ "$RLS_COUNT" -gt 0 ]; then
        log "RLS policies active: $RLS_COUNT policies"
    else
        warn "No RLS policies found (security risk!)"
    fi
fi

# Test 5: Database Functions
info ""
info "Test 5: Database Functions"
if [[ "$USE_REST_FALLBACK" == "true" ]]; then
    warn "Function count not available via REST fallback"
    FUNC_COUNT="N/A"
else
    FUNC_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public';")
    if [ "$FUNC_COUNT" -gt 0 ]; then
        log "Database functions present: $FUNC_COUNT functions"
    else
        warn "No custom functions found"
    fi
fi

# Test 6: Indexes
info ""
info "Test 6: Indexes"
if [[ "$USE_REST_FALLBACK" == "true" ]]; then
    warn "Index count not available via REST fallback"
    INDEX_COUNT="N/A"
else
    INDEX_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';")
    if [ "$INDEX_COUNT" -gt 0 ]; then
        log "Indexes created: $INDEX_COUNT indexes"
    else
        warn "No indexes found (performance issue!)"
    fi
fi

# Test 7: Foreign Keys
info ""
info "Test 7: Foreign Key Constraints"
if [[ "$USE_REST_FALLBACK" == "true" ]]; then
    warn "Foreign key count not available via REST fallback"
    FK_COUNT="N/A"
else
    FK_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public';")
    if [ "$FK_COUNT" -gt 0 ]; then
        log "Foreign keys active: $FK_COUNT constraints"
    else
        warn "No foreign keys found (data integrity risk!)"
    fi
fi

# Test 8: Enums
info ""
info "Test 8: Custom Enums"
if [[ "$USE_REST_FALLBACK" == "true" ]]; then
    warn "Enum count not available via REST fallback"
    ENUM_COUNT="N/A"
else
    ENUM_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM pg_type WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');")
    if [ "$ENUM_COUNT" -gt 0 ]; then
        log "Custom enums present: $ENUM_COUNT enums"
    else
        warn "No custom enums found"
    fi
fi

# Test 9: Check for null issues
info ""
info "Test 9: Data Integrity Checks"

# Check for critical tables
if [[ "$USE_REST_FALLBACK" == "true" ]]; then
    for t in tenants profiles user_roles; do
        c=$(rest_count "$t")
        if [[ -z "$c" || "$c" == "" ]]; then
            warn "Empty/unknown critical table via REST: $t | count=?"
        elif [[ "$c" == "0" ]]; then
            warn "Empty critical table detected: $t | count=0"
        else
            log "Data present: $t | count=$c"
        fi
    done
else
    CRITICAL_CHECKS=$(psql "$NEW_DB_URL" -t << 'EOF'
SELECT 
    'tenants' as table_name,
    COUNT(*) as count
FROM tenants
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles;
EOF
    )

    echo "$CRITICAL_CHECKS" | while read line; do
        if [[ $line == *"0"* ]]; then
            warn "Empty critical table detected: $line"
        else
            log "Data present: $line"
        fi
    done
fi

# Test 10: Sample query test
info ""
info "Test 10: Sample Query Test"
if [[ "$USE_REST_FALLBACK" == "true" ]]; then
    warn "Complex SQL query test skipped in REST fallback"
else
    if psql "$NEW_DB_URL" -c "SELECT t.name, COUNT(f.id) FROM tenants t LEFT JOIN franchises f ON t.id = f.tenant_id GROUP BY t.id, t.name LIMIT 5;" > /dev/null 2>&1; then
        log "Complex queries working"
    else
        warn "Query execution issues detected"
    fi
fi

# Summary
echo ""
echo "=========================================="
echo "  Verification Summary"
echo "=========================================="
echo ""

# Generate summary report
cat > migration-logs/verification-report.txt << EOF
Migration Verification Report
Generated: $(date)
Database: $NEW_DB_URL
REST Fallback: $USE_REST_FALLBACK

Tables Verified: ${#EXPECTED_TABLES[@]}
RLS Policies: $RLS_COUNT
Database Functions: $FUNC_COUNT
Indexes: $INDEX_COUNT
Foreign Keys: $FK_COUNT
Custom Enums: $ENUM_COUNT

Status: See detailed output above
EOF

log "Verification report saved to: migration-logs/verification-report.txt"

echo ""
info "Next steps:"
info "1. Review any warnings above"
info "2. Test application connection"
info "3. Verify user authentication"
info "4. Test CRUD operations"
echo ""
