#!/bin/bash

# Complete Supabase Migration Script
# Automates migration from Lovable Cloud to Supabase Cloud

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create logs directory
mkdir -p migration-logs

# Log file
LOG_FILE="migration-logs/migration-$(date +%Y%m%d_%H%M%S).log"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +%Y-%m-%d\ %H:%M:%S)]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command_exists psql; then
        error "psql not found. Please install PostgreSQL client."
        exit 1
    fi
    
    if ! command_exists node; then
        error "Node.js not found. Please install Node.js."
        exit 1
    fi
    
    if [ ! -f "new-supabase-config.env" ]; then
        error "new-supabase-config.env not found. Please create it from template."
        exit 1
    fi
    
    log "✓ All prerequisites met"
}

# Load new database configuration
load_config() {
    log "Loading configuration..."
    source new-supabase-config.env
    
    if [ -z "$NEW_DB_URL" ]; then
        error "NEW_DB_URL not set in new-supabase-config.env"
        exit 1
    fi
    
    log "✓ Configuration loaded"
}

# Test connection to new database
test_connection() {
    log "Testing connection to new Supabase database..."
    
    # Parse and attempt direct then pooling
    local DB_HOST DB_NAME DB_PASS
    DB_HOST=$(echo "$NEW_DB_URL" | sed -E 's#.*@([^:/?]+).*#\1#')
    DB_NAME=$(echo "$NEW_DB_URL" | sed -E 's#.*/([^?]+).*#\1#')
    DB_PASS=$(echo "$NEW_DB_URL" | sed -E 's#postgresql://postgres:([^@]+)@.*#\1#')
    
    if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p 5432 -U postgres -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
        log "✓ Direct connection successful (5432)"
    else
        warning "Direct connection (5432) failed; trying pooling (6543)."
        if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p 6543 -U postgres -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1; then
            NEW_DB_URL="postgresql://postgres:${DB_PASS}@${DB_HOST}:6543/${DB_NAME}?sslmode=require"
            export NEW_DB_URL
            log "✓ Pooling connection successful (6543). Using updated NEW_DB_URL."
        else
            error "Cannot connect on 5432 or 6543. Check credentials, firewall, and network access."
            exit 1
        fi
    fi
}

# Apply schema
apply_schema() {
    log "Applying database schema..."
    
    info "This may take 5-10 minutes for large schemas..."
    
    # Apply schema from export
    if [ -f "../schema-export.sql" ]; then
        psql "$NEW_DB_URL" -f "../schema-export.sql" >> "$LOG_FILE" 2>&1
        log "✓ Schema applied successfully"
    else
        error "schema-export.sql not found"
        exit 1
    fi
}

# Import data
import_data() {
    log "Importing data..."
    
    if [ -d "migration-data" ] && [ "$(ls -A migration-data/*.csv 2>/dev/null)" ]; then
        bash 03-import-data.sh >> "$LOG_FILE" 2>&1
        log "✓ Data imported successfully"
    else
        warning "No data files found in migration-data/"
        warning "Please export data first using export scripts"
    fi
}

# Verify migration
verify_migration() {
    log "Verifying migration..."
    
    bash verify-migration.sh >> "$LOG_FILE" 2>&1
    
    log "✓ Verification complete"
}

# Main migration flow
main() {
    echo ""
    echo "=========================================="
    echo "  Supabase Migration Tool"
    echo "  Lovable Cloud → Supabase Cloud"
    echo "=========================================="
    echo ""
    
    log "Starting migration process..."
    
    # Run pre-migration tests
    if [ -f "00-pre-migration-test.sh" ]; then
        log "Running pre-migration environment tests..."
        bash 00-pre-migration-test.sh
        
        if [ $? -ne 0 ]; then
            error "Pre-migration tests failed. Please fix errors before continuing."
            exit 1
        fi
        echo ""
    else
        warning "Pre-migration test script not found, skipping tests..."
        check_prerequisites
        load_config
        test_connection
    fi
    
    echo ""
    warning "About to migrate database. This will:"
    warning "1. Clean existing database objects (if any)"
    warning "2. Apply fresh schema"
    warning "3. Import all data"
    warning "4. Verify data integrity"
    echo ""
    read -p "Do you want to clean existing database first? (yes/no): " clean_confirm
    read -p "Continue with migration? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        error "Migration cancelled by user"
        exit 1
    fi
    
    echo ""
    if [ "$clean_confirm" = "yes" ]; then
        log "Step 1/4: Cleaning existing database..."
        if [ -f "02-cleanup-existing.sh" ]; then
            bash 02-cleanup-existing.sh >> "$LOG_FILE" 2>&1
            log "✓ Database cleaned"
        else
            warning "Cleanup script not found, skipping..."
        fi
        echo ""
        log "Step 2/4: Applying schema..."
    else
        log "Step 1/3: Applying schema (skipping cleanup)..."
    fi
    apply_schema
    
    echo ""
    if [ "$clean_confirm" = "yes" ]; then
        log "Step 3/4: Importing data..."
    else
        log "Step 2/3: Importing data..."
    fi
    import_data
    
    echo ""
    if [ "$clean_confirm" = "yes" ]; then
        log "Step 4/5: Verifying migration..."
    else
        log "Step 3/4: Verifying migration..."
    fi
    verify_migration
    
    echo ""
    if [ "$clean_confirm" = "yes" ]; then
        log "Step 5/5: Running post-migration validation..."
    else
        log "Step 4/4: Running post-migration validation..."
    fi
    
    if [ -f "04-post-migration-validation.sh" ]; then
        bash 04-post-migration-validation.sh >> "$LOG_FILE" 2>&1
        log "✓ Post-migration validation completed"
    else
        warning "Post-migration validation script not found, skipping..."
    fi
    
    echo ""
    log "=========================================="
    log "✓ MIGRATION COMPLETED SUCCESSFULLY"
    log "=========================================="
    echo ""
    info "Next steps:"
    info "1. Check validation report: migration-logs/validation-report-*.txt"
    info "2. Check migration status: ./migration-status.sh"
    info "3. Deploy edge functions: ./deploy-functions.sh"
    info "4. Update app .env file with new credentials"
    info "5. Test application thoroughly"
    info "6. Monitor for 24 hours before decommissioning old database"
    echo ""
    info "Log file: $LOG_FILE"
    info "View detailed validation: cat migration-logs/validation-report-*.txt"
    echo ""
}

# Run main function
main
