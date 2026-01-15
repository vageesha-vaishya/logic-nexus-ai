# Database Export Scripts for Migration

This directory contains SQL scripts to export all data from your Lovable Cloud Supabase database for migration to Supabase Cloud.

## Scripts Overview

### Export Scripts (Run in Order)

1. **`01-export-master-data.sql`** - Master data with no dependencies
   - Tenants, franchises, profiles, locations, carriers, etc.
   - Run FIRST

2. **`02-export-configuration-data.sql`** - Configuration and settings
   - Roles, subscriptions, quote configs, email settings, etc.
   - Run SECOND

3. **`03-export-crm-data.sql`** - CRM data
   - Accounts, contacts, leads, opportunities, activities
   - Run THIRD

4. **`04-export-quotes-shipments.sql`** - Quotes and shipments
   - Quotes, versions, charges, shipments, cargo
   - Run FOURTH

5. **`05-export-audit-logs.sql`** - Audit and system data
   - Audit logs, notifications, system settings
   - Run LAST

### Alternative Exports

- **`00-export-all-json.sql`** - Export all tables as JSON (single query per table)
  - Easier to inspect and restore
  - Larger file sizes
  - Good for backup purposes

### Verification

- **`verify-counts.sql`** - Compare row counts between old and new database
  - Run on BOTH databases after migration
  - Compare outputs to verify completeness

## How to Use

### Method 1: Using Supabase Dashboard (Easiest)

1. Go to your Lovable Cloud project backend (use "View Backend" button)
2. Navigate to SQL Editor
3. Copy and paste each script section by section
4. Save the output as CSV files

### Method 2: Using psql Command Line

```bash
# Connect to Lovable Cloud database
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# Run export script and save to file
\copy (SELECT * FROM tenants ORDER BY created_at) TO 'tenants.csv' WITH (FORMAT CSV, HEADER true, QUOTE '"')

# Or redirect output
\o tenants.csv
SELECT * FROM tenants ORDER BY created_at;
\o
```

### Method 3: Using Export Function You Already Have

Your project already has a `DatabaseExport` component at:
`src/pages/dashboard/data-management/DatabaseExport.tsx`

1. Navigate to **Data Management → Database Export** in your app
2. Select tables to export
3. Click "Export Selected as CSV" or "Export Selected as Excel"
4. Download the files

### Method 4: Programmatic Export via Client Library

```typescript
import { supabase } from '@/integrations/supabase/client';
import { exportCsv } from '@/lib/import-export';

// Export tenants
const { data: tenants } = await supabase
  .from('tenants')
  .select('*')
  .order('created_at');

if (tenants) {
  const headers = Object.keys(tenants[0]);
  exportCsv('tenants.csv', headers, tenants);
}
```

## Import to New Supabase Project

### Using Supabase Dashboard

1. Go to new Supabase project → Table Editor
2. Select the table
3. Click "Insert" → "Import data from CSV"
4. Upload your CSV file

### Using psql

```bash
# Connect to new Supabase database
psql "postgresql://postgres:[NEW_PASSWORD]@db.[NEW_PROJECT_REF].supabase.co:5432/postgres"

# Import data
\copy tenants FROM 'tenants.csv' WITH (FORMAT CSV, HEADER true)
```

### Important Import Order

Follow this order to respect foreign key constraints:

1. Master data (tenants, franchises, profiles, locations, etc.)
2. Configuration data (roles, subscriptions, settings)
3. CRM data (accounts, contacts, leads, opportunities)
4. Quotes and shipments (quotes, versions, charges, shipments)
5. Audit data (logs, notifications)

## Data Verification

After migration, run `verify-counts.sql` on BOTH databases:

```bash
# On old database (Lovable Cloud)
psql "OLD_CONNECTION_STRING" -f verify-counts.sql > old-counts.txt

# On new database (Supabase Cloud)
psql "NEW_CONNECTION_STRING" -f verify-counts.sql > new-counts.txt

# Compare the two files
diff old-counts.txt new-counts.txt
```

All counts should match!

## Tips & Best Practices

### Before Export

1. **Stop writes** to the database during final export (maintenance mode)
2. **Run verification** to know baseline counts
3. **Export in order** to maintain referential integrity

### During Export

1. **Monitor file sizes** - very large tables may need chunked exports
2. **Check for NULLs** - CSV exports handle NULLs differently
3. **Verify JSONB fields** - ensure proper escaping

### After Import

1. **Verify counts** using verify-counts.sql
2. **Test foreign keys** - ensure relationships are intact
3. **Check sequences** - reset sequences if using COPY:
   ```sql
   SELECT setval('table_id_seq', (SELECT MAX(id) FROM table));
   ```
4. **Verify RLS policies** - ensure they're applied correctly
5. **Test authentication** - verify users can log in

## Troubleshooting

### "Permission denied" errors
- Use service role key, not anon key
- Check RLS policies on source database

### "Foreign key constraint violation"
- Import tables in correct order (see above)
- Check that referenced IDs exist in parent tables
- If using the in-app pg_dump export, ensure the built-in foreign key validation passes without orphaned references before running the import; review the generated export log for any reported constraints or tables that need cleanup.

### "Sequence out of sync"
- Reset sequences after import (see above)

### Large JSONB fields causing issues
- Export as JSON instead of CSV
- Or use database dump/restore method

## Alternative: Full Database Dump

For the most reliable migration:

```bash
# Export entire database
pg_dump "OLD_CONNECTION_STRING" > full-backup.sql

# Import to new database
psql "NEW_CONNECTION_STRING" < full-backup.sql
```

This preserves all data types, sequences, and relationships perfectly.

## Need Help?

- Check the main migration guide for context
- Review Supabase documentation: <https://supabase.com/docs>
- Test on a small subset first before full migration
