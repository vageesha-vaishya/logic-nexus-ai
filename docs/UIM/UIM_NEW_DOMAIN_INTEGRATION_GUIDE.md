# UIM New Domain Integration Guide

## Goal
Integrate a new domain (e.g., Logistics, Manufacturing, Production, Supply Chain) into UIM without breaking UIM or existing domain modules.

## Guiding Principles
- Keep UIM canonical tables domain-neutral.
- Isolate domain semantics in adapter/mapping layers.
- Never hardcode domain-specific logic into shared UIM core services.
- Use contract-first APIs and idempotent transaction patterns.

## Integration Steps

### 1. Define Domain Profile
- Create a domain capability matrix:
  - master data fields
  - transaction types
  - reservation/allocation semantics
  - forecast drivers
- Map each field to:
  - UIM canonical column (if generic)
  - `attributes`/`metadata` extension payload (if domain-specific)

### 2. Configure Data Access Mapping
- Use module-specific DAL pattern:
  - map each module to canonical source table(s)
  - define `column_catalog` for list/grid projection
- Ensure tenant/franchise scoping at query level.

### 3. Add Domain Adapter
- Implement adapter with 3 responsibilities:
  - inbound transform: domain -> UIM canonical payload
  - outbound transform: UIM -> domain contract payload
  - validation rules: domain constraints + FK checks

### 4. Add Integration Contract
- Add contract entry in UIM integration contracts:
  - path(s)
  - action matrix
  - idempotency policy
  - queue/audit storage
- Update OpenAPI for request/response schemas and examples.

### 5. Add Synchronization Workflow
- Real-time operations:
  - availability query
  - reserve / consume / return
- Async operations:
  - batch sync
  - retry queue processing
  - replay protection via idempotency keys

### 6. Add Verification Data Set
- Seed representative records for the new domain:
  - master data
  - inventory records
  - transaction history
  - reservation cases
  - projection snapshots
- Validate UI module lists show domain-specific datasets (not shared generic sets).

### 7. Production Safeguards
- Add metrics:
  - sync lag
  - retry rate
  - conflict rate
  - per-action failure ratio
- Add rollback plan:
  - disable domain adapter route
  - drain/park async queue
  - restore previous contract version

## Zero-Recoding Strategy
- UIM core remains unchanged when adding domains if:
  - mapping is done in adapter layer
  - list views use `column_catalog`
  - domain endpoints are additive (no contract break)
  - fallback behavior remains deterministic (`canonical` -> `form-storage`)

## Acceptance Checklist
- [ ] CRUD works per module with domain-specific table mappings
- [ ] Record grid shows unique per-module records and fields
- [ ] FK validation and dependency rules are enforced
- [ ] API sync passes with idempotency and retry guarantees
- [ ] No regressions in existing AMRO integration
