# Unified Inventory Module (UIM) - Enterprise System Design

## 1. Document Control
- Version: `1.0`
- Status: `Proposed`
- Target Stack: `React + Node.js + PostgreSQL/Supabase`
- Architecture Style: `Schema-Agnostic + Event-Sourced + Multi-Tenant`
- Primary Use Domains:
- Aviation MRO/AMRO (serialized rotable assets, certification constraints)
- Freight Forwarding (containerized and volumetric capacity tracking)
- Global Logistics/Warehousing (SKU, lot/batch, palletized inventory)

## 2. Executive Summary
Conventional inventory systems store a single mutable stock count per SKU and fail in high-complexity operations where traceability, chain-of-custody, and condition-state transitions are mandatory. The Unified Inventory Module (UIM) replaces stock counters with an event-sourced inventory ledger where each physical/virtual unit is a tracked entity and every movement/state change is immutable.

At any point in time, UIM answers:
1. What is it?
2. Where is it?
3. What state is it in?

This design supports high-volume and high-audit domains while remaining schema-agnostic enough to plug into AMRO, freight forwarding, and logistics workflows.

## 3. Architectural Philosophy: Item-Level Atomicity
UIM treats each inventory unit as an atomic tracked entity:
- Aviation: Engine, landing gear, serialized avionics module.
- Freight: Container, ULD, shipment unit keyed by MAWB/HAWB.
- Warehouse: SKU-lot, pallet, case, or weighted partials.

Key principles:
- Immutable event ledger over mutable counters.
- Command handling with deterministic validation.
- Read-model projections for fast UI queries.
- Tenant-scoped isolation using row-level security.
- Domain-neutral core with domain-specific integration references.

## 4. Goals and Non-Goals

### 4.1 Goals
- Support serialized, lot-based, and quantity-based inventory in one model.
- Preserve complete auditable movement history.
- Enable soft reservations and execution fulfillment flows.
- Provide real-time inventory truth with scalable read projections.
- Support multi-tenant shared-schema architecture with strict isolation.
- Plug into AMRO, Freight, and Procurement without module coupling.

### 4.2 Non-Goals
- UIM does not implement full ERP procurement accounting.
- UIM does not replace domain-specific maintenance or shipment lifecycle engines.
- UIM does not enforce external regulatory policy semantics beyond references and workflow hooks.

## 5. High-Level Architecture

### 5.1 Core Components
- UIM API Service (Node.js):
- Receives commands, validates invariants, appends events.
- Publishes domain events for downstream consumers.
- Inventory Event Store (PostgreSQL/Supabase):
- Source of truth (`uim_inventory_ledger` and related event entities).
- Projection Workers:
- Consume events and materialize query models (`available_by_location`, `reserved_by_item`, etc.).
- Integration Gateway:
- Standardized hooks for AMRO, Freight, and Procurement.
- UI Layer (React):
- Dense operational grid + scanner-first mobile workflow + analytics panel.

### 5.2 Data Access Pattern
- Write path: command -> validation -> append event -> projection update.
- Read path: projection tables/views optimized for UI/BI.
- No direct stock mutation by ad-hoc `UPDATE quantity_on_hand`.

## 6. Multi-Tenancy and Isolation Model
- Shared database, shared schema.
- Every UIM table includes:
- `tenant_id` (required)
- `franchise_id` (nullable where applicable)
- `created_at`, `updated_at`, `deleted_at`
- `created_by`, `updated_by`
- RLS policies enforce:
- tenant-level strict segregation
- optional franchise sub-segmentation
- platform-admin override only through privileged role checks

## 7. Domain Model

### 7.1 Core Entities
- Catalog Item: Definition of item class (SKU/part metadata).
- Inventory Item: Actual on-hand entity/unit/lot instance.
- Inventory Event/Ledger Entry: Immutable transaction record.
- Reservation: Planned hold against available inventory.
- Location Registry: Canonical location abstraction across domain types.
- Reorder Policy: Min/max and demand policies for auto-restock signals.

### 7.2 State Model
Primary state values:
- `available`
- `reserved`
- `quarantine`
- `in_transit`
- `consumed`
- `scrapped`

Transition rules are command-driven and validated in service and DB-level constraints.

## 8. Relational Schema Blueprint (Implementation-Ready)

