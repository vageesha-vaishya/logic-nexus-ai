# `crm` — Customer Relationship Management

**Date:** 2026-05-28
**Status:** Draft — under review
**Depends on:** `core`
**Closely related:** `sales` (lifecycle predecessor), `comms` (engagement delivery)
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose

`crm` is the **relationship-management layer**: how the platform engages with customers and prospects over time. After the §2 contract lands, CRM owns *much less* than the current `src/components/crm/` directory implies. Specifically:

- **Leads, lead scoring, opportunities, pipelines move to `sales`**.
- **Quotations move to `quotation`**.
- **Accounts and Contacts as entities cease to exist** — replaced by `core.parties` + thin extension tables.

What remains in CRM: **activities** (calls, emails, meetings, notes — the engagement log), **campaigns** (multi-touch outreach), **segments / lists** (cohorts of parties), and the CRM-specific extension fields on parties.

---

## 2. Current state (evidence)

### 2.1 Frontend

| Path | Notes |
|---|---|
| `src/features/module-crm/` | Manifest stub only — `manifest.ts`, `index.ts`, 1 page (`CRMWorkspaceVerticalPage.tsx`). Phase 0 module not wired in. |
| `src/components/crm/` | **36 components, ~11,946 LOC.** Most of this is Lead/Opportunity/Quotation code that moves out under the new boundaries. |
| `src/pages/dashboard/` | 32 CRM-routed pages (Accounts, Contacts, Leads, Opportunities, Activities, Campaigns + Legacy variants). |

**Components that stay in CRM after refactor:**

| Component | LOC | Notes |
|---|---|---|
| `ActivityForm.tsx` | 552 | Refactor target — should split into typed activity panels (call / email / meeting / note / task) |
| `LeadActivitiesTimeline.tsx` | 668 | Rename → `crm/PartyActivitiesTimeline.tsx`; activities are no longer lead-specific |
| `ActivityBoard.tsx` | 232 | Keeps |
| `AccountForm.tsx` | 367 | Becomes `PartyOrganizationForm.tsx`; the "account" concept is folded into `core.parties` |
| `ContactForm.tsx` | 469 | Becomes `PartyPersonForm.tsx` |
| `UnifiedPartnerForm.tsx` | 702 | Already a unified party form — strongest fit; refactor into the canonical party editor |
| `CustomerSegmentation.tsx` | 210 | Keeps — the segments feature |
| `DocumentRepository.tsx` | 210 | Moves to use `core.files`; UI keeps |
| `TeamAssignment.tsx`, `TaskScheduler.tsx` | 155, 166 | Keep |
| `AdvancedFilter.tsx`, `SearchableSelect.tsx` | 329, 171 | UI primitives — keep |
| `CRMModuleHeaderNavigation.tsx` | 308 | Keeps |

**Components that LEAVE CRM:**

| Component | LOC | Destination |
|---|---|---|
| `LeadWorkspaceSections.tsx` | 1570 | → `sales` |
| `LeadForm.tsx` | 997 | → `sales` |
| `LeadConversionDialog.tsx` | 735 | → `sales` (creates `core.parties` + `crm.account_extensions`) |
| `LeadCard.tsx`, `LeadsPipelineComponents.tsx`, `LeadScoringCard.tsx`, `LeadsMasterDataFormModal.tsx` | — | → `sales` |
| `OpportunityForm.tsx`, `OpportunityHistoryTab.tsx`, `OpportunityItemsEditor.tsx`, `OpportunitySelectDialog*` | — | → `sales` |

### 2.2 Backend

- No CRM backend routes for accounts/contacts/activities/campaigns. All frontend → Supabase via RLS.
- `services/crm-api/src/routes/leads.routes.ts` exists but **moves to `services/sales-api/`** under the new boundary.
- A new `services/crm-api/` is built from scratch for activities + campaigns + segments.

### 2.3 Tables (today)

| Table | Status | After refactor |
|---|---|---|
| `public.accounts` | **Killed.** | View: `crm.account_extensions` JOIN `core.parties` filtered to organizations |
| `public.account_notes` | Moves | `core.audit_log` (notes are audit-trail entries) |
| `public.account_references` | Moves | `core.parties.external_refs` jsonb |
| `public.account_relationships` | Moves | `core.party_relationships` |
| `public.contacts` | **Killed.** | View: `crm.contact_extensions` JOIN `core.parties` filtered to persons |
| `public.activities` | Moves | `crm.activities` (with FK to `core.parties.id` not `accounts.id`) |
| `public.lead_activities` | Merged | Into `crm.activities` (lead is just one of the polymorphic subject types) |
| `campaigns` table | **Does not exist** — page is broken. | Create `crm.campaigns` + `crm.campaign_members` |
| `public.admin_override_audit` | Stays | `core.audit_log` |
| `crm.tag` (existing single table) | Absorbed | `core.tags` |

