#!/bin/bash

# ==========================================
# COMPLETE SEQUENTIAL MIGRATION EXPORT
# ==========================================
# This script exports EVERYTHING from Lovable Cloud
# in the correct dependency order for Supabase Cloud migration

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_DIR="migration-export-${TIMESTAMP}"

echo ""
echo "=========================================="
echo "  COMPLETE MIGRATION EXPORT"
echo "  Timestamp: ${TIMESTAMP}"
echo "=========================================="
echo ""

# Load source database configuration
if [ ! -f "new-supabase-config.env" ]; then
  echo -e "${RED}Error: new-supabase-config.env not found${NC}"
  exit 1
fi

source new-supabase-config.env

# Check if SOURCE_DB_URL is set
if [ -z "$SOURCE_DB_URL" ]; then
  echo -e "${RED}Error: SOURCE_DB_URL not set in new-supabase-config.env${NC}"
  echo -e "${YELLOW}Add your Lovable Cloud database URL:${NC}"
  echo -e "SOURCE_DB_URL=\"postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres\""
  exit 1
fi

# Create export directory structure
mkdir -p "$EXPORT_DIR"/{schema,data,functions,docs}

echo -e "${GREEN}Created export directory: ${EXPORT_DIR}${NC}"
echo ""

# ==========================================
# STEP 1: EXPORT SCHEMA
# ==========================================
echo -e "${BLUE}[1/6] Exporting Schema (Tables, Enums, Constraints, Indexes)...${NC}"

# Export complete schema in dependency order
PGPASSWORD=$(echo "$SOURCE_DB_URL" | sed -E 's#.*:([^@]+)@.*#\1#') \
psql "$SOURCE_DB_URL" > "$EXPORT_DIR/schema/01-complete-schema.sql" <<'EOF'
-- ==========================================
-- COMPLETE SCHEMA EXPORT
-- Generated: NOW()
-- ==========================================

-- Enums (must come first)
SELECT 'Creating enums...' AS status;

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT t.typname, string_agg(e.enumlabel, '|' ORDER BY e.enumsortorder) as labels
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
        GROUP BY t.typname
        ORDER BY t.typname
    LOOP
        RAISE NOTICE 'CREATE TYPE % AS ENUM (%);', 
            r.typname, 
            (SELECT string_agg('''' || unnest || '''', ', ')
             FROM unnest(string_to_array(r.labels, '|')));
    END LOOP;
END $$;

-- Export schema
\! pg_dump "$SOURCE_DB_URL" --schema-only --schema=public \
  --exclude-table=spatial_ref_sys \
  --no-owner --no-acl

EOF

echo -e "${GREEN}✓ Schema exported${NC}"
echo ""

# ==========================================
# STEP 2: EXPORT DATABASE FUNCTIONS
# ==========================================
echo -e "${BLUE}[2/6] Exporting Database Functions...${NC}"

PGPASSWORD=$(echo "$SOURCE_DB_URL" | sed -E 's#.*:([^@]+)@.*#\1#') \
psql "$SOURCE_DB_URL" -t -A > "$EXPORT_DIR/schema/02-functions.sql" <<'EOF'
SELECT pg_get_functiondef(p.oid) || ';'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
EOF

echo -e "${GREEN}✓ Database functions exported${NC}"
echo ""

# ==========================================
# STEP 3: EXPORT RLS POLICIES
# ==========================================
echo -e "${BLUE}[3/6] Exporting RLS Policies...${NC}"

PGPASSWORD=$(echo "$SOURCE_DB_URL" | sed -E 's#.*:([^@]+)@.*#\1#') \
psql "$SOURCE_DB_URL" > "$EXPORT_DIR/schema/03-rls-policies.sql" <<'EOF'
-- ==========================================
-- RLS POLICIES EXPORT
-- ==========================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
    LOOP
        -- Enable RLS on table
        RAISE NOTICE 'ALTER TABLE %.% ENABLE ROW LEVEL SECURITY;', 
            r.schemaname, r.tablename;
        
        -- Create policy
        RAISE NOTICE 'CREATE POLICY % ON %.% FOR % TO % %USING (%)%;',
            r.policyname,
            r.schemaname,
            r.tablename,
            r.cmd,
            array_to_string(r.roles, ', '),
            CASE WHEN r.permissive = 'PERMISSIVE' THEN '' ELSE 'AS RESTRICTIVE ' END,
            COALESCE(r.qual, 'true'),
            CASE WHEN r.with_check IS NOT NULL 
                 THEN ' WITH CHECK (' || r.with_check || ')' 
                 ELSE '' END;
    END LOOP;
END $$;
EOF

echo -e "${GREEN}✓ RLS policies exported${NC}"
echo ""

# ==========================================
# STEP 4: EXPORT DATA IN DEPENDENCY ORDER
# ==========================================
echo -e "${BLUE}[4/6] Exporting Table Data (Dependency Order)...${NC}"

# Phase 1: Master Data (no dependencies)
echo -e "${YELLOW}  Phase 1: Master Data...${NC}"
PGPASSWORD=$(echo "$SOURCE_DB_URL" | sed -E 's#.*:([^@]+)@.*#\1#') \
psql "$SOURCE_DB_URL" <<EOF
-- Tenants (root)
\copy (SELECT * FROM tenants ORDER BY created_at) TO '$EXPORT_DIR/data/01-tenants.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');

