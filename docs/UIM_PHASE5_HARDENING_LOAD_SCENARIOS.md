# UIM Phase 5 Load Scenarios

## Objective
- Define repeatable load scenarios for Phase 5 hardening and performance validation.
- Validate p95 API latency and error-rate behavior under increasing concurrency.
- Produce evidence artifacts consumable by release governance (`v0.9` gate).

## Scope
- Service under test: UIM API (`/api/v2/uim/**`).
- Primary flows:
  - Health and integration contract checks.
  - Analytics read APIs (`kpis`, `etl`, `reconciliation`).
  - Analytics workflow writes (`qa-signoff`) and SLA evidence read.
- Tenant isolation header model:
  - `X-Tenant-Id`
  - `X-Franchise-Id`

## Profiles
- `smoke`
  - Purpose: CI safety net.
  - Load: `20` VUs for `2m`.
  - Gate: `http_req_duration p95 < 1200ms`, `http_req_failed < 1%`.
- `baseline`
  - Purpose: daily/staging baseline.
  - Load: ramp `100 -> 300 -> 0`.
  - Gate: `http_req_duration p95 < 1500ms`, `http_req_failed < 1%`.
- `target_2000`
  - Purpose: Phase 5 acceptance target.
  - Load: ramp and sustain at `2,000` concurrent users.
  - Gate: `http_req_duration p95 < 2200ms`, `http_req_failed < 2%`.

## Commands
- Smoke:
  - `npm run perf:uim:k6:smoke`
- Baseline:
  - `npm run perf:uim:k6:baseline`
- 2,000-user target:
  - `npm run perf:uim:k6:target2000`

## Output Artifacts
- JSON summary:
  - `artifacts/mro/analysis/performance/uim-phase5-k6-summary.json`
- Markdown SLA report:
  - `artifacts/mro/analysis/performance/uim-phase5-sla-report.md`

## Release Mapping
- `p95 SLA compliance`: from k6 summary and generated SLA report.
- `Performance reports`: markdown report + raw JSON summary.
- `Reliability regression evidence`: CI workflow artifact retention.
