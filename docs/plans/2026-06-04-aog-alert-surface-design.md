# AOG Alert Surface — Design

**Date:** 2026-06-04
**Status:** Design — not yet implemented
**Owner:** AMRO module
**Related:** `amro.aog.triage` LLM feature (commit ad6cb541), `AogTriagePanel` FE (commit f469204c)
**Replaces:** Today's `AmroEmergencyQuickAccessPanel` is a partial surface — this design supersedes it.

## Problem statement

The `amro.aog.triage` LLM feature was shipped earlier today end-to-end (prompt + schema + fixtures + Edge Function + seed migration + frontend hook + panel). It needs an `AogTriageInput` shaped:

```
alert: { alert_id, reported_at, airport_iata, defect_summary, ata_chapter_code, severity_signal, related_warnings, mel_eligible }
aircraft: { manufacturer, model, serial_number, registration, hours_since_new, cycles_since_new, current_mel_deferrals }
fleet_context: { same_type_aircraft_nearby, tools_at_airport, parts_at_airport, station_capability, sla_recovery_hours }
```

No existing surface carries this shape:
- `AmroEmergencyQuickAccessPanel` has an `emergency_type='aog'` flag on emergency work orders, but no `airport_iata`, no `related_warnings` array, no `mel_eligible` boolean.
- `AmroWorkOrderDetailPage` only knows about the aircraft *after* a work order exists; AOG events precede the work order.
- The aircraft fleet is in `core.aircraft`, but no nearby-airport / parts-at-airport aggregation exists.

We need a dedicated AOG alert workflow: declare → triage (via LLM) → assign → resolve.

## Goals

1. Operations controllers can declare an AOG event in under 30 seconds (airport + reg + defect summary minimum).
2. Within 60 seconds of declaration, the controller sees an LLM-generated triage plan (priority, recommended actions, parts to preorder, escalation chain).
3. Triage output is persisted alongside the alert for audit.
4. Alerts feed a list view for the duty maintenance lead.
5. Alert resolution generates the work order that the existing AMRO machinery picks up — alerts don't replace WOs, they precede them.

## Non-goals

- Replacing `AmroEmergencyQuickAccessPanel` entirely. That panel stays for the broader emergency taxonomy (bird strikes, ramp damage, weather diversions). AOG specifically gets a dedicated surface.
- Real-time fleet position tracking. The "nearby aircraft" query is best-effort from last-known position, not live AIS/ADS-B feed.
- Auto-triggering work orders from triage. The triage suggests; the controller still clicks "Convert to work order".

## Data model

### `amro.aog_alerts` (new)

```sql
CREATE TABLE amro.aog_alerts (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL,
  franchise_id                uuid,
  alert_number                text NOT NULL,  -- AOG-2026-0604-001 sequence per tenant
  -- Aircraft
  aircraft_id                 uuid REFERENCES core.aircraft(id),
  aircraft_registration       text,  -- denormalised for fast filter
  -- Location
  airport_iata                text NOT NULL CHECK (airport_iata ~ '^[A-Z]{3}$'),
  airport_local_time          timestamptz,
  -- Defect
  reported_at                 timestamptz NOT NULL DEFAULT now(),
  reporter_user_id            uuid REFERENCES auth.users(id),
  reporter_role               text CHECK (reporter_role IN ('flight_crew','maintenance','ground_ops','engineering','other')),
  defect_summary              text NOT NULL,
  ata_chapter_code            text,
  severity_signal             text,  -- free text from reporter
  related_warnings            jsonb NOT NULL DEFAULT '[]'::jsonb,  -- ["GEAR DOORS","L NWS"]
  mel_eligible                boolean,
  -- Lifecycle
  status                      text NOT NULL DEFAULT 'declared' CHECK (status IN (
    'declared','triaged','assigned','in_progress','resolved','cancelled'
  )),
  priority                    text CHECK (priority IN ('P1_AOG_CRITICAL','P2_AOG_URGENT','P3_AOG_PLANNED','P4_DEFER_MEL')),
  assigned_to                 uuid REFERENCES auth.users(id),
  estimated_recovery_hours    numeric(6,2),
  -- LLM triage output (audit trail)
  last_triage_output          jsonb,
  last_triage_invocation_id   uuid,
  last_triage_at              timestamptz,
  -- Resolution
  work_order_id               uuid REFERENCES amro_work_orders(id),
  resolved_at                 timestamptz,
  resolved_by                 uuid REFERENCES auth.users(id),
  resolution_summary          text,
  -- Audit
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, alert_number)
);
```

