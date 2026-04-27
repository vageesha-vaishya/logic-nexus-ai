# AMRO Module Retrieval Audit — 2026-03-24

## 1) Executive Summary

- Primary incident: AMRO Overview dashboard intermittently failed to load Supabase-backed data and showed fallback/empty results.
- Highest-impact blockers found in the retrieval pipeline:
  - missing/invalid Authorization propagation between UI and API layers;
  - tenant scope incompatibility in development when non-UUID tenant identifiers are used;
  - incomplete test doubles after query-chain expansion (`neq`, `limit`) causing false-negative failures in AMRO API service tests.
- Current status after remediation:
  - AMRO API service auth middleware supports controlled development fallback via `x-user-id` + `x-tenant-id` when token is absent in non-production;
  - AMRO API `/api/v2/amro/overview-kpi` applies safe dev fallback for non-UUID `tenant_id` query failure paths;
  - AMRO API test suite passes (8/8), including auth middleware and work orders service suites;
  - lint and build/typecheck complete successfully for `services/amro-api` (warnings only, no errors).

## 2) Audit Scope

- Frontend overview dashboard runtime:
  - `src/features/module-amro/pages/AmroHubVerticalPage.tsx`
  - `src/features/module-amro/hooks/useAmroOverviewKpi.ts`
  - `src/integrations/supabase/client.ts`
- Next API route runtime:
  - `src/pages/api/v2/amro/overview-kpi.ts`
  - `src/pages/api/_utils/http.ts`
  - `src/pages/api/_utils/supabaseAdmin.ts`
- AMRO API service runtime:
  - `services/amro-api/src/middleware/auth.middleware.ts`
  - `services/amro-api/src/app.ts`
- Validation surfaces:
  - `src/features/module-amro/hooks/useAmroOverviewKpi.test.tsx`
  - `src/pages/api/v2/amro/overview-kpi.test.ts`
  - `services/amro-api/tests/auth.middleware.test.ts`
  - `services/amro-api/tests/work-orders.service.test.ts`

## 3) End-to-End Data Retrieval Walkthrough

### 3.1 UI Entry and Scope Construction

1. `AmroHubVerticalPage` resolves `overviewScope` from CRM context (`tenantId`, `franchiseId`, `userId`) and effective domain code.
2. `useAmroOverviewKpi(overviewScope)` is initialized with that scope.
3. Dashboard request payload is built from UI filters:
   - `dateRange`, `regionIds`, `stationIds`, `fleetIds`, `plannerId`, `engineerId`, pagination.

### 3.2 Frontend API Request Path

1. `requestOverview` reads session token via `supabase.auth.getSession()`.
2. If missing, it attempts `supabase.auth.refreshSession()`.
3. Request headers include:
   - `Authorization: Bearer <token>` when token exists;
   - `x-tenant-id`, `x-franchise-id`, `x-user-id`, `x-domain-id` from scope.
4. If response is `401` with “Missing or malformed Authorization header”, it retries with `access_token` query parameter.
5. If response is OK but payload has no `output`, it retries once for transient empty JSON paths.
6. Network/auth failures trigger temporary cooldown fallback builders:
   - `buildFallbackDashboard`;
   - `buildFallbackTrends`.

### 3.3 API Route Auth and Access Path

1. `authenticateRequest` validates bearer token and supports loopback/non-production fallback with `x-user-id`.
2. `resolveAndApplyAccessContext` enforces tenant/franchise scope and role-derived boundaries.
3. `enforceAmroDomainAccess` ensures domain assignment/subscription policy.
4. Interface switching in `overview-kpi.ts` routes:
   - `load-kpi-dashboard`;
   - `load-operational-trends`;
   - `export-kpi-snapshot`.

### 3.4 Supabase Query Path

1. `fetchScopedRows` attempts primary table then fallback candidates.
2. Normal path applies `.eq('tenant_id', tenantId)`.
3. Development-only fallback handles non-UUID tenant mismatch errors by retrying without tenant filter and records a `data_issues` note.
4. Aggregation computes:
   - KPI cards;
   - risk heatmap;
   - anomaly flags;
   - work package overview;
   - materials/compliance/integration sections;
   - trend payload and pagination.

