# SOS Services Canvas Repository Template

This template bootstraps an independent framework repository with architecture, governance, CI/CD, and integration scaffolding.

## Template Structure

```text
.
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── release.yml
│   ├── CODEOWNERS
│   └── pull_request_template.md
├── contracts/
│   ├── openapi/
│   ├── asyncapi/
│   └── json-schema/
├── src/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── presentation/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   ├── e2e/
│   ├── performance/
│   └── security/
├── docs/
│   ├── adr/
│   ├── architecture/
│   ├── governance/
│   └── migration/
└── scripts/
    ├── release/
    └── integration/
```

## Required Branches

- `main`: protected, releasable.
- `release/x.y`: release stabilization.
- feature/fix/chore branches: short-lived and PR-only merge.

## Required Standards

- Conventional Commits.
- Semantic Versioning.
- OpenAPI and AsyncAPI as source-of-truth contracts.
- Compatibility support for current + previous major versions.
