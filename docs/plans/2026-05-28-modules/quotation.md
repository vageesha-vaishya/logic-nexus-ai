# `quotation` — Pricing & Proposal Module

**Date:** 2026-05-28
**Status:** Draft — under review
**Depends on:** `core`, `sales` (for opportunity linkage), `logistics` (for rate data)
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose

`quotation` owns the **pricing artifact** the platform produces for a customer: a structured proposal with one or more options, each with one or more legs, priced through deterministic engines and (optionally) AI-augmented suggestions. Versions, approvals, sharing tokens, audit trails, AI-quoting cache — all the apparatus around a quote.

Quotation is the **most refactor-heavy module** in this redesign. The largest single file in the codebase (`UnifiedQuoteComposer.tsx`, 4,364 LOC) lives here. The misleading `src/components/sales/` directory is in fact the Quotation builder UI. AI is *already in production* via `useAiAdvisor`. The migration is largely about renaming, splitting, and centralising — not building from scratch.

---

## 2. Current state (evidence)

### 2.1 The naming inversion

`src/components/sales/` is the Quotation builder. `src/components/crm/Lead*` is the Sales-pipeline UI. The names are swapped relative to the new boundary. This subdoc treats `src/components/sales/*` as Quotation surface; rename happens during migration.

### 2.2 Frontend — 13 sub-directories

| Path | Role | Notes |
|---|---|---|
| `src/components/sales/unified-composer/` | **Current** quote builder | `UnifiedQuoteComposer.tsx` (4,364 LOC) + `FormZone.tsx` (1,544) + `FinalizeSection.tsx` (584); 30 test files |
| `src/components/sales/composer/` | **Legacy** quote builder | Still maintained — 14 tests; `DocumentPreview.tsx` (990), `ChargesManagementStep.tsx` (761), `QuoteOptionsOverview.tsx` (588), `QuoteDetailsStep.tsx` (577); plus `store/QuoteStore.tsx` + `store/types.ts` (Zustand-style state) |
| `src/components/sales/quote-form/` | Quote header/financials | `useQuoteRepository.ts` (1,318 LOC — data layer); `QuoteFinancials.tsx` (502), `QuoteHeader.tsx` (497); 7 tests |
| `src/components/sales/quotation-versions/` | Version history | |
| `src/components/sales/templates/` | Template builder | `TemplateBuilder.tsx` (649) |
| `src/components/sales/kanban/` | Pipeline view | |
| `src/components/sales/analytics/` | Quote analytics | |
| `src/components/sales/history/` | Quote history | |
| `src/components/sales/portal/` | Public quote portal | `ShareQuoteDialog.tsx` uses `portal_tokens` table |
| `src/components/sales/modals/` | Dialogs | |
| `src/components/sales/shared/` | Reused pieces | `QuoteResultsList.tsx` (785), `ChargeBreakdown.tsx` (821), `QuoteComparisonView.tsx` (498), `SharedCargoInput.tsx` (689), `QuickQuoteHistory.tsx` (43 reads `ai_quote_requests`) |
| `src/components/sales/common/` | UI primitives | |
| `src/components/sales/QuotationManagerLayout.tsx` | Layout wrapper | 509 LOC |

### 2.3 Pricing engines (in `src/services/quotation/`)

Already extractable as a package. Key exports:

| File | LOC | Public surface |
|---|---|---|
| `mgl/engine.ts` | 506 | `generateStandaloneMglRateOptions`, `validateStandaloneOptionSet`, `validateMglRateOption`, `calculateMglRateOption`, `calculateMglQuotation` |
| `mgl/routing-engine.ts` | 570 | `class NycDedRoutingEngine`, types `RouteOptimizationResult`, `CarrierAllianceInfo`, `RoutingMatrixEntry` |
| `hybrid-route-configuration.ts` | 567 | `buildHybridRouteConfiguration`, `validateSmartRouteInput`, types `SmartRouteCarrierProfile`, `SmartRouteInput`, `SmartRouteValidationIssue`, `SmartRouteAuditRecord` |

7 test files colocated under `__tests__/`. These engines are **pure functions over input data** — no DB access — and belong in `packages/quotation-engine/`.

