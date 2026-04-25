# AMRO Table Rename Impact Analysis

## Scope
- Rename: `work_package_templates` -> `work_order_templates`
- Date: `2026-04-25`
- Repository: `logic-nexus-ai`

## Discovery Summary
- Total legacy-token matches discovered in full-repo sweep: `376` across `88` files.
- Remaining legacy-token matches after implementation pass in source directories:
- `src`: `65` matches across `12` files.
- `services`: `9` matches across `3` files.
- `tests`: `0` matches in top-level `tests` directory (excluding `src`/`services` embedded tests).
- Documentation markdown matches: `71` across `23` files.

## High-Impact Areas Updated
- Database migration + rollback for physical rename and compatibility view.
- AMRO API routes and master-data entity normalization to canonical `work_order_templates`.
- Next.js API handlers and persistence layer table references.
- Frontend runtime API calls in template/catalog/settings flows.
- Integration and unit tests in AMRO API + Next.js API paths.

## Controlled Compatibility Kept
- Legacy route/entity compatibility is still supported in selected gateway and master-data normalization paths.
- Legacy naming remains in selected settings-page/internal entity maps and historical docs to reduce immediate UI workflow churn.
- Legacy naming remains in historical migrations and rollback scripts where it represents past schema state.

## Database Change Artifacts
- Migration: `supabase/migrations/20260425110000_amro_rename_work_package_templates_to_work_order_templates.sql`
- Rollback: `supabase/rollback/20260425110000_amro_rename_work_package_templates_to_work_order_templates_down.sql`

## Validation Notes
- IDE diagnostics were used for edited-file validation and critical type errors were resolved.
- Shell command execution in this session remained unreliable due terminal wrapper failure (`trae-sandbox: command not found: except`), so full command-line test runs were not completed here.
