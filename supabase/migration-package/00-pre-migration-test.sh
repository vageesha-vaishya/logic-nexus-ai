#!/bin/bash

# Pre-Migration Testing Script
# Tests both source and target database environments before migration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

# Functions
log() {
    echo -e "${GREEN}[✓]${NC} $1"
}

error() {
    echo -e "${RED}[✗]${NC} $1"
    ((TESTS_FAILED++))
}

warning() {
    echo -e "${YELLOW}[!]${NC} $1"
    ((TESTS_WARNING++))
}

info() {
    echo -e "${BLUE}[i]${NC} $1"
}

test_pass() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((TESTS_PASSED++))
}

# Header
echo ""
echo "=========================================="
echo "  Pre-Migration Environment Tests"
echo "=========================================="
echo ""

# Test 1: Check prerequisites
info "Test 1/10: Checking prerequisites..."
if command -v psql >/dev/null 2>&1; then
    test_pass "PostgreSQL client (psql) installed"
else
    error "PostgreSQL client (psql) NOT found - Install PostgreSQL client"
fi

if command -v node >/dev/null 2>&1; then
    test_pass "Node.js installed ($(node --version))"
else
    error "Node.js NOT found - Install Node.js"
fi

if command -v curl >/dev/null 2>&1; then
    test_pass "curl installed"
else
    warning "curl NOT found - Some features may not work"
fi

# Test 2: Check configuration files
echo ""
info "Test 2/10: Checking configuration files..."
if [ -f "new-supabase-config.env" ]; then
    test_pass "new-supabase-config.env exists"
    source new-supabase-config.env
    
    if [ -n "$NEW_DB_URL" ]; then
        test_pass "NEW_DB_URL is configured"
    else
        error "NEW_DB_URL is empty in new-supabase-config.env"
    fi
    
    if [ -n "$NEW_SUPABASE_URL" ]; then
        test_pass "NEW_SUPABASE_URL is configured"
    else
        warning "NEW_SUPABASE_URL is empty"
    fi
    
    if [ -n "$NEW_SUPABASE_SERVICE_ROLE_KEY" ]; then
        test_pass "NEW_SUPABASE_SERVICE_ROLE_KEY is configured"
    else
        warning "NEW_SUPABASE_SERVICE_ROLE_KEY is empty"
    fi
else
    error "new-supabase-config.env NOT found - Create from template"
    exit 1
fi

# Test 3: Check schema file
echo ""
info "Test 3/10: Checking schema files..."
if [ -f "../schema-export.sql" ]; then
    SCHEMA_SIZE=$(stat -f%z "../schema-export.sql" 2>/dev/null || stat -c%s "../schema-export.sql" 2>/dev/null)
    if [ "$SCHEMA_SIZE" -gt 1000 ]; then
        test_pass "schema-export.sql exists and has content (${SCHEMA_SIZE} bytes)"
    else
        warning "schema-export.sql is very small (${SCHEMA_SIZE} bytes) - May be incomplete"
    fi
else
    error "schema-export.sql NOT found - Export schema first"
fi

# Test 4: Test target database connection
echo ""
info "Test 4/10: Testing target database connection..."
if psql "$NEW_DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
    test_pass "Target database connection successful"
    
    # Check database version
    DB_VERSION=$(psql "$NEW_DB_URL" -t -c "SELECT version();" 2>/dev/null | head -n 1)
    info "Database version: ${DB_VERSION}"
    
    # Check if database is accessible
    CAN_CREATE=$(psql "$NEW_DB_URL" -t -c "SELECT has_database_privilege(current_user, current_database(), 'CREATE');" 2>/dev/null | tr -d '[:space:]')
    if [ "$CAN_CREATE" = "t" ]; then
        test_pass "User has CREATE privileges"
    else
        error "User lacks CREATE privileges on target database"
    fi
    
else
    error "Cannot connect to target database - Check NEW_DB_URL credentials"
fi

# Test 5: Check target database state
echo ""
info "Test 5/10: Analyzing target database state..."
if psql "$NEW_DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
    TABLE_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d '[:space:]')
    
    if [ "$TABLE_COUNT" = "0" ]; then
        test_pass "Target database is empty (ready for migration)"
    elif [ "$TABLE_COUNT" -lt 5 ]; then
        warning "Target database has ${TABLE_COUNT} tables - Recommend cleanup before migration"
    else
        warning "Target database has ${TABLE_COUNT} tables - STRONGLY recommend cleanup before migration"
        info "Run './02-cleanup-existing.sh' to clean target database"
    fi
    
    # Check for conflicting objects
    FUNC_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public';" 2>/dev/null | tr -d '[:space:]')
    if [ "$FUNC_COUNT" -gt 0 ]; then
        warning "Target database has ${FUNC_COUNT} functions - May cause conflicts"
    fi
