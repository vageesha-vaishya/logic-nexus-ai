# ADR-0002: Independent Repository Strategy for SOS Services Canvas

- Status: accepted
- Date: 2026-04-21

## Context

`SOS Services Canvas` requires independent lifecycle governance, contract versioning, and release autonomy while remaining interoperable with platform module ecosystems.

## Decision

Adopt a dedicated GitHub repository with:

- clean architecture source ownership;
- centralized OpenAPI/AsyncAPI contract governance;
- trunk-based branching with protected release controls;
- semantic-release driven versioning and changelog automation;
- mandatory contract compatibility gates for dependent modules.

## Consequences

- Benefits:
  - faster framework delivery independent of host platform release train;
  - clearer ownership and security governance;
  - explicit integration and compatibility management.
- Costs:
  - additional release coordination across repositories;
  - higher governance overhead for compatibility validation.

## Compliance

- All major architectural changes must add/update ADR entries.
- Breaking changes require major version increment and migration guide updates.