## 8.1 `uim_catalog_items`
```sql
create table if not exists public.uim_catalog_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  franchise_id uuid references public.franchises(id) on delete set null,
  sku varchar(50) not null,
  part_number varchar(100),
  title varchar(255) not null,
  category varchar(50),
  unit_of_measure varchar(20) not null default 'pcs',
  is_serialized boolean not null default false,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint uq_uim_catalog_items_sku unique (tenant_id, sku)
);
```

Indexes:
- `(tenant_id, category, sku)`
- `(tenant_id, part_number)`

## 8.2 `uim_location_registry`
```sql
create table if not exists public.uim_location_registry (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  franchise_id uuid references public.franchises(id) on delete set null,
  location_type varchar(30) not null, -- warehouse_bin, aircraft, truck, vessel, yard, customer_site
  location_code varchar(100) not null,
  location_name varchar(255),
  parent_location_id uuid references public.uim_location_registry(id) on delete set null,
  external_ref_module varchar(50),
  external_ref_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint uq_uim_location_registry_code unique (tenant_id, location_type, location_code)
);
```

## 8.3 `uim_inventory_items`
```sql
create table if not exists public.uim_inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  franchise_id uuid references public.franchises(id) on delete set null,
  catalog_item_id uuid not null references public.uim_catalog_items(id) on delete restrict,
  serial_number varchar(100),
  batch_lot_number varchar(100),
  quantity numeric(12,4) not null default 1.0000 check (quantity >= 0),
  status varchar(30) not null default 'available'
    check (status in ('available','reserved','quarantine','in_transit','consumed','scrapped')),
  location_id uuid references public.uim_location_registry(id) on delete set null,
  condition_code varchar(30),
  ownership_type varchar(30) default 'owned',
  received_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint uq_uim_inventory_items_serial unique (tenant_id, serial_number),
  constraint uq_uim_inventory_items_lot unique (tenant_id, catalog_item_id, batch_lot_number, location_id)
);
```

## 8.4 `uim_inventory_reservations`
```sql
create table if not exists public.uim_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  franchise_id uuid references public.franchises(id) on delete set null,
  catalog_item_id uuid not null references public.uim_catalog_items(id) on delete restrict,
  inventory_item_id uuid references public.uim_inventory_items(id) on delete set null,
  reserved_quantity numeric(12,4) not null check (reserved_quantity > 0),
  reservation_status varchar(30) not null default 'active'
    check (reservation_status in ('active','fulfilled','expired','cancelled')),
  expected_use_date timestamptz,
  reservation_token varchar(64) not null,
  referenced_module varchar(50),
  referenced_record_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint uq_uim_inventory_reservation_token unique (tenant_id, reservation_token)
);
```

## 8.5 `uim_inventory_ledger` (Event Store)
```sql
create table if not exists public.uim_inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  franchise_id uuid references public.franchises(id) on delete set null,
  inventory_item_id uuid not null references public.uim_inventory_items(id) on delete restrict,
  transaction_type varchar(30) not null
    check (transaction_type in ('RECEIVE','MOVE','RESERVE','RELEASE','CONSUME','ADJUST','SCRAP','RETURN')),
  quantity_changed numeric(12,4) not null,
  from_location_id uuid references public.uim_location_registry(id) on delete set null,
  to_location_id uuid references public.uim_location_registry(id) on delete set null,
  previous_status varchar(30),
  next_status varchar(30),
  reservation_id uuid references public.uim_inventory_reservations(id) on delete set null,
  referenced_module varchar(50),
  referenced_record_id uuid,
  event_version int not null default 1,
  event_hash text,
  metadata jsonb not null default '{}'::jsonb,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
```

Indexes:
- `(tenant_id, inventory_item_id, created_at desc)`
- `(tenant_id, transaction_type, created_at desc)`
- `(tenant_id, referenced_module, referenced_record_id)`

## 8.6 `uim_reorder_policies`
```sql
create table if not exists public.uim_reorder_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  franchise_id uuid references public.franchises(id) on delete set null,
  catalog_item_id uuid not null references public.uim_catalog_items(id) on delete cascade,
  location_id uuid references public.uim_location_registry(id) on delete set null,
  min_threshold numeric(12,4) not null,
  max_threshold numeric(12,4),
  reorder_quantity numeric(12,4) not null,
  reorder_lead_time_days int default 7,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);
```