-- Franchises
\copy (SELECT * FROM franchises ORDER BY created_at) TO '$EXPORT_DIR/data/02-franchises.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');

-- Profiles
\copy (SELECT * FROM profiles ORDER BY created_at) TO '$EXPORT_DIR/data/03-profiles.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');

-- User Roles
\copy (SELECT * FROM user_roles ORDER BY created_at) TO '$EXPORT_DIR/data/04-user_roles.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');

-- Geography
\copy (SELECT * FROM continents ORDER BY created_at) TO '$EXPORT_DIR/data/05-continents.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM countries ORDER BY created_at) TO '$EXPORT_DIR/data/06-countries.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM cities ORDER BY created_at) TO '$EXPORT_DIR/data/07-cities.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM ports_locations ORDER BY created_at) TO '$EXPORT_DIR/data/08-ports_locations.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');

-- Logistics Master Data
\copy (SELECT * FROM currencies ORDER BY created_at) TO '$EXPORT_DIR/data/09-currencies.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM service_types ORDER BY created_at) TO '$EXPORT_DIR/data/10-service_types.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM service_type_mappings ORDER BY created_at) TO '$EXPORT_DIR/data/11-service_type_mappings.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM cargo_types ORDER BY created_at) TO '$EXPORT_DIR/data/12-cargo_types.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM package_categories ORDER BY created_at) TO '$EXPORT_DIR/data/13-package_categories.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM package_sizes ORDER BY created_at) TO '$EXPORT_DIR/data/14-package_sizes.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM container_types ORDER BY created_at) TO '$EXPORT_DIR/data/15-container_types.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM container_sizes ORDER BY created_at) TO '$EXPORT_DIR/data/16-container_sizes.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM carriers ORDER BY created_at) TO '$EXPORT_DIR/data/17-carriers.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM consignees ORDER BY created_at) TO '$EXPORT_DIR/data/18-consignees.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM incoterms ORDER BY created_at) TO '$EXPORT_DIR/data/19-incoterms.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM vehicles ORDER BY created_at) TO '$EXPORT_DIR/data/20-vehicles.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM warehouses ORDER BY created_at) TO '$EXPORT_DIR/data/21-warehouses.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');

-- Charge Configuration
\copy (SELECT * FROM charge_sides ORDER BY created_at) TO '$EXPORT_DIR/data/22-charge_sides.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM charge_categories ORDER BY created_at) TO '$EXPORT_DIR/data/23-charge_categories.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM charge_bases ORDER BY created_at) TO '$EXPORT_DIR/data/24-charge_bases.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
EOF

