# `amro` — Aircraft Maintenance, Repair & Overhaul

**Date:** 2026-05-28
**Status:** Draft — under review
**Depends on:** `core`, `uim` (inventory), `logistics` (parts shipments), `compliance` (cross-tab; aviation airworthiness stays in `amro.*`)
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose & current scale

`amro` is the **largest, most-developed, most-regulated module** on the platform. Aircraft maintenance is governed by FAA/EASA/CAAC/SACAA airworthiness directives, life-limited parts tracking, MPDs (Maintenance Planning Documents), tooling calibration, AOG (Aircraft On Ground) escalation, and regulatory audit trails that must withstand inspector scrutiny.

By every measure, AMRO is the heaviest module:

| Metric | AMRO | Largest other module |
|---|---|---|
| Frontend LOC | 94,753 | Quotation ~13k (post-split) |
| Largest single file | `AmroSettingsMasterDataPage.tsx` (10,581 LOC) | UnifiedQuoteComposer (4,364 LOC) |
| Backend route files | 11 | CRM-api 3, AMRO-api dominates |
| Backend tests | 14 | Closest is comms-future-state |
| DB tables | 52 in `public.amro_*` + 5 `flypal.*` + 2 `mro_audit.*` | Markets 61 (but `markets.*` already migrated) |
| Routes | 30+ under `/dashboard/amro/*` | Markets 27 |

This module is **largely at-spec already** — own service (`services/amro-api/`), own feature dir, own backend tests, own audit schema (`mro_audit.*`). The redesign for AMRO is **less about restructuring and more about**:

1. Move `public.amro_*` (52 tables) → `amro.*`
2. Conform to the §2 contract (outbox poller, manifest, RLS-via-`has_module_access`)
3. Split the largest god components and the god hook
4. Resolve the AMRO ↔ UIM inventory boundary (open decision deferred from UIM §9.4)
5. Move compliance documents to `core.files`
6. Delete `aircraft_legacy_backup`

---

## 2. Current state (evidence)

### 2.1 Frontend (`src/features/module-amro/`)

Top-level structure: `pages/`, `components/{work-orders,unified,mpd,parts,templates,data-grid}/`, `hooks/`, `templates/{components,hooks,services,store}/`, `settings/`, `workspace/`.

**God components / god hook (>1,000 LOC):**

| File | LOC | Concern |
|---|---|---|
| `settings/pages/AmroSettingsMasterDataPage.tsx` | **10,581** | Biggest file in the entire codebase. Master-data admin (aircraft / ATA / parts / suppliers / templates). Critical refactor target. |
| `components/AmroOwnedWorkspace.tsx` | 4,324 | Workspace shell |
| `hooks/useAmroWorkspaceState.ts` | 3,099 | God hook — orchestrates workspace state |
| `settings/pages/AmroSettingsMasterDataPage.test.tsx` | 2,621 | Test for the god page |
| `components/templates/AmroInventoryDataGridTemplate.tsx` | 1,928 | Inventory data-grid |
| `components/AmroDesignSystemShowcase.tsx` | 1,915 | DS showcase — pull out of module |
| `components/parts/AmroPartsInventoryWorkbench.tsx` | 1,597 | Parts workbench |
| `pages/AmroHubVerticalPage.tsx` | 1,577 | Hub layout |
| `settings/pages/AmroSettingsMasterDataPage.test.tsx` siblings: `AircraftLeadsManager.tsx` 1,330, `WorkOrderTemplateCreateSection.tsx` 1,306, `FlightLogForm.tsx` 1,165 | — | Sub-pages of master data |
| `components/parts/AmroStockLedgerPanel.tsx` | 1,037 | Stock ledger UI (reads `uim.inventory_ledger`) |
| `components/data-grid/AmroRecordWizard.tsx` | 996 | Record wizard |
| `pages/AmroMpdManagementPage.tsx` | 947 | MPD management |

**Total module size**: 94,753 LOC. Most other files sit at 200–800 LOC and don't need urgent refactoring.

### 2.2 Backend (`services/amro-api/src/`)

The most-developed service on the platform:

