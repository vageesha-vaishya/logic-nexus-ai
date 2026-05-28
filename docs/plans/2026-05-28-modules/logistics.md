# `logistics` — Fulfilment Module

**Date:** 2026-05-28
**Status:** Draft — under review
**Depends on:** `core`, `sales` (opportunity-won trigger), `quotation` (rate data)
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose

`logistics` owns the **fulfilment lifecycle** — everything that happens after a deal is won. Bookings, shipments, legs, milestones, carriers, lanes, customs clearance, vendor portal interactions, rate-shopping infrastructure. The module is **operational** in nature: timestamps, state machines, exception handling, integrations with carrier systems (via UIM).

It is the smallest business module by code size today (~5,439 LOC across 14 components) but the most **time-sensitive** at runtime — milestones fire at unpredictable intervals, exceptions cascade, and ETA accuracy is customer-visible.

---

## 2. Current state (evidence)

### 2.1 Frontend (`src/components/logistics/` + `src/features/module-logistics/`)

| Component | LOC | Purpose |
|---|---|---|
| `CargoDetailsForm.tsx` | 559 | Detailed cargo fields |
| `CarrierForm.tsx` | 475 | Create/edit carrier |
| `ShipmentForm.tsx` | 417 | Shipment header form |
| `CargoForm.tsx` | 408 | Basic cargo form |
| `ServiceVendorsPanel.tsx` | 404 | Vendor selection UI |
| `ShipmentContainerManager.tsx` | 382 | Container assignment |
| `SmartCargoInput.tsx` | 372 | AI-assisted cargo input (free-text → structured) |
| `VendorForm.tsx` | 354 | Vendor (party) editor |
| `PortLocationForm.tsx` | 343 | Port/location master data |
| `ConsigneeForm.tsx` | 346 | Consignee details |
| `LogisticsOwnedWorkspace.tsx` | 263 | Workspace (in `src/features/module-logistics/`) |

**No file > 600 LOC**; clean to refactor. `SmartCargoInput.tsx` already uses an LLM under the hood — confirm during migration.

### 2.2 Routes (today)

| Route | Component |
|---|---|
| `/dashboard/bookings`, `/bookings/new`, `/bookings/:id`, `/bookings/:id/edit`, `/bookings/map` | `Bookings`, `BookingNew`, `BookingDetail`, `BookingEdit`, `QuoteBookingMapper` (App.tsx:1118–1123) |
| `/dashboard/shipments`, `/shipments/new`, `/shipments/:id`, `/shipments/:id/documents/:type`, `/shipments/pipeline` | (App.tsx:1124–1129) — uses `moduleCode="logistics.shipments"` |
| `/dashboard/customs-clearance/pipeline` | `CustomsClearancePipeline` (App.tsx:1127) |
| `/dashboard/carriers` | uses `moduleCode="logistics.carriers"` (App.tsx:1135) |
| `/dashboard/logistics-manager` | `LogisticsManager` — admin-only, role-gated (App.tsx:1144) |

The `moduleCode` prop is a separate access-control mechanism from `requiredDomainCode` used by AMRO/Markets. **Both converge on `core.has_module_access()` in the target state.**

### 2.3 Backend

**No `services/logistics-api/` exists.** All logistics pages read Supabase directly via RLS. Must be built.

### 2.4 Tables (today, mostly in `public.*`)

Sample (full list per §1B.0):