echo -e "${GREEN}  ✓ Phase 1 complete${NC}"

# Phase 2: Configuration Data
echo -e "${YELLOW}  Phase 2: Configuration Data...${NC}"
PGPASSWORD=$(echo "$SOURCE_DB_URL" | sed -E 's#.*:([^@]+)@.*#\1#') \
psql "$SOURCE_DB_URL" <<EOF
\copy (SELECT * FROM custom_roles ORDER BY created_at) TO '$EXPORT_DIR/data/25-custom_roles.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM custom_role_permissions ORDER BY created_at) TO '$EXPORT_DIR/data/26-custom_role_permissions.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM user_custom_roles ORDER BY created_at) TO '$EXPORT_DIR/data/27-user_custom_roles.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM subscription_plans ORDER BY created_at) TO '$EXPORT_DIR/data/28-subscription_plans.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM tenant_subscriptions ORDER BY created_at) TO '$EXPORT_DIR/data/29-tenant_subscriptions.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM usage_records ORDER BY created_at) TO '$EXPORT_DIR/data/30-usage_records.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM subscription_invoices ORDER BY created_at) TO '$EXPORT_DIR/data/31-subscription_invoices.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM quote_number_config_tenant ORDER BY created_at) TO '$EXPORT_DIR/data/32-quote_number_config_tenant.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM quote_number_config_franchise ORDER BY created_at) TO '$EXPORT_DIR/data/33-quote_number_config_franchise.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM quote_number_sequences ORDER BY created_at) TO '$EXPORT_DIR/data/34-quote_number_sequences.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM user_capacity ORDER BY created_at) TO '$EXPORT_DIR/data/35-user_capacity.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM assignment_rules ORDER BY created_at) TO '$EXPORT_DIR/data/36-assignment_rules.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM territory_assignments ORDER BY created_at) TO '$EXPORT_DIR/data/37-territory_assignments.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM email_accounts ORDER BY created_at) TO '$EXPORT_DIR/data/38-email_accounts.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM email_filters ORDER BY created_at) TO '$EXPORT_DIR/data/39-email_filters.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM email_templates ORDER BY created_at) TO '$EXPORT_DIR/data/40-email_templates.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM document_templates ORDER BY created_at) TO '$EXPORT_DIR/data/41-document_templates.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM compliance_rules ORDER BY created_at) TO '$EXPORT_DIR/data/42-compliance_rules.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM margin_methods ORDER BY created_at) TO '$EXPORT_DIR/data/43-margin_methods.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM margin_profiles ORDER BY created_at) TO '$EXPORT_DIR/data/44-margin_profiles.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
EOF

echo -e "${GREEN}  ✓ Phase 2 complete${NC}"

# Phase 3: CRM Data
echo -e "${YELLOW}  Phase 3: CRM Data...${NC}"
PGPASSWORD=$(echo "$SOURCE_DB_URL" | sed -E 's#.*:([^@]+)@.*#\1#') \
psql "$SOURCE_DB_URL" <<EOF
\copy (SELECT * FROM accounts ORDER BY created_at) TO '$EXPORT_DIR/data/45-accounts.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM contacts ORDER BY created_at) TO '$EXPORT_DIR/data/46-contacts.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM leads ORDER BY created_at) TO '$EXPORT_DIR/data/47-leads.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM lead_assignment_queue ORDER BY created_at) TO '$EXPORT_DIR/data/48-lead_assignment_queue.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM lead_assignment_history ORDER BY created_at) TO '$EXPORT_DIR/data/49-lead_assignment_history.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM opportunities ORDER BY created_at) TO '$EXPORT_DIR/data/50-opportunities.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM opportunity_items ORDER BY created_at) TO '$EXPORT_DIR/data/51-opportunity_items.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM activities ORDER BY created_at) TO '$EXPORT_DIR/data/52-activities.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM campaigns ORDER BY created_at) TO '$EXPORT_DIR/data/53-campaigns.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM campaign_members ORDER BY created_at) TO '$EXPORT_DIR/data/54-campaign_members.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM emails ORDER BY created_at) TO '$EXPORT_DIR/data/55-emails.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
EOF

