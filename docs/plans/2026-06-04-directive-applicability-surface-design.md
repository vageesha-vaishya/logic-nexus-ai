# Directive Applicability Surface — Design

**Date:** 2026-06-04
**Status:** Design — not yet implemented
**Owner:** AMRO module
**Related:** `amro.directive.applicability` LLM feature (commit 6c9359f9), `DirectiveApplicabilityCheck` FE (commit 587cf2f3)

## Problem statement

The `amro.directive.applicability` LLM feature was shipped earlier today end-to-end. It evaluates whether a regulatory directive (Airworthiness Directive, Service Bulletin, Type Certificate Data Sheet revision) applies to a specific aircraft. The panel's input is:

```
directive: { issuing_authority, directive_id, kind, title, effective_date, applies_to, compliance_action, relevant_ata_chapters }
aircraft:  { manufacturer, model, serial_number, registration, engines, configurations, hours_since_new, cycles_since_new }
```

No existing surface carries BOTH a specific directive AND a specific aircraft side-by-side:
- `AmroDirectivesManagementPage` is directive master-data only — no aircraft context, and the existing `DirectiveRecord` shape doesn't even have `applies_to`/`effective_date`/`compliance_action` fields (those need to be added to the schema separately or the LLM input needs adapting).
- `AmroWorkOrderDetailPage` knows about ONE aircraft per work order, but doesn't list candidate directives.
- Master data shows directives, work orders show aircraft + tasks — but the *applicability decision* (does directive X apply to aircraft Y?) has no surface.

This decision is critical regulatory work. False negatives have safety implications.

## Goals

1. When a directive is published or revised, the system can batch-evaluate applicability across the entire fleet.
2. When a new aircraft enters service, the system evaluates ALL active directives against it.
3. Operators can run an ad-hoc applicability check from either side (directive → list of aircraft, OR aircraft → list of directives).
4. All LLM applicability verdicts are persisted as evidence (cite-driven reasoning + confidence + matched/unmatched criteria) for the regulator audit trail.
5. Low-confidence verdicts surface in a human-review queue.

## Non-goals

- Replacing the regulator's authoritative determination. The LLM is advisory; a Director of Maintenance signs off on regulatory compliance.
- Automatic work-order generation. Once applicability is confirmed, the operator chooses to open a WO.

## Data model

### Schema additions on `amro_directives` (existing table — additive)

```sql
ALTER TABLE amro_directives ADD COLUMN IF NOT EXISTS issuing_authority text
  CHECK (issuing_authority IN ('FAA','EASA','CAAC','SACAA','OTHER'));
ALTER TABLE amro_directives ADD COLUMN IF NOT EXISTS kind text
  CHECK (kind IN ('AD','SB','TCDS','OTHER'));
ALTER TABLE amro_directives ADD COLUMN IF NOT EXISTS effective_date date;
ALTER TABLE amro_directives ADD COLUMN IF NOT EXISTS applies_to text;
ALTER TABLE amro_directives ADD COLUMN IF NOT EXISTS compliance_action text;
ALTER TABLE amro_directives ADD COLUMN IF NOT EXISTS relevant_ata_chapters jsonb DEFAULT '[]'::jsonb;
ALTER TABLE amro_directives ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE amro_directives ADD COLUMN IF NOT EXISTS published_at date;
```

These map 1:1 to the LLM input's `directive` object. Existing rows backfill `kind` from the existing `directives_type_id` join + sensible defaults for the rest (`OTHER` / null / null).

### `amro.directive_applicability` (new — evidence + cache)

```sql
CREATE TABLE amro.directive_applicability (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL,
  franchise_id              uuid,
  directive_id              uuid NOT NULL REFERENCES amro_directives(id),
  aircraft_id               uuid NOT NULL REFERENCES core.aircraft(id),
  -- LLM verdict
  applies                   boolean NOT NULL,
  confidence                numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  reasoning                 text,
  matched_criteria          jsonb NOT NULL DEFAULT '[]'::jsonb,
  unmatched_criteria        jsonb NOT NULL DEFAULT '[]'::jsonb,
  ata_chapters_touched      jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_followup      text,
  -- LLM invocation provenance
  invocation_id             uuid,
  prompt_key                text NOT NULL DEFAULT 'amro.directive.applicability',
  prompt_version            int  NOT NULL DEFAULT 1,
  llm_model                 text,
  -- Lifecycle
  status                    text NOT NULL DEFAULT 'awaiting_review' CHECK (status IN (
    'awaiting_review','accepted','overridden','superseded','obsolete'
  )),
  human_reviewer_id         uuid REFERENCES auth.users(id),
  human_review_at           timestamptz,
  human_override_reason     text,
  superseded_by             uuid REFERENCES amro.directive_applicability(id),
  -- Audit
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  -- Aircraft snapshot at evaluation time (immutable)
  aircraft_snapshot_jsonb   jsonb NOT NULL,
  directive_snapshot_jsonb  jsonb NOT NULL,
  UNIQUE (directive_id, aircraft_id, status) WHERE status = 'accepted'
  -- Only ONE accepted verdict per (directive, aircraft) at a time.
);
```

