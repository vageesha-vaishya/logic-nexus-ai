# Final Migration Execution Checklist

## ✅ Pre-Migration Verification

### 1. Environment Configuration
- [ ] Verified `new-supabase-config.env` has correct values:
  - `NEW_DB_URL` - Database connection string
  - `NEW_SUPABASE_URL` - <https://pqulscbawoqzhqobwupu.supabase.co>
  - `NEW_SUPABASE_ANON_KEY` - Anon key
  - `NEW_SUPABASE_SERVICE_ROLE_KEY` - Service role key
  - `NEW_PROJECT_ID` - pqulscbawoqzhqobwupu

### 2. Database Access
- [ ] Can connect to NEW Supabase Cloud database
- [ ] Have admin/postgres access to execute DDL
- [ ] SQL Editor is accessible in Supabase dashboard

### 3. Backup Status
- [ ] Old database backup created
- [ ] Backup file location documented
- [ ] Backup integrity verified

---

## 🚀 Migration Execution Steps

### STEP 1: Execute SQL Migration Scripts (IN ORDER!)

Execute these scripts **one by one** in the Supabase Cloud SQL Editor:

#### Script 1: Schema and Types
```bash
File: supabase/migration-package/sql-migration/01-schema-and-types.sql
```
- [ ] Executed successfully
- [ ] No errors in output
- [ ] Verified types created: `\dT` in psql

**Expected Tables After Script 1:**
- tenants, franchises, profiles, user_roles
- continents, countries, cities, ports_locations
- currencies, service_types, cargo_types, package_categories, etc.
- carriers, consignees, incoterms, vehicles, warehouses
- charge_sides, charge_categories, charge_bases
- **services** (CRITICAL - needed for CRM)

#### Script 2: Configuration Tables
```bash
File: supabase/migration-package/sql-migration/02-configuration-tables.sql
```
- [ ] Executed successfully
- [ ] No foreign key errors

**Expected Tables After Script 2:**
- custom_roles, custom_role_permissions, user_custom_roles
- subscription_plans, tenant_subscriptions, usage_records
- quote_number_config_tenant, quote_number_config_franchise, quote_number_sequences
- user_capacity, assignment_rules, territory_assignments
- email_accounts, email_filters, email_templates
- document_templates, compliance_rules, margin_methods, margin_profiles

#### Script 3: CRM Tables
```bash
File: supabase/migration-package/sql-migration/03-crm-tables.sql
```
- [ ] Executed successfully
- [ ] Verifies `services` table exists (created in Script 1)

**Expected Tables After Script 3:**
- accounts, contacts
- leads, lead_assignment_queue, lead_assignment_history
- opportunities, opportunity_line_items
- activities, campaigns, campaign_members, emails

#### Script 4: Quotes & Shipments
```bash
File: supabase/migration-package/sql-migration/04-quotes-shipments-tables.sql
```
- [ ] Executed successfully

**Expected Tables After Script 4:**
- carrier_rates, carrier_rate_charges, shipping_rates
- quotes, quotation_versions, quotation_version_options
- quote_legs, quote_charges, quote_packages
- customer_selections, rate_calculations
- shipments, cargo_details, tracking_events

#### Script 5: Audit System
```bash
File: supabase/migration-package/sql-migration/05-audit-system-tables.sql
```
- [ ] Executed successfully

**Expected Tables After Script 5:**
- audit_logs, notifications, system_settings

#### Script 6: Functions & Triggers
```bash
File: supabase/migration-package/sql-migration/06-database-functions.sql
```
- [ ] Executed successfully
- [ ] All functions created without errors

**Expected Functions:**
- is_platform_admin, has_role
- get_user_tenant_id, get_user_franchise_id
- calculate_lead_score, update_lead_score
- generate_quote_number, auto_generate_quote_number
- increment_user_lead_count, decrement_user_lead_count
- tenant_has_feature

#### Script 7: RLS Policies
```bash
File: supabase/migration-package/sql-migration/07-rls-policies.sql
```
- [ ] Executed successfully
- [ ] RLS enabled on all tables
- [ ] All policies created

**Verification Command:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

---

### STEP 2: Verify Database Structure

Run these verification queries:

```sql
-- Count all tables (should be 60+)
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false;

-- Count policies per table
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Verify functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Check for errors in functions
SELECT proname, prosrc 
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace;
```

**Verification Checklist:**
- [ ] All 60+ tables exist
- [ ] All tables have RLS enabled (rowsecurity = true)
- [ ] All functions created successfully
- [ ] All triggers attached correctly
- [ ] No foreign key constraint errors

---

### STEP 3: Regenerate TypeScript Types

This is **CRITICAL** - your app won't work without updated types!

```bash
# In your project root directory
npx supabase gen types typescript --project-id pqulscbawoqzhqobwupu > src/integrations/supabase/types.ts
```

**Verification:**
- [ ] Command executed without errors
- [ ] File `src/integrations/supabase/types.ts` updated
- [ ] File size significantly larger (check file has content)
- [ ] No TypeScript errors in IDE after types regenerated
- [ ] Build succeeds: `npm run build` or `npm run typecheck`

---

### STEP 4: Data Migration (Optional if you have existing data)

If migrating data from old database:

```bash
# Export from old database
cd supabase/migration-package
./00-full-export.sh

# Verify exports
ls -lh data/

# Import to new database
./03-import-data.sh
```

**Data Import Checklist:**
- [ ] Export completed successfully
- [ ] All CSV files created in data/ directory
- [ ] Import script executed successfully
- [ ] No constraint violation errors
- [ ] Data counts match old database

