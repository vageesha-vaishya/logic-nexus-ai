# `sales` — Sales Pipeline Module

**Date:** 2026-05-28
**Status:** Draft — under review
**Depends on:** `core`, `crm` (for activity logging)
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose

`sales` owns the **pre-revenue pipeline** — everything from a first-touch lead through a won opportunity. Leads, lead scoring, lead assignment & routing, opportunities, pipelines, stages, forecasts, sales targets, and (provisionally) commissions all live here.

Sales is the entry point of the **commercial lifecycle**: `comms.email.received` → `sales.lead.created` → qualified → `core.party.created` + `crm.account_extensions` (via conversion) → `sales.opportunity.created` → `quotation.quote.draft` → `sales.opportunity.won` → `logistics.shipment.created`. Each transition is an event published by one module and consumed by another via ACL.

---

## 2. Current state (evidence)

### 2.1 Frontend

**Lead-domain components today (in `src/components/crm/`) — all move to `sales`:**

| Component | LOC | Purpose |
|---|---|---|
| `LeadWorkspaceSections.tsx` | 1,570 | The lead-detail page sections (god component) |
| `LeadForm.tsx` | 997 | Create/edit lead form |
| `LeadConversionDialog.tsx` | 735 | **Critical seam** — converts a lead into `core.parties` + `crm.account_extensions` + `crm.contact_extensions` |
| `LeadActivitiesTimeline.tsx` | 668 | Already split-target — half belongs in `crm.activities`, host stays here |
| `LeadCard.tsx` | 205 | Pipeline card |
| `LeadsPipelineComponents.tsx` | 207 | Kanban pieces |
| `LeadScoringCard.tsx` | 211 | **Currently broken** — code references `lead_score_config` but that table is dead (see 2.3) |
| `LeadsMasterDataFormModal.tsx` | 265 | Lead master-data |

**Opportunity-domain components (also moving from `src/components/crm/`):**

| Component | LOC | Purpose |
|---|---|---|
| `OpportunityForm.tsx` | 491 | Create/edit opportunity |
| `OpportunityHistoryTab.tsx` | 311 | Stage transitions + audit |
| `OpportunityItemsEditor.tsx` | 198 | Line-item editor |
| `OpportunitySelectDialog.tsx` + `…List` | 142+251 | Pickers |

**Lead assignment surface (in `src/components/assignment/`) — moves to `sales`:**

6 components: `AssignmentRules.tsx`, `AssignmentQueue.tsx`, `ManualAssignment.tsx`, `AssignmentAnalytics.tsx`, `AssignmentRuleForm.tsx`, `AssignmentHistory.tsx`. These operate on `lead_assignment_queue`, `lead_assignment_rules`, `lead_assignment_history` tables.

**Email-to-lead capture (in `src/components/email/EmailToLeadDialog.tsx`)** — moves to `sales`. This is the LLM-assisted feature that extracts lead data from an inbound email.

### 2.2 Backend

`services/crm-api/src/routes/leads.routes.ts` — 6 endpoints (`router.get/post/patch/delete`). Already 1:1 CRUD shape. **Moves wholesale to `services/sales-api/`** along with its service + events producer code.

No backend yet for: opportunities, lead-scoring, lead-assignment, forecasts, targets, commissions.

### 2.3 Tables (today's state)

| Table | State | Action |
|---|---|---|
| `public.leads` | Active | → `sales.leads`, FK `account_party_id` → `core.parties.id`, remove `accounts_id` |
| `public.lead_activities` | Active | **Split**: engagement entries (call/email/meeting/note) → `crm.activities`; lead-internal events (stage_changed, scored) → `core.audit_log` |
| `public.lead_assignment_queue` | Active | → `sales.lead_assignment_queue` |
| `public.lead_assignment_rules` | Active | → `sales.lead_assignment_rules` |
| `public.lead_assignment_history` | Active | → `sales.lead_assignment_history` |
| `public.lead_tag_rel` | Active | **Killed** — replaced by `core.tag_assignments` with `subject_type='sales.lead'` |
| `public.lead_scoring_rules` | **Dead** (§1.4) | Decide: resurrect (build the AI scoring) or drop |
| `public.lead_score_logs` | **Dead** (§1.4), missing RLS (§1.7) | Same |
| `public.lead_score_config` | **Dead** (§1.4), missing RLS (§1.7), `LeadScoringCard.tsx` comment says "doesn't exist" | Same |
| `public.opportunities` | Active | → `sales.opportunities`, FK `account_party_id` → `core.parties.id` |
| `public.opportunity_items` | Active | → `sales.opportunity_items` |
| `public.opportunity_probability_history` | Active | → `sales.opportunity_probability_history` |

