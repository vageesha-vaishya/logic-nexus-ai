# Supabase Project Migration Plan & Runbook

## 1. Executive Summary
This document outlines the comprehensive strategy for migrating the SOS Logistics Pro (SOS Nexus) platform from the current Supabase instance to a new target Supabase instance. The objective is to ensure **zero data loss**, **minimal downtime**, and **full integrity** of all database objects, storage, edge functions, and authentication configurations.

**Target Audience:** DevOps Engineers, Database Administrators, Backend Developers.

---

## 2. Phase 1: Pre-Migration Analysis & Preparation

### 2.1 Inventory & Documentation
Before initiating any changes, a complete audit of the source environment is required.

*   **Database Objects:**
    *   **Schema:** Tables, Views, Materialized Views, Sequences, Types, Domains.
    *   **Logic:** Functions, Triggers, Stored Procedures.
    *   **Security:** RLS Policies, Roles, Grants.
    *   **Extensions:** List all enabled extensions (e.g., `postgis`, `pg_cron`, `uuid-ossp`).
*   **Supabase Specifics:**
    *   **Storage:** Bucket names, public/private status, storage policies.
    *   **Edge Functions:** List of deployed functions and their secrets.
    *   **Auth:** Providers (Google, Azure, etc.), SMTP settings, Email Templates, Redirect URLs.
    *   **Realtime:** Enabled tables for replication.

### 2.2 Environment Setup
*   **Target Instance:** Provision new Supabase project.
*   **Network:**
    *   Ensure the migration machine has IP access to both Source and Target databases (Supabase Dashboard > Settings > Database > Network Restrictions).
    *   If using a VPN, confirm connectivity.
*   **Tools:**
    *   Install PostgreSQL Client Tools (`pg_dump`, `pg_restore`, `psql`) matching the source DB version (likely PG 15 or 16).
    *   Install Supabase CLI: `brew install supabase/tap/supabase` (macOS) or via npm/Chocolatey.
    *   Authenticate Supabase CLI: `supabase login`.

### 2.3 Dependency Check
*   **Extensions:** Verify availability of all source extensions in the target environment.
    *   *Action:* Run `SELECT * FROM pg_extension;` on source and ensure they can be enabled on target.

### 2.4 Backup Strategy
*   **Immediate Action:** Trigger a manual backup via Supabase Dashboard.
*   **Safety Net:** Note the specific timestamp of the backup for Point-In-Time Recovery (PITR) reference.

---

## 3. Phase 2: Export Process

### 3.1 Database Schema & Data Export
We will use `pg_dump` to generate separate schema and data files to minimize issues during restore.

**Configuration Variables:**
```bash
export SOURCE_HOST="db.ref.supabase.co"
export SOURCE_USER="postgres"
export SOURCE_DB="postgres"
export SOURCE_PORT="5432"
# Use a secure way to handle password, e.g., ~/.pgpass
```

**Step 3.1.1: Export Schema (Roles & DDL)**
```bash
pg_dump -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB \
  --clean \
  --if-exists \
  --quote-all-identifiers \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file=schema.sql
```
*Note: We exclude owner/privileges to avoid conflicts with the target database's default `postgres` user.*

**Step 3.1.2: Export Data**
```bash
pg_dump -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB \
  --data-only \
  --disable-triggers \
  --format=custom \
  --blobs \
  --file=data.dump
```
*Note: `--disable-triggers` is crucial to prevent foreign key checks and trigger logic from running during bulk import.*

**Step 3.1.3: Export Globals (Optional but Recommended)**
If you have custom roles that are not Supabase defaults:
```bash
pg_dumpall -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER \
  --globals-only \
  --no-role-passwords \
  --file=globals.sql
```

### 3.2 Supabase-Specific Objects Export

**Step 3.2.1: Storage Buckets & Policies**
*   **Manual/Scripted:** There is no direct "dump" for storage config.
*   **Action:** Record bucket names and copy the SQL definitions of Storage Policies from the `storage.objects` and `storage.buckets` RLS settings.
*   **Files:** Download critical assets if volume is low, or prepare a script to use the Supabase JS SDK to move files bucket-to-bucket.