Indexes:
- `(tenant_id, status, reported_at DESC)` for the duty maintenance lead's live queue
- `(tenant_id, airport_iata, status)` for "what's stuck at DEL"
- `(tenant_id, aircraft_id, reported_at DESC)` for per-tail history
- `(aircraft_registration)` partial WHERE status NOT IN ('resolved','cancelled') for hot-list

RLS: tenant isolation via `auth.jwt() ->> 'tenant_id'`.

### `amro.aog_alert_audit` (new — optional v2)

Append-only event log: every state transition, every LLM triage invocation, every reassignment. Not required for v1; emit to `core.audit_log` instead.

## Fleet context aggregation

The LLM input needs:
- `same_type_aircraft_nearby`: requires aircraft last-known position vs. the AOG airport
- `tools_at_airport`: requires tool inventory by station
- `parts_at_airport`: from `uim_inventory_items` filtered by `location_*` matching airport
- `station_capability`: tenant-configured per airport (self_handle / vendor_required / vendor_unavailable)
- `sla_recovery_hours`: tenant route SLA config

**Realistic v1 approach:** ship the alert surface + LLM triage call with a **stub fleet_context** (empty arrays + `station_capability='vendor_required'` default). The LLM gracefully handles missing fleet context per its prompt rules (drops confidence + flags). Real fleet aggregation is v2.

**v2 enrichment (separate slice):** new RPC `amro.fleet_context_at_airport(p_airport_iata text, p_aircraft_model text)` that joins:
- `core.aircraft` last-known airport
- `uim_inventory_items` at the airport
- `amro.station_capabilities` (new table — tenant config)
- Tenant route SLAs from `module_finance.module_finance_subscriptions` plan config

## Workflow

```
1. Controller clicks "Declare AOG" in nav
   → AogAlertCreateDialog (5 fields: registration, airport, defect, severity, reporter_role)
   → INSERT into amro.aog_alerts (status='declared')
   → Redirect to /dashboard/amro/aog/{alert_number}

2. AogAlertDetailPage loads
   → Loads alert + joins aircraft profile
   → If status='declared': auto-fires the AogTriagePanel on mount
     (no manual button — AOG is time-critical, the triage should be
     visible by the time the page renders)
   → status flips to 'triaged' on first successful LLM response

3. Controller reviews triage output:
   - Priority + rationale
   - Recommended actions (ordered, with deadlines)
   - Parts to preorder (split by available_at_airport)
   - Escalation chain
   - Alternates + MEL recommendation
   → Clicks "Assign to <maintenance_lead>" → status='assigned'

4. Assigned engineer clicks "Convert to Work Order"
   → INSERT into amro_work_orders pre-filled from alert
   → amro.aog_alerts.work_order_id ← new WO id
   → status='in_progress'

5. WO completion or explicit "Mark resolved" closes the alert
   → status='resolved' + resolved_at + resolution_summary
```

## Routes

```
/dashboard/amro/aog                  → AogAlertsListPage (live queue + history)
/dashboard/amro/aog/new              → declare dialog (or modal from list page)
/dashboard/amro/aog/:alert_number    → AogAlertDetailPage (hosts AogTriagePanel)
```

Registered in `src/features/module-amro/manifest.ts`.

## Permission model

- `amro.aog.declare`: any user with `amro.read`. Anyone with aircraft access can declare.
- `amro.aog.triage`: requires `amro.write` (running LLM costs money + writes to alert row).
- `amro.aog.assign`: `amro.maintenance_lead` role.
- `amro.aog.resolve`: `amro.maintenance_lead` or assignee.

