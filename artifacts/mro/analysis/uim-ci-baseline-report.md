# UIM CI Baseline Report

## Scope
- Release target: `v0.2`
- Module scope: `API persistence + reservation lifecycle ledger consistency`
- Date: `2026-04-04`

## Baseline Checks
- Lint: Passed (`npx eslint src/pages/api/v2/uim/items/query.ts src/pages/api/v2/uim/reservations/soft.ts src/pages/api/v2/uim/items/query.test.ts src/pages/api/v2/uim/reservations/soft.test.ts`)
- Typecheck: Pending
- Unit tests: Passed (`npx vitest run src/pages/api/v2/uim/items/query.test.ts src/pages/api/v2/uim/reservations/soft.test.ts`)
- Integration tests: Passed (`npx vitest run src/pages/api/v2/uim/reservations/soft.test.ts 'src/pages/api/v2/uim/reservations/[id]/status.test.ts'`)
- Validation contract tests: Passed (`npx vitest run src/pages/api/v2/uim/reservations/soft.test.ts 'src/pages/api/v2/uim/reservations/[id]/status.test.ts'`) for deterministic `422` (`UIM_VALIDATION_INVALID_QUANTITY`, `UIM_VALIDATION_INVALID_STATUS`, `UIM_RESERVATION_INVALID_TRANSITION`)
- UIM CI quality gate workflow: Implemented (`.github/workflows/uim-phase1-gate.yml`) with rules enforcement, UIM lint, typecheck, and targeted tests
- UIM security baseline workflow: Implemented (`.github/workflows/uim-security-baseline.yml`) with dedicated secret scan (gitleaks) and SAST (semgrep) for UIM scope
- Security scan: Pending

## Evidence Links
- API scaffold:
- `src/pages/api/v2/uim/health.ts`
- `src/pages/api/v2/uim/items/query.ts`
- `src/pages/api/v2/uim/reservations/soft.ts`
- `src/pages/api/v2/uim/reservations/[id]/status.ts`
- Test evidence:
- `src/pages/api/v2/uim/reservations/soft.test.ts`
- `src/pages/api/v2/uim/reservations/[id]/status.test.ts`
- CI/CD workflows:
- `.github/workflows/uim-phase1-gate.yml`
- `.github/workflows/uim-security-baseline.yml`
- Migration skeleton:
- `supabase/migrations/20260404143000_uim_core_schema_skeleton.sql`

## Notes
- UIM endpoint scaffolds now include tenant-scoped persistence for `items/query` and `reservations/soft`.
- Reservation lifecycle transition endpoint now supports `active -> fulfilled/cancelled` with ledger transition writes (`CONSUME` / `RELEASE`), and tests assert reservation+ledger consistency.
- Reservation command handlers now use shared validation logic and deterministic `422` error contracts for invalid payloads and disallowed transitions.
- Update this report after pipeline-runner CI execution to replace local command evidence.
