-- Phase 8a — drop public.aircraft_legacy_backup.
--
-- Source of truth: master plan §1.4 explicitly lists this as a
-- Phase 8 drop. Pre-drop audit (2026-06-03):
--   400 rows, all backed_up_at = 2026-04-11 (53-day window passed)
--   Snapshot is locked in time — no rows added since
--   3 orphan_backups (aircraft deleted from primary since backup)
--   0 active code references (only the original migration that
--     created it references the table; supabase types.ts auto-gen
--     reflects schema state)
--
-- The original migration (20260411113000_amro_aircraft_restructure_assembly_models.sql)
-- created this table as a rollback safety net for the aircraft
-- restructure. 53 days have passed without a rollback; the
-- restructure is permanent.
--
-- Applied to prod 2026-06-03.

BEGIN;

DROP TABLE IF EXISTS public.aircraft_legacy_backup;

COMMIT;
