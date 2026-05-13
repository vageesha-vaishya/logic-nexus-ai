# SOS Services Canvas Repository Governance Model

## Access Control and Roles

- `Repository Admin`:
  - manage branch protection, environments, secrets, and team permissions.
- `Maintainer`:
  - merge pull requests after mandatory review checks pass.
- `Contributor`:
  - submit pull requests and run CI pipelines.
- `Security Reviewer`:
  - approve security-sensitive changes and dependency overrides.
- `Integration Reviewer`:
  - approve API/event contract and compatibility matrix changes.

## Code Review Requirements

- Minimum 2 approvals for all protected branches.
- Mandatory CODEOWNERS approval for:
  - `src/domain`, `src/application`;
  - `contracts/*`;
  - `.github/workflows/*`;
  - `deploy/*`.
- Required checklist in each PR:
  - architecture impact assessed;
  - compatibility impact stated;
  - test evidence attached;
  - migration notes included if needed.

## CI/CD Pipeline Criteria

- Build stages:
  - install and deterministic lockfile validation;
  - lint and static analysis;
  - unit tests;
  - integration tests;
  - contract tests;
  - security checks (dependency and secret scanning);
  - build artifacts and publish candidates.
- Quality gates:
  - test coverage >= 80%;
  - no critical/high vulnerability unresolved;
  - contract compatibility check must pass.

## Dependency Management Policy

- Version constraints:
  - runtime dependencies pinned to compatible ranges;
  - security-sensitive dependencies pinned to exact versions.
- Update process:
  - weekly automated update PRs;
  - CVSS >= 7.0 requires patch within 48 hours.
- Compatibility matrix:
  - maintained under `docs/governance/compatibility-matrix.md`.
- Transitive dependencies:
  - tracked by lockfile and audited in CI.

## Release Coordination Framework

- Release cadence:
  - patch: on-demand;
  - minor: bi-weekly;
  - major: quarterly planning cycle.
- Synchronization protocol:
  - publish release candidate;
  - run consumer integration matrix;
  - promote to stable only after matrix passes.
- Rollback policy:
  - automated rollback trigger on critical SLO breach;
  - notify consumer module owners through release incident channel.

## Compliance and Audit Requirements

- Required compliance evidence for release:
  - signed provenance for artifacts;
  - vulnerability report;
  - change audit trail linked to release tag.
- Retention:
  - release and audit evidence retained for minimum 12 months.