### 2.4 AI integration (already in production)

- `src/hooks/useAiAdvisor.ts` — generic dispatcher: `invokeAiAdvisor<T>({ action, payload }): Promise<AiAdvisorResponse<T>>`
- Consumed by `composer/ChargesManagementStep.tsx:14`, `composer/QuoteDetailsStep.tsx:6` (legacy composer), `unified-composer/FormZone.test.tsx` (mocked), `unified-composer/UnifiedQuoteComposer.fallback.test.tsx` (mocked)
- Tables: `ai_quote_cache`, `ai_quote_requests`, `ai_audit_logs` (all in `public.*`)
- Reader code: `src/components/sales/shared/QuickQuoteHistory.tsx:43`, `src/hooks/useRateFetching.ts:789`
- **Gap:** AI calls bypass `platform.llm_usage` accounting today. Cost is invisible.

### 2.5 Backend

**None.** All quotation logic runs in the browser against Supabase. The pricing engines are TypeScript modules invoked client-side. AI calls go via Supabase edge functions or direct Anthropic/OpenAI invocations (need verification).

### 2.6 Routes (today)

- `/dashboard/quotes`, `/quotes/new`, `/quotes/:id`, `/quotes/pipeline`, `/quotes/import-export`, `/quotes/templates`, `/quotes/analytics` (App.tsx:847–895)
- `/dashboard/settings/quotations`, `/dashboard/settings/quote-numbers` (App.tsx:1003, 1007)
- `/testing/quotations` (App.tsx:903)
- `/portal/quote/:token` — public, no auth (App.tsx:1063)

### 2.7 Tables (today)

| Table | Purpose | Action |
|---|---|---|
| `public.quotation_versions` | Version snapshots | → `quotation.versions` |
| `public.quotation_version_options` | Options inside a version | → `quotation.version_options` |
| `public.quotation_version_option_legs` | Legs inside an option | → `quotation.version_option_legs` |
| `public.quotation_packages` | Reusable bundles | → `quotation.packages` |
| `public.quotation_domain` | Domain-config | → `quotation.domain_config` (consider folding to `core.domains`) |
| `public.quotation_configuration` | Tenant-level quotation prefs | → `quotation.configuration` |
| `public.quote_legs` | Standalone leg data | → `quotation.legs` |
| `public.quote_documents` | Generated PDFs | **Killed** — use `core.files` + `core.file_links` (subject_type='quotation.quote') |
| `public.quote_templates` | Template definitions | → `quotation.templates` |
| `public.quote_shares` | Portal-share metadata | → `quotation.shares` (FK `portal_token_id` → `core.portal_tokens`) |
| `public.quote_audits` | Audit entries | **Killed** — `core.audit_log` filtered by subject_type='quotation.quote' |
| `public.quotation_audit_log` | Audit entries (alt) | **Killed** — duplicate of above |
| `public.quotation_version_audit_logs` | Version-level audit | **Killed** — folded into `core.audit_log` |
| `public.quote_email_history` | Sent emails | **Killed** — `crm.activities` (activity_type='email') with subject_type='quotation.quote' |
| `public.quote_access_logs` | Portal access log | **Killed** — `core.audit_log` (action='accessed_via_portal') |
| `public.quote_presentation_templates` | Branded layouts | → `quotation.presentation_templates` |
| `public.quote_comments` | In-quote comments | → `quotation.comments` |
| `public.quote_approval_rules` | Approval policy | → `quotation.approval_rules` |
| `public.quote_approvals` | Approval state | → `quotation.approvals` |
| `public.ai_quote_cache` | Cached AI responses | → `quotation.ai_cache` |
| `public.ai_quote_requests` | AI request log | → `quotation.ai_requests` (writes to `core.llm_usage` too) |
| `public.ai_audit_logs` | AI audit | **Killed** — `core.audit_log` (action='llm_call') |
| `public.quote_contacts_screening` | Sanctions screening | → `compliance.screenings` linked via `subject_type='quotation.quote'` |
| `public.mgl_quotation_audit_logs` | Pricing-engine audit | **Killed** — `core.audit_log` |
| `public.quotation_comparison_snapshots` | Comparison artifacts | → `quotation.comparison_snapshots` |
| `public.quotation_selection_events` | Customer selection telemetry | → `quotation.selection_events` |
| `public.portal_tokens` | Shared portal-access tokens | **Lifts to** `core.portal_tokens` (used by other modules too) |

