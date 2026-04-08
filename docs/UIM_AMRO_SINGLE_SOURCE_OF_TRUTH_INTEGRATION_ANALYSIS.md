# UIM as Authoritative Inventory Source for AMRO

Version: `2.0`  
Date: `2026-04-08`  
Scope: UIM + AMRO inventory domain integration and AMRO inventory legacy decommissioning

## 1. Executive Intent
This document defines a comprehensive integration strategy that establishes the UIM platform as the single source of inventory truth and transitions AMRO from inventory data ownership to inventory consumption and execution.

Primary outcomes:
- One canonical inventory master and transaction ledger in UIM.
- Zero duplicate inventory state mutation across UIM and AMRO after cut-over.
- Full referential and audit traceability preserved during and after migration.
- Controlled retirement of redundant AMRO inventory data assets and interfaces.

## 2. Systematic Audit: Inventory Data Assets
## 2.1 UIM Inventory Tables (Current)
### 2.1.1 `public.uim_catalog_items`
Business purpose: canonical inventory item definition by tenant.

Columns:
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| tenant_id | uuid | no |  | FK -> `tenants.id` cascade delete |
| franchise_id | uuid | yes |  | FK -> `franchises.id` set null |
| sku | varchar(50) | no |  | unique with tenant |
| part_number | varchar(100) | yes |  |  |
| title | varchar(255) | no |  |  |
| category | varchar(50) | yes |  |  |
| unit_of_measure | varchar(20) | no | `'pcs'` |  |
| is_serialized | boolean | no | `false` |  |
| attributes | jsonb | no | `'{}'::jsonb` |  |
| created_at | timestamptz | no | `now()` |  |
| updated_at | timestamptz | no | `now()` |  |
| deleted_at | timestamptz | yes |  | soft delete |
| created_by | uuid | yes |  | FK -> `auth.users.id` set null |
| updated_by | uuid | yes |  | FK -> `auth.users.id` set null |

Constraints and indexes:
- PK: `(id)`
- Unique: `(tenant_id, sku)`
- Index: `idx_uim_catalog_items_tenant_sku (tenant_id, sku)`
- RLS enabled with tenant + platform-admin policies.

### 2.1.2 `public.uim_inventory_items`
Business purpose: physical/lot/serial stock instances and current status.

Columns:
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| tenant_id | uuid | no |  | FK -> `tenants.id` cascade |
| franchise_id | uuid | yes |  | FK -> `franchises.id` set null |
| catalog_item_id | uuid | no |  | FK -> `uim_catalog_items.id` restrict |
| serial_number | varchar(100) | yes |  | unique with tenant |
| batch_lot_number | varchar(100) | yes |  |  |
| quantity | numeric(12,4) | no | `1.0000` | check `quantity >= 0` |
| status | varchar(30) | no | `'available'` | check enum `available/reserved/quarantine/in_transit/consumed/scrapped` |
| location_type | varchar(30) | yes |  |  |
| location_id | uuid | yes |  |  |
| metadata | jsonb | no | `'{}'::jsonb` |  |
| created_at | timestamptz | no | `now()` |  |
| updated_at | timestamptz | no | `now()` |  |
| deleted_at | timestamptz | yes |  | soft delete |
| created_by | uuid | yes |  | FK -> `auth.users.id` |
| updated_by | uuid | yes |  | FK -> `auth.users.id` |

Constraints and indexes:
- PK: `(id)`
- Unique: `(tenant_id, serial_number)`
- Index: `idx_uim_inventory_items_tenant_catalog (tenant_id, catalog_item_id, status)`
- RLS enabled.

### 2.1.3 `public.uim_inventory_ledger`
Business purpose: immutable transaction ledger for all inventory state transitions.

Columns:
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| tenant_id | uuid | no |  | FK -> `tenants.id` |
| franchise_id | uuid | yes |  | FK -> `franchises.id` |
| inventory_item_id | uuid | no |  | FK -> `uim_inventory_items.id` restrict |
| transaction_type | varchar(30) | no |  | check enum `RECEIVE/MOVE/RESERVE/RELEASE/CONSUME/ADJUST/SCRAP/RETURN` |
| quantity_changed | numeric(12,4) | no |  |  |
| from_location_id | uuid | yes |  |  |
| to_location_id | uuid | yes |  |  |
| referenced_module | varchar(50) | yes |  |  |
| referenced_record_id | uuid | yes |  |  |
| metadata | jsonb | no | `'{}'::jsonb` |  |
| performed_by | uuid | yes |  | FK -> `auth.users.id` |
| created_at | timestamptz | no | `now()` |  |
| reservation_id | uuid | yes |  | FK -> `uim_inventory_reservations.id` set null |

Constraints and indexes:
- PK: `(id)`
- Index: `idx_uim_inventory_ledger_tenant_item_created (tenant_id, inventory_item_id, created_at desc)`
- RLS enabled.

### 2.1.4 `public.uim_inventory_reservations`
Business purpose: reservation lifecycle and allocation tokenization.

Columns:
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| tenant_id | uuid | no |  | FK -> `tenants.id` |
| franchise_id | uuid | yes |  | FK -> `franchises.id` |
| catalog_item_id | uuid | no |  | FK -> `uim_catalog_items.id` |
| inventory_item_id | uuid | yes |  | FK -> `uim_inventory_items.id` |
| reserved_quantity | numeric(12,4) | no |  | check `> 0` |
| reservation_status | varchar(30) | no | `'active'` | check enum `active/fulfilled/expired/cancelled` |
| expected_use_date | timestamptz | yes |  |  |
| reservation_token | varchar(64) | no |  | unique with tenant |
| referenced_module | varchar(50) | yes |  |  |
| referenced_record_id | uuid | yes |  |  |
| metadata | jsonb | no | `'{}'::jsonb` |  |
| created_at | timestamptz | no | `now()` |  |
| updated_at | timestamptz | no | `now()` |  |
| deleted_at | timestamptz | yes |  | soft delete |
| created_by | uuid | yes |  | FK -> `auth.users.id` |
| updated_by | uuid | yes |  | FK -> `auth.users.id` |

