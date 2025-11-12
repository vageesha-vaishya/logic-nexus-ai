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
    
    if psql "$NEW_DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
        log "✓ Connection successful"
    else
        error "Cannot connect to new database. Check credentials."
        exit 1
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
    
    check_prerequisites
    load_config
    test_connection
    
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
        log "Step 4/4: Verifying migration..."
    else
        log "Step 3/3: Verifying migration..."
    fi
    verify_migration
    
    echo ""
    log "=========================================="
    log "✓ MIGRATION COMPLETED SUCCESSFULLY"
    log "=========================================="
    echo ""
    info "Next steps:"
    info "1. Deploy edge functions: supabase functions deploy"
    info "2. Update app .env file with new credentials"
    info "3. Test application thoroughly"
    info "4. Monitor for 24 hours before decommissioning old database"
    echo ""
    info "Log file: $LOG_FILE"
    echo ""
}

# Run main function
main
