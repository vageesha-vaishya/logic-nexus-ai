# Platform Modules — Audit & Target Design

**Date:** 2026-05-28
**Status:** §1 + §1B + §2 draft — under review
**Scope:** Audit and redesign of nine business modules — **CRM, Sales, Quotation, Logistics, Finance, Compliance, Comms, AMRO, UIM** — plus a shared **Core** layer. Defines the platform-wide module contract every domain must follow; per-module audit + redesign detail lives in `docs/plans/2026-05-28-modules/<module>.md`.

---

## §1 — Current-state audit (evidence-only)

Every finding below cites a file path, line number, table name, or migration timestamp. No opinions in this section; gaps and recommendations are deferred to §2–§7.

### 1.1 Architectural asymmetry: 30+ frontend pages, 3 backend routes

The CRM + Logistics frontend has **27 routed pages** (`src/App.tsx:474–1144`) covering Accounts, Contacts, Leads, Activities, Opportunities, Campaigns, Shipments, Carriers, Logistics Manager. The CRM API has **3 route files** (`services/crm-api/src/routes/`): `leads.routes.ts` (6 endpoints), `invoices.routes.ts` (1 endpoint), `tax.routes.ts` (2 endpoints).

**No backend route exists for:** accounts, contacts, opportunities, activities, shipments, carriers, campaigns. These pages query Supabase directly through RLS. The "service tier" is mostly fiction; the de facto API is Postgres + RLS.

### 1.2 God components (>500 LOC)

Six CRM components carry the bulk of the domain logic:

| Component | LOC | Path |
|---|---|---|
| `LeadWorkspaceSections.tsx` | 1,570 | `src/components/crm/` |
| `LeadForm.tsx` | 997 | `src/components/crm/` |
| `LeadConversionDialog.tsx` | 735 | `src/components/crm/conversion/` |
| `UnifiedPartnerForm.tsx` | 702 | `src/components/crm/` |
| `LeadActivitiesTimeline.tsx` | 668 | `src/components/crm/` |
| `ActivityForm.tsx` | 552 | `src/components/crm/` |

Lead-domain components dominate. Accounts/Contacts/Opportunities sit at 350–500 LOC each — closer to manageable.

### 1.3 Legacy duplicates still routed

`src/pages/dashboard/AccountDetailLegacy.tsx` and `ContactDetailLegacy.tsx` exist alongside their non-Legacy successors. Both are imported in `src/App.tsx`. No migration plan, no deprecation comment, no removal date.

### 1.4 Dead / unreferenced DB infrastructure

- **Lead scoring stack** — `lead_scoring_rules` (mig `20251001052621`), `lead_score_logs` (mig `20260104000000`), `lead_score_config` (mig `20260107063859`). No consumer code performs `INSERT`/`UPDATE`. `src/components/crm/LeadScoringCard.tsx` contains the comment *"lead_score_config table doesn't exist"* — code was written before the table was added.
- **`vendor_portal_activity`** (mig `20260204000001`) — created, never read from `src/` or `services/`.
- **`campaigns` table** — Campaigns page exists at `src/pages/dashboard/Campaigns.tsx` (route in App.tsx:1085); **no `CREATE TABLE campaigns` in `supabase/migrations/`**. Page reads/writes against missing infrastructure or unused tables.
- **`channel_accounts`** — three policy-correction migrations (`20260217090000`, `20260218160000`, `20260218160100`). Schema churn indicates uncertain ownership.

### 1.5 LLM / AI presence

**Zero AI wiring** in `src/components/crm/`, `src/features/module-crm/`, or `src/features/module-logistics/`. No `anthropic`/`openai`/`claude`/`gpt`/`pgvector`/`embeddings` imports. All LLM infrastructure (`src/features/markets/hooks/useLlmConfigs.ts`, `MarketsLlmSettings` page) lives in the Markets domain and is unreachable from CRM/Logistics today.

### 1.6 Test coverage

- CRM frontend: **5 test files** — `LeadForm.test.ts`, `LeadForm.layout.test.tsx`, `LeadWorkspaceSections.test.tsx`, `CRMModuleHeaderNavigation.test.tsx`, plus widget smoke tests. **No tests for Accounts, Contacts, Opportunities, Activities, Campaigns.**
- Logistics frontend: **1 test file** — `logisticsWorkspaceModel.test.ts`.
- Backend: 21 test files under `services/crm-api/tests/`, all targeting leads, invoices, or tax routes.

### 1.7 RLS gaps

Tables created without RLS-enable statements:
- `lead_score_logs` (mig `20260104000000` + `20260107063859`)
- `lead_score_config` (mig `20260107063859`)

These tables are dead today (§1.4), so the gap is latent — but they would leak across tenants the moment any code writes to them.

### 1.8 Module-system status

Phase 0 module stubs exist (`src/features/module-crm/manifest.ts`, `src/features/module-logistics/manifest.ts`) but **all CRM and Logistics routes are still hard-coded in `src/App.tsx`**, not registered through the manifest. The module system is unused for these two domains.

---

**Findings rolled up (no recommendations yet — those land in §2–§7):**

1. The "backend service" pattern is half-built — leads only. Everything else is frontend-to-Supabase.
2. Lead-domain code is 4–6× the size of adjacent entities — a refactoring target, not necessarily a bug.
3. Two routed Legacy pages, with no removal plan.
4. ~5 tables exist as dead schema (3 lead-scoring, vendor_portal_activity, ambiguous channel_accounts).
5. Campaigns page has no DB backing.
6. CRM + Logistics have zero LLM integration despite domain-wide AI infrastructure.
7. Test coverage for 6 of 7 CRM entity surfaces is absent; Logistics has 1 test.
8. Two tables lack RLS; module manifest system is unused.

---

## §1B — Expanded-scope audit (Sales, Quotation, Finance, Compliance, Comms, AMRO, UIM)

Adding the seven domains the original audit treated as "forward-compatibility" entries. Same evidence-only standard.

### 1B.0 Quantitative reset

- **925 migrations** in `supabase/migrations/`.
- **516 distinct tables**, distributed by schema:

| Schema | Tables | Notes |
|---|---|---|
| `public` | 374 | Everything not migrated yet — ~72% of the database |
| `markets` | 61 | Fully migrated; the template for what we want |
| `platform` | 16 | New; holds audit_log, feature_flags, integration_*, llm_provider_configs, llm_usage |
| `flypal` | 5 | AMRO-related vendor data |
| `mro_audit` | 2 | AMRO audit trails |
| `crm` | 1 | Just `crm.tag` — token effort |
| `logistics` | 1 | Just `logistics.quote_items_extension` — token effort |

`markets.*` and `platform.*` are the only schemas where the contract from §2 is already realised. CRM/Sales/Quotation/Logistics/Finance/Compliance/Comms/AMRO/UIM all live in `public`.

### 1B.1 Sales (NEW — §1 missed this entirely)

**Headline:** `src/components/sales/` is a larger surface than `src/components/crm/`. It hosts the Quotation builder, not Sales pipeline. The naming is misleading.

- 13 sub-dirs: `unified-composer/`, `composer/`, `quote-form/`, `quotation-versions/`, `templates/`, `kanban/`, `analytics/`, `history/`, `portal/`, `modals/`, `shared/`, `common/`, `__tests__/`.
- **`UnifiedQuoteComposer.tsx` is 4,364 LOC** (`src/components/sales/unified-composer/`). The largest single file in the audit. Has 30 colocated test files in `__tests__/`.
- **Duplicate composers**: `composer/` (legacy) coexists with `unified-composer/` (current). 14 tests in old composer still maintained. Migration in flight, no completion date.
- Routes: `/dashboard/quotes`, `/quotes/pipeline`, `/quotes/templates`, `/quotes/analytics`, `/quotes/import-export`, `/quotes/new`, `/quotes/:id` (`src/App.tsx:847–895`). Plus public portal `/portal/quote/:token` (App.tsx:1063).
- Quotation services: `src/services/quotation/` with `mgl/engine.ts` (506 LOC), `mgl/routing-engine.ts` (570 LOC), `hybrid-route-configuration.ts` (567 LOC). 7 colocated tests.

### 1B.2 Quotation (overlaps Sales — needs disentangling)

- The "Quotation" name appears on tables (`quotation_*` × 10+), the active module (`src/features/module-quotation/`), and the settings page (`/dashboard/settings/quotations` App.tsx:1007). But the UI lives in `src/components/sales/`. The Sales/Quotation boundary is **ambiguous in code**.
- Quotation-specific tables: `ai_quote_cache`, `ai_quote_requests` (read evidence in `src/hooks/useRateFetching.ts:789` and `src/components/sales/shared/QuickQuoteHistory.tsx:43`). `quote_documents`, `quote_templates`, `quote_shares`, `quote_audits`, `quote_email_history`, `quote_access_logs`, `quote_presentation_templates`, `quote_comments`, `quotation_audit_log`, `quotation_version_audit_logs`.
- **AI is already in production here** — `useAiAdvisor` is consumed by `ChargesManagementStep.tsx:14` and `QuoteDetailsStep.tsx:6`. §1's "zero LLM in CRM/Logistics" was wrong; it's zero in CRM but live in Quotation.

### 1B.3 Finance

- Routes: `/dashboard/finance/invoices`, `/finance/margin-rules`, `/finance/tax-jurisdictions`, `/finance/tax-jurisdictions/:id` (App.tsx:1102–1106). Plus `/dashboard/billing/invoices/:id` (App.tsx:1154) and `/dashboard/settings/billing` (App.tsx:661) — **two finance entry points** with overlapping concepts.
- Tables: `invoices`, `invoice_line_items`, `payments`, `billing_invoices`, `billing_payments`, `subscription_invoices`, `payment_webhook_events`, `tax_definitions`. **Duplicate concepts**: `invoices` vs `billing_invoices`, `payments` vs `billing_payments` — needs reconciliation.
- Backend: `services/crm-api/src/routes/invoices.routes.ts` + `tax.routes.ts` + `GLPosterService.ts` + `billing.engine.test.ts`. There is no dedicated `services/finance-api/` yet.

### 1B.4 Compliance

- Route: `/dashboard/restricted-party-screening` (App.tsx:1148). Plus screening hooks in `src/components/compliance/ScreeningButton.tsx`.
- Tables (platform-level): `compliance_checks`, `compliance_domain_verifications`, `compliance_obligations`, `compliance_records`, `compliance_rules`, `compliance_screenings`, `quote_contacts_screening`.
- **AMRO has parallel compliance tables**: `amro_compliance_ad_sb_registry`, `amro_compliance_documents`, `amro_compliance_events`, `amro_compliance_requirements_enhanced`, `amro_compliance_directives`, `amro_work_order_compliance_records` — **6 tables that duplicate the compliance concept inside AMRO's namespace**. Either AMRO compliance is genuinely distinct (aviation airworthiness directives vs generic sanctions) — in which case `amro.*` keeps them — or there's redundancy.

### 1B.5 Comms

- Routes: `/dashboard/communications-hub` (App.tsx:951), `/dashboard/settings/channel-integrations` (App.tsx:959).
- Tables: `channel_accounts` (3 policy-correction migrations, noted in §1.4), `email_accounts`, `email_account_delegations`, `email_audit_log`, `email_filters`, `email_sync_logs`, `email_templates`, `email_tracking_events`, `message_attachments`, `notifications` (top-level), `vendor_notifications`, `markets.notifications` (separate). **Notifications fragmented across three locations.**
- `quote_email_history` lives alongside Quotation tables but is operationally a Comms artifact — boundary unclear.

### 1B.6 AMRO

