# Phase 7 UIM Step 9 — AMRO ↔ UIM Inventory Boundary Design

Date: 2026-06-03
Author: Claude (Opus 4.7) — pair with @vimalbahuguna
Status: **DRAFT — needs AMRO domain owner approval before implementation**
Predecessors:
- `docs/plans/2026-05-28-modules/uim.md` §9.4 (master plan; recommends AMRO uses `uim.inventory_*` as primary, adds ~3 thin extension tables)
- `docs/plans/2026-05-28-modules/amro.md` (AMRO module canonical plan)

---

## 1. Scope of this doc

Step 9 in the Phase 7 master plan is **AMRO ↔ UIM inventory boundary decision** — marked "needs a session with AMRO + UIM domain owners". The master plan §9.4 has a **tentative** recommendation; this doc:

1. Audits the current AMRO inventory surface (column-by-column).
2. Classifies every column as `→ UIM core`, `→ AMRO extension`, or `→ debate`.
3. Proposes the 3 extension tables the master plan recommended.
4. Outlines a migration sequence with rollback hooks.

**Implementation slices are NOT in scope.** Cutting AMRO over from `public.amro_inventory_*` → `uim.inventory_*` + extension tables requires domain-owner sign-off on the column classifications and a stakeholder review of any field renames. This doc is the artifact that conversation works against.

---

## 2. Current state — production audit (2026-06-03)

19 tables in the `public.amro_*` inventory namespace. Row counts:

| Table | Cols | Rows |
|---|---|---|
| `amro_item_master` | 24 | 75 |
| `amro_inventory_scan_events` | 17 | 0 |
| `amro_inventory_reorder_queue` | 16 | 0 |
| `amro_inventory_work_order_links` | 14 | 0 |
| `amro_inventory_health_overview` | 7 | (view) |
| `amro_item_cross_references` | 13 | 150 |
| `amro_item_uom_conversions` | 14 | 75 |
| `amro_stock_approval_queue` | 15 | 0 |
| `amro_stock_audit_export` | 9 | (view) |
| `amro_stock_audit_timeline` | 10 | 99 |
| `amro_stock_balance_summary` | 8 | (view) |
| `amro_stock_ledger_current_balance` | 13 | (view) |
| `amro_stock_ledger_transactions` | 26 | 92 |
| `amro_stock_period_closes` | 16 | 1 |
| `amro_stock_reconciliation_items` | 11 | 5,000 |
| `amro_stock_reconciliation_runs` | 11 | 5 |
| `amro_stock_valuation_consumptions` | 10 | 0 |
| `amro_stock_valuation_layers` | 14 | 40 |
| `amro_stock_valuation_summary` | 7 | (view) |

Counterpart UIM tables (`public.uim_*` — pre-existing 14-table namespace):
- `uim_catalog_items` — corresponds to `amro_item_master`
- `uim_inventory_items` — corresponds to per-location inventory
- `uim_inventory_ledger` — corresponds to `amro_stock_ledger_transactions`
- `uim_inventory_reservations`, `uim_inventory_projection_snapshots`
- `uim_item_uom_conversions`, `uim_item_cross_references` — already namespace-matches AMRO
- `uim_stock_*` (period closes, reconciliation runs/items, valuation layers/consumptions, approval queue, audit timeline) — 1:1 name match with `amro_stock_*`

**Observation**: the `uim_*` and `amro_*` namespaces are already shaped as parallel mirrors. The boundary decision is about which one is the **source of truth** for which slice of data, not about whether the columns line up.

---

## 3. Column classification — `amro_item_master` (the keystone)

24 columns, classified into 3 buckets:

### Bucket A — → UIM core (`uim_catalog_items`)
Columns that describe the SKU at the catalog level, identical concepts across non-AMRO industries:

| AMRO column | Maps to UIM | Notes |
|---|---|---|
| `id` | `id` | UUID PK, direct |
| `tenant_id`, `franchise_id` | same | direct |
| `part_number` | `part_number` | direct |
| `description` | `title` | rename |
| `category`, `subcategory` | `category` + extension | split: top-level into core, subcategory into AMRO extension (subcategory tends to be aviation-specific: rotable / consumable / repairable) |
| `manufacturer_name`, `manufacturer_part_number`, `oem_part_number` | UIM `attributes` JSONB → consider hoisting as first-class core columns | These are universal across industries (auto parts, electronics) — recommend hoisting to core in a separate prep slice |
| `unit_of_measure`, `base_unit_of_measure`, `uom_conversion_factor` | core | direct |
| `currency` | core (new) | UIM doesn't carry currency on catalog items today — add or use franchise default |
| `is_active`, `status`, `lifecycle_status` | core lifecycle | consolidate AMRO's 3 status columns into UIM's single `lifecycle_state`; mapping table needed |
| `metadata` | merge into UIM `attributes` JSONB | jsonb passthrough |
| `created_by`, `updated_by`, `created_at`, `updated_at` | direct | std audit cols |

### Bucket B — → AMRO extension (new `amro.item_aviation_metadata`)
Aviation-regulatory columns. Keyed by `catalog_item_id` (UIM core PK):

| Source column | Why AMRO-specific |
|---|---|
| `item_type` | AMRO's classification (rotable/repairable/consumable). Other industries use different taxonomies. |
| `subcategory` | Often AMRO-specific (life-limited part class) |
| `specification` (jsonb) | Aviation cert + ATA chapter codes live here today |

### Bucket C — debate
| Column | Why ambiguous |
|---|---|
| `currency` per item | Some industries set currency per-tenant only. Aviation sometimes sets per-item for cross-border procurement. Debate: is per-item flexibility needed broadly enough to live in UIM core? |
| `manufacturer_*` fields | Hoist now (recommended) vs keep in `attributes` JSONB (current). Decision affects migration scope. |

---

## 4. Proposed AMRO extension schema (3 tables)

Per master plan §9.4 ("12+ AMRO inventory tables consolidate to ~3 extension tables"):

### 4.1 `amro.item_aviation_metadata`
Keyed by `catalog_item_id`. Carries the aviation-regulatory fields that don't generalize:
```sql
CREATE TABLE amro.item_aviation_metadata (
  catalog_item_id uuid PRIMARY KEY REFERENCES uim.catalog_items(id) ON DELETE CASCADE,
  ata_chapter_code text,
  ata_sub_chapter_code text,
  ata_section_code text,
  item_type text,                 -- rotable / repairable / consumable / etc
  subcategory text,
  certification_status text,      -- airworthy / suspect / quarantined / scrap
  condition_code text,            -- NEW / OH / SV / AR / etc
  aog_priority boolean NOT NULL DEFAULT false,
  life_limited boolean NOT NULL DEFAULT false,
  hazardous_material boolean NOT NULL DEFAULT false,
  shelf_life_days int,
  source_specification jsonb,     -- raw spec block migrated from amro_item_master
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```
Owns: ~10 aviation-specific fields. Includes the `attributes.*` hoists the existing `uim_mro_item_profiles` already carries (rationalize the two into one).

### 4.2 `amro.item_life_limit_tracking`
Per inventory item (not per catalog). Tracks the life-limit clock for the physical part:
```sql
CREATE TABLE amro.item_life_limit_tracking (
  inventory_item_id uuid PRIMARY KEY REFERENCES uim.inventory_items(id) ON DELETE CASCADE,
  install_date date,
  hours_since_new numeric(12,2),
  cycles_since_new int,
  hours_since_overhaul numeric(12,2),
  cycles_since_overhaul int,
  next_inspection_at date,
  retired_at date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```
Owns: serial-specific timekeeping. Replaces the equivalent fields scattered across `amro_item_master.metadata` + `amro_stock_ledger_transactions.metadata`.

