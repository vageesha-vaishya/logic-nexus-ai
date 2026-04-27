# AMRO Parts Inventory Implementation Blueprint

## 1) Purpose
This blueprint converts AMRO Parts feasibility findings into an execution-ready plan with:
- milestone gates
- RACI ownership
- schema/API backlog tickets
- acceptance criteria for engineering release

Scope covers the AMRO inventory sub-modules:
- Item Master
- Stock Ledger
- Reservations
- Issue and Consume
- Restock
- Locations
- Analytics

---

## 2) Current-State Baseline
Current implementation already includes:
- Live Parts CRUD API (`/api/v2/amro/parts`, `/api/v2/amro/parts/{id}`)
- lifecycle validation and MRO workflow event triggering
- audit logging for create/update/delete
- AMRO Parts UI workbench and live API adapter
- auth diagnostics for 401/403 troubleshooting

Reference assets:
- `docs/amro-parts/DEPLOYMENT_READY_MODULE.md`
- `src/pages/api/v2/amro/parts/index.ts`
- `src/pages/api/v2/amro/parts/[id].ts`
- `src/pages/api/v2/amro/parts/shared.ts`
- `supabase/migrations/20260408150000_amro_parts_realtime_workflows.sql`

Known gaps to close for full MRO inventory operations:
- immutable accounting-grade stock ledger discipline
- full reservation priority and hard/soft allocation orchestration
- complete issue/consume reversal and cost posting model
- replenishment automation and procurement integration
- location hierarchy (site/warehouse/zone/bin) and directed movement
- inventory analytics mart and forecasting layer

---

## 3) Target Architecture
### 3.1 Domain Services
- `item-master-service`
- `stock-ledger-service`
- `reservation-orchestrator`
- `issue-consume-service`
- `restock-planner`
- `location-service`
- `inventory-analytics-service`

### 3.2 Data Architecture
- Command model: write immutable inventory events and validated transactions.
- Projection model: maintain fast read tables for UI and KPI dashboards.
- Multi-tenant boundaries: enforce `tenant_id` and `franchise_id` in all read/write paths.

### 3.3 Integration Architecture
- Work order sync interface for reserve/consume/release.
- Procurement/ERP adapter for PO, ASN, GRN, invoice cost feeds.
- Compliance/quality adapter for quarantine and release-to-service outcomes.

---

## 4) Implementation Roadmap With Milestone Gates
## Phase 1: Foundation Hardening (Weeks 1-4)
Goals:
- standardize canonical data model
- close integrity and validation gaps
- establish tenant-safe access and audit consistency

Gate P1 Exit Criteria:
- schema and API contracts approved
- migration scripts validated in staging
- no critical data integrity defects in CRUD and lifecycle paths

## Phase 2: Reservation and Consumption Core (Weeks 5-10)
Goals:
- implement hard/soft reservation policy engine
- implement issue/consume/release with reversals
- integrate work package/task linkage and material usage attribution

Gate P2 Exit Criteria:
- deterministic allocation under contention
- complete audit and ledger traceability from reservation to consumption
- UAT signoff from planner/storekeeper personas

## Phase 3: Restock and Location Intelligence (Weeks 11-16)
Goals:
- reorder policy and replenishment planning
- procurement handoff and receiving flow
- multi-site location hierarchy and movement controls

Gate P3 Exit Criteria:
- reorder recommendations with explainable model outputs
- location-level inventory visibility with movement history
- cycle count and variance reconciliation operational

## Phase 4: Analytics and Governance at Scale (Weeks 17-24)
Goals:
- KPI data mart and dashboard suite
- forecasting and anomaly detection
- operating governance, SLA evidence, and runbooks

Gate P4 Exit Criteria:
- executive dashboard baseline live
- agreed KPI service levels achieved
- runbook and onboarding package approved by operations and QA

---

## 5) RACI Matrix (High-Level)
Roles:
- `PO`: Product Owner
- `AMRO-BA`: AMRO Business Analyst
- `PLAT-ARCH`: Platform Architect
- `BE`: Backend Engineering
- `FE`: Frontend Engineering
- `DBA`: Data/Database Engineering
- `INT`: Integration Engineering
- `QA`: QA and Test Engineering
- `SEC`: Security and Compliance
- `OPS`: Operations/SRE

