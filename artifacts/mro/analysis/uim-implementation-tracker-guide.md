# UIM Implementation Tracker Guide

## Purpose
This artifact set links every major acceptance criterion in `docs/UIM_UNIFIED_INVENTORY_SYSTEM_DESIGN.md` to:
- owner role
- sprint and release target
- evidence artifact path
- approval workflow

Files:
- `artifacts/mro/analysis/uim-implementation-tracker.csv`
- `artifacts/mro/analysis/uim-evidence-checklist.csv`

## Update Workflow
1. Update `uim-implementation-tracker.csv` during sprint planning:
- set `status` (`Not Started`, `In Progress`, `Blocked`, `Done`)
- confirm `owner_role`, `sprint`, `target_version`
- add `evidence_link` as artifacts are produced
2. Update `uim-evidence-checklist.csv` during review:
- attach actual artifact path
- assign `reviewer_role`
- set `approval_status` and `approval_date`
3. Gate release only when:
- all critical/high tracker rows are `Done`
- all evidence rows for critical/high items are `Approved`

## Status Definitions
- `Not Started`: task accepted but no implementation work.
- `In Progress`: active implementation or validation ongoing.
- `Blocked`: dependency or risk preventing completion.
- `Done`: implementation and validation complete, pending evidence approval.

## Approval Definitions
- `Pending`: artifact expected but not reviewed.
- `Approved`: reviewer validated evidence against acceptance criteria.
- `Rejected`: evidence insufficient; remediation required.

## Suggested Evidence Link Format
Use repository-relative paths to keep links portable:
- `artifacts/mro/analysis/uim-load-test-2000-users-report.md`
- `coverage/uim/index.html`
- `supabase/migrations/2026xxxxxx_uim_*.sql`

## Example Progress Update
```csv
tracker_id,section,criterion,owner_role,sprint,target_version,priority,status,evidence_link,notes
UIM-TRK-015,Scalability,"2,000 concurrent-user load test passed",Performance Engineer,Sprint 6,v0.9,High,Done,artifacts/mro/analysis/uim-load-test-2000-users-report.md,"p95 write 265ms, p95 read 128ms"
```

## Release Readiness Query (Manual Checklist)
- All `priority=Critical` rows are `Done`.
- All `priority=High` rows are `Done` or approved exception.
- `UIM-TRK-025`, `UIM-TRK-026`, `UIM-TRK-027` are `Done`.
- `UIM-EVD-*` rows tied to release-critical tracker IDs are `Approved`.
