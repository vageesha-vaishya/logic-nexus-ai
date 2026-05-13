# Aircraft Template Dropdown Data Source Fix

## Issue
- The `Create Aircraft` dialog `* Aircraft Template` dropdown showed entries that looked like work-order templates (for example `WP-...` / `WT-...`).
- Root cause was fallback seeding logic in the UI layer that imported records from `work_order_templates` into `aircraft_template` when no aircraft templates were found.

## What Changed
- Removed cross-entity seeding path from `AmroSettingsMasterDataPage` that read `work_order_templates` to populate `aircraft_template`.
- Kept dropdown source strictly scoped to `aircraft_template` only (direct scoped DB read + API fallback to `/api/v2/amro/master-data/aircraft_template`).
- Added aircraft-template eligibility validation:
  - Reject records with work-order style prefixes (`WP...` / `WT...`).
  - Reject records that do not have aircraft model linkage (`assembly_models` or `model_json.assembly_model_id`).
  - Reject records marked inactive.
- Added centralized filtering in `listAircraftTemplates(...)` so list consumers also inherit the same safety gate.

## Files Updated
- `src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx`
- `src/features/module-amro/settings/pages/amro-settings-master-data/services.ts`
- `src/features/module-amro/settings/pages/amro-settings-master-data/services.test.ts`

## Regression Guardrails
- Unit tests now verify:
  - only `aircraft_template` endpoint is used;
  - work-order style template names are excluded;
  - aircraft template records require valid aircraft linkage fields.

## Environment Validation
- Development: validated via targeted test and typecheck.
- Staging: requires deployment and manual verification against staging data set.