Indexes:
- `(tenant_id, status, confidence)` for the review queue
- `(directive_id, applies)` for "which tails does this directive apply to"
- `(aircraft_id, applies, status)` for "what's pending on this tail"
- `(human_reviewer_id, human_review_at DESC)` for reviewer load

Immutable snapshot columns (`aircraft_snapshot_jsonb`, `directive_snapshot_jsonb`) capture the inputs at evaluation time. If the aircraft's serial changes (it shouldn't) or the directive is revised, the next re-evaluation creates a NEW row with `superseded_by` pointing back; the old row stays for audit.

## Workflow

```
A. Directive published / revised
   1. Operator creates/updates amro_directives row (manually or via FAA/EASA scrape)
   2. Background job: enqueue (directive_id × every active aircraft in fleet)
   3. Worker batches 10 evaluations per LLM call (cost optimisation)
      → posts to llm-directive-applicability
   4. Persist verdicts into amro.directive_applicability
   5. status='awaiting_review' for all
   6. Notification: "23 new directive applicability verdicts need review"

B. Aircraft enters service
   1. Operator creates core.aircraft row
   2. Background job: enqueue (every active directive × this aircraft)
   3. Same evaluation flow as A
   4. Operator reviews queue before clearing aircraft for revenue service

C. Ad-hoc check from directive surface
   1. Operator opens AmroDirectiveDetailPage (new — splits from list page)
   2. "Aircraft Applicability" tab shows the fleet × this directive
      with cached verdicts (chip per tail: applies/not/pending)
   3. Per-row "Re-check" button calls the LLM live for that one pair
   4. Operator can accept / override per row

D. Ad-hoc check from aircraft surface
   1. Operator opens AmroAircraftDetailPage (new — there is no real one today)
   2. "Open Directives" tab shows all directives × this aircraft
      with cached verdicts
   3. Same per-row controls as C

E. Human review queue
   1. Reviewer opens /dashboard/amro/directives/applicability/queue
   2. Rows filtered by confidence < 0.85 OR status='awaiting_review'
   3. Each row shows directive + aircraft summary + LLM reasoning
   4. Accept / Override / Snooze 30d
   5. Override requires human_override_reason (regulatory paper trail)
```

## Routes

```
/dashboard/amro/directives                               existing — directives master list
/dashboard/amro/directives/:id                           NEW — directive detail with applicability tab
/dashboard/amro/aircraft/:id/directives                  NEW — aircraft × applicable directives
/dashboard/amro/directives/applicability/queue           NEW — human review queue
```

## Permission model

- `amro.directive.read`: anyone with `amro.read`
- `amro.directive.applicability.check`: requires `amro.write` (LLM costs money + writes a row)
- `amro.directive.applicability.review`: requires `amro.director_of_maintenance` (signs off)
- `amro.directive.applicability.override`: same; override is the regulatory sign-off path

## API surface

```
GET    /api/v1/amro/directives/:id/applicability                 list verdicts for one directive
GET    /api/v1/amro/aircraft/:id/applicability                   list verdicts for one aircraft
POST   /api/v1/amro/directives/:id/applicability/check           one-shot check (LLM)
POST   /api/v1/amro/directives/:id/applicability/batch           queue (directive × fleet)
POST   /api/v1/amro/aircraft/:id/applicability/batch             queue (every directive × this aircraft)
GET    /api/v1/amro/directives/applicability/queue               human review queue (filtered)
PATCH  /api/v1/amro/directives/applicability/:verdict_id         accept / override / snooze
```

Batch endpoints push to a BullMQ queue (existing infra) — worker calls LLM in groups of 10 to amortise cost.

## Cost analysis

| Scenario | Volume | LLM cost |
|---|---|---|
| New AD published, 30-tail fleet | 30 evaluations × $0.005/ea (Haiku) = $0.15 | one-time |
| New aircraft enters service, 400 active directives | 400 evaluations × $0.005 = $2.00 | one-time |
| Re-check on directive amendment | per affected tail × $0.005 | low |
| Quarterly fleet-wide rerun | 30 tails × 400 directives × $0.005 = $60 | quarterly |

At normal cadence: well under $200/year per tenant. The cache + immutable snapshots mean re-runs only happen when something changed.