**Step 3.2.2: Edge Functions**
*   **Action:** Ensure local development environment has the latest code.
*   **Pull:** If source code is missing locally, unfortunately, Supabase does not support downloading deployed function code. **Reliance on Git repository is mandatory.**
*   **Config:** Document secrets: `supabase secrets list --project-ref <source-ref>`.

**Step 3.2.3: Auth & Settings**
*   **Action:** Manually document settings from the dashboard.
    *   *Site URL & Redirect URLs*
    *   *Auth Providers (Client IDs/Secrets)*
    *   *SMTP Settings*
    *   *Email Templates (Subject/Body)*

---

## 4. Phase 3: Import & Validation Process

**Configuration Variables:**
```bash
export TARGET_HOST="db.new-ref.supabase.co"
export TARGET_USER="postgres"
export TARGET_DB="postgres"
export TARGET_PORT="5432"
```

### 4.1 Database Import

**Step 4.1.1: Import Schema**
```bash
psql -h $TARGET_HOST -p $TARGET_PORT -U $TARGET_USER -d $TARGET_DB \
  -f schema.sql
```
*Review output for errors related to extensions or permissions.*

**Step 4.1.2: Import Data**
```bash
pg_restore -h $TARGET_HOST -p $TARGET_PORT -U $TARGET_USER -d $TARGET_DB \
  --disable-triggers \
  --data-only \
  --verbose \
  data.dump
```

**Step 4.1.3: Re-enable Triggers & Reset Sequences**
After data import, ensure sequences are synced:
```sql
-- Run in psql
SELECT setval(quote_ident(sequence_name), (SELECT MAX(id) FROM table_name) + 1)
FROM information_schema.sequences
WHERE sequence_schema = 'public';
-- (This requires a more complex dynamic SQL script for all tables)
```

### 4.2 Supabase-Specific Objects Import

**Step 4.2.1: Storage & Policies**
*   Create buckets in the new project.
*   Apply Storage RLS policies (usually contained in `schema.sql` if exported correctly from `storage` schema, but often requires manual re-application if excluded).

**Step 4.2.2: Edge Functions**
*   **Link:** `supabase link --project-ref <target-ref>`
*   **Secrets:** Set secrets: `supabase secrets set --env-file .env.production`
*   **Deploy:** `supabase functions deploy`

**Step 4.2.3: Auth Configuration**
*   Apply Auth settings manually via Dashboard or Management API.

### 4.3 Data Integrity & Validation

**Step 4.3.1: Row Counts**
Compare row counts for critical tables:
```sql
SELECT count(*) FROM public.users;
SELECT count(*) FROM public.orders;
-- Repeat for major tables
```

**Step 4.3.2: RLS Validation**
*   Create a test user in the new system.
*   Attempt to access data they *should* see.
*   Attempt to access data they *should not* see.

**Step 4.3.3: Functionality Check**
*   Trigger an Edge Function.
*   Upload a file to Storage.
*   Perform a login flow.

---

## 5. Phase 4: Post-Migration & Cutover

### 5.1 Application Configuration Update
*   Update Environment Variables in Vercel/Netlify/Container:
    *   `NEXT_PUBLIC_SUPABASE_URL` -> New URL
    *   `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> New Anon Key
    *   `SUPABASE_SERVICE_ROLE_KEY` -> New Service Role Key
    *   `DATABASE_URL` -> New Connection String

### 5.2 Final Verification
*   Execute End-to-End (E2E) test suite against the new environment.
*   Verify real-time subscriptions are receiving events.

### 5.3 Monitoring (First 48 Hours)
*   **Metrics:** Monitor CPU, RAM, and Disk IO on the new Supabase instance.
*   **Logs:** Watch Postgres logs for permission errors or slow queries.

### 5.4 Decommissioning
*   **Archive:** Keep the source project in "Paused" state for 7 days.
*   **Delete:** Schedule deletion after 14 days of stability.

---

## 6. Rollback Plan
If critical failure occurs during Phase 3 or 4:
1.  **Stop:** Halt migration activities.
2.  **Revert App Config:** Point application back to Source Project.
3.  **Assess:** Analyze failure logs (pg_restore errors, connection timeouts).
4.  **Clean:** Drop the Target Database schema before next attempt to ensure clean slate.

