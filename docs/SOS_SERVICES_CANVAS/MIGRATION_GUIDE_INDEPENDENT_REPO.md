# Migration Guide: Move SOS Services Canvas to Independent Repository

## Migration Goal

Extract framework code, contracts, tests, and governance assets into a dedicated repository while preserving compatibility with existing module ecosystems.

## Prerequisites

- Existing framework baseline in current platform repository.
- Contract definitions finalized for OpenAPI and AsyncAPI.
- Integration module owners identified.

## Migration Steps

### Step 1: Repository Provisioning

1. Create repository `sos-services-canvas`.
2. Apply repository template and branch protection baseline.
3. Configure required GitHub environments: `dev`, `staging`, `prod`.

### Step 2: Source and Contract Extraction

1. Move framework code from `src/core/sos-services-canvas` to new repository `src/`.
2. Move docs from `docs/SOS_SERVICES_CANVAS` to new repository `docs/`.
3. Move deployment assets to `deploy/`.
4. Set package exports and remove host-repository path assumptions.

### Step 3: CI/CD and Governance Activation

1. Enable CI workflow and release workflow.
2. Configure CODEOWNERS and PR template.
3. Enable dependency scanning and secrets scanning.
4. Configure semantic release and changelog automation.

### Step 4: Consumer Repository Integration

1. Replace local imports with package dependency:
  - `@sos/services-canvas`.
2. Pin integration to framework release tag.
3. Run contract and integration smoke tests in consumer repositories.
4. Update compatibility matrix and release notes.

### Step 5: Cutover and Validation

1. Deploy framework release candidate.
2. Execute end-to-end validation in staging.
3. Promote release to production after quality gates pass.
4. Keep rollback package/version ready for immediate reversion.

## Rollback Plan

- Trigger criteria:
  - critical integration contract failure;
  - sustained SLO breach;
  - security incident requiring immediate containment.
- Rollback actions:
  - restore previous framework package version in consumers;
  - revert integration configuration to last stable tag;
  - publish incident report and corrective actions.

## Success Metrics

- Extraction completion without unresolved critical defects.
- 100% contract compatibility for supported modules.
- No production downtime during migration window.
- Independent repo release pipeline operational within 30 days.
