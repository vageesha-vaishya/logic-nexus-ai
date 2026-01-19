#!/bin/bash

# Migration Status Monitor
# Real-time monitoring of migration progress

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Load config
if [ -f "new-supabase-config.env" ]; then
    source new-supabase-config.env
else
    echo -e "${RED}Configuration file not found!${NC}"
    exit 1
fi

clear
echo ""
echo -e "${CYAN}=========================================="
echo "  Migration Status Monitor"
echo "==========================================${NC}"
echo ""

# Check connection
echo -e "${BLUE}Testing database connection...${NC}"
if psql "$NEW_DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connected to database${NC}"
else
    echo -e "${RED}✗ Cannot connect to database${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}Table Status:${NC}"
echo "----------------------------------------"

# List of all tables in expected order
TABLES=(
    "tenants" "franchises" "profiles" "user_roles"
    "currencies" "continents" "countries" "cities"
    "ports_locations" "service_types" "service_type_mappings"
    "cargo_types" "package_categories" "package_sizes"
    "container_types" "container_sizes" "carriers"
    "consignees" "incoterms" "vehicles" "warehouses"
    "charge_sides" "charge_categories" "charge_bases"
    "custom_roles" "custom_role_permissions" "user_custom_roles"
    "subscription_plans" "tenant_subscriptions" "usage_records"
    "subscription_invoices" "quote_number_config_tenant"
    "quote_number_config_franchise" "quote_number_sequences"
    "user_capacity" "assignment_rules" "territory_assignments"
    "email_accounts" "email_filters" "email_templates"
    "document_templates" "compliance_rules" "margin_profiles"
    "margin_methods" "accounts" "contacts" "leads"
    "lead_assignment_queue" "lead_assignment_history"
    "opportunities" "opportunity_items" "activities"
    "campaigns" "campaign_members" "emails"
    "services" "carrier_rates" "carrier_rate_charges"
    "shipping_rates" "quotes" "quotation_versions"
    "quotation_version_options" "quote_legs" "quote_charges"
    "quote_packages" "customer_selections" "rate_calculations"
    "cargo_details" "shipments" "tracking_events" "documents"
    "audit_logs" "notifications" "system_settings"
)

TOTAL_TABLES=${#TABLES[@]}
EXISTING_TABLES=0
TOTAL_ROWS=0

# Check each table
for table in "${TABLES[@]}"; do
    # Check if table exists
    EXISTS=$(psql "$NEW_DB_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" 2>/dev/null | tr -d ' ')
    
    if [ "$EXISTS" = "t" ]; then
        # Get row count
        COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM public.$table;" 2>/dev/null | tr -d ' ')
        
        if [ "$COUNT" -gt 0 ]; then
            echo -e "${GREEN}✓${NC} $table: $COUNT rows"
            ((EXISTING_TABLES++))
            ((TOTAL_ROWS+=COUNT))
        else
            echo -e "${YELLOW}○${NC} $table: 0 rows (empty)"
            ((EXISTING_TABLES++))
        fi
    else
        echo -e "${RED}✗${NC} $table: Not found"
    fi
done

echo ""
echo -e "${CYAN}Summary:${NC}"
echo "----------------------------------------"
echo -e "Tables created:  ${GREEN}${EXISTING_TABLES}/${TOTAL_TABLES}${NC}"
echo -e "Total rows:      ${GREEN}${TOTAL_ROWS}${NC}"

PERCENT=$((EXISTING_TABLES * 100 / TOTAL_TABLES))
echo -e "Progress:        ${CYAN}${PERCENT}%${NC}"

echo ""

# Check RLS policies
echo -e "${CYAN}Checking RLS Policies:${NC}"
echo "----------------------------------------"
RLS_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;" 2>/dev/null | tr -d ' ')
echo -e "Tables with RLS: ${GREEN}${RLS_COUNT}${NC}"

# Check functions
echo ""
echo -e "${CYAN}Checking Database Functions:${NC}"
echo "----------------------------------------"
FUNC_COUNT=$(psql "$NEW_DB_URL" -t -c "SELECT COUNT(*) FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');" 2>/dev/null | tr -d ' ')
echo -e "Functions found: ${GREEN}${FUNC_COUNT}${NC}"

# Check recent data
echo ""
echo -e "${CYAN}Recent Activity:${NC}"
echo "----------------------------------------"

# Check if any tables have recent data
RECENT=$(psql "$NEW_DB_URL" -t -c "
SELECT COUNT(*) 
FROM (
    SELECT created_at FROM leads WHERE created_at > NOW() - INTERVAL '1 hour'
    UNION ALL
    SELECT created_at FROM accounts WHERE created_at > NOW() - INTERVAL '1 hour'
    UNION ALL
    SELECT created_at FROM contacts WHERE created_at > NOW() - INTERVAL '1 hour'
) recent_data;
" 2>/dev/null | tr -d ' ')

if [ "$RECENT" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Recent data detected (last hour): $RECENT records"
else
    echo -e "${YELLOW}○${NC} No recent data (last hour)"
fi

echo ""
echo -e "${CYAN}==========================================${NC}"
echo ""