Constraints and indexes:
- PK: `(id)`
- Unique: `(tenant_id, reservation_token)`
- Index: `idx_uim_inventory_reservations_tenant_catalog (tenant_id, catalog_item_id, reservation_status, created_at desc)`
- RLS enabled.

### 2.1.5 `public.uim_inventory_commands`
Business purpose: command envelope and idempotency control.

Columns:
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| tenant_id | uuid | no |  | FK -> `tenants.id` |
| franchise_id | uuid | yes |  | FK -> `franchises.id` |
| command_type | varchar(30) | no |  | check enum `RECEIVE/MOVE/RESERVE/CONSUME` |
| command_payload | jsonb | no | `'{}'::jsonb` |  |
| idempotency_key | varchar(120) | yes |  | unique with tenant |
| command_status | varchar(20) | no | `'accepted'` | check enum `accepted/applied/failed` |
| error_message | text | yes |  |  |
| applied_at | timestamptz | yes |  |  |
| created_at | timestamptz | no | `now()` |  |
| created_by | uuid | yes |  | FK -> `auth.users.id` |

Constraints and indexes:
- PK: `(id)`
- Unique: `(tenant_id, idempotency_key)`
- Indexes:
  - `idx_uim_inventory_commands_tenant_created (tenant_id, created_at desc)`
  - `idx_uim_inventory_commands_tenant_type (tenant_id, command_type, created_at desc)`
- RLS enabled.

### 2.1.6 `public.uim_inventory_projection_snapshots`
Business purpose: query-optimized inventory projection for low-latency reads.

Columns:
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| tenant_id | uuid | no |  | FK -> `tenants.id` |
| franchise_id | uuid | yes |  | FK -> `franchises.id` |
| inventory_item_id | uuid | no |  | FK -> `uim_inventory_items.id` cascade |
| projected_available_quantity | numeric(12,4) | no | `0` |  |
| projected_reserved_quantity | numeric(12,4) | no | `0` |  |
| projected_consumed_quantity | numeric(12,4) | no | `0` |  |
| last_ledger_id | uuid | yes |  |  |
| last_ledger_at | timestamptz | yes |  |  |
| replay_version | bigint | no | `1` |  |
| created_at | timestamptz | no | `now()` |  |
| updated_at | timestamptz | no | `now()` |  |

Constraints and indexes:
- PK: `(id)`
- Unique: `(tenant_id, inventory_item_id)`
- Index: `idx_uim_projection_snapshots_tenant_item (tenant_id, inventory_item_id)`
- RLS enabled.

### 2.1.7 `public.uim_mro_item_profiles`
Business purpose: AMRO/MRO-specific semantic extension of UIM catalog.

Columns:
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| tenant_id | uuid | no |  | FK -> `tenants.id` |
| franchise_id | uuid | yes |  | FK -> `franchises.id` |
| catalog_item_id | uuid | no |  | FK -> `uim_catalog_items.id` cascade |
| maintenance_category | text | no |  | check enum `rotable/consumable/tooling/equipment/emergency-spare` |
| ata_chapter_code | varchar(4) | no |  |  |
| ata_sub_chapter_code | varchar(4) | no |  |  |
| ata_section_code | varchar(4) | no |  |  |
| manufacturer_name | text | no |  |  |
| manufacturer_code | text | no |  |  |
| shelf_life_days | integer | yes |  | check `>= 0` |
| condition_code | text | no | `'SV'` | enum `SV/AR/INSP/OH/SCRAP/QUAR` |
| storage_requirements | jsonb | no | `'{}'::jsonb` |  |
| certification_status | text | no | `'valid'` | enum `valid/expiring/expired/pending` |
| certification_reference | text | yes |  |  |
| hazardous_material | boolean | no | `false` |  |
| calibrated_tool | boolean | no | `false` |  |
| calibration_due_date | date | yes |  |  |
| regulatory_compliance | jsonb | no | `'{}'::jsonb` |  |
| aog_priority | boolean | no | `false` |  |
| traceability | jsonb | no | `'{}'::jsonb` |  |
| metadata | jsonb | no | `'{}'::jsonb` |  |
| created_at | timestamptz | no | `now()` |  |
| updated_at | timestamptz | no | `now()` |  |
| created_by | uuid | yes |  | FK -> `auth.users.id` |
| updated_by | uuid | yes |  | FK -> `auth.users.id` |

Constraints and indexes:
- PK: `(id)`
- Unique: `(tenant_id, catalog_item_id)`
- Indexes:
  - `idx_uim_mro_profile_ata (tenant_id, ata_chapter_code, ata_sub_chapter_code, ata_section_code)`
  - `idx_uim_mro_profile_aog (tenant_id, aog_priority, maintenance_category)`
  - `idx_uim_mro_profile_calibration (tenant_id, calibration_due_date) where calibration_due_date is not null`
- RLS enabled.

### 2.1.8 UIM Reference and Sync Tables
Additional inventory-adjacent tables:
- `uim_inventory_categories` (unique `(tenant_id, category_code)`).
- `uim_inventory_locations` (unique `(tenant_id, location_code)`).
- `uim_inventory_suppliers` (unique `(tenant_id, supplier_code)`).
- `uim_inventory_valuation_methods` (unique `(tenant_id, valuation_code)`).
- `uim_amro_sync_jobs` (unique `(tenant_id, idempotency_key)` + queue/retry indexes).
- `uim_amro_sync_audit` (audit stream for direction/action/outcome).
- `amro_uim_inventory_sync_events` (sync batch event summary).

## 2.2 AMRO Inventory Tables (Current)
### 2.2.1 `public.parts_inventory`
Business purpose: AMRO operational inventory quantity state (current legacy source in several AMRO APIs).