**Pipelines, stages, forecasts, targets, commissions — no tables exist today.** Net-new.

### 2.4 Routes (today)

- `/dashboard/leads`, `/leads/new`, `/leads/:id`, `/leads/pipeline`, `/leads/import-export`, `/leads/assignment`, `/leads/routing` (App.tsx:562–602)
- `/dashboard/opportunities`, `/opportunities/new`, `/opportunities/:id`, `/opportunities/pipeline`, `/opportunities/import-export` (App.tsx:803–847)

---

## 3. Target schema (`sales.*`)

```sql
-- Leads (top of funnel; before promotion to a core.party)
sales.leads (
  id                   uuid PK,
  tenant_id            uuid NOT NULL,
  source               text,             -- 'inbound_email','web_form','linkedin','referral',...
  source_metadata      jsonb,            -- channel-specific context
  status               text NOT NULL,    -- 'new','contacted','qualified','converted','disqualified','dormant'
  company_name         text,             -- pre-conversion; promoted to core.parties on convert
  first_name           text,
  last_name            text,
  email                text,
  phone                text,
  score                int,              -- 0-100; populated by lead-scoring engine
  score_band           text,             -- 'cold','warm','hot' (derived)
  owner_user_id        uuid REFERENCES core.users(id),
  assigned_team_id     uuid REFERENCES core.teams(id) NULL,
  converted_party_id   uuid REFERENCES core.parties(id) NULL,  -- set when status='converted'
  converted_at         timestamptz,
  created_at, updated_at
)

-- Lead scoring (the 3 dead public.lead_score_* tables — resurrected with one clean schema)
sales.scoring_rules (
  id, tenant_id, name, description,
  rule_type        text,    -- 'attribute','behavior','llm'
  criteria         jsonb,   -- DSL: {field, op, value} for attribute; {event_type, window_days, count} for behavior; {prompt_id, model} for llm
  points           int,
  is_active        boolean DEFAULT true,
  created_at, updated_at
)
sales.scoring_logs (
  id, tenant_id, lead_id REFERENCES sales.leads(id),
  rule_id REFERENCES sales.scoring_rules(id),
  points_delta     int,
  reason           text,
  evaluated_at     timestamptz
)
-- Lead score itself lives on sales.leads.score (denormalised, updated by trigger or job)

-- Lead assignment
sales.assignment_rules (
  id, tenant_id, name, priority int,
  match_criteria   jsonb,   -- DSL matching lead attributes
  assign_to_kind   text,    -- 'user','team','round_robin'
  assign_to_id     uuid,
  is_active boolean, created_at, updated_at
)
sales.assignment_queue (id, tenant_id, lead_id, queued_at, claimed_at, claimed_by_user_id)
sales.assignment_history (id, tenant_id, lead_id, from_user_id, to_user_id, reason, assigned_at)

-- Opportunities (post-conversion; the deal)
sales.opportunities (
  id                    uuid PK,
  tenant_id             uuid NOT NULL,
  account_party_id      uuid NOT NULL REFERENCES core.parties(id),   -- the organization
  primary_contact_id    uuid REFERENCES core.parties(id),            -- the person
  source_lead_id        uuid REFERENCES sales.leads(id) NULL,        -- nullable: not all opps come from leads
  name                  text NOT NULL,
  pipeline_id           uuid REFERENCES sales.pipelines(id),
  stage_id              uuid REFERENCES sales.pipeline_stages(id),
  amount                numeric,
  currency              text,
  probability           int,           -- 0-100
  expected_close_date   date,
  closed_at             timestamptz,
  outcome               text,          -- 'won','lost','no_decision'
  loss_reason           text,
  owner_user_id         uuid REFERENCES core.users(id),
  created_at, updated_at
)
sales.opportunity_items (
  id, tenant_id, opportunity_id, sku, description,
  quantity numeric, unit_price numeric, line_total numeric, currency
)
sales.opportunity_probability_history (
  id, tenant_id, opportunity_id, old_probability, new_probability, changed_at, changed_by
)

-- Pipelines & stages (multi-pipeline support; today's schema is implicit)
sales.pipelines (id, tenant_id, name, kind text /* 'inbound','outbound','renewal','expansion' */, is_default boolean)
sales.pipeline_stages (
  id, tenant_id, pipeline_id, name,
  sort_order int, probability int, stage_kind text /* 'open','won','lost' */
)

-- Forecasting
sales.forecast_periods (id, tenant_id, name, start_date, end_date, kind /* 'monthly','quarterly','annual' */)
sales.forecast_snapshots (
  id, tenant_id, period_id, snapshot_at,
  pipeline_value numeric, weighted_value numeric, committed_value numeric, closed_value numeric
)
sales.targets (id, tenant_id, period_id, owner_user_id, team_id, target_amount, currency)

-- Commissions (provisional — see open decision #4)
sales.commission_plans (id, tenant_id, name, plan_json jsonb, effective_from, effective_to)
sales.commission_assignments (id, tenant_id, user_id, plan_id, effective_from, effective_to)
```

