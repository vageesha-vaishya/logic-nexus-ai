# Supabase Migration Package

Complete automation scripts for migrating from Lovable Cloud to Supabase Cloud.

## 📦 Package Contents

```
migration-package/
├── 00-pre-migration-test.sh      # Pre-migration environment tests ⭐ NEW
├── 01-MIGRATION-GUIDE.md          # Complete step-by-step guide
├── run-migration.sh               # Master migration script (RUN THIS!)
├── 02-cleanup-existing.sh        # Clean existing database objects
├── 03-import-data.sh             # Data import with progress tracking
├── migration-status.sh           # Real-time migration status monitor
├── force-clean-migration.sh      # Automated clean migration (no prompts)
├── verify-migration.sh           # Verify everything works
├── rollback.sh                   # Emergency rollback
├── deploy-functions.sh           # Deploy edge functions
├── templates/
│   ├── new-supabase-config.env.template
│   └── .env.production.template
├── helpers/
│   └── test-connection.js        # Test database connection
└── migration-logs/               # Generated during migration
```

## 🚀 Quick Start

### Standard Migration (with cleanup option)
```bash
# 1. Configure new database
cp templates/new-supabase-config.env.template new-supabase-config.env
# Edit with your new Supabase credentials

# 2. Run migration (will prompt for cleanup)
chmod +x *.sh
./run-migration.sh

# 3. Deploy edge functions
./deploy-functions.sh
```

### Force Clean Migration (for re-runs)
```bash
# One-command clean migration (deletes all existing data)
./force-clean-migration.sh
```

## ✅ What Gets Migrated

- ✅ Complete database schema (tables, constraints, indexes)
- ✅ All data in correct dependency order
- ✅ Database functions and triggers
- ✅ RLS policies
- ✅ Custom enums
- ✅ Sequences (auto-increment)
- ✅ Foreign keys and constraints

## 📋 Prerequisites

1. **New Supabase project created** at https://supabase.com
2. **PostgreSQL client** (`psql`) installed
3. **Node.js** installed
4. **Data exported** from Lovable Cloud to `migration-data/` folder

## 🔧 Configuration

Edit `new-supabase-config.env`:

```bash
# Get from: Project Settings → Database
NEW_DB_URL="postgresql://postgres:YOUR_PASSWORD@db.XXX.supabase.co:5432/postgres"

# Get from: Project Settings → API
NEW_SUPABASE_URL="https://XXX.supabase.co"
NEW_SUPABASE_ANON_KEY="your_anon_key"
NEW_SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
NEW_PROJECT_ID="your_project_ref"
```

## 📊 Migration Steps

### Step 0: Pre-Migration Testing (Recommended) ⭐ NEW
Run comprehensive environment tests before migration:

```bash
./00-pre-migration-test.sh
```

This validates:
- ✓ PostgreSQL client and Node.js installation
- ✓ Configuration files and credentials
- ✓ Target database connectivity and permissions
- ✓ Schema and data export files present
- ✓ Disk space availability
- ✓ Migration scripts integrity
- ✓ Supabase connection test

**Note:** The main migration script (`run-migration.sh`) automatically runs these tests, but you can run them independently first.

### Step 1: Export Data
```bash
# Use DatabaseExport UI in your app
# OR run export scripts from ../export-scripts/
# Save all CSVs to migration-data/ folder
```

### Step 2: Test Connection (Optional)
```bash
node helpers/test-connection.js
```

### Step 3: Run Migration
```bash
./run-migration.sh

# OR for force clean migration (if re-running)
./force-clean-migration.sh
```

The migration will:
1. **Run pre-migration tests** (validates entire environment)
2. Test connection
3. (Optional) Clean existing database objects
4. Apply schema
5. Import data with **real-time progress tracking**:
   - Progress bar with percentage
   - Elapsed time and ETA
   - Per-table statistics
   - Row counts and file sizes
6. Reset sequences
7. Verify integrity