**Net result**: 10 quotation-prefixed tables + 11 quote-prefixed tables → **~12 tables in `quotation.*`** after consolidation. 9 tables killed in favour of cross-cutting `core.*` infra.

---

## 3. Target schema (`quotation.*`)

```sql
quotation.quotes (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  quote_number             text NOT NULL,                -- tenant-scoped sequence
  opportunity_id           uuid REFERENCES sales.opportunities(id) NULL,  -- standalone quotes allowed
  account_party_id         uuid NOT NULL REFERENCES core.parties(id),
  primary_contact_id       uuid REFERENCES core.parties(id),
  status                   text NOT NULL,                -- 'draft','pending_approval','sent','viewed','accepted','rejected','expired'
  currency                 text NOT NULL,
  total_amount             numeric,
  valid_until              date,
  current_version_id       uuid,                         -- FK fixed up after insert
  owner_user_id            uuid REFERENCES core.users(id),
  template_id              uuid REFERENCES quotation.templates(id),
  approval_required        boolean DEFAULT false,
  created_at, updated_at
)

quotation.versions (
  id, tenant_id, quote_id, version_number int,
  snapshot_payload jsonb,          -- the full quote state at this version
  created_by uuid REFERENCES core.users(id),
  created_at timestamptz
)

quotation.version_options (
  id, tenant_id, version_id REFERENCES quotation.versions(id),
  option_index int, option_label text,
  carrier_id uuid,                  -- opaque ref; populated by ACL from logistics.carriers
  total_amount numeric, transit_days int,
  meta jsonb
)

quotation.version_option_legs (
  id, tenant_id, option_id REFERENCES quotation.version_options(id),
  leg_index int, origin text, destination text,
  mode text, carrier_ref text, charges jsonb
)

quotation.packages (id, tenant_id, name, contents jsonb, created_at)

quotation.templates (
  id, tenant_id, name, kind text, body_template text,
  variables jsonb, is_default boolean, created_at, updated_at
)
quotation.presentation_templates (id, tenant_id, name, layout_json jsonb)

quotation.shares (
  id, tenant_id, quote_id, portal_token_id REFERENCES core.portal_tokens(id),
  shared_with_email text, shared_at, expires_at, revoked_at
)

quotation.comments (
  id, tenant_id, quote_id, version_id, author_user_id, body, posted_at
)

quotation.approval_rules (
  id, tenant_id, name,
  criteria jsonb,                   -- {amount_gt: 50000} or {discount_pct_gt: 20}
  approver_role_id uuid, approver_user_id uuid,
  is_active boolean, priority int
)
quotation.approvals (
  id, tenant_id, quote_id, version_id,
  rule_id REFERENCES quotation.approval_rules(id),
  status text,                       -- 'pending','approved','rejected'
  approver_user_id uuid, decided_at, comment text
)

quotation.ai_requests (
  id, tenant_id, quote_id, version_id,
  action text,                       -- 'suggest_charges','suggest_route','classify_inquiry',...
  request_payload jsonb,
  response_payload jsonb,
  llm_usage_id uuid REFERENCES core.llm_usage(id),  -- enforced FK; every AI call is accounted
  duration_ms int, status text, error_text text,
  created_at
)

quotation.ai_cache (
  cache_key text PK,                 -- hash of normalised request inputs
  tenant_id uuid,
  response_payload jsonb,
  hit_count int DEFAULT 0,
  created_at, expires_at
)

quotation.selection_events (
  id, tenant_id, quote_id, version_id,
  event_type text,                   -- 'option_viewed','option_compared','option_selected'
  payload jsonb, occurred_at timestamptz
)
quotation.comparison_snapshots (
  id, tenant_id, quote_id, version_id, snapshot jsonb, created_at
)

quotation.configuration (tenant_id PK, settings jsonb, updated_at)
```