`sales.leads.account_party_id` is **only set after conversion**. Before conversion the lead has loose `company_name`/`first_name`/`last_name`/`email` fields — these are *not* core.parties rows yet. Conversion (the LeadConversionDialog flow) creates the party + extensions in one transaction and sets `converted_party_id`.

---

## 4. RLS strategy

```sql
-- Lead visibility: tenant + module access + (owner OR assigned team OR sales manager)
CREATE POLICY view_leads ON sales.leads FOR SELECT USING (
  tenant_id = auth.jwt_tenant_id()
  AND core.has_module_access(tenant_id, 'sales', 'read')
  AND (
    owner_user_id = auth.uid()
    OR (assigned_team_id IS NOT NULL AND auth.in_team(assigned_team_id))
    OR auth.has_role(tenant_id, 'sales_manager')
  )
);
```

Opportunities use the same three-layer pattern. Assignment-queue and scoring-logs are role-gated (`sales_manager` only). The dead-table RLS gap (§1.7) is fixed by the new `sales.scoring_logs` schema which inherits the standard policies.

---

## 5. Events

### Published

| Event | When |
|---|---|
| `sales.lead.created` | New lead in any status |
| `sales.lead.scored` | Score changes (delta > threshold) |
| `sales.lead.assigned` | Assignment rule fires or manual assignment |
| `sales.lead.qualified` | Status → 'qualified' |
| `sales.lead.converted` | Status → 'converted'; payload includes new `core.parties.id` |
| `sales.lead.disqualified` | Status → 'disqualified'; with reason |
| `sales.opportunity.created` | New opp |
| `sales.opportunity.stage_changed` | Stage transition |
| `sales.opportunity.amount_changed` | Material amount edit |
| `sales.opportunity.won` | outcome = 'won' — **the key signal for Logistics + Finance** |
| `sales.opportunity.lost` | outcome = 'lost' |
| `sales.forecast.snapshotted` | Periodic forecast snapshot |
| `sales.target.set` / `sales.target.adjusted` | Quota changes |

### Subscribed

| Event | Consumer logic |
|---|---|
| `comms.email.received` (matched + unmatched) | If unmatched to a party AND sender domain not in DNC list → create `sales.leads` row (auto-capture) |
| `core.party.created` | If party originates outside sales (e.g., self-signup), create a "warm" lead linked to it |
| `crm.activity.logged` (subject_type='sales.lead') | Trigger re-scoring; update `last_touched_at` |
| `quotation.quote.accepted` | Move parent opp to `won` outcome |
| `quotation.quote.rejected` | Move parent opp to `lost` outcome (with reason from quote) |

ACL location: `services/sales-api/src/acl/{comms,quotation,crm,core}.ts`.

---

## 6. UI surface

Refactored routes (renaming `/dashboard/leads/*` to `/dashboard/sales/leads/*` for namespace clarity):