- 11 route files: `directives`, `mpd`, `configure-mpd`, `work-order-template`, `work-orders`, `stock-ledger`, `enterprise`, `parts`, `item-master`, `configure-directives`, plus more
- Top-level dirs: `events/`, `instrumentation/`, `middleware/`, `realtime/`, `routes/`, `services/`, `types/`, `utils/`
- 14 backend tests (most of any service)
- Has its own `events/` — confirms AMRO is closest to the §2 outbox contract today

### 2.3 Routes — 30+ under `/dashboard/amro/*`

All gated by `requiredDomainCode="AMRO"` (already conforms to §2.7(5)). Covers: overview, aircraft, plan-directives-bulletin (MPD + directives + configure-MPD + configure-directives), work-orders, task-execution, scheduling, parts, compliance, certification, audit, integration, intelligence, settings (with master-data sub-pages for aircraft, ATA codes, parts inventory, suppliers).

### 2.4 Tables — 52 distinct sub-domains

Sub-domain groups visible in table names: `aog_alerts`, `calibration_logs`, `compliance_ad_sb_registry`, `compliance_documents`, `compliance_events`, `compliance_requirements_enhanced`, `facilities_locations`, `inventory_reorder`, `inventory_scan`, `inventory_work_order_links`, `item_cross_references`, `item_master`, `item_uom_conversions`, `operational_telemetry`, `overview_kpi_snapshots`, `part_interchangeability`, `parts_mro_workflow_events`, `purchase_order_items`, `purchase_orders`, `sla_definitions`, `stock_approval_queue`, `stock_audit_timeline`, `stock_ledger_transactions`, `stock_period_closes`, `stock_reconciliation_items`, `stock_reconciliation_runs`, `stock_valuation_consumptions`, `stock_valuation_layers`, `tool_maintenance_history`, `tool_reservations`, `tooling_instances`, `tooling_registry`, `task_dependencies`, `task_time_logs`, `work_order_audit_log`, `work_order_compliance_records`, `work_order_resource_assignments`, `work_order_template_categories`, `work_order_template_versions`, `non_scheduled_tasks`, `predictive_maintenance_recommendations`, `resource_pools`, `maintenance_triggers`, `emergency_work_orders`, `certificates_release_service`.

Plus: `flypal.flypal_configured_directives`, `flypal.flypal_directives`, `flypal.flypal_parts`, `flypal.flypal_stores`, `flypal.flypal_vendor` — vendor data.
Plus: `mro_audit.records`, `mro_audit.trails` — AMRO-specific audit (**the only example of an audit-specific schema on the platform**).
Plus: `public.aircraft_legacy_backup` — **leftover from a migration; delete in Phase 1**.

---

## 3. Target schema (`amro.*` — outline, not exhaustive)

Because AMRO has 52 tables, this subdoc lists the **sub-domain groupings** rather than each individual table. The migration is fundamentally a **schema rename** (move `public.amro_*` → `amro.*`) with cross-cutting consolidations.

### 3.1 Aircraft & operators
```sql
amro.aircraft              -- registration, model, operator, status, hours, cycles
amro.aircraft_operators    -- the airline / operator (FK → core.parties)
amro.aircraft_owners       -- ownership (FK → core.parties)
amro.aircraft_maintenance_tasks  -- recurring tasks per aircraft
```

### 3.2 Work orders & execution
```sql
amro.work_orders                            -- the main WO entity
amro.work_order_template_categories         -- WO templates (categorized)
amro.work_order_template_versions
amro.work_order_resource_assignments        -- techs, tools, parts
amro.work_order_compliance_records          -- per-WO compliance evidence
amro.work_order_audit_log                   -- → core.audit_log (killed; per §1B.8(1))
amro.task_dependencies
amro.task_time_logs
amro.non_scheduled_tasks
amro.emergency_work_orders
amro.certificates_release_service           -- CRS / return-to-service
amro.predictive_maintenance_recommendations
amro.maintenance_triggers
```

### 3.3 MPD & directives (FAA AD / EASA AD / Service Bulletins)
```sql
amro.mpd                                    -- Maintenance Planning Document
amro.mpd_revisions
amro.directives                             -- ADs and SBs
amro.compliance_ad_sb_registry              -- AD/SB applicability registry
amro.compliance_requirements_enhanced
amro.compliance_events
amro.compliance_documents                   -- file blobs move to core.files; this table becomes link table
```