### Workstream Ownership
- Item Master: R=`BE/DBA`, A=`PLAT-ARCH`, C=`AMRO-BA, QA`, I=`PO, OPS`
- Stock Ledger: R=`BE/DBA`, A=`PLAT-ARCH`, C=`SEC, QA`, I=`PO, OPS`
- Reservations: R=`BE`, A=`PLAT-ARCH`, C=`AMRO-BA, FE, QA`, I=`PO, OPS`
- Issue and Consume: R=`BE/INT`, A=`PLAT-ARCH`, C=`AMRO-BA, QA`, I=`PO, OPS`
- Restock: R=`BE/INT`, A=`PO`, C=`AMRO-BA, DBA, QA`, I=`OPS`
- Locations: R=`BE/DBA/FE`, A=`PLAT-ARCH`, C=`AMRO-BA, QA`, I=`PO, OPS`
- Analytics: R=`DBA/BE/FE`, A=`PO`, C=`AMRO-BA, QA`, I=`OPS, SEC`
- Security and Access Controls: R=`SEC/BE`, A=`PLAT-ARCH`, C=`DBA, QA`, I=`PO`

---

## 6) Engineering Backlog Tickets (Schema and API)
Ticket IDs are proposed and can be mirrored in Jira/Linear.

### EPIC A: Item Master
- `AMRO-INV-SCH-001`: Add alternate/interchangeable part relationship table.
- `AMRO-INV-SCH-002`: Add shelf-life, lot, and serialization attributes.
- `AMRO-INV-API-001`: Extend item master endpoints with versioned metadata payload.
- `AMRO-INV-API-002`: Add item classification endpoints (ATA, commodity, hazard flags).

### EPIC B: Stock Ledger
- `AMRO-INV-SCH-010`: Create immutable `amro_inventory_ledger_events` table.
- `AMRO-INV-SCH-011`: Add valuation columns and costing method support.
- `AMRO-INV-API-010`: Add ledger query endpoints with balance snapshots.
- `AMRO-INV-API-011`: Add reconciliation endpoint and variance reason codes.

### EPIC C: Reservations
- `AMRO-INV-SCH-020`: Add reservation policy table (hard/soft/priority/expiry).
- `AMRO-INV-API-020`: Implement reservation arbitration endpoint with priority model.
- `AMRO-INV-API-021`: Add bulk reservation API by work package planning horizon.
- `AMRO-INV-API-022`: Add reservation expiry and auto-release scheduler.

### EPIC D: Issue and Consume
- `AMRO-INV-SCH-030`: Add consumption transaction table with reverse links.
- `AMRO-INV-API-030`: Add consume endpoint by task and mechanic reference.
- `AMRO-INV-API-031`: Add reverse/adjust consume endpoint with approval checks.
- `AMRO-INV-INT-030`: Work order completion callback integration for auto-consume.

### EPIC E: Restock
- `AMRO-INV-SCH-040`: Add replenishment policy table (ROP, safety stock, lead time).
- `AMRO-INV-API-040`: Reorder recommendation endpoint with scoring explanation.
- `AMRO-INV-INT-040`: Purchase request/PO integration adapter.
- `AMRO-INV-INT-041`: Receiving and ASN sync endpoint with discrepancy handling.

### EPIC F: Locations
- `AMRO-INV-SCH-050`: Add location hierarchy tables (site, warehouse, zone, bin).
- `AMRO-INV-SCH-051`: Add movement reason and approval policy mapping.
- `AMRO-INV-API-050`: Directed put-away and pick suggestion endpoint.
- `AMRO-INV-API-051`: Cycle count and location variance capture endpoint.

### EPIC G: Analytics
- `AMRO-INV-DWH-060`: Build inventory KPI materialized views.
- `AMRO-INV-API-060`: Analytics endpoint for stockout risk, aging, and turns.
- `AMRO-INV-ML-061`: Forecasting service for demand and replenishment.
- `AMRO-INV-FE-060`: Dashboard widgets for planner/storekeeper/executive personas.

### EPIC H: Security and Governance
- `AMRO-INV-SEC-070`: Add granular inventory permission slugs and checks.
- `AMRO-INV-SEC-071`: Add policy tests for tenant/franchise data isolation.
- `AMRO-INV-OPS-070`: SLA monitor for API latency, reconciliation failures, and queue lag.
- `AMRO-INV-DOC-070`: Operations runbook and incident playbook publication.

---

## 7) Integration Requirements
- Work Orders:
  - reserve, consume, release, reverse APIs with idempotency keys
  - linkage by `work_order_id`, `task_id`, `aircraft_id`, and execution user