Columns (base + comprehensive extension migration):
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| tenant_id | uuid | no |  | FK -> `tenants.id` |
| franchise_id | uuid | yes |  | FK -> `franchises.id` |
| part_number | text | no |  |  |
| serial_number | text | yes |  |  |
| description | text | yes |  |  |
| component_id | uuid | yes |  | FK -> `components.id` set null |
| supplier_id | uuid | yes |  | FK -> `suppliers.id` set null |
| warehouse_location | text | no |  |  |
| quantity_on_hand | integer | no | `0` | check `>= 0` |
| quantity_reserved | integer | no | `0` | check `>= 0` |
| quantity_available | integer | generated |  | generated `quantity_on_hand - quantity_reserved` |
| reorder_level | integer | no | `0` | check `>= 0` |
| reorder_quantity | integer | no | `0` | check `>= 0` |
| unit_cost | numeric(12,2) | yes |  |  |
| currency | text | no | `'USD'` |  |
| status | text | no | `'available'` | enum `available/low_stock/reserved/quarantined/unserviceable` |
| last_movement_at | timestamptz | yes |  |  |
| created_at | timestamptz | no | `now()` |  |
| updated_at | timestamptz | no | `now()` |  |
| item_type | text | no | `'part'` | enum `part/consumable/tool/equipment` |
| ata_chapter | text | yes |  |  |
| lot_number | text | yes |  |  |
| batch_number | text | yes |  |  |
| certification_type | text | yes |  |  |
| certification_reference | text | yes |  |  |
| certification_expiry_date | date | yes |  |  |
| shelf_life_days | integer | yes |  | check `>= 0` |
| expiry_date | date | yes |  |  |
| storage_requirements | jsonb | no | `'{}'::jsonb` |  |
| barcode_value | text | yes |  |  |
| rfid_tag | text | yes |  |  |
| regulatory_compliance | jsonb | no | `'{}'::jsonb` |  |
| criticality | text | no | `'normal'` | enum `critical/high/normal/low` |
| min_serviceable_qty | integer | no | `0` | check `>= 0` |
| traceability_data | jsonb | no | `'{}'::jsonb` |  |
| metadata | jsonb | no | `'{}'::jsonb` |  |

Constraints and indexes:
- PK: `(id)`
- Unique: `(tenant_id, part_number, coalesce(serial_number, ''), warehouse_location)`
- Check: `quantity_reserved <= quantity_on_hand`
- Indexes:
  - `idx_parts_inventory_tenant_id`
  - `idx_parts_inventory_part_number`
  - `idx_parts_inventory_supplier_id`
  - `idx_parts_inventory_status`
  - `idx_parts_inventory_tenant_item_type`
  - `idx_parts_inventory_tenant_ata_chapter`
  - `idx_parts_inventory_tenant_expiry_date where expiry_date is not null`
  - `idx_parts_inventory_tenant_reorder_gap`
- RLS enabled via AMRO schema expansion policy loop.

### 2.2.2 `public.stock_movements`
Business purpose: AMRO movement transaction log.

Columns:
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| tenant_id | uuid | no |  | FK -> `tenants.id` |
| franchise_id | uuid | yes |  | FK -> `franchises.id` |
| inventory_id | uuid | no |  | FK -> `parts_inventory.id` cascade |
| movement_type | text | no |  | enum `receipt/issue/transfer/adjustment/return/scrap` |
| quantity | integer | no |  | check `> 0` |
| from_location | text | yes |  |  |
| to_location | text | yes |  |  |
| reference_type | text | yes |  |  |
| reference_id | uuid | yes |  |  |
| moved_by | uuid | yes |  | FK -> `auth.users.id` |
| movement_timestamp | timestamptz | no | `now()` |  |
| notes | text | yes |  |  |
| created_at | timestamptz | no | `now()` |  |
| updated_at | timestamptz | no | `now()` |  |

Indexes:
- `idx_stock_movements_tenant_id`
- `idx_stock_movements_inventory_id`
- `idx_stock_movements_timestamp`
- RLS enabled.

### 2.2.3 `public.reservations`
Business purpose: AMRO reservation records tied to work package/task execution.

Columns:
| Column | Type | Null | Default | Constraints |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| tenant_id | uuid | no |  | FK -> `tenants.id` |
| franchise_id | uuid | yes |  | FK -> `franchises.id` |
| inventory_id | uuid | no |  | FK -> `parts_inventory.id` cascade |
| work_package_id | uuid | yes |  | FK -> `work_packages.id` |
| task_id | uuid | yes |  | FK -> `tasks.id` |
| reserved_quantity | integer | no |  | check `> 0` |
| status | text | no | `'active'` | enum `active/fulfilled/released/expired/cancelled` |
| reserved_by | uuid | yes |  | FK -> `auth.users.id` |
| expires_at | timestamptz | yes |  |  |
| fulfilled_at | timestamptz | yes |  |  |
| created_at | timestamptz | no | `now()` |  |
| updated_at | timestamptz | no | `now()` |  |

Indexes:
- `idx_reservations_tenant_id`
- `idx_reservations_inventory_id`
- `idx_reservations_work_package_id`
- `idx_reservations_status`
- RLS enabled.

### 2.2.4 `public.amro_inventory_reorder_queue`
Business purpose: low-stock and shortage procurement queue.

Key schema:
- FK: `inventory_id -> parts_inventory.id`, `supplier_id -> suppliers.id`.
- Enum checks:
  - `reorder_reason`: `low_stock/critical_shortage/expiry_replacement/manual`
  - `status`: `pending/submitted/ordered/received/cancelled`
- Index: `idx_amro_inventory_reorder_queue_tenant_status`.

### 2.2.5 `public.amro_inventory_scan_events`
Business purpose: AMRO scan telemetry and validation outcomes.

Key schema:
- Optional FK: `inventory_id -> parts_inventory.id`.
- Enum checks:
  - `scan_mode`: `barcode/rfid/manual`
  - `event_type`: `receive/issue/transfer/audit/reserve/release`
  - `status`: `captured/validated/rejected`
- Index: `idx_amro_inventory_scan_events_tenant_scanned`.

### 2.2.6 `public.amro_inventory_work_order_links`
Business purpose: posting linkage between inventory operations and work package/task lifecycle.