### 3.4 Parts & inventory (boundary with UIM — see §9)
```sql
-- Tentative consolidation under UIM §9.4 decision:
amro.part_profiles                          -- AMRO-specific metadata over uim.inventory_items (life_limited, shelf_life, ata_chapter)
amro.part_interchangeability
amro.item_cross_references                  -- maps OEM PNs to UIM SKUs
amro.item_uom_conversions
-- Remaining amro_item_* / amro_inventory_* / amro_stock_* tables consolidate to thin extension layer:
amro.inventory_extensions                   -- extra fields atop uim.inventory_items
amro.inventory_scan_events                  -- AMRO-specific scan workflow
amro.inventory_work_order_links             -- WO ↔ inventory consumption
amro.stock_audit_timeline                   -- specialized audit subset
amro.stock_period_closes                    -- AMRO regulatory period closes
amro.stock_reconciliation_runs / .reconciliation_items
amro.stock_valuation_layers / .valuation_consumptions
amro.stock_approval_queue
amro.purchase_orders / .purchase_order_items
amro.inventory_reorder_queue
```

### 3.5 Tooling & calibration
```sql
amro.tooling_registry                       -- the canonical tool list
amro.tooling_instances                      -- physical tool instances
amro.tool_reservations
amro.tool_maintenance_history
amro.calibration_logs
```

### 3.6 Operations & telemetry
```sql
amro.aog_alerts                             -- AOG events
amro.operational_telemetry                  -- runtime hours, cycles
amro.overview_kpi_snapshots
amro.sla_definitions
amro.resource_pools                         -- staff/team allocation
amro.facilities_locations                   -- AMRO-specific facilities (hangars, bays) — coordinate with logistics.locations
amro.parts_mro_workflow_events
```

### 3.7 Vendor data (formerly `flypal.*`)
```sql
amro.vendor_directives                      -- was flypal.flypal_directives
amro.vendor_configured_directives           -- was flypal.flypal_configured_directives
amro.vendor_parts                           -- was flypal.flypal_parts
amro.vendor_stores                          -- was flypal.flypal_stores
amro.vendor_relationships                   -- was flypal.flypal_vendor; FK → core.parties
```
**`flypal.*` schema dropped** — Flypal-specific data is just one vendor's catalog; doesn't deserve a top-level schema.

### 3.8 Audit (specialised)
```sql
-- mro_audit.records and mro_audit.trails consolidate into:
-- core.audit_log with subject_type='amro.*'
-- A view amro.audit_view filters by subject_type for AMRO operators.
-- mro_audit.* schema dropped per master §2.8.
```

---

## 4. RLS strategy

AMRO already uses `requiredDomainCode="AMRO"` consistently. Migrate to standard pattern:

```sql
CREATE POLICY amro_module_access ON amro.work_orders FOR SELECT USING (
  tenant_id = auth.jwt_tenant_id()
  AND core.has_module_access(tenant_id, 'amro', 'read')
);
```

**Per-role gates** for sensitive tables:
- `amro.calibration_logs` → `amro_quality_engineer` only
- `amro.emergency_work_orders` → all AMRO users (broad read for safety)
- `amro.certificates_release_service` → `amro_certifying_engineer` only — regulatory sign-off
- `amro.aircraft_legacy_backup` → **dropped, no policy needed**

---

## 5. Events

### Published (high-volume domain — selective list)

| Event | When |
|---|---|
| `amro.aircraft.created` / `.updated` / `.transferred` | Aircraft master changes |
| `amro.work_order.created` / `.scheduled` / `.started` / `.completed` / `.cancelled` / `.deferred` | WO lifecycle |
| `amro.work_order.parts_required` | Triggers UIM reservation + Logistics shipment planning |
| `amro.work_order.parts_consumed` | Triggers UIM ledger movement |
| `amro.work_order.tool_reserved` / `.released` | Tooling reservation |
| `amro.mpd.applied` / `.revised` | MPD lifecycle |
| `amro.directive.published` / `.complied` / `.escalated` | AD/SB compliance |
| `amro.aog.opened` / `.escalated` / `.resolved` | **AOG event — high-priority for Comms** |
| `amro.calibration.due_soon` / `.overdue` | Tool calibration alerts |
| `amro.certificate.issued` | CRS / return-to-service |
| `amro.compliance.deadline_approaching` | Regulatory deadline within window |
| `amro.predictive_maintenance.recommendation_made` | AI predictive output |