## 4) Line-Level Analysis of Critical Failure Zones

### 4.1 Frontend Token and Header Handling

- File: `src/features/module-amro/hooks/useAmroOverviewKpi.ts`
  - Session token read and refresh: lines 323–328.
  - Production token hard requirement (non-loopback): lines 331–333.
  - Header assembly (`Authorization`, scope headers): lines 335–352.
  - Auth-header rejection retry with `access_token`: lines 392–401.
  - Empty payload retry and strict output guard: lines 402–413.

Failure mode:
- token absent + production runtime => hard Unauthorized.
- API/gateway stripping `Authorization` => first request fails, query-token retry may succeed.

### 4.2 UI Scope Binding and Filter-to-Request Mapping

- File: `src/features/module-amro/pages/AmroHubVerticalPage.tsx`
  - Scope construction from CRM/domain context: lines 621–629.
  - Hook bind: line 645.
  - Dashboard request filter mapping: lines 757–767.
  - Trends request mapping: lines 768–774.
  - Scope refresh workflow: lines 775–787 and 822–833.

Failure mode:
- missing `context.tenantId` suppresses meaningful scoped retrieval and can force fallback behavior.

### 4.3 Next API Authentication and Fallback Path

- File: `src/pages/api/_utils/http.ts`
  - `authenticateRequest`: lines 545–583.
  - dev/loopback fallback acceptance path: lines 551–558.

Failure mode:
- no bearer token and no fallback user header => Unauthorized.
- stale/invalid token => Supabase `getUser` rejection => Unauthorized.

### 4.4 Supabase Admin Client Configuration

- File: `src/pages/api/_utils/supabaseAdmin.ts`
  - env resolution: lines 11–13.
  - hard fail on missing env: lines 14–16.