echo -e "${GREEN}  ✓ Phase 3 complete${NC}"

# Phase 4: Quotes & Shipments
echo -e "${YELLOW}  Phase 4: Quotes & Shipments...${NC}"
PGPASSWORD=$(echo "$SOURCE_DB_URL" | sed -E 's#.*:([^@]+)@.*#\1#') \
psql "$SOURCE_DB_URL" <<EOF
\copy (SELECT * FROM services ORDER BY created_at) TO '$EXPORT_DIR/data/56-services.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM carrier_rates ORDER BY created_at) TO '$EXPORT_DIR/data/57-carrier_rates.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM carrier_rate_charges ORDER BY created_at) TO '$EXPORT_DIR/data/58-carrier_rate_charges.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM shipping_rates ORDER BY created_at) TO '$EXPORT_DIR/data/59-shipping_rates.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM quotes ORDER BY created_at) TO '$EXPORT_DIR/data/60-quotes.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM quotation_versions ORDER BY created_at) TO '$EXPORT_DIR/data/61-quotation_versions.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM quotation_version_options ORDER BY created_at) TO '$EXPORT_DIR/data/62-quotation_version_options.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM quote_legs ORDER BY created_at) TO '$EXPORT_DIR/data/63-quote_legs.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM quote_charges ORDER BY created_at) TO '$EXPORT_DIR/data/64-quote_charges.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM quote_packages ORDER BY created_at) TO '$EXPORT_DIR/data/65-quote_packages.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM customer_selections ORDER BY selected_at) TO '$EXPORT_DIR/data/66-customer_selections.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM rate_calculations ORDER BY calculated_at) TO '$EXPORT_DIR/data/67-rate_calculations.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM shipments ORDER BY created_at) TO '$EXPORT_DIR/data/68-shipments.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM cargo_details ORDER BY created_at) TO '$EXPORT_DIR/data/69-cargo_details.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM tracking_events ORDER BY event_timestamp) TO '$EXPORT_DIR/data/70-tracking_events.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
EOF

echo -e "${GREEN}  ✓ Phase 4 complete${NC}"

# Phase 5: Audit & System Data
echo -e "${YELLOW}  Phase 5: Audit & System Data...${NC}"
PGPASSWORD=$(echo "$SOURCE_DB_URL" | sed -E 's#.*:([^@]+)@.*#\1#') \
psql "$SOURCE_DB_URL" <<EOF
\copy (SELECT * FROM audit_logs ORDER BY created_at) TO '$EXPORT_DIR/data/71-audit_logs.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM notifications ORDER BY created_at) TO '$EXPORT_DIR/data/72-notifications.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
\copy (SELECT * FROM system_settings ORDER BY created_at) TO '$EXPORT_DIR/data/73-system_settings.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"');
EOF

echo -e "${GREEN}  ✓ Phase 5 complete${NC}"
echo -e "${GREEN}✓ All table data exported${NC}"
echo ""

# ==========================================
# STEP 5: DOCUMENT EDGE FUNCTIONS
# ==========================================
echo -e "${BLUE}[5/6] Documenting Edge Functions...${NC}"

cat > "$EXPORT_DIR/functions/edge-functions-list.txt" <<EOF
==========================================
EDGE FUNCTIONS TO COPY
==========================================

The following edge functions need to be copied manually from:
  supabase/functions/

Edge Functions:
  - create-user
  - exchange-oauth-token
  - get-account-label
  - get-contact-label
  - get-opportunity-full
  - get-opportunity-label
  - get-service-label
  - list-edge-functions
  - process-lead-assignments
  - salesforce-sync-opportunity
  - search-emails
  - seed-platform-admin
  - send-email
  - sync-all-mailboxes
  - sync-emails