| Table | Purpose | Action |
|---|---|---|
| `public.shipments` | Shipment header | → `logistics.shipments` |
| `public.bookings` | Booking (pre-shipment intent) | → `logistics.bookings` |
| `public.booking_executions` | Booking lifecycle events | → `logistics.booking_executions` |
| `public.booking_agents` | Agent assignments | → `logistics.booking_agents` |
| `public.cargo_details`, `public.cargo_types` | Cargo data | → `logistics.cargo_*` |
| `public.carriers` | Carrier master | → `logistics.carriers` |
| `public.carrier_alliances` | Alliance partnerships | → `logistics.carrier_alliances` |
| `public.carrier_rates`, `public.carrier_rate_charges`, `public.carrier_rate_attachments` | Rate-data | → `logistics.carrier_rates_*` |
| `public.carrier_service_types` | Service taxonomy | → `logistics.carrier_service_types` |
| `public.customs_documents` | Customs paperwork | → `logistics.customs_documents` (blobs to `core.files`) |
| `public.container_sizes`, `public.container_types` | Reference data | → `logistics.container_sizes/types` — **duplicate-named tables flagged in §1B.8(4)**; resolve to single source |
| `public.shipment_attachments` | Shipment files | **Killed** — `core.files` + `core.file_links` |
| `public.vendor_portal_activity` | **Dead** (§1.4) | Drop |
| `public.vendor_preferred_carriers` | Vendor↔carrier prefs | → `logistics.vendor_preferred_carriers` |
| `public.vendor_notifications` | Vendor notifications | **Killed** — `core.notifications` |
| `public.provider_api_configs`, `public.provider_charge_mappings`, `public.provider_rate_rules`, `public.provider_rate_templates`, `public.provider_surcharges` | Rate-shopping infra | → `logistics.providers_*` — see §9 decision on boundary with quotation |

**Logistics-prefixed tables today**: `logistics.quote_items_extension` (token effort, the only one in the schema today). Will be replaced.

---

## 3. Target schema (`logistics.*`)

```sql
-- Shipments (the master entity)
logistics.shipments (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  shipment_number          text NOT NULL,                  -- tenant-scoped sequence
  source_opportunity_ref   uuid,                           -- opaque ref via event from sales (§2)
  source_quote_ref         uuid,                           -- opaque ref via event from quotation
  shipper_party_id         uuid NOT NULL REFERENCES core.parties(id),
  consignee_party_id       uuid NOT NULL REFERENCES core.parties(id),
  notify_party_id          uuid REFERENCES core.parties(id),
  carrier_id               uuid REFERENCES logistics.carriers(id),
  mode                     text NOT NULL,                  -- 'ocean','air','road','rail','multimodal'
  service_type             text,                           -- 'fcl','lcl','express',...
  status                   text NOT NULL,                  -- 'draft','booked','in_transit','exception','delivered','closed'
  origin_port              text,
  destination_port         text,
  etd date, eta date, atd date, ata date,                  -- estimated/actual departure/arrival
  total_weight_kg          numeric, total_volume_cbm numeric, package_count int,
  owner_user_id            uuid REFERENCES core.users(id),
  exception_flag           boolean DEFAULT false,
  exception_reason         text,
  created_at, updated_at
)

-- Legs (multi-leg routing)
logistics.shipment_legs (
  id, tenant_id, shipment_id, leg_index int,
  origin text, destination text, carrier_id, mode, service_type,
  etd date, eta date, atd date, ata date, status text
)

-- Milestones (the timeline)
logistics.shipment_milestones (
  id, tenant_id, shipment_id, leg_id NULL,
  milestone_code           text NOT NULL,                  -- 'pickup','export_customs','loaded','vessel_departed','arrived','discharged','delivered',...
  expected_at              timestamptz,
  occurred_at              timestamptz,
  source                   text,                           -- 'manual','carrier_api','customer_portal','ai_inferred'
  source_external_ref      text,
  recorded_by_user_id      uuid,
  payload                  jsonb,
  created_at
)

-- Bookings (pre-shipment intent)
logistics.bookings (
  id, tenant_id, booking_number text,
  source_quote_ref uuid,
  shipment_id uuid REFERENCES logistics.shipments(id) NULL,  -- linked when shipment is created
  status text,                                                -- 'requested','confirmed','rejected','cancelled'
  requested_pickup_date date, requested_delivery_date date,
  owner_user_id uuid REFERENCES core.users(id),
  created_at, updated_at
)
logistics.booking_items (id, tenant_id, booking_id, sku, description, quantity, weight_kg, volume_cbm)
logistics.booking_executions (id, tenant_id, booking_id, event_type, event_payload jsonb, occurred_at)

-- Carriers + rate data
logistics.carriers (
  id                  uuid PK,
  tenant_id           uuid,                                  -- NULL = global carrier (system-seeded)
  party_id            uuid REFERENCES core.parties(id),      -- carrier is also a core.party (party_type='organization')
  scac                text,                                  -- ocean carrier code
  iata_code           text,                                  -- air
  modes_supported     text[],
  active              boolean DEFAULT true
)
logistics.carrier_alliances (id, name, member_carrier_ids uuid[])
logistics.carrier_service_types (id, carrier_id, service_code, transit_days)
logistics.carrier_rates (
  id, tenant_id, carrier_id, origin, destination, mode, service_type,
  effective_from date, effective_to date,
  base_rate numeric, currency,
  source text                                                 -- 'manual','provider_feed','tariff_upload'
)
logistics.carrier_rate_charges (id, rate_id, charge_code, amount, basis text /* 'flat','per_kg','per_cbm' */)

-- Lanes (origin-destination pairs, not carrier-specific)
logistics.lanes (
  id, tenant_id, origin_region text, destination_region text,
  preferred_mode text, typical_transit_days int
)

-- Rate-shopping provider infra
logistics.providers (id, name, kind text /* 'aggregator','direct','tariff' */, api_config_id)
logistics.provider_api_configs (id, provider_id, base_url, auth_kind, credential_ref uuid REFERENCES core.secrets(id))
logistics.provider_rate_rules (id, provider_id, rule jsonb, priority int)
logistics.provider_rate_templates (id, provider_id, name, template jsonb)
logistics.provider_charge_mappings (id, provider_id, provider_charge_code, canonical_code text)
logistics.provider_surcharges (id, provider_id, code, name, basis text, amount numeric)

-- Customs
logistics.customs_clearance (
  id, tenant_id, shipment_id, direction text /* 'export','import' */,
  status text, broker_party_id uuid REFERENCES core.parties(id),
  filed_at, cleared_at, hold_reason text
)
logistics.customs_documents (
  id, tenant_id, shipment_id, document_type text /* 'commercial_invoice','packing_list','bl','awb','co','msds',... */,
  file_id uuid REFERENCES core.files(id),
  ai_extracted boolean DEFAULT false, ai_confidence numeric
)

-- Containers & reference data
logistics.container_sizes (code text PK, description text)  -- '20GP','40HC','45HC',...
logistics.container_types (code text PK, description text)  -- 'dry','reefer','flatrack','tanker',...
logistics.containers (id, tenant_id, shipment_id, container_number text, size_code, type_code, seal_number)

-- Vendor portal
logistics.vendor_preferred_carriers (id, tenant_id, vendor_party_id, carrier_id, preference_rank int)
logistics.vendor_portal_sessions (id, tenant_id, vendor_party_id, opened_at, closed_at)
-- vendor_portal_activity was dead — replaced by core.audit_log entries with subject_type='logistics.vendor_session'

-- Cargo reference
logistics.cargo_types (code text PK, hazmat boolean, description text)
logistics.cargo_details (id, tenant_id, shipment_id, cargo_type_code, hs_code, description, quantity, weight_kg, volume_cbm)
```