Failure mode:
- missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` causes immediate API failure.

### 4.5 AMRO API Service Auth Context

- File: `services/amro-api/src/middleware/auth.middleware.ts`
  - fallback header extraction: lines 67–78.
  - no-token development fallback (requires `x-user-id` + `x-tenant-id`): lines 82–93.
  - token validation and role/profile/preferences/franchise tenant resolution: lines 103–217.
  - no-tenant hard failure: lines 218–224.

Failure mode:
- user has valid token but no tenant assignment across all lookup sources.

### 4.6 AMRO API Service Scoped Row Fetching

- File: `services/amro-api/src/app.ts`
  - scoped query helper with table fallbacks: lines 148–205.
  - invalid UUID detection path: lines 161–163.
  - dev non-UUID retry path and `data_issues` annotation: lines 177–185.
  - overview endpoint orchestration and aggregations: lines 424 onward.

Failure mode:
- tenant identifiers that are not UUID in dev schema cause Postgres type errors unless fallback path is active.

## 5) Supabase/Environment Configuration Audit

### 5.1 Frontend Client Env Inputs

- `src/integrations/supabase/client.ts`:
  - URL precedence: `VITE_SUPABASE_URL` → runtime env mirrors.
  - key precedence: `VITE_SUPABASE_PUBLISHABLE_KEY`/`VITE_SUPABASE_ANON_KEY` → runtime env mirrors.
  - if missing, fallback to invalid placeholder URL/key and logs configuration error.

Risk:
- silent runtime against placeholder values produces auth/data failures that look like network errors.

### 5.2 API Admin Client Env Inputs

- `src/pages/api/_utils/supabaseAdmin.ts`:
  - requires service role key and URL, no fallback placeholder.

Risk:
- deployment/environment drift immediately breaks API retrieval.

### 5.3 Service API Env Inputs

- `services/amro-api/.env.example` and service runtime:
  - supports `AMRO_SUPABASE_URL`/`AMRO_SUPABASE_SERVICE_ROLE_KEY` with shared fallbacks.

Risk:
- mismatch between web/API/service Supabase targets creates split-brain reads.

## 6) Full AMRO File Inventory (Audited Set)

Total files inventoried: 106

### 6.1 `services/amro-api/src` (13)

1. `services/amro-api/src/app.ts`
2. `services/amro-api/src/events/amro-events.producer.ts`
3. `services/amro-api/src/events/amro-events.types.ts`
4. `services/amro-api/src/index.ts`
5. `services/amro-api/src/instrumentation/amro-tracing.ts`
6. `services/amro-api/src/instrumentation/tracer-provider.ts`
7. `services/amro-api/src/middleware/auth.middleware.ts`
8. `services/amro-api/src/realtime/work-orders-stream.ts`
9. `services/amro-api/src/routes/work-orders.routes.ts`
10. `services/amro-api/src/services/work-orders.service.ts`
11. `services/amro-api/src/types/amro.types.ts`
12. `services/amro-api/src/utils/asyncHandler.ts`
13. `services/amro-api/src/utils/logger.ts`

### 6.2 `src/features/module-amro` (11)

1. `src/features/module-amro/components/AmroOwnedWorkspace.test.tsx`
2. `src/features/module-amro/components/AmroOwnedWorkspace.tsx`
3. `src/features/module-amro/hooks/useAmroOverviewKpi.test.tsx`
4. `src/features/module-amro/hooks/useAmroOverviewKpi.ts`
5. `src/features/module-amro/hooks/useAmroWorkspaceState.test.tsx`
6. `src/features/module-amro/hooks/useAmroWorkspaceState.ts`
7. `src/features/module-amro/index.ts`
8. `src/features/module-amro/pages/AmroHubVerticalPage.test.tsx`
9. `src/features/module-amro/pages/AmroHubVerticalPage.tsx`
10. `src/features/module-amro/workspace/amroWorkspaceModel.test.ts`
11. `src/features/module-amro/workspace/amroWorkspaceModel.ts`

### 6.3 `src/pages/api/v2/amro` (82)

1. `src/pages/api/v2/amro/anti-corruption-adapter.test.ts`
2. `src/pages/api/v2/amro/anti-corruption-adapter.ts`
3. `src/pages/api/v2/amro/audit-ledger-cutover.test.ts`
4. `src/pages/api/v2/amro/audit-ledger-cutover.ts`
5. `src/pages/api/v2/amro/audit-ledger-replay.test.ts`
6. `src/pages/api/v2/amro/audit-ledger-replay.ts`
7. `src/pages/api/v2/amro/audit-ledger.test.ts`
8. `src/pages/api/v2/amro/audit-ledger.ts`
9. `src/pages/api/v2/amro/audit/replay.test.ts`
10. `src/pages/api/v2/amro/audit/replay.ts`
11. `src/pages/api/v2/amro/certification.test.ts`
12. `src/pages/api/v2/amro/certification.ts`
13. `src/pages/api/v2/amro/certifications/actions.test.ts`
14. `src/pages/api/v2/amro/certifications/actions.ts`
15. `src/pages/api/v2/amro/certifications/validate.test.ts`
16. `src/pages/api/v2/amro/certifications/validate.ts`
17. `src/pages/api/v2/amro/compliance-gates.test.ts`
18. `src/pages/api/v2/amro/compliance-gates.ts`
19. `src/pages/api/v2/amro/compliance/gates/evaluate.test.ts`
20. `src/pages/api/v2/amro/compliance/gates/evaluate.ts`
21. `src/pages/api/v2/amro/compliance/obligations.test.ts`
22. `src/pages/api/v2/amro/compliance/obligations.ts`
23. `src/pages/api/v2/amro/contract-artifact-handler.test.ts`
24. `src/pages/api/v2/amro/contract-artifact-handler.ts`
25. `src/pages/api/v2/amro/contracts/amro-subgraph.graphql`
26. `src/pages/api/v2/amro/contracts/amro-subgraph.ts`
27. `src/pages/api/v2/amro/contracts/amro-v1.proto`
28. `src/pages/api/v2/amro/contracts/amro-v1.ts`
29. `src/pages/api/v2/amro/contracts/asyncapi-2.6.ts`
30. `src/pages/api/v2/amro/contracts/asyncapi-2.6.yaml`
31. `src/pages/api/v2/amro/contracts/contract-endpoints.test.ts`
32. `src/pages/api/v2/amro/contracts/openapi-3.1.ts`
33. `src/pages/api/v2/amro/contracts/openapi-3.1.yaml`
34. `src/pages/api/v2/amro/forecast-reliability.test.ts`
35. `src/pages/api/v2/amro/forecast-reliability.ts`
36. `src/pages/api/v2/amro/forecast/recommendations.test.ts`
37. `src/pages/api/v2/amro/forecast/recommendations.ts`
38. `src/pages/api/v2/amro/health.test.ts`
39. `src/pages/api/v2/amro/health.ts`
40. `src/pages/api/v2/amro/integration-contracts.test.ts`
41. `src/pages/api/v2/amro/integration-contracts.ts`
42. `src/pages/api/v2/amro/integration-hub.test.ts`
43. `src/pages/api/v2/amro/integration-hub.ts`
44. `src/pages/api/v2/amro/inventory/availability.test.ts`
45. `src/pages/api/v2/amro/inventory/availability.ts`
46. `src/pages/api/v2/amro/inventory/reservations.test.ts`
47. `src/pages/api/v2/amro/inventory/reservations.ts`
48. `src/pages/api/v2/amro/migration-dependency-map.test.ts`
49. `src/pages/api/v2/amro/migration-dependency-map.ts`
50. `src/pages/api/v2/amro/migration-plan.test.ts`
51. `src/pages/api/v2/amro/migration-plan.ts`
52. `src/pages/api/v2/amro/module-catalog-model.ts`
53. `src/pages/api/v2/amro/module-catalog.test.ts`
54. `src/pages/api/v2/amro/module-catalog.ts`
55. `src/pages/api/v2/amro/overview-kpi.test.ts`
56. `src/pages/api/v2/amro/overview-kpi.ts`
57. `src/pages/api/v2/amro/phase-1-core-workflows.test.ts`
58. `src/pages/api/v2/amro/phase-1-core-workflows.ts`
59. `src/pages/api/v2/amro/phase-1-readiness.test.ts`
60. `src/pages/api/v2/amro/phase-1-readiness.ts`
61. `src/pages/api/v2/amro/phase-plan-model.test.ts`
62. `src/pages/api/v2/amro/phase-plan-model.ts`
63. `src/pages/api/v2/amro/phase-plan.test.ts`
64. `src/pages/api/v2/amro/phase-plan.ts`
65. `src/pages/api/v2/amro/reconciliation-queue.test.ts`
66. `src/pages/api/v2/amro/reconciliation-queue.ts`
67. `src/pages/api/v2/amro/schedules/index.test.ts`
68. `src/pages/api/v2/amro/schedules/index.ts`
69. `src/pages/api/v2/amro/schedules/replan.test.ts`
70. `src/pages/api/v2/amro/schedules/replan.ts`
71. `src/pages/api/v2/amro/screen-inventory-model.ts`
72. `src/pages/api/v2/amro/screen-inventory.test.ts`
73. `src/pages/api/v2/amro/screen-inventory.ts`
74. `src/pages/api/v2/amro/tasks.test.ts`
75. `src/pages/api/v2/amro/tasks.ts`
76. `src/pages/api/v2/amro/tasks/[id]/evidence.test.ts`
77. `src/pages/api/v2/amro/tasks/[id]/evidence.ts`
78. `src/pages/api/v2/amro/work-orders.test.ts`
79. `src/pages/api/v2/amro/work-orders.ts`
80. `src/pages/api/v2/amro/work-orders/[id].test.ts`
81. `src/pages/api/v2/amro/work-orders/[id].ts`
82. `src/pages/api/v2/amro/work-orders/[id]/transitions.ts`

## 7) Root Cause Matrix

1. **Auth header mismatch during overview requests**
   - Symptom: `401 Missing or malformed Authorization header`.
   - Impact: Dashboard and trends call fail, UI enters fallback.
   - Detection: API response payload error text + browser network traces.

2. **Non-UUID tenant in development data**
   - Symptom: Postgres `invalid input syntax for type uuid`.
   - Impact: scoped table fetch fails, cards remain empty.
   - Detection: `data_issues` includes tenant scope fallback note.

3. **Tenant context gaps in auth middleware**
   - Symptom: `NO_TENANT_ASSIGNMENT` for valid users missing profile/roles mappings.
   - Impact: API blocks retrieval.
   - Detection: middleware response code + logs.

4. **Environment misconfiguration across layers**
   - Symptom: client attempts invalid URL or server throws missing key error.
   - Impact: all retrieval paths fail.
   - Detection: startup errors + network failures.

5. **Test harness drift from production query chain**
   - Symptom: failing service tests (`neq is not a function`) after service query changes.
   - Impact: false regressions mask real defects.
   - Detection: Jest failure stack in `work-orders.service.test.ts`.

## 8) Remediation Actions Applied

1. Updated AMRO API auth tests to match Jest runtime and current middleware behavior:
   - `services/amro-api/tests/auth.middleware.test.ts`
   - replaced `vitest` runtime helpers with `jest` equivalents.

2. Updated work orders service test query builder to support expanded query chain:
   - `services/amro-api/tests/work-orders.service.test.ts`
   - added `neq` and `limit` chain methods;
   - added aircraft lookup queued result to satisfy `resolveValidAircraftId`.

3. Verified previous production-path fixes remain effective:
   - dev fallback in middleware and service for local non-token/non-UUID scenarios;
   - scoped retrieval and `data_issues` instrumentation in overview endpoint.

## 9) Verification Evidence

- Service test suite:
  - command: `npx jest --runInBand`
  - result: **8 passed, 0 failed**; **102 tests passed**.
- Service lint:
  - command: `npm run lint`
  - result: **0 errors**, warnings only.
- Service typecheck/build:
  - command: `npm run build`
  - result: **success**.
- Frontend/API AMRO targeted tests:
  - command: `npx vitest run src/features/module-amro/hooks/useAmroOverviewKpi.test.tsx src/pages/api/v2/amro/overview-kpi.test.ts`
  - result: **2 files passed**, **31 tests passed**, **0 failed**.
- AMRO suite regression check:
  - command: `npm run test:amro`
  - result: **2 files passed**, **2 files skipped**, **8 tests passed**, **0 failed**.
- Workspace lint:
  - command: `npm run lint`
  - result: **success**.
- Workspace typecheck:
  - command: `npm run typecheck`
  - result: **success**.

## 10) Troubleshooting Guide (Actionable)

1. **Dashboard shows fallback values**
   - Check browser network call to `/api/v2/amro/overview-kpi`.
   - If 401: verify session token exists; validate `Authorization` header.
   - If local dev: ensure `x-user-id` and `x-tenant-id` headers are present where fallback is expected.

2. **`invalid input syntax for type uuid` appears**
   - Confirm tenant IDs in seed data are UUID in production.
   - In dev only, confirm fallback note appears in `output.data_issues`.
   - Normalize seed tenant IDs to UUID to remove fallback dependency.

3. **No tenant assignment**
   - Validate `user_roles` for `user_id` includes `tenant_id` or franchise mapping.
   - Validate `profiles.tenant_id` and `user_preferences.tenant_id` fallback records.

4. **No data from Supabase despite valid auth**
   - Check environment parity:
     - frontend `VITE_SUPABASE_URL` and publishable key;
     - API/service `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   - Validate queried tables exist and include tenant-scoped rows.

5. **Intermittent empty payload**
   - confirm API returns `output` object for each interface;
   - inspect parse path for invalid JSON/empty body at gateway/proxy.

## 11) Preventive Controls

- Enforce tenant identifier format policy (UUID in production seed/migrations).
- Keep auth fallback gated to non-production/loopback only.
- Add CI check for AMRO overview happy-path integration (auth + scoped rows + output object).
- Keep test doubles synchronized with query-builder method usage.
- Monitor overview endpoint error-rate and `data_issues` cardinality by tenant.

## 12) AMRO Documentation Cross-Check

Reviewed references:
- `docs/AMRO_COMPREHENSIVE_DESIGN_SPECIFICATION.md`
- `docs/AMRO_LOW_LEVEL_DESIGN.md`
- `docs/AMRO_PLATFORM_INTEGRATION_ARCHITECTURE.md`
- `docs/AMRO_DOCUMENTATION_INDEX.md`
- `artifacts/mro/analysis/amro-plugin-requirements-spec-v1.0.md`

Observed contract alignment:
- overview endpoint shape, scoped auth requirement, and tenant isolation behavior are consistent with AMRO LLD/API contracts.
