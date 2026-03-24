# AMRO API `/api/v2/amro/` Recurring 500 Remediation

## Incident Summary

- Incident: recurring HTTP 500 responses on AMRO v2 endpoints, with repeated failures on master-data screens.
- Primary affected path: `/api/v2/amro/master-data/:entity` and authentication/dependency resolution paths used by AMRO v2 APIs.
- Date remediated: 2026-03-24.

## Root Cause Analysis

### Server and application behavior

- Errors were propagating from dependency operations without consistent resilience wrapping.
- Some dependency failures surfaced as generic exceptions, producing unstable status mapping and unstructured error responses.
- Request-level timeout governance was missing, increasing risk of hanging requests under degraded dependencies.

### Database and dependency layer

- Supabase operations for AMRO master data and auth tenant resolution were vulnerable to transient network/schema/cache failures.
- Repeated failures could cascade because no circuit breaker gate was applied consistently across all sensitive dependency calls.

### Authentication and tenant resolution

- Auth middleware depended on multiple Supabase lookups (`user_roles`, `franchises`, `profiles`, `user_preferences`) without resilience wrapping.
- Tenant resolution failures could bubble up as 500s without enough operational telemetry for quick triage.

### Input validation and API contract behavior

- Query validation was permissive for pagination/sorting/search/export and relied on fallback coercion in scenarios that should be rejected with 4xx.
- Some dependency-originated failures were not normalized to stable HTTP/status code envelopes.

### Monitoring and diagnostics

- Existing logging captured request lifecycle but lacked rolling error-rate based alerting hooks and resilience status surfacing through health metrics.

## Implemented Fixes

## Resilience and dependency protection

- Applied shared resilience executor (timeout + retry with exponential backoff + circuit breaker) to:
  - AMRO master-data list/create/read/update/delete operations.
  - AMRO master-data audit write operation.
  - Auth middleware user/token/tenant resolution lookups.
- Added dependency health probing through resilience wrapper for health/readiness endpoints.

### Request timeout controls

- Added request timeout middleware with configurable `AMRO_REQUEST_TIMEOUT_MS` default.
- Added streaming-path bypass to prevent breaking SSE/stream traffic.
- Returns stable `408 REQUEST_TIMEOUT` envelope when timeout is reached.

### Input validation hardening

- Enforced strict validation for:
  - `page` positive integer.
  - `page_size` positive integer and `<= 200`.
  - `sort_dir` in `{asc, desc}`.
  - `search` length limit.
  - `export` only supports `csv` when provided.
- Validation failures now map to 400 instead of implicit coercion.

### HTTP status code mapping

- Added centralized error normalization for route-level failures.
- Dependency and resilience failures preserve status intent (e.g. 503 for circuit/dependency issues, 504 for dependency timeout, 408 request timeout).

### Health checks and monitoring

- Added and enhanced health endpoints:
  - `/health` includes resilience status.
  - `/health/ready` performs dependency probe and emits readiness status.
  - `/health/metrics` returns rolling request/error telemetry and resilience state.
  - `/api/v2/amro/health` includes dependency + resilience state.
  - `/api/v2/amro/health/metrics` exposes AMRO-scoped metrics shape.
- Added rolling monitoring counters and automated alert log emission for elevated 5xx rate with configurable thresholds:
  - `AMRO_MONITORING_WINDOW_MS`
  - `AMRO_MONITORING_MIN_SAMPLES`
  - `AMRO_MONITORING_ALERT_5XX_PERCENT`
  - `AMRO_MONITORING_MIN_ALERT_INTERVAL_MS`

### Test and benchmark coverage

- Added `tests/master-data.routes.test.ts` for:
  - successful list retrieval,
  - input validation failure behavior,
  - resilience failure status mapping.
- Added `tests/resilience.test.ts` for:
  - retry + eventual success,
  - circuit open short-circuit behavior.
- Extended integration checks in `tests/work-orders.test.ts` for:
  - readiness endpoint,
  - monitoring metrics endpoints.
- Added load benchmark harness:
  - `tests/master-data.benchmark.ts`
  - script: `npm run benchmark:master-data`

## Deployment Procedure

1. Set environment variables for resilience/monitoring:
   - `AMRO_DEPENDENCY_TIMEOUT_MS`
   - `AMRO_DEPENDENCY_MAX_RETRIES`
   - `AMRO_DEPENDENCY_BASE_BACKOFF_MS`
   - `AMRO_CIRCUIT_FAILURE_THRESHOLD`
   - `AMRO_CIRCUIT_RESET_TIMEOUT_MS`
   - `AMRO_REQUEST_TIMEOUT_MS`
   - `AMRO_MONITORING_WINDOW_MS`
   - `AMRO_MONITORING_MIN_SAMPLES`
   - `AMRO_MONITORING_ALERT_5XX_PERCENT`
   - `AMRO_MONITORING_MIN_ALERT_INTERVAL_MS`
2. Run quality gates:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
3. Deploy AMRO API service with standard rollout process.
4. Post-deploy verification:
   - `GET /health`
   - `GET /health/ready`
   - `GET /health/metrics`
   - `GET /api/v2/amro/health`
   - `GET /api/v2/amro/health/metrics`
5. Execute targeted benchmark in pre-prod or production shadow:
   - `AMRO_BENCHMARK_ENDPOINT=... AMRO_BENCHMARK_TOKEN=... AMRO_BENCHMARK_TENANT_ID=... npm run benchmark:master-data`

## Rollback Procedure

1. Roll back AMRO API service to last known good release artifact.
2. Revert environment variables to previous stable values.
3. Verify rollback health:
   - `GET /health`
   - smoke-check `/api/v2/amro/master-data/aircraft`.
4. Confirm error-rate normalization in logs/monitoring.
5. Preserve failure evidence (request IDs, alert windows, status metrics) for follow-up remediation.

## AMRO Documentation References Cross-Checked

- `AMRO_COMPREHENSIVE_DESIGN_SPECIFICATION.md`
- `AMRO_IMPLEMENTATION_ROADMAP.md`
- `AMRO_DEPLOYMENT_PROCEDURES.md`
- `amro-plugin-requirements-spec-v1.0.md`
- `2026-03-19-amro-plugin-implementation.md`
- `2026-03-19-amro-plugin-implementation-reference.md`
- `AMRO_DOCUMENTATION_INDEX.md`
- `AMRO_PLATFORM_INTEGRATION_ARCHITECTURE.md`
- `AMRO_QUICK_REFERENCE_GUIDE.md`