- Procurement:
  - supplier, PO, ASN, receipt, and invoice feeds
  - discrepancy and backorder states
- Finance:
  - cost attribution per task/work package
  - valuation and adjustment journals
- Quality/Compliance:
  - quarantine and inspection verdict feeds
  - release-to-service checkpoints and signoff

---

## 8) Data Migration Strategy
### 8.1 Migration Principles
- Expand-first, contract-later.
- No destructive schema changes during active cutover.
- Dual-write where needed for high-risk transaction flows.

### 8.2 Migration Waves
- Wave 1: Item master enrichment and location hierarchy backfill.
- Wave 2: Ledger event table backfill from existing movement/reservation traces.
- Wave 3: Reservation policy and status migration with replay validation.
- Wave 4: Analytics mart bootstrap and KPI baseline calibration.

### 8.3 Validation Controls
- row-count parity checks
- stock balance parity by part/location
- tenant-franchise boundary validation
- sample-based traceability audit from transaction to dashboard

---

## 9) Risk Register and Mitigation
- Data integrity drift:
  - Mitigation: immutable ledger + nightly reconciliation + alerting.
- Integration outage:
  - Mitigation: retry with idempotency, dead-letter queues, replay jobs.
- Regulatory non-compliance:
  - Mitigation: mandatory audit fields, signed approvals for critical actions.
- Performance degradation:
  - Mitigation: projection tables, targeted indexes, async heavy processing.
- Rollout regression:
  - Mitigation: phased tenant rollout, feature flags, rollback scripts per phase.

---

## 10) Cost-Benefit and ROI Framework
### 10.1 Cost Components
- engineering implementation (schema, API, UI, integration)
- infrastructure and observability uplift
- UAT, training, and change management

### 10.2 Benefit Components
- reduced stockouts and AOG delays
- reduced overstock and carrying costs
- faster maintenance execution due to parts certainty
- improved audit readiness and reduced compliance effort

### 10.3 ROI Measurement Window
- baseline period: 8 weeks pre-rollout
- stabilization period: 12 weeks post-rollout
- KPI compare:
  - stockout rate
  - reservation fulfillment SLA
  - mean time to issue
  - inventory turns
  - carrying cost per part class

---

## 11) Testing Strategy and Acceptance Criteria
### 11.1 Test Layers
- Unit:
  - validators, policy engines, lifecycle transitions, cost math
- Integration:
  - reserve -> issue -> consume -> reverse flows
  - procurement and work-order connector paths
- Contract:
  - API schema backward compatibility and error contract stability
- Performance:
  - P95 latency and throughput at target concurrent load
- Security:
  - authz negative tests and tenant isolation tests

### 11.2 Acceptance Criteria
- all critical paths have deterministic outcomes and audit trails
- no unresolved critical/high defects in UAT
- reconciliation variance below agreed threshold
- role-based access fully enforced for mutating operations
- rollback drill validated in staging before production promotion

---

## 12) Milestone Gate Checklist
### Gate A (End Phase 1)
- schema migration dry-run complete
- API contract docs updated
- test coverage threshold met for modified services

### Gate B (End Phase 2)
- reservation arbitration validated under concurrency tests
- issue/consume with reversal verified in UAT

### Gate C (End Phase 3)
- replenishment recommendations validated with operations
- location transfer and cycle count controls operational

### Gate D (End Phase 4)
- KPI dashboards in production with SLA alerts
- operational playbooks and onboarding complete

---

## 13) Immediate Next 10-Day Execution Plan
- Day 1-2: finalize schema RFC for ledger and location hierarchy.
- Day 3-4: open and groom tickets `AMRO-INV-SCH-010/050` and `AMRO-INV-API-020/030`.
- Day 5-6: implement reservation arbitration MVP and tests.
- Day 7-8: implement issue/consume with reversal scaffolding.
- Day 9: staging reconciliation dry run and defect triage.
- Day 10: milestone review and go/no-go for Phase 2 scale-out.

---

## 14) Governance Cadence
- Weekly: engineering delivery review and blocker triage.
- Bi-weekly: architecture and security checkpoint.
- Monthly: KPI outcome review with operations and product.

This document is the execution baseline for AMRO Parts Inventory domain expansion and should be updated at each phase gate.

---

## 15) Module Enhancement Strategy (AMRO -> Parts -> UIM)
This section defines implementation-planning details for each requested core module.