## 9. Event Sourcing Strategy

### 9.1 Commands
- `ReceiveInventory`
- `MoveInventory`
- `ReserveInventory`
- `ReleaseReservation`
- `ConsumeInventory`
- `AdjustInventory`
- `ScrapInventory`

### 9.2 Events
- `InventoryReceived`
- `InventoryMoved`
- `InventoryReserved`
- `InventoryReservationReleased`
- `InventoryConsumed`
- `InventoryAdjusted`
- `InventoryScrapped`

### 9.3 Projection Models
- `uim_projection_available_by_item_location`
- `uim_projection_reservation_backlog`
- `uim_projection_inventory_state_timeline`
- `uim_projection_restock_candidates`

Projection updates are idempotent and keyed by ledger event ID.

## 10. API Contract (Node.js + Supabase)

Base route: `/api/v1/uim`

### 10.1 Hook 1 - Soft Reservation
- Endpoint: `POST /reservations/soft`
- Request:
```json
{
  "catalog_item_id": "uuid",
  "quantity": 2.0,
  "expected_use_date": "2026-06-15T10:00:00Z",
  "referenced_module": "AMRO",
  "referenced_record_id": "uuid"
}
```
- Response:
```json
{
  "reservation_token": "resv_xxx",
  "reservation_id": "uuid",
  "status": "active",
  "allocated_items": [
    { "inventory_item_id": "uuid", "reserved_quantity": 1.0 }
  ]
}
```

### 10.2 Hook 2 - Physical Issue/Consume
- Endpoint: `POST /inventory/issue`
- Request:
```json
{
  "inventory_item_id": "uuid",
  "target_location_type": "aircraft",
  "target_location_id": "uuid",
  "reservation_token": "resv_xxx",
  "consume": true,
  "quantity": 1.0
}
```
- Behavior:
- resolves location from registry
- updates reservation fulfillment
- appends double-entry movement/consume events in ledger

### 10.3 Hook 3 - Dynamic Restock
- Endpoint: `POST /restock/evaluate`
- Trigger: scheduler/worker
- Response:
```json
{
  "evaluated_items": 1250,
  "restock_alerts": [
    {
      "catalog_item_id": "uuid",
      "sku": "SKU-123",
      "location_id": "uuid",
      "available_quantity": 2.0,
      "threshold": 5.0,
      "recommended_reorder_quantity": 20.0
    }
  ]
}
```

## 11. Data Integrity, Concurrency, and Invariants
- Use transactional command handlers.
- Lock scope:
- `select ... for update` on `uim_inventory_items` rows during write.
- Invariants:
- no negative quantity transitions
- serialized items must have quantity `<= 1`
- `consume` cannot execute from non-`available`/`reserved` states
- reservation fulfillment cannot exceed reserved quantity
- Idempotency:
- accept `x-idempotency-key` header and persist request hash.

## 12. Security and RLS

### 12.1 RLS Enforcement
- Enable RLS on all UIM tables.
- Policies:
- tenant filter by `tenant_id = get_user_tenant_id(auth.uid())`
- optional franchise scope control
- platform admin override policy

### 12.2 Auditing
- All writes include `performed_by`, timestamps, and linked module references.
- Ledger entries immutable (no update/delete except soft-delete governance for legal scenarios).

## 13. UI/UX Strategy (Enterprise Adaptive)

### 13.1 Core Views
- Dense Grid Mode:
- high-density table with filter chips, column pinning, grouping.
- Scanner PWA Mode:
- camera scan (Code 128/DataMatrix), offline queue, instant issue/move actions.
- Location Flow View:
- timeline/map for in-transit and staging state transitions.
- Inventory Intelligence View:
- stock risk, demand forecast, restock recommendations.

### 13.2 Status Badges
- Green: `available`
- Amber: `reserved`/`staged`
- Blue: `in_transit`
- Red: `quarantine`/`scrapped`

### 13.3 Accessibility
- WCAG 2.1 AA:
- contrast-compliant badge and text combinations
- keyboard operation for all controls
- aria-live updates for scan/issue outcomes
- focus-visible rings and role-label consistency

