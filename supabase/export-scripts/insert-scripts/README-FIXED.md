# Database Export Scripts - Column-Safe Version

## Problem Solved

The previous insert scripts had **hardcoded column names** that didn't match the actual database schema, causing errors like:
```text
ERROR: 42703: column "tenant_id" does not exist
```

## NEW APPROACH: Schema-Aware Insert Generation

### Step 1: Generate Correct INSERT Statements

Run this query in Supabase SQL Editor:

```sql
-- Execute the generator script
\i 00-generate-all-inserts.sql
```

This script will:
1. Query your actual database schema
2. Get the exact column names for each table
3. Generate INSERT statements that match your schema
4. Output everything to the console

### Step 2: Copy Generated Statements

The output will be organized by table. Copy the INSERT statements you need based on dependency order:

#### Recommended Execution Order

**Phase 1: Core Configuration (No Dependencies)**
```text
- tenants
- profiles  
- subscription_plans
- margin_methods
- continents (if exists)
```

**Phase 2: User & Geography (Depends on Phase 1)**
```text
- user_roles
- franchises
- countries
- cities
- ports_locations
```

**Phase 3: Master Data (Depends on Phase 1-2)**
```text
- currencies
- service_types
- cargo_types
- package_categories
- package_sizes
- container_types
- container_sizes
- carriers
- consignees
- incoterms
- vehicles
- warehouses
- charge_sides
- charge_categories
- charge_bases
- services
```

**Phase 4: Configuration (Depends on Phase 1-3)**
```text
- tenant_subscriptions
- usage_records
- subscription_invoices
- custom_roles
- custom_role_permissions
- user_custom_roles
- quote_number_config_tenant
- quote_number_config_franchise
- quote_number_sequences
- user_capacity
- assignment_rules
- territory_assignments
- email_accounts
- email_filters
- email_templates
- document_templates
- compliance_rules
- margin_profiles
```

**Phase 5: CRM Data (Depends on Phase 1-4)**
```text
- accounts
- contacts
- leads
- lead_assignment_queue
- lead_assignment_history
- opportunities
- opportunity_items
- activities
- campaigns
- campaign_members
- emails
```

**Phase 6: Quotes & Shipments (Depends on Phase 1-5)**
```text
- carrier_rates
- carrier_rate_charges
- shipping_rates
- quotes
- quotation_versions
- quotation_version_options
- quote_legs
- quote_charges
- quote_packages
- customer_selections
- rate_calculations
- shipments
- cargo_details
- tracking_events
```

**Phase 7: Audit & System (Execute Last)**
```text
- audit_logs
- notifications
- system_settings
```

### Step 3: Execute in Order

1. Open Supabase SQL Editor on your **NEW** database
2. Copy and paste INSERT statements in the order above
3. Execute each phase sequentially
4. Verify row counts after each phase

### Alternative: Quick Per-Table Generation

If you need just one table:

```sql
-- Example: Generate INSERT for 'tenants' table
SELECT 'INSERT INTO tenants (' || 
  string_agg(column_name, ', ' ORDER BY ordinal_position) || 
  ') VALUES ' ||
  string_agg(
    '(' || string_agg(
      CASE 
        WHEN data_type = 'jsonb' THEN column_name || '::text'
        ELSE 'quote_literal(' || column_name || ')'
      END, 
      ', ' 
    ) || ')',
    ', '
  ) || ' ON CONFLICT (id) DO NOTHING;'
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tenants'
CROSS JOIN tenants;
```

## Benefits of This Approach

✅ **No more column mismatch errors**  
✅ **Works with ANY schema version**  
✅ **Automatically adapts to schema changes**  
✅ **Queries actual database structure**  
✅ **Handles JSONB, UUIDs, timestamps correctly**  

## Troubleshooting

### If no output appears
- Check that tables exist: `SELECT * FROM pg_tables WHERE schemaname = 'public';`
- Check that tables have data: `SELECT count(*) FROM your_table;`

### If you get permission errors
- Ensure you're running as a user with SELECT permissions on all tables

### For large datasets
- Add `LIMIT` to queries: `WHERE EXISTS (SELECT 1 FROM table LIMIT 1000)`
- Split into batches by date or ID ranges

## Performance Tips

- Execute in small batches (1000-5000 rows at a time)
- Disable triggers temporarily for bulk inserts:
  ```sql
  ALTER TABLE table_name DISABLE TRIGGER ALL;
  -- Run inserts
  ALTER TABLE table_name ENABLE TRIGGER ALL;
  ```
- Use `COPY` for very large tables (millions of rows)
