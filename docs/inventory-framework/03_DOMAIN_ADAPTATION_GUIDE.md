# Domain Adaptation Guide

## Purpose
This guide provides a repeatable process for adapting the generic inventory documentation framework to any business domain without introducing hard-coded, domain-locked assumptions in the core layer.

## Prerequisites
- Read `02_DOMAIN_AGNOSTIC_INVENTORY_FRAMEWORK.md`.
- Confirm domain governance owner and architecture approver.
- Prepare domain data dictionary and workflow catalog.

## Step-by-Step Adaptation Process
## Step 1: Define Domain Prefix and Binding Variables
- Choose `${domain_prefix}` value (for example `retail`, `warehouse`, `manufacturing`, `amro`).
- Define concrete table bindings for:
  - `${catalog_item_table}`
  - `${inventory_item_table}`
  - `${inventory_ledger_table}`
  - `${inventory_reservation_table}`
  - `${inventory_projection_table}`
  - `${item_profile_table}`

Output artifact:
- `domain-binding-map.yaml`

## Step 2: Create Domain Term Mapping
- Build a term translation matrix:
  - domain term,
  - generic core equivalent,
  - usage notes,
  - prohibited usage in generic layer.

Example:
| Domain Term | Generic Core Term | Rule |
|---|---|---|
| work package | execution context | allowed only in extension sections |
| pick wave | allocation batch | allowed only in extension sections |
| production order | execution context | allowed only in extension sections |

## Step 3: Bind Domain Attributes to Item Profile Extension
- Add domain-specific attributes to `${item_profile_table}.domain_attributes`.
- Keep core columns unchanged.
- Document validation constraints in extension spec.

Output artifact:
- `${domain_prefix}_item_profile_extension.md`

## Step 4: Map Domain Workflows to Generic Workflows
- For each domain workflow, map to one or more base workflows:
  - receive,
  - move,
  - reserve,
  - consume/release,
  - reconcile.

Output artifact:
- `${domain_prefix}_workflow_binding_matrix.md`

## Step 5: Define API Adapter Contract
- Implement domain adapter endpoint pattern:
  - `POST /api/v2/inventory/integrations/{domain}/actions`
- Ensure adapter transforms domain requests into generic command payloads.
- Include idempotency and correlation ID behavior.

Output artifact:
- `${domain_prefix}_adapter_contract.yaml`

## Step 6: Validate Documentation Neutrality
- Run neutrality checklist from `06_VALIDATION_AND_QA_REPORT.md`.
- Ensure no domain-specific wording remains in generic docs.

Output artifact:
- `${domain_prefix}_neutrality_checklist.md`

## Step 7: Publish Extension Pack
- Publish extension docs under:
  - `docs/inventory-framework/extensions/${domain_prefix}/`
- Reference generic concept IDs and core placeholders.

## Domain Onboarding Checklist
- [ ] Placeholder bindings defined and approved.
- [ ] Domain term map created.
- [ ] Extension profile attributes documented.
- [ ] Workflow binding matrix completed.
- [ ] Adapter API contract reviewed.
- [ ] Neutrality compliance passed.
- [ ] Integration validation scenarios executed.

## Common Anti-Patterns to Avoid
- Putting domain tables directly in generic SQL examples.
- Defining domain statuses in core status enumerations.
- Using domain acronyms in core architecture decisions.
- Duplicating core concepts in extension docs.

## Recommended Governance Model
- Core framework owner: Platform architecture team.
- Extension owner: Domain product engineering team.
- Change control:
  - core changes require cross-domain review,
  - extension changes require domain and platform approval.

## Change Impact Template
Use this template for every adaptation update:
```markdown
Change ID:
Domain:
Impacted Core Concepts (INV-*):
New/Updated Placeholders:
Workflow Impact:
API Contract Impact:
Validation Evidence:
Rollback Notes:
Approvers:
```
