# AMRO Parts Real-Time Module (Deployment Guide)

## Scope Delivered
- Real-time AMRO parts integration API for template-driven UI:
  - `GET/POST /api/v2/amro/parts`
  - `GET/PATCH/DELETE /api/v2/amro/parts/{id}`
- Data mapping between template shape and `parts_inventory` schema.
- MRO workflow triggers:
  - part inspection
  - repair scheduling
  - replacement authorization
- Validation rules for:
  - part numbers
  - serial numbers
  - lifecycle status
  - quantity integrity
- Audit logging via `audit_logs` for all CRUD transactions.
- Migration with lifecycle + workflow event table.
- Benchmark harness and test suite.
- UI wiring for live AMRO Parts route:
  - `/dashboard/amro/parts` now renders `AmroPartsInventoryWorkbench` backed by `/api/v2/amro/parts`

## Data Mapping
- Mapper implementation:
  - `src/pages/api/v2/amro/parts/shared.ts`
- Template-to-schema (`mapTemplateToPartsInventoryRow`) maps:
  - `partNumber -> part_number`
  - `serialNumber -> serial_number`
  - `quantityOnHand -> quantity_on_hand`
  - `quantityReserved -> quantity_reserved`
  - `warehouseLocation -> warehouse_location`
  - `lifecycleStatus -> lifecycle_status`
- Schema-to-template (`mapPartsInventoryRowToTemplate`) maps reverse projection for UI templates.

## MRO Workflow Triggers
- Trigger resolver:
  - `resolveWorkflowTriggers(...)`
- Trigger table:
  - `public.amro_parts_mro_workflow_events`
- Rules:
  - inspection when lifecycle enters `inspection_due` or status `quarantined`
  - repair scheduling when lifecycle enters `needs_repair` or status `unserviceable`
  - replacement authorization when stock is below/equal reorder level and criticality is `critical/high`

## Validation and Integrity Rules
- API-layer validation:
  - `validatePartsRecordInput(...)`
- Enforced checks:
  - `part_number` regex `^[A-Z0-9-]{3,64}$`
  - optional `serial_number` regex `^[A-Z0-9-]{1,64}$`
  - allowed lifecycle/status sets
  - non-negative quantities
  - `quantity_reserved <= quantity_on_hand`
- DB-layer checks via migration:
  - `parts_inventory_part_number_format_ck`
  - `parts_inventory_serial_number_format_ck`

## Audit Logging
- Every create/update/delete transaction writes to `audit_logs`:
  - `AMRO_PART_CREATE`
  - `AMRO_PART_UPDATE`
  - `AMRO_PART_DELETE`
- Correlation IDs are included in `details`.

## API Documentation
- OpenAPI contract updated:
  - `src/pages/api/v2/amro/contracts/openapi-3.1.yaml`
- Integration endpoint registry updated:
  - `src/pages/api/v2/amro/integration-contracts.ts`
  - `src/pages/api/v2/amro/integration-contracts.test.ts`
- Auth troubleshooting diagnostics on `/api/v2/amro/parts*`:
  - 401/403 responses now include `auth_diagnostics` with:
    - `failure_category` (`token`, `permission`, `scope`, `domain`, `unknown`)
    - `reason_code`
    - `remediation`
    - header/token presence checks for operations triage

## UI/UX Integration
- Live API adapter:
  - `src/features/module-amro/components/parts/livePartsCatalogApi.ts`
- Route-level wiring:
  - `src/features/module-amro/components/AmroOwnedWorkspace.tsx`
- CRUD dialog wiring:
  - Create dialog -> `POST /api/v2/amro/parts`
  - Edit dialog -> `PATCH /api/v2/amro/parts/{id}`
  - Delete confirmation dialog -> `DELETE /api/v2/amro/parts/{id}`
- Validation steps:
  1. Start app (`npm run dev`)
  2. Open `/dashboard/amro/parts`
  3. Confirm parts table loads from `/api/v2/amro/parts` and refresh action re-fetches live data
  4. Use Create/Edit/Delete controls in Record Detail header and verify real API mutations

## Migration
- Forward migration:
  - `supabase/migrations/20260408150000_amro_parts_realtime_workflows.sql`
- Adds:
  - `parts_inventory.lifecycle_status`
  - format constraints
  - workflow event table + indexes

## Rollback Plan
- Rollback script:
  - `docs/amro-parts/ROLLBACK_20260408150000.sql`
- Sequence:
  1. Disable API traffic by setting `AMRO_PARTS_REALTIME_V2_ENABLED=false`
  2. Run rollback SQL during maintenance window
  3. Validate legacy API read paths and `parts_inventory` baseline checks

## Performance Benchmark
- Benchmark harness:
  - `scripts/benchmarks/amro-parts-query-benchmark.mjs`
- Standard query SLA target:
  - `< 500ms` per query class

## Test Coverage Notes
- Unit/API tests:
  - `src/pages/api/v2/amro/parts/shared.test.ts`
  - `src/pages/api/v2/amro/parts/index.test.ts`
  - `src/pages/api/v2/amro/parts/[id].test.ts`
- Run:
  - `npm run test -- src/pages/api/v2/amro/parts/*.test.ts`
- Coverage command:
  - `npx vitest run src/pages/api/v2/amro/parts/*.test.ts --coverage`
- Latest module coverage snapshot (`src/pages/api/v2/amro/parts/*.ts`):
  - Statements: `97.56%`
  - Branches: `90.55%`
  - Functions: `100%`
  - Lines: `98.95%`
