# Migration Analysis & Strategy
## Technical Constraints & Compatibility Issues

### 1. Database Connectivity & Access
- **Constraint**: Direct connection to source/target databases may be restricted by firewalls or lack of superuser privileges (common in managed services like Supabase).
- **Impact**: Traditional tools like `pg_dump` might fail on specific schemas (`auth`, `storage`, `extensions`) or require privileges not available to the `postgres` user.
- **Resolution**: Use a segmented migration approach:
  - `public` schema: `pg_dump` (schema + data).
  - `auth` schema: Specialized extraction and insertion (preserving passwords/hashes).
  - `storage` schema: API-based file migration (metadata + blobs).

### 2. Schema Compatibility
- **Constraint**: Target Supabase instance comes with pre-installed extensions and schemas (`auth`, `storage`, `realtime`) that might conflict with a full dump.
- **Impact**: Restoring a full dump often fails with "schema already exists" or permission errors.
- **Resolution**: Exclude system schemas (`auth`, `storage`, `realtime`, `extensions`) from the main dump and migrate `auth` data selectively.

### 3. Data Integrity & Types
- **Constraint**: CSV-based migration (current approach) is prone to type loss (e.g., JSONB vs Text, NULL vs Empty String, Timestamp formats).
- **Impact**: Import failures or silent data corruption.
- **Resolution**: Switch to **Direct Database-to-Database** migration using binary streams (`pg_dump -Fc`) or a strictly typed application-level syncer (Node.js/Python) that handles type conversion.

### 4. Referential Integrity
- **Constraint**: Circular dependencies or specific table ordering requirements.
- **Impact**: Insert failures during data migration.
- **Resolution**: Use `pg_dump --disable-triggers` (if superuser) or topological sort for application-level sync. For `public` schema, `pg_dump` handles ordering automatically. The in-app pg_dump export panel now performs a pre-export foreign key validation using a catalog-driven helper function and refuses to generate an export when orphaned references are present, logging the exact constraints and tables involved.

### 5. Authentication & Users
- **Constraint**: `auth.users` contains sensitive hashes. Migrating them requires bypassing standard Supabase Auth API limits or direct DB access.
- **Impact**: Users might lose access if password hashes aren't preserved correctly.
- **Resolution**: Use a dedicated `auth_migrate` script that inserts directly into `auth.users` (requires `service_role` or database connection) preserving `encrypted_password`.

## Migration Strategy

### 1. Pipeline Architecture
We will implement a **Direct Migration Pipeline** with three distinct phases:

1.  **Schema Migration**: 
    - Source: Git-based Migrations (`supabase/migrations`) OR Source DB Schema Dump (`pg_dump --schema-only`).
    - Tool: `supabase db push` (preferred for ongoing) or `psql` (for initial clone).
2.  **Data Migration (Public)**:
    - Tool: `pg_dump --data-only --format=custom` piped to `pg_restore`.
    - Fallback: Node.js stream-based sync for complex transformations.
3.  **System Migration (Auth/Storage)**:
    - Auth: SQL-based export/import of `auth.users` and `auth.identities`.
    - Storage: Script to iterate buckets and copy files.

### 2. Supported Objects
- **Tables/Views/Procs**: Handled by Schema Migration.
- **Triggers/Constraints**: Handled by Schema Migration.
- **Indexes/Sequences**: Handled by Schema Migration (sequences synchronized after data load).
- **Roles/Permissions**: Handled by explicit SQL scripts (Postgres roles are instance-specific; Application roles in `public` tables are just data).

## Permanent Solution Components

1.  `migrate-direct.sh`: Master script to orchestrate the process.
2.  `sync-auth.sql`: SQL script/function to export/import users.
3.  `validate-migration.ts`: Script to compare row counts and checksums.
4.  `rollback.sh`: Procedure to clean target if migration fails.

## Continuous Synchronization
For ongoing changes (Trae Dev -> Supabase Cloud):
- **Schema**: Use Supabase CLI (`supabase migration new`, `supabase db push`).
- **Data**: Do not migrate data continuously. Use Seed Scripts for reference data. Production data should be isolated.
