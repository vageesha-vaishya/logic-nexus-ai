# AMRO -> Parts Module Architecture and Storybook Implementation

## 1) Scope and Objective
This document provides a technical research analysis of the AMRO Parts module architecture, functionality, data structure, and integration behavior, followed by the Storybook implementation blueprint and delivered component package for parts inventory management.

## 2) Architecture Overview
The AMRO Parts capability is implemented as a hybrid of:
- AMRO master-data CRUD surfaces for part inventory records and related entities.
- AMRO inventory operational APIs (`sync`, `work-order-sync`, `scan`, placeholders for availability/reservations).
- UIM integration bridge for canonical inventory synchronization.

Primary architectural domains:
1. UI/Workflow Layer:
- AMRO settings master data pages and entity table frames.
- reusable template components and data table patterns.

2. API Contract Layer:
- AMRO OpenAPI contract (`src/pages/api/v2/amro/contracts/openapi-3.1.yaml`).
- integration contract endpoint (`src/pages/api/v2/amro/integration-contracts.ts`).

3. Data Access Layer:
- AMRO master-data API handlers (`src/pages/api/v2/amro/master-data/[entity].ts`, `shared.ts`).
- scoped RLS-aware DB access with tenant/franchise enforcement.

4. Inventory Operations Layer:
- `src/pages/api/v2/amro/inventory/sync.ts`
- `src/pages/api/v2/amro/inventory/work-order-sync.ts`
- `src/pages/api/v2/amro/inventory/scan.ts`
- `src/pages/api/v2/amro/inventory/availability.ts` (placeholder)
- `src/pages/api/v2/amro/inventory/reservations.ts` (placeholder)

5. Persistence Layer:
- AMRO inventory tables and views in Supabase migrations.
- UIM canonical inventory tables for sync targets.

## 3) Module Components and Responsibilities
## 3.1 UI Components
- `AmroSettingsMasterDataPage`: configurable entity management shell for AMRO master data.
- `AircraftDataTableFrame`: table frame with record-level actions and standard controls.
- `DataTable`: shared table rendering and column/row interaction behavior.
- `AmroInventoryDataGridTemplate`: multi-layout (horizontal, vertical, stacked) grid+detail system with virtualization and accessibility.
- `AmroPartsInventoryWorkbench` (new): Parts inventory operation-focused composition including KPIs, filters, distributions, and grid-detail workflow.

## 3.2 API Components
- Master data generic handlers:
  - support list/create/update/delete by entity.
  - include row-level scoping and guard checks.
- Inventory operation handlers:
  - `sync`: AMRO inventory synchronization and UIM binding.
  - `work-order-sync`: reserve/consume/release/return operations linked to work package/task contexts.
  - `scan`: scan event logging and inventory mutation workflows.

## 3.3 Data and Governance Components
- RLS-enabled table access.
- AMRO schema expansion and inventory-comprehensive migration scripts.
- compatibility and integration contracts for external consumers.

## 4) Data Structure and Schemas
## 4.1 Core AMRO Parts Tables
Primary inventory entities:
- `public.parts_inventory`
- `public.stock_movements`
- `public.reservations`
- `public.amro_inventory_reorder_queue`
- `public.amro_inventory_scan_events`
- `public.amro_inventory_work_order_links`
- `public.amro_inventory_health_overview` (view)

Functional schema observations:
- `parts_inventory` carries mixed concerns:
  - master item identity (`part_number`, `description`, classification fields),
  - current stock state (`quantity_on_hand`, `quantity_reserved`, `quantity_available`),
  - compliance/tracking fields (`certification_*`, `traceability_data`, `regulatory_compliance`, `barcode_value`, `rfid_tag`).
- `stock_movements` stores transactional movements by typed movement semantics.
- `reservations` binds inventory reservations to work package/task contexts.
- reorder/scan/work-order-link tables capture operational workflow satellite data.

## 4.2 UIM Integration-Relevant Structures
Sync and canonical bridge tables:
- `uim_catalog_items`
- `uim_inventory_items`
- `uim_inventory_reservations`
- `uim_inventory_ledger`
- `uim_inventory_projection_snapshots`
- `uim_amro_sync_jobs`
- `uim_amro_sync_audit`

Integration implication:
- AMRO remains rich in operational context while UIM increasingly owns canonical inventory state and ledger history.

## 5) API Endpoint Specifications
## 5.1 AMRO Inventory Endpoints
| Endpoint | Method | Purpose | Current Behavior |
|---|---|---|---|
| `/api/v2/amro/inventory/sync` | POST | AMRO to UIM inventory synchronization | transforms payload to canonical UIM entities and writes sync telemetry |
| `/api/v2/amro/inventory/work-order-sync` | POST | reserve/consume/release/return linked to work orders | performs inventory mutation and work-order link/audit updates |
| `/api/v2/amro/inventory/scan` | POST | barcode/RFID/manual scan capture and inventory action | logs scan events and inventory action outcomes |
| `/api/v2/amro/inventory/availability` | GET | availability retrieval | placeholder/stub response currently |
| `/api/v2/amro/inventory/reservations` | POST | reservation operations | placeholder/stub response currently |

