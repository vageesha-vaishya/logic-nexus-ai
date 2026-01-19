#!/bin/bash

# Post-Migration Validation Script
# Compares source and target databases for 100% migration accuracy

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Validation results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0
TOTAL_TABLES=0
MISMATCHED_TABLES=()

# Functions
log() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((TESTS_PASSED++))
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

section() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}========================================${NC}"
}

# Load configuration
if [ ! -f "new-supabase-config.env" ]; then
    error "new-supabase-config.env not found"
    exit 1
fi

source new-supabase-config.env

# Check for source database URL
if [ -z "$SOURCE_DB_URL" ]; then
    warning "SOURCE_DB_URL not set - some validations will be skipped"
    warning "To enable full validation, add SOURCE_DB_URL to new-supabase-config.env"
    SOURCE_AVAILABLE=false
else
    SOURCE_AVAILABLE=true
fi

# Create validation report
REPORT_FILE="migration-logs/validation-report-$(date +%Y%m%d_%H%M%S).txt"
mkdir -p migration-logs

echo "Post-Migration Validation Report" > "$REPORT_FILE"
echo "Generated: $(date)" >> "$REPORT_FILE"
echo "========================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Header
section "Post-Migration Validation"
echo ""
info "Source Database: ${SOURCE_AVAILABLE}"
info "Target Database: ${NEW_DB_URL:0:50}..."
info "Report: $REPORT_FILE"
echo ""

# Test 1: Target database connectivity
section "Test 1: Database Connectivity"
if psql "$NEW_DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
    log "Target database connection successful"
else
    error "Cannot connect to target database"
    exit 1
fi

if [ "$SOURCE_AVAILABLE" = true ]; then
    if psql "$SOURCE_DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
        log "Source database connection successful"
    else
        warning "Cannot connect to source database - comparisons will be limited"
        SOURCE_AVAILABLE=false
    fi
fi

# Test 2: Get table lists
section "Test 2: Table Inventory"

