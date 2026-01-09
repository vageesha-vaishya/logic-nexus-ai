# Complete Supabase Migration Guide
## Lovable Cloud → Supabase Cloud

This package contains all scripts needed for a complete, error-free migration.

## 🎯 Quick Start (Easiest Method)

### Prerequisites
 - [ ] Supabase account created at <https://supabase.com>
- [ ] New Supabase project created
- [ ] Database password saved
- [ ] Node.js and npm installed
- [ ] `psql` command-line tool installed (comes with PostgreSQL)

### Step 1: Export from Lovable Cloud (15 minutes)

**Option A: Use DatabaseExport UI (Easiest)**
1. Navigate to: **Data Management → Database Export** in your app
2. Select "All Tables"
3. Click "Export Selected as CSV"
4. Save all CSV files to `migration-data/` folder

**Option B: Use SQL Scripts**
1. Open Lovable Cloud backend
2. Go to SQL Editor
3. Run each export script from `supabase/export-scripts/`
4. Save outputs as CSV files in `migration-data/` folder

**Option C: Use pg_dump (Most Complete)**
```bash
# Get connection string from Lovable Cloud backend
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  --no-owner --no-privileges \
  --data-only \
  --format=custom \
  -f migration-data/complete-backup.dump
```

### Step 2: Prepare New Supabase Project (5 minutes)

1. Create new project at <https://supabase.com>
2. Wait for project provisioning (2-3 minutes)
3. Get credentials from **Project Settings → API**:
   - Project URL
   - anon/public key
   - service_role key
4. Get database credentials from **Project Settings → Database**:
   - Connection string
   - Database password

5. Save credentials to `new-supabase-config.env`:
```bash
cp migration-package/templates/new-supabase-config.env.template new-supabase-config.env
# Edit with your credentials
```

### Step 3: Run Automated Migration (30-60 minutes)

```bash
# Navigate to migration package
cd supabase/migration-package

# Make scripts executable
chmod +x *.sh

# Run complete migration
./run-migration.sh
```

The script will:
1. ✅ Validate connection to new database
2. ✅ Apply complete schema (tables, functions, triggers, RLS)
3. ✅ Import all data in correct order
4. ✅ Verify data integrity
5. ✅ Test connections
6. ✅ Generate report

### Step 4: Deploy Edge Functions (10 minutes)

```bash
# Install Supabase CLI
npm install -g supabase

# Link to new project
supabase link --project-ref YOUR_NEW_PROJECT_REF

# Deploy all functions
supabase functions deploy
```

### Step 5: Update Your Application (5 minutes)

```bash
# Update environment variables
cp .env .env.backup
cp new-supabase-config.env .env

# Test locally
npm run dev

# Deploy to production
npm run build
```

### Step 6: Verify Everything Works (15 minutes)

Run the verification script:
```bash
./verify-migration.sh
```

This checks:
- ✅ All tables exist
- ✅ Row counts match
- ✅ RLS policies active
- ✅ Functions working
- ✅ Edge functions responding
- ✅ Authentication working

---

## 📋 Detailed File Index

### Export Scripts
- `../export-scripts/01-export-master-data.sql` - Master data export
- `../export-scripts/02-export-configuration-data.sql` - Configuration export
- `../export-scripts/03-export-crm-data.sql` - CRM data export
- `../export-scripts/04-export-quotes-shipments.sql` - Quotes/shipments export
- `../export-scripts/05-export-audit-logs.sql` - Audit logs export

### Import Scripts
- `02-import-schema.sql` - Complete schema restoration
- `03-import-data.sh` - Automated data import
- `04-import-functions.sql` - Database functions
- `05-import-policies.sql` - RLS policies

### Automation Scripts
- `run-migration.sh` - Master migration script
- `verify-migration.sh` - Verification script
- `rollback.sh` - Emergency rollback

### Helper Scripts
- `helpers/test-connection.js` - Test database connection
- `helpers/compare-schemas.js` - Compare old vs new schema
- `helpers/sync-auth-users.js` - Sync authentication users

### Templates
- `templates/new-supabase-config.env.template` - Environment template
- `templates/.env.production.template` - Production config template

---

## 🔧 Troubleshooting

### Connection Issues
```bash
# Test connection
node helpers/test-connection.js

# Check credentials
cat new-supabase-config.env
```

### Data Import Errors
```bash
# Check logs
cat migration-logs/import-errors.log

# Retry failed tables
./03-import-data.sh --retry-failed
```

### RLS Policy Errors
```bash
# Temporarily disable RLS for import
psql "$NEW_DB_URL" -c "ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;"

# Re-enable after import
./05-import-policies.sql
```

### Missing Data
```bash
# Compare row counts
node helpers/compare-data.js

# Generate missing data report
./verify-migration.sh --detailed
```

---

## ⚠️ Important Notes

1. **Keep Lovable Cloud Active**: Don't delete until 100% verified
2. **Test First**: Run migration on a test project first
3. **Downtime**: Plan for 1-2 hours maintenance window
4. **Backups**: Keep all export files for 30 days
5. **Auth Users**: Users may need to reset passwords

---

## 🆘 Emergency Rollback

If migration fails:
```bash
# Restore Lovable Cloud connection
./rollback.sh

# This will:
# 1. Restore old .env file
# 2. Point app back to Lovable Cloud
# 3. Verify old connection works
```

---

## 📞 Support

- Migration issues: Check `migration-logs/` folder
- Data issues: Run `verify-migration.sh --detailed`
- Connection issues: Run `node helpers/test-connection.js`

---

## ✅ Success Criteria

Migration is complete when:
- [ ] All tables exist in new database
- [ ] Row counts match between old and new
- [ ] All RLS policies active
- [ ] All database functions working
- [ ] Edge functions deployed and responding
- [ ] Application connects successfully
- [ ] Users can login
- [ ] CRUD operations work
- [ ] No errors in logs for 24 hours

**Estimated Total Time: 2-3 hours**