## 5.2 AMRO Master Data Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v2/amro/master-data/[entity]` | GET | list entity records with scoped access |
| `/api/v2/amro/master-data/[entity]` | POST | create record |
| `/api/v2/amro/master-data/[entity]` | PUT | update record |
| `/api/v2/amro/master-data/[entity]` | DELETE | soft/hard delete pattern based on entity |

## 5.3 Integration Contracts
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v2/amro/integration-contracts` | GET | publish AMRO integration API contract metadata |
| `/api/v2/amro/contracts/openapi-3.1.yaml` | GET | full OpenAPI document for external integration use |

## 6) Data Flow Patterns
## 6.1 Parts Master Data CRUD Flow
1. UI selects AMRO master-data entity (parts inventory and related entities).
2. API request sent to `/api/v2/amro/master-data/[entity]`.
3. Handler resolves entity config, auth context, and scoped data access.
4. Response is transformed to table/view model consumed by UI frame.

## 6.2 Work-Order Inventory Flow
1. Work-order action triggers `work-order-sync` API.
2. API validates action intent and inventory quantities.
3. Mutation written to AMRO inventory transactional structures.
4. Operational linkage captured in work-order link structures.
5. Response returns action status + updated inventory state snapshot.

## 6.3 Scan-Driven Inventory Flow
1. Scan input (barcode/RFID/manual) submitted to `scan` API.
2. Event stored in scan event stream with status and validation output.
3. Matching inventory record identified; action applied.
4. Error/status returned for reconciliation and operator feedback.

## 6.4 AMRO-UIM Synchronization Flow
1. AMRO sync payload submitted to `/api/v2/amro/inventory/sync`.
2. Mapping from AMRO fields to UIM canonical structures.
3. UIM inventory entities/reservations updated.
4. Sync telemetry written to AMRO/UIM sync tracking tables.

## 7) Integration Points
Internal integration points:
- AMRO settings module <-> master-data API.
- AMRO inventory operation APIs <-> AMRO inventory tables.
- AMRO sync endpoint <-> UIM canonical inventory tables.

Cross-cutting integration points:
- auth and permission middleware.
- tenant/franchise scoped data-access controls.
- OpenAPI contract publication for external integration clients.

## 8) Functional and Technical Assessment
Strengths:
- clear operational partitioning between master-data management and inventory actions.
- robust AMRO domain-specific metadata support (criticality, compliance, scan traceability).
- API contract surfaces available for integration alignment.
- existing reusable UI grid templates support advanced interaction and responsiveness.

Constraints/Gaps:
- availability and reservations endpoints currently placeholder-only.
- partial mixed ownership between AMRO operational state and UIM canonical sync direction.
- parts inventory table still carries multiple concerns (master + operational + compliance) that can complicate strict normalization.

## 9) Storybook Implementation (Delivered)
Implemented component package:
- `src/features/module-amro/components/parts/AmroPartsInventoryWorkbench.tsx`
- `src/features/module-amro/components/parts/AmroPartsInventoryWorkbench.stories.tsx`
- `src/features/module-amro/components/parts/mockPartsInventoryData.ts`
- `src/features/module-amro/components/parts/AmroPartsInventoryWorkbench.test.tsx`
- `src/features/module-amro/components/parts/README.md`

## 9.1 Storybook Scenarios
- `Populated`: full realistic dataset with interactive filtering and grid-detail navigation.
- `Loading`: async loading indicator state.
- `Empty`: no records + reset-filter action path.
- `ErrorState`: failure path with retry action.
- `VerticalWorkflow`: top-grid/bottom-detail workflow.
- `ResponsiveStacked`: adaptive layout + infinite scrolling behavior.

## 9.2 Implemented Functional Features
- Multi-layout design:
  - horizontal split,
  - vertical split,
  - responsive stacked.
- Realistic parts inventory mock generation with:
  - stock levels,
  - reservation counts,
  - criticality,
  - certification/expiry metadata,
  - scan traceability metadata.
- KPI and visualization layer:
  - total items, low stock, critical, inventory value.
  - status and criticality distribution bars.
- Interaction model:
  - record selection, detail rendering, filter controls, refresh/add/retry actions.
  - callback event streams for selection/scroll/view mode.

## 9.3 Accessibility and Performance
Accessibility:
- labeled controls, semantic cards and grids, keyboard-ready navigation inherited from template.
- visible state messaging for loading/error/empty.

Performance:
- memoized columns, filters, metrics, and distributions.
- virtualized and alternate scroll strategies via grid template.
- debounced scroll event handling and persisted view state.

## 10) Test Coverage
Automated tests in `AmroPartsInventoryWorkbench.test.tsx` validate:
- loading state render.
- empty state render.
- error state + retry interaction.
- ready state controls and interaction surface.
- filter interaction behavior.

## 11) Recommended Next Engineering Steps
1. Implement non-placeholder logic for `availability` and `reservations` endpoints.
2. Align work-order and scan write paths with canonical UIM command patterns where required.
3. Add contract tests validating OpenAPI schema behavior for inventory operation endpoints.
4. Add Storybook interaction tests for keyboard-only navigation and accessibility assertions.
