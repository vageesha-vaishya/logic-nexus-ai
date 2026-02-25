# Dashboard Role Migration - Complete Guide

The `dashboard_role` column migration is ready. Choose your preferred method below.

## Quick Start (Recommended)

### Option 1: Python Script (Most Reliable)

Python is pre-installed on most systems and has minimal dependencies:

```bash
python3 scripts/migrate_dashboard.py
```

**What it does:**
1. ✅ Loads credentials from .env
2. ✅ Checks if migration already completed
3. ✅ Runs all migration steps
4. ✅ Validates each step
5. ✅ Provides next steps

---

### Option 2: Node.js Script

If you prefer Node.js:

```bash
# Using TypeScript (recommended)
npx ts-node scripts/run-dashboard-migration.ts

# Or using vanilla Node.js
node scripts/migrate.mjs
```

---

### Option 3: Manual SQL in Supabase

If scripts don't work, run manually in Supabase:

1. Go to: **Supabase Dashboard** → Your Project
2. Navigate to: **SQL Editor** → **New Query**
3. Copy and paste from: `src/migrations/20260226_add_dashboard_role.sql`
4. Click: **Run**
5. Wait for: ✅ "Query executed successfully"

---

## Prerequisites

Make sure your `.env` file has:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these from:
1. Go to: https://app.supabase.com
2. Select your project
3. Go to: **Settings** → **API**
4. Copy: **Project URL** and **Service Role Key**

---

## Step-by-Step Instructions

### Using Python Script

```bash
# 1. Run the migration
python3 scripts/migrate_dashboard.py

# 2. Expected output:
# ✅ Configuration loaded
# 🚀 Running Migration Steps
# ✓ Validating Migration
# ✅ MIGRATION SUCCESSFUL & VALIDATED
```

### Using Manual SQL

```sql
-- Step 1: Add the column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';

-- Step 2: Create index
CREATE INDEX IF NOT EXISTS idx_profiles_dashboard_role
ON public.profiles(dashboard_role);

-- Step 3: Add description
COMMENT ON COLUMN public.profiles.dashboard_role
IS 'Dashboard template role assignment';

-- Step 4: Verify (should return 1 row)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'dashboard_role';
```

---

## Verify Migration Completed

Run this SQL in Supabase to confirm:

```sql
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'dashboard_role';
```

Expected output:
| column_name | data_type | column_default | is_nullable |
|-------------|-----------|---|---|
| dashboard_role | text | 'crm_sales_rep'::text | t |

---

## Next Steps After Migration

1. **Restart dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to dashboard:**
   ```
   http://localhost:5173/dashboard
   ```

3. **Verify it works:**
   - Dashboard should load
   - No loading spinner stuck
   - Widgets show real data
   - Browser console has no errors (F12)

---

## Troubleshooting

### "Migration failed to load environment"
- Ensure `.env` file exists in project root
- Verify it has `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### "Column already exists" error
- This is OK! Migration already ran successfully
- You can proceed to next steps

### "Permission denied" error
- Make sure you're using `SUPABASE_SERVICE_ROLE_KEY`, not `SUPABASE_ANON_KEY`
- Service role key has admin permissions

### Script runs but doesn't complete
- Check network connectivity to Supabase
- Try manual SQL method in Supabase Dashboard
- Check Supabase project status (not paused)

### "SUPABASE_URL is invalid"
- Should be: `https://your-project.supabase.co` (with https://)
- Should NOT be: just `your-project.supabase.co`

---

## Migration Files

- **Migration SQL:** `src/migrations/20260226_add_dashboard_role.sql`
- **Python Script:** `scripts/migrate_dashboard.py` ⭐ (Recommended)
- **Node.js TypeScript:** `scripts/run-dashboard-migration.ts`
- **Node.js ES Module:** `scripts/migrate.mjs`
- **Shell Script:** `scripts/run-migration.sh`
- **Manual Instructions:** `MIGRATION_INSTRUCTIONS.md`

---

## Support

If migration still fails after trying all methods:

1. Check Supabase project status
2. Verify credentials in `.env`
3. Try manual SQL in Supabase Dashboard
4. Check database logs in Supabase for errors

Once migration completes successfully, your dashboard will:
- ✅ Detect user roles from database
- ✅ Display role-appropriate templates
- ✅ Fetch real data from your tables
- ✅ Support customization persistence

**You're all set!** 🎉