## 14. Domain Integration Examples

### 14.1 AMRO
- reserve serialized actuator for C-check package
- issue to aircraft tail-specific location
- consume/return event linked to work package ID

### 14.2 Freight Forwarding
- reserve ULD/container slots by route manifest
- move status to in-transit at dispatch scan
- complete location transition at POD

### 14.3 Warehousing
- reserve lot quantities for picking wave
- consume partial quantities by weighted UOM
- auto-restock triggers procurement signal

## 15. Performance and Scale

### 15.1 Expected Throughput
- Ledger write throughput target: 2k-5k events/sec per region with partitioning.
- Query P95:
- projection reads < 150ms
- command writes < 300ms under nominal load

### 15.2 PostgreSQL Optimization
- Time-based partitioning on ledger (`created_at` monthly/quarterly).
- Partial indexes by active statuses.
- Async projections and batched event consumption.

### 15.3 Developer Rig Guidance (Dual A4000)
- Run local stress simulation:
- command replay and projection rebuild benchmarks in parallel workers.
- keep scanner/websocket test harness in separate process to isolate UI frame timing.

## 16. Observability and Operations
- Structured logs for all command handlers.
- Metrics:
- reservation success rate
- move/consume latency
- projection lag
- inventory mismatch detector count
- Tracing:
- correlation IDs propagated across UIM and caller modules.
- Alerts:
- projection lag threshold breaches
- repeated invariant violation attempts
- restock webhook delivery failures

## 17. Test Strategy
- Unit:
- command validator invariants
- state transition rules
- Integration:
- API + DB transaction correctness
- RLS policy enforcement
- E2E:
- AMRO reservation-to-consume flow
- freight in-transit flow
- scanner PWA offline/online sync flow
- Replay tests:
- rebuild projection from ledger and validate deterministic totals.

## 18. Rollout and Migration Plan
1. Phase 0: Deploy schema with RLS and no caller integration.
2. Phase 1: Enable shadow writes from existing inventory module.
3. Phase 2: Validate parity between legacy totals and UIM projections.
4. Phase 3: Enable command paths for selected tenants behind feature flags.
5. Phase 4: Full cutover + legacy read-only archive period.

Rollback:
- disable feature flag
- continue legacy source-of-truth
- preserve UIM ledger for forensic replay

## 19. Risks and Mitigations
- Risk: High write amplification from event model.
- Mitigation: partitioning + projection batch workers + retention/archive policy.
- Risk: Polymorphic location ambiguity.
- Mitigation: centralized `uim_location_registry` with strict unique codes.
- Risk: Cross-module coupling.
- Mitigation: references by `referenced_module` + `referenced_record_id` only.

## 20. Implementation Checklist
- [ ] Create migrations for UIM core tables and indexes.
- [ ] Add RLS policies for tenant/franchise scope.
- [ ] Build command handlers + idempotency layer.
- [ ] Implement projection workers and backfill routines.
- [ ] Implement API hooks: reservation, issue/consume, restock.
- [ ] Build React dense grid and scanner PWA flows.
- [ ] Add observability dashboards and alerts.
- [ ] Execute UAT across AMRO and freight pilot tenants.

## UI/UX Design Specification

### UX Governance and Design Tokens
- Design system baseline:
- Component library: `shadcn/ui` + enterprise wrappers (`Card`, `DataTable`, `Dialog`, `Badge`, `Tabs`, `Command`, `Toast`).
- Interaction consistency: command palette + dense-grid + scanner-first mobile.
- Color palette:
- `--uim-success`: `#16A34A` (Available)
- `--uim-warning`: `#F59E0B` (Reserved/Staged)
- `--uim-info`: `#2563EB` (In-Transit)
- `--uim-danger`: `#DC2626` (Quarantine/Scrapped)
- `--uim-bg`: `#F8FAFC`
- `--uim-surface`: `#FFFFFF`
- Typography scale:
- `display`: 24/32 semibold
- `h1`: 20/28 semibold
- `h2`: 16/24 semibold
- `body`: 14/20 regular
- `meta`: 12/16 regular
- `micro`: 11/14 medium
- Spacing tokens:
- `space-1=4px`, `space-2=8px`, `space-3=12px`, `space-4=16px`, `space-5=20px`, `space-6=24px`
- breakpoints: mobile `<768`, tablet `768-1279`, desktop `>=1280`
- WCAG target: `2.2 AA`
- Keyboard standard:
- tab order follows visual hierarchy left-to-right, top-to-bottom
- first focusable control is context search
- all dialogs trap focus and support `Esc` close
- ARIA baseline:
- role `main`, `navigation`, `region`, `dialog`, `status`, `alert`
- table semantics with sortable headers (`aria-sort`)

