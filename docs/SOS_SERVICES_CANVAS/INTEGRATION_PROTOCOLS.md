# SOS Services Canvas Integration Protocols

## Contract Governance

- API contracts: `contracts/openapi/sos-services-canvas.openapi.yaml`.
- Event contracts: `contracts/asyncapi/sos-services-canvas.asyncapi.yaml`.
- Schema contracts: `contracts/json-schema/*.json`.
- Contract ownership: framework maintainers plus integration architect reviewer.

## API Interface Specifications

- Primary protocol: REST JSON over HTTPS (TLS 1.3 required).
- Optional protocol: gRPC for low-latency internal service calls.
- Authentication:
  - OAuth2/OIDC authorization code for interactive workloads;
  - JWT bearer for service-to-service workloads.
- Authorization: RBAC policy evaluation against framework policy engine contract.

## Data Exchange Formats

- REST: JSON with explicit versioning in path `/v1/*`.
- gRPC: protobuf with versioned package namespaces.
- Event payloads: versioned envelopes with fields:
  - `id`;
  - `eventName`;
  - `eventVersion`;
  - `tenantId`;
  - `franchiseId` optional;
  - `correlationId`;
  - `occurredAt`;
  - `payload`.

## Communication Mechanisms

- Synchronous:
  - auth token issuance/verification;
  - tenant context resolution;
  - franchise hierarchy queries.
- Asynchronous:
  - lifecycle events (tenant provisioned, policy changed, payment settled);
  - integration notifications and eventual consistency updates.
- Reliability controls:
  - idempotency key support;
  - retry with exponential backoff;
  - dead-letter queue for poison events.

## Integration Testing Protocol

- Required test categories for each consumer module:
  - contract tests against OpenAPI and AsyncAPI snapshots;
  - compatibility tests against current and previous major framework versions;
  - end-to-end workflow smoke (auth -> tenant scope -> domain action -> event emission).

## Version and Deprecation Rules

- Breaking API or event changes require major version increment.
- Deprecated operations must remain available for at least two minor releases.
- Deprecation notice must include replacement contract and migration steps.
