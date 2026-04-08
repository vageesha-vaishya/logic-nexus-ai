# Inventory Integration Architecture: Generic Core + AMRO Extension

Version: `3.0`  
Status: `Refactored to Domain-Agnostic Framework`  
Date: `2026-04-08`

## Visual Legend
- `🟦 Generic Core Layer`: reusable inventory architecture for any domain.
- `🟧 Domain Extension Layer`: AMRO-specific implementation overlay.

## 1. Document Intent
This document is now a dual-layer reference:
- it defines a neutral, reusable inventory integration model,
- it preserves AMRO-specific requirements as an optional extension,
- it points maintainers to the new modular documentation package.

Package references:
- [01_DOCUMENTATION_AUDIT_AND_MAPPING.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/inventory-framework/01_DOCUMENTATION_AUDIT_AND_MAPPING.md)
- [02_DOMAIN_AGNOSTIC_INVENTORY_FRAMEWORK.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/inventory-framework/02_DOMAIN_AGNOSTIC_INVENTORY_FRAMEWORK.md)
- [03_DOMAIN_ADAPTATION_GUIDE.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/inventory-framework/03_DOMAIN_ADAPTATION_GUIDE.md)
- [04_CONFIGURATION_TEMPLATES.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/inventory-framework/04_CONFIGURATION_TEMPLATES.md)
- [05_TERMINOLOGY_MIGRATION_GUIDE.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/inventory-framework/05_TERMINOLOGY_MIGRATION_GUIDE.md)
- [06_VALIDATION_AND_QA_REPORT.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/inventory-framework/06_VALIDATION_AND_QA_REPORT.md)

## 2. Architecture Overview
### 🟦 Generic Core Layer
Canonical inventory ownership model:
- catalog master in `${catalog_item_table}`,
- stock state in `${inventory_item_table}`,
- immutable events in `${inventory_ledger_table}`,
- allocations in `${inventory_reservation_table}`,
- low-latency reads in `${inventory_projection_table}`,
- integration reliability via `${integration_job_table}` and `${integration_audit_table}`.

Core principle:
- external domains do not mutate inventory state directly,
- external domains submit canonical inventory commands through adapter contracts.

### 🟧 Domain Extension Layer (AMRO Binding)
AMRO extension binds placeholders to current implementation:
- `${catalog_item_table}` -> `public.uim_catalog_items`
- `${inventory_item_table}` -> `public.uim_inventory_items`
- `${inventory_ledger_table}` -> `public.uim_inventory_ledger`
- `${inventory_reservation_table}` -> `public.uim_inventory_reservations`
- `${inventory_projection_table}` -> `public.uim_inventory_projection_snapshots`
- `${item_profile_table}` -> `public.uim_mro_item_profiles`
- `${integration_job_table}` -> `public.uim_amro_sync_jobs`
- `${integration_audit_table}` -> `public.uim_amro_sync_audit`

## 3. Refactoring Outcomes
### 🟦 Generic Core Layer
What changed:
- AMRO-first language replaced by domain-neutral inventory terminology.
- hard-coded schema naming moved to parameter placeholders.
- workflows normalized to base inventory lifecycle operations:
  - receive,
  - move,
  - reserve,
  - consume/release,
  - reconcile.

### 🟧 Domain Extension Layer
What remained domain-specific:
- AMRO execution semantics (work package/task linkage).
- AMRO profile attributes (ATA/classification/compliance overlays).
- AMRO operational scan and queue patterns where needed by current operations.

## 4. Data Model Reference
### 🟦 Generic Core Layer
Use the canonical templates in:
- [02_DOMAIN_AGNOSTIC_INVENTORY_FRAMEWORK.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/inventory-framework/02_DOMAIN_AGNOSTIC_INVENTORY_FRAMEWORK.md)
- [04_CONFIGURATION_TEMPLATES.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/inventory-framework/04_CONFIGURATION_TEMPLATES.md)

### 🟧 Domain Extension Layer
AMRO legacy-to-canonical relationship:
- legacy source patterns (`parts_inventory`, `stock_movements`, `reservations`) are migration-layer inputs,
- UIM canonical tables are target authority,
- AMRO-specific auxiliary tables (scan/reorder/work-order links) remain optional extension satellites.

## 5. API and Integration Model
### 🟦 Generic Core Layer
Canonical endpoint families:
- `POST /api/v2/inventory/commands`
- `POST /api/v2/inventory/reservations/soft`
- `GET /api/v2/inventory/availability`
- `GET /api/v2/inventory/movements`
- `POST /api/v2/inventory/projections/replay`
- `POST /api/v2/inventory/integrations/{domain}/actions`

Required controls:
- scoped authorization,
- idempotency keys for mutating calls,
- correlation IDs,
- tenant-scoped rate limits,
- retry + DLQ handling.

### 🟧 Domain Extension Layer
Current AMRO facade paths continue as extension contract bindings:
- `/api/v2/amro/inventory/sync`
- `/api/v2/amro/inventory/work-order-sync`
- `/api/v2/amro/inventory/scan`
- `/api/v2/amro/inventory/availability`
- `/api/v2/amro/inventory/reservations`

Extension policy:
- AMRO routes should delegate inventory state mutation to canonical UIM inventory services.

## 6. Migration and Compatibility Summary
### 🟦 Generic Core Layer
Migration patterns supported:
- big-bang,
- phased cohort,
- parallel run with reconciliation.

