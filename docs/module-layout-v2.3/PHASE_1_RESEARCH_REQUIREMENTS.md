# Phase 1 – Research & Requirements Discovery

Duration target: 5 working days  
Status: Completed (engineering baseline report)

## 1.1 Data Entities, API Endpoints, and Schema Catalog
### Entity Families (AMRO + UIM integration context)
- Inventory core:
  - `parts_inventory`
  - `stock_movements`
  - `reservations`
  - `amro_inventory_reorder_queue`
  - `amro_inventory_scan_events`
  - `amro_inventory_work_order_links`
- Inventory analytics/read model:
  - `amro_inventory_health_overview` (view)
- UIM canonical sync targets:
  - `uim_catalog_items`
  - `uim_inventory_items`
  - `uim_inventory_ledger`
  - `uim_inventory_reservations`
  - `uim_inventory_projection_snapshots`
  - `uim_amro_sync_jobs`, `uim_amro_sync_audit`

### API Endpoint Coverage
- AMRO inventory APIs:
  - `/api/v2/amro/inventory/sync`
  - `/api/v2/amro/inventory/work-order-sync`
  - `/api/v2/amro/inventory/scan`
  - `/api/v2/amro/inventory/availability`
  - `/api/v2/amro/inventory/reservations`
- AMRO master-data APIs:
  - `/api/v2/amro/master-data/[entity]`
  - `/api/v2/amro/master-data/[entity]/[id]`
- AMRO contract APIs:
  - `/api/v2/amro/contracts/openapi-3.1.*`
  - `/api/v2/amro/contracts/asyncapi-2.6.*`

Discovery evidence:
- `src/pages/api/v2/amro` contains 52 API files.
- AMRO migrations include 83 `CREATE TABLE` occurrences across 24 migration files.

### Volume / Velocity / Variety (3V) Metrics Baseline
| Metric | Baseline Source | Current Reading | Implication |
|---|---|---:|---|
| Volume | Storybook data profile and AMRO inventory table model | 10k row design target | requires virtualization and bounded re-render policy |
| Velocity | scan + work-order mutation workflows | burst writes in operational windows | event stream must support low-latency append and backpressure |
| Variety | mixed fields (text, numeric, date, boolean, object) | 5+ data classes in record detail | dynamic form rendering and schema-based validation required |

## 1.2 Gap Analysis Matrix
| Requirement | Existing Grid | Existing Record Detail | Gap | Required Change |
|---|---|---|---|---|
| Event Stream panel | partially present in Storybook demo-only event log | N/A | no production-grade stream surface | add reusable side panel + state channel |
| CRUD Events visibility | icon actions exist in detail | callback-only unless story wired | no guaranteed operational trace UI | add persistent CRUD event timeline panel |
| Viewport Validation Checklist | checklist text only in story panel | N/A | no runtime validator model | add rule engine + sticky checklist banner |
| Persistent restore from collapsed detail | previously weak | previously weak | control could disappear in collapse edge state | fixed with floating restore + keyboard shortcut |
| 1366x768 no horizontal scroll | partially improved | improved | requires formal validation gate | add testable checklist + viewport scenario |

## 1.3 Non-Functional Constraints
| Constraint | Target | Engineering Response |
|---|---|---|
| Render time (10k rows) | < 120 ms | virtualized rows, memoized cells, debounced scroll |
| Memory ceiling | <= 150 MB/tab | bounded in-memory event buffer + lazy detail sections |
| Concurrency scale | 5,000 sessions | stateless API + websocket fanout partitioning design |
| GDPR + SOC-2 | mandatory | PII minimization, audit trail, retention and access controls |

## 1.4 Third-Party Integration Touchpoints + SLA Limits
| Touchpoint | Role | SLA/SLO Constraint |
|---|---|---|
| Supabase Auth (`supabase.auth`) | identity + tenant scope | auth latency p95 < 300 ms |
| PostHog (`src/lib/posthog.ts`) | product analytics | event delivery async, non-blocking UI |
| Sentry (`src/lib/sentry.ts`) | error telemetry | error pipeline must not block UI thread |
| AMRO contract publication endpoints | integration contracts | schema stability and versioning gate |
| Internal network logger / audit pipeline | compliance logs | durable delivery with retry and redaction |

## Phase 1 Exit Criteria
- Entity + endpoint catalog complete.
- Requirement gap matrix complete.
- NFR constraints codified.
- External touchpoint and SLA mapping documented.