### Subscribed

| Event | Action |
|---|---|
| `uim.stock.low_inventory` (parts) | Generate `amro.inventory_reorder_queue` entry |
| `logistics.shipment.delivered` (parts shipment) | Confirm part arrival, update WO status |
| `core.party.created` (party_type=organization, role=aviation_authority) | Optional onboarding event |
| `compliance.screening.failed` (subject_type='amro.work_order') | Block work-order release |

ACL location: `services/amro-api/src/acl/{uim,logistics,core,compliance}.ts`. AMRO already has an `events/` dir; formalize into outbox + ACL pattern.

---

## 6. UI surface

Routes unchanged (already mature). Key refactors:

### 6.1 `AmroSettingsMasterDataPage.tsx` split (10,581 LOC)

The biggest refactor in the entire project. Today: one page renders aircraft master, ATA codes, parts inventory, suppliers, work-order templates, ...

**Decompose by master-data domain:**

| New page | LOC target | Owns |
|---|---|---|
| `settings/master-data/AircraftMasterDataPage.tsx` | ≤800 | Aircraft list, add/edit |
| `settings/master-data/AtaCodesMasterDataPage.tsx` | ≤600 | ATA chapter master |
| `settings/master-data/PartsMasterDataPage.tsx` | ≤800 | Parts master (with UIM-extension) |
| `settings/master-data/SuppliersMasterDataPage.tsx` | ≤600 | Suppliers (linked to core.parties) |
| `settings/master-data/WorkOrderTemplatesPage.tsx` | ≤800 | WO templates (extracts `WorkOrderTemplateCreateSection.tsx` 1306 LOC) |
| `settings/master-data/AircraftLeadsManagerPage.tsx` | ≤800 | (currently 1,330 LOC) |
| `settings/master-data/FlightLogPage.tsx` | ≤800 | (currently `FlightLogForm.tsx` 1,165 LOC) |
| `settings/master-data/CalibrationMasterDataPage.tsx` | ≤600 | Calibration intervals |
| `settings/master-data/ToolingRegistryPage.tsx` | ≤600 | Tool master |

Routes for each are **already in App.tsx:1181–1184** (`amro/settings/master-data/aircraft`, `…/ata-codes`, `…/parts-inventory`, `…/suppliers`) — the routing exists; the single-page implementation collapses them. Split aligns code to routes.

Plus: a shared `settings/master-data/MasterDataLayout.tsx` (≤200) that hosts left-nav + outlet.

### 6.2 `AmroOwnedWorkspace.tsx` (4,324 LOC) + `useAmroWorkspaceState.ts` (3,099 LOC)

The god workspace + god hook. Refactor in **two phases**:

**Phase A**: Split `useAmroWorkspaceState.ts` (3,099 LOC) into sub-hooks per workspace concern:
- `useAmroAircraftSlice.ts` (≤400)
- `useAmroWorkOrdersSlice.ts` (≤500)
- `useAmroMpdSlice.ts` (≤400)
- `useAmroComplianceSlice.ts` (≤400)
- `useAmroPartsSlice.ts` (≤500)
- `useAmroOpsSlice.ts` (≤400)
- `useAmroWorkspaceState.ts` orchestrator (≤300) — composes the slices

**Phase B**: Split `AmroOwnedWorkspace.tsx` (4,324 LOC) into zone components matching the hook slices. Target each zone ≤500 LOC. Total ~3,500 LOC across 8 files.

### 6.3 `AmroDesignSystemShowcase.tsx` (1,915 LOC)

This is a design-system **demo**, not production. **Move out of module** to `src/components/dev/AmroDesignSystemShowcase.tsx` or delete if unused. Storybook-equivalent surface, gated to dev builds.

### 6.4 Other >1,000 LOC components

Each gets its own split:

- `AmroInventoryDataGridTemplate.tsx` (1,928) → template + cell renderers + filter panel + toolbar — 4 files, each ≤500
- `AmroPartsInventoryWorkbench.tsx` (1,597) → workbench shell + grid + side-panel + actions — 4 files
- `AmroHubVerticalPage.tsx` (1,577) → hub shell + KPI cards + recent items + alerts — 4 files
- `AmroStockLedgerPanel.tsx` (1,037) → ledger view + filters + drill-down — 3 files
- `AmroRecordWizard.tsx` (996) → wizard shell + step-renderers + state — 3 files
- `AmroMpdManagementPage.tsx` (947) → page shell + MPD list + revision viewer — 3 files