Key schema:
- FKs: `inventory_id -> parts_inventory.id`, `reservation_id -> reservations.id`, plus work package/task links.
- Enum checks:
  - `action_type`: `reserve/consume/release/return/reconcile`
  - `posting_status`: `posted/pending/failed`
- Index: `idx_amro_inventory_work_order_links_tenant_work_package`.

### 2.2.7 `public.amro_inventory_health_overview` (View)
Business purpose: aggregated risk metrics from `parts_inventory`.

Computed metrics:
- `total_items`
- `low_stock_items`
- `serviceability_risk_items`
- `expiring_next_90d`
- `critical_items`

## 2.3 Primary/Foreign Key Relationship Summary
### UIM core graph
- `uim_catalog_items` -> `uim_inventory_items` (1:N)
- `uim_catalog_items` -> `uim_inventory_reservations` (1:N)
- `uim_inventory_items` -> `uim_inventory_ledger` (1:N)
- `uim_inventory_reservations` -> `uim_inventory_ledger` (optional 1:N by `reservation_id`)
- `uim_catalog_items` -> `uim_mro_item_profiles` (1:1 tenant-scoped)

### AMRO inventory graph
- `parts_inventory` -> `stock_movements` (1:N)
- `parts_inventory` -> `reservations` (1:N)
- `parts_inventory` -> `amro_inventory_reorder_queue` (1:N)
- `parts_inventory` -> `amro_inventory_scan_events` (optional 1:N)
- `parts_inventory` -> `amro_inventory_work_order_links` (1:N)

## 3. Data Dictionary and Cross-Reference
## 3.1 Equivalent Entity Mapping
| Domain Concept | UIM Entity | AMRO Entity | Duplicate/Conflict Assessment |
|---|---|---|---|
| Item master | `uim_catalog_items` | `parts_inventory` (part metadata columns) | duplicate semantics split between master + stock |
| On-hand state | `uim_inventory_items` | `parts_inventory.quantity_on_hand/reserved/available` | direct conflict in quantity ownership |
| Movement ledger | `uim_inventory_ledger` | `stock_movements` | duplicate transaction logs |
| Reservations | `uim_inventory_reservations` | `reservations` | duplicate lifecycle definitions |
| MRO metadata | `uim_mro_item_profiles` + `attributes/metadata` | `parts_inventory` extended fields | semantically equivalent with structure mismatch |
| Reorder queue | UIM projection + optional queue extension | `amro_inventory_reorder_queue` | AMRO-specific workflow can remain, source should shift |
| Scan audit | UIM command audit + optional scan metadata | `amro_inventory_scan_events` | complementary; keep AMRO audit table as consumer stream |

## 3.2 Conflicting Definitions
| Attribute | UIM Definition | AMRO Definition | Conflict |
|---|---|---|---|
| quantity precision | `numeric(12,4)` | `integer` | unit and precision mismatch |
| status model | inventory status + reservation status separated | inventory status includes reservation-like states | semantic overlap |
| location model | `location_type/location_id` + optional reference tables | `warehouse_location` free text | normalization mismatch |
| reservation token | explicit unique token | none (reservation id only) | idempotency gap in AMRO |
| movement sign semantics | `quantity_changed` signed numeric | `quantity` always positive + movement_type context | transform required |

## 4. Gap Analysis Matrix (AMRO -> UIM)
| AMRO Table | UIM Counterpart | Semantic Difference | Missing in UIM | Data Quality Risk | Required UIM Extension |
|---|---|---|---|---|---|
| `parts_inventory` | `uim_catalog_items` + `uim_inventory_items` + `uim_mro_item_profiles` | AMRO table conflates master + stock | direct typed columns for some supplier/regulatory fields not normalized | duplicate part IDs/serials, free-text locations | add normalized supplier/location references in command pipeline; enforce profile completeness checks |
| `stock_movements` | `uim_inventory_ledger` | signed vs typed movement conventions | source movement actor granularity parity needs verification | missing reference IDs in legacy rows | mapping function for type + sign; strict null policy |
| `reservations` | `uim_inventory_reservations` | work-package coupling direct in AMRO | AMRO-specific task/work-package columns not first-class in UIM reservation | inactive/expired state inconsistencies | formalize `work_package_id/task_id` in reservation metadata contract or add extension table |
| `amro_inventory_reorder_queue` | none direct | AMRO process queue | queue model not first-class in UIM | stale queue rows after cutover | add `uim_reorder_signals` or retain AMRO queue sourced from UIM projections |
| `amro_inventory_scan_events` | none direct | scan-specific event log | scanner device and validation states | unmapped scans without inventory IDs | keep AMRO scan table as satellite and reference UIM IDs |
| `amro_inventory_work_order_links` | `uim_amro_sync_audit` (partial) | AMRO keeps explicit operational posting links | direct work-order linkage table in UIM | orphan work-package links | add `uim_amro_work_order_bridge` or preserve AMRO table for 12 months post cutover |
| `amro_inventory_health_overview` | UIM projection-based analytics views | aggregate model source differs | equivalent UIM AMRO health view not materialized | reporting drift | create `uim_amro_inventory_health_overview` view |

## 5. Migration Strategy Evaluation
## 5.1 Strategy A: Big-Bang Cutover
Description: full AMRO inventory switch to UIM in one release window.

Assessment:
- Downtime tolerance: requires high tolerance (4-12 hours expected).
- Rollback complexity: high (dual-state restore and replay).
- Regulatory constraints: risky if audit chain is interrupted during freeze.
- Cost-benefit: lower transition duration but highest operational risk.

Suitability: low for multi-tenant enterprise unless environment is low volume.

## 5.2 Strategy B: Phased by Business Unit/Region
Description: migrate one business unit or region at a time.

Assessment:
- Downtime tolerance: moderate to low.
- Rollback complexity: medium (blast radius contained).
- Regulatory constraints: manageable with controlled evidence packs per wave.
- Cost-benefit: balanced risk and predictable staffing.

Suitability: high.

## 5.3 Strategy C: Parallel Run with Reconciliation
Description: dual-write and dual-read with automated reconciliation until parity threshold is met.