### 15.1 Item Master Module
Objectives:
- establish a canonical, governed part master
- support MRO classification and cross-reference intelligence
- ensure compatibility with AMRO and UIM schemas

Planned capabilities:
- part numbering policy engine with configurable prefixes and check rules
- classification hierarchy: ATA chapter -> category -> subcategory -> criticality class
- attribute framework: serialized flag, lot/shelf-life, interchangeability, hazard tags
- cross-reference graph: OEM PN, supplier PN, alternate PN, superseded/replacement PN
- lifecycle governance: draft, active, inspection_due, needs_repair, obsolete, retired
- UOM conversion matrix with precision and rounding policy

Data model additions:
- `amro_item_master`
- `amro_item_classification_nodes`
- `amro_item_attribute_definitions`
- `amro_item_cross_references`
- `amro_uom_conversions`

API backlog focus:
- `GET/POST/PATCH /api/v2/amro/item-master`
- `GET/POST /api/v2/amro/item-master/classifications`
- `GET/POST /api/v2/amro/item-master/cross-references`

Acceptance criteria:
- create/update validation enforces numbering, lifecycle, and UOM rules
- alternates and supersessions resolve within 100ms P95 for single-item lookup
- no duplicate active master records for same canonical part key per tenant

### 15.2 Stock Ledger Module
Objectives:
- provide accounting-grade, immutable inventory transaction history
- guarantee auditable balances by part, location, and period

Planned capabilities:
- append-only ledger events with transaction types (`RECEIPT`, `ISSUE`, `RESERVE`, `RELEASE`, `ADJUST`, `TRANSFER`)
- valuation engine supporting FIFO, LIFO, weighted average
- snapshot and replay for period-end close and reconciliation
- automated discrepancy detection and exception queue
- close lock with controlled reopening workflow

Data model additions:
- `amro_inventory_ledger_events`
- `amro_inventory_cost_layers`
- `amro_inventory_period_closes`
- `amro_inventory_reconciliation_runs`

API backlog focus:
- `GET /api/v2/amro/inventory/ledger`
- `POST /api/v2/amro/inventory/ledger/reconcile`
- `POST /api/v2/amro/inventory/ledger/close-period`

Acceptance criteria:
- full transaction lineage from source document to balance impact
- period close rejects posting unless privileged reopen is approved
- valuation outputs match configured method within tolerance threshold

### 15.3 Reservations Module
Objectives:
- guarantee availability of critical parts for planned and active work
- avoid deadlocks and reservation conflicts in multi-team operations

Planned capabilities:
- hard and soft reservation policy per item class
- priority model: AOG > scheduled heavy check > routine maintenance
- reservation expiry, auto-release, and extension approval workflow
- overlap conflict detection and deterministic arbitration
- reservation simulation mode for planning horizon

Data model additions:
- `amro_reservation_policies`
- `amro_inventory_reservations_v2`
- `amro_reservation_conflicts`
- `amro_reservation_release_jobs`

API backlog focus:
- `POST /api/v2/amro/inventory/reservations/arbitrate`
- `POST /api/v2/amro/inventory/reservations/release-expired`
- `GET /api/v2/amro/inventory/reservations/conflicts`

Acceptance criteria:
- no over-allocation under concurrent requests
- expired soft reservations auto-release within SLA window
- conflict queue supports user action with full audit trail

### 15.4 Issue and Consume Module
Objectives:
- track operational usage precisely and post costs to execution context
- support reverse and correction controls without ledger corruption

Planned capabilities:
- issue types: work order, project, departmental, ad-hoc emergency
- automated consume posting on maintenance completion events
- return-to-stock and reverse-consume workflows with approvals
- barcode/RFID/manual capture modes with scan event telemetry
- technician and task-level attribution

Data model additions:
- `amro_issue_transactions`
- `amro_consumption_transactions`
- `amro_return_to_stock_transactions`
- `amro_scan_events` (extended)

API backlog focus:
- `POST /api/v2/amro/inventory/issue`
- `POST /api/v2/amro/inventory/consume`
- `POST /api/v2/amro/inventory/reverse-consume`
- `POST /api/v2/amro/inventory/scan`

Acceptance criteria:
- every issue/consume has linked source and ledger event IDs
- reverse transactions never mutate historical ledger rows in place
- scan-assisted processing improves transaction throughput benchmark

### 15.5 Restock Module
Objectives:
- automate replenishment while minimizing stockouts and excess carrying cost
- integrate with supplier and procurement processes

