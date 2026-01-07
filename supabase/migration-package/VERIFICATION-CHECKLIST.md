# Migration Scripts Verification Checklist

## ✅ Complete Verification Status

### Phase 1: Schema and Types (01-schema-and-types.sql)
- [x] All enums defined correctly
- [x] All types created
- [x] Core configuration tables
- [x] Geography master data tables
- [x] Logistics master data tables
- [x] Charge configuration tables
- [x] All indexes created
- [x] All triggers attached
- [x] DROP statements for clean migration

**Tables Created:** 32 tables
- tenants, franchises, profiles, user_roles
- subscription_plans, tenant_subscriptions, usage_records
- service_types, service_type_mappings
- ports_locations, continents, countries, states, cities
- incoterms, cargo_types, package_categories, package_sizes
- container_types, container_sizes
- currencies, charge_categories, charge_sides, charge_bases
- hts_codes, warehouses, vehicles, consignees

### Phase 2: Configuration Tables (02-configuration-tables.sql)
- [x] Custom roles and permissions
- [x] Quote number configuration (tenant & franchise)
- [x] Quote number sequences
- [x] Lead assignment tables
- [x] Email configuration tables
- [x] Document templates
- [x] Compliance rules
- [x] Margin profiles
- [x] All foreign keys correct
- [x] DROP statements for clean migration

**Tables Created:** 19 tables
- custom_roles, custom_role_permissions, user_custom_roles
- quote_number_config_tenant, quote_number_config_franchise
- quote_number_sequences
- assignment_rules, territories, user_capacity
- email_accounts, email_templates, email_filters
- oauth_configurations
- document_templates, compliance_rules
- margin_profiles, margin_methods
- subscription_invoices

### Phase 3: CRM Tables (03-crm-tables.sql)
- [x] Accounts table
- [x] Contacts table
- [x] Leads table
- [x] Lead assignment queue
- [x] Lead assignment history
- [x] Opportunities table
- [x] **Opportunity line items table** (Fixed: renamed from opportunity_items)
- [x] Activities table
- [x] Campaigns table
- [x] Campaign members table
- [x] Emails table
- [x] All indexes created
- [x] All triggers attached
- [x] DROP statements for clean migration

**Tables Created:** 11 tables
- accounts, contacts, leads
- lead_assignment_queue, lead_assignment_history
- opportunities, opportunity_line_items
- activities, campaigns, campaign_members
- emails

**Critical Fix Applied:**
- Renamed `opportunity_items` to `opportunity_line_items` to match application code
- Updated DROP statements to include both names for backward compatibility
- Added trigger for `opportunity_line_items`

### Phase 4: Quotes & Shipments Tables (04-quotes-shipments-tables.sql)
- [x] Services table
- [x] Carrier rates table
- [x] Carrier rate charges table
- [x] Shipping rates table
- [x] Quotes table
- [x] Quotation versions table
- [x] Quotation version options table
- [x] Quote legs table
- [x] Quote charges table
- [x] Quote packages table
- [x] Customer selections table
- [x] Rate calculations table
- [x] Shipments table
- [x] Cargo details table
- [x] Tracking events table
- [x] All indexes created
- [x] All triggers attached
- [x] DROP statements for clean migration

**Tables Created:** 15 tables
- services, carrier_rates, carrier_rate_charges, shipping_rates
- quotes, quotation_versions, quotation_version_options
- quote_legs, quote_charges, quote_packages
- customer_selections, rate_calculations
- shipments, cargo_details, tracking_events

### Phase 5: Audit System Tables (05-audit-system-tables.sql)
- [x] Audit logs table
- [x] Notifications table
- [x] System settings table
- [x] All indexes created
- [x] DROP statements for clean migration

**Tables Created:** 3 tables
- audit_logs, notifications, system_settings

### Phase 6: Database Functions (06-database-functions.sql)
- [x] All helper functions created
- [x] Trigger functions created
- [x] Security definer functions for RLS
- [x] Quote number generation function
- [x] Lead scoring function
- [x] User capacity management functions
- [x] DROP statements for clean migration

**Functions Created:** 20+ functions
- `is_platform_admin()`, `has_role()`, `get_user_tenant_id()`, `get_user_franchise_id()`
- `generate_quote_number()`, `preview_next_quote_number()`
- `calculate_lead_score()`, `update_lead_score()`
- `increment_user_lead_count()`, `decrement_user_lead_count()`
- `tenant_has_feature()`, `check_usage_limit()`, `increment_feature_usage()`
- `get_tenant_plan_tier()`, `record_customer_selection()`
- `update_updated_at_column()`, `handle_new_user()`
- Database metadata functions for admin panel

