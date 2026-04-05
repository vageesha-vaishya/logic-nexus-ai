# UIM-AMRO Deccan Inventory Visibility - Root Cause and Resolution

## Incident Summary
- Symptom: AMRO-context inventory data not visible in UIM for Deccan tenant.
- Impact: Integration validation blocked for Deccan-specific AMRO workflows.

## Root Cause Analysis
1. Tenant targeting issue in seed logic:
   - Initial seed path selected the first tenant in database, not explicitly Deccan.
   - Result: Seeded rows may have been loaded under a different tenant.
2. Access scope issue:
   - API access context depends on `user_roles` and `user_preferences`.
   - If Deccan role mapping is absent, scoped API requests resolve non-Deccan or empty scope.
3. Schema variance risk:
   - Optional UIM tables (`uim_commands`) may not exist in all remote environments.
   - Projection data was seeded into the wrong relation name in earlier scripts (`uim_projection_snapshots` instead of `uim_inventory_projection_snapshots`), causing UI projection modules to appear empty.
   - Migration needed compatibility guards to avoid hard failures.

## Implemented Resolution
- Updated migration `20260406142000_uim_amro_integration_seed.sql` to:
  - target/create Deccan tenant explicitly (`slug/name = deccan`)
  - create franchise if absent
  - assign actor access context (`profiles`, `user_roles`, `user_preferences`) when available
  - keep optional table writes behind `to_regclass(...)` checks
- Added Deccan-specific idempotent seed script:
  - `scripts/sql/seed_uim_amro_deccan.sql`
- Added Deccan diagnostics and verification reports:
  - `scripts/sql/diagnose_uim_amro_deccan_visibility.sql`
  - `scripts/sql/verify_uim_amro_deccan_seed.sql`

## Validation Procedure
1. `supabase db push`
2. `psql "$DATABASE_URL" -f scripts/sql/seed_uim_amro_deccan.sql`
3. `psql "$DATABASE_URL" -f scripts/sql/diagnose_uim_amro_deccan_visibility.sql`
4. `psql "$DATABASE_URL" -f scripts/sql/verify_uim_amro_deccan_seed.sql`

## Expected Outcome
- Deccan tenant has seeded AMRO inventory footprints and sync events.
- Deccan role/preference scope exists for API access resolution.
- UIM/AMRO integration endpoints return Deccan data when called with Deccan tenant context headers.