### Functional Module UX Specifications

#### A. Item Master (Catalog Management)
- Wireframe/mocks:
- Desktop: 3-panel view (filter rail, dense table, detail side sheet).
- Tablet: filter drawer + 2-column content stack.
- Mobile: list cards + bottom-sheet editor.
- User flow:
```text
Entry: Inventory > Item Master
  -> Search/Filter SKU
  -> Select existing item OR Create new item
  -> Validate required fields (SKU, UOM, category)
  -> Save
Exit: Back to list with toast + highlighted row
```
- Accessibility checklist:
- `aria-label` on search and create actions
- table keyboard sorting with `Enter/Space`
- detail sheet announced via `aria-live=polite`
- Interaction states:
- Loading: "Loading catalog definitions..."
- Empty: "No catalog items found. Create your first SKU."
- Error: "Catalog could not be loaded. Retry."
- Success: "Catalog item saved successfully."
- Security annotations:
- mask sensitive supplier references in shared views
- audit actor and timestamp on create/update
- sanitize rich-text attributes against XSS
- Performance budget:
- FCP `<= 1.8s`, TTI `<= 3.0s`
- Usability metrics:
- create/update critical task in `<= 3 clicks` from list
- recovery from validation error `<= 5s`

#### B. Stock Ledger (Inventory Item + Event Timeline)
- Wireframe/mocks:
- Desktop: split timeline + movement table + state chips.
- Tablet: timeline collapses to accordions.
- Mobile: chronological event cards with sticky filter chips.
- User flow:
```text
Entry: Inventory > Stock Ledger
  -> Select tracked entity (serial/lot/SKU)
  -> Review movement history
  -> Drill into event metadata
Exit: Return to inventory list or export trace report
```
- Accessibility checklist:
- timeline entries navigable by keyboard
- status changes announced in `role=status`
- ARIA labels for event direction (from/to location)
- Interaction states:
- Loading: "Building inventory timeline..."
- Empty: "No ledger events yet for this item."
- Error: "Timeline unavailable. Check connection and retry."
- Success: "Trace report exported."
- Security annotations:
- mask user identifiers in non-admin views
- enforce signed event hashes display as read-only
- CSRF token required for export requests
- Performance budget:
- FCP `<= 2.0s`, TTI `<= 3.2s`
- Usability metrics:
- locate latest event in `<= 3 clicks`
- error recovery for bad filter in `<= 5s`

#### C. Reservation Engine (Soft Reservation and Fulfillment)
- Wireframe/mocks:
- Desktop: reservation wizard (request -> allocation -> confirm).
- Tablet: stepper with compact summary drawer.
- Mobile: guided single-column form with persistent CTA.
- User flow:
```text
Entry: Work Package / Manifest Planning
  -> Request quantity + expected use date
  -> System checks availability
  -> Confirm reservation token
Exit: Reservation status=active and visible in backlog
```
- Accessibility checklist:
- stepper semantics with `aria-current=step`
- token copy button keyboard support
- error summary linked to invalid fields
- Interaction states:
- Loading: "Allocating available inventory..."
- Empty: "No available stock for requested criteria."
- Error: "Reservation failed due to availability conflict."
- Success: "Reservation created. Token copied."
- Security annotations:
- hide reservation token for unauthorized roles
- session-timeout warning modal before confirmation
- sanitize free-text request notes
- Performance budget:
- FCP `<= 1.8s`, TTI `<= 2.8s`
- Usability metrics:
- reservation completion in `<= 3 clicks` from planner view
- conflict-resolution recovery `<= 5s`

