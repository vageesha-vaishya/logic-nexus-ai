# UIM Phase 3 Channel Integration - Release Notes (Draft v0.6)

## Summary

Phase 3 introduces channel integration capabilities on top of stable UIM core services:

- REST hardening audit endpoint
- GraphQL query endpoint and subgraph schema publication
- Webhook adapter framework for outbound event delivery
- Connector manifests for Freight, AMRO, Marketplace, and ERP bridges
- Integration test coverage for channel-facing APIs

## New Endpoints

- `GET /api/v2/uim/integration-contracts`
- `POST /api/v2/uim/integrations/rest`
- `POST /api/v2/uim/graphql`
- `GET /api/v2/uim/contracts/uim-subgraph.graphql`
- `GET /api/v2/uim/contracts/openapi-3.1.yaml`
- `GET|POST /api/v2/uim/webhooks`
- `GET /api/v2/uim/connectors/manifests`

## Connector Framework

Connector manifests now define baseline contract metadata and SLA targets for:

- `freight-bridge`
- `amro-bridge`
- `marketplace-bridge`
- `erp-bridge`

## Verification

Recommended suites for phase validation:

```bash
npx vitest run \
  src/pages/api/v2/uim/integrations/rest.test.ts \
  src/pages/api/v2/uim/graphql.test.ts \
  src/pages/api/v2/uim/webhooks.test.ts \
  src/pages/api/v2/uim/connectors/manifests.test.ts
```

## Known Limitations (Current Iteration)

- GraphQL endpoint currently supports targeted query fields (`uimHealth`, `uimProjectionItems`, `uimInventoryItem`) with lightweight operation routing.
- Webhook dispatch is contract-first and queue-status emulation only; outbound delivery worker implementation is pending next iteration.
- Contract compatibility sign-off report remains a process artifact and requires formal review completion.