Total split target: ~32 files, none over 800 LOC.

---

## 7. LLM hooks (specific to AMRO)

| Rank | Feature | Mechanism | Cost notes |
|---|---|---|---|
| 1 | **Directive applicability inference** | New AD/SB published. LLM evaluates fleet against directive text → matched aircraft + recommended deadline. Replaces manual cross-checking. | Per AD/SB; ~$0.05 |
| 2 | **Work-order task auto-population** | Given WO scope + MPD reference, LLM expands into tasks with estimated time + required parts + tools. | Per WO creation; ~$0.01 |
| 3 | **Failure-mode pattern detection** | Cross-WO analysis — recurring defect codes on a specific aircraft model surface as "this hinge cracks at 1,200 cycles." | Weekly batch; ~$0.20 per fleet |
| 4 | **Predictive maintenance recommendations** | Existing `amro.predictive_maintenance_recommendations` formalised; combines telemetry + history + part-life data. | Daily batch |
| 5 | **AOG triage assistant** | When AOG opened, LLM reviews open WOs + parts availability + tooling + crew → ranks resolution paths by ETA. | Per AOG event |
| 6 | **Compliance document OCR + validation** | Form 1 / 8130-3 / EASA Form 1 uploaded → structured data + flag missing signatures. | Per doc; ~$0.01 with OCR |
| 7 | **Tech-log narrative summarisation** | End-of-shift natural-language summary from technician notes. | Per shift |
| 8 | **Inspector audit-trail narration** | Generate plain-English narrative of WO history for regulator audit, with citations to evidence. | Per audit request |
| 9 | **Inventory anomaly detection (specific to aviation)** | Unusual consumption rate of a part across aircraft → potential systemic issue or theft. | Nightly batch |

All routed through `packages/llm-client` → `core.llm_usage`. AMRO's regulatory environment means **AI outputs are advisory, never binding** — every recommendation requires human sign-off; the audit trail records both the AI suggestion and the human decision.

---

## 8. Migration sequence

AMRO is the **largest migration**, but also the **best-prepared** — own service, own dir, own tests already.

| Phase | What | Risk |
|---|---|---|
| 0 | Wait for `core.parties`, `core.files`, `core.audit_log`, `core.outbox`, `uim.inventory.*`. | — |
| 1 | Create `amro.*` schema. Backfill aircraft/operators/owners from `public.amro_aircraft*`. **Drop `public.aircraft_legacy_backup`**. | Low — additive + one drop. |
| 2 | Migrate `mro_audit.*` rows → `core.audit_log` with subject_type='amro.*'. Drop `mro_audit.*` schema. | Medium — high write volume. |
| 3 | Migrate `flypal.*` → `amro.vendor_*`. Drop `flypal.*` schema. | Low. |
| 4 | Move `amro_compliance_documents` blobs → `core.files`; replace with link table. | Medium. |
| 5 | Migrate WO + MPD + directive tables in dependency order. | Medium — large data, mature service. |
| 6 | Migrate tooling + calibration + AOG tables. | Low. |
| 7 | Resolve AMRO ↔ UIM inventory boundary (UIM §9.4): create `amro.part_profiles` + extension tables; migrate from 12+ AMRO inventory tables to ~5. | High — touches parts subsystem; coordinate with AMRO domain owner. |
| 8 | Add `core.outbox` poller to `services/amro-api/`. Start publishing the §5 events. | Medium — first cross-module publisher beyond CRM-api. |
| 9 | Refactor `useAmroWorkspaceState.ts` (3,099 LOC) into slice hooks per §6.2A. | Medium — touches workspace state. |
| 10 | Refactor `AmroOwnedWorkspace.tsx` (4,324) into zones per §6.2B. | Medium. |
| 11 | Refactor `AmroSettingsMasterDataPage.tsx` (10,581) per §6.1 — the biggest single refactor in the project. Routes already exist; collapse single-page to per-route pages. | High — the largest god-component split. Recommend phased: one master-data domain per PR. |
| 12 | Refactor other 6 god components per §6.4. | Medium — incremental. |
| 13 | Move `AmroDesignSystemShowcase.tsx` out of module. | Low. |
| 14 | Migrate route registration from App.tsx to `module-amro/manifest.ts`. | Low. |
| 15 | Ship LLM features in §7 ranked order — #1 directive applicability + #5 AOG triage + #6 compliance doc OCR first. | Medium — regulatory implications; human-in-loop mandatory. |
| 16 | Drop `public.amro_*` (52 tables) after 30-day no-direct-read window. | Low — read paths cut over. |