| Route | Old equivalent | Notes |
|---|---|---|
| `/dashboard/sales` | (new) | Sales home — KPIs, pipelines snapshot |
| `/dashboard/sales/leads` | `/dashboard/leads` (App.tsx:562) | Lead list + filters |
| `/dashboard/sales/leads/new` | `/dashboard/leads/new` | Create lead |
| `/dashboard/sales/leads/:id` | `/dashboard/leads/:id` | Lead detail — refactored from 1,570-LOC god component into typed sections |
| `/dashboard/sales/leads/pipeline` | `/dashboard/leads/pipeline` | Kanban |
| `/dashboard/sales/leads/import-export` | `/dashboard/leads/import-export` | CSV import |
| `/dashboard/sales/leads/assignment` | `/dashboard/leads/assignment` | Assignment queue + rules |
| `/dashboard/sales/leads/routing` | `/dashboard/leads/routing` | Routing rules |
| `/dashboard/sales/opportunities` | `/dashboard/opportunities` | Opp list |
| `/dashboard/sales/opportunities/new` | `/dashboard/opportunities/new` | Create opp |
| `/dashboard/sales/opportunities/:id` | `/dashboard/opportunities/:id` | Opp detail |
| `/dashboard/sales/opportunities/pipeline` | `/dashboard/opportunities/pipeline` | Kanban by stage |
| `/dashboard/sales/forecasts` | (new) | Forecasting dashboard |
| `/dashboard/sales/targets` | (new) | Targets / quotas |
| `/dashboard/sales/settings/scoring` | (new) | Scoring-rules admin |
| `/dashboard/sales/settings/pipelines` | (new) | Pipeline + stage admin |
| `/dashboard/sales/settings/assignment-rules` | (new) | Assignment rules admin |

**God-component split plan for `LeadWorkspaceSections.tsx` (1,570 LOC):**

Today: one component renders 8 sections (header, score, activities, qualification, conversion, opportunity-links, tasks, files). Break into:

- `LeadDetailLayout.tsx` (~100 LOC) — page shell, lazy-loads sections
- `LeadHeaderCard.tsx` (~200 LOC) — name, owner, status, score badge, actions
- `LeadScoreSection.tsx` (~200 LOC) — score breakdown + manual override
- `LeadActivitiesSection.tsx` (~150 LOC) — embeds `crm/PartyActivitiesTimeline` filtered to this subject
- `LeadQualificationSection.tsx` (~250 LOC) — BANT or MEDDIC field group
- `LeadConversionSection.tsx` (~200 LOC) — the trigger for `LeadConversionDialog`
- `LeadOpportunitiesSection.tsx` (~150 LOC) — linked opps
- `LeadTasksSection.tsx` (~150 LOC) — tasks (CRM activity-type='task')
- `LeadFilesSection.tsx` (~100 LOC) — `core.file_links` for this lead

Each section ≤ 250 LOC. Each section is independently testable.

**`LeadConversionDialog.tsx` (735 LOC)** keeps its size — it's a complex multi-step wizard (validate party non-existence → match candidates → create party → create extensions → create opp → emit `sales.lead.converted`). Refactor into a state-machine (XState or a typed reducer) inside the component file rather than splitting.

---

## 7. LLM hooks (specific to Sales)

| Rank | Feature | Mechanism | Cost notes |
|---|---|---|---|
| 1 | **Email → lead extraction** | Inbound email body → structured lead fields (name, company, phone, intent, urgency). Already exists in `EmailToLeadDialog.tsx`; formalise via `packages/llm-client` action `extract_lead_from_email`. | Per email; ~$0.001 |
| 2 | **AI-driven lead scoring** | The 3rd `scoring_rules.rule_type='llm'` path. LLM evaluates a lead against a prompt template ("fit for ICP based on this profile + company info") and returns a score 0–100 with reasoning. Combines with deterministic rules for the final number. | Async per scoring event; ~$0.002 |
| 3 | **Conversion-readiness suggestion** | On lead detail page, LLM looks at recent activities + qualification fields, says "Ready to convert (high confidence)" or "Needs follow-up on X". | Gated behind a "Suggest" button to control cost |
| 4 | **Forecast narrative generation** | When generating a forecast snapshot, LLM writes a 3-paragraph narrative explaining the move from prior period (gains, losses, risks). | Per snapshot |
| 5 | **Opportunity-loss-reason clustering** | Periodic batch — LLM clusters free-text `loss_reason` values into themes, surfaces top reasons per quarter. | Batch nightly; ~$0.05 per run |
| 6 | **Stage-change recommendations** | LLM watches opps stuck in stage > N days, suggests next action or stage move. | Async; per stuck-opp daily |

All routed through `packages/llm-client` (writes to `core.llm_usage`). The 3 dead scoring tables in §1.7 are **resurrected with the new schema** specifically because the LLM scoring path (rank 2) needs durable rule + log storage.

---

## 8. Migration sequence

