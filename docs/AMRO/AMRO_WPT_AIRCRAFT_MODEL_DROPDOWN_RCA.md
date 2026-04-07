# AMRO WPT Aircraft Model Dropdown RCA and Resolution

## Document Control
- Version: `v1.0`
- Status: `Resolved`
- Owner: `AMRO FE + Platform API`
- Last Updated: `2026-04-07`

## Problem Summary
In `AMRO -> Work Package Templates`, Aircraft Model dropdown intermittently showed a single fixed value (or UUID fallback) instead of full model inventory.

## Root Cause
The option list was populated through multiple inconsistent paths:
- Adapter path queried models with one scope behavior.
- Legacy WPT section queried models with another scope behavior.
- Generic master-data API applied franchise filters that could suppress model inventory under certain contexts.

This caused partial/empty option sets and forced UI fallback to a synthetic "current" value.

## Scope Rules Applied (project_rules.md alignment)
- Platform admin: use platform/admin scope (tenant filter only when tenant context is present).
- Tenant user: use tenant scope.
- Franchise user with franchise id: use franchise scope with tenant-global (`franchise_id is null`) inclusion.
- Franchise id unavailable: fallback to tenant scope.

## Resolution Strategy
Implemented a dedicated API endpoint as the single source of truth for WPT model options:
- `GET /api/v2/amro/work-package-templates/model-options`

Both runtime paths now consume this endpoint:
- `AmroWorkPackageTemplateAdapter`
- `WorkPackageTemplateCreateSection`

## Implementation Details
- Added endpoint:
  - `src/pages/api/v2/amro/work-package-templates/model-options.ts`
- Added:
  - authentication and AMRO domain access checks
  - permission checks
  - deterministic scope logic (platform/tenant/franchise + fallback)
  - structured logging for query failures and scope issues
- Updated UI loaders to fetch from this endpoint only.
- Removed reliance on conflicting local query paths for model inventory.

## Error Handling and Logging
- Returns `400` for missing tenant scope in non-platform contexts.
- Returns `500` with correlation id for query failures.
- Writes structured logs via `logger` for:
  - scope errors
  - query errors
  - unhandled exceptions

## Validation Notes
- Lint checks passed on updated API and UI files.
- Targeted WPT adapter and page tests passed.

## Backward Compatibility
- No payload changes to WPT save/update contracts.
- Feature-flag behavior and adapter fallback path remain unchanged.