#### D. Physical Issue/Consume Module
- Wireframe/mocks:
- Desktop: scan/lookup pane + destination selector + confirmation rail.
- Tablet: two-step issue form with quick validate.
- Mobile: scanner-first PWA with camera preview and large action buttons.
- User flow:
```text
Entry: Technician/Driver issue screen
  -> Scan code or lookup inventory item
  -> Select target location and action (move/consume)
  -> Confirm and commit
Exit: Ledger updated + reservation fulfilled
```
- Accessibility checklist:
- camera fallback manual input for assistive use
- target location combobox keyboard support
- confirmation summary read via screen reader
- Interaction states:
- Loading: "Validating location and reservation..."
- Empty: "No scan detected. Try again or enter manually."
- Error: "Issue failed. Item state changed. Refresh required."
- Success: "Item moved/consumed successfully."
- Security annotations:
- mask partial serial values in shared mobile screens
- enforce anti-replay nonce for submit action
- XSS-safe rendering for scanned metadata
- Performance budget:
- FCP `<= 1.6s`, TTI `<= 2.5s`
- Usability metrics:
- issue completion in `<= 3 clicks` post scan
- scan failure recovery `<= 5s`

#### E. Dynamic Restock and Procurement Signal Module
- Wireframe/mocks:
- Desktop: threshold matrix + restock candidates + action queue.
- Tablet: prioritized cards with threshold gauges.
- Mobile: alert feed with approve/snooze actions.
- User flow:
```text
Entry: Inventory Control Dashboard
  -> View below-threshold items
  -> Approve auto-restock signal or snooze
  -> Dispatch webhook
Exit: Signal status tracked in outbound queue
```
- Accessibility checklist:
- risk badges have text and icon (not color-only)
- webhook status changes announced through `aria-live`
- action controls reachable by keyboard
- Interaction states:
- Loading: "Evaluating reorder thresholds..."
- Empty: "All monitored items are above thresholds."
- Error: "Restock dispatch failed. Retry queued."
- Success: "Restock signal sent to procurement."
- Security annotations:
- redact supplier contract values in operator role
- signed webhook payload and replay guard
- CSRF protection on approve/snooze actions
- Performance budget:
- FCP `<= 2.0s`, TTI `<= 3.4s`
- Usability metrics:
- approve/snooze action in `<= 3 clicks`
- failed dispatch recovery `<= 5s`

#### F. Location Registry and Transfer Console
- Wireframe/mocks:
- Desktop: hierarchical tree + map/list hybrid.
- Tablet: collapsible hierarchy + transfer panel.
- Mobile: searchable location list with breadcrumbs.
- User flow:
```text
Entry: Inventory > Locations
  -> Find source/target location
  -> Create transfer
  -> Confirm movement rules
Exit: Transfer event generated and traceable in ledger
```
- Accessibility checklist:
- tree navigation arrow-key support
- breadcrumbs announced as navigation landmarks
- transfer modal has proper focus trap
- Interaction states:
- Loading: "Loading location hierarchy..."
- Empty: "No matching locations."
- Error: "Transfer blocked by location policy."
- Success: "Transfer completed."
- Security annotations:
- tenant-franchise scope checks on location visibility
- mask restricted military/aero locations for non-privileged roles
- sanitize external location labels
- Performance budget:
- FCP `<= 2.0s`, TTI `<= 3.2s`
- Usability metrics:
- execute transfer in `<= 3 clicks`
- policy-block recovery `<= 5s`

#### G. Analytics and Dashboard Module
- Wireframe/mocks:
- Desktop: KPI row + trend charts + anomaly tiles.
- Tablet: stacked charts with swipe segments.
- Mobile: KPI cards + compact sparkline feed.
- User flow:
```text
Entry: UIM Analytics
  -> Select date range/domain scope
  -> Inspect KPIs and anomalies
  -> Export report
Exit: Shared report artifact
```
- Accessibility checklist:
- chart alternatives via data tables
- all visual statuses have textual equivalent
- export controls keyboard accessible
- Interaction states:
- Loading: "Compiling inventory analytics..."
- Empty: "No data for selected period."
- Error: "Analytics service temporarily unavailable."
- Success: "Report export complete."
- Security annotations:
- PII masking in shared dashboards
- export authorization checks and watermarking
- anti-XSS chart label sanitation
- Performance budget:
- FCP `<= 2.2s`, TTI `<= 3.6s`
- Usability metrics:
- locate key KPI in `<= 3 clicks`
- filter correction recovery `<= 5s`