### Phase 7: RLS Policies (07-rls-policies.sql)
- [x] All tables have RLS enabled
- [x] Tenants policies
- [x] Franchises policies
- [x] Profiles policies
- [x] User roles policies
- [x] User capacity policies
- [x] CRM tables policies (accounts, contacts, leads, opportunities)
- [x] Opportunity line items policies
- [x] Activities policies
- [x] Campaigns policies
- [x] Quotes policies
- [x] Quotation versions & options policies
- [x] Shipments policies
- [x] Tracking events policies
- [x] Carriers policies
- [x] Services policies
- [x] Master data policies (global and tenant-scoped)
- [x] Assignment system policies
- [x] Email system policies
- [x] Subscription and configuration policies
- [x] Custom roles policies
- [x] Audit logs policies

**Policies Created:** 100+ RLS policies
- Platform admin full access policies
- Tenant admin scoped access policies
- Franchise admin scoped access policies
- User read/write policies with proper tenant/franchise filtering
- Security definer functions used to avoid infinite recursion

### Index Standardization Verification
```sql
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='quotes' AND indexname IN ('idx_quotes_tenant_id','idx_quotes_franchise_id');
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='shipments' AND indexname IN ('idx_shipments_tenant_id','idx_shipments_franchise_id');
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='activities' AND indexname IN ('idx_activities_tenant_id','idx_activities_franchise_id');
```

### RLS Policy Verification (Quotes, Shipments, Activities)
```sql
SELECT polname, schemaname, tablename, cmd FROM pg_policies WHERE schemaname='public' AND tablename IN ('quotes','shipments','activities') ORDER BY tablename, polname;
```

### Query Performance Baseline (Franchise‑Scoped)
```sql
EXPLAIN ANALYZE SELECT id FROM public.quotes WHERE tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()) ORDER BY created_at DESC LIMIT 50;
EXPLAIN ANALYZE SELECT id FROM public.shipments WHERE tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()) ORDER BY created_at DESC LIMIT 50;
EXPLAIN ANALYZE SELECT id FROM public.activities WHERE tenant_id = get_user_tenant_id(auth.uid()) AND franchise_id = get_user_franchise_id(auth.uid()) ORDER BY created_at DESC LIMIT 50;
```

### Deployment Scheduling
- [x] Schedule execution of index renames and policy updates during low‑traffic windows

### Phase 8: Data Export (08-data-export.sql)
- [x] All tables listed in correct foreign key dependency order
- [x] Export commands for all tables
- [x] Verification queries included

**Export Order:** 60+ tables in dependency order

## 🔍 Table Dependencies Verified

### Dependency Chain:
1. **Independent:** subscription_plans, service_types, ports_locations, incoterms, cargo_types, package_categories, package_sizes, container_types, container_sizes, currencies, charge_categories, charge_sides, charge_bases, hts_codes, service_type_mappings
2. **Level 1:** tenants → subscription data, franchises, profiles
3. **Level 2:** user_roles, carriers, services, custom_roles, oauth_configurations
4. **Level 3:** email_accounts, warehouses, vehicles, consignees, cargo_details, accounts
5. **Level 4:** contacts, campaigns, leads
6. **Level 5:** opportunities, activities, quotes
7. **Level 6:** opportunity_line_items, quotation_versions, shipments
8. **Level 7:** quotation_version_options, tracking_events
9. **Level 8:** quote_legs, quote_charges, customer_selections
10. **Audit:** audit_logs, notifications

## ⚠️ Known Issues & Fixes Applied

### 1. Opportunity Line Items Table Name ✅ FIXED
**Issue:** Table was named `opportunity_items` but application code expects `opportunity_line_items`

**Fix Applied:**
- Renamed table in 03-crm-tables.sql
- Updated all related DROP statements
- Added proper trigger
- Added columns: `service_id`, `discount_percent`, `tax_percent`, `line_total`

### 2. Missing assignment_rules Table ✅ FIXED
**Status:** Included in 02-configuration-tables.sql

### 3. Missing assignment_history/assignment_queue ✅ FIXED
**Status:** 
- `lead_assignment_history` in 03-crm-tables.sql
- `lead_assignment_queue` in 03-crm-tables.sql