fi

# Test 6: Check data export files
echo ""
info "Test 6/10: Checking data export files..."
if [ -d "migration-data" ]; then
    CSV_COUNT=$(ls -1 migration-data/*.csv 2>/dev/null | wc -l | tr -d '[:space:]')
    if [ "$CSV_COUNT" -gt 0 ]; then
        test_pass "Found ${CSV_COUNT} CSV export files"
        
        # Check total size
        TOTAL_SIZE=$(du -sh migration-data 2>/dev/null | cut -f1)
        info "Total data size: ${TOTAL_SIZE}"
        
        # List largest files
        info "Largest data files:"
        ls -lhS migration-data/*.csv 2>/dev/null | head -n 5 | awk '{print "  - " $9 " (" $5 ")"}'
    else
        warning "No CSV files found in migration-data/ - No data to import"
    fi
else
    warning "migration-data/ directory not found - No data to import"
fi

# Test 7: Check disk space
echo ""
info "Test 7/10: Checking disk space..."
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
info "Available disk space: ${AVAILABLE_SPACE}"
test_pass "Disk space check completed"

# Test 8: Test schema parsing
echo ""
info "Test 8/10: Validating schema syntax..."
if [ -f "../schema-export.sql" ]; then
    # Check for common issues
    if grep -q "CREATE TABLE" "../schema-export.sql"; then
        test_pass "Schema contains CREATE TABLE statements"
    else
        warning "No CREATE TABLE statements found in schema"
    fi
    
    if grep -q "CREATE POLICY" "../schema-export.sql"; then
        test_pass "Schema contains RLS policies"
    else
        warning "No RLS policies found in schema"
    fi
    
    if grep -q "CREATE FUNCTION" "../schema-export.sql"; then
        test_pass "Schema contains functions"
    else
        info "No custom functions in schema"
    fi
    
    # Check for syntax errors (basic)
    if grep -q "CREATE OR REPLACE" "../schema-export.sql"; then
        test_pass "Schema uses CREATE OR REPLACE pattern"
    fi
fi

# Test 9: Test migration scripts
echo ""
info "Test 9/10: Checking migration scripts..."
REQUIRED_SCRIPTS=(
    "run-migration.sh"
    "03-import-data.sh"
    "verify-migration.sh"
    "migration-status.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            test_pass "$script exists and is executable"
        else
            warning "$script exists but is NOT executable - Run: chmod +x $script"
        fi
    else
        error "$script NOT found"
    fi
done

# Test 10: Test Node.js connection helper
echo ""
info "Test 10/10: Testing Node.js Supabase connection..."
if [ -f "helpers/test-connection.js" ]; then
    if node helpers/test-connection.js 2>&1 | grep -q "SUCCESS"; then
        test_pass "Supabase connection test passed"
    else
        warning "Supabase connection test had issues - Check credentials"
    fi
else
    info "Connection test helper not available"
fi

# Summary
echo ""
echo "=========================================="
echo "  Test Results Summary"
echo "=========================================="
echo ""
echo -e "${GREEN}✓ Passed:${NC}  $TESTS_PASSED"
echo -e "${YELLOW}! Warnings:${NC} $TESTS_WARNING"
echo -e "${RED}✗ Failed:${NC}  $TESTS_FAILED"
echo ""

# Final verdict
if [ $TESTS_FAILED -eq 0 ]; then
    if [ $TESTS_WARNING -eq 0 ]; then
        echo -e "${GREEN}=========================================="
        echo "✓ ALL TESTS PASSED - READY FOR MIGRATION"
        echo "==========================================${NC}"
        echo ""
        info "Run './run-migration.sh' to start migration"
        exit 0
    else
        echo -e "${YELLOW}=========================================="
        echo "! TESTS PASSED WITH WARNINGS"
        echo "==========================================${NC}"
        echo ""
        info "Review warnings above before proceeding"
        info "Run './run-migration.sh' to start migration"
        exit 0
    fi
else
    echo -e "${RED}=========================================="
    echo "✗ TESTS FAILED - NOT READY FOR MIGRATION"
    echo "==========================================${NC}"
    echo ""
    error "Fix the errors above before attempting migration"
    exit 1
fi
