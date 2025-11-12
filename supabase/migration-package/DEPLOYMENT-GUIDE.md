# Complete Migration Deployment Guide

This guide provides step-by-step instructions for migrating your database and deploying edge functions to the new Supabase Cloud project.

## 🎯 Migration Checklist

- [ ] SQL schema migrated (01-06)
- [ ] RLS policies applied (07)
- [ ] Data exported from old database (08)
- [ ] Data imported to new database
- [ ] Edge functions deployed
- [ ] Secrets configured
- [ ] Application .env updated
- [ ] Testing completed

## Part 1: Database Migration (Already Completed ✅)

You've already executed SQL scripts 01-07. Verify completion:

```sql
-- Connect to new database
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

-- Verify tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- Verify functions
SELECT proname FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace 
ORDER BY proname;
```

## Part 2: Data Export from Old Database

### Option A: Using PostgreSQL COPY Command

1. **Connect to your OLD database**:
```bash
# Using connection string from old Lovable Cloud
psql "postgresql://postgres:[OLD_PASSWORD]@db.[OLD_PROJECT_REF].supabase.co:5432/postgres"
```

2. **Create export directory**:
```bash
mkdir -p migration-data
cd migration-data
```

3. **Export each table** (in dependency order):
```bash
# Copy the COPY commands from 08-data-export.sql
# Example for first few tables:
\COPY public.subscription_plans TO 'subscription_plans.csv' CSV HEADER
\COPY public.service_types TO 'service_types.csv' CSV HEADER
\COPY public.ports_locations TO 'ports_locations.csv' CSV HEADER
# ... continue for all tables
```

### Option B: Using Supabase Dashboard Export

1. Go to old Supabase project dashboard
2. Navigate to **Table Editor**
3. For each table, click **"Export"** → **CSV**
4. Save all files to `migration-data/` directory

### Option C: Using pg_dump (Full Database)

```bash
# Export only data (no schema)
pg_dump "postgresql://postgres:[OLD_PASSWORD]@db.[OLD_PROJECT_REF].supabase.co:5432/postgres" \
  --data-only \
  --no-owner \
  --no-privileges \
  --table='public.*' \
  --file=migration-data/data-only.sql
```

## Part 3: Data Import to New Database

### Using CSV Files (Recommended)

1. **Connect to NEW database**:
```bash
psql "postgresql://postgres:[NEW_PASSWORD]@db.[NEW_PROJECT_REF].supabase.co:5432/postgres"
```

2. **Disable triggers during import**:
```sql
SET session_replication_role = replica;
```

3. **Import in dependency order**:
```sql
-- Import master data first
\COPY public.subscription_plans FROM 'subscription_plans.csv' CSV HEADER
\COPY public.service_types FROM 'service_types.csv' CSV HEADER
\COPY public.ports_locations FROM 'ports_locations.csv' CSV HEADER
\COPY public.incoterms FROM 'incoterms.csv' CSV HEADER
-- ... continue for all tables in order from 08-data-export.sql

-- Re-enable triggers
SET session_replication_role = DEFAULT;
```

4. **Verify import**:
```sql
-- Check row counts
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
```

### Using SQL File

```bash
# If you used pg_dump
psql "postgresql://postgres:[NEW_PASSWORD]@db.[NEW_PROJECT_REF].supabase.co:5432/postgres" \
  -f migration-data/data-only.sql
```

## Part 4: Edge Functions Deployment

### Prerequisites

1. **Install Supabase CLI** (if not already installed):
```bash
npm install -g supabase
```

2. **Login to Supabase**:
```bash
supabase login
```

3. **Link to your new project**:
```bash
# From project root
supabase link --project-ref pqulscbawoqzhqobwupu
```

### Deploy All Functions

Use the deployment script:
```bash
cd supabase/migration-package
chmod +x deploy-functions.sh
./deploy-functions.sh
```

Or deploy manually:
```bash
# Deploy each function individually
supabase functions deploy create-user --project-ref pqulscbawoqzhqobwupu
supabase functions deploy exchange-oauth-token --project-ref pqulscbawoqzhqobwupu
supabase functions deploy get-account-label --project-ref pqulscbawoqzhqobwupu
supabase functions deploy get-contact-label --project-ref pqulscbawoqzhqobwupu
supabase functions deploy get-opportunity-full --project-ref pqulscbawoqzhqobwupu
supabase functions deploy get-opportunity-label --project-ref pqulscbawoqzhqobwupu
supabase functions deploy get-service-label --project-ref pqulscbawoqzhqobwupu
supabase functions deploy list-edge-functions --project-ref pqulscbawoqzhqobwupu
supabase functions deploy process-lead-assignments --project-ref pqulscbawoqzhqobwupu
supabase functions deploy salesforce-sync-opportunity --project-ref pqulscbawoqzhqobwupu
supabase functions deploy search-emails --project-ref pqulscbawoqzhqobwupu
supabase functions deploy seed-platform-admin --project-ref pqulscbawoqzhqobwupu
supabase functions deploy send-email --project-ref pqulscbawoqzhqobwupu
supabase functions deploy sync-all-mailboxes --project-ref pqulscbawoqzhqobwupu
supabase functions deploy sync-emails --project-ref pqulscbawoqzhqobwupu
```

### Verify Deployment