**Engines move to `packages/quotation-engine/`** — pure TS, no DB access, consumed by both frontend (legacy/in-browser quoting) and `services/quotation-api/` (server-side validation + recompute).

---

## 4. RLS strategy

```sql
CREATE POLICY view_quotes ON quotation.quotes FOR SELECT USING (
  tenant_id = auth.jwt_tenant_id()
  AND core.has_module_access(tenant_id, 'quotation', 'read')
  AND (
    owner_user_id = auth.uid()
    OR auth.has_role(tenant_id, 'sales_team')
    OR EXISTS (
      SELECT 1 FROM sales.opportunities o
      WHERE o.id = quotation.quotes.opportunity_id AND o.owner_user_id = auth.uid()
    )
  )
);
```

**Portal access (anonymous via signed token):** A separate read path. The `/portal/quote/:token` route invokes a server function that:
1. Validates the token (lookup `core.portal_tokens`, check `revoked_at`, `expires_at`, IP-throttle).
2. Issues a short-lived signed-JWT scoped to the specific `quote_id` only.
3. Frontend uses that JWT to read **only the rows linked to this quote** via a `quotation.portal_view` view.

No anonymous reads through RLS — always via the signed-quote-JWT bridge. Documented as a security model decision in §9.

---

## 5. Events

### Published

| Event | When |
|---|---|
| `quotation.quote.draft` | Created |
| `quotation.quote.version_created` | New version snapshot |
| `quotation.quote.submitted_for_approval` | Approval required + sent to approver |
| `quotation.quote.approved` / `.rejected_internally` | Approver decision |
| `quotation.quote.sent` | Sent to customer (delivered through Comms) |
| `quotation.quote.viewed` | Customer opened portal link |
| `quotation.quote.option_selected` | Customer clicked an option |
| `quotation.quote.accepted` | Customer accepted — **key signal for Sales (opp→won) and Logistics (shipment draft)** |
| `quotation.quote.rejected` | Customer rejected |
| `quotation.quote.expired` | `valid_until` passed without decision |

### Subscribed

| Event | Consumer logic |
|---|---|
| `sales.opportunity.created` | Auto-draft an empty quote linked to the opp (optional, configured per tenant) |
| `logistics.rate.updated` | Mark drafts with stale rates as "needs refresh" |
| `compliance.screening.failed` (subject_type='quotation.quote') | Block sending; force re-screen |
| `core.party.merged` | Re-link quotes to merged-into party |

ACL location: `services/quotation-api/src/acl/{sales,logistics,compliance,core}.ts`.

---

## 6. UI surface

### 6.1 Routes (no change to user-facing URLs, just rename of code)

| Route | Old path | Notes |
|---|---|---|
| `/dashboard/quotes` | unchanged | Quote list |
| `/dashboard/quotes/pipeline` | unchanged | Kanban by status |
| `/dashboard/quotes/new` | unchanged | Create quote — invokes UnifiedQuoteComposer |
| `/dashboard/quotes/:id` | unchanged | Quote detail (with versions tab, comments, sharing) |
| `/dashboard/quotes/templates` | unchanged | Template library |
| `/dashboard/quotes/analytics` | unchanged | Quote analytics |
| `/dashboard/quotes/import-export` | unchanged | CSV import |
| `/dashboard/settings/quotations` | unchanged | Per-tenant config |
| `/dashboard/settings/quote-numbers` | unchanged | Sequence management |
| `/portal/quote/:token` | unchanged | **Public** quote portal (anonymous via signed token) |

### 6.2 The `UnifiedQuoteComposer.tsx` split (4,364 LOC)

Decomposition principle: by **zone**, not by step. The current file already has visual zones (header, form, charges, options, finalize). Each becomes a peer component holding its own state slice:

