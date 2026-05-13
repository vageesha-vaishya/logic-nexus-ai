# SOS Services Canvas Repository Separation Evaluation

## Objective

Assess technical feasibility, architecture impact, integration implications, and governance requirements for creating an independent GitHub repository for `SOS Services Canvas`.

## Executive Decision

- Decision: proceed with repository separation.
- Rationale: the framework already has a clear clean-architecture nucleus and explicit API/event contracts.
- Expected outcome: autonomous release cadence with controlled compatibility for dependent module ecosystems.

## Feasibility Assessment

### Technical Feasibility

- Current framework artifacts are already modular:
  - `src/core/sos-services-canvas/*` for implementation.
  - `docs/SOS_SERVICES_CANVAS/*` for contract and architecture references.
- Build and test strategy can be moved without platform coupling by:
  - replacing path aliases with package exports;
  - isolating integration tests into contract suites;
  - externalizing environment configuration.

### Architectural Implications

- Positive:
  - independent semantic versioning and release governance;
  - clearer ownership and security posture boundaries;
  - reduced blast radius for platform changes.
- Risks:
  - integration drift if contracts are not version-locked;
  - duplicated CI logic unless standardized templates are used.
- Mitigation:
  - enforce OpenAPI/AsyncAPI contract tests in consumer repos;
  - publish compatibility matrix and deprecation policy;
  - maintain shared release coordination runbook.

### Strategic Benefits

- Enables framework-as-product operating model.
- Improves contribution velocity for infrastructure concerns.
- Supports framework adoption across non-platform stacks.

## Independent Repository Architecture

```text
sos-services-canvas/
  src/
    domain/
    application/
    infrastructure/
    presentation/
  sdk/
    js/
    python/
    java/
    go/
  contracts/
    openapi/
    asyncapi/
    json-schema/
  tests/
    unit/
    integration/
    contract/
    e2e/
    performance/
    security/
  deploy/
    helm/
    kustomize/
    terraform/
  docs/
    adr/
    architecture/
    operations/
    governance/
    migration/
  scripts/
    release/
    ci/
    integration/
  .github/
    workflows/
  .changeset/
```

## Branching Strategy Recommendation

- Model: trunk-based with short-lived branches and release branches.
- Branch purposes:
  - `main`: production-ready, always releasable.
  - `release/x.y`: stabilization and hotfix staging.
  - `feat/<scope>-<ticket>`: feature delivery.
  - `fix/<scope>-<ticket>`: bug fixes.
  - `chore/<scope>-<ticket>`: maintenance.
- Protection rules:
  - required reviews: minimum 2, including one code owner approval;
  - required checks: lint, typecheck, unit, integration, contract, security scan;
  - signed commits and linear history required.

## Version Control and Compatibility Policy

- Semantic versioning:
  - `MAJOR`: breaking API/event/schema behavior.
  - `MINOR`: backward-compatible capabilities.
  - `PATCH`: defect and non-breaking operational fixes.
- Commit standard: Conventional Commits.
- Release tagging: `vX.Y.Z` from `main` via automated release workflow.
- Compatibility guarantee: support current and previous major versions.

## Integration Requirements with Existing Modules

- API contract source of truth: OpenAPI in framework repository.
- Event contract source of truth: AsyncAPI in framework repository.
- Data exchange:
  - JSON over REST;
  - protobuf for gRPC endpoints;
  - versioned event envelopes for stream/queue delivery.
- Communication patterns:
  - synchronous for authorization and policy checks;
  - asynchronous for lifecycle and integration events.

## Success Criteria

- Deployment reliability: zero-downtime release pipeline validated.
- Performance baseline: p95 API latency under 100ms for core auth/tenancy reads.
- Availability: 99.9% service uptime target.
- Scalability benchmark: validated load profile to 10,000 concurrent sessions.
- Governance: 100% PRs passing branch protection and quality gates.