Shared code:
  - _shared/cors.ts

After migration, deploy using:
  supabase functions deploy <function-name> --project-ref <project-ref>

Or use the deploy-functions.sh script provided.
EOF

# Copy all edge functions
if [ -d "../../supabase/functions" ]; then
  cp -r ../../supabase/functions/* "$EXPORT_DIR/functions/" 2>/dev/null || true
  echo -e "${GREEN}✓ Edge functions copied${NC}"
else
  echo -e "${YELLOW}⚠ No edge functions directory found${NC}"
fi
echo ""

# ==========================================
# STEP 6: DOCUMENT SECRETS
# ==========================================
echo -e "${BLUE}[6/6] Documenting Secrets...${NC}"

cat > "$EXPORT_DIR/docs/secrets-list.txt" <<EOF
==========================================
SECRETS CONFIGURATION
==========================================

The following secrets need to be configured in the new Supabase project:
(Values are NOT exported for security reasons)

Required Secrets:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
  - SUPABASE_DB_URL
  - SUPABASE_PUBLISHABLE_KEY
  - DB_PASSWORD

Configure secrets using:
  supabase secrets set SECRET_NAME=secret_value --project-ref <project-ref>

Or through the Supabase Dashboard:
  Project Settings → Edge Functions → Secrets
EOF

echo -e "${GREEN}✓ Secrets documented${NC}"
echo ""

# ==========================================
# CREATE MIGRATION GUIDE
# ==========================================
cat > "$EXPORT_DIR/docs/MIGRATION-GUIDE.md" <<EOF
# Sequential Migration Guide

## Overview
This export contains a complete, dependency-ordered migration package from Lovable Cloud to Supabase Cloud.

## Export Contents

### 1. Schema (schema/)
- \`01-complete-schema.sql\` - Complete database schema (tables, columns, constraints, indexes)
- \`02-functions.sql\` - All database functions
- \`03-rls-policies.sql\` - All Row Level Security policies

### 2. Data (data/)
- 73 CSV files in dependency order (01-73)
- Organized in 5 phases:
  * Phase 1 (01-24): Master Data
  * Phase 2 (25-44): Configuration Data
  * Phase 3 (45-55): CRM Data
  * Phase 4 (56-70): Quotes & Shipments
  * Phase 5 (71-73): Audit & System Data

### 3. Edge Functions (functions/)
- All edge functions with source code
- Shared utilities
- Deployment instructions

### 4. Documentation (docs/)
- This migration guide
- Secrets configuration list

## Migration Steps

### Step 1: Prepare New Supabase Project
1. Create new Supabase project at https://supabase.com
2. Note your project credentials:
   - Project Ref
   - Database Password
   - API URL
   - Anon Key
   - Service Role Key

### Step 2: Apply Schema
\`\`\`bash
# Connect to your new Supabase database
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Apply schema
\\i schema/01-complete-schema.sql
\\i schema/02-functions.sql
\\i schema/03-rls-policies.sql
\`\`\`

### Step 3: Import Data
Data MUST be imported in order (01-73) to respect dependencies.

\`\`\`bash
# For each CSV file (in order):
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \\
  -c "\\COPY table_name FROM 'data/XX-table_name.csv' WITH (FORMAT CSV, HEADER true)"
\`\`\`

Or use the provided import script (if available in migration-package).

### Step 4: Deploy Edge Functions
\`\`\`bash
# Link to your project
supabase link --project-ref [PROJECT-REF]

# Deploy each function
supabase functions deploy create-user
supabase functions deploy exchange-oauth-token
# ... (see functions/edge-functions-list.txt for complete list)
\`\`\`

### Step 5: Configure Secrets
\`\`\`bash
supabase secrets set SUPABASE_URL=https://[PROJECT-REF].supabase.co
supabase secrets set SUPABASE_ANON_KEY=[YOUR-ANON-KEY]
# ... (see docs/secrets-list.txt for complete list)
\`\`\`

### Step 6: Reset Sequences
After data import, reset all sequences:
\`\`\`sql
SELECT 'SELECT SETVAL(' ||
       quote_literal(quote_ident(sequence_schema) || '.' || quote_ident(sequence_name)) ||
       ', COALESCE(MAX(' ||quote_ident(column_name)|| '), 1) ) FROM ' ||
       quote_ident(table_schema)|| '.'||quote_ident(table_name)|| ';'
FROM information_schema.columns
WHERE column_default LIKE 'nextval%';
\`\`\`

### Step 7: Verify Migration
1. Check table row counts match source
2. Verify RLS policies are active
3. Test edge functions
4. Verify application connectivity
5. Test core workflows (create lead, quote, shipment)

### Step 8: Update Application
Update your application's .env file:
\`\`\`bash
VITE_SUPABASE_URL=https://[PROJECT-REF].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[YOUR-ANON-KEY]
VITE_SUPABASE_PROJECT_ID=[PROJECT-REF]
\`\`\`

## Data Integrity Verification

Run these queries to verify data integrity:

\`\`\`sql
-- Check referential integrity
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;

-- Check for orphaned records (example for leads)
SELECT COUNT(*) FROM leads 
WHERE franchise_id IS NOT NULL 
  AND franchise_id NOT IN (SELECT id FROM franchises);

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
\`\`\`

## Rollback Plan

If migration fails:
1. Keep Lovable Cloud running (don't delete)
2. Drop and recreate Supabase project
3. Re-run migration with fixes
4. Application continues using Lovable Cloud until migration succeeds

## Support

For migration issues:
1. Check Supabase logs: Project → Logs
2. Verify connection strings
3. Check for IP restrictions
4. Ensure database is not paused
5. Review RLS policies if data access fails

## Timeline Estimate

- Schema Application: 5-10 minutes
- Data Import: 30-60 minutes (depending on data volume)
- Edge Functions Deployment: 10-15 minutes
- Verification: 15-30 minutes
- **Total: 1-2 hours**

EOF

echo -e "${GREEN}✓ Migration guide created${NC}"
echo ""

# ==========================================
# CREATE CHECKSUMS
# ==========================================
echo -e "${BLUE}Creating data checksums...${NC}"

cat > "$EXPORT_DIR/docs/data-checksums.txt" <<EOF
==========================================
DATA CHECKSUMS
==========================================
Generated: $(date)

Use these checksums to verify data integrity after migration.

EOF

# Generate checksums for all CSV files
cd "$EXPORT_DIR/data"
md5sum *.csv >> ../docs/data-checksums.txt 2>/dev/null || shasum -a 256 *.csv >> ../docs/data-checksums.txt
cd - > /dev/null

echo -e "${GREEN}✓ Checksums created${NC}"
echo ""

# ==========================================
# COMPLETION SUMMARY
# ==========================================
echo ""
echo -e "${GREEN}=========================================="
echo "✓ EXPORT COMPLETE"
echo "==========================================${NC}"
echo ""
echo -e "${BLUE}Export Location:${NC} $EXPORT_DIR"
echo ""
echo -e "${BLUE}Contents:${NC}"
echo "  📁 schema/        - Database schema, functions, RLS policies"
echo "  📁 data/          - 73 CSV files in dependency order"
echo "  📁 functions/     - Edge functions source code"
echo "  📁 docs/          - Migration guide and documentation"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Review: $EXPORT_DIR/docs/MIGRATION-GUIDE.md"
echo "  2. Prepare new Supabase project"
echo "  3. Run: cd $EXPORT_DIR && follow guide"
echo ""
echo -e "${YELLOW}⚠ Important:${NC}"
echo "  - Keep Lovable Cloud running until migration verified"
echo "  - Test thoroughly before switching application"
echo "  - Backup this export directory"
echo ""