**Verification Queries:**
```sql
-- Check record counts
SELECT 'tenants' as table_name, COUNT(*) FROM tenants UNION ALL
SELECT 'franchises', COUNT(*) FROM franchises UNION ALL
SELECT 'accounts', COUNT(*) FROM accounts UNION ALL
SELECT 'contacts', COUNT(*) FROM contacts UNION ALL
SELECT 'leads', COUNT(*) FROM leads UNION ALL
SELECT 'opportunities', COUNT(*) FROM opportunities UNION ALL
SELECT 'quotes', COUNT(*) FROM quotes;
```

---

### STEP 5: Deploy Edge Functions

```bash
cd supabase/migration-package
./deploy-functions.sh
```

**Functions to Deploy:**
- [ ] create-user
- [ ] exchange-oauth-token
- [ ] get-account-label
- [ ] get-contact-label
- [ ] get-opportunity-full
- [ ] get-opportunity-label
- [ ] get-service-label
- [ ] list-edge-functions
- [ ] process-lead-assignments
- [ ] salesforce-sync-opportunity
- [ ] search-emails
- [ ] seed-platform-admin
- [ ] send-email
- [ ] sync-all-mailboxes
- [ ] sync-emails

---

### STEP 6: Update Application Environment

Update your application `.env` file:

```bash
VITE_SUPABASE_URL=https://[PROJECT-REF].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[YOUR-ANON-KEY]
VITE_SUPABASE_PROJECT_ID=[PROJECT-REF]
```

- [ ] .env file updated
- [ ] Application restarted
- [ ] No connection errors in console

---

### STEP 7: Configure Secrets

For edge functions that need API keys, configure in Supabase dashboard:

**Required Secrets:**
- [ ] DB_PASSWORD (if not already set)
- [ ] SUPABASE_URL
- [ ] SUPABASE_ANON_KEY  
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] Any custom API keys your functions need

Reference: `supabase/migration-package/SECRETS-CONFIGURATION.md`

---

## 🧪 Post-Migration Testing

### Basic Functionality Tests

#### 1. Authentication
- [ ] Can sign up new user
- [ ] Can log in with existing credentials
- [ ] User session persists
- [ ] Can log out

#### 2. Data Access
- [ ] Can view list of accounts
- [ ] Can create new account
- [ ] Can update existing account
- [ ] Can delete account
- [ ] RLS policies working (users only see own data)

#### 3. CRUD Operations Per Module

**CRM Module:**
- [ ] Accounts: Create, Read, Update, Delete
- [ ] Contacts: Create, Read, Update, Delete
- [ ] Leads: Create, Read, Update, Delete
- [ ] Opportunities: Create, Read, Update, Delete
- [ ] Activities: Create, Read, Update, Delete

**Quotes Module:**
- [ ] Quotes: Create, Read, Update, Delete
- [ ] Quote number auto-generation works
- [ ] Quote versions work
- [ ] Customer selections work

**Shipments Module:**
- [ ] Shipments: Create, Read, Update, Delete
- [ ] Tracking events: Create, Read
- [ ] Cargo details: Create, Read, Update

#### 4. Edge Functions
- [ ] process-lead-assignments works
- [ ] get-opportunity-full works
- [ ] search-emails works
- [ ] send-email works

#### 5. Calculated Fields
- [ ] Lead scoring updates automatically
- [ ] Quote totals calculate correctly
- [ ] User capacity updates on assignment

---

## 🐛 Common Issues & Solutions

### Issue: "relation does not exist"
**Solution:** 
- Verify all SQL scripts executed in correct order
- Check for typos in table names
- Verify you're connected to correct database

### Issue: TypeScript errors showing 'never' type
**Solution:**
- Regenerate types: `npx supabase gen types typescript --project-id pqulscbawoqzhqobwupu > src/integrations/supabase/types.ts`
- Restart IDE/dev server

### Issue: RLS policy blocks legitimate access
**Solution:**
- Check user has correct role in user_roles table
- Verify tenant_id/franchise_id set correctly
- Review policy logic in 07-rls-policies.sql

### Issue: Foreign key constraint violation
**Solution:**
- Check parent record exists before inserting child
- Verify references use correct UUID format
- Check tenant_id matches across related records

### Issue: Edge function deployment fails
**Solution:**
- Verify secrets configured in Supabase dashboard
- Check function syntax for errors
- Review function logs in Supabase dashboard

---

## ✅ Migration Sign-Off

Once all checklist items complete:

- [ ] All SQL scripts executed successfully
- [ ] TypeScript types regenerated
- [ ] Edge functions deployed
- [ ] Application environment updated
- [ ] Secrets configured
- [ ] All tests passing
- [ ] No console errors
- [ ] Data visible in UI
- [ ] RLS working correctly
- [ ] Performance acceptable

**Migration Completed By:** ___________________

**Date:** ___________________

**Notes/Issues:** ___________________

---

## 📞 Support

If you encounter issues:

1. Check Supabase logs in dashboard
2. Review SQL migration script output for errors
3. Verify types.ts file generated correctly
4. Check browser console for errors
5. Review network tab for failed API calls

**Migration Package Location:** `supabase/migration-package/`

**Key Files:**
- `01-MIGRATION-GUIDE.md` - Detailed migration instructions
- `DEPLOYMENT-GUIDE.md` - Complete deployment process
- `VERIFICATION-CHECKLIST.md` - Verification steps
- `SECRETS-CONFIGURATION.md` - Secret configuration guide