### Cross-Module WCAG 2.2 AA Checklist
- Focus visible for all interactive elements (`3:1` contrast minimum).
- Target size minimum `24x24` logical pixels for touch controls.
- Drag/drop alternatives with keyboard operations.
- Error messages include prevention and correction guidance.
- Timeouts include warning dialog + extend session option.
- ARIA landmarks and headings form a valid navigable outline.

## End-to-End Implementation Plan

### Delivery Cadence and Versioning
- Sprint length: `2 weeks`
- Release progression:
- `v0.1` Foundation bootstrap
- `v0.2` Core schema + APIs
- `v0.4` Reservations + issue/consume
- `v0.6` Integrations (REST/GraphQL/Webhooks)
- `v0.8` Analytics + reporting
- `v0.9` Hardening/performance/security
- `v1.0` Cut-over + hyper-care complete

### Global Quality Gates (All Phases)
- Unit/integration coverage `>= 80%`
- SonarQube rating `A`
- Zero critical CVEs before phase exit
- OpenAPI/GraphQL contracts published and versioned
- Updated README + runbook + architecture notes per release

### Phase 1 - Foundation
- Entry criteria:
- approved architecture and backlog
- environment and access approvals
- Activities:
- repo scaffolding and module boundaries
- CI/CD pipeline setup
- base UIM service skeleton and lint/test standards
- Tasks:
| Task | Owner Role | Effort (PD) | Dependency |
|---|---|---:|---|
| Monorepo module scaffolding | Tech Lead | 3 | none |
| CI/CD templates and quality checks | DevOps Engineer | 4 | scaffolding |
| Base service runtime and health endpoints | Backend Engineer | 3 | scaffolding |
| Front-end shell and route placeholders | Frontend Engineer | 3 | scaffolding |
| Security baseline policies (SAST/secret scan) | Security Engineer | 2 | CI setup |
- Exit criteria:
- passing CI pipeline
- environment parity (dev/stage)
- v0.1 tag published
- Deliverables:
- source code scaffold
- CI manifests
- baseline tests
- architecture sign-off package

### Phase 2 - Core Inventory Services
- Entry criteria:
- Phase 1 complete
- schema review approved
- Activities:
- implement item master, stock ledger, reservation engine
- add unit and integration tests
- Tasks:
| Task | Owner Role | Effort (PD) | Dependency |
|---|---|---:|---|
| DB migrations + RLS policies | DB Engineer | 6 | Phase 1 |
| Command handlers (receive/move/reserve/consume) | Backend Engineer | 8 | migrations |
| Projection workers + replay support | Backend Engineer | 6 | command handlers |
| API contract tests + mocks | QA Engineer | 4 | handlers |
| FE dense-grid and forms for core flows | Frontend Engineer | 7 | contracts |
- Exit criteria:
- all core commands functional
- replay deterministic validation passed
- v0.2 and v0.4 tags published
- Deliverables:
- migrations
- service code
- automated tests
- updated API docs

### Phase 3 - Channel Integration
- Entry criteria:
- stable core services
- consumer module readiness
- Activities:
- REST + GraphQL exposure
- webhook adapters
- marketplace/third-party connector framework
- Tasks:
| Task | Owner Role | Effort (PD) | Dependency |
|---|---|---:|---|
| REST endpoint hardening | Backend Engineer | 4 | Phase 2 |
| GraphQL schema and resolvers | Backend Engineer | 5 | REST stable |
| Webhook adapter framework | Integration Engineer | 5 | Phase 2 |
| Freight/AMRO connector contracts | Solution Architect | 4 | adapters |
| End-to-end integration tests | QA Engineer | 5 | connectors |
- Exit criteria:
- integration SLAs met
- contract compatibility report signed
- v0.6 tag published
- Deliverables:
- API adapters
- connector manifests
- integration test suite
- release notes

