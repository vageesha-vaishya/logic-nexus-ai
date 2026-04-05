# UIM Phase 5 Chaos Fault Matrix

## Objective
- Execute controlled failure scenarios against UIM APIs.
- Verify service behavior under transient and hard faults.
- Produce artifact logs for Phase 5 hardening evidence.

## Fault Matrix
- `CH-001` Dependency timeout simulation
  - Method: call unreachable host with strict timeout.
  - Expected: timeout handled, failure isolated.
- `CH-002` ETL queue burst
  - Method: schedule multiple ETL runs then process queue.
  - Expected: queue drains without API failure.
- `CH-003` Reconciliation under ETL stop/start
  - Method: stop scheduler, run reconciliation, start scheduler.
  - Expected: reconciliation endpoint remains available.
- `CH-004` Invalid payload rejection
  - Method: submit malformed QA sign-off payload.
  - Expected: API rejects invalid request with non-2xx.

## Execution
- Local:
  - `npm run phase5:chaos`
- Output artifacts:
  - `artifacts/mro/analysis/chaos/uim-phase5-chaos-log.json`
  - `artifacts/mro/analysis/chaos/uim-phase5-chaos-log.md`

## Pass Criteria
- At least `3/4` experiments pass in mock/staging profile.
- No uncontrolled process crash.
- Failure signatures are captured in artifact logs.