## 🎯 Migration Execution Checklist

### Pre-Migration
- [ ] Backup old database completely
- [ ] Create new Supabase project
- [ ] Have credentials ready
- [ ] Review all scripts for customizations

### Migration Execution
- [ ] Execute 01-schema-and-types.sql (10-15 min)
- [ ] Verify: Check tables exist, no errors
- [ ] Execute 02-configuration-tables.sql (5-10 min)
- [ ] Verify: Check configuration tables
- [ ] Execute 03-crm-tables.sql (5-10 min)
- [ ] Verify: Check CRM tables including opportunity_line_items
- [ ] Execute 04-quotes-shipments-tables.sql (5-10 min)
- [ ] Verify: Check quotes and shipments tables
- [ ] Execute 05-audit-system-tables.sql (2-5 min)
- [ ] Verify: Check audit tables
- [ ] Execute 06-database-functions.sql (5 min)
- [ ] Verify: Check functions exist
- [ ] Execute 07-rls-policies.sql (10-15 min)
- [ ] Verify: Check RLS is enabled on all tables

### Data Migration
- [ ] Run 08-data-export.sql on OLD database
- [ ] Verify CSV files generated
- [ ] Import CSV files to NEW database in correct order
- [ ] Verify row counts match
- [ ] Check foreign key integrity

### Post-Migration
- [ ] Deploy edge functions
- [ ] Configure secrets
- [ ] Update application .env
- [ ] Regenerate TypeScript types: `npx supabase gen types typescript --project-id pqulscbawoqzhqobwupu > src/integrations/supabase/types.ts`
- [ ] Test authentication
- [ ] Test CRUD operations
- [ ] Verify RLS policies work
 - [ ] Verify Phase 2 objects and functions

### Phase 2 Verification
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('user_preferences','admin_override_audit');
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='user_preferences' AND indexname IN ('idx_user_preferences_tenant_id','idx_user_preferences_franchise_id');
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='admin_override_audit' AND indexname IN ('idx_admin_override_audit_tenant_id','idx_admin_override_audit_franchise_id','idx_admin_override_audit_user_id');
SELECT proname FROM pg_proc JOIN pg_namespace n ON n.oid=pg_proc.pronamespace WHERE n.nspname='public' AND proname IN ('set_user_franchise_preference','audit_admin_override','set_admin_override');
SELECT polname, tablename FROM pg_policies WHERE schemaname='public' AND tablename IN ('user_preferences','admin_override_audit');
```

## 🧪 Verification Queries

### After Each Phase
```sql
-- Check tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Check for errors
SELECT * FROM postgres_logs WHERE level = 'error' 
ORDER BY timestamp DESC LIMIT 10;
```

### After Phase 6 (Functions)
```sql
-- List all functions
SELECT proname FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace 
ORDER BY proname;
```

### After Phase 7 (RLS)
```sql
-- Check RLS enabled
SELECT tablename, rowsecurity, COUNT(policyname) as policy_count
FROM pg_tables 
LEFT JOIN pg_policies ON pg_policies.tablename = pg_tables.tablename
WHERE schemaname = 'public'
GROUP BY tablename, rowsecurity
ORDER BY tablename;
```

### After Data Import
```sql
-- Row count comparison
SELECT schemaname, tablename, n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- Check foreign key integrity
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
```

## 📊 Expected Table Counts

- **Phase 1:** 32 tables
- **Phase 2:** +19 tables (51 total)
- **Phase 3:** +11 tables (62 total)
- **Phase 4:** +15 tables (77 total)
- **Phase 5:** +3 tables (80 total)
- **Total Expected:** ~80 tables

## ✅ Final Verification

### Database Structure
- [ ] All 80+ tables created
- [ ] All 20+ functions created
- [ ] All 100+ RLS policies active
- [ ] All foreign keys valid
- [ ] All indexes created
- [ ] All triggers active

### Data Integrity
- [ ] Row counts match old database
- [ ] No orphaned records
- [ ] All foreign keys valid
- [ ] No NULL values in required fields

### Application Integration
- [ ] TypeScript types regenerated
- [ ] No build errors
- [ ] Authentication works
- [ ] CRUD operations work
- [ ] RLS policies enforce security

## 🎉 Migration Complete!

Once all checkboxes are checked, your migration is complete and verified!