```bash
# List deployed functions
supabase functions list --project-ref pqulscbawoqzhqobwupu

# Check function logs
supabase functions logs <function-name> --project-ref pqulscbawoqzhqobwupu
```

## Part 5: Configure Secrets

See `SECRETS-CONFIGURATION.md` for detailed instructions.

### Quick Setup (Minimum Required)

```bash
# Set critical secrets
supabase secrets set SUPABASE_URL="https://pqulscbawoqzhqobwupu.supabase.co" --project-ref pqulscbawoqzhqobwupu
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" --project-ref pqulscbawoqzhqobwupu
supabase secrets set SUPABASE_ANON_KEY="your-anon-key" --project-ref pqulscbawoqzhqobwupu

# Verify secrets are set
supabase secrets list --project-ref pqulscbawoqzhqobwupu
```

### Get Keys from Dashboard

1. Go to https://supabase.com/dashboard/project/pqulscbawoqzhqobwupu
2. Navigate to **Settings** → **API**
3. Copy:
   - **Project URL** → SUPABASE_URL
   - **anon public** → SUPABASE_ANON_KEY
   - **service_role** → SUPABASE_SERVICE_ROLE_KEY (⚠️ Keep secret!)

## Part 6: Update Application Configuration

### Update .env File

Update your application's `.env` file with new Supabase project details:

```env
# New Supabase Cloud Project
VITE_SUPABASE_PROJECT_ID="pqulscbawoqzhqobwupu"
VITE_SUPABASE_URL="https://pqulscbawoqzhqobwupu.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Regenerate TypeScript Types (Important!)

```bash
# Generate new types from migrated database
npx supabase gen types typescript \
  --project-id pqulscbawoqzhqobwupu \
  > src/integrations/supabase/types.ts
```

This will fix all TypeScript errors in your application.

## Part 7: Testing and Validation

### 1. Test Database Access

```sql
-- Test RLS policies work
SELECT * FROM public.tenants LIMIT 1;
SELECT * FROM public.profiles LIMIT 1;

-- Test security functions
SELECT public.has_role(auth.uid(), 'platform_admin');
SELECT public.get_user_tenant_id(auth.uid());
```

### 2. Test Edge Functions

```bash
# Test a simple function
curl -X POST \
  https://pqulscbawoqzhqobwupu.supabase.co/functions/v1/list-edge-functions \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test user creation
curl -X POST \
  https://pqulscbawoqzhqobwupu.supabase.co/functions/v1/seed-platform-admin \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"SecurePass123!"}'
```

### 3. Test Application

1. Start your application: `npm run dev`
2. Test authentication (login/signup)
3. Test basic CRUD operations
4. Verify data displays correctly
5. Check edge function calls from UI

### 4. Validate Data Integrity

```sql
-- Compare record counts (old vs new)
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check foreign key integrity
SELECT 
  conname as constraint_name,
  conrelid::regclass as table_name,
  confrelid::regclass as references_table
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;

-- Verify RLS policies
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
```

## Part 8: Post-Migration Cleanup

### Update Environment Files

Update all environment references:
- Update CI/CD pipelines
- Update deployment scripts
- Update documentation
- Update team access (invite members to new project)

### Backup Old Database

Before decommissioning:
```bash
# Create final backup of old database
pg_dump "postgresql://postgres:[OLD_PASSWORD]@db.[OLD_PROJECT_REF].supabase.co:5432/postgres" \
  --format=custom \
  --file=old-database-final-backup.dump
```

### Monitor New Database

Set up monitoring in Supabase dashboard:
1. **Database** → **Logs** - Check for errors
2. **Auth** → **Logs** - Monitor authentication
3. **Edge Functions** → **Logs** - Check function execution
4. **Database** → **Query Performance** - Optimize slow queries

## Troubleshooting

### TypeScript Errors After Migration

```bash
# Regenerate types from new database
npx supabase gen types typescript --project-id pqulscbawoqzhqobwupu > src/integrations/supabase/types.ts
```

### RLS Policy Errors

```sql
-- Check if user has required role
SELECT * FROM public.user_roles WHERE user_id = auth.uid();

-- Test policy manually
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"USER_ID_HERE"}';
SELECT * FROM public.leads LIMIT 1;
```

### Edge Function Not Working

```bash
# Check logs
supabase functions logs <function-name> --project-ref pqulscbawoqzhqobwupu

# Verify secrets are set
supabase secrets list --project-ref pqulscbawoqzhqobwupu

# Redeploy function
supabase functions deploy <function-name> --project-ref pqulscbawoqzhqobwupu
```

### Data Not Visible

1. Check RLS policies are applied
2. Verify user has correct role in `user_roles` table
3. Check tenant_id / franchise_id associations
4. Review function security definer settings

## Migration Complete! 🎉

Your database and edge functions should now be fully migrated to the new Supabase Cloud project. 

### Final Checklist:
- ✅ All tables created with schema
- ✅ All RLS policies applied
- ✅ All data imported
- ✅ All edge functions deployed
- ✅ All secrets configured
- ✅ Application .env updated
- ✅ TypeScript types regenerated
- ✅ Testing completed
- ✅ Team members invited
- ✅ Monitoring configured

### Next Steps:
1. Monitor application for any issues
2. Update documentation with new project details
3. Decommission old project after verification period
4. Set up regular backups
5. Configure alerts for errors