## API surface

REST endpoints on `services/amro-api/`:

```
POST   /api/v1/amro/aog/alerts                     create
GET    /api/v1/amro/aog/alerts?status=active        list
GET    /api/v1/amro/aog/alerts/:id                 read with aircraft join
PATCH  /api/v1/amro/aog/alerts/:id                 partial update (status, assigned_to, etc)
POST   /api/v1/amro/aog/alerts/:id/triage          fires LLM + persists output
POST   /api/v1/amro/aog/alerts/:id/convert         create work order from alert
POST   /api/v1/amro/aog/alerts/:id/resolve         close alert
```

The `/triage` endpoint internally calls the existing `llm-aog-triage` Edge Function — server-side rather than client-side so the audit row and LLM invocation row are committed transactionally.

## Implementation slices

| Slice | What | Risk |
|---|---|---|
| S1 | `amro.aog_alerts` table + RLS + indexes | Low — pure schema |
| S2 | `services/amro-api/src/routes/aog.routes.ts` CRUD | Low — standard Express CRUD |
| S3 | `useAogAlerts` + `useAogAlert(id)` React Query hooks | Low |
| S4 | `AogAlertsListPage` — queue UI | Med — needs status-coloured rows + airport filter |
| S5 | `AogAlertDetailPage` — hosts triage panel | Med — wire fetch + LLM auto-fire on first visit |
| S6 | `AogAlertCreateDialog` from list page + nav entry | Low |
| S7 | Convert-to-WO flow | Med — fills work order from alert fields |
| S8 | Fleet context RPC (v2 enrichment, optional) | High — joins across 3 tables, perf-sensitive |

## Risks

1. **Time-critical UI must not block on slow LLM.** Mitigation: auto-fire triage on page mount but render the alert details immediately; show triage in a `<Suspense>` shell.
2. **Cost.** Every AOG declaration auto-fires the LLM. At Anthropic Sonnet rates and ~1500 tokens per invocation, that's ~$0.04/alert. With 10 AOG/day per tenant that's $12/month — well within Phase 10 budget envelope.
3. **Schema drift.** `amro.aog_alerts` is parallel to `amro_emergency_work_orders` but different — emergency-WO is a "we already have a WO" flag, alerts are "before there's a WO". Make sure docs are crystal on the distinction or operators will dual-log.

## Decision points

- **Q1: Replace AmroEmergencyQuickAccessPanel's AOG-typed entries?** → No. Keep both, AmroEmergencyQuickAccessPanel handles ALL emergency types; this surface handles AOG specifically with the LLM triage layer. Cross-link from one to the other.
- **Q2: Auto-create alert from emergency WO when type='aog'?** → No for v1. Manual declaration only. Auto-creation is v2.
- **Q3: Where does `airport_iata` come from on existing AOG entries?** → Not backfilled. New surface = new data; legacy AOG-flagged emergency WOs continue to exist alongside.

## Out of scope

- Push notifications on declare (use the existing comms abstraction in a separate slice).
- Mobile-specific AOG declare flow (laptop-first for v1).
- Multi-aircraft AOG (one alert per tail; if a station has 3 AOG simultaneously, 3 alerts).

## What this unblocks

`AogTriagePanel` host insertion. Once `AogAlertDetailPage` exists, the panel drops in with all required input fields present.

## Open before implementation

1. Confirm `core.aircraft` is the right aircraft source (vs. `amro_aircraft_*` shadows). Earlier session work consolidated some aircraft schemas; need to verify which is canonical for the joined aircraft profile.
2. Confirm airport IATA list — does the platform have a `core.airports` table for autocomplete, or is IATA free-text?
3. Confirm role naming — `amro.maintenance_lead` exists in the permission registry already (needs check before referencing in policies).

## Next concrete step

Slice S1 — ship the `amro.aog_alerts` migration + RLS + indexes. Smallest atomic deliverable; rest of the slices stack on top.