## Implementation slices

| Slice | What | Risk |
|---|---|---|
| S1 | Schema additions on amro_directives + amro.directive_applicability migration + indexes | Low |
| S2 | services/amro-api/routes/directive-applicability.routes.ts CRUD | Low |
| S3 | Worker for batch evaluation (services/amro-api/workers/applicability-worker.ts) | Med — LLM batching, cost monitoring |
| S4 | useDirectiveApplicabilityVerdicts hooks | Low |
| S5 | AmroDirectiveDetailPage with applicability tab — hosts the DirectiveApplicabilityCheck panel for ad-hoc checks | Med |
| S6 | AmroAircraftDetailPage (new — needs fleet aircraft detail surface first if none exists) | Med |
| S7 | Human review queue page | Med |
| S8 | Notification trigger on awaiting_review > threshold | Low |

## Risks

1. **`amro_directives` schema addition might conflict with existing UIM/AMRO Phase 7 work.** Need to verify the column adds don't break dual-write triggers shipped earlier this week. Check Phase 7 §9 commits.
2. **Aircraft snapshot drift.** Hours_since_new + cycles_since_new change continuously. Snapshot at evaluation = the values used by the LLM. If applicability depends on cycles ("applies to aircraft with > 10,000 cycles"), the verdict can become stale. Mitigation: periodic re-evaluation cron (monthly default, configurable).
3. **Directive coverage assumption.** The LLM only evaluates against directives in the tenant's `amro_directives` table. If the tenant misses an FAA AD because their scraper failed, the LLM can't flag what it doesn't see. Out of scope for this design — separate "directive ingestion" track.
4. **Multi-tenant LLM cost attribution.** Batch worker processes per-tenant batches; cost goes to the gateway tenant ledger. Need to ensure the gateway's budget gates trigger before runaway worker costs.

## Decision points

- **Q1: Do we add the directive columns (issuing_authority, applies_to, etc) to `amro_directives` or to a parallel `amro.directive_metadata` table?**
  → Add to `amro_directives`. Parallel tables fragment the model; columns are nullable for backward compat.
- **Q2: Do we treat the LLM verdict as authoritative or as advisory?**
  → Advisory. status='accepted' requires human review by a director of maintenance. The LLM's verdict + reasoning is regulator-visible evidence; the human is the regulator-visible decider.
- **Q3: Confidence threshold for auto-accept?**
  → No auto-accept. Even high-confidence verdicts wait for human review. Regulatory work is one place we don't trade safety for throughput.
- **Q4: How do we handle directive revisions?**
  → New `amro_directives` row with `superseded_by` pointing to old. All applicability verdicts referencing old directive get status='superseded' (cron sweeps). Worker re-evaluates against new directive.

## Out of scope

- FAA/EASA/CAAC/SACAA scraping (ingestion track — separate design)
- Compliance action tracking (when a directive applies, what's been done? Existing work-order machinery covers this once a verdict is accepted)
- Mobile UI for directive review (regulatory work is laptop-first)

## What this unblocks

`DirectiveApplicabilityCheck` panel host insertion. Slice S5 (`AmroDirectiveDetailPage`) is the natural home — operator clicks "Check applicability" on a directive row, sees per-tail verdicts pulled from cache OR re-runs ad-hoc via the panel.

## Open before implementation

1. Audit `amro_directives` schema vs. Phase 7 dual-write triggers — adding columns might require updating the trigger function. Quick grep + verify.
2. Determine if `AmroAircraftDetailPage` exists (or just `AmroOwnedWorkspace` with aircraft detail panels). If absent, S6 needs an aircraft-detail-page slice before applicability tab.
3. Confirm directive ingestion: are tenants actually populating `amro_directives` today, or is the table sparsely populated? Affects S1 backfill defaults.
4. Confirm `core.aircraft` is canonical (same Q as the AOG design — both touch the aircraft profile join).

## Next concrete step

Slice S1 — ship the `amro_directives` column additions + `amro.directive_applicability` table migration. Smallest atomic deliverable. After that, S2 (REST) and S4 (hooks) can land in parallel.

## Notes

This design is heavier than the AOG one because the applicability problem touches more existing schema (`amro_directives`, `core.aircraft`, possibly Phase 7 mirror tables) and has stricter regulatory implications. The AOG surface is operationally critical (60-second SLA) but tolerates a stub fleet_context for v1; the applicability surface tolerates a slower workflow but needs an audit trail strong enough to show to a regulator. Both panels are now waiting on the same kind of work (surface + schema), but the priority order should be: AOG first (operational pain), applicability second (compliance pain — important but not "AOG-grade urgent").