---

## 4. RLS strategy

Three-layer per §2.3, plus:

```sql
CREATE POLICY view_shipments ON logistics.shipments FOR SELECT USING (
  tenant_id = auth.jwt_tenant_id()
  AND core.has_module_access(tenant_id, 'logistics', 'read')
  AND (
    owner_user_id = auth.uid()
    OR auth.has_role(tenant_id, 'logistics_ops')
    OR auth.has_role(tenant_id, 'logistics_manager')
    OR shipper_party_id IN (SELECT party_id FROM core.user_parties WHERE user_id = auth.uid())  -- customer portal access
  )
);
```

Vendor-portal access is its own short-lived signed-JWT (same pattern as `/portal/quote/:token` in Quotation §4) — vendors do not get full module access.

---

## 5. Events

### Published

| Event | When |
|---|---|
| `logistics.booking.created` / `.confirmed` / `.cancelled` | Booking lifecycle |
| `logistics.shipment.created` | New shipment (often from `sales.opportunity.won` ACL) |
| `logistics.shipment.status_changed` | Status transitions |
| `logistics.shipment.milestone_recorded` | Milestone fires (carrier API update, manual entry, AI inference) |
| `logistics.shipment.exception` | Exception flag set — **high-priority for Comms + CRM** |
| `logistics.shipment.eta_updated` | Material change to ETA |
| `logistics.shipment.delivered` | ata recorded — **key signal for Finance (invoice trigger) + AMRO (parts arrival)** |
| `logistics.customs.held` / `.cleared` | Customs status |
| `logistics.rate.updated` | Rate-shopping result available — Quotation listens |