---

## 9. Open decisions

1. **AMRO ↔ UIM inventory boundary** (cross-ref UIM §9.4) — **Recommend**: UIM owns `inventory_items` / `inventory_ledger` / `inventory_locations` as the **primary store**; AMRO has `part_profiles` + `inventory_extensions` for aviation-specific metadata (life-limited, ATA chapter, calibration intervals). Consumption of parts publishes `amro.work_order.parts_consumed` → UIM ledger movement. **Decision deadline**: needs AMRO domain owner sign-off in Phase 7.
2. **AMRO compliance vs platform compliance** — **Confirmed in master §2.6**: aviation airworthiness stays in `amro.*` (different regulatory domain). Combined view at `/dashboard/compliance` aggregates via two-query (Compliance subdoc §9.4).
3. **`mro_audit.*` schema** — **Recommend drop**, fold into `core.audit_log`. AMRO-specific filtered views provide ergonomics. AMRO's audit needs (long retention, regulatory format) handled via `core.audit_log.retention_class` field.
4. **`flypal.*` schema** — **Recommend drop**, fold into `amro.vendor_*`. Flypal is one vendor; doesn't deserve top-level schema. (Reflected in §3.7.)
5. **`AmroDesignSystemShowcase.tsx`** — keep in repo for design reference, move out of `module-amro/` (it's not AMRO-specific). **Recommend** `src/components/dev/`.
6. **`services/amro-api/` reorg under contract** — already has `events/`, `services/`, `routes/`. Add `acl/` and `outbox/` dirs to formalize §2.4–§2.5 patterns. Other modules' services adopt this layout.
7. **LLM regulatory guardrails** — every AI output must be advisory; every human decision logged in `core.audit_log`. **Recommend** a wrapper `amro.requires_human_signoff(decision_ai_id, decision_human_id, signoff_user_id)` table to track AI-suggestion → human-decision linkage explicitly.
8. **Aircraft operator vs owner relationships** — today two tables (`aircraft_operators`, `aircraft_owners`). **Recommend** consolidate to `amro.aircraft_party_roles` (subject_id=aircraft_id, party_id, role text /* 'operator','owner','lessor','msop' */, validity dates). More flexible.

---

## 10. Acceptance criteria

Done when:

- [ ] `amro` schema exists; all 52 `public.amro_*` tables migrated.
- [ ] `flypal.*` and `mro_audit.*` schemas dropped; data folded into `amro.vendor_*` and `core.audit_log` respectively.
- [ ] `public.aircraft_legacy_backup` dropped.
- [ ] `amro_compliance_documents` blobs in `core.files`; link table in `amro.*`.
- [ ] AMRO ↔ UIM inventory boundary implemented per §9.1 decision.
- [ ] `services/amro-api/` has `events/`, `acl/`, `outbox/` dirs; outbox poller running; §5 events publish.
- [ ] `useAmroWorkspaceState.ts` split into slice hooks; no file > 500 LOC.
- [ ] `AmroOwnedWorkspace.tsx` split into zones; no file > 500 LOC.
- [ ] **`AmroSettingsMasterDataPage.tsx` split into per-route pages**; no file > 800 LOC. **The big one.**
- [ ] All other >1,000 LOC AMRO components split per §6.4.
- [ ] `AmroDesignSystemShowcase.tsx` moved out of `module-amro/`.
- [ ] At least 3 of §7 LLM features shipped (recommend #1 directive applicability, #5 AOG triage, #6 compliance doc OCR).
- [ ] Manifest-based routing for AMRO; App.tsx no longer hard-codes amro routes.
- [ ] All AMRO AI outputs human-signoff-tracked in `amro.requires_human_signoff` table.
- [ ] RLS tests cover per-role gates for calibration, certificate-release, emergency-WO.

---
