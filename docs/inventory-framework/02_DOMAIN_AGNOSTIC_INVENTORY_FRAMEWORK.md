# Domain-Agnostic Inventory Documentation Framework

## Visual Layer Key
- `🟦 Generic Core Layer`: mandatory, domain-neutral inventory architecture and operations.
- `🟧 Domain Extension Layer`: optional domain overlays (for example AMRO, retail, warehouse, manufacturing).

## 1. Framework Goals
`🟦 Generic Core Layer`
- Define one reusable inventory documentation model that can be configured for any business domain.
- Isolate domain-specific semantics into extension overlays.
- Preserve compatibility with existing domain integrations through parameter bindings.

`🟧 Domain Extension Layer`
- Provide domain terminology, workflows, attributes, and constraints as additive overlays.
- Avoid overriding core semantics unless explicitly documented by extension rules.

## 2. Canonical Naming Convention Standard
`🟦 Generic Core Layer`
- Table placeholders use `${snake_case}`.
- API placeholders use `{kebab-case}` where path-driven.
- Concept IDs use `INV-<AREA>-<NNN>`.

Core placeholder set:
- `${catalog_item_table}`
- `${inventory_item_table}`
- `${inventory_ledger_table}`
- `${inventory_reservation_table}`
- `${inventory_projection_table}`
- `${item_profile_table}`
- `${domain_prefix}`
- `${integration_job_table}`
- `${integration_audit_table}`

Naming rules:
- Core entities: `inventory_*`, `catalog_*`, `reservation_*`.
- Extension entities: `${domain_prefix}_*`.
- No domain-specific names in core schema examples.

## 3. Generic Data Model Template
`🟦 Generic Core Layer`

### 3.1 Core Entity Set
- Catalog Item: canonical item identity and classification.
- Inventory Item: current quantity/status/location for a stock instance.
- Inventory Ledger: immutable movement/adjustment events.
- Reservation: lifecycle and allocation state.
- Projection Snapshot: query-optimized availability and state.
- Integration Job/Audit: idempotency, retries, traceability.

### 3.2 Generic Relational Pattern
```sql
create table if not exists ${catalog_item_table} (
  id uuid primary key,
  tenant_id uuid not null,
  franchise_id uuid null,
  item_code text not null,
  item_name text not null,
  item_class text null,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, item_code)
);

create table if not exists ${inventory_item_table} (
  id uuid primary key,
  tenant_id uuid not null,
  franchise_id uuid null,
  catalog_item_id uuid not null references ${catalog_item_table}(id),
  serial_number text null,
  lot_number text null,
  quantity numeric(12,4) not null default 0,
  status text not null,
  location_ref text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ${inventory_ledger_table} (
  id uuid primary key,
  tenant_id uuid not null,
  inventory_item_id uuid not null references ${inventory_item_table}(id),
  transaction_type text not null,
  quantity_changed numeric(12,4) not null,
  reference_module text null,
  reference_record_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

## 4. Parameterized Item Profile Management
`🟦 Generic Core Layer`
- Item profile is an optional extension concept; it must map 1:1 to `${catalog_item_table}`.
- Core profile contract:
  - `profile_type`
  - `profile_status`
  - `compliance_metadata`
  - `traceability_metadata`

Template:
```sql
create table if not exists ${item_profile_table} (
  id uuid primary key,
  tenant_id uuid not null,
  catalog_item_id uuid not null references ${catalog_item_table}(id),
  profile_type text not null,
  profile_status text not null,
  domain_attributes jsonb not null default '{}'::jsonb,
  compliance_metadata jsonb not null default '{}'::jsonb,
  traceability_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, catalog_item_id)
);
```

`🟧 Domain Extension Layer`
- Domain-specific fields (for example calibration, shelf-life, regulated codes) belong in `domain_attributes`.
- Domain-specific constraints are documented as extension-level validation rules.

## 5. Generic Workflow Templates
`🟦 Generic Core Layer`
Base workflows:
1. Receive stock.
2. Move stock.
3. Reserve stock.
4. Consume/release stock.
5. Reconcile and project stock.

Each workflow must:
- validate tenant/franchise scope,
- apply idempotency control,
- write immutable ledger event,
- update projection state asynchronously or transactionally,
- produce integration audit record.

`🟧 Domain Extension Layer`
- Domain execution workflow (for example work-order issue, retail POS decrement, manufacturing kit allocation) calls base workflows via adapter contracts.

## 6. API Documentation Standard
`🟦 Generic Core Layer`
Required endpoint groups:
- `POST /api/v2/inventory/commands`
- `POST /api/v2/inventory/reservations/soft`
- `GET /api/v2/inventory/availability`
- `GET /api/v2/inventory/movements`
- `POST /api/v2/inventory/projections/replay`
- `POST /api/v2/inventory/integrations/{domain}/actions`

Required API controls:
- authn: token-based identity.
- authz: least privilege inventory scopes.
- idempotency key for all mutating requests.
- request correlation ID propagation.
- rate limits by tenant + endpoint class.

## 7. Language Standardization Rules
`🟦 Generic Core Layer`
- Use neutral terms:
  - `domain adapter` instead of specific domain product names.
  - `execution context` instead of work-order/task unless extension-bound.
  - `item profile` instead of domain-specific profile labels.
- Disallow domain lock-in in normative statements.

`🟧 Domain Extension Layer`
- Explicitly mark domain language and map each term to a generic core term.

## 8. Multi-Domain Support Baseline
`🟦 Generic Core Layer`
The framework must support:
- retail inventory (SKU + store stock + POS movement),
- warehouse management (bin/zone transfers + wave reservations),
- manufacturing parts tracking (BOM allocations + production consumption).

Each domain binds to:
- core table placeholders,
- optional extension profile,
- domain adapter endpoints.

## 9. Documentation Structure Standard
`🟦 Generic Core Layer` sections must always appear first:
1. concepts,
2. data model,
3. APIs,
4. controls,
5. validation.

`🟧 Domain Extension Layer` sections must always appear after core:
1. binding map,
2. extension attributes,
3. domain workflows,
4. edge cases.

## 10. Traceability Requirement
Every extension document must include:
- core concept references (`INV-*` IDs),
- placeholder binding table,
- compatibility notes and rollback behavior.