Recommended baseline:
- parallel run with reconciliation, then phased wave cutover.

### 🟧 Domain Extension Layer
AMRO-specific migration notes:
- preserve historical traceability by mapping AMRO movement records into canonical ledger metadata.
- preserve execution references (`work_package_id`, `task_id`) as extension metadata bindings.

## 7. Validation Coverage
### 🟦 Generic Core Layer
Cross-domain validation confirms support for:
- retail inventory,
- warehouse operations,
- manufacturing parts tracking.

Validation artifacts:
- [06_VALIDATION_AND_QA_REPORT.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/inventory-framework/06_VALIDATION_AND_QA_REPORT.md)

### 🟧 Domain Extension Layer
AMRO compatibility is retained through explicit placeholder bindings and adapter workflows.

## 8. Maintainer Guidance
### 🟦 Generic Core Layer
For any new domain:
1. bind placeholders,
2. map terminology to generic concepts,
3. define workflow bindings,
4. add adapter contract,
5. run neutrality + reusability validation.

### 🟧 Domain Extension Layer
For AMRO updates:
- modify AMRO extension docs only,
- avoid introducing AMRO terms back into generic core sections,
- update binding maps when schema names change.

## 9. Implementation Gap Assessment (Current vs Target)
### 9.1 Gap Summary
The documentation framework refactor is complete, but implementation alignment is partial.

Current state:
- documentation is now generic-core + domain-extension compliant.
- canonical inventory model exists in UIM.
- AMRO adapters exist, but some AMRO endpoints still mutate AMRO legacy inventory tables directly.

Target state:
- all inventory mutations occur only through canonical UIM command/reservation flows.
- AMRO inventory endpoints operate as facades/adapters only.
- legacy AMRO inventory tables become read-only bridge assets, then retired.

### 9.2 Gap Matrix
| Gap ID | Gap Description | Current Evidence | Target Requirement | Severity | Recommended Action |
|---|---|---|---|---|---|
| `GAP-01` | Direct legacy AMRO inventory writes still active | AMRO inventory endpoints write to legacy stock/reservation tables | UIM canonical write path only | High | rewire AMRO mutation endpoints to UIM command APIs |
| `GAP-02` | Generic API contract is documented but not fully exposed as unified runtime surface | mixed AMRO-prefixed and UIM-prefixed command flows | single canonical inventory command contract with domain adapters | High | introduce unified inventory gateway contract and keep AMRO paths as compatibility aliases |
| `GAP-03` | Placeholder-based schema templates are documented, but doc lint enforcement is not automated | no CI check for hard-coded domain terms in generic docs | automated neutrality enforcement in CI | Medium | add docs lint rules for forbidden tokens and hard-coded table names in core docs |
| `GAP-04` | Extension governance exists in docs but no formal review gate is defined in workflow | manual discipline only | mandatory core/extension review checklist in PR process | Medium | add PR template checks for core-neutrality and extension isolation |
| `GAP-05` | Cross-domain validation scenarios are documented, but recurring execution cadence is undefined | one-time validation report | periodic validation for at least 3 domains | Medium | schedule quarterly cross-domain validation run and archive results |
| `GAP-06` | AMRO deprecation inventory is identified, but retirement criteria are not operationalized | retirement candidates listed | measurable exit gates for each deprecated asset | Medium | define per-asset go/no-go criteria (mismatch threshold, incident-free window, consumer signoff) |
| `GAP-07` | Data quality KPI framework exists, but automated anomaly pipeline is not explicitly integrated | KPI definitions only | active monitoring with auto-alert + incident workflow | Medium | implement KPI jobs and alert routing with threshold-based incident creation |

### 9.3 Gap Closure Roadmap
#### Phase A (0-4 weeks)
- close `GAP-03`, `GAP-04`:
  - implement docs linting for neutrality and hard-coded schema detection,
  - enforce PR checklist for core/extension separation.

#### Phase B (4-10 weeks)
- close `GAP-01`, `GAP-02`:
  - rewire AMRO mutation endpoints to UIM canonical command flows,
  - publish unified inventory contract and compatibility aliases.

#### Phase C (10-16 weeks)
- close `GAP-06`, `GAP-07`:
  - activate KPI monitoring jobs and anomaly alerts,
  - formalize retirement gates and execute staged deprecation.

#### Phase D (ongoing quarterly)
- close `GAP-05` continuously:
  - run cross-domain validation cycles and publish archived reports.

### 9.4 Go/No-Go Gates for “Implementation Complete”
- `Gate-1`: 100% inventory mutations route through UIM canonical APIs.
- `Gate-2`: no direct writes to legacy AMRO inventory state tables in production traffic.
- `Gate-3`: neutrality lint + extension isolation checks block non-compliant docs changes.
- `Gate-4`: reconciliation mismatch <= 0.1% for 4 consecutive reporting cycles.
- `Gate-5`: downstream AMRO consumers sign off on adapter-only integration mode.

## 10. Status and Next Actions
Status:
- documentation framework refactor: complete.
- implementation parity with target architecture: in progress (gaps tracked in Section 9).

Immediate next actions:
- prioritize `GAP-01` endpoint rewiring and `Gate-1` achievement.
- implement CI doc-neutrality linting (`GAP-03`) in the next sprint.
- publish an implementation progress tracker keyed by `GAP-*` IDs.
