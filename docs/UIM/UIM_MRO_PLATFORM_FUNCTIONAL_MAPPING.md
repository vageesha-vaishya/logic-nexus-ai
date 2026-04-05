# UIM MRO Platform Functional Mapping

## Objective
Map core MRO inventory capabilities from enterprise platforms into UIM design patterns and implementation hooks.

## Functional Benchmark Summary

### SAP MRO
- Strengths:
  - Deep ERP-native procurement + finance coupling
  - Condition-based planning and parts availability controls
  - Multi-echelon warehouse visibility
- UIM Equivalent:
  - `uim_inventory_projection_snapshots` for availability planning
  - `uim_inventory_ledger` for transaction audit
  - `uim_inventory_reservations` for planning allocation

### IBM Maximo for Aviation
- Strengths:
  - Work-order centric parts traceability
  - Asset/component lifecycle and serialized tracking
  - Configurable compliance controls
- UIM Equivalent:
  - `uim_inventory_items.serial_number`, `batch_lot_number`
  - `uim_mro_item_profiles.traceability`
  - `uim_amro_sync_audit` for chain-of-events integrity

### Oracle Aviation Maintenance
- Strengths:
  - Forecasting and planning integration
  - Supply and maintenance program alignment
  - Enterprise data quality controls
- UIM Equivalent:
  - Projection + reservation + command flows
  - Module-specific DAL for clean domain views
  - Seed + runbook for deterministic data quality

### Ramco Aviation
- Strengths:
  - End-to-end MRO operations with inventory and repair cycle
  - Component exchange/repair pipeline controls
  - Regulatory and operational reporting
- UIM Equivalent:
  - `uim_amro_sync_jobs` + retry telemetry
  - `uim_amro_sync_audit` outcome tracking
  - API-based integration pipeline (`external-mro-pipeline`)

## Implemented UIM-Equivalent Capability Matrix
- Parts traceability: `uim_inventory_items`, `uim_mro_item_profiles.traceability`
- Inventory optimization: projection + reservation + configurable list filtering
- Procurement workflow support: supplier/location/category reference tables
- Repair cycle hooks: ledger transaction stream + external sync actions
- Regulatory posture: MRO profile attributes (ATA, condition, certification)

## Integration Pattern With AMRO
- Query path:
  - UIM availability + enriched projection views
- Transaction path:
  - Reserve / Consume / Return
- Reliability path:
  - Job queue semantics + retry status + audit trail
- Consistency controls:
  - Tenant-scoped idempotency keys
  - Canonical-source fallback in UIM forms list APIs

## Non-MRO Reuse Constraint
- UIM core tables remain domain-neutral.
- Domain-specific semantics are carried in:
  - `attributes` / `metadata` payloads
  - integration mapping layers
  - domain-specific adapter services