### 4.3 `amro.item_calibration_intervals`
Tools/instruments with calibration schedules:
```sql
CREATE TABLE amro.item_calibration_intervals (
  inventory_item_id uuid PRIMARY KEY REFERENCES uim.inventory_items(id) ON DELETE CASCADE,
  calibration_interval_days int,
  last_calibrated_at date,
  next_calibration_due date,
  calibration_authority text,
  calibration_certificate_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```
Owns: tooling-specific data not part of the generic inventory model.

**Total**: 3 tables × ~10 columns each = ~30 columns of true AMRO-specific data, vs the current 200+ columns across 19 amro_* tables.

---

## 5. Table-by-table fate

| Current AMRO table | Fate after Step 9 |
|---|---|
| `amro_item_master` | **DROP** — fully absorbed into `uim.catalog_items` + `amro.item_aviation_metadata` |
| `amro_inventory_scan_events` | **DROP** — empty in prod; if reintroduced, lives as `uim_inventory_ledger` rows with `referenced_module='amro'` + `transaction_type='SCAN'` |
| `amro_inventory_reorder_queue` | **MERGE into** `uim_inventory_reorder_queue` (already exists) |
| `amro_inventory_work_order_links` | **MOVE to** `amro.work_order_inventory_links` (work-order linkage is AMRO-specific) |
| `amro_inventory_health_overview` (view) | **REBUILD as** `uim.v_inventory_health` joined with AMRO extensions |
| `amro_item_cross_references` | **MERGE into** `uim_item_cross_references` (already namespace-matches) |
| `amro_item_uom_conversions` | **MERGE into** `uim_item_uom_conversions` (already namespace-matches) |
| `amro_stock_approval_queue` | **MERGE into** `uim_stock_approval_queue` |
| `amro_stock_audit_export` (view) | **REBUILD** on uim_* tables |
| `amro_stock_audit_timeline` | **MERGE into** `uim_stock_audit_timeline` (1:1 name match) |
| `amro_stock_balance_summary` (view) | **REBUILD** on uim_* tables |
| `amro_stock_ledger_current_balance` (view) | **REBUILD** on uim_inventory_ledger |
| `amro_stock_ledger_transactions` | **MERGE into** `uim_inventory_ledger` (92 rows to migrate; transaction_type values need a mapping table) |
| `amro_stock_period_closes` | **MERGE into** `uim_stock_period_closes` |
| `amro_stock_reconciliation_*` (2 tables, 5,005 rows total) | **MERGE into** `uim_stock_reconciliation_*` |
| `amro_stock_valuation_*` (3 tables, 40 rows total) | **MERGE into** `uim_stock_valuation_*` |

19 AMRO tables → 1 retained AMRO-specific table (`amro.work_order_inventory_links`) + 3 new extension tables = **net -15 tables**.

---

## 6. Migration sequence (10 slices)

Each slice is independently shippable + reversible. Estimated total wall-clock: ~3-4 weeks of autonomous development *after* AMRO domain owner sign-off on §3 + §4.

