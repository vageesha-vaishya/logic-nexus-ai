# Database Backup - Lovable Cloud (Supabase)

**Project ID:** pqptgpntbthrisnuwwzi  
**Export Date:** 2026-01-13  
**Database Version:** PostgreSQL 15

## Contents

This backup contains:

1. **01-enums.sql** - All custom ENUM types
2. **02-tables-schema.sql** - Table definitions (DDL)
3. **03-functions.sql** - All database functions
4. **04-rls-policies.sql** - Row Level Security policies
5. **05-indexes.sql** - Index definitions
6. **06-data-export-queries.sql** - SQL queries to export data
7. **edge-functions/** - Edge function source code

## How to Import

### 1. Create a fresh Supabase/PostgreSQL database

### 2. Run the SQL files in order:
```bash
psql -h your-host -U postgres -d your-db -f 01-enums.sql
psql -h your-host -U postgres -d your-db -f 02-tables-schema.sql
psql -h your-host -U postgres -d your-db -f 03-functions.sql
psql -h your-host -U postgres -d your-db -f 04-rls-policies.sql
psql -h your-host -U postgres -d your-db -f 05-indexes.sql
```

### 3. Export data from source using pg_dump:
```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.pqptgpntbthrisnuwwzi.supabase.co:5432/postgres" \
  --data-only --no-owner --no-privileges \
  -f data-backup.sql
```

### 4. Import data to target:
```bash
psql -h your-host -U postgres -d your-db -f data-backup.sql
```

## Connection String Format

```
postgresql://postgres:[YOUR-PASSWORD]@db.pqptgpntbthrisnuwwzi.supabase.co:5432/postgres
```

Get your password from **Backend Settings → Database**.

## Notes

- RLS is enabled on all tables
- Edge functions require Deno runtime (Supabase Edge Functions)
- Some functions reference `auth.uid()` which is Supabase-specific
