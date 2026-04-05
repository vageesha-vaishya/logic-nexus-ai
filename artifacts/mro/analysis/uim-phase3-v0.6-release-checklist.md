# UIM Phase 3 Release Checklist (v0.6)

Date: `2026-04-05`  
Scope: `UIM Phase 3 - Channel Integration`

## Entry Criteria Validation

- [x] Stable core services confirmed (Phase 2 command/projection suites green)
- [x] Consumer module readiness confirmed (Freight/AMRO integration consumers)
- [x] Staging environment integration credentials available

## Deliverable Set

- API adapters:
  - `src/pages/api/v2/uim/integrations/rest.ts`
  - `src/pages/api/v2/uim/graphql.ts`
  - `src/pages/api/v2/uim/webhooks.ts`
- Connector manifests:
  - `src/pages/api/v2/uim/connectors/manifests.ts`
  - `src/pages/api/v2/uim/integration-contracts.ts`
- Integration test suite:
  - `src/pages/api/v2/uim/integrations/rest.test.ts`
  - `src/pages/api/v2/uim/graphql.test.ts`
  - `src/pages/api/v2/uim/webhooks.test.ts`
  - `src/pages/api/v2/uim/connectors/manifests.test.ts`
  - `tests/integration/uim-phase3-orchestration.test.ts`
- Release notes:
  - `docs/UIM_PHASE3_CHANNEL_INTEGRATION_RELEASE_NOTES.md`

## Verification Commands

```bash
# lint
npx eslint src/pages/api/v2/uim/**/*.ts scripts/uim-mock-api.mjs tests/integration/uim-phase3-orchestration.test.ts

# phase3 api tests
npx vitest run \
  src/pages/api/v2/uim/integrations/rest.test.ts \
  src/pages/api/v2/uim/graphql.test.ts \
  src/pages/api/v2/uim/webhooks.test.ts \
  src/pages/api/v2/uim/connectors/manifests.test.ts

# phase3 orchestration integration
npx vitest run tests/integration/uim-phase3-orchestration.test.ts
```

## SLA & Compatibility Sign-off

- [x] REST hardening SLA report status = `within_budget`
- [x] Webhook adapter dispatch status = `queued`
- [x] Connector manifest validation complete (freight/amro/marketplace/erp)
- [x] Contract compatibility report status = `compatible`
- [x] Compatibility report approved by Solution Architect + QA

## Release Tagging (v0.6)

```bash
git fetch --all --tags
git pull --rebase
git rev-parse HEAD
git tag -a v0.6 -m "UIM Phase 3 channel integration"
git push origin v0.6
git ls-remote --tags origin | grep v0.6
```

## Exit Criteria

- [x] Integration SLAs met
- [x] Contract compatibility report signed
- [ ] `v0.6` tag published

## Signatures

| Role | Name | Date | Sign-off |
|---|---|---|---|
| Backend Engineer |  |  |  |
| Integration Engineer |  |  |  |
| QA Engineer |  |  |  |
| Solution Architect |  |  |  |

## Linked Evidence

- `artifacts/mro/analysis/uim-phase3-sla-evidence.md`
- `artifacts/mro/analysis/uim-phase3-contract-compatibility-report-signed.md`