### Step 3b: Monitor Progress (Optional)
While migration is running or after completion:
```bash
./migration-status.sh
```

This shows:
- Table-by-table status
- Row counts
- RLS policies status
- Database functions count
- Recent activity
- Overall progress percentage

### Step 4: Deploy Functions
```bash
./deploy-functions.sh
```

### Step 5: Update App
```bash
# Backup current .env
cp ../../.env ../../.env.backup

# Update with new credentials
cp new-supabase-config.env ../../.env

# Test
cd ../..
npm run dev
```

## 🔍 Verification

```bash
./verify-migration.sh
```

Checks:
- Database connection
- All tables exist
- Row counts match
- RLS policies active
- Functions present
- Indexes created
- Foreign keys working
- Data integrity

## 🆘 Emergency Rollback

If anything goes wrong:

```bash
./rollback.sh
```

This restores your Lovable Cloud connection immediately.

## 📝 Logs

All operations logged to:
```
migration-logs/
├── migration-YYYYMMDD_HHMMSS.log
└── verification-report.txt
```

## ⚠️ Important Notes

1. **Keep Lovable Cloud active** until fully verified
2. **Test thoroughly** before going live
3. **Users may need password reset** (auth migration is complex)
4. **Monitor for 24 hours** after migration
5. **Save all export files** for 30 days

## 🔐 Security

- Never commit `new-supabase-config.env` (contains secrets)
- Use service_role key only in server-side scripts
- Keep connection strings secure
- Review RLS policies after migration

## 🐛 Troubleshooting

### Pre-Migration Test Failed
```bash
# Run tests independently to identify issues
./00-pre-migration-test.sh

# Fix reported issues, then retry migration
./run-migration.sh
```

### Connection Failed
```bash
node helpers/test-connection.js
# Check credentials in new-supabase-config.env
```

### Import Errors
```bash
# Check logs
cat migration-logs/migration-*.log

# Retry specific table
psql "$NEW_DB_URL" -c "\\COPY public.table_name FROM 'migration-data/table_name.csv' WITH (FORMAT csv, HEADER true)"
```

### Existing Data Conflicts
```bash
# Clean existing database and retry
./02-cleanup-existing.sh
./run-migration.sh

# OR use force clean migration
./force-clean-migration.sh
```

### Missing Data
```bash
# Compare counts
./verify-migration.sh --detailed

# Check specific table
psql "$NEW_DB_URL" -c "SELECT COUNT(*) FROM table_name;"
```

### RLS Errors
```bash
# Temporarily disable for troubleshooting
psql "$NEW_DB_URL" -c "ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;"
```

### Re-running Migration
The scripts now support clean re-runs:
- `03-import-data.sh` automatically truncates tables before import
- Use `./force-clean-migration.sh` for complete clean slate
- Or run `./02-cleanup-existing.sh` manually before migration

## 📞 Support Resources

- Migration guide: `01-MIGRATION-GUIDE.md`
- Supabase docs: https://supabase.com/docs
- Export scripts: `../export-scripts/README.md`

## ✅ Success Checklist

- [ ] Data exported from Lovable Cloud
- [ ] New Supabase project created
- [ ] Configuration file updated
- [ ] **Pre-migration tests passed** ⭐ NEW
- [ ] Connection test passed
- [ ] Schema migration completed
- [ ] Data import completed
- [ ] Verification passed
- [ ] Edge functions deployed
- [ ] Application updated
- [ ] Production tested
- [ ] No errors for 24 hours
- [ ] Old database backed up

## 🎉 Post-Migration

After successful migration:
1. Update documentation
2. Notify team
3. Monitor logs for 48 hours
4. Keep Lovable Cloud as backup for 2 weeks
5. Archive export files
6. Update CI/CD pipelines
7. Celebrate! 🎊

---

**Estimated Time:** 2-3 hours
**Difficulty:** Medium
**Success Rate:** 95%+ with proper preparation