### Subscribed

| Event | Consumer logic |
|---|---|
| `sales.opportunity.won` | ACL creates a draft `logistics.shipments` row + booking |
| `quotation.quote.accepted` | Same — if no opp, quote directly produces booking+shipment |
| `core.party.merged` | Re-link shipments to merged party |
| `comms.message.received` (channel='carrier_edi') | Parse EDI/API updates into milestones (via UIM) |
| `amro.work_order.parts_required` | If parts shipment, create shipment with hazmat flags appropriately |

ACL location: `services/logistics-api/src/acl/{sales,quotation,comms,amro,core}.ts`.

---

## 6. UI surface

Routes mostly unchanged, code reorganized under `src/features/module-logistics/`:

| Route | Notes |
|---|---|
| `/dashboard/logistics` | (new) Logistics home dashboard — KPIs, exceptions, today's milestones |
| `/dashboard/logistics/shipments` | Was `/dashboard/shipments` — keep redirect for 90 days |
| `/dashboard/logistics/shipments/:id` | Detail with timeline, legs, documents, milestones, exceptions |
| `/dashboard/logistics/shipments/:id/documents/:type` | Document viewer — wires through `core.files` |
| `/dashboard/logistics/bookings` | Was `/dashboard/bookings` |
| `/dashboard/logistics/customs` | Was `/dashboard/customs-clearance/pipeline` |
| `/dashboard/logistics/carriers` | Was `/dashboard/carriers` |
| `/dashboard/logistics/rate-shopping` | (new) Provider rate-shopping UI (today implicit in quote composer) |
| `/dashboard/logistics/settings/lanes` | (new) Lane master data |
| `/dashboard/logistics/settings/providers` | (new) Rate-provider configs |
| `/portal/vendor/:token` | (new) Public vendor portal — signed-JWT pattern |
| `/dashboard/logistics-manager` | Was top-level admin — moves into module |

**Component organization:**
- Components move to `src/features/module-logistics/components/` (none need splitting — all under 600 LOC).
- `SmartCargoInput.tsx` (the AI-assisted input) becomes the canonical example of consuming `packages/llm-client` in this module.

---

## 7. LLM hooks (specific to Logistics)

| Rank | Feature | Mechanism | Cost notes |
|---|---|---|---|
| 1 | **Cargo description → structured fields** | Already exists as `SmartCargoInput.tsx`. Formalise via `packages/llm-client` action `extract_cargo_structure`. | Per shipment-create; ~$0.001 |
| 2 | **Customs document extraction** | OCR + LLM extract BL/AWB/commercial-invoice fields into `customs_documents.payload`. Sets `ai_extracted=true`, `ai_confidence` for downstream review queue. | Per doc; ~$0.005 with OCR |
| 3 | **Milestone inference from carrier emails/EDI** | Inbound carrier emails (via Comms) → milestone records. Replaces manual data entry for ~70% of events. | Per inbound; ~$0.001 |
| 4 | **ETA refinement** | Combine carrier-reported ETA with historical lane performance + current weather/port-congestion data → refined ETA with confidence interval. | Daily batch; ~$0.01 per active shipment |
| 5 | **Exception summarisation** | When `exception_flag=true`, LLM writes a customer-facing summary explaining what went wrong and next steps — used by Comms for outbound notifications. | Per exception |
| 6 | **HS code classification** | Cargo description → suggested HS code (top 3 with confidence). Helps customs document prep. | Per cargo line |
| 7 | **Provider rate normalisation** | Provider feeds often have different charge taxonomies. LLM maps unknown codes to canonical codes (writes to `provider_charge_mappings`). | One-shot per new code, cached |
| 8 | **Shipment-document QA** | Cross-check BL details against shipment record; flag discrepancies. | Per doc upload |

All routed through `packages/llm-client` → `core.llm_usage`.

---

## 8. Migration sequence

