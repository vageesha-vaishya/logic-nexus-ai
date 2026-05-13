# ADR-0001: Extractable Core Infrastructure Module

- Status: accepted
- Date: 2026-04-21

## Context

The platform requires a reusable infrastructure module that can be extracted and integrated into different technology stacks while preserving tenancy, franchise isolation, security, and operational consistency.

## Decision

Adopt a clean architecture module named `SOS Services Canvas` with:

- strict domain and application contracts;
- infrastructure as adapter plugins;
- protocol-level neutrality for REST, gRPC, and event transports;
- OpenAPI-driven integration and SDK generation.

## Consequences

- Positive:
  - extraction-friendly core with low coupling;
  - easier governance and compliance standardization;
  - portable implementation across SaaS/PaaS environments.
- Trade-off:
  - adapter authoring overhead for each deployment stack.

## Follow-Up

- Add production adapters for Redis, PostgreSQL, Kafka, Vault, Stripe, and SendGrid.
- Add contract tests for all adapters.
- Add canary rollout automation and chaos scenarios to CI/CD.
