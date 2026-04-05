# UIM Phase 2 Release Checklist (v0.2 / v0.4)

Date: `2026-04-05`  
Scope: `UIM Phase 2 - Core Inventory Services`

## Pre-Release Gate

- [ ] Phase 1 completion evidence linked
- [ ] Schema review approval attached
- [ ] Migration files reviewed and approved
- [ ] API docs updated for command + projection endpoints
- [ ] CI green on lint + unit + integration test suites
- [ ] Staging verification matrix completed and signed

## Required Artifacts

- Migrations:
  - `supabase/migrations/20260405101500_uim_phase2_core_services.sql`
- Service code:
  - `src/pages/api/v2/uim/commands/index.ts`
  - `src/pages/api/v2/uim/projections/replay.ts`
  - `src/pages/api/v2/uim/projections/items.ts`
- Automated tests:
  - `src/pages/api/v2/uim/commands/index.test.ts`
  - `src/pages/api/v2/uim/projections/replay.test.ts`
  - `tests/integration/uim-command-projection-consistency.test.ts`
- API docs:
  - `docs/UIM_PHASE2_CORE_SERVICES_API.md`

## Verification Commands

```bash
# lint
npx eslint src/pages/api/v2/uim/**/*.ts src/modules/uim/**/*.ts* src/services/uim/**/*.ts

# api tests
npx vitest run src/pages/api/v2/uim/commands/index.test.ts src/pages/api/v2/uim/projections/replay.test.ts

# integration consistency
npm run test:uim:integration

# uix/forms regression
npx vitest run src/modules/uim/forms/UimForms.test.tsx

# visual regression (optional but recommended)
npm run test:playwright:uim:visual
npm run report:playwright:uim:visual
```

## Release Tagging Commands

> Run only after all verification and approvals are complete.

```bash
# sync
git fetch --all --tags
git pull --rebase

# create annotated release tags
git tag -a v0.2 -m "UIM Phase 2 core services baseline"
git tag -a v0.4 -m "UIM Phase 2 projection + dense-grid completion"

# push tags
git push origin v0.2
git push origin v0.4
```

## Staging Verification Matrix

| Area | Scenario | Endpoint/UI | Expected Result | Status | Evidence |
|---|---|---|---|---|---|
| Commands | RECEIVE success | `POST /api/v2/uim/commands` | `command_status=applied`, item created + ledger event | Pending | link |
| Commands | MOVE success | `POST /api/v2/uim/commands` | item location updated + MOVE ledger event | Pending | link |
| Commands | RESERVE success | `POST /api/v2/uim/commands` | reservation active + RESERVE ledger event | Pending | link |
| Commands | CONSUME success | `POST /api/v2/uim/commands` | quantity reduced, optional reservation fulfilled | Pending | link |
| Commands | Idempotency | `POST /api/v2/uim/commands` (same key) | replayed response, no duplicate side effects | Pending | link |
| Projections | Replay determinism | `POST /api/v2/uim/projections/replay` | stable totals for same ledger sequence | Pending | link |
| Projections | Snapshot query | `GET /api/v2/uim/projections/items` | pagination valid, snapshot totals present | Pending | link |
| UI Dense Grid | Projection-backed list load | `/dashboard/uim/item-master` etc. | records sourced from projections, no forms-endpoint dependency | Pending | link |
| UI Dense Grid | Replay from toolbar | `Replay Now` action | replay executes + list refresh + toast success | Pending | link |
| UI Resilience | Reconnect + auto-retry | UIM records error state | retries recover without page reload | Pending | link |
| Security | Tenant isolation | staging tenants A/B | no cross-tenant data leakage | Pending | link |

## Exit Criteria Sign-off

- [ ] All core commands functional in staging
- [ ] Replay deterministic validation passed
- [ ] `v0.2` published
- [ ] `v0.4` published

## Signatures

| Role | Name | Date | Sign-off |
|---|---|---|---|
| Backend Engineer |  |  |  |
| Frontend Engineer |  |  |  |
| QA Engineer |  |  |  |
| Product Owner |  |  |  |