- **30+ routes** under `/dashboard/amro/*` (App.tsx:1157–1184), all gated by `requiredDomainCode="AMRO"` (a domain-code mechanism already exists in the route system — relevant for §2).
- **52 AMRO tables** in `public.*` (plus `flypal.*` 5 + `mro_audit.*` 2). Sub-areas visible: aircraft, work_orders, parts, MPD, directives, tooling, stock, calibration, AOG alerts, audit, intelligence.
- Largest concentration of data in the platform. **The audit dir `mro_audit` is the only example of an audit-specific schema** — pattern worth generalising.
- Backend: `services/amro-api/` is the most-developed service (14 backend tests vs CRM's 5). Plus tests under `src/pages/api/v2/amro/` (32 files) and `src/features/module-amro/components/parts/` (7 files).
- **Backup table in prod**: `public.aircraft_legacy_backup` — leftover from a migration.

### 1B.7 UIM

- **Backend is a 2-file stub** (`services/uim-api/src/app.ts`, `index.ts`) — no routes, no logic.
- **But the DB tables exist heavily**: `uim_inventory_items`, `uim_inventory_categories`, `uim_inventory_locations`, `uim_inventory_ledger`, `uim_inventory_commands`, `uim_inventory_reservations`, `uim_inventory_suppliers`, `uim_inventory_projection_snapshots`, `uim_inventory_scan_events` (AMRO-prefixed), `uim_form_records`, `uim_catalog_items`, `uim_amro_sync_jobs`, `uim_amro_sync_audit`, `amro_uim_inventory_sync_events`. 15+ tables.
- Plus `platform.integration_credentials`, `platform.integration_dlq`, `platform.integration_log`, `platform.webhook_subscriptions` (newer, cleaner namespace) — and legacy `integration_jobs`, `integration_mappings` in `public.*` (the integration concept is split across three locations).
- **Diagnosis**: data layer is rich; service layer is hollow. UIM is currently operated entirely through Supabase + AMRO ingestion code.

### 1B.8 Cross-cutting concerns surfaced by the expanded scope

1. **Audit-log fragmentation** — `audit_log`, `audit_logs`, `quotation_audit_log`, `quotation_version_audit_logs`, `quote_audits`, `amro_work_order_audit_log`, `ai_audit_logs`, `email_audit_log`, `mro_audit.records`, `mro_audit.trails`, `platform.audit_log`, `platform.access_log`, `admin_override_audit`, `uim_amro_sync_audit`. **14+ audit tables** with no unified contract. Candidate for `core.audit_log` + per-module specialization tables.

2. **Notification fragmentation** — `notifications`, `vendor_notifications`, `markets.notifications`, plus push tokens, alerts, banners. Candidate for `core.notifications` with polymorphic subject.

3. **Attachment fragmentation** — `attachment_events`, `attachment_links`, `attachment_versions`, `shipment_attachments`, `amro_compliance_documents`, `quote_documents`, `carrier_rate_attachments`, `message_attachments`. Candidate for `core.files` + polymorphic `core.file_links`.

4. **Duplicate concepts in `public.*`** (same name, different positions): `auth_permissions`, `auth_role_permissions`, `auth_roles` (with `crm.tag`-style outliers), `lead_activities`, `lead_score_config`, `lead_score_logs`, `notifications`, `entity_transfers`, `quote_documents`, `quote_templates`, `container_sizes`, `container_types`, `user_preferences`, `fx_rates`.

5. **AI accounting is half-built** — `platform.llm_provider_configs`, `platform.llm_usage`, monthly partitions `platform.llm_usage_y2026m04..06` exist. CRM/Sales/Quotation use AI without obvious wiring into this accounting. Need to verify every AI call writes to `platform.llm_usage`.

6. **Domain-code system already exists** — App.tsx routes use `requiredDomainCode="AMRO"`. There's already a `platform_domains`, `domain_config`, `domain_metadata`, `domain_relationships` infrastructure. The §2 contract should adopt this rather than invent a parallel concept.

---

## §2 — Target architecture (platform-wide module contract)

The pattern defined here is **not specific to CRM + Logistics**. It is the contract every domain module on this platform must follow — present and future. The ten business modules in §2.6 are the first to fully adopt it; new modules added later inherit it by default.

### 2.1 The Module Contract

Every module is a **bounded context** and must:

| # | Requirement | Enforcement |
|---|---|---|
| 1 | Own a dedicated Postgres schema (`<module>.*`) | Migration lint rule |
| 2 | Reference shared identity only via `core.*` (no cross-module FKs) | Migration lint rule |
| 3 | Publish domain events through the platform event bus | Event registry |
| 4 | Subscribe to other modules only via an **anti-corruption layer** (ACL) | Code review |
| 5 | Register routes, navigation, and permissions via `manifest.ts` | Boot-time validation |
| 6 | Expose a backend service (or share `platform-api`) — never let the frontend hit foreign schemas directly | RLS policy + lint |
| 7 | Maintain its own test suite + RLS policy tests | CI gate |

Rule (2) is the load-bearing one: **no foreign keys across module schemas**. The only allowed cross-schema FK is `<module>.* → core.*`. Cross-module joins are forbidden; cross-module reads go through read models built from events.

### 2.2 Schema overview

§2.6 is the canonical list of the ten business modules and their owned tables. Per-module subdocs under `docs/plans/2026-05-28-modules/` carry the full table-level detail. This section states only the two anchor invariants:

1. **`core.*` owns identity and shared primitives.** Every other schema FKs into it. No module owns `core`.
2. **Inter-module data is opaque.** When module A needs to remember something about module B, it stores a denormalized opaque id (e.g., `logistics.shipments.source_opportunity_ref`) populated by event subscription. It is **never** a FK to module B's table.

### 2.3 RLS strategy

Three layers, applied to every table in every schema:

1. **Tenant isolation** — `tenant_id = auth.jwt_tenant_id()`. Hard fail otherwise.
2. **Module access** — user must have `<module>:read` (or `:write`) permission, resolved through `core.memberships → core.roles → core.permissions`. A user can be in CRM without being in Logistics.
3. **Role/ownership** — entity-specific (owner, assignee, team membership).

A single helper `core.has_module_access(tenant_id, module_name, action)` is used by every module's policies. RLS becomes consistent and auditable.

### 2.4 Event bus + transactional outbox

- **Outbox table** in `core.outbox` — every state change writes (entity update + event row) in the same transaction. A poller (today's `services/crm-api/src/events/` is the template) ships events to Kafka.
- **Event envelope** is uniform and matches `core.outbox` row columns 1:1:
  ```
  { id, tenant_id, module, event_type, entity_type, entity_id, occurred_at, version, payload }
  ```
- **Topics** named `<module>.<entity>.<event>` — e.g., `sales.opportunity.won`, `logistics.shipment.delivered`.
- **Schema registry** — JSON Schema per event, versioned, lives in `packages/event-contracts/` (new).
- **`subject_type` and polymorphic refs** — wherever a row points at something in another module (audit, notifications, files, activities), the value is the **schema-qualified, singular, lowercase** entity name: `'core.party'`, `'sales.lead'`, `'quotation.quote'`, `'logistics.shipment'`, `'amro.work_order'`. This is the canonical convention; no module deviates.

### 2.5 Anti-corruption layer (ACL)

When Logistics subscribes to `sales.opportunity.won`, the ACL is a small module (`services/logistics-api/src/acl/sales.ts`) that:
1. Validates payload against the schema-registry contract.
2. Translates Sales vocabulary → Logistics vocabulary (`opportunity_id` → `source_opportunity_ref`).
3. Inserts a **read model** row in `logistics.*` (e.g., a draft shipment) — never queries `sales.*` directly.

If Sales renames `opportunity_id` to `deal_id` tomorrow, only the ACL changes. Logistics core code is insulated.

### 2.6 The ten business modules (all in scope, all concrete)

Each row is a **bounded context** as defined in §2.1. Markets is included even though `markets.*` is already migrated — auditing it ensures the contract holds end-to-end and surfaces any latent gaps before they become production surprises.

| Schema | Module | Owns | Key subscribes |
|---|---|---|---|
| `core` | Platform Core | parties, addresses, tags, files, audit, outbox, tenants, users, llm_provider_configs, llm_usage | — |
| `crm` | CRM | account_extensions, contact_extensions, activities, campaigns, segments | `sales.lead.created` (enrich), `logistics.shipment.exception` (alert) |
| `sales` | Sales | leads, lead_scoring, lead_assignments, opportunities, pipelines, stages, forecasts, targets, commissions | `comms.email.received` (lead capture), `crm.activity.logged` |
| `quotation` | Quotation | quotations, versions, options, legs, pricing_rules, approval_workflows, ai_quote_cache, ai_quote_requests | `sales.opportunity.created`, `logistics.rate.updated` |
| `logistics` | Logistics | shipments, bookings, carriers, lanes, milestones, customs_clearance, vendor_portal | `sales.opportunity.won`, `quotation.quote.accepted` |
| `finance` | Finance | invoices, payments, gl_entries, taxes, dunning, refunds | `quotation.quote.accepted`, `logistics.shipment.delivered` |
| `compliance` | Compliance | sanctions_screenings, kyc_checks, denied_party_hits, audit_decisions | `sales.lead.created`, `logistics.booking.created`, `quotation.quote.draft` |
| `comms` | Communications | inboxes, threads, messages, channel_accounts, email_accounts, templates, push_tokens | reads `core.notifications` (intent → delivery); subscribes to all `*.exception` / `*.alert.fired` events |
| `amro` | AMRO | aircraft, work_orders, mpd, directives, parts, tooling, stock_ledger, calibration | `logistics.shipment.delivered` (parts arrival) |
| `uim` | UIM (integration spine) | integration_credentials, integration_log, webhook_subscriptions, sync_jobs, dlq, connector_configs | subscribes to every module's events the tenant has configured for outbound sync to external systems |
| `markets` | Markets | portfolios, holdings, orders, llm_configs, price_history (yearly-partitioned), watchlists, ideas, broker_connections | `comms.notification.scheduled` (alerts), `core.user.created` (retail onboarding) |

**Significant boundary moves from current state:**

- **Sales is its own module**, distinct from CRM. Today's `src/components/crm/Lead*` and lead-scoring tables move to `sales.*`. Today's `src/components/sales/*` (which is actually quotation builder) moves to `quotation.*`. The current naming is reversed.
- **Quotation is its own module**, not merged into CRM. §1's proposal to fold it into `crm.*` is **rejected** by the expanded audit — quotation has 10+ specialised tables, an AI pipeline (`ai_quote_*`), pricing engines (570-LOC routing-engine), version/audit infrastructure. It earns module status.
- **UIM is promoted from "stub" to first-class**: the platform's integration spine. All cross-system sync goes through UIM. Today's `platform.integration_*` tables move into `uim.*`; the `platform.*` schema retains only truly platform-wide primitives.
- **AMRO compliance stays inside `amro.*`** (aviation airworthiness is genuinely distinct from sanctions screening). But the `amro_compliance_documents` table moves to use `core.files` for storage, with `amro.compliance_document_links` as a thin link table.

### 2.7 Cross-cutting concerns to centralise (informed by §1B.8)

Six concepts are fragmented today and must be unified before per-module schemas can land:

1. **`core.audit_log`** — replaces 14+ audit tables. Polymorphic `subject_type + subject_id + tenant_id + actor_id + action + payload`. Per-module audit specialisations are *views* over this table filtered by `subject_type`. Mandatory for compliance.
2. **`core.notifications`** — replaces 3 notification tables. Polymorphic recipient (user/team/role), polymorphic subject, channel (in-app/email/sms/push), delivery state. Comms module owns the *delivery*; core owns the *intent*.
3. **`core.files` + `core.file_links`** — replaces 8+ attachment tables. Storage-backend-agnostic blob registry + polymorphic link table. Every "attach a file" becomes one row in `file_links`.
4. **`core.outbox`** — every module's state-change events are written here in the same transaction as the entity update. Per-service pollers ship to Kafka. Replaces today's fire-from-app-code pattern. Schema matches the envelope in §2.4.
5. **`core.llm_usage` + `core.llm_provider_configs`** — already exist at `platform.llm_usage` / `platform.llm_provider_configs`. Move into `core` and enforce: **no module-level AI call may bypass `packages/llm-client`**. CI lint forbids direct `@anthropic-ai/sdk` / `openai` imports outside this package.
6. **`core.domains`** — the existing `platform_domains` + `domain_config` + `domain_metadata` + `domain_relationships` system (used by `requiredDomainCode="AMRO"` in App.tsx:1158) is the basis of `core.has_module_access()`. Don't reinvent.

### 2.8 What this means for the existing codebase

- `src/integrations/supabase/types.ts` is regenerated **per schema**; types live in `packages/db-types-<module>`.
- `src/features/module-*` manifests become **load-bearing**, not stubs — App.tsx no longer hard-codes routes for any of the ten modules.
- A new package `packages/event-contracts/` holds the cross-module event JSON Schemas, versioned.
- A new package `packages/llm-client` is the sole legal entry point to Anthropic/OpenAI/etc. CI lint enforces.
- The misleading `src/components/sales/` directory is renamed `src/components/quotation/`. A new `src/components/sales/` is created for actual sales-pipeline UI (leads, opportunities, forecasts).
- The `composer/` vs `unified-composer/` duplicate is resolved as part of the Quotation module redesign — `unified-composer/` is the survivor.

**Services inventory — what exists vs what to build:**

| Module | Service today | Action |
|---|---|---|
| `core` | — | Build `services/platform-api/` (or fold into existing service shell) |
| `crm` | `services/crm-api/` (currently leads/invoices/tax) | Strip down to CRM only — leads, invoices, tax move out |
| `sales` | — (logic lives in crm-api/leads + frontend) | Build `services/sales-api/` |
| `quotation` | — (logic lives in frontend) | Build `services/quotation-api/` |
| `logistics` | — | Build `services/logistics-api/` |
| `finance` | partial in `services/crm-api/` (invoices, tax, GLPoster, billing.engine) | Extract into `services/finance-api/` |
| `compliance` | — (frontend only) | Build `services/compliance-api/` |
| `comms` | — | Build `services/comms-api/` (also hosts the `core.notifications` → delivery poller) |
| `amro` | `services/amro-api/` (most-developed) | Conform to contract; add outbox poller |
| `uim` | `services/uim-api/` (2-file stub) | **Flesh out** — promote to first-class; absorb `platform.integration_*` |
| `markets` | `services/markets-worker/` (Python) | Add outbox poller; rest already at-spec |

Each `services/<module>-api/` ships its own ACL directory and outbox poller; today's `services/crm-api/src/events/` is the template.

**Fate of `platform.*` schema:** After lifts to `core.*` (audit_log, llm_*, idempotency_keys, feature_flags, domains) and `uim.*` (integration_credentials, integration_log, integration_dlq, webhook_subscriptions), **the `platform.*` schema is dropped**. There is no "platform vs core" distinction in the target state — `core` is the substrate.

Per-module audit + redesign detail lives in `docs/plans/2026-05-28-modules/<module>.md`. This master doc keeps the platform-wide contract, cross-module workflows, LLM playbook, and migration plan.

---

## §5 — Cross-module workflows & event contracts

This section threads the per-module events (defined in each subdoc's §5) into concrete **end-to-end lifecycle flows**. The audience is implementers — who needs to publish what, who subscribes, what happens when steps fail, where idempotency keys live.

### 5.1 Event envelope (the universal contract)

Every event on every Kafka topic has the same envelope. Producers must emit it; consumers must validate it. JSON Schemas live in `packages/event-contracts/` per `<module>.<entity>.<event>.v<N>.json`.

```jsonc
{
  "id":           "01HG7K2P9XQM8YN3RZBF4VD6TW",   // ULID, globally unique
  "tenant_id":    "uuid",
  "module":       "sales",
  "entity_type":  "opportunity",
  "event_type":   "won",
  "entity_id":    "uuid",
  "occurred_at":  "2026-05-28T14:23:10.123Z",
  "version":      1,                                // event-schema version
  "payload": {
    /* event-specific fields */
  },
  "metadata": {
    "actor_user_id":      "uuid|null",
    "actor_kind":         "user|service|integration",
    "correlation_id":     "ULID — propagates across the whole saga",
    "causation_id":       "ULID of the immediately-upstream event"
  }
}
```

**Topic naming**: `<module>.<entity_type>.<event_type>` — e.g. `sales.opportunity.won`, `logistics.shipment.delivered`, `compliance.screening.failed`.

**Versioning rule**: additive changes don't bump version (consumers ignore unknown fields). Renames or removals bump `version`; both old and new schemas live in the registry for a deprecation window.

### 5.2 Idempotency

Every ACL writes the inbound `event.id` to `core.idempotency_keys` *before* processing. If the key exists, the event is dropped. Kafka at-least-once delivery + this idempotency table = exactly-once effects.

```sql
core.idempotency_keys (
  key text PK,                    -- '<consumer_module>:<event.id>'
  tenant_id uuid, recorded_at timestamptz,
  result_summary jsonb            -- optional: what the consumer did, for debugging
)
```

### 5.3 The commercial lifecycle (the spine workflow)

This is the platform's revenue-generating flow. It crosses **8 modules**.

```
comms.email.received                                  [Comms inbound]
     ↓ ACL: sales.acl.comms
sales.lead.created                                    [Sales]
     ↓ ACL: compliance.acl.sales      (screening)
compliance.screening.requested
     ↓ provider call
compliance.screening.{passed|flagged|failed}          [Compliance]
     ↓ (if not failed) sales-side continues
sales.lead.scored → sales.lead.qualified              [Sales]
     ↓ user action: convert
sales.lead.converted                                  [Sales]
     ↓ payload includes new core.parties.id
core.party.created                                    [Core, via sales.convertLead transaction]
     ↓ ACL: crm.acl.core
crm.account_extension.created                         [CRM]
     ↓ user action: create opp
sales.opportunity.created                             [Sales]
     ↓ ACL: quotation.acl.sales         (optional: auto-draft quote)
quotation.quote.draft                                 [Quotation]
     ↓ user builds quote (AI advisor calls log to core.llm_usage)
quotation.quote.submitted_for_approval ↘
quotation.quote.approved                              [Quotation]
     ↓ ACL: compliance.acl.quotation    (party screening, export-control)
compliance.screening.requested → .passed
     ↓ ACL: comms.acl.quotation         (compose outbound)
quotation.quote.sent → comms.message.sent             [Quotation → Comms]
     ↓ customer opens portal
quotation.quote.viewed → quotation.quote.option_selected
     ↓ customer accepts
quotation.quote.accepted                              [Quotation]
     ↓ ACL: sales.acl.quotation         (close opp)
sales.opportunity.won                                 [Sales]
     ↓ ACL: logistics.acl.sales         (draft booking + shipment)
logistics.booking.created → logistics.shipment.created [Logistics]
     ↓ ACL: finance.acl.sales           (commission compute)
finance.commission.computed                           [Finance]
     ↓ ops timeline
logistics.shipment.milestone_recorded × N
logistics.shipment.delivered                          [Logistics]
     ↓ ACL: finance.acl.logistics       (invoice draft)
finance.invoice.drafted → finance.invoice.finalized   [Finance]
     ↓ ACL: comms.acl.finance           (send invoice)
finance.invoice.sent                                  [Finance → Comms]
     ↓ customer pays
finance.payment.received → finance.invoice.paid       [Finance]
     ↓ ACL: crm.acl.finance + sales.acl.finance       (lifecycle_stage='customer')
crm.account_extension.lifecycle_stage_changed
```

**Modules involved in one revenue cycle**: Comms, Sales, Compliance, Core, CRM, Quotation, Logistics, Finance — eight of the ten business modules. Plus UIM if outbound sync is configured, plus Markets if the customer also uses retail features.

### 5.4 The AMRO parts-demand workflow

A second spine — independent of the commercial lifecycle. Crosses **5 modules**.

```
amro.work_order.created                               [AMRO]
     ↓ scheduling
amro.work_order.scheduled
     ↓ part-list expansion (LLM-assisted per AMRO §7.2)
amro.work_order.parts_required                        [AMRO]
     ↓ ACL: uim.acl.amro
uim.stock.reservation_made                            [UIM inventory]
     ↓ if low stock:
uim.stock.low_inventory                               [UIM]
     ↓ ACL: amro.acl.uim
amro.inventory.reorder_queued
     ↓ purchasing creates PO
amro.purchase_order.placed
     ↓ ACL: comms.acl.amro                            (send PO to supplier)
comms.message.sent (channel='email', recipient=supplier_party)
     ↓ external: supplier ships
[carrier integrations via UIM connectors]
logistics.shipment.created (mode='parts_inbound')     [Logistics]
     ↓ ops timeline
logistics.shipment.delivered                          [Logistics]
     ↓ ACL: uim.acl.logistics
uim.stock.movement_recorded (kind='receipt')          [UIM]
     ↓ ACL: amro.acl.uim
amro.work_order.parts_available
     ↓ tech consumes parts
amro.work_order.parts_consumed
     ↓ ACL: uim.acl.amro
uim.stock.movement_recorded (kind='issue')            [UIM]
     ↓ WO completion
amro.work_order.completed → amro.certificate.issued   [AMRO]
```

**Modules involved**: AMRO, UIM, Comms, Logistics. Compliance can gate at multiple points (parts-supplier sanctions, export control on AOG parts).

### 5.5 The notification fan-out flow

Every workflow above triggers user-facing notifications. The path is uniform:

```
<any module>.<entity>.<event>                         [originating module]
     ↓ originating module writes to core.outbox + core.notifications (in same tx)
core.notifications insert event                       [Core]
     ↓ poller consumes
comms-api/services/notification-dispatcher           [Comms]
     ↓ resolves: per-recipient channel preferences, suppressions, batching rules
comms.deliveries × {1..N channels per recipient}      [Comms]
     ↓ outbound worker
comms.email.sent | comms.message.sent | push delivered [Comms]
     ↓ tracking
comms.email.{delivered|opened|clicked|bounced}
```

**Important**: the originating module does **not** decide channels. It writes a `core.notifications` row with `intent_kind`, `subject_type`, `subject_id`, `recipient_user_id`, and `payload`. Comms decides whether that becomes email + push + in-app or just an in-app digest entry — based on user preferences, channel-account health, and tenant DND policy.

### 5.6 The external-sync fan-out flow

Every event the tenant has configured a webhook for goes outbound through UIM.

```
<any module>.<entity>.<event> on Kafka                [originating module]
     ↓
uim-api/services/webhook-router                       [UIM]
     ↓ matches uim.webhook_subscriptions where event_filter contains topic
uim.webhook_outbox insert × N (one per matching subscription)
     ↓ outbound worker, exponential backoff
HTTP POST to external system
     ↓ on success
uim.webhook.delivered
     ↓ on failure (after max retries)
uim.integration_dlq insert → uim.dlq.message_added
     ↓ tenant_admin reviews + retries
```

**Important**: UIM never reads source-of-truth tables directly. It reads only Kafka events. Same ACL discipline as every other consumer.

### 5.7 The compliance gating flow

Compliance is **the only module that can block** other modules' state transitions. The mechanism:

```
<initiating module>.<entity>.<state-change-event>     [e.g., quotation.quote.send-requested]
     ↓ ACL: compliance.acl.<module>
compliance.screening.requested
     ↓ provider/internal screening (sync for high-risk, async for low-risk)
compliance.screening.{passed|flagged|failed}
     ↓ ACL: <initiating module>.acl.compliance
[if failed] <initiating module> aborts the action, records denial in audit_log
[if flagged] <initiating module> waits for human override
[if passed] <initiating module> proceeds with state transition
```

This is the **only saga-style two-phase pattern in the platform**. All other flows are pipelines. Implementation per module: the initiating side never commits the "send" / "create" / "release" state until it receives a passing screening. State table tracks `pending_compliance` interim status.

### 5.8 Idempotency, retries, and failure recovery

| Failure mode | Handling |
|---|---|
| Producer crashes between DB commit and event publish | Impossible — outbox-pattern guarantees same-transaction write |
| Consumer crashes during ACL processing | Kafka redelivers; `core.idempotency_keys` ensures dedup |
| Consumer ACL throws an unrecoverable error | Event goes to module's local DLQ table; alert via `core.notifications` to tenant-admin |
| Schema-registry validation fails | Event goes to `uim.integration_dlq` (treated as malformed external input) |
| Cross-module event chain stalls (e.g., compliance never responds) | Saga state table per initiating module tracks `pending_*` rows; reconciliation job sweeps every 5 minutes and re-enqueues |
| Network partition between services | Standard Kafka delivery semantics — at-least-once until network heals |

### 5.9 The correlation_id pattern

Every event's `metadata.correlation_id` is set to the **root event's ULID**. For inbound-email-to-paid-invoice, the correlation_id is the `comms.email.received` event's id, propagated through every downstream event. This makes saga tracing trivial:

```sql
SELECT * FROM core.outbox
WHERE metadata->>'correlation_id' = '01HG7K2P9XQM8YN3RZBF4VD6TW'
ORDER BY occurred_at;
```

Returns every event in the lifecycle, end to end.

### 5.10 What every ACL must do

Every `services/<module>-api/src/acl/<source-module>.ts` consumer follows the same five-step recipe. This is non-negotiable:

1. **Validate** payload against `packages/event-contracts/<topic>.v<N>.json`.
2. **Dedup** via `core.idempotency_keys` insert (constraint violation = already processed; ack and drop).
3. **Translate** source-module vocabulary into consumer-module vocabulary (e.g., `opportunity_id` → `source_opportunity_ref`).
4. **Write read-model row(s)** in the consumer's own schema. Never query the source module's tables.
5. **Optionally emit downstream events** to continue the saga.

If any of 1–3 fail: write to local DLQ + emit `<consumer_module>.dlq.message_added`. If 4 fails: standard Kafka retry. If 5 is required but the transaction can't complete atomically with 4: use the consumer's local outbox to guarantee.

### 5.11 Cross-cutting subscribers — the table

This table summarises **who listens to whom**. Rows are subscribers; columns are publishers. ✓ = subscribes to ≥1 event from that publisher.

| Subscriber ↓ \ Publisher → | core | crm | sales | quot | log | fin | comp | comms | amro | uim | mkts |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **core** | — | | | | | | | | | | |
| **crm** | ✓ | — | ✓ | ✓ | ✓ | ✓ | | ✓ | | | |
| **sales** | ✓ | ✓ | — | ✓ | | ✓ | ✓ | ✓ | | | |
| **quotation** | ✓ | | ✓ | — | ✓ | | ✓ | | | | |
| **logistics** | ✓ | | ✓ | ✓ | — | | ✓ | ✓ | ✓ | ✓ | |
| **finance** | ✓ | | ✓ | ✓ | ✓ | — | | ✓ | | ✓ | |
| **compliance** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | | ✓ | | |
| **comms** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| **amro** | ✓ | | | | ✓ | | ✓ | | — | ✓ | |
| **uim** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| **markets** | ✓ | | | | | | | ✓ | | | — |

**Reading the table**: `comms` and `uim` are the most-subscribed modules — comms because every event is potentially user-visible, uim because every event is potentially externally-syncable. Markets is the most-isolated (mostly self-contained, listens to only `core` + `comms`).

### 5.12 Per-saga state tables

Some cross-module flows need durable saga state (more than what events alone provide). Each module owns its own saga table for sagas it initiates:

```sql
crm.saga_party_dedup              -- multi-step party-merge workflow
sales.saga_lead_conversion        -- lead→party→opp transaction (per Sales §9.6)
quotation.saga_quote_send         -- quote→screening→send→tracking
quotation.saga_approval_chain     -- multi-approver workflow
logistics.saga_booking_to_shipment  -- handoff from booking to live shipment
finance.saga_invoice_cycle        -- draft→approve→finalize→send→pay
compliance.saga_review            -- flagged → human review → decision
amro.saga_wo_lifecycle            -- WO creation → execution → CRS
amro.saga_aog_response            -- AOG event → resolution
uim.saga_sync_run                 -- multi-step external sync
```

All carry a `correlation_id` linking back to the originating event chain.

### 5.13 Where events do NOT live

**Forbidden patterns**, called out so reviewers can reject PRs:

1. **No "request-reply" events.** If Sales needs an answer from Compliance, Sales emits a request event and *waits for the response event*. There is no synchronous RPC between modules.
2. **No backchannels via shared tables.** Modules cannot dump state into a "shared" table for another module to poll. Only `core.*` is shared, and only the substrate concepts (audit, notifications, files, parties, etc.) — never business data.
3. **No "fire and ignore" outbound from app code.** Every outbound event lives in `core.outbox`. App code that emits events directly to Kafka is forbidden.
4. **No subscribing in the frontend.** Frontend reads its own module's REST/GraphQL only. Cross-module data appears via read-model rows the consumer already populated through events.
5. **No FK to another module.** Reiterates §2.1 rule (2). Sagas use opaque refs (`source_opportunity_ref`) populated by events.

---

## §6 — LLM enhancement playbook & infrastructure

This section defines two things together: **(a) the LLM infrastructure** that every module's AI features run on, and **(b) the consolidated ranking of ~70 LLM features** identified across all per-module subdocs. The infrastructure is opinionated and prescriptive — every module follows it. The features are advisory and prioritisable — each tenant picks which to enable.

### 6.0 Layer split — where LLM lives in the architecture

**The single most important question for anyone reading this section**: is LLM a core capability or a module concern? **Both — with a clean kitchen-vs-recipes split.**

| Layer | Owned by | What it contains | Examples |
|---|---|---|---|
| **LLM Infrastructure** (the *kitchen*) | `core` | The provider client, prompt repository tables, observability log, accounting, budgets, the Improver Agent, safety pipeline, provider configs, admin UI | `packages/llm-client`, `core.llm_prompts`, `core.llm_invocations`, `core.llm_usage`, `core.llm_budgets`, `core.llm_provider_configs`, `packages/llm-improver`, `/admin/llm-providers/*` |
| **LLM Features** (the *recipes*) | Each business module | The prompt content, fixtures, eval cases, call sites, outcome recording, module-specific guardrails | `packages/llm-prompts/sales/lead_score_evaluation/v3.prompt.md` (owned by `sales`), `packages/llm-prompts/amro/directive_applicability/v1.prompt.md` (owned by `amro`), per-module `§7 LLM hooks` lists |
| **One LLM feature owned BY core** | `core` only | Party deduplication assistant — because parties are a core concept | See `core.md §7` |

**The architectural rule**: every module that wants AI calls `llmClient.invoke({prompt_key: 'sales.lead.score_evaluation', tenant_id, variables, subject})`. Core handles everything from there — looks up the prompt, fills variables, picks model, applies safety pipeline, calls provider, validates output, writes usage rows, returns. **No module imports `@anthropic-ai/sdk` directly.** CI lint enforces this.

**This is the same pattern used elsewhere on the platform**:
- `core.files` — core owns storage abstraction; modules own which files exist and what they mean.
- `core.audit_log` — core owns the table + helpers; modules emit subject-typed entries.
- `core.notifications` — core owns intent; modules emit; Comms delivers.

LLM follows that pattern: **core owns the substrate; modules own the meaning.**

**Module ownership of prompts is tracked by frontmatter, not directory** — every prompt file has `owner_module: <module>` in its frontmatter, and CODEOWNERS rules on `packages/llm-prompts/<module>/**` route reviews to that module's AI lead.

**Why split this way:**

| Benefit | Mechanism |
|---|---|
| **Modules move fast on features** | They write prompts + call `invoke()`; never re-implement caching, routing, budgets, accounting |
| **Provider swaps are platform-level** | Anthropic → OpenAI → Gemini changes `core.llm_provider_configs`; no module code touched |
| **Improver Agent has one tree to traverse** | All prompts in `packages/llm-prompts/`, all observability in `core.llm_invocations` — pattern detection works across modules |
| **Budget enforcement is centralised** | A runaway prompt can't quietly burn tokens — soft/hard caps in `core.llm_budgets` |
| **Safety is uniform** | PII redaction, hallucination guards, regulatory class enforcement happens in the pipeline, not per-module |
| **Cross-module patterns surface** | The 7 patterns in §6.9 (Extract / Classify / Generate / Summarise / Score / Recommend / Match) only become visible because all prompts go through the same client |

**What this is NOT**: it is NOT a "platform AI service" that modules call over HTTP. Modules import `packages/llm-client` as a library; it runs **in the module's own service process** with module-scoped tenant context. Latency is local-function-call, not RPC.

### 6.1 Design vision

Every AI call on the platform — past, present, and future — flows through the same plumbing:

1. A **stable prompt template** stored in a versioned repository, owned by a module.
2. A **dynamic resolver** that fills variables, picks a model, applies safety wrappers, and invokes the provider.
3. A **single shared client** (`packages/llm-client`) that performs the call, caches when appropriate, and writes one usage row.
4. An **observability layer** linking each call to the downstream user action (accepted / overridden / ignored / failed).
5. A **continuous-improvement loop** that learns from the observability data — surfacing weak prompts, proposing edits, A/B testing, promoting winners.
6. A **Prompt Improver Agent** that operates the loop semi-autonomously.

This means **no module owns its AI in isolation**. The features differ; the contract is uniform.

### 6.2 The `packages/llm-client` contract

The only legal path from any module to any LLM provider. CI lint forbids `@anthropic-ai/sdk` / `openai` / direct provider imports outside this package.

```ts
// packages/llm-client — public API

export interface InvokeRequest {
  tenant_id:        string
  module:           ModuleName          // 'crm' | 'sales' | ...
  feature:          string              // 'lead_scoring' | 'invoice_line_classification' | ...
  prompt_key:       string              // e.g. 'sales.lead.score_evaluation'
  variables:        Record<string, any> // filled into the prompt template
  subject?:         { type: string, id: string }  // for outcome-tracking link-back
  options?: {
    model_override?:   string           // tenant or feature can pin a model
    temperature?:      number
    max_tokens?:       number
    cache_ttl_seconds?: number          // 0 = no cache
    timeout_ms?:       number           // default 30000
  }
}

export interface InvokeResponse<T = unknown> {
  invocation_id:   string               // ULID; FK target for outcome tracking
  output:          T                     // structured if a JSON Schema is registered, else string
  cache_hit:       boolean
  model_used:      string
  usage:           { prompt_tokens: number, completion_tokens: number, total_tokens: number }
  cost_usd:        number
  latency_ms:      number
  warnings?:       string[]              // e.g. 'pii_redacted', 'low_confidence'
}

export async function invoke<T>(req: InvokeRequest): Promise<InvokeResponse<T>>
export async function recordOutcome(invocation_id: string, outcome: Outcome): Promise<void>
```

Every `invoke()` call writes a row to `core.llm_usage` and a row to `core.llm_invocations` (the detailed log linked to the prompt + outcome). `recordOutcome()` is called later by application code when the user accepts / rejects / overrides the result.

### 6.3 Prompt repository — schema & ownership

Prompts live in two layers: **canonical (in repo)** and **runtime (in DB)**. Repo holds the source of truth; DB holds tenant-overrides + active-version pointers + the improvement-loop state.

#### 6.3.1 Repo layout

```
packages/llm-prompts/
  src/
    crm/
      lead_score_evaluation/
        v1.prompt.md          ← markdown with frontmatter + body
        v1.schema.json        ← output JSON Schema (for structured outputs)
        v1.fixtures.jsonl     ← test cases + expected outputs
        v1.eval.ts            ← deterministic eval harness
        v2.prompt.md
        ...
    sales/
      ...
    amro/
      ...
  packages/
    llm-prompts/index.ts      ← exports {moduleName, featureName, version} → loaded prompt
```

Each prompt file has frontmatter:

```yaml
---
key: sales.lead.score_evaluation
version: 3
status: active                    # 'draft' | 'shadow' | 'active' | 'deprecated'
owner_module: sales
default_model: claude-haiku-4-5
fallback_model: gpt-4o-mini
expected_inputs: [lead, recent_activities, tenant_icp_profile]
output_schema: ./v3.schema.json
max_tokens: 600
temperature: 0.2
cache_ttl_seconds: 900
pii_handling: redact_emails_phones
safety_class: business_advisory   # 'business_advisory' | 'customer_facing' | 'regulatory'
---

You are a sales-qualification assistant ...
```

#### 6.3.2 Runtime tables (`core.*`)

```sql
core.llm_prompts (
  id                  uuid PK,
  prompt_key          text NOT NULL,        -- 'sales.lead.score_evaluation'
  version             int NOT NULL,
  module              text NOT NULL,
  status              text NOT NULL,        -- 'draft','shadow','active','deprecated'
  source_path         text,                 -- repo path; NULL for tenant-overrides
  prompt_body         text NOT NULL,        -- materialised after include-resolution
  output_schema_json  jsonb,
  default_model       text,
  fallback_model      text,
  metadata            jsonb,                 -- frontmatter + extras
  created_at, created_by_kind text, created_by_id uuid,
  UNIQUE (prompt_key, version)
)

core.llm_prompts_tenant_overrides (
  tenant_id           uuid,
  prompt_key          text,
  active_version      int REFERENCES core.llm_prompts.version,
  custom_prompt_id    uuid NULL REFERENCES core.llm_prompts(id),  -- for fully-custom tenant prompts
  PRIMARY KEY (tenant_id, prompt_key)
)

core.llm_prompts_experiments (
  id                  uuid PK,
  tenant_id           uuid,
  prompt_key          text,
  control_version     int,
  variant_version     int,
  traffic_split       numeric,              -- 0.0..1.0 → fraction to variant
  started_at, ended_at,
  status              text,                 -- 'running','promoted_control','promoted_variant','aborted'
  metric_target       text,                 -- 'acceptance_rate','accuracy','latency_p50','cost_per_call'
  results_summary     jsonb
)
```

**Versioning rules**:
- Active version is the default. Tenants can pin an older version via `tenant_overrides.active_version`.
- New version starts as `draft` → promoted to `shadow` (runs in parallel, doesn't return result) → promoted to `active` (replaces previous).
- Deprecated versions remain readable for 90 days for audit/reproducibility.

### 6.4 Dynamic prompt resolution

The flow from `invoke()` to provider call:

```
1. Look up active version
   → core.llm_prompts_tenant_overrides (tenant-specific?)
   → core.llm_prompts WHERE prompt_key=$1 AND status='active'

2. Check for active experiment
   → core.llm_prompts_experiments WHERE prompt_key=$1 AND status='running'
   → roll variable-traffic dice → either control or variant version

3. Fill template variables
   → mustache-style {{var.path}} resolution
   → strict mode: missing required variable → error

4. Apply pre-call safety pipeline
   → PII redaction (per prompt metadata pii_handling)
   → Output-schema injection (if structured output)
   → System-message wrapping (per safety_class)

5. Pick model
   → request.options.model_override > tenant default > prompt default
   → Apply rate-limit check against core.llm_budget

6. Call provider via packages/llm-client
   → Anthropic SDK / OpenAI SDK / Gemini / etc.
   → Cache check first if cache_ttl > 0

7. Post-call processing
   → Validate response against output_schema (structured)
   → Confidence-score extraction (if model supports)
   → PII redaction in response (where applicable)

8. Write core.llm_usage + core.llm_invocations rows
   → Return InvokeResponse with invocation_id
```

### 6.5 Observability — the invocation log

```sql
core.llm_invocations (
  id                  uuid PK,              -- the invocation_id returned to callers
  tenant_id           uuid NOT NULL,
  occurred_at         timestamptz NOT NULL,
  module              text NOT NULL,
  feature             text NOT NULL,
  prompt_key          text NOT NULL,
  prompt_version      int NOT NULL,
  experiment_id       uuid NULL,
  experiment_arm      text,                  -- 'control' | 'variant' | NULL
  subject_type        text NULL,             -- e.g. 'sales.lead'
  subject_id          uuid NULL,
  variables           jsonb,
  resolved_prompt     text,                  -- the final filled prompt sent to the model
  model_used          text NOT NULL,
  output_raw          text,
  output_parsed       jsonb,
  cache_hit           boolean,
  prompt_tokens       int, completion_tokens int, total_tokens int,
  cost_usd            numeric,
  latency_ms          int,
  outcome_recorded_at timestamptz NULL,
  outcome             jsonb NULL,            -- {kind:'accepted'|'rejected'|'overridden'|'ignored', user_id, edited_output?, notes?}
  warnings            text[],
  error               text NULL,
  PRIMARY KEY (tenant_id, occurred_at, id)
) PARTITION BY RANGE (occurred_at);
```

This table is **the foundation of self-improvement**. Every call's *full context* is preserved: input variables, resolved prompt, output, downstream outcome. Monthly partitions; 24-month retention default; per-tenant override possible.

`core.llm_usage` becomes a thin aggregate over `core.llm_invocations` (per-tenant-per-month spend totals + caps).

### 6.6 Outcome tracking — closing the loop

Every UI surface that consumes an LLM result calls `llmClient.recordOutcome(invocation_id, outcome)` when the user acts. Examples:

- Lead scoring: user clicks "accept score" → `accepted`. User manually overrides score → `overridden` with `edited_output`.
- Suggested charges: user clicks "add to quote" → `accepted`. User dismisses → `rejected`.
- Email reply draft: user sends → `accepted`. User edits then sends → `accepted_after_edit` with `edited_output`. User dismisses → `rejected`.
- Compliance hit-reasoning: officer approves → `accepted`. Officer overrides → `overridden` with notes.

For features without explicit accept/reject, **passive outcomes** fire from event subscriptions: e.g., if Quotation's `predict_acceptance` predicted `0.78` and 14 days later `quotation.quote.accepted` fires, the loop records the prediction as correct.

### 6.7 Auto prompt enhancement — the improvement loop

The platform learns from `core.llm_invocations`. The loop runs continuously:

```
Loop (per prompt_key, per tenant, weekly):
  1. Query last 28 days of invocations for this prompt+tenant
  2. Compute metrics:
     - acceptance_rate
     - override_rate, override_distance (LLM output vs human-edited)
     - latency_p50, latency_p95
     - cost_per_accepted_call
     - schema_validation_failure_rate
     - confidence_calibration (predicted prob vs realised outcome)
  3. Compare to prior 28 days + active SLOs
  4. If degraded OR if explore_budget remaining:
       Invoke Prompt Improver Agent (§6.8)
       → agent proposes 1-3 variant prompts based on:
         - failed/rejected invocations (negative examples)
         - successful invocations (positive examples)
         - prior winning variants in this prompt's history
       → variants run as shadow for 7 days
       → if shadow metrics beat control → promoted to A/B experiment
       → if A/B winner with statistical significance → promoted to active
  5. Demote old active version to deprecated
  6. Notify prompt owner (the module's AI lead) of the change
```

Every step is logged in `core.llm_prompt_improvement_log` for audit + rollback.

### 6.8 The Prompt Improver Agent

A **pluggable agent runtime** that proposes prompt variants from observability data.

#### Interface (runtime-agnostic):

```ts
interface PromptImproverAgent {
  proposeVariants(input: {
    prompt_key: string
    current_version: PromptDefinition
    historical_invocations: Invocation[]    // sampled last 28 days
    failure_cases: Invocation[]              // rejected/overridden subset
    success_cases: Invocation[]              // accepted subset
    metrics: PromptMetrics
    constraints: { max_tokens, model, safety_class }
  }): Promise<PromptVariant[]>             // 1-3 proposals with rationale
}
```

#### Possible backing implementations (decision deferred — §6.13):

| Runtime | Notes |
|---|---|
| **DSPy** | Stanford framework, "compiles" prompts from examples; mature, open-source |
| **OpenPipe** | Hosted fine-tuning + prompt optimization; managed service |
| **Anthropic Workbench API** | Programmatic prompt editing via Claude; aligns with our primary provider |
| **Custom (Hermes-style agent)** | User-mentioned; build our own using Claude/GPT-4 as the improver-LLM with a structured ReAct-style loop |
| **Hybrid** | Custom orchestrator + DSPy for compile step + Anthropic for proposal |

Each runtime gets a thin adapter in `packages/llm-improver/`. The platform code talks to the interface; swap backend without touching modules.

#### Agent operating modes:

- **Reactive** — triggered when SLO breach detected (acceptance_rate drops by 10% week-over-week).
- **Scheduled** — weekly opportunistic improvement cycle even when SLOs are met.
- **On-demand** — module owner manually requests improvement via `/admin/llm-providers/prompts/:key/improve`.

#### Guardrails on the agent:

- Variants must use the same `safety_class` as control. Agent cannot relax a `regulatory` prompt to `business_advisory`.
- Variants must produce schema-valid output on 100% of frozen test fixtures (`v*.fixtures.jsonl`).
- Variants must not change the prompt's *task* — only its *phrasing, examples, structure*. (Detected by semantic similarity check.)
- Promotion to `active` requires either: (a) statistical significance on A/B vs control, OR (b) explicit human approval by the module owner.

### 6.9 Module-specific prompt anatomies

Different modules have different prompt patterns. Documenting six dominant patterns observed across the ~70 features:

| Pattern | Modules | Typical structure |
|---|---|---|
| **A. Extract structured fields from text** | sales (email→lead), logistics (cargo, customs), finance (invoice lines), compliance (KYC doc), comms (inbound class), amro (compliance doc OCR), quotation (extract_charges, extract_competitor_quote) | Prompt = task + schema + few-shot examples. Output: JSON. Confidence scores per field. |
| **B. Classification / routing** | comms (inbound class), finance (line classify), uim (field map), logistics (HS code), compliance (hit reasoning) | Prompt = labels enum + criteria + examples. Output: label + confidence. |
| **C. Generation / drafting** | comms (reply), crm (campaign content), finance (dunning copy), quotation (cover letter), sales (forecast narrative), amro (tech log) | Prompt = tone + recipient context + style guide + facts. Output: drafted text. Always edit-able. |
| **D. Summarisation** | comms (thread), crm (activity), amro (audit narration, tech log), quotation (summarise_changes) | Prompt = input + length cap + key-points template. Output: bulleted or paragraph. |
| **E. Scoring / prediction** | sales (lead score, predict acceptance), comms (send time), logistics (ETA refine), amro (predictive maintenance), finance (anomaly), uim (reorder forecast) | Prompt = features + reference distribution + similar past cases. Output: score + confidence interval + reasoning. |
| **F. Recommendation / suggestion** | sales (next-best-action, stage move, conversion readiness), quotation (route optimisation, predict acceptance), logistics (reorder), compliance (override guardrail), amro (AOG triage) | Prompt = state + goals + constraints + history. Output: ranked recommendations with rationale. |
| **G. Matching / dedup** | core (party dedup), uim (item dedup, field map), compliance (hit-to-party), logistics (provider rate normalisation), amro (item cross references) | Prompt = candidate set + canonical + matching criteria. Output: matches with similarity scores. |

Per-pattern shared utilities live in `packages/llm-prompts/lib/`:
- `pattern_a_extractor.ts` — shared scaffolding for extraction prompts.
- `pattern_b_classifier.ts` — for classification.
- etc.

This means a new feature in any module starts from a battle-tested pattern, not a blank file.

### 6.10 The platform-wide LLM feature backlog (ranked)

Consolidating all per-module subdoc rankings into one platform list. **Ranking criteria**: (a) annual cost savings or revenue impact, (b) user-time saved per call, (c) implementation difficulty, (d) regulatory risk. Scored 1–5 each; aggregate is `(saving × time_saved) / (difficulty × risk)`.

#### Tier 1 — ship in Year 1 (Q1–Q2)

| # | Module | Feature | Pattern | Why |
|---|---|---|---|---|
| 1 | sales | Email → lead extraction | A | Already exists (`EmailToLeadDialog`); formalise + instrument |
| 2 | quotation | Charges suggestion (`suggest_charges`) | E/F | Already exists via `useAiAdvisor`; bring under contract |
| 3 | comms | Inbound classification | B | Foundational — drives routing for sales/comms/comp |
| 4 | logistics | Customs document extraction | A | High value, OCR + LLM combined |
| 5 | finance | Invoice line classification | B | Required for automation of `logistics.shipment.delivered → invoice.drafted` |
| 6 | compliance | Hit-reasoning summarisation | D | Most-impactful single feature in Compliance — reviewer time |
| 7 | sales | AI-driven lead scoring | E | Resurrects the 3 dead scoring tables; quantifiable lift |
| 8 | crm | Activity auto-summarisation | D | Saves rep time on every long call/meeting |
| 9 | amro | Directive applicability inference | F | Replaces manual fleet-cross-checking; large time saving |
| 10 | quotation | Predict acceptance | E | Drives forecasting; trains on win-rate data |

#### Tier 2 — ship in Year 1 (Q3–Q4)

| # | Module | Feature | Pattern |
|---|---|---|---|
| 11 | comms | Reply drafting | C |
| 12 | comms | Thread summarisation | D |
| 13 | logistics | Cargo description → structured (`SmartCargoInput` formalise) | A |
| 14 | logistics | Milestone inference from carrier emails | A/B |
| 15 | finance | Payment reconciliation | A/G |
| 16 | finance | Dunning copy generation | C |
| 17 | compliance | KYC document parsing | A |
| 18 | compliance | Override-reason guardrail | F |
| 19 | uim | Field-mapping suggestion | G |
| 20 | uim | Conflict resolution recommendation | F |
| 21 | amro | AOG triage assistant | F |
| 22 | amro | Compliance document OCR | A |
| 23 | crm | Email → activity classification | A/B |
| 24 | sales | Conversion-readiness suggestion | F |
| 25 | quotation | Compare quote options (portal narrative) | D |

#### Tier 3 — ship in Year 2

The remaining ~45 features. Includes: notification batching/digest (comms #9), forecast narrative (sales #4), failure-mode pattern detection (amro #3), adverse-media synthesis (compliance #2), audit narrative generation (finance #7), reorder forecast (uim #6), translation (comms #7), inventory anomaly detection (uim/amro), HS code classification (logistics/finance), and the long tail.

### 6.11 Cost model & budget guards

#### 6.11.1 Per-tenant budget

```sql
core.llm_budgets (
  tenant_id        uuid PK,
  monthly_cap_usd  numeric NOT NULL,
  soft_threshold   numeric DEFAULT 0.8,    -- 80% triggers notification
  hard_threshold   numeric DEFAULT 1.0,    -- 100% blocks
  per_feature_caps jsonb,                  -- {"sales.lead_scoring": 50, ...} per-feature monthly caps
  rate_limit_qps   int DEFAULT 50,
  updated_at
)
```

#### 6.11.2 Enforcement (in `packages/llm-client`)

```
Before each invoke:
  spend_so_far = SUM(cost_usd) from core.llm_usage WHERE tenant_id=$1 AND month=current
  IF spend_so_far + estimated_cost > hard_threshold:
     return { error: 'budget_exceeded', reset_at: end_of_month }
  IF spend_so_far + estimated_cost > soft_threshold AND not_notified_this_month:
     fire core.notifications event (tenant_admin)
  Proceed.
```

#### 6.11.3 Cost-by-model reference (Q2 2026 prices, will rotate)

| Model | Input $/1M | Output $/1M | When to use |
|---|---|---|---|
| Claude Opus 4.7 | $15 | $75 | Regulatory (AMRO compliance), complex reasoning |
| Claude Sonnet 4.6 | $3 | $15 | Default for most generation/summarisation |
| Claude Haiku 4.5 | $0.80 | $4 | High-volume classification, scoring |
| GPT-4o mini | $0.15 | $0.60 | Fallback for cheap classification |
| Gemini Flash | $0.075 | $0.30 | Bulk batch jobs |

Each prompt's frontmatter pins a default + fallback; routing rule prefers cheaper model when confidence threshold allows.

### 6.12 Safety, PII, regulatory considerations

| Concern | Mechanism |
|---|---|
| **PII in prompts** | `pii_handling` frontmatter field: `pass_through` / `redact_emails_phones` / `redact_all`. Redaction via deterministic regex pre-call; restoration post-call. |
| **PII in responses** | Same redaction applied to output before user display. |
| **Tenant data leakage across tenants** | `tenant_id` is in every invocation; cache keys include tenant_id; CI test verifies no prompt template references cross-tenant data. |
| **Hallucinations in regulatory contexts** | `safety_class='regulatory'` forces: Opus-class model, no cache, mandatory human signoff (per AMRO §7), citation-required prompts. |
| **Customer-facing outputs** | `safety_class='customer_facing'` forces: tone-guardrail post-processor, profanity filter, brand-voice check. |
| **Model removal/deprecation** | When Anthropic deprecates a model, prompts referencing it auto-fail-over to fallback; alert fires; prompt-owner reviews. |
| **Audit trail** | Every `core.llm_invocations` row is immutable; the `resolved_prompt` field captures exact text sent. Sufficient for regulator reproduction request. |
| **Right-to-deletion** | When `core.party.deleted` fires, `core.llm_invocations` rows referencing that party (via `subject_type='core.party'`) have `variables` + `output_parsed` scrubbed (kept as `{redacted_for_gdpr: true}`). |

### 6.13 Open decisions

1. **Prompt Improver Agent backend** — DSPy / OpenPipe / Anthropic Workbench / custom / Hermes / hybrid. **Recommend**: start with a **custom Anthropic-Workbench-style agent** (Claude proposes, evaluator validates against fixtures, A/B promotes). If Hermes is a specific framework you have in mind, drop it in via the adapter interface in §6.8. Re-evaluate at month 6 if DSPy or OpenPipe demonstrably outperforms.
2. **Where prompts live in repo** — `packages/llm-prompts/` (recommended) vs each module's dir. **Recommend `packages/llm-prompts/`** so the improver agent has one tree to traverse and the prompt-format lint runs in one place. Module ownership tracked by frontmatter `owner_module`, not directory location.
3. **Default model per tier** — written above as a recommendation. Tenant admins can pin. **Recommend** keep Anthropic primary; OpenAI fallback; Gemini batch-only. This may shift over Q3 as benchmarks roll.
4. **Caching aggressiveness** — `cache_ttl` per prompt. **Recommend**: extraction/classification of identical inputs cached for 24h; generation/summarisation no-cache by default (each output is bespoke).
5. **Outcome-tracking enforcement** — should missing `recordOutcome()` calls block prompt-improvement cycles? **Recommend yes** for prompts with `requires_outcome_tracking=true` frontmatter; the improver agent refuses to propose variants without ≥100 outcome-labeled invocations.
6. **Multi-tenant prompt overrides** — can tenants write fully-custom prompts or only pick versions? **Recommend tiered**: Free/Basic = version pinning only; Pro+ = full prompt customisation with mandatory review by a "prompt-engineer" role.
7. **Self-improvement budget** — running improver agents consumes LLM tokens. **Recommend** dedicate 5% of each tenant's monthly LLM budget to improvement cycles (configurable). Tenants can disable improvement entirely.
8. **Cross-tenant learning** — can the improver agent learn from anonymised aggregate patterns across tenants? **Recommend NO by default** (data-sharing implications); opt-in tenant flag `share_anonymised_for_global_improvement` for B2B SaaS tenants who consent.

### 6.14 What this means for the existing codebase

- Today's `useAiAdvisor` hook becomes a thin client over `packages/llm-client`. No direct provider SDK imports.
- `services/markets-worker/src/markets_worker/llm_gateway.py` becomes the Python adapter to the same prompt repository (per markets.md §10.1).
- All AI calls today (markets chat, quotation advisor, SmartCargoInput, EmailToLeadDialog) migrate to invoke-by-key. First wave: rewrite 4 known call-sites against the new client.
- New `packages/llm-prompts/`, `packages/llm-client/`, `packages/llm-improver/` packages created.
- New tables: `core.llm_prompts`, `core.llm_prompts_tenant_overrides`, `core.llm_prompts_experiments`, `core.llm_invocations`, `core.llm_budgets`, `core.llm_prompt_improvement_log`.
- New admin UI: `/admin/llm-providers/prompts` (browser + editor + experiment manager), `/admin/llm-providers/improvement-log`, `/admin/llm-providers/budgets`.
- New CI checks: lint forbidding direct provider SDK imports; prompt-fixtures must pass for every new version; semantic-drift check on improver-proposed variants.

---

## §7 — Migration & rollout plan

This is the **master sequencing plan** for the entire redesign. It threads the per-module migration tables (each subdoc's §8) into a platform-wide rollout with dependency ordering, parallelism, "no-break" rules, and rollback points.

### 7.1 Headline shape

Roughly **18 months end-to-end** if each phase is sequential; **~12 months** with aggressive parallelism across teams. Three macro stages:

| Stage | Duration | What |
|---|---|---|
| **Foundation** | Months 1–4 | Build the substrate: packages, core schema, parties migration, provider lifts, schema cleanup |
| **Modules** | Months 4–14 | Conformance + refactor for all 11 modules, in dependency order with parallelism |
| **Feature delivery** | Months 6–18 | LLM Tier-1 features ship as their dependencies land; runs in parallel from month 6 onward |

Throughout: **the existing app must keep working**. Every phase is shipped behind feature flags, with dual-write where data moves, and per-tenant rollout (smallest tenants first) for risky cuts.

### 7.2 The "no-break" rules

These are non-negotiable across the entire migration:

1. **No big-bang cutovers.** Every data move ships as: create new → dual-write → backfill → switch reads → 30-day no-direct-read window → drop old.
2. **No PR may both rename a route AND change its semantics.** Pure renames first; semantic changes second.
3. **Per-tenant rollout for any cut over 1k rows of customer data.** Start with internal tenant, then smallest external, then full rollout — never simultaneous.
4. **Every schema migration is reversible** within 24 hours. Drops happen only after the no-direct-read window completes.
5. **Each module's outbox poller goes live BEFORE any consumer subscribes to its events.** Avoids the "subscriber drops because no producer" pattern.
6. **Compliance, payments, regulatory data never go dual-write.** Move at a planned downtime window with a tight rollback runbook.
7. **CI lint rules (no direct SDK imports, no cross-module FKs, manifest registration) ship BEFORE the work that depends on them.** Otherwise the lint rules block legitimate ongoing work.
8. **The existing `public.*` tables are read-only no later than 30 days before they're dropped.** Catches latent direct-read paths.

### 7.3 Dependency graph

Modules can't be migrated in arbitrary order. The dependency graph:

```
                         ┌──────────────┐
                         │  packages    │
                         │ (foundation) │
                         └──────┬───────┘
                                ↓
                         ┌──────────────┐
                         │   core.*     │ ←─── lifts from platform.*
                         └──────┬───────┘
                                ↓
              ┌─────────────────┴─────────────────┐
              ↓                                   ↓
       ┌────────────┐                      ┌────────────┐
       │  markets   │ (conformance only —  │  comms     │ (early because everyone
       │            │  safe testbed)       │            │  notifies through it)
       └────────────┘                      └─────┬──────┘
                                                 │
              ┌──────────────────────────────────┤
              ↓                                  ↓
       ┌────────────┐  ←───┐              ┌────────────┐
       │    crm     │      │              │ compliance │ (gates downstream)
       └─────┬──────┘      │              └─────┬──────┘
             ↓             │                    │
       ┌────────────┐      │                    │
       │   sales    │←─────┤                    │
       └─────┬──────┘      │                    │
             ↓             │                    │
       ┌────────────┐      │                    │
       │ quotation  │←─────┘                    │
       └─────┬──────┘                           │
             ↓                                  │
       ┌────────────┐                           │
       │ logistics  │←──────────────────────────┤
       └─────┬──────┘                           │
             ↓                                  │
       ┌────────────┐                           │
       │  finance   │←──────────────────────────┘
       └────────────┘

              ┌────────────┐
              │    uim     │ (parallel track; foundational for amro)
              └─────┬──────┘
                    ↓
              ┌────────────┐
              │    amro    │ (last; biggest; depends on uim inventory)
              └────────────┘
```

**Critical-path observations:**

- **Core blocks everything.** Nothing meaningful starts in business modules until core.parties is real.
- **CRM → Sales → Quotation is a tight chain** because they share the most code today (the lead/oppy/quote tangle). Parallel work is possible but with high coordination cost.
- **Logistics and Finance can run in parallel** once Sales is done.
- **Comms and Compliance can start early** because they're consumers — they don't block other modules' data migrations, only their feature delivery.
- **UIM and AMRO are a parallel track** to the commercial-lifecycle stream. They can be done by a separate team without blocking commercial.
- **Markets is the safe testbed** for the contract — minimal disruption risk.

### 7.4 The 11 phases

#### Phase 0 — Foundation packages (Weeks 1–4)

| Workstream | Deliverable |
|---|---|
| `packages/event-contracts/` | JSON Schema registry + linter + first 20 event schemas (core events) |
| `packages/llm-client/` | Library API per §6.2; provider adapters (Anthropic, OpenAI, Gemini); no AI features yet |
| `packages/llm-prompts/` | Repo tree + frontmatter parser + fixture-runner CI integration |
| `packages/llm-improver/` | Interface + null implementation (returns no variants) |
| `packages/db-types-core/` | Generated types per schema |
| CI lint suite | Bans direct provider SDK imports; bans cross-schema FKs; bans direct `crm.accounts`/`crm.contacts` reads once core.parties ships |
| Kafka topic registry | Doc + naming-convention enforcement |

**Risk: Low** — all additive. Existing app unaffected.
**Gating exit criteria**: lint rules in CI; an empty `core.*` schema exists.

#### Phase 1 — Core lifts (Weeks 3–8, overlaps with Phase 0)

Lift cross-cutting infra into `core.*` *without* moving party data yet.

| Workstream | Deliverable | Risk |
|---|---|---|
| `core.audit_log` (partitioned) | Created; triggers start shadow-write from every existing audit table (14+) | Medium — perf must be validated |
| `core.outbox` (partitioned) | Created; template poller code | Low |
| `core.llm_*` lift from `platform.*` | All `platform.llm_*` tables moved; `core.llm_invocations` created | Low |
| `core.idempotency_keys`, `core.feature_flags` | Lifted from `platform.*` | Low |
| `core.domains` lift from `platform_domains` family | Lifted; existing `requiredDomainCode` route guard rewritten against `core.domains` | Medium — touches every gated route |
| `core.secrets` | New; provider creds, oauth tokens, integration credentials move here | Medium — security-critical |
| `core.notifications` | New table; no producers yet | Low |
| `core.files` + `core.file_links` | New tables; no producers yet | Low |
| **Drop `platform.*` schema** | After all lifts complete, integration tables routed to UIM (Phase 7) | Low |

**Gating exit criteria**: every existing audit-event write also lands in `core.audit_log` (shadow); `platform.*` is empty.

#### Phase 2 — Identity & parties (Weeks 6–16) — *the long pole*

The most critical and risky migration in the project: replacing `public.accounts` and `public.contacts` with `core.parties`.

| Step | Weeks | Risk |
|---|---|---|
| Create `core.parties`, `core.party_relationships`, `core.*_links` tables | 2 | Zero |
| Backfill from `public.accounts` ∪ `public.contacts` with deterministic ID mapping | 3 | High — most-FK'd tables; one-to-one mapping needs reconciliation |
| Run reconciliation: every `accounts.id` and `contacts.id` maps to exactly one `parties.id`; no orphans | 1 | Medium |
| Create `crm.v_accounts` / `crm.v_contacts` views; switch frontend reads | 2 | Medium — every page that lists accounts/contacts |
| Build party-deduplication assistant (the one core-owned LLM feature) | 2 | Low — net-new |
| Begin dual-write: writes to old tables AND core.parties; reconcile nightly | 4 | High — most-touched data path |
| Stop direct reads of `public.accounts` / `public.contacts` (lint-enforced) | 1 | Medium |
| 30-day no-direct-read window | 4 | Low |
| Drop `public.accounts`, `public.contacts` (and downstream FKs migrated) | 1 | High |

**Gating exit criteria**: zero direct reads of `public.accounts/contacts` for 30 consecutive days; party-detail page is the single source of truth.

**Rollback plan**: dual-write means rolling back is "stop dual-write to core.parties, point views back to public.*". Reversible up until the drop.

#### Phase 3 — Markets conformance (Weeks 14–17)

Use markets as the **safe testbed** for the §2 contract end-to-end. Markets is mature, isolated, and well-tested.

| Step | Risk |
|---|---|
| Add outbox poller to `services/markets-worker/` | Low |
| Rewrite markets `FKs to public.*` → `core.*` | Low — 1 migration file |
| Move route registration to `markets/manifest.ts` | Low |
| Test publishing first events (`markets.portfolio.created`, etc.) to Kafka | Low |
| Validate the full §2 contract holds on a real module | — |

**Gating exit criteria**: markets emits 6 event types from §6 of `markets.md`; no contract violations in lint. This **proves the contract works** before applying to messier modules.

#### Phase 4 — CRM/Sales/Quotation triangle (Weeks 16–28) — *the messy middle*

Three closely-coupled modules; the largest refactor area. Done with **one team per module + tight coordination**:

| Workstream | Parallel-able | Risk |
|---|---|---|
| **CRM**: kill `crm.accounts/contacts` tables; create `crm.account_extensions/contact_extensions`; switch reads to `v_accounts/v_contacts` views | Depends on Phase 2 | Medium |
| **CRM**: build `crm.activities` from `public.activities` ∪ split `public.lead_activities` | Parallel after schema lands | Medium |
| **CRM**: create `crm.campaigns` table (it doesn't exist today); ship the broken Campaigns page | Parallel | Low |
| **Sales**: create `sales.*` schema + tables (leads, scoring, opps, pipelines, forecasts) | Parallel | Low (additive) |
| **Sales**: move components from `src/components/crm/Lead*` to `src/features/module-sales/components/` | Sequential — needs schema | Medium |
| **Sales**: move `src/components/assignment/*` to module-sales | Parallel | Low |
| **Sales**: build `services/sales-api/` (move `leads.routes.ts` + new routes) | Parallel | Medium |
| **Sales**: resurrect the 3 dead scoring tables under `sales.scoring_*` | Parallel | Low |
| **Sales**: split `LeadWorkspaceSections.tsx` (1,570 LOC) into 9 components | After move | Low |
| **Quotation**: create `quotation.*` schema | Parallel | Low |
| **Quotation**: extract pricing engines to `packages/quotation-engine/` | Parallel | Low |
| **Quotation**: **rename `src/components/sales/` → `src/components/quotation/`** | After schema | Medium — large rename |
| **Quotation**: build `services/quotation-api/` (includes AI dispatcher) | Parallel | Medium |
| **Quotation**: split `UnifiedQuoteComposer.tsx` (4,364 LOC) into 9 zone components | After move | Medium |
| **Quotation**: resolve `composer/` vs `unified-composer/` (kill legacy) | Per-tenant flag | Medium |
| **Quotation**: cut over `useAiAdvisor` to go through `services/quotation-api/` → `packages/llm-client` | Late in phase | Medium — touches AI hot path |

**Gating exit criteria for Phase 4**:
- `public.leads`, `public.opportunities`, `public.lead_*` dropped
- `src/components/sales/` renamed to `src/components/quotation/`
- `src/components/crm/Lead*` moved to sales module
- AccountDetailLegacy and ContactDetailLegacy pages **deleted**
- Campaigns page works end-to-end
- AI calls in quotation route through `core.llm_usage` accounting

**Risk: High** — this is where the project most likely slips. Recommend a 2-week buffer.

#### Phase 5 — Logistics + Finance (Weeks 24–34) — *parallel after Sales lands*

| Workstream | Risk |
|---|---|
| **Logistics**: create `logistics.*` schema; backfill from `public.shipments/bookings/carriers/etc.` | Medium |
| **Logistics**: carrier-as-party migration (every carrier gets a `core.parties` row) | Medium |
| **Logistics**: build `services/logistics-api/` (greenfield — largest new service) | High |
| **Logistics**: resolve `container_sizes`/`container_types` duplicate | Low |
| **Logistics**: customs documents → `core.files` | Medium |
| **Logistics**: drop `vendor_portal_activity` (dead) | Low |
| **Finance**: create `finance.*` schema | Low |
| **Finance**: **reconcile `billing_invoices`↔`invoices` duplicate** (2-week parity script) | High |
| **Finance**: same for `billing_payments`↔`payments` | High |
| **Finance**: extract `services/finance-api/` from `services/crm-api/src/services/billing+gl+invoices+tax` | Medium |
| **Finance**: implement GL invariants (debit=credit triggers) | Medium |
| **Finance**: subscription_invoices schema (SaaS-of-SaaS) | Low |
| **Cross-module**: wire `logistics.shipment.delivered` → `finance.invoice.drafted` event chain | Medium — first real event-driven business flow |
| **Cross-module**: wire `sales.opportunity.won` → `finance.commission.computed` | Low |

**Gating exit criteria**: `billing_invoices/payments` duplicates dropped after parity reconciliation; first end-to-end commercial-lifecycle event chain works in test.

#### Phase 6 — Compliance + Comms (Weeks 28–36) — *parallel after Sales lands*

These two are cross-cutting consumers; they could start earlier on the schema side but their events need Sales/Quotation/Logistics to be live to be useful.

| Workstream | Risk |
|---|---|
| **Compliance**: create `compliance.*` schema | Low |
| **Compliance**: build `services/compliance-api/`; move screening services server-side | Medium — credential safety |
| **Compliance**: provider credentials → `core.secrets` | Medium |
| **Compliance**: implement the **gating pattern** (`quotation.quote.sent` blocked on `compliance.screening.failed`) | High — first cross-module saga |
| **Compliance**: build override flow with double-audit | Low |
| **Comms**: create `comms.*` schema (12 tables) | Low |
| **Comms**: build `services/comms-api/` (most ACL files of any module — subscribes to everything) | High |
| **Comms**: implement `core.notifications` → `comms.deliveries` poller | High — touches every module's notifications |
| **Comms**: split `EmailInbox.tsx` (1,029 LOC) into 6 components | Low |
| **Comms**: move `src/components/email/*` → `src/features/module-communications/components/` | Low |
| **Comms**: drop fragmented notification tables (`public.notifications`, `vendor_notifications`, etc.) | Medium |
| **Cross-module**: wire `quotation.quote.sent` → outbound email | Medium |
| **Cross-module**: wire `finance.invoice.overdue` → dunning email | Medium |
| **Cross-module**: wire `logistics.shipment.exception` → multi-channel notify | Medium |

**Gating exit criteria**: compliance gating works end-to-end; 3 notification chains operating in production.

#### Phase 7 — UIM (Weeks 30–38) — *parallel track*

| Workstream | Risk |
|---|---|
| Flesh out `services/uim-api/` from 2-file stub | High — biggest greenfield service |
| Create `uim.inventory.*` sub-namespace (CQRS read-models, partitioned ledger) | Medium |
| Create `uim.integration.*` sub-namespace; migrate `platform.integration_*` here | Low (lifts already done in Phase 1) |
| Build webhook router + DLQ processor + sync conflict resolution UI | High — net-new |
| Move logic from `src/modules/uim/`, `src/services/uim/`, `src/pages/api/v2/uim/` into the service | Medium |
| Tighten route guards from `dashboards.view` → `uim:read` | Low |
| Resolve GraphQL subgraph (§9.2 of `uim.md`) | Medium |
| Decide AMRO ↔ UIM inventory boundary (§9.4) | High — needs AMRO domain owner sync |

**Gating exit criteria**: first external connector wired end-to-end (e.g., SAP business-partner sync) — outbound + inbound + DLQ + conflict-resolution verified.

#### Phase 8 — AMRO (Weeks 36–52) — *the longest module*

AMRO is the largest module by every metric. Migration is **mostly conformance + god-component splits**, not building new things.

| Workstream | Risk |
|---|---|
| Create `amro.*` schema; backfill 52 `public.amro_*` tables | Medium — large data |
| **Drop `public.aircraft_legacy_backup`** | Low |
| Drop `mro_audit.*` schema; rows fold to `core.audit_log` | Medium |
| Drop `flypal.*` schema; rows fold to `amro.vendor_*` | Low |
| Implement AMRO ↔ UIM inventory boundary (per Phase 7 decision) | High — touches parts subsystem |
| Add `core.outbox` poller to `services/amro-api/`; publish §5 events | Medium |
| Refactor `useAmroWorkspaceState.ts` (3,099 LOC) into 6 slice hooks + orchestrator | Medium |
| Refactor `AmroOwnedWorkspace.tsx` (4,324 LOC) into zone components | Medium |
| **Refactor `AmroSettingsMasterDataPage.tsx` (10,581 LOC)** — biggest single refactor in project | High — recommended one master-data domain per PR |
| Refactor other 6 large AMRO components (>1,000 LOC) | Medium |
| Move `AmroDesignSystemShowcase.tsx` out of module | Low |
| Migrate route registration to `module-amro/manifest.ts` | Low |
| Implement `amro.requires_human_signoff` table for AI-suggestion → human-decision linkage | Low |
| Wire AMRO LLM features (#1 directive applicability, #5 AOG triage, #6 compliance doc OCR) | Medium |

**Gating exit criteria**: `public.amro_*` (52 tables), `mro_audit.*`, `flypal.*` all dropped; biggest god-component split complete.

**Risk: High** — buffer 4 weeks. Recommend dedicated AMRO team for this phase.

#### Phase 9 — LLM infrastructure rollout (Weeks 22–28, runs alongside Phase 4)

| Workstream | Risk |
|---|---|
| `core.llm_prompts`, `llm_invocations`, `llm_budgets`, etc. tables created | Low (additive) |
| Migrate the 4 known existing AI call sites to `llmClient.invoke()`: SmartCargoInput, useAiAdvisor consumers, EmailToLeadDialog, markets chat | Medium |
| Build `/admin/llm-providers/*` pages (prompts browser, budget config, improvement-log viewer) | Medium |
| Wire `recordOutcome()` into UI surfaces for the 4 existing AI consumers | Medium |
| Deploy null Improver Agent (collects data, proposes nothing yet) | Low |
| After 4 weeks of data collection → activate Improver Agent in shadow mode | Medium |

**Gating exit criteria**: every AI call on the platform writes a `core.llm_invocations` row; no direct provider-SDK imports outside `packages/llm-client`.

#### Phase 10 — LLM Tier-1 features (Weeks 26–60, ongoing)

Ship the 10 Tier-1 features from §6.10 as their dependencies land. Each is a small project:

| Feature | Depends on | Earliest week |
|---|---|---|
| Email→lead extraction (formalise) | Phase 9 | W30 |
| Charges suggestion (formalise) | Phase 9 | W30 |
| Inbound classification | Phase 6 (comms) | W34 |
| Customs document extraction | Phase 5 (logistics) + `core.files` | W32 |
| Invoice line classification | Phase 5 (finance) | W32 |
| Hit-reasoning summarisation | Phase 6 (compliance) | W34 |
| AI-driven lead scoring | Phase 4 (sales scoring tables) | W26 |
| Activity auto-summarisation | Phase 4 (crm.activities) | W26 |
| Directive applicability inference | Phase 8 (amro) | W42 |
| Predict acceptance | Phase 4 (quotation) + 90-day acceptance history | W34 |

Each feature: write prompt + fixtures + eval → ship in shadow → measure outcomes → graduate to active → measure improvement → activate auto-tuning.

#### Phase 11 — Cleanup (Weeks 50–60)

| Workstream |
|---|
| Drop all legacy `public.*` tables that have completed their 30-day no-direct-read windows |
| Remove dual-write code paths |
| Decommission stale routes |
| Update `CLAUDE.md` to reflect new architecture |
| Update onboarding docs |
| Retrospective + post-mortem |

### 7.5 Parallelism map

To compress 18 months to ~12 months, parallel tracks:

```
Months: 1   2   3   4   5   6   7   8   9   10  11  12  13  14
        │   │   │   │   │   │   │   │   │   │   │   │   │   │
Track A: ████████████████ Foundation (P0+P1)
Track A:                 ████████████████ Phase 2 — Parties
Track A:                                 ████ P3 Markets
Track A:                                     ████████████████████████ P4 CRM/Sales/Quot
Track A:                                                            ████████ P5/P6 Log/Fin/Comp/Comms
Track A:                                                                    ████ P11 cleanup
                                                                            
Track B:                         ████████████████████ P7 UIM
Track B:                                             ████████████████████████ P8 AMRO
                                                                            
Track C:                     ████████████████ P9 LLM infra
Track C:                                     ████████████████████████████████ P10 LLM features (ongoing)
```

**Three teams**:
- **Track A**: commercial lifecycle (4-5 engineers)
- **Track B**: AMRO + UIM (3-4 engineers, ideally including AMRO domain SME)
- **Track C**: LLM infra + features (2-3 engineers)

Plus a **shared core team** (2 engineers) supporting Tracks A and B for cross-cutting concerns (auth, RLS, audit, etc.).

### 7.6 Per-tenant rollout strategy

For data-shape changes that touch live customer data, the rollout matrix:

| Wave | Tenants | Why |
|---|---|---|
| Wave 0 | Internal dev/staging | Catch bugs cheaply |
| Wave 1 | Smallest external tenant (least data) | Real but bounded blast radius |
| Wave 2 | Pilot design partners (per memory: 2 confirmed) | Trusted; high-touch support |
| Wave 3 | Tenants below median data-size | Easy migration; safety in numbers |
| Wave 4 | All remaining tenants | Confidence established |

Each wave gets a **2-week hold** before next wave starts. Total per-cut rollout: ~10 weeks of waves, but parallelisable across cuts.

### 7.7 Rollback runbooks

Every phase has a written rollback runbook. The shape:

```
For phase X step Y:
  Symptom that triggers rollback:
    - <e.g. acceptance_rate of party-merge < 95%>
  Rollback procedure:
    1. Set feature_flag <X.Y> to OFF
    2. <Schema-specific reversal steps>
    3. <Verify state> with <SQL>
  Communication template:
    - Slack: <channel> with <severity>
    - Customer comms: <template> if customer-facing
  Time budget: <e.g. 4 hours max>
  Lessons-learned doc: required within 1 week
```

Stored under `docs/plans/2026-05-28-modules/rollbacks/` (created in Phase 0).

### 7.8 Success metrics (per macro stage)

| Stage | Primary metric | Target |
|---|---|---|
| Foundation | `public.*` schema table count | Drops from 374 → ~250 at end of Phase 1 |
| Modules | Modules conformant to §2 contract | 11 of 11 by end of Phase 8 |
| Modules | God-component count (>1000 LOC) | Drops from 14 → 0 |
| Modules | Cross-module FK count | Drops from N (unknown — to be audited) → 0 |
| LLM | LLM calls writing to `core.llm_invocations` | 100% by end of Phase 9 |
| LLM | Tier-1 features shipped | 10/10 by month 18 |
| Throughout | RLS test coverage | ≥ 80% of tables by Phase 11 |
| Throughout | Test coverage for `services/*-api/` | ≥ 60% line coverage |
| Throughout | Manifest-registered routes | 100% by end of Phase 8 |

### 7.9 Open decisions for §7

1. **Team composition** — does the platform have the engineering headcount to staff 3 tracks + shared core? If not, sequence (slower) or augment (faster). **Recommend** sequence Track A first, then parallel Track B + Track C, given the design-partner commitments noted in memory.
2. **Buffer policy** — recommend +20% time budget per phase as buffer. Top-tier projects underestimate; this absorbs.
3. **Feature freeze during Phase 2 (Parties)** — should new features pause while parties migrate? **Recommend**: features may ship to non-`accounts/contacts` surfaces freely; features touching account/contact data wait for Phase 2 completion.
4. **Coexistence with active design partners** — Logistics + Aviation design partners are mentioned in memory. Coordinate Phase 4 (Quotation refactor) and Phase 8 (AMRO refactor) with their feature-request cadence; freeze refactor PRs during their critical milestones.
5. **Multi-region** — not in scope for this redesign, but Phase 11 (Cleanup) should leave the door open for future region-sharding. Schemas already include `tenant_id`; physical sharding is per-tenant.
6. **Cost of LLM infrastructure rollout** — initial overhead (no value yet). **Recommend** budget $5–10k/month during Phase 9 build-out for development LLM calls + observability tooling. Recovers in Phase 10 as features ship.

### 7.10 Day-1 starter actions

To take this design from "doc" to "shipping", the first 10 things to do:

1. Stand up `packages/event-contracts/`, `packages/llm-client/`, `packages/llm-prompts/`, `packages/llm-improver/` as empty packages with package.json + tsconfig + lint.
2. Add `eslint-plugin-import` rule banning direct `@anthropic-ai/sdk` / `openai` imports outside `packages/llm-client/**`.
3. Create the empty `core.*` schema migration.
4. Create the `core.audit_log` table + add shadow-write triggers on the top 5 existing audit tables.
5. Stand up a Kafka topic registry doc; reserve the first 20 event names.
6. Run a SQL audit to count cross-module FKs (Phase 7.8 success metric baseline).
7. Identify Wave 1 pilot tenant — smallest external tenant — confirm willingness.
8. Write the first rollback runbook (for Phase 1 audit-log shadow-write).
9. Schedule a sync with the AMRO domain SME to lock the UIM ↔ AMRO inventory boundary (Phase 7.4 decision).
10. Start the LLM-infrastructure spike: pick one existing AI call (`SmartCargoInput`), build the `packages/llm-client` skeleton, route the call through it, verify a `core.llm_invocations` row appears.

If items 1–10 are complete in **4 weeks**, the project is on track for the 12-month aggressive timeline.

---

## §8 — Production-readiness cross-cutting concerns

The 12-module redesign is necessary but not sufficient for "production-ready". Six platform-wide concerns must be designed at the same depth as the modules. Each subsection states the current state, the target contract, and what every module must do to comply.

### 8.1 Observability — tracing, logging, metrics, SLOs

**Today**: Sentry (`src/lib/sentry.ts`) + PostHog (`src/lib/posthog.ts`) initialised in `main.tsx`. No platform-wide structured-logging contract, no distributed tracing, no documented SLOs.

**Target contract**:

#### 8.1.1 Distributed tracing

OpenTelemetry across every service. Every request gets a trace; every cross-module event carries `traceparent` (W3C trace context) inside `metadata.tracing` of the event envelope. The §5.9 `correlation_id` is propagated alongside.

```jsonc
// extension to event envelope
"metadata": {
  "actor_user_id":      "...",
  "actor_kind":         "...",
  "correlation_id":     "01HG...",        // saga-level
  "causation_id":       "01HG...",        // upstream event
  "tracing": {
    "traceparent":      "00-<trace_id>-<span_id>-01",
    "tracestate":       "platform=v1"
  }
}
```

Traces ship to a vendor TBD (recommendation in §8.1.7). Required spans per service: HTTP-in, DB-out, Kafka-publish, Kafka-consume, LLM-invoke, external-API call.

#### 8.1.2 Structured logging

Single shared `packages/logger/` writes JSON to stdout with mandatory fields:

```jsonc
{
  "ts": "2026-05-28T...",
  "level": "info|warn|error",
  "service": "sales-api",
  "module": "sales",
  "tenant_id": "...",
  "user_id": "...|null",
  "correlation_id": "01HG...",
  "trace_id": "...",
  "span_id": "...",
  "event": "lead.created",
  "subject_type": "sales.lead",
  "subject_id": "...",
  "duration_ms": 42,
  "message": "..."
}
```

CI lint forbids `console.log` outside scripts. Loggers can never log PII fields (`email`, `phone`, `tax_id`) — a redaction wrapper enforces.

#### 8.1.3 Metrics (Prometheus-compatible)

Every service emits:

| Metric | Type | Per-module variant |
|---|---|---|
| `http_requests_total{method, route, status}` | counter | + `module` label |
| `http_request_duration_seconds{route}` | histogram | + `module`, `p50/p95/p99` |
| `db_query_duration_seconds{table, op}` | histogram | + `module` |
| `kafka_messages_produced_total{topic}` | counter | + `module` |
| `kafka_messages_consumed_total{topic, status}` | counter | + `consumer_module` |
| `llm_invocations_total{prompt_key, model, status}` | counter | + `module` |
| `outbox_lag_seconds{module}` | gauge | per-service |
| `event_dlq_size{topic}` | gauge | per-consumer |

#### 8.1.4 SLOs (per module, declared in manifest.ts)

Every module's `manifest.ts` declares its SLOs:

```ts
export const manifest = {
  name: 'sales',
  slos: {
    api_availability:     { target: 99.9,  window: '30d' },
    api_p95_latency_ms:   { target: 500,   window: '7d',  routes: ['POST /leads', 'GET /opportunities/:id'] },
    event_dispatch_p95_seconds: { target: 5, window: '7d' },
    llm_acceptance_rate:  { target: 0.6,   window: '30d', features: ['lead_scoring'] }
  }
}
```

SLO breaches fire `core.notifications` events to the module's on-call rotation. SLO compliance is a P11 success metric (§7.8).

#### 8.1.5 Alerting

Alerts route via `core.notifications` with severity tiers:

| Severity | Audience | Response time |
|---|---|---|
| `page` | Module on-call (PagerDuty / Opsgenie) | < 15min |
| `ticket` | Module Slack channel + ticket queue | next business day |
| `digest` | Weekly summary email | weekly |

Alert rules live in `services/<module>-api/alerts/` as declarative YAML; a shared alert-rule linter enforces format.

#### 8.1.6 Audit trail compatibility

Tracing + audit log work together: `core.audit_log` rows include `trace_id` for cross-reference. A single SQL query joins `audit_log ↔ llm_invocations ↔ outbox` via `correlation_id` + `trace_id` for full saga reconstruction.

#### 8.1.7 Open decisions

| Decision | Options | Recommendation |
|---|---|---|
| Tracing vendor | Datadog / Honeycomb / Grafana Tempo / Jaeger self-hosted | **Grafana Tempo + Prometheus + Loki** — open-source stack, runs on existing Coolify (per memory), no per-seat lock-in |
| Log storage | Loki / CloudWatch / Datadog | Loki (matches above) |
| PagerDuty vs Opsgenie | Both | Opsgenie (cheaper per-seat for small teams) |

#### 8.1.8 What every module must do

- Wire `packages/logger/` (no console.log)
- Wire OpenTelemetry SDK; emit the required spans
- Declare SLOs in manifest.ts
- Ship alert YAMLs in `alerts/`
- Pass the observability-conformance CI check

### 8.2 Tenant module-access configuration

**Today**: Two parallel mechanisms — `requiredDomainCode="AMRO"` (used by AMRO, Markets) and `moduleCode="logistics.shipments"` (used by Logistics). No admin UI to enable/disable a module per tenant. No tie to billing.

**Target**:

#### 8.2.1 Schema

```sql
core.modules (
  module_code        text PK,                       -- 'sales','crm','quotation','logistics','finance','compliance','comms','amro','uim','markets'
  display_name       text,
  description        text,
  category           text,                          -- 'commercial','operational','regulatory','communications','platform'
  default_enabled    boolean DEFAULT false,         -- ships enabled on new tenants
  required_for_modules text[],                       -- transitive deps (e.g. 'logistics' requires 'sales')
  is_billable        boolean DEFAULT true,
  min_plan_tier      text                            -- 'free','basic','pro','enterprise'
)

core.tenant_module_access (
  tenant_id          uuid REFERENCES core.tenants(id),
  module_code        text REFERENCES core.modules(module_code),
  status             text NOT NULL,                  -- 'trial','active','suspended','cancelled'
  enabled_at         timestamptz,
  trial_ends_at      timestamptz,
  config             jsonb,                          -- per-tenant per-module config knobs
  PRIMARY KEY (tenant_id, module_code)
)
```

#### 8.2.2 The unified gate

Both `requiredDomainCode` and `moduleCode` route guards rewrite to a single mechanism:

```tsx
<ProtectedRoute requiredModule="logistics" requiredAction="read">
  <Shipments />
</ProtectedRoute>
```

Under the hood: `core.has_module_access(tenant_id, 'logistics', 'read')` — already defined in §2.3.

Navigation menus, search results, command palette — all filter by the same gate.

#### 8.2.3 Admin UI

`/admin/tenants/:tenant_id/modules` — toggle modules on/off, set status (trial/active/suspended), configure per-module settings. Changes write `core.audit_log` rows.

`/admin/modules` — module catalogue (super-admin only); add new modules, set defaults, define plan-tier mappings.

#### 8.2.4 Tie to billing

`finance.subscriptions.plan_id` → includes a `modules_included` array. Subscription state changes propagate to `core.tenant_module_access.status`:

- New paid subscription → `active`
- Subscription cancelled → `suspended` (read-only, 30-day grace)
- Final cancellation → `cancelled` (no access; data retained per retention policy)

#### 8.2.5 What every module must do

- Use `requiredModule={module_code}` route prop exclusively
- Read `core.tenant_module_access` config (not its own settings table) for tenant feature flags
- Subscribe to `core.tenant_module_access.changed` event to invalidate caches

### 8.3 CI/CD pipeline depth

**Today**: Jenkinsfile (modified in git status as of this design). Coolify deployments for some services per memory. No unified per-service deploy story.

**Target**: per-service pipelines with shared library, DB migration safety gates, canary deploys.

#### 8.3.1 Per-service pipeline shape

Each `services/<module>-api/` ships a `Jenkinsfile` (or `.github/workflows/<module>.yml`) using a shared library:

```groovy
@Library('platform-pipeline') _

modulePipeline {
  module = 'sales'
  language = 'node'
  runTests = true
  lintRules = ['no-direct-llm-sdk', 'no-cross-module-fk', 'manifest-registered']
  dbMigration = 'expand-contract'    // see §8.3.2
  deployStrategy = 'canary'           // see §8.3.3
  rollbackOnSloBreach = true
}
```

The shared library enforces the platform contract — no service can deploy bypassing the lint suite.

#### 8.3.2 DB migration safety (expand-contract)

Every schema change is **two-phase**:

| Phase | Migration shape | Deploy window |
|---|---|---|
| **Expand** | Add new column/table/FK as nullable. Read paths handle both old + new. | Deploy N → N+1; safe to rollback |
| **Cutover** | Backfill data. Application code switches reads to new shape. | Deploy N+1; old + new code both work |
| **Contract** | Drop old column/table. Application code only reads new shape. | Deploy N+2; previous version no longer deployable |

CI gate: a migration that drops a column referenced in the current `HEAD` build is **rejected at PR time**. The lint walks AST + migration SQL.

Recovery rule: rolling back deploy N+2 to N+1 is always safe. Rolling back to N is safe **only if no writes happened to the new shape** (logged via the dual-write check from §7.2(1)).

#### 8.3.3 Canary deploys

Per-service deploys roll out:

1. **Canary 5%** — 30 minutes; auto-rollback if SLO breaches (§8.1.4)
2. **Canary 25%** — 2 hours
3. **Full rollout** — remaining 70%

Feature-flag toggles (`core.feature_flags`) let modules ship code dark, enable per-tenant. Distinct from deploy-rollout.

#### 8.3.4 Per-service ownership in CODEOWNERS

```
/services/sales-api/                @sales-team
/services/quotation-api/            @quotation-team
/services/amro-api/                 @amro-team @aviation-sme
/packages/llm-prompts/sales/        @sales-team
/packages/llm-prompts/amro/         @amro-team @aviation-sme
/supabase/migrations/               @core-team @<owning-module-team>
```

Every PR must have approval from the owning module + the core team if migrations are touched.

#### 8.3.5 What every module must do

- Provide a `services/<module>-api/Jenkinsfile` using the shared library
- Maintain CODEOWNERS entries
- Tag schema migrations with `expand:` / `cutover:` / `contract:` in commit messages
- Emit deploy events to `core.audit_log` (subject_type='platform.deploy')

### 8.4 Performance & caching

**Today**: No platform-wide caching layer. Frontend reads Supabase directly through RLS, which means every page paint is N database queries. No documented query budgets, no N+1 audit, no connection-pool sizing.

**Target**: tiered cache + per-route latency budgets + N+1 detection + connection pooling.

#### 8.4.1 Cache tiers

| Tier | What | Where |
|---|---|---|
| **L1 (in-process)** | Request-scoped memoisation: `core.has_module_access`, prompt lookups, party FK resolution | Inside each `services/<module>-api/` |
| **L2 (Redis)** | Hot reads: party-by-id, current-on-hand-per-item (UIM), tenant_module_access, RLS-resolved permission set | Shared Redis cluster |
| **L3 (CDN)** | Static assets, public quote portals, signed-URL files | Cloudflare/Coolify |
| **DB read replicas** | Heavy reports, analytics dashboards | Supabase read replicas |

Cache invalidation rules **always tied to events**:
- `core.party.updated` → invalidate L2 key `core:party:{tenant_id}:{party_id}`
- `core.tenant_module_access.changed` → invalidate L2 key `core:module_access:{tenant_id}`
- LLM prompt-cache: keyed on `(prompt_key, version, normalised_variables)`; TTL per prompt-frontmatter

#### 8.4.2 Per-route latency budgets

Every route in every module declares its budget:

```ts
// services/sales-api/src/routes/leads.routes.ts
router.get('/leads/:id', {
  budgets: { p50: 100, p95: 400, p99: 1000 },  // milliseconds
}, async (req, res) => { ... })
```

CI lint enforces budgets exist. Prometheus alert fires when realised P95 > declared P95 for 3 consecutive 5-minute windows.

#### 8.4.3 Index strategy per module

Every module's subdoc §3 schema includes recommended indexes alongside table DDL. Examples:

```sql
-- sales.leads
CREATE INDEX idx_leads_tenant_owner ON sales.leads (tenant_id, owner_user_id) WHERE status NOT IN ('converted','disqualified');
CREATE INDEX idx_leads_assigned_team ON sales.leads (tenant_id, assigned_team_id) WHERE assigned_team_id IS NOT NULL;
CREATE INDEX idx_leads_score ON sales.leads (tenant_id, score DESC) WHERE status='qualified';

-- logistics.shipments
CREATE INDEX idx_shipments_status_etd ON logistics.shipments (tenant_id, status, etd);
CREATE INDEX idx_shipments_exception ON logistics.shipments (tenant_id) WHERE exception_flag=true;
```

Per-module deliverable in P0: each subdoc's §3 amended with full index list. CI gate: a new table without explicit indexes fails review.

#### 8.4.4 N+1 detection in CI

`packages/db-types-<module>/` exposes a typed query client that **counts queries per request**. Test suite asserts max-queries per route. PRs that introduce N+1 fail CI.

For frontend reads through Supabase RLS, an instrumentation wrapper in `src/integrations/supabase/client.ts` counts queries per page-view in dev mode; Storybook stories that exceed thresholds fail.

#### 8.4.5 Connection pooling

PgBouncer in front of Postgres. Per-service pool sizes:

| Service | Max connections | Pool mode |
|---|---|---|
| `core-platform-api` (admin only) | 20 | transaction |
| `sales-api`, `crm-api`, `quotation-api`, `logistics-api` | 50 each | transaction |
| `finance-api`, `compliance-api` | 30 each | transaction (financial integrity) |
| `comms-api`, `uim-api` | 100 each (high-volume) | transaction |
| `amro-api` | 80 | transaction |
| `markets-worker` (Python) | 40 | transaction |

Connection budget per tenant: rate-limited via `pgbouncer` config.

#### 8.4.6 Open decisions

| Decision | Recommendation |
|---|---|
| Redis vendor | Upstash (serverless) for prod; self-hosted in Coolify for dev |
| Read replicas | Supabase replica add-on; defer until P95 latency justifies cost |
| CDN | Cloudflare (already in use per memory for marketing sites) |

### 8.5 Authentication & authorization depth

**Today**: Supabase Auth + OAuth (Google, Microsoft per recent commits `fad2efe4`, `61ee5525`). Per-domain signup pages. Membership chooser at login. Tenant-aware OAuth provisioner.

**Target**: extends today's OAuth foundation with enterprise SSO, API keys, service-to-service auth, MFA for sensitive roles.

#### 8.5.1 User authentication paths

| Path | When | Provider |
|---|---|---|
| Email/password | Default | Supabase Auth |
| OAuth (Google, Microsoft) | Already shipped | Supabase Auth + provisioner |
| **SSO (SAML 2.0)** | Enterprise plan tenants | WorkOS (or Auth0) federated into Supabase Auth |
| **OIDC (custom IdP)** | Enterprise plan tenants with their own IdP | Same |
| **Passkey / WebAuthn** | Optional 2FA | Supabase Auth native |
| **TOTP MFA** | Required for sensitive roles | Supabase Auth native |

#### 8.5.2 Service-to-service authentication

Internal calls between `services/<module>-api/` use a **short-lived service JWT** signed by core. Each service has a credential in `core.secrets`; on startup it requests a JWT; tokens rotate hourly.

Inter-service network: mTLS at the ingress (Coolify-managed) but service code uses JWT for application-level identity.

#### 8.5.3 API keys (programmatic access)

```sql
core.api_keys (
  id                 uuid PK,
  tenant_id          uuid NOT NULL,
  key_prefix         text NOT NULL,                 -- visible part: 'sk_live_abc...'
  key_hash           text NOT NULL,                 -- bcrypt of full key
  name               text,                          -- 'Salesforce Sync', 'Mobile App'
  scopes             text[],                        -- ['sales:read','logistics:read']
  rate_limit_qps     int DEFAULT 50,
  expires_at         timestamptz,
  last_used_at       timestamptz,
  revoked_at         timestamptz,
  created_by         uuid REFERENCES core.users(id),
  created_at
)
```

API key auth path: header `Authorization: Bearer sk_live_...`. Middleware validates, attaches `auth.api_key_id` + `auth.tenant_id`. Scopes enforced against `core.has_module_access()` with `actor_kind='api_key'`.

#### 8.5.4 MFA requirements per role

Sensitive roles require MFA at login:

| Role | MFA required | Step-up MFA on action |
|---|---|---|
| `tenant_admin` | Yes | Deleting users, changing billing |
| `compliance_officer` | Yes | Overriding a `failed` screening |
| `finance_admin` | Yes | Manual GL entries, refund > $10k |
| `amro_certifying_engineer` | Yes | Signing CRS / Form 1 |
| Standard user | Optional | — |

Step-up MFA is a re-prompt for TOTP/passkey at the action moment, not just at login.

#### 8.5.5 Session lifecycle

- Access tokens: 1 hour TTL
- Refresh tokens: 30 days (tenant_admin: 7 days; sensitive roles: 1 day)
- Idle timeout: 30 minutes for tenant_admin + sensitive roles; 24h others
- Session revocation: tenant_admin can revoke any session from `/admin/tenants/:id/users/:uid/sessions`
- Concurrent session limit: 5 per user (configurable per role)

#### 8.5.6 What every module must do

- Use `auth.jwt_*` helpers exclusively — never query `auth.users` directly
- Check `auth.has_role()` for role gates; `auth.requires_mfa()` for step-up
- Tag API key calls in audit_log (`actor_kind='api_key'`)

### 8.6 Disaster recovery, backups, data residency

**Today**: Supabase point-in-time recovery (assumed; verify config). No documented RTO/RPO. No multi-region. Memory mentions India tenants (DPDP) and global users — data residency is implicit.

**Target**: per-module RTO/RPO, verified backup/restore, region-pinning, ransomware/corruption response.

#### 8.6.1 RTO / RPO per module category

| Module category | RTO | RPO | Rationale |
|---|---|---|---|
| **Regulatory** (amro, compliance, finance) | 1 hour | 5 minutes | Regulatory audit / financial integrity |
| **Customer-active** (markets — retail trading) | 15 minutes | 1 minute | SEBI deadline implications |
| **Commercial** (sales, quotation, logistics, crm) | 2 hours | 15 minutes | Revenue cycle continuity |
| **Cross-cutting** (comms, uim) | 4 hours | 30 minutes | Recoverable through replay of source events |
| **Platform** (core) | 30 minutes | 1 minute | Everything else depends on it |

#### 8.6.2 Backup strategy

| Layer | Mechanism |
|---|---|
| Postgres | Supabase PITR (point-in-time recovery, 30-day retention) + daily snapshots to cross-region S3 |
| Files (`core.files`) | Supabase Storage replicated to a second region (or S3 cross-region replication if migrated off Supabase Storage) |
| Kafka | Cluster replication to passive secondary; topic retention 7 days minimum |
| Secrets (`core.secrets`) | Encrypted backups; key-encryption-key stored separately |

**Monthly restore drill**: a `core-platform-api` job restores the previous month's backup to a sandbox, runs a verification suite (row counts, integrity checks, sample queries per module). Audit log records the drill. **Untested backups are not backups.**

#### 8.6.3 Data residency

`core.tenants` has a `residency_region` field. Migrations and pgbouncer routing direct each tenant's reads/writes to its pinned region's database cluster.

| Region | Tenants | Provider region |
|---|---|---|
| `ap-south-1` | India tenants (DPDP) | Supabase + Coolify ap-south-1 |
| `eu-west-1` | EU tenants (GDPR) | Supabase + Coolify eu-west-1 |
| `us-east-1` | Default / US tenants | Supabase + Coolify us-east-1 |

Memory mentions Hostinger VPS for production — region selection per tenant remains; provider may vary.

Cross-region replication for DR backups only (not active read/write).

#### 8.6.4 Ransomware / corruption response

| Scenario | Response |
|---|---|
| **Provider outage** (Supabase / Anthropic down) | Modules with fallback paths (`fallback_model` in prompt frontmatter for LLM) continue. Others surface "degraded mode" banners. Document per-module degraded behaviour. |
| **Regional outage** | Failover to backup region — RTO per §8.6.1. Manual decision; not auto-failover (avoids split-brain). |
| **Data corruption (single tenant)** | Restore tenant's data from PITR to point before corruption. Replay subsequent events from Kafka. RPO: 5min – 30min depending on module. |
| **Ransomware (compromised credentials)** | Rotate all credentials in `core.secrets`; revoke all sessions; restore from clean backup; force MFA re-enrollment. Incident-response runbook in `docs/runbooks/`. |

#### 8.6.5 Right to deletion (GDPR / DPDP)

When a user/tenant requests deletion:
1. Soft-delete in `core.users` / `core.tenants` (status='deletion_pending')
2. 30-day grace period (allow undo)
3. Hard-delete: cascade `core.audit_log.scrub_pii()` across all subject types
4. Backup retention: PII scrubbing applies retroactively at next monthly backup verification
5. Compliance certificate emitted to `core.audit_log` confirming deletion

`finance.invoices` retention overrides — regulatory requirement to keep records 7 years even after user deletion (anonymise instead of delete).

#### 8.6.6 What every module must do

- Declare RTO/RPO in `manifest.ts`
- Document degraded-mode behaviour (what works if Postgres/Kafka/LLM provider is down)
- Implement `<module>.scrub_pii(subject_id)` for right-to-deletion
- Include in monthly restore drill rotation

---

## Appendix A — Tier B: deferred design areas

These are real concerns but **intentionally deferred** to follow-on design efforts. Each gets one paragraph here so it's not forgotten; full design happens when the corresponding workstream activates.

### A.1 Platform-wide search (Cmd+K)

Users expect unified search across leads / quotes / shipments / parts / contacts / messages. Today each module has its own filter UI; no command palette. **When to design**: after Phase 4 (CRM/Sales/Quotation modules conformant) — search depends on a stable read-model surface. **Approach**: Postgres full-text + materialised search index per module, federated by a `core-search-api` that respects `core.has_module_access()`. **Owner**: a shared search team (or whichever team lights it up first).

### A.2 Mobile / Capacitor (Sthira) module contract

Sthira native shell is in production (memory references commits `25ce4774`, FCM, keystore rotation 2026-05-26). The shell consumes Markets today; with the new module contract, mobile must consume any module's read API. **When to design**: in parallel with Phase 3 (markets conformance) — Sthira already targets markets, so the mobile-contract draft can use markets as the first compliant example. **Approach**: define a `module.mobile_capabilities` manifest field (push notifications, deep links, offline-cache hints); standardise the auth handshake for Capacitor; document the existing `dev:tunnel:check` path. **Owner**: the Sthira team.

### A.3 Internationalization & timezone

`src/lib/i18n` exists per CLAUDE.md. No localization plan in any module subdoc; finance handles currency but not timezone. **When to design**: before the first non-English tenant onboards. **Approach**: ICU MessageFormat strings extracted from every module's UI to per-module `locale/<lang>.json`; timezone stored on `core.users.preferred_timezone` and `core.parties.preferred_timezone`; all timestamps stored UTC, rendered tenant/user-local. **Owner**: shared platform team — needs cross-module string extraction.

### A.4 Bulk import / migration tooling

Every module has `ImportExport` pages but no shared CSV-validation framework, dry-run preview, or rollback. **When to design**: during Phase 4 or Phase 5 when the first big real-world tenant import lands. **Approach**: a `packages/bulk-import/` with module-pluggable schema mappers, dry-run mode that produces a diff preview, and a saga that writes through the same events as manual creation. Idempotency keys per row. **Owner**: shared platform team.

### A.5 API versioning for external consumers

Public surfaces (portals, partner integrations, the `core.api_keys` API key holders) need a deprecation policy. **When to design**: after first external partner integration goes live. **Approach**: URL versioning (`/v2/...`) for breaking changes; additive changes don't bump versions; deprecated versions are kept 12 months minimum with a deprecation header. CHANGELOG.md per service. **Owner**: per-service team; standards from shared platform team.

### A.6 Reporting & BI / data warehouse

Per-module analytics pages exist but no cross-module reporting. **When to design**: after Phase 6 when enough modules emit events for cross-module insights to be meaningful. **Approach**: CDC (Debezium or Supabase Realtime → Kafka → warehouse) into a managed warehouse (recommend BigQuery for India/global pricing; Snowflake is overpriced for current scale); Metabase or Superset for dashboarding; tenant-isolated through warehouse-level row policies. **Owner**: dedicated data-eng workstream.

### A.7 Subscription management depth

Finance covers `subscription_invoices` lightly. Self-serve plan upgrades/downgrades, feature-flags-per-plan-tier, usage-based billing for LLM calls (the natural revenue model now that we track `core.llm_usage`) — open. **When to design**: when commercial team is ready to launch a self-serve plan. **Approach**: extend `finance.subscriptions` + `finance.subscription_plans`; introduce `finance.plan_entitlements` for what each tier includes; usage-based billing job runs monthly against `core.llm_usage`. **Owner**: Finance module team + product.

### A.8 Onboarding flow

`src/features/onboarding/` exists per audit. No design for tenant signup → first-value flow in this redesign. **When to design**: aligned with subscription-management depth (A.7). **Approach**: per-domain signup pages already exist (per memory: domain-aware OAuth provisioner); extend into a guided first-week tour that activates module features as tenant progresses; email-onboarding series via Comms templates; success metrics (time-to-first-lead-created, time-to-first-quote-sent). **Owner**: growth team + Comms module team.

### A.9 Local development experience

After splitting into 8+ services, `npm run dev` needs revisiting. Current `scripts/service-orchestrator.mjs` orchestrates today; needs extension. **When to design**: in parallel with Phase 0 (foundation packages). **Approach**: Docker Compose for local Kafka + Redis + Postgres; per-service hot reload via `tsx watch`; shared `.env.local` template; recommend Tilt or Skaffold if developer-experience pain grows. **Owner**: developer-experience workstream / shared platform team.

---

## Appendix B — Tier C: nice-to-have follow-on documents

These are not designed here but tracked as separate future design efforts. Each becomes its own `docs/plans/<date>-<topic>-design.md` when activated.

### B.1 Accessibility (a11y) standards
WCAG 2.2 AA target. Per-component a11y checklist; axe-core linting in CI; keyboard-navigation tests; screen-reader audits per module. Activate when product targets a public-sector or enterprise customer with formal a11y procurement requirements.

### B.2 SEO for public pages
Portal-quote, vendor portal, customer portal are public-accessible. Today they're SPA-rendered; SEO requires SSR or pre-rendering. Activate when public portals become a discovery surface (e.g., partner-shared quote links circulating organically).

### B.3 Module Author's Guide
A concrete walk-through for someone building module #12 (e.g., a future Procurement or HR module). Distills §2 contract + per-module subdoc shape + boilerplate generator (`yarn create-module <name>`). Activate when first new module after this redesign is proposed.

### B.4 Anti-patterns & common mistakes guide
Extends §5.13 with a catalogue of mistakes seen in code review: bypassing `packages/llm-client`, querying `auth.users` directly, embedding business logic in RLS policies, etc. Activate after 3 months of post-redesign code review when patterns of bad attempts emerge.

### B.5 Cost model & unit economics
Per-tenant infrastructure attribution: compute, storage, Kafka, Redis, LLM tokens, observability. Drives pricing-tier design (Tier B.7). Activate when commercial pricing is being formalised.

### B.6 Error taxonomy & user-facing error message guidelines
Cross-module error code registry; user-facing message style (tone, actions, support-link inclusion); error-message localization. Activate as a phase of A.3 (i18n).

---


---
