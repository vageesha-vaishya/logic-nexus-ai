# `uim` — Universal Inventory Master + Integration Spine

**Date:** 2026-05-28
**Status:** Draft — under review
**Depends on:** `core` (secrets, parties, files, outbox, audit)
**Closely related:** `amro` (today's primary consumer of `uim.inventory.*`), every module (uses `uim.integration.*` for outbound sync)
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose & the naming-truth disclosure

The acronym **UIM stood for "Universal Integration Module"** when first scaffolded (per `CLAUDE.md`). But the actual implementation has grown into **two distinct concerns**:

1. **Universal Inventory Master (UIM.inventory)** — a shared, mode-agnostic inventory layer: item-master, stock-ledger, locations, reservations, suppliers, valuation methods. Today consumed primarily by AMRO (parts) but designed to be domain-neutral.
2. **Integration spine (UIM.integration)** — connector configurations, webhook subscriptions, sync jobs, dead-letter queue, mapping tables. The outbound bus from the platform to external systems.

This subdoc treats `uim` as **one schema with two sub-namespaces** (`uim.inventory.*` and `uim.integration.*`). They share the `services/uim-api/` shell and the same module access gate, but their tables, events, and operational concerns are kept clearly separated. Splitting into two modules is an **open decision** (§9.1).

---

## 2. Current state (evidence)

### 2.1 Backend (the gap noted in §1B.7)

`services/uim-api/src/` has only `app.ts` + `index.ts` — **no routes, no services, no events**. Despite this, **15+ `uim_*` tables exist** with active data, and the platform operates UIM logic entirely through Supabase + ingestion code in AMRO.

### 2.2 Frontend

| Path | Notes |
|---|---|
| `src/modules/uim/` | Non-feature-dir code: `integration/uimAmroMapper.ts` (+ test), `seeding/uimMroSeedService.ts` (+ test) |
| `src/services/uim/` | `uimApi.ts`, `uimCoreServices.ts`, `uimAnalyticsService.ts`, `uimFormAdapters.ts`, `uimApi.test.ts` |
| `src/pages/api/v2/uim/` | **GraphQL subgraph** — `uim-subgraph.graphql.ts` + `uim-subgraph.contract.test.ts`. Architectural pattern unique to UIM. |

**Architectural anomaly**: UIM is the only module exposing a GraphQL surface (subgraph for Apollo Federation, presumably). Every other module uses REST. Decision deferred to §9.

### 2.3 Routes

Eight `/dashboard/uim/*` routes (App.tsx:1261–1268), all gated by `requiredPermissions={["dashboards.view"]}` (**weak gate** — should be `uim:read`):

- `/dashboard/uim`, `/uim/item-master`, `/uim/stock-ledger`, `/uim/reservations`, `/uim/issue-consume`, `/uim/restock`, `/uim/locations`, `/uim/analytics`

All point to a single `UimShell` component — internal sub-routing presumably.

### 2.4 Tables (today)

**Inventory side** (in `public.*`):

| Table | Role |
|---|---|
| `uim_inventory_items` | Item master |
| `uim_inventory_categories` | Category taxonomy |
| `uim_inventory_locations` | Stock locations |
| `uim_inventory_ledger` | Movement log (immutable) |
| `uim_inventory_commands` | Command-pattern intents (write side) |
| `uim_inventory_reservations` | Soft-holds for outgoing work |
| `uim_inventory_suppliers` | Supplier directory |
| `uim_inventory_projection_snapshots` | CQRS read-model snapshots |
| `uim_inventory_valuation_methods` | FIFO/LIFO/avg per category |
| `uim_catalog_items` | Catalog (item presentation layer) |
| `uim_form_records` | Form-based input records (for hand-entry flows) |
| `uim_mro_item_profiles` | AMRO-specific profile metadata on items |

**Integration side** (mostly `platform.*`, some `public.*`):

| Table | Role |
|---|---|
| `platform.integration_credentials` | Encrypted connector credentials |
| `platform.integration_log` | Sync run logs |
| `platform.integration_dlq` | Dead-letter queue |
| `platform.webhook_subscriptions` | Inbound webhook configs |
| `public.integration_jobs` | Legacy — duplicate of `integration_log`? |
| `public.integration_mappings` | Field-mapping tables |
| `public.webhook_outbox` | Outbound webhook queue |
| `public.sync_conflicts` | Two-way sync conflict records |
| `public.uim_amro_sync_jobs` | AMRO sync-specific job records |
| `public.uim_amro_sync_audit` | AMRO sync audit trail |
| `public.amro_uim_inventory_sync_events` | AMRO ↔ UIM event log |
| `public.payment_webhook_events` | Razorpay/Stripe webhook receipts — **also referenced by finance** |
| `public.email_sync_logs` | Email sync runs — **also referenced by comms** |

**Result**: ~13 tables in `uim.inventory.*`, ~10 in `uim.integration.*`. Total ~23. Plus 2 tables shared with other modules (payment_webhook_events stays in finance; email_sync_logs moves to comms).

---

## 3. Target schema (`uim.*`)

### 3.1 `uim.inventory.*` sub-namespace

```sql
uim.inventory_items (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  sku                      text NOT NULL,
  category_id              uuid REFERENCES uim.inventory_categories(id),
  description              text,
  uom                      text,
  valuation_method_id      uuid REFERENCES uim.inventory_valuation_methods(id),
  hazmat                   boolean DEFAULT false,
  hs_code                  text,
  external_refs            jsonb,                                    -- {sap_id, oracle_id, ...}
  is_active                boolean DEFAULT true,
  created_at, updated_at,
  UNIQUE (tenant_id, sku)
)

uim.inventory_categories (id, tenant_id, name, parent_id, path text)
uim.inventory_locations (id, tenant_id, code, name, kind text /* 'warehouse','aisle','bin','virtual' */, parent_id)
uim.inventory_suppliers (id, tenant_id, party_id REFERENCES core.parties(id), supplier_code text, lead_time_days int)

uim.inventory_ledger (
  id                       bigserial,
  tenant_id                uuid NOT NULL,
  item_id                  uuid REFERENCES uim.inventory_items(id),
  location_id              uuid REFERENCES uim.inventory_locations(id),
  movement_kind            text NOT NULL,                            -- 'receipt','issue','transfer_in','transfer_out','adjustment','reservation','release'
  quantity                 numeric NOT NULL,                          -- signed
  unit_cost                numeric,
  reference_kind           text,                                      -- 'amro.work_order','logistics.shipment',...
  reference_id             uuid,
  occurred_at              timestamptz NOT NULL,
  posted_by_user_id        uuid REFERENCES core.users(id),
  PRIMARY KEY (tenant_id, occurred_at, id)
) PARTITION BY RANGE (occurred_at);          -- monthly partitions; ledger is append-only

uim.inventory_reservations (
  id, tenant_id, item_id, location_id, quantity numeric,
  reference_kind text, reference_id uuid,
  reserved_at, expires_at, status text /* 'active','released','consumed','expired' */
)

uim.inventory_projection_snapshots (
  -- CQRS read-side projection: current on-hand per (item, location)
  id, tenant_id, item_id, location_id,
  on_hand numeric, reserved numeric, available numeric,
  last_movement_at timestamptz, snapshot_at timestamptz
)

uim.inventory_valuation_methods (id, tenant_id, code, kind text /* 'fifo','lifo','avg','standard' */)
uim.inventory_commands (id, tenant_id, command_kind text, payload jsonb, status text, created_at, completed_at)
uim.catalog_items (id, tenant_id, item_id, display_name, image_file_id REFERENCES core.files(id), price_listed numeric)
uim.form_records (id, tenant_id, form_kind text, payload jsonb, submitted_by, submitted_at)
uim.mro_item_profiles (item_id PK REFERENCES uim.inventory_items(id), ata_code text, life_limited boolean, shelf_life_days int)
```

### 3.2 `uim.integration.*` sub-namespace

```sql
uim.integration_connectors (
  id, tenant_id, name, kind text /* 'sap','oracle','quickbooks','xero','custom_webhook' */,
  config jsonb,
  credential_ref uuid REFERENCES core.secrets(id),
  is_active boolean, last_synced_at timestamptz
)

uim.integration_credentials_deprecated_view  -- thin view over core.secrets, for backward compat during migration

uim.integration_log (
  id bigserial, tenant_id, connector_id,
  direction text /* 'inbound','outbound' */,
  operation text, request_payload jsonb, response_payload jsonb,
  status text, duration_ms int, error_text text,
  started_at, completed_at,
  PRIMARY KEY (tenant_id, started_at, id)
) PARTITION BY RANGE (started_at);

uim.integration_dlq (
  id, tenant_id, connector_id, original_event jsonb,
  failure_reason text, retry_count int, next_retry_at,
  resolved_at, resolved_by_user_id
)

uim.webhook_subscriptions (
  id, tenant_id, connector_id, url text, secret text,
  event_filter text[],                                    -- ['logistics.shipment.delivered',…]
  is_active, created_at
)

uim.webhook_outbox (
  id bigserial, tenant_id, subscription_id, event_payload jsonb,
  scheduled_for timestamptz, status text, attempts int, last_attempt_at, sent_at, error_text
)

uim.integration_mappings (
  id, tenant_id, connector_id,
  internal_path text, external_path text,                 -- 'core.parties.legal_name' ↔ 'BusinessPartner.Name'
  transform_dsl text NULL                                 -- optional DSL for type/format conversion
)

uim.sync_jobs (
  id, tenant_id, connector_id, sync_kind text,
  scheduled_for, started_at, completed_at, status text,
  records_processed int, errors_count int
)

uim.sync_conflicts (
  id, tenant_id, sync_job_id, internal_subject_type, internal_subject_id,
  external_record jsonb, conflict_kind text, resolution text, resolved_at
)
```

### 3.3 What does NOT move to `uim.*`

- **`payment_webhook_events`** — stays `finance.payment_webhook_events`. Finance owns the gateway; UIM is for *general* external integrations.
- **`email_sync_logs`** — moves to `comms.sync_runs` (per Comms subdoc §2.4).
- **`integration_jobs` (legacy)** — confirmed duplicate of `integration_log`; **killed** during migration.

---

## 4. RLS strategy

```sql
-- Inventory is operational; broad-read for module users, role-gated for write
CREATE POLICY view_inventory_items ON uim.inventory_items FOR SELECT USING (
  tenant_id = auth.jwt_tenant_id() AND core.has_module_access(tenant_id, 'uim', 'read')
);

-- Integration credentials never readable from frontend — server-only via core.secrets
ALTER TABLE uim.integration_connectors FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_only ON uim.integration_connectors FOR ALL USING (
  tenant_id = auth.jwt_tenant_id() AND auth.has_role(tenant_id, 'tenant_admin')
);

-- DLQ + sync_conflicts: integration_admin role
```

**Route guards must tighten**: today's `requiredPermissions={["dashboards.view"]}` (App.tsx:1261–1268) is a generic read gate. Replace with `core.has_module_access(tenant_id, 'uim', 'read')` via the standard `requiredDomainCode`/`moduleCode` mechanism.

---

## 5. Events

### Published

| Event | When |
|---|---|
| **Inventory side** | |
| `uim.item.created` / `.updated` / `.deactivated` | Item-master lifecycle |
| `uim.stock.movement_recorded` | Ledger entry posted |
| `uim.stock.reservation_made` / `.released` / `.consumed` | Reservation lifecycle |
| `uim.stock.low_inventory` | On-hand crosses reorder threshold |
| `uim.stock.snapshot_taken` | Projection snapshot regenerated |
| **Integration side** | |
| `uim.sync.started` / `.completed` / `.failed` | Sync job lifecycle |
| `uim.sync.conflict_detected` | Conflict-resolution required |
| `uim.webhook.delivered` / `.failed` | Outbound webhook attempts |
| `uim.dlq.message_added` | Item entered dead-letter queue |
| `uim.connector.health_degraded` | Connector failing |

### Subscribed

UIM is the **most-subscribed module** along with Comms — every state change in every module can become an outbound integration message.

| Event | Action |
|---|---|
| **All `<module>.<entity>.<event>` topics** the tenant has configured webhook subscriptions for | Write to `uim.webhook_outbox`, dispatch |
| `amro.work_order.parts_required` | Reserve parts in `uim.inventory_reservations` |
| `amro.work_order.parts_consumed` | Issue movement in `uim.inventory_ledger` |
| `logistics.shipment.delivered` (parts shipment) | Receipt movement in `uim.inventory_ledger` |
| `finance.payment.received` (purchase-order linked) | Trigger PO close + supplier-ledger update |
| `core.party.created` (party_type=organization, role=supplier) | Optionally create `uim.inventory_suppliers` row |

ACL location: `services/uim-api/src/acl/` — most ACL files of any module along with Comms.

---

## 6. UI surface

Routes consolidate under `/dashboard/uim/*` (already exist; need stronger gates):

| Route | Notes |
|---|---|
| `/dashboard/uim` | UIM home — inventory KPIs + integration health |
| `/dashboard/uim/item-master` | Item-master browser |
| `/dashboard/uim/stock-ledger` | Ledger view, filters by item/location/period |
| `/dashboard/uim/reservations` | Active reservations |
| `/dashboard/uim/issue-consume` | Manual issue/consume |
| `/dashboard/uim/restock` | Reorder queue |
| `/dashboard/uim/locations` | Location admin |
| `/dashboard/uim/analytics` | Inventory analytics |
| `/dashboard/uim/integrations` | (new) Connector configuration |
| `/dashboard/uim/integrations/:id/log` | (new) Run log + DLQ |
| `/dashboard/uim/integrations/:id/mappings` | (new) Field-mapping editor |
| `/dashboard/uim/conflicts` | (new) Conflict-resolution queue |
| `/dashboard/uim/webhooks` | (new) Webhook subscriptions |

**No god components in `UimShell.tsx`** apparent from audit, but verify during migration. UIM frontend code is light compared to AMRO.

---

## 7. LLM hooks (specific to UIM)

| Rank | Feature | Mechanism | Cost notes |
|---|---|---|---|
| 1 | **Field-mapping suggestion** | When configuring a new connector, LLM examines sample payloads from external system + UIM schema → suggests mappings. Reduces hours-of-config to minutes. | Per connector setup; ~$0.10 |
| 2 | **Conflict resolution recommendation** | For each `sync_conflicts` row, LLM evaluates which side to trust + writes a one-line justification. Human approves. | Per conflict; ~$0.003 |
| 3 | **DLQ triage** | LLM classifies DLQ messages by failure cause + suggests fix (retry / skip / data-correction). | Per DLQ batch |
| 4 | **Item-master deduplication** | When importing supplier catalogs, LLM matches new items to existing UIM items via embeddings + name. | Per import |
| 5 | **Inventory anomaly detection** | Ledger pattern analysis — unusual issue rates, theft patterns, valuation drift. | Nightly batch |
| 6 | **Reorder forecast** | Combines consumption history + supplier lead times + AMRO work-order pipeline → recommended reorder timing. | Daily batch |
| 7 | **External-system schema normalisation** | When polling an external system, LLM normalises field names against canonical UIM vocabulary. | Per inbound batch |

All routed through `packages/llm-client` → `core.llm_usage`.

---

## 8. Migration sequence

| Phase | What | Risk |
|---|---|---|
| 0 | Wait for `core.secrets`, `core.parties`, `core.files`, `core.outbox`. | — |
| 1 | Create `uim.*` schema. Partitioned `uim.inventory_ledger` + `uim.integration_log` (monthly partitions). | Zero — additive. |
| 2 | Flesh out `services/uim-api/`. Move logic from `src/modules/uim/`, `src/services/uim/`, `src/pages/api/v2/uim/`. | High — biggest greenfield service in scope. |
| 3 | Backfill `uim.inventory_*` from `public.uim_inventory_*`. AMRO consumers cut over via ACL. | Medium — touches AMRO's parts subsystem. |
| 4 | Lift `platform.integration_credentials` to `core.secrets`. Lift `platform.integration_log`, `platform.integration_dlq`, `platform.webhook_subscriptions` into `uim.integration.*`. | Medium — lifts from platform.* to uim.*. |
| 5 | Migrate `public.integration_jobs` rows to `uim.integration_log`. Kill duplicate. | Low. |
| 6 | Migrate `public.webhook_outbox` → `uim.webhook_outbox`. | Low. |
| 7 | Migrate `public.uim_amro_sync_*` and `public.amro_uim_inventory_sync_events` → `uim.integration_log` (with kind='amro_sync'). | Medium. |
| 8 | Build connector-config UI + webhook-config UI. | Medium — net-new. |
| 9 | Implement event subscriptions per §5 — each module's outbox events route through UIM webhook fan-out. | Medium — first real platform-wide integration. |
| 10 | Tighten route guards from `dashboards.view` → `uim:read`. | Low. |
| 11 | Resolve GraphQL-subgraph decision (§9.2). | Medium. |
| 12 | Ship LLM features #1, #2, #3. | Low. |
| 13 | Drop `platform.integration_*`, `public.integration_*`, `public.uim_*` after 30-day window. **Drop `platform.*` schema entirely** (per master §2.8). | Low — read paths cut over. |

---

## 9. Open decisions

1. **Split `uim` into two modules** (`inventory` + `integration`) — Yes or no?
   - **Recommend NO for v1**: they share the `uim-api` service shell, both have weak frontend surfaces today, and splitting doubles ACL/route configuration. Keep as one schema with two sub-namespaces. Re-evaluate at 12 months if either side outgrows.
2. **GraphQL subgraph for UIM** — Keep, expand to other modules, or drop?
   - **Recommend keep but isolate**: GraphQL is well-suited to inventory's read-heavy aggregations (current on-hand across locations, ledger queries). Don't propagate to other modules — they stay REST/event. UIM-api hosts both REST routes (for mutations) and the GraphQL subgraph (for read aggregations).
3. **CQRS for inventory** — `uim_inventory_projection_snapshots` suggests CQRS read-model. Keep + formalise?
   - **Recommend yes**: ledger is the source of truth (append-only, partitioned); projection snapshots are read-models recomputed on schedule. The `commands/events/projections` triad in inventory is a strong pattern; document and don't break.
4. **AMRO inventory tables vs UIM inventory** — AMRO has `amro_item_master`, `amro_inventory_scan_events`, `amro_stock_ledger_transactions`, `amro_stock_*`, `amro_inventory_*` (12+ tables). Are these the same concept duplicated, or AMRO-specific layers atop UIM?
   - **Open**: needs a session with AMRO + UIM domain owners. **Tentative recommendation**: AMRO uses `uim.inventory_*` as primary store; AMRO's own `amro_inventory_*` becomes a thin **AMRO-specific extension** layer (life-limited parts, calibration intervals, aviation regulatory metadata) keyed by `item_id`. The 12+ AMRO inventory tables consolidate to ~3 extension tables.
5. **Inbound vs outbound integrations** — Connectors today seem to mix. **Recommend explicit `connector.direction` enum** (`'inbound','outbound','bidirectional'`) on every connector config.
6. **Razorpay webhook** — `payment_webhook_events` stays in finance. **Recommend `uim.integration_connectors` records the Razorpay connector**, but finance owns the events table because invoice allocation is a finance concern. UIM acts as the inbound webhook receiver only.
7. **Schedule UIM as last in migration sequence** — given it touches AMRO heavily and is hollow today, build it after AMRO conformance is stable. Reflected in master §7 migration plan.

---

## 10. Acceptance criteria

Done when:

- [ ] `uim` schema exists with ~23 tables across `inventory.*` and `integration.*` sub-namespaces.
- [ ] `services/uim-api/` is real — REST routes for mutations, GraphQL subgraph for read aggregations, outbox poller, webhook dispatcher, DLQ processor.
- [ ] Partitioned tables (`inventory_ledger`, `integration_log`) created with monthly partition automation.
- [ ] All `platform.integration_*` tables dropped; `platform.*` schema empty and dropped.
- [ ] All `public.uim_*`, `public.integration_*`, `public.webhook_outbox`, `public.sync_conflicts` dropped.
- [ ] AMRO consumers cut over from `public.uim_inventory_*` reads to `uim.inventory.*` via ACL.
- [ ] Route guards tightened from `dashboards.view` to `uim:read`.
- [ ] First external connector wired end-to-end (e.g., SAP business-partner sync) — outbound + inbound + DLQ + conflict-resolution verified.
- [ ] At least 3 of §7 LLM features shipped (recommend #1 field-mapping, #2 conflict-resolution, #3 DLQ-triage).
- [ ] AMRO ↔ UIM inventory boundary decision (§9.4) made and reflected in AMRO subdoc.

---
