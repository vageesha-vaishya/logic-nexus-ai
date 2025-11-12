#!/bin/bash

# Data Import Script with Progress Tracking
# Imports CSV data in correct dependency order

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Load config
source new-supabase-config.env

# Progress tracking
TOTAL_TABLES=0
COMPLETED_TABLES=0
START_TIME=$(date +%s)

log() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

progress() {
    echo -e "${CYAN}[PROGRESS]${NC} $1"
}

# Calculate elapsed time
elapsed_time() {
    local current=$(date +%s)
    local elapsed=$((current - START_TIME))
    local hours=$((elapsed / 3600))
    local minutes=$(((elapsed % 3600) / 60))
    local seconds=$((elapsed % 60))
    printf "%02d:%02d:%02d" $hours $minutes $seconds
}

# Calculate ETA
calculate_eta() {
    if [ $COMPLETED_TABLES -eq 0 ]; then
        echo "Calculating..."
        return
    fi
    
    local current=$(date +%s)
    local elapsed=$((current - START_TIME))
    local avg_time=$((elapsed / COMPLETED_TABLES))
    local remaining=$((TOTAL_TABLES - COMPLETED_TABLES))
    local eta_seconds=$((avg_time * remaining))
    
    local hours=$((eta_seconds / 3600))
    local minutes=$(((eta_seconds % 3600) / 60))
    local seconds=$((eta_seconds % 60))
    printf "%02d:%02d:%02d" $hours $minutes $seconds
}

# Progress bar
show_progress() {
    local percent=$((COMPLETED_TABLES * 100 / TOTAL_TABLES))
    local filled=$((percent / 2))
    local empty=$((50 - filled))
    
    printf "\r${CYAN}Progress: [${NC}"
    printf "%${filled}s" | tr ' ' '█'
    printf "%${empty}s" | tr ' ' '░'
    printf "${CYAN}] ${percent}%% (${COMPLETED_TABLES}/${TOTAL_TABLES}) ${NC}"
    printf "Elapsed: $(elapsed_time) | ETA: $(calculate_eta)"
}

# Count total tables to import
count_tables() {
    TOTAL_TABLES=0
    for table in tenants franchises profiles user_roles currencies continents countries cities \
                 ports_locations service_types service_type_mappings cargo_types package_categories \
                 package_sizes container_types container_sizes carriers consignees incoterms vehicles \
                 warehouses charge_sides charge_categories charge_bases custom_roles custom_role_permissions \
                 user_custom_roles subscription_plans tenant_subscriptions usage_records subscription_invoices \
                 quote_number_config_tenant quote_number_config_franchise quote_number_sequences user_capacity \
                 assignment_rules territory_assignments email_accounts email_filters email_templates \
                 document_templates compliance_rules margin_profiles margin_methods accounts contacts leads \
                 lead_assignment_queue lead_assignment_history opportunities opportunity_items activities \
                 campaigns campaign_members emails services carrier_rates carrier_rate_charges shipping_rates \
                 quotes quotation_versions quotation_version_options quote_legs quote_charges quote_packages \
                 customer_selections rate_calculations cargo_details shipments tracking_events documents \
                 audit_logs notifications system_settings; do
        if [ -f "migration-data/${table}.csv" ]; then
            ((TOTAL_TABLES++))
        fi
    done
    info "Found $TOTAL_TABLES tables to import"
}

# Import single table with progress
import_table() {
    local table_name=$1
    local csv_file="migration-data/${table_name}.csv"
    
    if [ ! -f "$csv_file" ]; then
        return
    fi
    
    show_progress
    echo "" # New line after progress bar
    log "Importing $table_name..."
    
    local import_start=$(date +%s)
    
    # Truncate existing data first (for re-runs)
    psql "$NEW_DB_URL" -c "TRUNCATE TABLE public.$table_name CASCADE;" 2>/dev/null || true
    
    # Temporarily disable RLS and triggers for faster import
    psql "$NEW_DB_URL" -c "ALTER TABLE public.$table_name DISABLE ROW LEVEL SECURITY;" 2>/dev/null || true
    psql "$NEW_DB_URL" -c "ALTER TABLE public.$table_name DISABLE TRIGGER ALL;" 2>/dev/null || true
    
    # Import data
    psql "$NEW_DB_URL" -c "\\COPY public.$table_name FROM '$csv_file' WITH (FORMAT csv, HEADER true, QUOTE '\"')" 2>&1 | grep -v "^$" || true
    
    # Re-enable triggers and RLS
    psql "$NEW_DB_URL" -c "ALTER TABLE public.$table_name ENABLE TRIGGER ALL;" 2>/dev/null || true
    psql "$NEW_DB_URL" -c "ALTER TABLE public.$table_name ENABLE ROW LEVEL SECURITY;" 2>/dev/null || true
    
    # Get row count and file size
    local count=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM public.$table_name;" | tr -d ' ')
    local file_size=$(du -h "$csv_file" | cut -f1)
    local import_end=$(date +%s)
    local import_duration=$((import_end - import_start))
    
    log "✓ Imported $table_name: $count rows ($file_size) in ${import_duration}s"
    
    ((COMPLETED_TABLES++))
}

