# Inventory Documentation Audit and Mapping

## Purpose
This document records the full technical documentation audit performed to identify AMRO-specific inventory language, hard-coded schema references, and domain-coupled assumptions that must be converted to a domain-agnostic inventory framework.

## Audit Scope and Method
Scope:
- `docs/**/*.md` technical documentation corpus.
- Focus areas:
  - hard-coded table references (for example `public.uim_mro_item_profiles`),
  - AMRO/MRO-specific terminology,
  - AMRO-coupled workflows and assumptions,
  - inventory-specific API and migration references.

Method:
- Pattern scans for:
  - `public.<table_name>`
  - `AMRO|amro|MRO|mro`
  - inventory table terms (`parts_inventory`, `stock_movements`, `uim_inventory_ledger`, etc.)
- Context sampling by file and line hits.
- Classification into replacement categories:
  - direct replacement,
  - parameterization,
  - split into base + extension layers.

## Scan Results Summary
Quantitative findings:
- AMRO/MRO term occurrences: `2076` across `48` files.
- Hard-coded `public.<table>` references: `796` across `36` files.
- Inventory-critical table references: `103` across `12` files.

Primary concentration files:
- `docs/UIM_AMRO_SINGLE_SOURCE_OF_TRUTH_INTEGRATION_ANALYSIS.md`
- `docs/UIM_AMRO_INTEGRATION_ARCHITECTURE.md`
- `docs/AMRO_INVENTORY_COMPREHENSIVE_IMPLEMENTATION.md`
- `docs/UIM/UIM_MRO_PLATFORM_FUNCTIONAL_MAPPING.md`
- `docs/UIM/UIM_DATA_RESET_AND_RESEED_RUNBOOK.md`
- `docs/UIM_UNIFIED_INVENTORY_SYSTEM_DESIGN.md`
- `docs/AMRO/AMRO_LOW_LEVEL_DESIGN.md`
- `docs/api/AMRO_INVENTORY_POSTMAN_UAT.md`

## Domain-Specific Element Catalog
| Element Type | Example | Usage Context | Refactor Requirement |
|---|---|---|---|
| Hard-coded table name | `public.uim_mro_item_profiles` | MRO profile schema description | Replace with `${item_profile_table}` and extension note |
| Hard-coded inventory table | `public.parts_inventory` | AMRO operational stock model | Replace with `${inventory_item_table}` in generic layer |
| Domain-specific module prefix | `amro_inventory_*` | queue/scan/work-order support tables | Replace with `${domain_prefix}_inventory_*` template |
| AMRO workflow noun | `work package`, `ATA chapter` | process narratives and examples | keep in AMRO extension only |
| AMRO ownership assumption | "AMRO writes inventory state directly" | architecture and endpoint behavior | convert to "domain adapter submits canonical inventory commands" |
| AMRO-only API path naming | `/api/v2/amro/inventory/...` | contract docs and runbooks | define generic path pattern + AMRO binding |
| Context-locked KPI language | AMRO criticality/serviceability phrasing | reporting sections | define generic KPI taxonomy with optional domain overlays |

## Hard-Coded Table Mapping Matrix
| Current Table Reference | Generic Placeholder | Replacement Rule |
|---|---|---|
| `public.uim_catalog_items` | `${catalog_item_table}` | base canonical item definition |
| `public.uim_inventory_items` | `${inventory_item_table}` | base canonical inventory state |
| `public.uim_inventory_ledger` | `${inventory_ledger_table}` | base canonical transaction log |
| `public.uim_inventory_reservations` | `${inventory_reservation_table}` | base reservation lifecycle |
| `public.uim_inventory_projection_snapshots` | `${inventory_projection_table}` | base read model |
| `public.uim_mro_item_profiles` | `${item_profile_table}` | optional domain extension profile |
| `public.parts_inventory` | `${legacy_domain_inventory_table}` | legacy adapter migration source |
| `public.stock_movements` | `${legacy_domain_movement_table}` | legacy movement source |
| `public.reservations` | `${legacy_domain_reservation_table}` | legacy reservation source |
| `public.amro_inventory_scan_events` | `${domain_prefix}_inventory_scan_events` | optional extension table |
| `public.amro_inventory_reorder_queue` | `${domain_prefix}_inventory_reorder_queue` | optional extension queue |
| `public.amro_inventory_work_order_links` | `${domain_prefix}_inventory_work_order_links` | optional execution bridge |

## Workflow and Business Rule Baseline (AMRO Reference Snapshot)
The following AMRO-specific inventory logic is retained as reference for extension-layer documentation:
- Inventory quantity state maintained in `parts_inventory` with `quantity_on_hand`, `quantity_reserved`, and generated availability.
- Movement tracking in `stock_movements` by typed movement plus positive quantity.
- Reservation linkage to `work_package_id` and `task_id`.
- Scan lifecycle tracking via `amro_inventory_scan_events`.
- Reorder queue generation via `amro_inventory_reorder_queue`.
- Work-order posting trace via `amro_inventory_work_order_links`.

These are not removed from documentation history; they are moved to extension-layer references.

## Refactor Impact Classification
| File Group | Refactor Type | Action |
|---|---|---|
| UIM-AMRO integration docs | deep rewrite | split into generic core + AMRO extension appendices |
| UIM design docs with SQL snippets | parameterization | replace concrete names with placeholders and provide example bindings |
| AMRO implementation guides | extension isolation | keep AMRO details in extension layer only |
| API UAT docs | contract abstraction | define canonical API, then domain-specific route bindings |
| runbooks with direct SQL | templating | convert to parameterized SQL template blocks |

## Replacement Policy
- Generic layer must not contain:
  - domain names (`AMRO`, `MRO`, `retail`, etc.) in normative statements.
  - hard-coded schema/table names.
  - domain-specific workflows as mandatory flow.
- Extension layer may contain domain specifics but must:
  - reference generic concept IDs,
  - use explicit binding tables,
  - avoid redefining core concepts.

## Completion Criteria for Genericization
- 100% of inventory architecture docs include placeholder schema references in base layer.
- 100% of AMRO-specific terms moved to extension sections or extension documents.
- All examples provide at least one generic form and one optional domain binding form.
- Validation report confirms support for at least three non-AMRO domains.