Planned capabilities:
- min-max and reorder-point planning
- EOQ and safety stock calculations
- supplier lead-time and fill-rate aware recommendation scoring
- auto-draft PO proposals and receipt workflow integration
- quality inspection checkpoints for inbound stock

Data model additions:
- `amro_restock_policies`
- `amro_restock_recommendations`
- `amro_supplier_performance_scores`
- `amro_receipt_inspection_results`

API backlog focus:
- `GET /api/v2/amro/inventory/restock/recommendations`
- `POST /api/v2/amro/inventory/restock/generate-po`
- `POST /api/v2/amro/inventory/restock/receive`

Acceptance criteria:
- recommendation engine explains each reorder reason
- inbound receipt can be blocked by failed quality criteria
- supplier score affects recommendation priority in policy mode

### 15.6 Locations Module
Objectives:
- support multi-warehouse and bin-level precision
- optimize picking paths and space utilization

Planned capabilities:
- hierarchy model: site -> warehouse -> zone -> aisle -> bin
- capacity constraints by volume, weight, and hazard class
- directed put-away and zone-based pick optimization
- movement authorization for controlled zones
- 3D map integration contract and space utilization metrics

Data model additions:
- `amro_location_nodes`
- `amro_location_capacity_profiles`
- `amro_bin_utilization_snapshots`
- `amro_inventory_movements`

API backlog focus:
- `GET/POST /api/v2/amro/inventory/locations`
- `POST /api/v2/amro/inventory/movements/transfer`
- `GET /api/v2/amro/inventory/locations/utilization`

Acceptance criteria:
- all on-hand balances resolvable to bin-level location
- transfer execution enforces zone restrictions and approvals
- utilization metrics available by site and warehouse

### 15.7 Analytics Module
Objectives:
- deliver role-based operational intelligence and predictive control
- improve decision speed for planning and execution teams

Planned capabilities:
- real-time dashboard cards for stock health, reservation SLA, issue latency
- KPI suite: inventory turns, service level, aging, stockout risk, fill rate
- ABC/XYZ segmentation and obsolescence tracking
- demand forecasting and anomaly detection
- configurable reports by role and business unit

Data model additions:
- `amro_inventory_kpi_daily`
- `amro_inventory_forecast_runs`
- `amro_inventory_anomaly_flags`
- `amro_inventory_report_definitions`

API backlog focus:
- `GET /api/v2/amro/inventory/analytics/kpis`
- `GET /api/v2/amro/inventory/analytics/forecast`
- `POST /api/v2/amro/inventory/analytics/reports/run`

Acceptance criteria:
- KPI refresh latency meets agreed near-real-time target
- forecast models versioned and reproducible
- report access strictly role-scoped with tenant-franchise isolation

---

## 16) Enterprise Controls and NFR Standards
### 16.1 Security and Access Control
- enforce least-privilege role permissions for every mutating endpoint
- mandatory tenant/franchise scoping and audit fields on writes
- structured auth diagnostics for token, permission, scope, and domain failures

### 16.2 Data Integrity
- optimistic concurrency token on mutable records
- immutable event sourcing for stock/valuation/reservation critical actions
- referential integrity and domain constraints enforced at DB and API layers

### 16.3 Multi-Language and Multi-Currency
- store display labels via i18n key references, not hardcoded text
- valuation and procurement amounts use currency code + precision policy
- reporting supports per-tenant base currency and translated UI labels

### 16.4 Performance Benchmarks
- list/query APIs: P95 < 500ms under target load
- reservation arbitration: P95 < 350ms
- issue/consume posting: P95 < 300ms
- KPI dashboard initial load: P95 < 1.2s with cached projections

---

## 17) Deployment and Release Procedure
### 17.1 Pre-Deployment
- schema migration dry-run in staging with production-like data volume
- contract test pass for all AMRO/UIM interfaces
- reconciliation baseline captured before feature enablement

### 17.2 Rollout
- tenant canary deployment with feature flags per module
- progressive expansion by franchise cohorts
- live monitoring for error rate, latency, and reconciliation deltas

### 17.3 Post-Deployment
- run reconciliation and audit completeness checks
- execute rollback trigger if variance exceeds threshold
- publish release notes and known-issue log to operations

### 17.4 UAT and Go-Live Signoff
- UAT scenarios signed by planner, storekeeper, maintenance controller
- security and compliance signoff completed
- production readiness review approved by architecture and operations
