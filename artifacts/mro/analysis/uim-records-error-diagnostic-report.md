# UIM Records Error Diagnostic Report

Date: `2026-04-04`  
Issue: Persistent `Unable to load records for this module`

## Root Cause Summary
- Primary root cause identified: `uim_form_records` storage table may be unavailable in target environment when migration `20260404212000_uim_form_records_crud.sql` is not applied.
- Secondary root cause possibility: tenant user lacks permission to access `uim_form_records` under RLS policies.

## Reproduction Steps (DEV)
1. Open any UIM route (`/dashboard/uim`, `/dashboard/uim/item-master`, etc.).
2. Observe record list load on initial render.
3. If migration is missing or permission is misconfigured, list request fails and client displays load error.

## API Contract Verification
- Endpoint: `GET /api/v2/uim/forms/:node?limit=:n&offset=:n`
- Supported nodes:
  - `overview`
  - `item-master`
  - `stock-ledger`
  - `reservations`
  - `issue-consume`
  - `restock`
  - `locations`
  - `analytics`
- Auth: request must pass existing platform auth middleware and `dashboards.view`.
- Pagination defaults: `limit=25`, `offset=0`.
- Successful schema:
  - `output.node_key`
  - `output.count`
  - `output.limit`
  - `output.offset`
  - `output.records[]`

## Defensive Handling Added
- Server-side:
  - Returns `503` + `UIM_FORM_STORAGE_NOT_READY` when table is missing.
  - Returns `403` + `UIM_FORM_STORAGE_PERMISSION_DENIED` on permission failures.
  - File: `src/pages/api/v2/uim/forms/_shared.ts`
- Client-side:
  - Added 3-attempt retry logic with backoff for list load.
  - Added status-aware user messaging for storage-not-ready, permission, and transient server failures.
  - Added destructive toast for load failures.
  - File: `src/modules/uim/forms/UimNodeForm.tsx`

## Database and Permission Checks
- Verify migration presence:
  - `supabase/migrations/20260404212000_uim_form_records_crud.sql`
- Verify RLS policies:
  - `uim_platform_admin_access`
  - `uim_tenant_scope_access`
- Verify tenant identity mapping:
  - `public.get_user_tenant_id(auth.uid())`

## Test Coverage Added
- Unit:
  - `src/services/uim/uimApi.test.ts` (headers + error handling)
- Integration:
  - `src/pages/api/v2/uim/forms/[node]/index.test.ts` now validates storage-not-ready path.

## Evidence Capture Checklist (attach externally)
- Browser console logs: `pending attachment`
- Network HAR: `pending attachment`
- Backend stack trace sample: `pending attachment`
- DEV success screenshot: `pending attachment`
- STAGING success screenshot: `pending attachment`
- PRODUCTION success screenshot: `pending attachment`