Assessment:
- Downtime tolerance: very low (near-zero downtime).
- Rollback complexity: low-medium (legacy state remains warm).
- Regulatory constraints: strongest audit defensibility.
- Cost-benefit: higher short-term cost, best SLA protection.

Suitability: very high for critical AMRO inventory operations.

## 5.4 Recommended Approach
Recommended execution model: `Strategy C` followed by `Strategy B` wave cutovers.

Decision criteria summary:
- Select C+B if SLA breach tolerance is low and regulatory traceability strict.
- Avoid A unless tenant count and transaction volume are minimal.

## 6. Field-Level Mapping and Transformation Rules
## 6.1 Core Transformation Rules
| AMRO Source | UIM Target | Rule |
|---|---|---|
| `parts_inventory.part_number` | `uim_catalog_items.part_number` | trim, uppercase normalization |
| `parts_inventory.description` | `uim_catalog_items.title` | fallback to part number when null |
| `parts_inventory.item_type` | `uim_mro_item_profiles.maintenance_category` | map `part->rotable` configurable by ATA class |
| `parts_inventory.quantity_on_hand` | `uim_inventory_items.quantity` | decimal cast; preserve integer origin in metadata |
| `parts_inventory.status` | `uim_inventory_items.status` | map `quarantined->quarantine`, `unserviceable->quarantine/scrapped` by rule table |
| `parts_inventory.warehouse_location` | `uim_inventory_items.location_type/location_id` | lookup in `uim_inventory_locations`; unresolved -> quarantine map table |
| `reservations.reserved_quantity` | `uim_inventory_reservations.reserved_quantity` | decimal cast with >0 validation |
| `stock_movements` rows | `uim_inventory_ledger` rows | map movement type + signed quantity rules |

## 6.2 Movement Type Conversion
| AMRO movement_type | UIM transaction_type | quantity_changed |
|---|---|---|
| receipt | RECEIVE | `+quantity` |
| issue | CONSUME | `-quantity` |
| transfer | MOVE | `0` or signed with paired location metadata |
| adjustment | ADJUST | signed delta from business rule |
| return | RETURN | `+quantity` |
| scrap | SCRAP | `-quantity` |

## 6.3 Referential Integrity Rules
- Load parent `uim_catalog_items` before `uim_inventory_items`.
- Materialize mapping table `amro_inventory_id -> uim_inventory_item_id`.
- Insert reservations only after inventory IDs are resolved.
- Insert ledger rows after reservation IDs and inventory IDs are known.
- Reject unresolved FK rows into quarantine staging tables.

## 7. Migration Validation Scripts and Reconciliation Queries
## 7.1 Pre-Migration Validation Script (Example)
```sql
-- Detect duplicate part+serial+location per tenant in AMRO
SELECT tenant_id, part_number, COALESCE(serial_number, ''), warehouse_location, COUNT(*) AS dup_count
FROM public.parts_inventory
GROUP BY tenant_id, part_number, COALESCE(serial_number, ''), warehouse_location
HAVING COUNT(*) > 1;
```

## 7.2 Quantity Parity Reconciliation
```sql
-- AMRO available vs UIM projected available (tenant-level)
WITH amro AS (
  SELECT tenant_id, SUM(quantity_available)::numeric(18,4) AS amro_available
  FROM public.parts_inventory
  GROUP BY tenant_id
),
uim AS (
  SELECT tenant_id, SUM(projected_available_quantity)::numeric(18,4) AS uim_available
  FROM public.uim_inventory_projection_snapshots
  GROUP BY tenant_id
)
SELECT
  COALESCE(a.tenant_id, u.tenant_id) AS tenant_id,
  COALESCE(a.amro_available, 0) AS amro_available,
  COALESCE(u.uim_available, 0) AS uim_available,
  ABS(COALESCE(a.amro_available, 0) - COALESCE(u.uim_available, 0)) AS abs_diff
FROM amro a
FULL OUTER JOIN uim u ON u.tenant_id = a.tenant_id;
```

## 7.3 Reservation Parity Reconciliation
```sql
WITH amro_res AS (
  SELECT tenant_id, COUNT(*) AS amro_active_res
  FROM public.reservations
  WHERE status = 'active'
  GROUP BY tenant_id
),
uim_res AS (
  SELECT tenant_id, COUNT(*) AS uim_active_res
  FROM public.uim_inventory_reservations
  WHERE reservation_status = 'active'
  GROUP BY tenant_id
)
SELECT
  COALESCE(a.tenant_id, u.tenant_id) AS tenant_id,
  COALESCE(a.amro_active_res, 0) AS amro_active_res,
  COALESCE(u.uim_active_res, 0) AS uim_active_res,
  ABS(COALESCE(a.amro_active_res, 0) - COALESCE(u.uim_active_res, 0)) AS diff
FROM amro_res a
FULL OUTER JOIN uim_res u ON u.tenant_id = a.tenant_id;
```

## 7.4 Historical Audit Trail Completeness
```sql
-- Ensure every migrated AMRO movement has a corresponding UIM ledger entry
SELECT sm.id AS amro_movement_id
FROM public.stock_movements sm
LEFT JOIN public.uim_inventory_ledger ul
  ON ul.tenant_id = sm.tenant_id
 AND ul.metadata->>'source_stock_movement_id' = sm.id::text
WHERE ul.id IS NULL;
```

## 8. End-State Integration Architecture
## 8.1 Canonical Ownership Model
- UIM owns all inventory master/state/ledger/reservation writes.
- AMRO consumes UIM inventory state and submits action commands to UIM.
- AMRO-specific operational audit remains in AMRO satellite tables where needed.

## 8.2 API Contract Standards
Primary protocol mix:
- REST for transactional command/read APIs.
- GraphQL for cross-domain aggregated read models.
- gRPC optional for high-throughput internal service-to-service command streaming.

Core canonical endpoints:
- `POST /api/v2/uim/commands`
- `POST /api/v2/uim/reservations/soft`
- `POST /api/v2/uim/integrations/external-mro-pipeline?action=reserve|consume|return|sync-batch|process-queue`
- `GET /api/v2/uim/integrations/external-mro-pipeline?part_numbers=...`
- `POST /api/v2/uim/projections/replay`
- `GET /api/v2/uim/projections/items`