| Phase | What | Risk |
|---|---|---|
| 0 | Wait for `core.parties` + `core.files` + `core.audit_log`. | — |
| 1 | Create `logistics.*` schema + all tables. RLS + helpers. | Zero — additive. |
| 2 | Backfill `logistics.carriers` from `public.carriers` linking each to a `core.parties` row (party_type='organization', sub-role='carrier'). | Medium — needs party promotion. |
| 3 | Backfill `logistics.shipments` from `public.shipments`. Map `shipper_id` → `shipper_party_id` via parties lookup. | Medium — high-value data. |
| 4 | Backfill `logistics.bookings`, `booking_items`, `booking_executions`. | Low. |
| 5 | Migrate `customs_documents`: file blobs → `core.files`, joins → `core.file_links` + `logistics.customs_documents`. | Medium — large data move. |
| 6 | Backfill `logistics.provider_*` from `public.provider_*`. Migrate api_credentials to `core.secrets`. | Medium — touches credential storage. |
| 7 | Drop `public.vendor_portal_activity` (dead); migrate live vendor data. | Low. |
| 8 | Resolve `container_sizes` + `container_types` duplicate-table issue: pick one source, backfill, drop the other. | Low — small reference data. |
| 9 | Build `services/logistics-api/` from scratch with routes for shipments, bookings, carriers, customs, providers, rate-shopping, milestones, exceptions. Outbox poller. | High — net-new service, lots of routes. |
| 10 | Cut frontend reads from direct Supabase to `services/logistics-api/`. | Medium — touches every page. |
| 11 | Reorganise `src/components/logistics/` + `src/features/module-logistics/` → `src/features/module-logistics/components/`. | Low — refactor. |
| 12 | Build the public `/portal/vendor/:token` signed-JWT bridge. | Medium — security-critical. |
| 13 | Ship LLM features in ranked order — start with #1 (formalise existing) and #2 (customs doc extraction). | Low — additive. |

---

## 9. Open decisions

1. **`logistics.providers_*` vs `quotation.*` boundary** — rate-shopping output feeds quotation but is operational data. **Recommend keep in `logistics.*`** (it's a fulfilment ops concern). Quotation consumes via ACL listening to `logistics.rate.updated` events, caches in `quotation.ai_cache` for repeated quote-builds.
2. **Carrier as party** — every carrier gets a `core.parties` row (party_type='organization'). Pro: unified vendor management; Con: more rows. **Recommend yes** — supports merge/dedup, contact tracking, communications.
3. **Vendor concept** — "vendor" is overloaded (carrier vendor, service vendor, supplier). **Recommend three sub-roles** under `core.parties.party_type='organization'`: `'carrier'`, `'service_vendor'`, `'supplier'` — captured in a tag-like field `logistics.party_logistics_role` extension table.
4. **Container reference data: tenant or global?** — `container_sizes` like '20GP' is industry-standard. **Recommend global** (tenant_id NULL). Tenants can extend with custom codes.
5. **Milestone code taxonomy** — Today implicit. Need a canonical list (~25 codes). **Recommend seed `logistics.milestone_codes` lookup table** with industry-standard codes (loaded, customs_filed, vessel_departed, ata_pod, delivered_consignee, etc.).
6. **Booking ↔ Shipment lifecycle** — 1:1 or 1:N? Some logistics ops model multiple shipments per booking. **Recommend 1:N** (one booking can span multiple shipments) — flexible without complexity cost.
7. **EDI handling** — Carrier integrations (EDI 315 status messages etc.) go through UIM, surfaced as `comms.message.received(channel='carrier_edi')`. Logistics ACL parses into milestones.

---

## 10. Acceptance criteria

Done when:

- [ ] `logistics` schema exists with the ~20 tables from §3.
- [ ] `services/logistics-api/` exists, hosts all listed routes, has tests + RLS denial tests.
- [ ] All public.* logistics tables dropped (after 30-day no-direct-read window).
- [ ] Carriers exist as both `core.parties` and `logistics.carriers` rows; party-merge correctly cascades.
- [ ] `/portal/vendor/:token` works via the signed-JWT bridge.
- [ ] Shipment-document upload writes to `core.files` + `core.file_links`.
- [ ] Milestone events publish to outbox; `logistics.shipment.delivered` triggers Finance invoice creation in test scenarios.
- [ ] At least 3 of §7 LLM features shipped (recommend #1, #2, #3).
- [ ] Container-sizes duplicate-table issue resolved; single source confirmed.
- [ ] CI lint forbids `from '@/components/logistics/'` imports — must be `from '@/features/module-logistics/components/'`.

---
