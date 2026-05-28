# `@platform/event-contracts`

Universal event envelope shape + JSON schemas per `<module>.<entity>.<event>` topic. **The source of truth for what every event on the platform looks like.**

See master design doc §5.1 for the envelope contract.

## What lives here

- `src/types.ts` — TypeScript types for the envelope shape (`EventEnvelope`, `EventMetadata`).
- `src/validator.ts` — Runtime validation (`validateEnvelope`) — no third-party JSON Schema lib yet; lightweight check.
- `src/schemas/` — JSON Schema files per topic (e.g. `sales.opportunity.won.v1.json`). Populated in Phase 0.3.
- `src/topics.ts` — The canonical topic-name registry — keeps everyone using the same string.

## Phase 0 scope

This package is **skeleton only**. It defines:
- The `EventEnvelope` shape (per master §5.1)
- A minimal validator (no JSON Schema library yet)
- The `SchemaQualifiedSubject` string convention (`'core.party'`, `'sales.lead'`, etc.) per master §2.4

Schema files per topic and the full JSON-Schema-based validator land in **Phase 0.3**.
