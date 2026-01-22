# Database Restore Troubleshooting Guide

## Overview
The Database Restore functionality allows users to restore data from `JSON` backups (client-side restore) or `ZIP` SQL exports (server-side batch restore).

## Common Issues

### 1. "ZIP restore completed with errors. Executed 0 statements, X failed."

This error indicates that the SQL `INSERT` statements were rejected by the server.

**Possible Causes:**

*   **Schema Mismatch:** The target database does not contain the tables being restored, or the schema structure (columns, types) is different.
    *   *Note:* The ZIP restore process is **Data-Only**. It skips DDL files (`001_schemas.sql`, `002_tables.sql`, etc.). You must ensure the schema exists before restoring data.
    *   *Solution:* Run the DDL SQL files manually using a migration tool or SQL editor before restoring the ZIP.
*   **Permissions:** The user running the restore does not have `INSERT` permissions on the `public` schema.
    *   *Solution:* Ensure the user has the `admin` role or explicit write permissions.
*   **RPC Restrictions:** The `execute_insert_batch` RPC is strict. It requires:
    *   `INSERT INTO "public"."table_name"` format (quoted schema and identifiers).
    *   Only `public` schema is allowed by default for security.
    *   *Solution:* If restoring to a different schema, you must use a custom migration script.

### 2. "Automated restore from .zip is not available"

This message appears if the restore logic fails to initialize or if the file structure is invalid.

*   *Solution:* Ensure the ZIP file contains `004_data_*.sql` files in the root or expected folder structure.

## Verification & Diagnostics

### Enhanced Error Logging
We have introduced detailed error reporting in the restore process.
*   **Toast Message:** The failure notification now displays the **first specific error message** returned by the database (e.g., `relation "public.users" does not exist`).
*   **Console Logs:** Open the browser developer console (F12) to see full details of failed batches, including the raw SQL statements and error codes.

### Checksum Validation
The export process generates a `manifest.json` containing row counts and data checksums.
*   **Pre-flight Check:** The restore tool automatically verifies if the `schema_signature` in the manifest matches the current database schema.
*   **Warnings:** If a mismatch is detected, a warning is displayed before the restore begins. **Do not ignore this warning.**

## Manual Verification Steps

1.  **Extract the ZIP file.**
2.  **Check `manifest.json`:** Verify the `rowCount` for each table.
3.  **Check `validation_warnings.txt`:** If present, this file lists issues found during the *export*.
4.  **Test a Single File:** Try executing one of the `004_data_*.sql` files manually in the Supabase SQL Editor to see the exact error.

## RPC Reference
The restore uses `execute_insert_batch` (defined in `migrations/20260114_execute_insert_batch.sql`).
*   **Security:** `SECURITY DEFINER` (runs with owner privileges).
*   **Access:** Granted to `authenticated` users, but internally checks `is_platform_admin` or `is_tenant_admin`.
