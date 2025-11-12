#!/bin/bash

# Data Import Script
# Imports CSV data in correct dependency order

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load config
source new-supabase-config.env

log() {
    echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Import single table
import_table() {
    local table_name=$1
    local csv_file="migration-data/${table_name}.csv"
    
    if [ ! -f "$csv_file" ]; then
        echo "⊘ Skipping $table_name (no CSV file)"
        return
    fi
    
    log "Importing $table_name..."
    
    # Temporarily disable RLS and triggers for faster import
    psql "$NEW_DB_URL" -c "ALTER TABLE public.$table_name DISABLE ROW LEVEL SECURITY;" 2>/dev/null || true
    psql "$NEW_DB_URL" -c "ALTER TABLE public.$table_name DISABLE TRIGGER ALL;" 2>/dev/null || true
    
    # Import data
    psql "$NEW_DB_URL" -c "\\COPY public.$table_name FROM '$csv_file' WITH (FORMAT csv, HEADER true, QUOTE '\"')" 2>&1
    
    # Re-enable triggers and RLS
    psql "$NEW_DB_URL" -c "ALTER TABLE public.$table_name ENABLE TRIGGER ALL;" 2>/dev/null || true
    psql "$NEW_DB_URL" -c "ALTER TABLE public.$table_name ENABLE ROW LEVEL SECURITY;" 2>/dev/null || true
    
    # Get row count
    local count=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM public.$table_name;")
    log "✓ Imported $table_name: $count rows"
}

log "=========================================="
log "Data Import Process"
log "=========================================="

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

log ""
log "=========================================="
log "✓ Data Import Complete"
log "=========================================="