AMRO facade endpoints (post-cutover compatibility):
- `POST /api/v2/amro/inventory/work-order-sync` (delegates to UIM command interfaces)
- `POST /api/v2/amro/inventory/scan` (writes scan audit + calls UIM mutation)
- `GET /api/v2/amro/inventory/availability` (reads UIM projections)
- `POST /api/v2/amro/inventory/reservations` (delegates to UIM reservation APIs)

Authentication/authorization:
- Shared API auth middleware + tenant/franchise context resolution.
- Permission enforcement currently using `dashboards.view` gate; production hardening should add granular inventory scopes:
  - `inventory.read`
  - `inventory.reserve`
  - `inventory.consume`
  - `inventory.adjust`
  - `inventory.sync.admin`
- Domain guard: AMRO domain assignment validation (platform domain assignment + active subscription).

Rate limiting:
- Read endpoints: 300 requests/min/tenant.
- Command endpoints: 120 requests/min/tenant.
- Batch sync endpoints: 20 requests/min/tenant.
- Burst controls with token bucket and tenant-specific quotas.

Sample command payload schema:
```json
{
  "command_type": "CONSUME",
  "idempotency_key": "tenant-123:wp-456:task-10:part-abc:consume-1",
  "command_payload": {
    "inventory_item_id": "uuid",
    "quantity": 1,
    "reservation_id": "uuid",
    "referenced_module": "AMRO",
    "referenced_record_id": "uuid",
    "metadata": {
      "work_package_id": "WP-456",
      "task_id": "TSK-10"
    }
  }
}
```

## 8.3 Data Synchronization Protocol Choice
Selected model: `Event-driven` primary + `5-minute micro-batch` reconciliation safety net.

Event-driven layer:
- Publish UIM command-applied and ledger-appended events to Kafka/Pub-Sub topics:
  - `uim.inventory.command.applied.v1`
  - `uim.inventory.ledger.appended.v1`
  - `uim.inventory.reservation.changed.v1`
- AMRO consumers update local read models and operational dashboards.

Micro-batch safety layer:
- Every 5 minutes, run reconciliation for quantity/reservation parity.
- Auto-create correction jobs into `uim_amro_sync_jobs` when mismatch > threshold.

Trigger conditions:
- On every UIM command success.
- On AMRO scan ingestion requiring UIM mutation.
- Scheduled reconciliation intervals (5-minute + nightly full check).

Retry and DLQ:
- Exponential backoff: 30s, 2m, 10m, 30m, 2h.
- After max attempts, route to DLQ topic/table with correlation ID and payload hash.

Idempotency:
- Tenant-scoped idempotency key mandatory for all mutating calls.
- Replays return existing result and no additional writes.

Conflict resolution:
- UIM wins as authoritative write source after cutover.
- During parallel run:
  - Compare event timestamp and source authority level.
  - If AMRO direct write conflicts with UIM command result, create reconciliation incident and revert AMRO shadow record.

## 9. Error Handling and Recovery Specification
## 9.1 Standard Error Codes
| Code | Meaning | Action |
|---|---|---|
| `INV-4001` | invalid payload schema | reject request, return validation detail |
| `INV-4002` | unsupported command/action | reject request |
| `INV-4010` | unauthorized | deny |
| `INV-4030` | forbidden scope/domain | deny + security log |
| `INV-4041` | item not found | reject + optional retry after sync |
| `INV-4090` | insufficient quantity/reservation conflict | reject with current availability |
| `INV-4091` | idempotency key collision with mismatched payload | reject + manual review |
| `INV-4220` | business rule violation | reject |
| `INV-5000` | transient storage/network error | retry with backoff |
| `INV-5001` | reconciliation mismatch threshold breach | raise incident |

## 9.2 Alerting Thresholds
- Error rate > 2% over 5 minutes for command APIs.
- Reconciliation mismatch > 0.1% for any tenant over 2 consecutive runs.
- Projection lag > 60 seconds for 10 minutes.
- DLQ growth > 50 messages in 15 minutes.

## 9.3 Automatic Rollback Procedures
- Feature flag rollback to AMRO compatibility mode if:
  - command failure rate > 5% sustained 10 minutes,
  - mismatch > 0.5% for critical inventory classes,
  - p95 latency > 1200 ms for 15 minutes.
- Rollback sequence:
  1. stop new cutover traffic.
  2. drain in-flight UIM jobs.
  3. switch AMRO endpoints to fallback mode.
  4. run immediate parity snapshot.
  5. publish incident and remediation ETA.

## 9.4 Data-Correction Playbooks
- Playbook A: reservation mismatch correction.
- Playbook B: stock delta replay from ledger.
- Playbook C: orphan FK remediation.
- Playbook D: duplicate serial collapse and merge.
- Each playbook requires correlation IDs, before/after snapshots, and approval from data steward + AMRO operations lead.

## 10. Deprecation Inventory After Cutover
## 10.1 AMRO Tables and Views Eligible for Retirement
| Asset | Type | Upstream Dependencies | Downstream Consumers | Effort (PD) | Earliest Retirement |
|---|---|---|---|---:|---|
| `parts_inventory` | table | `work-order-sync.ts`, `scan.ts`, `sync.ts` | AMRO availability/reconcile APIs, health view | 25 | Phase 4 week 2 |
| `stock_movements` | table | AMRO issue/transfer/receive logic | operational reports and audit exports | 15 | Phase 4 week 2 |
| `reservations` | table | work-order reserve/release logic | AMRO reservation workflows | 12 | Phase 4 week 2 |
| `amro_inventory_health_overview` | view | `parts_inventory` | reconcile endpoint and dashboards | 5 | Phase 3 week 6 |
| `amro_inventory_reorder_queue` | table | low-stock automation | procurement workflow | 8 (if replaced) | Phase 4 week 4 |
| `amro_inventory_work_order_links` | table | work-order posting | AMRO operational trace queries | 10 (if merged into UIM audit) | Phase 4 week 4 |