### 2.4 Legacy duplicates

- `src/pages/dashboard/AccountDetailLegacy.tsx` + `AccountDetailLegacy.tsx` route at `/dashboard/accounts/:id?legacy=1` — **delete both** during refactor; party-detail page replaces them.
- `src/pages/dashboard/ContactDetailLegacy.tsx` — same.

### 2.5 LLM presence in CRM today

- `src/components/email/EmailToLeadDialog.tsx` — AI-assisted email-to-lead extraction. **This belongs in `sales` (lead capture) post-refactor**, not CRM.
- `src/hooks/useAiAdvisor.ts` — consumed only by Quotation components today (`composer/ChargesManagementStep.tsx`, `composer/QuoteDetailsStep.tsx`). Not used by CRM.
- **CRM itself has zero AI features today.** Several obvious ones to add — see §8.

---

## 3. Target schema (`crm.*`)

```sql
-- Party extensions (CRM-specific columns layered onto core.parties)
crm.account_extensions (
  party_id              uuid PK REFERENCES core.parties(id),
  tenant_id             uuid NOT NULL,
  industry              text,
  account_owner_user_id uuid REFERENCES core.users(id),
  lifecycle_stage       text,   -- 'mql','sql','customer','churned'
  annual_revenue        numeric,
  employee_count        int,
  customer_since        date,
  health_score          int,    -- computed
  created_at, updated_at
)

crm.contact_extensions (
  party_id              uuid PK REFERENCES core.parties(id),
  tenant_id             uuid NOT NULL,
  primary_account_id    uuid REFERENCES core.parties(id),  -- the org they work for
  job_title             text,
  department            text,
  contact_owner_user_id uuid REFERENCES core.users(id),
  preferred_channel     text,   -- 'email','phone','sms','whatsapp'
  do_not_contact        boolean DEFAULT false,
  created_at, updated_at
)

-- Activity-type lookup (avoids CHECK-constraint drift)
crm.activity_types (
  code               text PK,              -- 'call','email','meeting','note','task','sms','whatsapp',
                                           --  'quote_view','shipment_alert','document_signed','portal_login','system'
  category           text,                 -- 'engagement','system','milestone'
  display_label      text NOT NULL,
  icon               text,
  is_user_authored   boolean DEFAULT true  -- false for system-emitted entries from subscribed events
)

-- Activities (the polymorphic engagement log)
crm.activities (
  id                 uuid PK,
  tenant_id          uuid NOT NULL,
  activity_type      text NOT NULL,        -- see crm.activity_types lookup table; no CHECK, enum drift is real
  subject_type       text NOT NULL,        -- schema-qualified per §2.4 convention: 'core.party','sales.lead','sales.opportunity','quotation.quote','logistics.shipment','amro.work_order'
  subject_id         uuid NOT NULL,
  occurred_at        timestamptz,
  duration_seconds   int,
  direction          text,   -- 'inbound','outbound'
  outcome            text,
  body               text,
  body_html          text,
  participants       jsonb,  -- {users:[uuid], parties:[uuid], external:[email]}
  created_by         uuid REFERENCES core.users(id),
  created_at, updated_at
)
CREATE INDEX ON crm.activities (tenant_id, subject_type, subject_id, occurred_at DESC);

-- Campaigns (the campaigns table that didn't exist)
crm.campaigns (
  id                 uuid PK,
  tenant_id          uuid NOT NULL,
  name               text NOT NULL,
  campaign_type      text,    -- 'email','multichannel','event','ad'
  status             text,    -- 'draft','active','paused','completed'
  start_at, end_at   timestamptz,
  goal               text,
  budget             numeric,
  owner_user_id      uuid REFERENCES core.users(id),
  created_at, updated_at
)
crm.campaign_members (
  id, tenant_id, campaign_id, party_id, status,
  enrolled_at, completed_at, last_touched_at
)

-- Segments / lists
crm.segments (
  id, tenant_id, name, description,
  segment_type      text,     -- 'static','dynamic'
  criteria          jsonb,    -- for dynamic: a query DSL
  owner_user_id, created_at, updated_at
)
crm.segment_members (
  id, tenant_id, segment_id, party_id, added_at, added_by
)
```

**No `crm.accounts` or `crm.contacts` tables.** Always join `core.parties` + `crm.*_extensions`. Two views ship for ergonomics:

```sql
CREATE VIEW crm.v_accounts AS
  SELECT p.*, e.*
  FROM core.parties p
  JOIN crm.account_extensions e ON e.party_id = p.id
  WHERE p.party_type = 'organization';

CREATE VIEW crm.v_contacts AS
  SELECT p.*, e.*
  FROM core.parties p
  JOIN crm.contact_extensions e ON e.party_id = p.id
  WHERE p.party_type = 'person';
```

Apps and reports use the views; mutations go through service endpoints.

---

## 4. RLS strategy

```sql
-- Account-extension visibility: any user in CRM + tenant + (owner or sales-team relation)
CREATE POLICY view_account_ext ON crm.account_extensions FOR SELECT USING (
  tenant_id = auth.jwt_tenant_id()
  AND core.has_module_access(tenant_id, 'crm', 'read')
  AND (account_owner_user_id = auth.uid() OR auth.has_role(tenant_id, 'crm_team_lead'))
);
```

Activities follow the visibility of their subject (computed via a security-definer function `crm.activity_visible(activity_id, user_id)` that delegates to the owning module's visibility rule).

---

## 5. Events

### Published

| Event | When |
|---|---|
| `crm.activity.logged` | Any activity inserted |
| `crm.activity.completed` | Task or meeting closed |
| `crm.campaign.launched` / `crm.campaign.completed` | Campaign lifecycle |
| `crm.campaign_member.enrolled` / `crm.campaign_member.converted` | Member transitions |
| `crm.segment.refreshed` | Dynamic segment re-evaluated |
| `crm.account_extension.created` / `.lifecycle_stage_changed` | Account events |
| `crm.do_not_contact.set` | Important for Comms — gates outbound |

### Subscribed

| Event | Consumer logic |
|---|---|
| `core.party.created` (party_type=organization) | Auto-create `crm.account_extensions` shell |
| `core.party.created` (party_type=person) | Auto-create `crm.contact_extensions` shell |
| `sales.lead.converted` | Update `account_extensions.lifecycle_stage = 'sql'` |
| `sales.opportunity.won` | Update `account_extensions.lifecycle_stage = 'customer'` |
| `quotation.quote.viewed` | Log a `crm.activities` row (activity_type='quote_view') |
| `logistics.shipment.exception` | Log a `crm.activities` row (activity_type='shipment_alert'), notify owner |
| `comms.email.received` (matched to party) | Log inbound email as `crm.activities` |

---

## 6. UI surface

Refactored routes — replacing the today's Account/Contact/Activity surface:

| Route | Old equivalent | Notes |
|---|---|---|
| `/dashboard/crm` | `/dashboard/crm-workspace` (App.tsx:1092) | Module home — pipelines / dashboards |
| `/dashboard/crm/parties` | `/dashboard/accounts` + `/dashboard/contacts` | Unified party browser; filter by type |
| `/dashboard/crm/parties/:id` | `/dashboard/accounts/:id` + `/dashboard/contacts/:id` | One canonical party-detail page (replaces both Legacy + non-Legacy variants) |
| `/dashboard/crm/activities` | `/dashboard/activities` | Timeline + board views |
| `/dashboard/crm/activities/:id` | `/dashboard/activities/:id` | Detail |
| `/dashboard/crm/campaigns` | `/dashboard/campaigns` | Campaigns home (broken today — no DB) |
| `/dashboard/crm/campaigns/:id` | (new) | Campaign builder + member list |
| `/dashboard/crm/segments` | (new) | Segments / lists management |
| `/dashboard/crm/import-export` | `/dashboard/accounts/import-export` + `/contacts/import-export` | Unified CSV import for parties |

**Component reorganization:**
- Move components into `src/features/module-crm/components/` (currently in `src/components/crm/`).
- Split `LeadActivitiesTimeline.tsx` (668 LOC) into `PartyActivitiesTimeline.tsx` (the host) + per-activity-type child components (`ActivityCall.tsx`, `ActivityEmail.tsx`, etc.) of ~100 LOC each.
- Split `ActivityForm.tsx` (552 LOC) similarly.

**Delete:** `AccountDetailLegacy.tsx`, `ContactDetailLegacy.tsx` and their routes (App.tsx:474–554).

---

## 7. LLM hooks (specific to CRM)

CRM has zero AI today. Highest-value adds, ranked:

| Rank | Feature | Mechanism | Cost notes |
|---|---|---|---|
| 1 | **Activity auto-summarisation** | After a long call/meeting, LLM summarises the body into a 2-line outcome + next-step. Triggered async on `activity_type IN ('call','meeting')` with `duration_seconds > 300`. | Cheap; per-activity ~$0.001 |
| 2 | **Email → activity classification** | Inbound emails (from Comms) get auto-classified: which party, what intent (question / objection / order / unsubscribe), urgency. Drives the routing + DNC enforcement. | Per-email ~$0.0005 |
| 3 | **Party deduplication scorer** | When importing CSVs, score new rows against `core.parties` and surface likely matches. Embeddings on name+address+email; LLM final-pass on top-3 candidates. | One-shot at import |
| 4 | **Segment builder NL → DSL** | "Show me all customers in EU who haven't been contacted in 30 days" → segment criteria jsonb. | Per-segment-edit; very cheap |
| 5 | **Next-best-action suggestion on party detail** | LLM looks at recent activities + lifecycle stage + open opportunities, suggests "send pricing follow-up", "check status of shipment XYZ", etc. | Per-page-view, gate behind a "Suggest" button to control cost |
| 6 | **Campaign content drafting** | LLM drafts campaign messages from a brief + segment description. | Per-draft |

All routed through `packages/llm-client` (writes to `core.llm_usage`).

---

## 8. Migration sequence

| Phase | What | Risk |
|---|---|---|
| 0 | Wait for `core.parties` (core Phase 2). | — |
| 1 | Create `crm.account_extensions` + `crm.contact_extensions`. Backfill from `public.accounts` / `public.contacts`. Create `crm.v_accounts` / `crm.v_contacts` views. | Medium — biggest data move; party-ID assignment needs deterministic mapping |
| 2 | Migrate `public.activities` + `public.lead_activities` → `crm.activities` with polymorphic subject. | Medium — large table; needs partitioned read path during cutover |
| 3 | Create `crm.campaigns` + `crm.campaign_members`; fix the broken Campaigns page. | Low — net-new |
| 4 | Create `crm.segments` + `crm.segment_members`. | Low — net-new |
| 5 | Move components from `src/components/crm/` to `src/features/module-crm/components/`. Update imports. | Low — code-only |
| 6 | Split god components (LeadActivitiesTimeline, ActivityForm). | Low — UI refactor |
| 7 | Delete `AccountDetailLegacy.tsx`, `ContactDetailLegacy.tsx` and routes. | Low — but only after dual-render period confirms no users land on `?legacy=1` |
| 8 | Build LLM features in §7 ranked order. | Low — each is additive |

---

## 9. Open decisions

1. **`account_notes` migration** — today they're free-text notes on accounts. Goes to `crm.activities` (activity_type='note') or `core.audit_log`? **Recommend `crm.activities`** — they are first-class engagement entries; audit_log is for system-emitted records.
2. **`do_not_contact` scope** — per-channel (no email but SMS OK) or global? **Recommend per-channel** — store on `crm.contact_extensions` as jsonb `{email:false, sms:true, ...}`.
3. **Segment criteria language** — custom JSON DSL vs SQL templates vs Linear-style queries. **Recommend JSON DSL** validated by zod; LLM can target it cleanly.
4. **Where do leads being-converted create their party?** — In `sales.convertLead()` action, which writes to `core.parties` + `crm.account_extensions` + `crm.contact_extensions` in one transaction. CRM does not do conversion itself; it receives the `sales.lead.converted` event.
5. **`UnifiedPartnerForm.tsx` (702 LOC)** — currently handles both vendors and customers. Vendors are a Logistics/AMRO concept (carriers, suppliers). Decide: does CRM's party editor handle vendors too, or do vendor-extensions live in logistics/amro? **Recommend vendors are `core.parties` with `logistics.carrier_extensions` / `amro.supplier_extensions`** — keeps CRM focused on sales-side parties.

---

## 10. Acceptance criteria

Done when:

- [ ] `crm` schema exists with the 6 tables from §3.
- [ ] `crm.v_accounts` and `crm.v_contacts` views exist; all reads switch to them.
- [ ] `public.accounts` and `public.contacts` tables dropped after 30-day no-direct-read window.
- [ ] Campaigns page works end-to-end (CRUD + member enrolment); `crm.campaigns` table populated.
- [ ] AccountDetailLegacy.tsx and ContactDetailLegacy.tsx files deleted; routes removed from App.tsx.
- [ ] Lead-domain components moved to `sales` module (cross-reference with sales subdoc).
- [ ] At least 2 of the §7 LLM features shipped (recommend #1 and #2).
- [ ] `crm.activities` writes audit rows to `core.audit_log` and publishes `crm.activity.logged` events.
- [ ] CI lint prevents `from '@/components/crm/'` imports — must be `from '@/features/module-crm/components/'`.

---
