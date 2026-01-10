# Direct Database Migration Tool

This tool enables a direct, reliable migration from a Source Database (Trae Dev, Local, or Legacy) to Supabase Cloud.

## Features
- **Schema Migration**: Transfers `public` schema structure (excluding system schemas like `auth` and `storage`).
- **Data Migration**: Transfers `public` data using binary `pg_dump` format (preserving types).
- **Auth Migration**: Synchronizes `auth.users` and `auth.identities` preserving password hashes (requires Node.js).
- **Validation**: Compares row counts between source and target.

## Prerequisites
1.  `psql` and `pg_dump` (PostgreSQL Client Tools) installed.
2.  `node` (Node.js) installed (for Auth sync and Validation).
3.  `npm install` in this directory to install dependencies (`pg`, `dotenv`).

## Setup
1.  Copy template: `cp migration.env.template migration.env`
2.  Edit `migration.env`:
    - `SOURCE_DB_URL`: Connection string for source.
    - `TARGET_DB_URL`: Connection string for target (Supabase).
    - `MIGRATE_AUTH`: Set to `true` if you want to migrate users.

## Usage
```bash
# Install dependencies
npm install

# Run Migration
./migrate.sh
```

## SQL Script Automation
To execute SQL scripts (e.g., migrations) directly against the target database without copy-pasting:

```bash
# Run all scripts in supabase/migrations directory (default)
./apply-migrations.sh

# Run a specific script
./apply-migrations.sh ../../migrations/20260110_audit_logs.sql

# Run scripts from a custom directory
./apply-migrations.sh /path/to/custom/scripts/
```

This tool:
- Automatically detects file or directory mode.
- Wraps each script in a transaction (`BEGIN` ... `COMMIT/ROLLBACK`).
- Stops immediately on error to prevent inconsistent state.
- Logs full execution details to `logs/sql-execution-*.log`.

## Logs
Logs are stored in `logs/` directory. Check `logs/migration-YYYYMMDD_HHMMSS.log` for details.