## 10.2 Stored Procedure and Trigger Retirement
Inventory-specific AMRO stored procedures directly mutating `parts_inventory`/`stock_movements`/`reservations` were not identified in current migrations.  
Action:
- Mark `N/A` for direct inventory SP retirement.
- Retain non-inventory AMRO procedures.
- If hidden runtime DB functions exist outside migration repository, include in pre-decommission discovery gate.

## 10.3 API and UI Modules for Retirement/Refactor
| Asset | Type | Action | Effort (PD) | Earliest Retirement |
|---|---|---|---:|---|
| `/api/v2/amro/inventory/sync` catalog+stock write mode | API | convert to reconciliation-only API | 8 | Phase 3 week 4 |
| `/api/v2/amro/inventory/work-order-sync` direct AMRO DB mode | API | rewire as UIM facade | 10 | Phase 2 week 8 |
| `/api/v2/amro/inventory/scan` direct AMRO DB mutation path | API | split audit write + UIM command mutation | 9 | Phase 2 week 8 |
| `/api/v2/amro/inventory/availability` static/placeholder path | API | reimplement from UIM projection | 6 | Phase 2 week 6 |
| `/api/v2/amro/inventory/reservations` static/placeholder path | API | reimplement as UIM reservation facade | 6 | Phase 2 week 6 |
| AMRO inventory UI widgets calling legacy endpoints | UI modules | repoint to UIM-backed APIs | 20 | Phase 3 week 8 |

## 10.4 Third-Party Interfaces
| Interface | Current Feed | Future Feed | Effort (PD) | Earliest Retirement of Legacy Feed |
|---|---|---|---:|---|
| AMRO OpenAPI consumers (`/api/v2/amro/contracts/openapi-3.1.yaml`) | AMRO direct inventory state | AMRO facade over UIM | 12 | Phase 3 week 10 |
| Internal gRPC AMRO services | mixed AMRO source | UIM canonical gateway | 10 | Phase 3 week 12 |
| Async event subscribers | AMRO operational events | UIM canonical inventory events | 14 | Phase 4 week 1 |

## 11. Performance and Capacity Impact (Estimated)
Assumptions:
- 1.2M inventory mutation transactions/month at enterprise steady state.
- 20% YoY growth.
- 36-month retention for hot + warm access.

## 11.1 Query Load Impact on UIM
- Additional write QPS (avg): +0.5 to +1.2 QPS baseline per tenant cohort during business hours.
- Peak write QPS (global): +80 to +150 QPS during synchronized maintenance windows.
- Additional read QPS from AMRO availability/reconcile: +120 to +220 QPS peak.

## 11.2 Storage Growth (36 Months)
- `uim_inventory_ledger` growth estimate:
  - avg row payload: ~1.2 KB
  - 1.2M events/month -> ~1.44 GB/month raw
  - 36 months -> ~51.8 GB raw
  - with indexes + overhead (~2.5x): ~129.5 GB
- Projections and audit tables:
  - ~18-25 GB over 36 months.
- Total incremental inventory-related storage: ~150-165 GB over 36 months.

## 11.3 Latency Budgets
- Inventory command acknowledgement: p95 <= 450 ms, p99 <= 900 ms.
- Availability query: p95 <= 250 ms, p99 <= 600 ms.
- Reconciliation API/report generation: p95 <= 2 s for tenant scope.

## 11.4 Horizontal Scaling Requirements
- Database:
  - enable partitioning for `uim_inventory_ledger` by month.
  - 2x read replica scale by Phase 3.
- API:
  - 3-5 stateless pods for UIM command APIs at baseline; autoscale to 10 for peak windows.
- Queue/stream:
  - DLQ + retry workers with minimum 2 active consumers per region.

## 12. Data Quality KPI and Monitoring Framework
## 12.1 KPI Targets
- Duplicate inventory identity rate: <= 0.05%.
- Null critical fields (part_number, quantity, status): <= 0.1%.
- Reconciliation mismatch tolerance: <= 0.1%.
- Orphan FK rate: 0.
- Unmapped location rate: <= 0.2% during migration, <= 0.05% steady state.
- Idempotency replay conflict rate: <= 0.01%.

## 12.2 Continuous Monitoring Design
- Rule engine runs:
  - every 5 minutes (parity checks),
  - hourly (schema and FK integrity),
  - nightly (full ledger-to-projection replay validation).
- Metrics sink:
  - push KPI metrics to monitoring dashboards.
- Automated anomaly detection:
  - z-score and rolling baseline checks for sudden mismatch spikes.
- Alert routing:
  - severity-based to SRE, data governance, AMRO ops leads.

## 13. Risk Register
| Risk | Category | Probability | Impact | Mitigation | Contingency | Owner |
|---|---|---|---|---|---|---|
| Regulatory non-compliance due to missing traceability links | compliance | medium | critical | immutable ledger mapping + audit evidence packs | freeze cutover and run replay validation | Compliance Lead |
| Data loss during migration transforms | data | low-medium | critical | staged loads + checksums + rollback snapshots | restore from snapshot and rerun batch | Data Migration Lead |
| Service outage during cutover | ops | medium | high | parallel-run + traffic shaping + feature flags | instant fallback to AMRO facade mode | SRE Lead |
| SLA breach from projection lag | performance | medium | high | autoscale workers + lag alerts | force sync and degrade to cached reads | Platform Ops Lead |
| Inconsistent dual-write states | integration | medium | high | idempotency + reconciliation jobs | lock affected tenant and execute correction playbook | Integration Lead |
| Customer-facing report drift | business | medium | medium-high | report dual-run with signoff | freeze report cutover and keep legacy report path | BI Lead |

## 14. Phased Roadmap and Governance Gates
## Phase 0 (4 weeks): Baseline and Tool Setup
Deliverables:
- schema inventory baseline and mapping repository.
- migration tooling, validation scripts, reconciliation dashboards.
- feature flags and rollout controls.

