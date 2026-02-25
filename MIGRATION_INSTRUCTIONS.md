# Dashboard Role Migration - Step by Step

If the main migration failed, follow these steps one at a time in Supabase SQL Editor.

## Option 1: Step-by-Step (Recommended if first attempt failed)

Run each statement separately in Supabase SQL Editor:

### Step 1: Add the column
```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';
```
✅ Expected: "Query executed successfully"

### Step 2: Create index (optional, for performance)
```sql
CREATE INDEX IF NOT EXISTS idx_profiles_dashboard_role ON public.profiles(dashboard_role);
```
✅ Expected: "Query executed successfully"

### Step 3: Verify the column exists
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'dashboard_role';
```
✅ Expected: Returns one row with dashboard_role column info

### Step 4: Check existing data
```sql
SELECT id, dashboard_role FROM public.profiles LIMIT 5;
```
✅ Expected: Shows dashboard_role column with 'crm_sales_rep' as default for new rows

---

## Option 2: If Column Already Exists

Check if the column was partially created:

```sql
-- Check if column exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'profiles' AND column_name = 'dashboard_role'
);
```

If it returns `true`, the column exists and you're good! You can skip the migration.

---

## Option 3: Troubleshooting Failures

### Error: "ERROR: column 'dashboard_role' already exists"
- Column was already created - this is OK, you can stop
- Verify: Run `SELECT dashboard_role FROM public.profiles LIMIT 1;`

### Error: "ERROR: syntax error at or near 'public'"
- Try without the `public.` prefix:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';
```

### Error: "ERROR: permission denied"
- Make sure you're using a role with table modification permissions
- Switch to a service role or admin role in Supabase

### Error: "ERROR: relation 'profiles' does not exist"
- The profiles table might be in a different schema
- Find it with: `SELECT * FROM information_schema.tables WHERE table_name = 'profiles';`
- Or try: `SELECT * FROM auth.profiles;`

---

## Verify Migration Success

After running the migration, verify everything worked:

```sql
-- 1. Check column exists and has correct type
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'dashboard_role';

-- Expected output:
-- column_name    | data_type | column_default
-- dashboard_role | text      | 'crm_sales_rep'::text

-- 2. Check index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'profiles' AND indexname LIKE '%dashboard_role%';

-- Expected output:
-- idx_profiles_dashboard_role

-- 3. Check some profiles have the default value
SELECT COUNT(*) as total,
       COUNT(dashboard_role) as with_value,
       COUNT(DISTINCT dashboard_role) as unique_values
FROM profiles;

-- Expected: All rows should have dashboard_role = 'crm_sales_rep'
```

---

## Next Steps After Successful Migration

1. Restart your development server: `npm run dev`
2. Navigate to dashboard: `http://localhost:5173/dashboard`
3. Dashboard should load with your user's dashboard role
4. Widgets should display real data from your database

---

## Still Having Issues?

Try this comprehensive check:

```sql
-- Complete diagnostics
WITH column_check AS (
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dashboard_role'
  ) as column_exists
),
index_check AS (
  SELECT COUNT(*) > 0 as index_exists
  FROM pg_indexes
  WHERE tablename = 'profiles' AND indexname = 'idx_profiles_dashboard_role'
),
data_check AS (
  SELECT COUNT(*) as total_profiles,
         COUNT(dashboard_role) as with_role,
         COUNT(DISTINCT dashboard_role) as unique_roles
  FROM profiles
)
SELECT
  (SELECT column_exists FROM column_check) as "Column Exists",
  (SELECT index_exists FROM index_check) as "Index Exists",
  (SELECT total_profiles FROM data_check) as "Total Profiles",
  (SELECT with_role FROM data_check) as "Profiles with Role",
  (SELECT unique_roles FROM data_check) as "Unique Roles";
```

This will show you the complete status of your migration.