| New component | LOC target | Owns |
|---|---|---|
| `composer/UnifiedQuoteComposer.tsx` | ≤300 | Orchestrator only — owns the QuoteStore, layouts the zones |
| `composer/HeaderZone.tsx` | ≤400 | Customer + dates + currency |
| `composer/CargoZone.tsx` | ≤500 | Cargo input (today's `SharedCargoInput.tsx`, 689 LOC — already standalone) |
| `composer/RoutingZone.tsx` | ≤500 | Origin/destination + service selection; integrates `buildHybridRouteConfiguration` |
| `composer/ChargesZone.tsx` | ≤500 | Charges + breakdown (today's `ChargesManagementStep.tsx` 761 + `ChargeBreakdown.tsx` 821) |
| `composer/OptionsZone.tsx` | ≤500 | Multi-option compare (today's `QuoteOptionsOverview.tsx` 588 + `QuoteResultsList.tsx` 785) |
| `composer/AiAdvisorPanel.tsx` | ≤300 | The right-side panel that calls `useAiAdvisor` — already pulled out of context |
| `composer/FinalizeZone.tsx` | ≤300 | Approve, share, send (today's `FinalizeSection.tsx` 584) |
| `composer/store/QuoteStore.tsx` | ≤300 | Zustand store — keep, but document slices |
| `composer/store/types.ts` | ≤500 | Type definitions |

Total target after split: ~4,100 LOC across 10 files, **none over 500 LOC**. Same code, decomposed.

### 6.3 The `composer/` vs `unified-composer/` resolution

`unified-composer/` is the survivor. Migration:

1. Inventory test coverage of legacy `composer/` (14 files) — confirm features that ONLY live in legacy.
2. Port any missing features into `unified-composer/`.
3. Replace `composer/` imports with `unified-composer/` equivalents.
4. Delete `composer/` directory.

Track via a single PR that flips a `useUnifiedComposer` feature flag tenant-by-tenant.

---

## 7. LLM hooks (formalising what's already there + new)

Today's `useAiAdvisor({ action, payload })` becomes a stable contract. Actions:

| Action | What | Status |
|---|---|---|
| `extract_charges_from_text` | Parses unstructured pasted text into structured charges | Exists; formalize |
| `suggest_charges` | Given route + cargo, suggests typical charges | Exists; formalize |
| `suggest_route_optimisation` | LLM examines options, surfaces "this option misses a cheaper alliance partner" | New |
| `classify_inquiry` | Inbound RFQ text → structured intent (mode, urgency, special-handling) | New |
| `draft_cover_letter` | Generates the email body that accompanies the quote PDF | New |
| `summarise_changes` | Between versions, generates a "what changed" summary | New |
| `compare_quote_options` | When customer views portal, narrates trade-offs in plain language | New |
| `extract_competitor_quote` | OCR + structure → comparison input | New |
| `predict_acceptance` | Score 0–100 likelihood the customer accepts; surface in dashboards | New |

Every action goes through `packages/llm-client` (writes `core.llm_usage`) + writes a `quotation.ai_requests` row with FK to the usage row. The existing `ai_quote_cache` becomes `quotation.ai_cache` keyed on a hash of normalised inputs — cache-hit rate becomes observable via `core.llm_usage.cache_hit` flag.

---

## 8. Migration sequence

| Phase | What | Risk |
|---|---|---|
| 0 | Wait for `core.parties` + `core.files` + `core.audit_log` + `core.llm_usage`. | — |
| 1 | Create `quotation.*` schema + all tables. RLS + helpers. | Zero — additive. |
| 2 | Extract pricing engines into `packages/quotation-engine/`. Update imports in frontend. No behaviour change. | Low. |
| 3 | Backfill `quotation.versions`, `version_options`, `version_option_legs`, `packages`, `templates`, `configuration` from existing tables. | Medium — schema reshape; needs reconciliation. |
| 4 | Backfill `quotation.shares` from `quote_shares`; migrate `portal_tokens` to `core.portal_tokens`. | Medium — public portal must not break. |
| 5 | Migrate `quote_documents` rows: blobs to `core.files`, joins to `core.file_links`. | Medium — large data move. |
| 6 | Migrate audit tables: 5 source tables → `core.audit_log` (action mapping per source). | Medium — high write volume, needs partition strategy. |
| 7 | Migrate AI tables: `ai_quote_cache` → `quotation.ai_cache`; `ai_quote_requests` → `quotation.ai_requests` with new `llm_usage_id` FK (backfilled to null for historical rows, NOT NULL going forward). | Low — additive. |
| 8 | Build `services/quotation-api/` with routes for: quotes CRUD, version creation, AI-advisor dispatch (replaces direct browser-to-LLM), portal-token issuance + validation, approval workflow. | Medium — net-new service. |
| 9 | Cut over `useAiAdvisor` to call `services/quotation-api/` instead of direct Anthropic/OpenAI. Adds `core.llm_usage` accounting for the first time. | Medium — touches AI hot path. |
| 10 | Rename `src/components/sales/` → `src/components/quotation/`. Update all imports. | Medium — large rename; CI-supported. |
| 11 | Apply the `UnifiedQuoteComposer.tsx` zone-split per §6.2. | Low — incremental, well-tested. |
| 12 | Migrate legacy `composer/` features into `unified-composer/`; flip per-tenant flag; delete `composer/`. | Medium — feature parity verification. |
| 13 | Drop legacy `public.*` quote/quotation tables after 30-day no-direct-read window. | Low. |

---

## 9. Open decisions

1. **Portal token security model** — Documented in §4 (server-mediated signed-JWT bridge). Alternative: direct anonymous RLS with token-as-row-filter. **Recommend signed-JWT bridge** — cleaner audit trail, easier rate-limiting, no anonymous role in Postgres.
2. **Versioning model** — Today's snapshot-blob (`quotation.versions.snapshot_payload jsonb`) preserves full state cheaply but makes structured queries hard. Alternative: full child-table versioning. **Recommend snapshot-blob for v1** — matches today's pattern; if reporting needs structured access, build a CDC pipeline that explodes blobs into a `quotation.version_lines_flat` materialized view.
3. **Engine package boundary** — `packages/quotation-engine/` is pure TS today. Future C++/Rust port for performance? **Recommend not yet** — current perf is adequate; revisit if a tenant complains.
4. **AI dispatch path** — Today's `useAiAdvisor` likely hits a Supabase edge function or directly hits the LLM provider. **Recommend route through `services/quotation-api/`** (Node) which then uses `packages/llm-client`. Centralises usage accounting + rate limiting + audit.
5. **`quote_contacts_screening` ownership** — listed in compliance subdoc as a compliance entity. Confirm: Compliance owns the screening; Quotation only *requests* it via event + `compliance.screening.failed` subscription. The table itself lives in `compliance.*`.
6. **`quotation.selection_events` retention** — telemetry volume can grow large. **Recommend 90-day rolling retention** with summaries archived to `quotation.comparison_snapshots`.
7. **Approval workflow scope** — current `quote_approval_rules` is simple amount-threshold. Future: matrix approvals, discount-percentage tiers, custom rules. **Recommend ship the existing simple model first**, add DSL later.

---

## 10. Acceptance criteria

Done when:

- [ ] `quotation` schema exists with the ~16 tables from §3.
- [ ] Pricing engines live in `packages/quotation-engine/`; consumed by both frontend and `services/quotation-api/`.
- [ ] `services/quotation-api/` exists, hosts CRUD + AI dispatcher + portal-token endpoints; has tests including RLS denial cases.
- [ ] All AI calls write to `core.llm_usage` AND `quotation.ai_requests`; `quotation.ai_requests.llm_usage_id` is NOT NULL for new rows.
- [ ] `UnifiedQuoteComposer.tsx` no longer exists as a 4,364-LOC file; split into zone components, none over 500 LOC.
- [ ] `composer/` directory deleted; `unified-composer/` is the survivor (renamed `composer/` under `src/components/quotation/`).
- [ ] `/portal/quote/:token` works via the signed-JWT bridge; anonymous access load-tested at 100 RPS.
- [ ] `public.quote_*` and `public.quotation_*` tables dropped (except `portal_tokens` which moved to `core.portal_tokens`).
- [ ] At least 5 of §7 LLM actions wired (recommend: `extract_charges_from_text`, `suggest_charges`, `compare_quote_options`, `summarise_changes`, `predict_acceptance`).
- [ ] Cache-hit rate observable in `/admin/llm-providers` dashboard.

---
