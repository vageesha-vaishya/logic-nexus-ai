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

## 7. Open questions — RESOLVED 2026-06-03

All 7 questions answered by domain owner. Decisions recorded inline.

### Q1 — Currency placement → **AMRO extension** ✅ (commit 3c916868)
`currency` lives in `amro.part_profiles.currency` (existing catalog-level AMRO extension). Falls back to franchise/tenant currency when NULL. Currency is procurement metadata, not catalog metadata; keeps UIM core lean for non-AMRO modules.

### Q2 — Manufacturer fields hoist → **YES, to UIM core** ✅ (commit TBD)
Added `manufacturer_name`, `manufacturer_part_number`, `oem_part_number` as first-class text columns on `public.uim_catalog_items`, plus indexes on `(tenant_id, manufacturer_part_number)` and `(tenant_id, oem_part_number)` (partial WHERE NOT NULL). Cross-industry value; cheap; AMRO slice 9c backfill becomes a clean column copy instead of JSONB extraction.

### Q3 — Lifecycle reconciliation → **UIM single column + AMRO mapping fn** ✅ (commit TBD)
Real prod audit (75 AMRO items): `status` is only ever 'active', `is_active` is redundant, `lifecycle_status` (`serviceable`/`quarantined`/`inspection_due`/`ready_for_install`) is actually **per-physical-item airworthiness** not catalog state. Decision:
- Added `lifecycle_state text NOT NULL DEFAULT 'active' CHECK IN ('active','draft','retired','archived')` to `uim.catalog_items`.
- Created `amro.map_lifecycle_to_uim(status, lifecycle_status, is_active)` IMMUTABLE SQL fn used by slice 9c backfill.
- `lifecycle_status` is INTENTIONALLY IGNORED at catalog level — it belongs on a per-item AMRO surface (existing `amro.part_profiles` doesn't carry it yet; per-item state goes on `uim.inventory_items.status` + AMRO extensions when needed).

### Q4 — Work-order linkage → **stay AMRO-specific** ✅ (no code change)
`amro.work_order_item_links` already exists in production (discovered in §10a audit). Keep it AMRO-specific. UIM's domain model does not extend to work-order semantics (work-orders are an MRO concept, not a generic inventory concept). If a 2nd module wires work-orders later (e.g., a maintenance feature in Logistics), revisit.

### Q5 — Transaction-type codes → **mapping fn, no UIM enum change** ✅ (commit TBD)
Real prod audit: AMRO `movement_type` uses only `receipt/issue/adjustment` (3 values, 92 rows). UIM's `transaction_type` CHECK already covers `RECEIVE/MOVE/RESERVE/RELEASE/CONSUME/ADJUST/SCRAP/RETURN` — every AMRO value has a UIM equivalent. Decision:
- Created `amro.map_txn_type_to_uim(amro_movement)` IMMUTABLE SQL fn covering all 8 UIM values (8 mappings + ADJUST default for unknown).
- Used by slice 9e backfill.
- No UIM CHECK constraint changes.

### Q6 — `uim_mro_item_profiles` rationalization → **fold into `amro.part_profiles`** ✅ (slice 9b)
The existing `amro.part_profiles` (18 cols, catalog-keyed, prod-empty) is the canonical home for catalog-level MRO/aviation metadata. `public.uim_mro_item_profiles` becomes deprecated. The 7 fields on `uim_mro_item_profiles` (maintenance_category, ata_chapter_code, ata_sub_chapter_code, ata_section_code, condition_code, certification_status, aog_priority) merge into the existing `amro.part_profiles` schema (which already has `regulatory_class`, `ata_chapter`, etc.) during slice 9b. Frontend code that currently reads `uim_mro_item_profiles` via GraphQL DataLoader gets updated to join `amro.part_profiles` instead — but only after the data fold completes.

### Q7 — Rollback policy → **30-day deprecation window** ✅ (no code change)
Slice 9j (DROP the 15 absorbed `amro_*` tables) gates on:
- All AMRO frontend hooks have read from the new location for 30+ days
- Zero queries against the old tables in the last 30 days (verify via Supabase log analysis or PostgreSQL's `pg_stat_user_tables.seq_scan + idx_scan`)
- AMRO acceptance tests still passing
- Operator sign-off (this user)

If any criterion fails, the deprecation window extends by another 30 days. Hard cap: 90 days from slice 9i completion. After 90 days, drop regardless (the tables are then provably abandoned).

---

## 7a. Original open questions (for history)

These were the questions BEFORE the §7 resolution above. Keeping them inline so the diff is auditable.

1. Currency per-item — keep on `uim.catalog_items` or push to `amro.item_aviation_metadata`? — answered Q1.
2. Manufacturer fields — hoist to `uim.catalog_items` or leave in `attributes` JSONB? — answered Q2.
3. Lifecycle reconciliation — AMRO has 3 status columns; UIM has 1. — answered Q3.
4. Work-order linkage — keep `amro.work_order_inventory_links` AMRO-specific or generalize? — answered Q4.
5. Transaction-type codes — translation or UIM enum extension? — answered Q5.
6. `uim_mro_item_profiles` rationalization. — answered Q6.
7. Rollback policy for slice 9j. — answered Q7.

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

## 10a. Post-design audit finding (2026-06-03)

**The `amro.*` schema already contained 39 tables in production** when this design was written — the original audit only inspected `public.amro_*`. Relevant pre-existing tables:

| Table | Cols | Rows | Overlaps with |
|---|---|---|---|
| `amro.part_profiles` | 18 | 0 | proposed `item_aviation_metadata` + parts of `item_life_limit_tracking` (has ata_chapter, life_limited, life_limit_hours/cycles/months, calibration_required, calibration_interval_hours/months, requires_airworthiness_release) |
| `amro.inventory_extensions` | 21 | 0 | proposed `item_aviation_metadata` (hazmat_class, un_number, shelf_life_days + trade compliance: hs_code, ecn_eccn, country_of_origin, plus storage temp/humidity/ESD/light sensitive) |
| `amro.calibration_logs` | 19 | 0 | proposed `item_calibration_intervals` — but `calibration_logs` is a per-event log; the schedule (`next_calibration_due`, `calibration_interval_days`) lives on `part_profiles` |
| `amro.tool_maintenance_history` | 13 | 0 | adjacent to life-limit tracking for tools |

**Decision**: use the existing tables. Slice 9a executed as:
- DROP TABLE the 3 proposed new tables (all empty; no data loss).
- ADD COLUMN `currency text` to `amro.part_profiles` per Q1.

**Implication for slices 9b-9j**: every reference to the proposed extension tables in §4-§6 above should be re-targeted to the existing tables. Full column-by-column reconciliation is a follow-up audit; see commit history for the rollback.

The §4 proposed schema is preserved as the conceptual model — it cleanly separates catalog-level vs inventory-level vs tool-specific extension data. The implementation just lives in the existing 4 tables rather than 3 new ones.

---

## 11. Next action

**Schedule sync with AMRO domain owner.** Do not ship implementation slices (9a-9j) until §7 open questions are answered. This doc is the conversation starter, not the plan of record.
