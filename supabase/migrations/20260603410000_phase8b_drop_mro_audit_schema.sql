-- Phase 8b — drop mro_audit schema.
--
-- Per master plan §1.4 + §7.4 Phase 8: drop mro_audit.*; rows fold
-- to core.audit_log.
--
-- Pre-drop audit (2026-06-03):
--   mro_audit.records: 0 rows
--   mro_audit.trails:  0 rows
--   No data to fold.
--   Existing shadow-write trigger (migration 20260528190000) never
--   fired because the tables stayed empty. core.audit_log already
--   carries 22 rows for the platform.
--
-- Code references: 4 documentation/metadata strings in
--   src/pages/api/v2/amro/anti-corruption-adapter.ts
--   src/pages/api/v2/amro/module-catalog-model.ts (×2)
--   src/pages/api/v2/amro/module-catalog.test.ts
-- All updated in this slice to point at core.audit_log instead.
--
-- Applied to prod 2026-06-03.

BEGIN;

DROP SCHEMA IF EXISTS mro_audit CASCADE;

COMMIT;
