# AMRO Database Changelog

## 2026-04-30 - Drop `public.tasks.is_configured`
- **Migration:** `supabase/migrations/20260430124500_drop_tasks_is_configured.sql`
- **Reason for change:** `is_configured` duplicated task lifecycle semantics already represented by `public.tasks.status`, and no runtime application code references the column anymore.
- **Impact summary:** Removes `is_configured` from `public.tasks`; all remaining task columns and constraints remain unchanged.
- **Dependency verification:** Repository scan confirms no current app code, views, triggers, or SQL functions reference `is_configured`.
- **Data safety notes:** Only `is_configured` is removed; all other task data is preserved in place.
- **Rollback instructions:**
- Run the rollback section in `20260430124500_drop_tasks_is_configured.sql` to re-add `is_configured` as `boolean NOT NULL DEFAULT false`.
- Re-apply any downstream compatibility code that expects the column.
