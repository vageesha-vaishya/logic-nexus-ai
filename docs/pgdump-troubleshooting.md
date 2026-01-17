# pg_dump Export and Import Troubleshooting Guide

## Overview

This guide covers common errors and recovery steps when using the pg_dump-compatible export and import tools:

- UI export: PgDumpExportPanel
- CLI export: scripts/pgdump-export.js
- Import: PgDumpImportWizard and usePgDumpImport hook

## Connection Failures

### Symptoms

- CLI:
  - Messages like `could not connect to server`, `could not translate host name`, or `connection refused`.
- UI:
  - Connection test fails in the export or import wizard.

### Causes

- Wrong host, port, or database name.
- Network/firewall restrictions between application and database.
- Database not running or temporarily unavailable.

### Resolutions

- Verify SUPABASE_DB_URL or the URL passed via `--url` to pgdump-export.js.
- Confirm host and port are reachable (e.g. `psql` or `nc` from the same environment).
- Check firewall or security group rules for the database endpoint.
- Ensure the database service is running and accepting connections.

## Authentication Issues

### Symptoms

- CLI stderr contains `fatal: password authentication failed for user`.
- Import RPC returns errors related to invalid credentials.

### Causes

- Invalid username or password in SUPABASE_DB_URL or connection form.
- Expired credentials.

### Resolutions

- Regenerate or verify database credentials in the Supabase dashboard.
- Update SUPABASE_DB_URL or import connection settings with the new password.
- Avoid copying trailing spaces or hidden characters when pasting passwords.

## Permission Problems

### Symptoms

- Export or import logs show `permission denied for schema`, `permission denied for table`, or `must be owner of`.
- During import, statements touching auth schema fail with permission errors.

### Causes

- Database user lacks privileges for certain schemas or tables.
- Attempting to run DDL against Supabase-managed schemas like auth.

### Resolutions

- For export:
  - Grant CONNECT and appropriate privileges on required schemas/tables to the export user.
  - Use a user with read-only access across public/auth/storage if a full backup is needed.
- For import:
  - Auth DDL is filtered out automatically; ensure the target project already has the standard auth schema.
  - Use a user with sufficient privileges to create/alter objects in public and other non-managed schemas.

## Disk Space Constraints

### Symptoms

- CLI stderr includes `No space left on device`.
- Dump file is incomplete or zero bytes.

### Causes

- Insufficient disk space on the host running pg_dump.

### Resolutions

- Free disk space on the filesystem hosting the backup directory.
- Change `--out-dir` in pgdump-export.js to a larger volume.
- Use compression or split dumps when exporting very large databases.

## Network Interruptions

### Symptoms

- Export or import processes terminate unexpectedly.
- Logs show references to terminated connections or signals.

### Causes

- Unstable network between application and database.
- Timeouts or killed processes due to resource limits.

### Resolutions

- Re-run the export or import from a more stable network environment.
- For import, consider smaller batch sizes in ImportOptions to reduce long-running transactions.
- Monitor system resource limits and adjust if the process is being killed by the OS.

## Schema Mismatches and Missing Columns

### Symptoms

- Import error: `column "<name>" of relation "<table>" does not exist`.

### Causes

- Target database schema is missing columns that exist in the dump.
- pg_dump file includes INSERT statements for columns not declared in CREATE TABLE blocks.

### Resolutions

- The importer automatically:
  - Parses CREATE TABLE and INSERT statements to infer required columns.
  - Adds missing columns with safe default types (`text` or `text[]`) before inserting data.
- If errors persist:
  - Verify that the target database is compatible with the source schema version.
  - Review logs for details on failed ALTER TABLE statements and adjust manually if needed.

## Foreign Key Violations

### Symptoms

- Import error: `violates foreign key constraint "<constraint_name>"`.
- Logs mention rolled-back data batches due to foreign key violations.

### Causes

- Child rows inserted before parent rows.
- Orphaned data in the dump or existing target database.

### Resolutions

- The importer:
  - Uses heuristic data reordering so parent tables are inserted before children.
  - Logs detailed information when foreign key violations occur and rolls back the batch if transactions are enabled.
- To resolve:
  - Check logs for the specific constraint and tables involved.
  - Ensure the dump contains all necessary parent rows.
  - If combining with pre-existing data, verify there are no conflicting constraints.

## Table Data Present in Dump but Missing After Import (e.g. public.accounts)

### Symptoms

- The dump file clearly contains data for a table (for example `public.accounts`), but after import the target database has zero rows for that table.
- The import completes without obvious errors in the UI.

### Likely Causes

- The data in the dump is wrapped in a guarded `DO $$` block such as:

  ```sql
  DO $$
  BEGIN
    IF to_regclass('public.accounts') IS NOT NULL THEN
      INSERT INTO "public"."accounts" ("id", ...) VALUES (...);
    ELSE
      RAISE NOTICE 'Skipping data for missing table %', 'public.accounts';
    END IF;
  END;
  $$;
  ```

  and the target database does not have a matching `public.accounts` table at import time.