| Phase | What | Risk |
|---|---|---|
| 0 | Wait for `core.parties` (core Phase 2) and `crm.activities` (crm Phase 2). | — |
| 1 | Create `sales.*` schema + tables. RLS policies + helpers. No data move yet. | Zero — additive. |
| 2 | Backfill `sales.leads` from `public.leads`, mapping `accounts_id` → `account_party_id` via `core.parties` lookup. | Medium — needs reconciliation script. |
| 3 | Backfill `sales.opportunities` from `public.opportunities`. | Medium. |
| 4 | Move `lead_activities` rows: engagement entries → `crm.activities`, internal-event entries → `core.audit_log`. | Medium — needs classifier. |
| 5 | Backfill `sales.assignment_*` from `public.lead_assignment_*`. | Low. |
| 6 | Build `sales.pipelines`, `sales.pipeline_stages`, `sales.forecast_*`, `sales.targets`. Seed default pipeline per tenant. | Low — net-new tables. |
| 7 | Cut over `services/crm-api/src/routes/leads.routes.ts` → `services/sales-api/`. Add the missing opportunities/assignment/scoring routes. | Medium — service split. |
| 8 | Move `src/components/crm/Lead*`, `src/components/crm/Opportunity*`, `src/components/assignment/*`, `src/components/email/EmailToLeadDialog.tsx` → `src/features/module-sales/components/`. | Medium — many import paths. |
| 9 | Apply the LeadWorkspaceSections god-component split (§6). | Low — UI refactor, well-tested. |
| 10 | Build LLM features in §7 ranked order. Start with #1 (formalise the existing one) and #2 (resurrect scoring). | Low — additive. |
| 11 | Drop `public.lead_*`, `public.opportunity_*`, `public.lead_assignment_*`, `public.lead_score_*` after 30-day no-direct-read window. | Low — read paths cut over. |

---

## 9. Open decisions

1. **Resurrect or kill the 3 dead scoring tables?** — **Recommend resurrect via the new `sales.scoring_rules` + `sales.scoring_logs` schema** (one clean table each, with the LLM rule_type as a first-class path). The fragmentation in `public.lead_score_*` is the real bug; the *intent* of having lead scoring is sound.
2. **Lead-stage taxonomy** — six statuses listed (`new`, `contacted`, `qualified`, `converted`, `disqualified`, `dormant`). Per-tenant customisable? **Recommend not yet** — start with the fixed list, add `sales.lead_status_overrides` later if needed.
3. **Multi-pipeline support** — schema has `sales.pipelines` but UI starts single-pipeline. **Recommend ship single-pipeline UI for v1**, expose multi-pipeline once 2+ customers ask.
4. **Commission ownership** — Sales or Finance? **Recommend Sales for *plans + assignments*; Finance for *payouts*.** Sales owns the policy ("rep X gets 5% on deals > $50k closed-won"). Finance owns the disbursement (compute amount owed, generate payment, accounting entry). Cross-module event: `sales.opportunity.won` → finance computes payable.
5. **`lead_activities` split during migration** — needs a deterministic classifier. **Recommend a denylist**: types `'stage_changed','scored','assigned','converted'` go to `core.audit_log`; everything else goes to `crm.activities`. Document in migration script.
6. **Conversion atomicity** — `LeadConversionDialog` must be an all-or-nothing transaction (party + extensions + opp + event). **Recommend a `sales-api` endpoint** that wraps the lot in one DB transaction + outbox write; frontend never orchestrates step-by-step.

---

## 10. Acceptance criteria

Done when:

- [ ] `sales` schema exists with all tables from §3.
- [ ] `services/sales-api/` exists, hosts leads + opportunities + assignment + scoring + forecast routes, has tests.
- [ ] `LeadConversionDialog` invokes the single atomic endpoint; emits `sales.lead.converted` with the new `core.parties.id` in the payload.
- [ ] `LeadWorkspaceSections.tsx` is split per §6; no remaining file > 300 LOC in the lead-detail surface.
- [ ] Lead scoring works end-to-end: rules created in admin UI → scores update on activity events → `sales.lead.scored` events fire.
- [ ] Email-to-lead extraction routed through `packages/llm-client`; `core.llm_usage` rows verified.
- [ ] `public.leads`, `public.opportunities`, `public.lead_assignment_*`, `public.lead_score_*` dropped.
- [ ] At least 3 of §7 LLM features shipped (recommend #1, #2, #3).
- [ ] RLS test suite covers cross-tenant + cross-role denials.

---
