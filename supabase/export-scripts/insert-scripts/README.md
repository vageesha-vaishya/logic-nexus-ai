# Table Data Export Scripts for Supabase SQL Editor

These scripts generate INSERT statements for manual data migration in the Supabase SQL Editor.

## Execution Order

**IMPORTANT:** Execute these scripts in the exact order shown below to maintain referential integrity.

### Prerequisites
1. Ensure all schema objects are created (tables, functions, triggers, indexes)
2. Disable RLS temporarily if needed: `ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;`
3. Backup your data before running any scripts

### Phase 1: Master Data (No Dependencies)
```sql
-- Execute: 01-insert-master-data.sql
```
**Tables included:**
- tenants
- franchises
- profiles
- user_roles
- continents, countries, cities, ports_locations
- currencies
- service_types, cargo_types
- package_categories, package_sizes
- container_types, container_sizes
- carriers, consignees, incoterms
- vehicles, warehouses
- charge_sides, charge_categories, charge_bases
- services

### Phase 2: Configuration Data
```sql
-- Execute: 02-insert-configuration-data.sql
```
**Dependencies:** tenants, franchises, profiles

**Tables included:**
- subscription_plans, tenant_subscriptions, usage_records, subscription_invoices
- custom_roles, custom_role_permissions, user_custom_roles
- quote_number_config_tenant, quote_number_config_franchise, quote_number_sequences
- user_capacity, assignment_rules, territory_assignments
- email_accounts, email_filters, email_templates
- document_templates, compliance_rules
- margin_methods, margin_profiles

### Phase 3: CRM Data
```sql
-- Execute: 03-insert-crm-data.sql
```
**Dependencies:** tenants, franchises, profiles

**Tables included:**
- accounts
- contacts (depends on accounts)
- leads
- lead_assignment_queue, lead_assignment_history
- opportunities (depends on accounts, contacts, leads)
- opportunity_items (depends on opportunities)
- activities (depends on accounts, contacts, leads)
- campaigns, campaign_members
- emails

### Phase 4: Quotes & Shipments
```sql
-- Execute: 04-insert-quotes-shipments.sql
```
**Dependencies:** services, carriers, opportunities, accounts, contacts

**Tables included:**
- carrier_rates, carrier_rate_charges
- shipping_rates
- quotes (depends on opportunities, accounts, contacts, carriers, services)
- quotation_versions (depends on quotes)
- quotation_version_options (depends on quotation_versions)
- quote_legs (depends on quotation_version_options, carriers)
- quote_charges (depends on quotation_version_options)
- quote_packages (depends on quotation_version_options)
- customer_selections (depends on quotes, quotation_versions, quotation_version_options)
- rate_calculations (depends on quotes, services, carrier_rates)
- shipments (depends on quotes, accounts, contacts, carriers, services)
- cargo_details (depends on services, cargo_types)
- tracking_events (depends on shipments)

### Phase 5: Audit & System Data
```sql
-- Execute: 05-insert-audit-system.sql
```
**Dependencies:** All previous tables

**Tables included:**
- audit_logs
- notifications
- system_settings

## How to Use

### Step 1: Generate INSERT Statements
Run each script in your OLD database's Supabase SQL Editor. Each query will output an INSERT statement.

Example:
```sql
-- Copy the output from the SQL Editor
INSERT INTO tenants (id, name, slug, ...) VALUES 
('uuid-1', 'Tenant 1', 'tenant-1', ...),
('uuid-2', 'Tenant 2', 'tenant-2', ...);
```

### Step 2: Execute in NEW Database
1. Copy the generated INSERT statement
2. Paste into your NEW database's Supabase SQL Editor
3. Execute the statement
4. Repeat for each table in order

### Step 3: Re-enable Security
After all data is imported:
```sql
-- Re-enable RLS on all tables
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Verify RLS policies are active
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

## Important Notes

### Foreign Key Dependencies
- Scripts are ordered to respect foreign key constraints
- Always execute in the order shown (Phase 1 → Phase 5)
- If you skip a phase, later phases may fail

### Data Conflicts
- All scripts use `ON CONFLICT (id) DO NOTHING`
- Existing records with same ID will be preserved
- To update existing records, change to `ON CONFLICT (id) DO UPDATE SET ...`

### Large Datasets
If you have many records (>1000 per table):
1. Run scripts one table at a time
2. Split large INSERT statements into batches of 100-500 records
3. Monitor transaction size and timeouts

### JSONB Fields
- JSONB data is cast to text in the script
- PostgreSQL automatically converts back to JSONB on insert
- Verify JSONB structure in output before executing

### NULL Values
- NULL values are properly handled with %L formatting
- Empty JSONB defaults to `'{}'` or `'[]'` as appropriate

### Performance Tips
```sql
-- Temporarily disable triggers for faster inserts
ALTER TABLE table_name DISABLE TRIGGER ALL;
-- Run your INSERT statements
ALTER TABLE table_name ENABLE TRIGGER ALL;

-- Disable indexes during large imports
DROP INDEX index_name;
-- Run your INSERT statements
CREATE INDEX index_name ON table_name(column);
```

## Verification

After completing all phases:

```sql
-- Verify record counts
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- Check for orphaned records (foreign key issues)
SELECT 
  t1.id, t1.foreign_key_column
FROM parent_table t1
LEFT JOIN child_table t2 ON t1.id = t2.parent_id
WHERE t2.id IS NULL;

-- Verify RLS policies are active
SELECT 
  schemaname, 
  tablename, 
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Troubleshooting

### Error: "relation does not exist"
- Ensure all tables are created before running insert scripts
- Run schema migration scripts first (01-schema-and-types.sql through 06-database-functions.sql)

### Error: "violates foreign key constraint"
- You skipped a phase or executed out of order
- Check which parent record is missing
- Re-run the appropriate phase

### Error: "duplicate key value violates unique constraint"
- Records with same ID already exist
- Either delete existing records or use `ON CONFLICT DO UPDATE`

### Error: "invalid input syntax for type jsonb"
- JSONB data contains invalid characters
- Check for unescaped quotes or invalid JSON structure
- Clean source data before export

## Edge Functions & Triggers

These scripts handle data only. After importing:

1. **Deploy Edge Functions** (if any):
   ```bash
   supabase functions deploy
   ```

2. **Verify Triggers Are Active**:
   ```sql
   SELECT 
     trigger_name,
     event_object_table,
     action_timing,
     event_manipulation
   FROM information_schema.triggers
   WHERE trigger_schema = 'public'
   ORDER BY event_object_table, trigger_name;
   ```

3. **Test Database Functions**:
   ```sql
   -- Test quote number generation
   SELECT generate_quote_number('tenant-uuid'::uuid);
   
   -- Test lead score calculation
   SELECT calculate_lead_score('lead-uuid'::uuid);
   ```

## Support

For issues with these scripts:
1. Check the execution order
2. Verify schema is fully migrated
3. Review foreign key dependencies
4. Check RLS policies don't block inserts