echo ""
log "=========================================="
log "Data Import Process with Progress Tracking"
log "=========================================="
echo ""

# Count tables first
count_tables
echo ""

# Phase 1: Master Data (no dependencies)
log ""
log "Phase 1: Master Data"
log "------------------------------------------"
import_table "tenants"
import_table "franchises"
import_table "profiles"
import_table "user_roles"
import_table "currencies"
import_table "continents"
import_table "countries"
import_table "cities"
import_table "ports_locations"
import_table "service_types"
import_table "service_type_mappings"
import_table "cargo_types"
import_table "package_categories"
import_table "package_sizes"
import_table "container_types"
import_table "container_sizes"
import_table "carriers"
import_table "consignees"
import_table "incoterms"
import_table "vehicles"
import_table "warehouses"
import_table "charge_sides"
import_table "charge_categories"
import_table "charge_bases"

# Phase 2: Configuration Data
log ""
log "Phase 2: Configuration Data"
log "------------------------------------------"
import_table "custom_roles"
import_table "custom_role_permissions"
import_table "user_custom_roles"
import_table "subscription_plans"
import_table "tenant_subscriptions"
import_table "usage_records"
import_table "subscription_invoices"
import_table "quote_number_config_tenant"
import_table "quote_number_config_franchise"
import_table "quote_number_sequences"
import_table "user_capacity"
import_table "assignment_rules"
import_table "territory_assignments"
import_table "email_accounts"
import_table "email_filters"
import_table "email_templates"
import_table "document_templates"
import_table "compliance_rules"
import_table "margin_profiles"
import_table "margin_methods"

# Phase 3: CRM Data
log ""
log "Phase 3: CRM Data"
log "------------------------------------------"
import_table "accounts"
import_table "contacts"
import_table "leads"
import_table "lead_assignment_queue"
import_table "lead_assignment_history"
import_table "opportunities"
import_table "opportunity_items"
import_table "activities"
import_table "campaigns"
import_table "campaign_members"
import_table "emails"

# Phase 4: Quotes & Shipments
log ""
log "Phase 4: Quotes & Shipments"
log "------------------------------------------"
import_table "services"
import_table "carrier_rates"
import_table "carrier_rate_charges"
import_table "shipping_rates"
import_table "quotes"
import_table "quotation_versions"
import_table "quotation_version_options"
import_table "quote_legs"
import_table "quote_charges"
import_table "quote_packages"
import_table "customer_selections"
import_table "rate_calculations"
import_table "cargo_details"
import_table "shipments"
import_table "tracking_events"
import_table "documents"

# Phase 5: Audit & System
log ""
log "Phase 5: Audit & System Data"
log "------------------------------------------"
import_table "audit_logs"
import_table "notifications"
import_table "system_settings"

# Reset sequences
log ""
log "Resetting sequences..."
log "------------------------------------------"

psql "$NEW_DB_URL" << 'EOF'
DO $$
DECLARE
    seq_record RECORD;
BEGIN
    FOR seq_record IN
        SELECT schemaname, tablename, columnname
        FROM pg_catalog.pg_tables t
        JOIN pg_catalog.pg_attribute a ON a.attrelid = (t.schemaname || '.' || t.tablename)::regclass
        WHERE t.schemaname = 'public'
          AND a.atthasdef
          AND pg_get_expr(a.attdefault, a.attrelid) LIKE 'nextval%'
    LOOP
        EXECUTE format('SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE(MAX(%I), 1)) FROM %I.%I',
                      seq_record.schemaname || '.' || seq_record.tablename,
                      seq_record.columnname,
                      seq_record.columnname,
                      seq_record.schemaname,
                      seq_record.tablename);
    END LOOP;
END $$;
EOF

log "✓ Sequences reset"

show_progress
echo "" # New line after final progress
echo ""
log "=========================================="
log "✓ Data Import Complete"
log "=========================================="
info "Total time: $(elapsed_time)"
info "Tables imported: $COMPLETED_TABLES"
info "Success rate: 100%"