Go/No-Go:
- all source schemas audited and approved.
- dry-run migration for sample tenant succeeds with <=0.1% mismatch.

Sign-off:
- Data Architecture, AMRO Product, Platform Security.

## Phase 1 (8 weeks): Schema Harmonization and API Development
Deliverables:
- UIM schema extensions finalized.
- AMRO facade endpoints rewired to UIM command/reservation contracts.
- standardized error codes and idempotency enforcement.

Go/No-Go:
- contract test pass >= 98%.
- p95 latency within target in staging.

Sign-off:
- API Governance Board, QA, SRE.

## Phase 2 (12 weeks): Pilot Migration (One Region/Product Line)
Deliverables:
- parallel run enabled for pilot cohort.
- daily reconciliation and anomaly handling.
- user training and operational runbooks.

Go/No-Go:
- 4 consecutive weeks mismatch <= 0.1%.
- no Sev-1 inventory incidents for pilot cohort.

Sign-off:
- Regional Ops Director, Data Governance, Customer Success.

## Phase 3 (20 weeks): Enterprise-Wide Rollout
Deliverables:
- wave-based expansion to all regions/product lines.
- AMRO legacy inventory tables switched to read-only shadow mode.
- full SLA and reliability monitoring in production.

Go/No-Go per wave:
- KPI thresholds achieved for previous wave.
- rollback drill successful.

Sign-off:
- CIO delegate, Enterprise PMO, Architecture Review Board.

## Phase 4 (4 weeks): Legacy Decommissioning
Deliverables:
- retire legacy AMRO inventory writes.
- archive and drop approved AMRO inventory tables/views/interfaces.
- final compliance and audit closure report.

Go/No-Go:
- 30-day stability with no critical variance.
- all downstream consumers validated on UIM-fed contracts.

Sign-off:
- Architecture Board, Compliance, Finance Controls.

## 15. Communication Plan
Business audience cadence:
- bi-weekly executive brief (value, risk, milestone status).
- monthly steering committee deck.

IT/engineering audience cadence:
- weekly implementation sync.
- daily migration standup during pilot/rollout windows.
- post-incident review within 24 hours for severity events.

Artifacts:
- release notes per wave,
- risk and KPI dashboard snapshots,
- runbook updates and change approvals.

## 16. Optional C-Suite Executive Summary (1-2 pages)
### Objectives
- eliminate duplicate inventory truth across AMRO and UIM.
- improve auditability, reduce reconciliation cost, and increase operational reliability.

### Expected Benefits
- 30-45% reduction in inventory data reconciliation workload.
- faster maintenance fulfillment decisions from consistent availability data.
- improved regulatory confidence through immutable ledger traceability.

### Cost and Timeline
- program duration: 48 weeks total (4+8+12+20+4).
- primary costs: integration engineering, migration operations, QA/regression, monitoring.
- expected payback: 12-18 months via reduced rework, incident reduction, and reporting simplification.

### Key Risks
- migration data quality, service continuity, and regulatory evidence continuity.
- mitigated through parallel run, strict KPI gates, and staged decommission.

## 17. Optional Technical Backlog (Jira Format)
## Epic 1: Canonical Schema and Data Dictionary (SP: 34)
Story UIM-101 (8 SP): publish canonical inventory data dictionary.
- Acceptance:
  - all UIM/AMRO inventory columns documented with type/constraints/indexes.
  - mapping table approved by architecture board.
- Dependencies: none.

Story UIM-102 (13 SP): build migration staging + quality validation scripts.
- Acceptance:
  - duplicate/null/FK validations automated.
  - threshold breach alerts generated.
- Dependencies: UIM-101.

Story UIM-103 (13 SP): implement reconciliation SQL and KPI dashboard.
- Acceptance:
  - mismatch KPI visible by tenant.
  - auto-incident tickets on threshold breach.
- Dependencies: UIM-102.

## Epic 2: API Canonicalization and Facades (SP: 55)
Story UIM-201 (13 SP): rewire AMRO work-order sync to UIM commands.
- Acceptance:
  - no direct AMRO quantity mutations in endpoint.
  - idempotency and correlation IDs enforced.
- Dependencies: UIM-101.

Story UIM-202 (8 SP): rewire AMRO scan to dual path (audit + UIM mutation).
- Acceptance:
  - scan events persisted; inventory updates only in UIM.
- Dependencies: UIM-201.

Story UIM-203 (8 SP): implement UIM-backed availability/reservations facades.
- Acceptance:
  - AMRO endpoints return UIM projection/reservation data.
- Dependencies: UIM-201.

Story UIM-204 (13 SP): add granular inventory permissions and policy checks.
- Acceptance:
  - scoped role matrix enforced for read/reserve/consume/sync-admin.
- Dependencies: UIM-201.

Story UIM-205 (13 SP): update OpenAPI/GraphQL/gRPC contracts and consumers.
- Acceptance:
  - contract tests pass and consumers migrated.
- Dependencies: UIM-203.

## Epic 3: Migration Waves and Decommission (SP: 89)
Story UIM-301 (21 SP): pilot migration runbook and execution.
- Acceptance:
  - pilot data migration complete with <=0.1% mismatch.
  - rollback rehearsal successful.
- Dependencies: Epics 1-2.

Story UIM-302 (34 SP): enterprise wave rollout automation.
- Acceptance:
  - wave templates, checklists, and KPI gates implemented.
- Dependencies: UIM-301.

Story UIM-303 (13 SP): AMRO legacy read-only freeze and archive.
- Acceptance:
  - writes blocked on deprecated tables.
  - archive snapshots verified.
- Dependencies: UIM-302.

Story UIM-304 (21 SP): legacy asset retirement and closure.
- Acceptance:
  - deprecated APIs/tables/views removed per approved schedule.
  - final audit closure signed.
- Dependencies: UIM-303.

## 18. Final Recommendation
Adopt UIM as the authoritative inventory source through a parallel-run-first migration model, enforce canonical write ownership in UIM, and retire AMRO duplicate inventory assets only after KPI-stable enterprise rollout gates are met.
