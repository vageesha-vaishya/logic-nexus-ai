# Complete Supabase Migration Package v2

This package provides a **complete, end-to-end migration** for your Supabase project, bypassing network blocks.

## What's Included?
*   **Database Data**: 167 CSV tables (Secured).
*   **Database Schema**: Full SQL reconstruction file.
*   **Auth Users**: JSON export of all users.
*   **Storage**: All files and buckets.
*   **Master Script**: `scripts/master_migration.js` to restore everything.

## Instructions

### 1. Setup New Project
Create your new project on Supabase and get the **Project URL** and **Service Role Key** (found in Project Settings -> API).

### 2. Restore Schema (SQL)
*   Open `migration_backup_20260127/full_schema.sql`.
*   Copy the content.
*   Paste it into the **SQL Editor** of your new Supabase project.
*   Run it to create all tables and functions.

### 3. Restore Data, Auth & Storage
Run the master migration script from your terminal:

```bash
export NEW_SUPABASE_URL="https://your-new-project.supabase.co"
export NEW_SERVICE_ROLE_KEY="your-service-role-key"

node scripts/master_migration.js
```

This script will automatically:
1.  Re-create all **Auth Users**.
2.  Re-create all **Storage Buckets** and upload files.
3.  Import all **Database Tables** (167 tables).

## Verification
After the script finishes, check your new project dashboard to confirm:
*   Table row counts match.
*   Users are listed in Authentication.
*   Files exist in Storage.