### Phase 4 - Analytics and Reporting
- Entry criteria:
- event volume baseline established
- Activities:
- real-time dashboards
- scheduled ETL jobs
- BI cube deployment
- Tasks:
| Task | Owner Role | Effort (PD) | Dependency |
|---|---|---:|---|
| KPI model definitions | Product Analyst | 3 | Phase 3 |
| ETL job implementation | Data Engineer | 6 | KPI model |
| Dashboard FE implementation | Frontend Engineer | 5 | ETL contracts |
| BI semantic cube and data dictionary | BI Engineer | 5 | ETL |
| Reporting QA and reconciliation | QA Engineer | 4 | dashboards |
- Exit criteria:
- dashboard latency targets met
- KPI reconciliation signed
- v0.8 tag published
- Deliverables:
- analytics service jobs
- dashboard code
- BI deployment artifacts
- metric runbook

### Phase 5 - Hardening and Performance
- Entry criteria:
- all functional streams integrated
- Activities:
- chaos testing
- load testing (`2,000` concurrent users)
- penetration-fix cycle
- Tasks:
| Task | Owner Role | Effort (PD) | Dependency |
|---|---|---:|---|
| Load model and scenario design | Performance Engineer | 3 | Phase 4 |
| Load execution + bottleneck tuning | Backend Engineer | 6 | scenarios |
| Chaos experiments | SRE Engineer | 4 | stable staging |
| Pen-test remediation | Security Engineer | 5 | pen-test report |
| Reliability regression test cycle | QA Engineer | 4 | remediations |
- Exit criteria:
- p95 SLA compliance
- zero critical CVEs
- v0.9 tag published
- Deliverables:
- performance reports
- chaos logs
- vulnerability closure report
- signed security acceptance

### Phase 6 - Cut-over and Hyper-care
- Entry criteria:
- production readiness sign-off
- rollback plan rehearsed
- Activities:
- data migration and verification
- phased traffic cut-over
- 24x7 support runbook execution
- Tasks:
| Task | Owner Role | Effort (PD) | Dependency |
|---|---|---:|---|
| Data migration scripts + dry runs | DB Engineer | 6 | Phase 5 |
| Cut-over orchestration | Release Manager | 3 | migration dry run |
| Rollback validation drill | SRE Engineer | 2 | orchestration |
| Hyper-care staffing + alert matrix | Support Lead | 3 | cut-over |
| Post-go-live defect triage | Cross-functional Squad | 6 | go-live |
- Exit criteria:
- stable production KPIs for 2 sprint windows
- no Sev-1 open incidents
- v1.0 tag published
- Deliverables:
- migration artifacts
- deployment manifests
- runbook + on-call rotation
- final architecture and QA sign-offs

### Sprint Plan (2-Week Sprints)
| Sprint | Target Version | Primary Scope |
|---|---|---|
| Sprint 1 | v0.1 | Foundation + CI/CD + service scaffold |
| Sprint 2 | v0.2 | Schema + RLS + item master core |
| Sprint 3 | v0.4 | Ledger + reservations + consume flows |
| Sprint 4 | v0.6 | REST/GraphQL + webhook/channel integrations |
| Sprint 5 | v0.8 | Analytics dashboards + ETL + BI cube |
| Sprint 6 | v0.9 | Performance, chaos, security hardening |
| Sprint 7 | v1.0 | Cut-over + migration + hyper-care stabilization |

### Risk Register
| Risk | Probability | Impact | Mitigation | Contingency Owner |
|---|---|---|---|---|
| Projection lag under peak writes | Medium | High | partitioning + async worker autoscaling | Backend Lead |
| RLS misconfiguration causing cross-tenant leakage | Low | Critical | policy test harness + pre-prod audit | Security Lead |
| Integration contract drift with AMRO/Freight | Medium | High | schema registry + contract tests in CI | Solution Architect |
| Scanner PWA device compatibility variance | Medium | Medium | fallback manual entry + device certification matrix | Frontend Lead |
| Migration window overrun | Medium | High | rehearsal runs + incremental cut-over batches | Release Manager |

### Deliverable Checklist by Phase
- Source code merged with reviews complete
- Automated tests (unit, integration, e2e) green
- Deployment manifests (infra + app) updated
- README/runbook/docs refreshed
- Signed-off design + QA + security artifacts archived

## 21. Appendix - Minimal SQL from Requested Baseline
The baseline requested schema is valid as a conceptual starter, but production readiness requires:
- reservation entity,
- location registry abstraction,
- immutable event invariants,
- RLS and auditing columns,
- projection strategy.

Use this document as the implementation source and baseline SQL as initial scaffolding only.
