# SQL Migration Scripts for Supabase Cloud

## Overview
This directory contains ready-to-execute SQL migration scripts for clean migration to Supabase Cloud. Each script includes DROP statements to remove existing objects before creation, ensuring a clean slate.

## Clean Migration Features

- **DROP CASCADE**: All objects are dropped with CASCADE to handle dependencies automatically
- **Reverse Order Drops**: Objects are dropped in reverse dependency order to prevent errors
- **Idempotent**: Scripts can be run multiple times safely using `DROP IF EXISTS` clauses
- **Complete Cleanup**: Drops types, tables, functions, triggers, indexes, and sequences
- **Safe Execution**: Uses `IF EXISTS` to avoid errors when objects don't exist

## Migration Order (CRITICAL - Follow Exactly)

Execute scripts in this exact order:

### 1. **01-schema-and-types.sql** (10-15 min)
   - **Drops**: All existing types, tables, functions, triggers (complete cleanup)
   - **Creates**: All enums and types
   - Creates core tables with no dependencies
   - Creates geography master data tables
   - Creates logistics master data tables
   - Creates charge configuration tables
   - Sets up indexes and triggers

### 2. **02-configuration-tables.sql** (5-10 min)
   - **Drops**: All configuration tables
   - **Creates**: Custom roles and permissions
   - Creates subscription management tables
   - Creates quote number configuration
   - Creates lead assignment tables
   - Creates email configuration tables
   - Creates document templates
   - Creates compliance rules
   - Creates margin profiles

### 3. **03-crm-tables.sql** (5-10 min)
   - **Drops**: All CRM tables (accounts, contacts, leads, etc.)
   - **Creates**: Accounts, contacts, leads
   - Creates opportunities and items
   - Creates activities and campaigns
   - Creates emails table

### 4. **04-quotes-shipments-tables.sql** (5-10 min)
   - **Drops**: All quotes and shipments tables
   - **Creates**: Services and rates
   - Creates quotes and quotations
   - Creates shipments and cargo
   - Creates tracking events

### 5. **05-audit-system-tables.sql** (2-5 min)
   - **Drops**: Audit and system tables
   - **Creates**: Audit logs
   - Creates notifications
   - Creates system settings

### 6. **06-database-functions.sql** (5 min)
   - **Drops**: All existing functions and triggers
   - **Creates**: All helper functions
   - Creates triggers
   - Required for RLS policies

### 7. **07-rls-policies.sql** (10-15 min)
   - Enables RLS on all tables
   - Creates all security policies
   - **MUST be executed after functions**

## Step-by-Step Instructions

### Prerequisites
1. Create a new Supabase project at https://supabase.com
2. Navigate to SQL Editor in your project
3. Have your project credentials ready

### Execution Steps

For each SQL file (in order):

1. **Open the file** in your text editor
2. **Copy the entire contents**
3. **Go to Supabase Dashboard** → SQL Editor → New Query
4. **Paste the SQL code**
5. **Click "Run"** or press Ctrl+Enter
6. **Wait for completion** (check for success message)
7. **Verify no errors** in the output
8. **Move to next file**

### Verification After Each Step

After executing each script, verify success:

```sql
-- Check tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check no errors in logs
SELECT * FROM postgres_logs 
WHERE level = 'error' 
ORDER BY timestamp DESC 
LIMIT 10;
```

## Data Import (After Schema)

Once all schema scripts are executed, you need to import your data. You have two options:

### Option A: Using Lovable UI Export
1. Go to your Lovable project
2. Navigate to: Settings → Database → Export
3. Download the export file
4. Go to Supabase Dashboard → Table Editor
5. For each table, click "Import Data" and select the CSV

### Option B: Using pg_dump (Recommended for large datasets)
```bash
# From Lovable Cloud
pg_dump "postgresql://postgres:LOVABLE_PASSWORD@db.PROJECT.supabase.co:5432/postgres" \
  --data-only \
  --table=tenants \
  --table=franchises \
  ... (all tables) \
  > data-export.sql

# To Supabase Cloud
psql "postgresql://postgres:SUPABASE_PASSWORD@db.PROJECT.supabase.co:5432/postgres" \
  < data-export.sql
```

