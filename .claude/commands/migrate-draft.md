# .claude/commands/migrate-draft.md

Draft a database migration for: $ARGUMENTS

BEFORE writing the migration:
1. Read existing migrations to understand naming convention and style
2. Check the current schema for the affected tables
3. Identify any foreign key constraints or indexes involved

Generate:
1. UP migration (the change)
2. DOWN migration (exact rollback)
3. Data migration script (if existing data needs transformation)
4. Estimated execution time for production (based on table size)

Safety checklist:
- [ ] Migration is idempotent (safe to run twice)
- [ ] Rollback restores exact previous state
- [ ] No data loss in either direction
- [ ] Backward compatible with current application code
- [ ] Index additions use CONCURRENTLY (if PostgreSQL)