- The dump was generated with data-only options or against a different schema version, so the `CREATE TABLE public.accounts` definition is missing or incompatible.
- The target project has not yet applied the schema migrations that create `public.accounts` (or the table was renamed or moved to another schema).

### How the Tools Behave

- The export tool intentionally wraps data in guard blocks using `to_regclass('<schema>.<table>')` to avoid hard failures when a table is missing.
- When the table does not exist, PostgreSQL emits a `NOTICE 'Skipping data for missing table %'` and **no rows are inserted**. This does not surface as an error in the import logs, so it can look like a silent data loss.
- The SQL parser records estimated row counts per table (including `INSERT` statements inside `DO $$` blocks), which you can use to compare expected vs. actual row counts.

### Resolutions

- Verify that the dump file contains both:
  - A `CREATE TABLE` statement for `public.accounts`.
  - Data statements (either plain `INSERT` or `DO $$` blocks) referencing `public.accounts`.
- Ensure the target database schema matches the source:
  - Apply the same migrations that created `public.accounts` in the source environment.
  - If you rely on the dump to create tables, confirm that the importer’s schema phase executed the `CREATE TABLE public.accounts` statement successfully.
- If the table was renamed or moved:
  - Adjust the dump file (or re-export) so that the schema and table name in the data section match the target table.
  - Alternatively, create a compatibility view or table in the target with the expected name `public.accounts` before running the import.

### Verification Steps

- Before import:
  - Use the SQL parser metadata (row counts by table) or a simple `grep`/editor search to confirm how many rows are expected for `public.accounts`.
  - Check that `CREATE TABLE public.accounts` exists in the dump or that the target schema provides an equivalent table.
- After import:
  - Run `SELECT COUNT(*) FROM public.accounts;` on the target database and compare with the expected row count from the dump.
  - Spot-check a few sample rows if possible.
  - If the count is zero, inspect the dump for guarded `DO $$` blocks and confirm that `public.accounts` actually exists in the target schema.

## On Conflict Import Options

### Overview

The pg_dump import wizard supports three conflict handling modes for INSERT statements:

- **Raise Error (default)**: Statements are executed as-is. Any unique or primary key conflicts will surface as errors and are handled according to the batch error settings.
- **Skip Row**: INSERT statements without an existing `ON CONFLICT` clause are rewritten to append `ON CONFLICT DO NOTHING`. This causes conflicting rows to be skipped without raising errors, while non-conflicting rows are inserted normally.
- **Update Existing**: INSERT statements without an existing `ON CONFLICT` clause are rewritten to use `ON CONFLICT (...) DO UPDATE SET ...` based on primary key metadata discovered from `information_schema.table_constraints`:
  - The conflict target is built from the table’s primary key columns.
  - All non-key columns in the INSERT column list are updated from the `EXCLUDED` row.
  - If all columns are part of the primary key, the importer falls back to `ON CONFLICT DO NOTHING` for that statement.
  - If no primary key metadata is available for a table, the corresponding INSERT statements are left unchanged.

### Additional Notes

- Existing `ON CONFLICT` clauses in the dump are preserved and never rewritten.
- Rewriting is applied only during the data phase of the import; schema, constraints, and other phases are unaffected.
- Import logs include a summary of how many INSERT statements were rewritten for conflict handling to aid troubleshooting.

## Auth Schema Limitations

### Symptoms

- Original errors like `permission denied for schema auth` when importing auth tables.

### Causes

- Attempting to run DDL against Supabase-managed auth schema during import.

### Resolutions

- The importer now:
  - Filters out auth DDL statements (`CREATE`, `ALTER`, `DROP` on auth.*) before execution.
  - Logs when auth schema statements are skipped.
- For full logical clones:
  - Rely on the target Supabase project’s built-in auth schema.
  - Import auth data only where the user has appropriate INSERT privileges.

## Syntax and Function Definition Issues

### Symptoms

- Validation warnings about unclosed dollar-quoted blocks or invalid function definitions.

### Causes

- Hand-edited SQL files or partial dumps with truncated function bodies.

### Resolutions

- During export, the system:
  - Runs validation to detect unclosed dollar-quoted blocks.
  - Attempts auto-repair in some cases and records warnings or errors in the export log.
- Before importing:
  - Review validation errors and warnings.
  - Fix function definitions manually if auto-repair cannot resolve the issues.

## Backup Integrity and Verification

### Practices

- After export:
  - Verify the dump file exists and has non-zero size.
  - Review the associated `.log` file for warnings and errors.
  - Optionally run a dry-run import against a non-production database.
- For critical environments:
  - Maintain regular backup schedules with timestamps.
  - Store backups in redundant storage and periodically test restore procedures.