### Option C: Manual INSERT Statements
If you have small datasets, create INSERT statements:
```sql
INSERT INTO tenants (id, name, slug, is_active) VALUES
('uuid-1', 'Tenant 1', 'tenant1', true),
('uuid-2', 'Tenant 2', 'tenant2', true);
```

## Post-Migration Steps

### 1. Reset Sequences
After importing data, reset all sequences:
```sql
-- Generate and execute sequence reset commands
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            'SELECT SETVAL(' ||
            quote_literal(quote_ident(sequence_schema) || '.' || quote_ident(sequence_name)) ||
            ', COALESCE(MAX(' ||quote_ident(column_name)|| '), 1) ) FROM ' ||
            quote_ident(table_schema)|| '.'||quote_ident(table_name)|| ';' AS cmd
        FROM information_schema.columns
        WHERE column_default LIKE 'nextval%'
          AND table_schema = 'public'
    LOOP
        EXECUTE r.cmd;
    END LOOP;
END $$;
```

### 2. Verify RLS
Check that RLS is enabled on all tables:
```sql
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    COUNT(policyname) as policy_count
FROM pg_tables
LEFT JOIN pg_policies ON pg_policies.tablename = pg_tables.tablename
WHERE schemaname = 'public'
GROUP BY tablename, rowsecurity
ORDER BY tablename;
```

All tables should have `rls_enabled = true` and `policy_count > 0`.

### 3. Test Functions
```sql
-- Test helper functions
SELECT is_platform_admin('test-user-uuid');
SELECT get_user_tenant_id('test-user-uuid');

-- Test quote number generation
SELECT generate_quote_number('tenant-uuid'::uuid, NULL);
```

### 4. Update Application Environment
Update your `.env` file:
```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=YOUR-PROJECT-REF
```

### 5. Deploy Edge Functions
```bash
# Link to your project
supabase link --project-ref YOUR-PROJECT-REF

# Deploy all functions
supabase functions deploy create-user
supabase functions deploy exchange-oauth-token
# ... (deploy all edge functions)
```

### 6. Configure Secrets
```bash
supabase secrets set SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your-anon-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Troubleshooting

### Error: "relation already exists"
**This should NOT happen** - all scripts include DROP statements. If it does:
```sql
-- Nuclear option: Complete database reset
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```
Then start from script 01 again.

### Using the Shell Script (Alternative)
If you prefer automated cleanup, use the shell script:
```bash
cd supabase/migration-package
./02-cleanup-existing.sh
```
This will drop ALL objects from the database before you run the SQL scripts.

### Error: "function does not exist"
Make sure you executed `06-database-functions.sql` before `07-rls-policies.sql`.

### Error: "permission denied"
RLS policies might be blocking. Temporarily disable to debug:
```sql
ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
-- Debug
-- Then re-enable:
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### Data Import Failures
- Check for foreign key violations
- Ensure parent records exist before children
- Verify UUIDs match between tables
- Check for NULL values in NOT NULL columns

## Validation Queries

After complete migration, run these validation queries:

```sql
-- 1. Check all tables exist
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
-- Should return ~70+

-- 2. Check all functions exist
SELECT COUNT(*) FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace;
-- Should return ~10+

-- 3. Check RLS is enabled
SELECT COUNT(*) FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
-- Should match table count

-- 4. Check for orphaned records
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public';
```

## Rollback Plan

If migration fails:
1. Keep Lovable Cloud running (don't delete!)
2. Drop and recreate Supabase database
3. Re-execute migration scripts with fixes
4. Application continues using Lovable Cloud until migration succeeds

## Estimated Timeline

- Schema Scripts (01-05): 30-45 minutes
- Functions (06): 5 minutes
- RLS Policies (07): 10-15 minutes
- Data Import: 30-60 minutes (depending on volume)
- Verification: 15-30 minutes
- Edge Functions Deployment: 10-15 minutes
- **Total: 1.5-3 hours**

## Support

If you encounter issues:
1. Check Supabase logs: Project → Logs → Postgres Logs
2. Verify connection strings
3. Ensure no IP restrictions
4. Check database is not paused
5. Review RLS policies if data access fails

## Next Steps

After successful migration:
1. Test core application workflows
2. Verify user authentication
3. Test data access with different roles
4. Monitor performance and query logs
5. Set up database backups
6. Configure database connection pooling if needed