TARGET_TABLES=$(psql "$NEW_DB_URL" -t -c "
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename;
" 2>/dev/null | grep -v '^$' | tr -d ' ')

TABLE_COUNT=$(echo "$TARGET_TABLES" | wc -l | tr -d ' ')
TOTAL_TABLES=$TABLE_COUNT
info "Found ${TABLE_COUNT} tables in target database"

if [ "$SOURCE_AVAILABLE" = true ]; then
    SOURCE_TABLES=$(psql "$SOURCE_DB_URL" -t -c "
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename;
    " 2>/dev/null | grep -v '^$' | tr -d ' ')
    
    SOURCE_TABLE_COUNT=$(echo "$SOURCE_TABLES" | wc -l | tr -d ' ')
    info "Found ${SOURCE_TABLE_COUNT} tables in source database"
    
    # Compare table lists
    MISSING_TABLES=$(comm -13 <(echo "$TARGET_TABLES" | sort) <(echo "$SOURCE_TABLES" | sort))
    EXTRA_TABLES=$(comm -23 <(echo "$TARGET_TABLES" | sort) <(echo "$SOURCE_TABLES" | sort))
    
    if [ -z "$MISSING_TABLES" ] && [ -z "$EXTRA_TABLES" ]; then
        log "All tables present in target database"
    else
        if [ -n "$MISSING_TABLES" ]; then
            error "Missing tables in target:"
            echo "$MISSING_TABLES" | while read table; do
                echo "  - $table"
            done
        fi
        if [ -n "$EXTRA_TABLES" ]; then
            warning "Extra tables in target (may be intentional):"
            echo "$EXTRA_TABLES" | while read table; do
                echo "  - $table"
            done
        fi
    fi
fi

# Test 3: Row count comparison
section "Test 3: Row Count Validation"

echo "" >> "$REPORT_FILE"
echo "TABLE ROW COUNT COMPARISON" >> "$REPORT_FILE"
echo "========================================" >> "$REPORT_FILE"
printf "%-40s %15s %15s %10s\n" "Table" "Source" "Target" "Match" >> "$REPORT_FILE"
echo "----------------------------------------" >> "$REPORT_FILE"

TOTAL_SOURCE_ROWS=0
TOTAL_TARGET_ROWS=0

echo "$TARGET_TABLES" | while read table; do
    if [ -z "$table" ]; then
        continue
    fi
    
    # Get target count
    TARGET_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM public.\"$table\";" 2>/dev/null | tr -d ' ')
    TOTAL_TARGET_ROWS=$((TOTAL_TARGET_ROWS + TARGET_COUNT))
    
    if [ "$SOURCE_AVAILABLE" = true ]; then
        # Get source count
        SOURCE_COUNT=$(psql "$SOURCE_DB_URL" -t -c "SELECT COUNT(*) FROM public.\"$table\";" 2>/dev/null | tr -d ' ' || echo "0")
        TOTAL_SOURCE_ROWS=$((TOTAL_SOURCE_ROWS + SOURCE_COUNT))
        
        # Compare
        if [ "$SOURCE_COUNT" = "$TARGET_COUNT" ]; then
            printf "%-40s %15s %15s %10s\n" "$table" "$SOURCE_COUNT" "$TARGET_COUNT" "✓" >> "$REPORT_FILE"
            echo -e "  ${GREEN}✓${NC} $table: $TARGET_COUNT rows (match)"
        else
            printf "%-40s %15s %15s %10s\n" "$table" "$SOURCE_COUNT" "$TARGET_COUNT" "✗" >> "$REPORT_FILE"
            echo -e "  ${RED}✗${NC} $table: Source=$SOURCE_COUNT, Target=$TARGET_COUNT (MISMATCH)"
            MISMATCHED_TABLES+=("$table")
        fi
    else
        printf "%-40s %15s %15s %10s\n" "$table" "N/A" "$TARGET_COUNT" "-" >> "$REPORT_FILE"
        echo -e "  ${BLUE}i${NC} $table: $TARGET_COUNT rows"
    fi
done

echo "" >> "$REPORT_FILE"
echo "Total Rows: Source=$TOTAL_SOURCE_ROWS, Target=$TOTAL_TARGET_ROWS" >> "$REPORT_FILE"

if [ "$SOURCE_AVAILABLE" = true ]; then
    if [ $TOTAL_SOURCE_ROWS -eq $TOTAL_TARGET_ROWS ]; then
        log "Total row counts match: $TOTAL_TARGET_ROWS rows"
    else
        error "Total row count mismatch: Source=$TOTAL_SOURCE_ROWS, Target=$TOTAL_TARGET_ROWS"
    fi
fi

# Test 4: Data integrity - Check for NULLs in primary keys
section "Test 4: Primary Key Integrity"

NULL_PK_ISSUES=0

echo "" >> "$REPORT_FILE"
echo "PRIMARY KEY INTEGRITY" >> "$REPORT_FILE"
echo "========================================" >> "$REPORT_FILE"

echo "$TARGET_TABLES" | while read table; do
    if [ -z "$table" ]; then
        continue
    fi
    
    # Check for NULL primary keys
    NULL_COUNT=$(psql "$NEW_DB_URL" -t -c "
        SELECT COUNT(*) 
        FROM public.\"$table\" 
        WHERE id IS NULL;
    " 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$NULL_COUNT" -gt 0 ]; then
        echo "  ✗ $table: $NULL_COUNT rows with NULL primary key" >> "$REPORT_FILE"
        error "$table has $NULL_COUNT rows with NULL id"
        NULL_PK_ISSUES=$((NULL_PK_ISSUES + 1))
    fi
done

if [ $NULL_PK_ISSUES -eq 0 ]; then
    log "No NULL primary key issues found"
    echo "No NULL primary key issues" >> "$REPORT_FILE"
fi

# Test 5: Foreign key integrity
section "Test 5: Foreign Key Constraints"

FK_VIOLATIONS=$(psql "$NEW_DB_URL" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
    AND constraint_schema = 'public';
" 2>/dev/null | tr -d ' ')

info "Found $FK_VIOLATIONS foreign key constraints"

# Test foreign key validity (this will fail if there are orphaned records)
FK_ERRORS=0
echo "" >> "$REPORT_FILE"
echo "FOREIGN KEY CONSTRAINT VALIDATION" >> "$REPORT_FILE"
echo "========================================" >> "$REPORT_FILE"

psql "$NEW_DB_URL" -t -c "
    SELECT 
        tc.table_name,
        tc.constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.constraint_schema = 'public';
" 2>/dev/null | grep -v '^$' | while read line; do
    TABLE=$(echo "$line" | awk '{print $1}' | tr -d ' ')
    CONSTRAINT=$(echo "$line" | awk '{print $3}' | tr -d ' ')
    
    if [ -n "$TABLE" ] && [ -n "$CONSTRAINT" ]; then
        # Try to validate constraint
        psql "$NEW_DB_URL" -c "
            ALTER TABLE public.\"$TABLE\" 
            VALIDATE CONSTRAINT \"$CONSTRAINT\";
        " >/dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            echo "  ✓ $TABLE.$CONSTRAINT: Valid" >> "$REPORT_FILE"
        else
            echo "  ✗ $TABLE.$CONSTRAINT: INVALID (orphaned records)" >> "$REPORT_FILE"
            warning "Foreign key constraint violation: $TABLE.$CONSTRAINT"
            FK_ERRORS=$((FK_ERRORS + 1))
        fi
    fi
done

if [ $FK_ERRORS -eq 0 ]; then
    log "All foreign key constraints valid"
else
    error "Found $FK_ERRORS foreign key constraint violations"
fi

# Test 6: Check for duplicate primary keys
section "Test 6: Duplicate Key Detection"

DUPLICATE_ISSUES=0

echo "" >> "$REPORT_FILE"
echo "DUPLICATE PRIMARY KEY DETECTION" >> "$REPORT_FILE"
echo "========================================" >> "$REPORT_FILE"

echo "$TARGET_TABLES" | while read table; do
    if [ -z "$table" ]; then
        continue
    fi
    
    # Check for duplicate IDs
    DUPLICATES=$(psql "$NEW_DB_URL" -t -c "
        SELECT COUNT(*) 
        FROM (
            SELECT id, COUNT(*) as cnt 
            FROM public.\"$table\" 
            WHERE id IS NOT NULL
            GROUP BY id 
            HAVING COUNT(*) > 1
        ) dupes;
    " 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$DUPLICATES" -gt 0 ]; then
        echo "  ✗ $table: $DUPLICATES duplicate IDs found" >> "$REPORT_FILE"
        error "$table has $DUPLICATES duplicate primary keys"
        DUPLICATE_ISSUES=$((DUPLICATE_ISSUES + 1))
    fi
done

if [ $DUPLICATE_ISSUES -eq 0 ]; then
    log "No duplicate primary keys found"
    echo "No duplicate primary keys" >> "$REPORT_FILE"
fi

# Test 7: Sample data comparison (if source available)
if [ "$SOURCE_AVAILABLE" = true ]; then
    section "Test 7: Sample Data Checksums"
    
    echo "" >> "$REPORT_FILE"
    echo "SAMPLE DATA CHECKSUM COMPARISON" >> "$REPORT_FILE"
    echo "========================================" >> "$REPORT_FILE"
    
    # Compare first 100 rows of key tables
    KEY_TABLES=("tenants" "profiles" "leads" "accounts" "contacts")
    
    for table in "${KEY_TABLES[@]}"; do
        # Check if table exists
        TABLE_EXISTS=$(echo "$TARGET_TABLES" | grep -c "^$table$" || echo "0")
        
        if [ "$TABLE_EXISTS" -eq 0 ]; then
            info "Table '$table' not found, skipping"
            continue
        fi
        
        # Get sample checksums
        SOURCE_CHECKSUM=$(psql "$SOURCE_DB_URL" -t -c "
            SELECT md5(string_agg(id::text, ',' ORDER BY id)) 
            FROM (SELECT id FROM public.\"$table\" ORDER BY id LIMIT 100) sample;
        " 2>/dev/null | tr -d ' ')
        
        TARGET_CHECKSUM=$(psql "$NEW_DB_URL" -t -c "
            SELECT md5(string_agg(id::text, ',' ORDER BY id)) 
            FROM (SELECT id FROM public.\"$table\" ORDER BY id LIMIT 100) sample;
        " 2>/dev/null | tr -d ' ')
        
        if [ "$SOURCE_CHECKSUM" = "$TARGET_CHECKSUM" ]; then
            log "$table: Sample data matches"
            echo "  ✓ $table: Checksums match" >> "$REPORT_FILE"
        else
            error "$table: Sample data checksum mismatch"
            echo "  ✗ $table: Checksums differ" >> "$REPORT_FILE"
            echo "    Source: $SOURCE_CHECKSUM" >> "$REPORT_FILE"
            echo "    Target: $TARGET_CHECKSUM" >> "$REPORT_FILE"
        fi
    done
fi

# Test 8: RLS Policy comparison
section "Test 8: Security Policies"

TARGET_RLS=$(psql "$NEW_DB_URL" -t -c "
    SELECT COUNT(*) 
    FROM pg_policies 
    WHERE schemaname = 'public';
" 2>/dev/null | tr -d ' ')

info "Target has $TARGET_RLS RLS policies"

if [ "$SOURCE_AVAILABLE" = true ]; then
    SOURCE_RLS=$(psql "$SOURCE_DB_URL" -t -c "
        SELECT COUNT(*) 
        FROM pg_policies 
        WHERE schemaname = 'public';
    " 2>/dev/null | tr -d ' ')
    
    info "Source has $SOURCE_RLS RLS policies"
    
    if [ "$SOURCE_RLS" = "$TARGET_RLS" ]; then
        log "RLS policy count matches"
    else
        warning "RLS policy count differs: Source=$SOURCE_RLS, Target=$TARGET_RLS"
    fi
fi

echo "" >> "$REPORT_FILE"
echo "RLS POLICIES: $TARGET_RLS" >> "$REPORT_FILE"

# Test 9: Function count comparison
section "Test 9: Database Functions"

TARGET_FUNCS=$(psql "$NEW_DB_URL" -t -c "
    SELECT COUNT(*) 
    FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public';
" 2>/dev/null | tr -d ' ')

info "Target has $TARGET_FUNCS functions"

if [ "$SOURCE_AVAILABLE" = true ]; then
    SOURCE_FUNCS=$(psql "$SOURCE_DB_URL" -t -c "
        SELECT COUNT(*) 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public';
    " 2>/dev/null | tr -d ' ')
    
    info "Source has $SOURCE_FUNCS functions"
    
    if [ "$SOURCE_FUNCS" = "$TARGET_FUNCS" ]; then
        log "Function count matches"
    else
        warning "Function count differs: Source=$SOURCE_FUNCS, Target=$TARGET_FUNCS"
    fi
fi

echo "" >> "$REPORT_FILE"
echo "FUNCTIONS: $TARGET_FUNCS" >> "$REPORT_FILE"

# Test 10: Sequence values
section "Test 10: Sequence States"

echo "" >> "$REPORT_FILE"
echo "SEQUENCE VALUES" >> "$REPORT_FILE"
echo "========================================" >> "$REPORT_FILE"

SEQUENCES=$(psql "$NEW_DB_URL" -t -c "
    SELECT sequence_name 
    FROM information_schema.sequences 
    WHERE sequence_schema = 'public';
" 2>/dev/null | grep -v '^$')

if [ -n "$SEQUENCES" ]; then
    echo "$SEQUENCES" | while read seq; do
        if [ -z "$seq" ]; then
            continue
        fi
        
        SEQ_VALUE=$(psql "$NEW_DB_URL" -t -c "SELECT last_value FROM public.\"$seq\";" 2>/dev/null | tr -d ' ')
        echo "  $seq: $SEQ_VALUE" >> "$REPORT_FILE"
        info "$seq = $SEQ_VALUE"
    done
    log "Sequence values recorded"
else
    info "No sequences found"
    echo "No sequences in schema" >> "$REPORT_FILE"
fi

# Summary
section "Validation Summary"

echo "" >> "$REPORT_FILE"
echo "========================================" >> "$REPORT_FILE"
echo "VALIDATION SUMMARY" >> "$REPORT_FILE"
echo "========================================" >> "$REPORT_FILE"
echo "Tests Passed:   $TESTS_PASSED" >> "$REPORT_FILE"
echo "Tests Failed:   $TESTS_FAILED" >> "$REPORT_FILE"
echo "Warnings:       $TESTS_WARNING" >> "$REPORT_FILE"
echo "Total Tables:   $TOTAL_TABLES" >> "$REPORT_FILE"

if [ ${#MISMATCHED_TABLES[@]} -gt 0 ]; then
    echo "" >> "$REPORT_FILE"
    echo "MISMATCHED TABLES:" >> "$REPORT_FILE"
    for table in "${MISMATCHED_TABLES[@]}"; do
        echo "  - $table" >> "$REPORT_FILE"
    done
fi

echo ""
echo -e "${GREEN}✓ Passed:${NC}  $TESTS_PASSED"
echo -e "${YELLOW}! Warnings:${NC} $TESTS_WARNING"
echo -e "${RED}✗ Failed:${NC}  $TESTS_FAILED"
echo ""

# Final verdict
if [ $TESTS_FAILED -eq 0 ]; then
    if [ $TESTS_WARNING -eq 0 ]; then
        echo -e "${GREEN}=========================================="
        echo "✓ VALIDATION PASSED - 100% MIGRATION SUCCESS"
        echo "==========================================${NC}"
        echo ""
        info "Migration is complete and accurate"
        info "All data integrity checks passed"
        echo "SUCCESS" >> "$REPORT_FILE"
        exit 0
    else
        echo -e "${YELLOW}=========================================="
        echo "! VALIDATION PASSED WITH WARNINGS"
        echo "==========================================${NC}"
        echo ""
        warning "Review warnings in: $REPORT_FILE"
        info "Migration appears successful but check warnings"
        echo "PASSED_WITH_WARNINGS" >> "$REPORT_FILE"
        exit 0
    fi
else
    echo -e "${RED}=========================================="
    echo "✗ VALIDATION FAILED - MIGRATION ISSUES DETECTED"
    echo "==========================================${NC}"
    echo ""
    error "Critical issues found in migration"
    error "Review detailed report: $REPORT_FILE"
    echo ""
    info "Recommended actions:"
    info "1. Review failed tests above"
    info "2. Check migration logs"
    info "3. Re-run migration if necessary"
    info "4. Contact support if issues persist"
    echo "FAILED" >> "$REPORT_FILE"
    exit 1
fi