| # | Slice | Risk | Notes |
|---|---|---|---|
| 9a | Create `amro.*` schema + 3 extension tables (DDL only, no backfill) | Low | Migration; RLS; FK references uim.* (existing). |
| 9b | Backfill `amro.item_aviation_metadata` from `amro_item_master.specification` + `metadata` JSONB | Low | 75 rows; idempotent re-runnable. |
| 9c | Backfill `uim.catalog_items` from `amro_item_master` (insert rows that don't exist; update rows that do via JSONB merge) | Med | Risk: collision with existing uim_catalog_items rows (currently ~6, mostly empty per prior audit). Dry-run + diff first. |
| 9d | Cut AMRO frontend reads from `amro_item_master` → `uim.catalog_items` + `amro.item_aviation_metadata` join (RPC or view) | Med | 5-10 hooks. Behind feature flag. |
| 9e | Migrate `amro_stock_ledger_transactions` → `uim_inventory_ledger` (92 rows + transaction_type mapping) | Med | Needs a translation table for AMRO-specific txn codes. |
| 9f | Migrate `amro_stock_reconciliation_*` → `uim_stock_reconciliation_*` (5,005 rows; biggest data move) | High | Chunk into 500-row batches; reconciliation cron run after each. |
| 9g | Migrate `amro_stock_valuation_*` + `amro_stock_period_closes` + `amro_stock_audit_timeline` | Low | Total ~140 rows. |
| 9h | Merge `amro_item_uom_conversions` + `amro_item_cross_references` into uim_* counterparts | Low | Conflict-resolve via uim.sync_conflicts (Step 7.1 surface). |
| 9i | Rebuild 4 view tables (`amro_*_overview`, `amro_*_summary`) on `uim.*` + `amro.*` joins | Low | Pure SQL. |
| 9j | DROP the 15 absorbed `amro_*` tables; keep `amro.work_order_inventory_links` | High — irreversible | 30-day deprecation window first; verify zero callers via grep + log audit. |

---

## 7. Open questions for AMRO domain owner

1. **Currency per-item**: keep on `uim.catalog_items` (recommended) or push to `amro.item_aviation_metadata`? Affects whether non-AMRO modules carry currency at SKU level.
2. **Manufacturer fields**: hoist to `uim.catalog_items` first-class columns (recommended) or leave in `attributes` JSONB? Hoisting is a separate prep slice (~9.0) but unblocks query simplification across modules.
3. **Lifecycle reconciliation**: AMRO has 3 status columns (`status`, `lifecycle_status`, `is_active`); UIM has 1 (`lifecycle_state`). Need the canonical mapping table.
4. **Work-order linkage**: keep `amro.work_order_inventory_links` AMRO-specific (recommended) or move to a generic `uim.inventory_work_order_links`? The latter requires extending UIM's domain model.
5. **Transaction-type codes**: AMRO uses RECEIVE / ISSUE / SCRAP / RETURN / etc. UIM uses RECEIVE / MOVE / RESERVE / CONSUME. Need the translation table (probably extends UIM's enum rather than translates).
6. **`uim_mro_item_profiles` rationalization**: the existing `uim_mro_item_profiles` table overlaps with the proposed `amro.item_aviation_metadata`. Recommend dropping `uim_mro_item_profiles` and folding its 7 fields into the new extension table during 9b.
7. **Rollback policy for slice 9j**: 30-day window or longer? AMRO acceptance tests need to cover.

---

## 8. Acceptance criteria (Step 9 specifically)

- [ ] AMRO domain owner reviews + signs off §3 column classifications.
- [ ] AMRO domain owner reviews + signs off §4 extension schema.
- [ ] All 7 open questions in §7 have explicit decisions documented.
- [ ] §6 slices 9a-9j shipped with the standard ship pattern (build clean, commit, push, memory updated, drift checks 0).
- [ ] `public.amro_*` namespace contains exactly 1 surviving table (`amro.work_order_inventory_links` — moved to `amro.*` schema).
- [ ] AMRO frontend hooks all read from `uim.*` + `amro.*` extension joins; zero remaining `amro_item_master` queries.
- [ ] Master plan §10 acceptance criterion "AMRO consumers cut over from `public.uim_inventory_*` reads to `uim.inventory.*` via ACL" → checked.

---

## 9. References

- Master plan §9.4: `docs/plans/2026-05-28-modules/uim.md`
- AMRO module plan: `docs/plans/2026-05-28-modules/amro.md`
- AMRO inventory tables (production audit 2026-06-03):
  ```
  19 amro_* inventory tables, 5,532 total rows
  Biggest: amro_stock_reconciliation_items (5,000 rows)
  Smallest: amro_item_master (75 rows) — the keystone
  ```
- Step 7 sync_conflicts surface (commit `dc72a8b1`): conflict-resolution flow that backs slice 9h.
- ConnectorAdapter pattern (commit `abef1c4b`): the AMRO connector itself becomes a registered adapter once the boundary lands.

---

## 10. Next action

**Schedule sync with AMRO domain owner.** Do not ship implementation slices (9a-9j) until §7 open questions are answered. This doc is the conversation starter, not the plan of record.
