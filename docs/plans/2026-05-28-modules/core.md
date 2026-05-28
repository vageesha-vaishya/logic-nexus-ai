# `core` — Platform Core (foundation module)

**Date:** 2026-05-28
**Status:** Draft — under review
**Depends on:** none. Every other module depends on `core`.
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose

`core` is not a business module. It is the **shared substrate** every business module references. It owns identity (who), shared primitives (where, what files, what tags), the cross-cutting infrastructure (audit, outbox, notifications), and the helpers every other module's RLS calls into.

Rule from §2.1: the only allowed cross-schema foreign key is `<module>.* → core.*`. Everything else in the platform is built on top of this schema.

---

## 2. Current state (evidence)

| Concept | Today's location | Notes |
|---|---|---|
| Tenants | `public.tenants`, `public.platform_domains`, `public.domain_config`, `public.domain_metadata`, `public.domain_relationships` | Domain-code system is already wired through `requiredDomainCode="AMRO"` (`src/App.tsx:1158`). |
| Users | `public.users` (or `auth.users` via Supabase) | Membership + role mapping is split across `auth_permissions`, `auth_role_permissions`, `auth_roles`, `auth_role_hierarchy` — duplicated in some places. |
| Parties (account + contact unification) | **Does not exist** — `public.accounts` and `public.contacts` are separate tables with no shared primitive. | This is the largest gap. |
| Addresses, phones, emails, tax IDs | Embedded as columns inside accounts/contacts/leads/shipments. | Same address re-keyed in 8+ tables; impossible to do single-customer view. |
| Tags | `crm.tag` (1 table — token effort), plus ad-hoc `tags` columns. | Tag system started in `crm`, never finished. |
| Files / attachments | `public.attachment_events`, `public.attachment_links`, `public.attachment_versions`, `public.shipment_attachments`, `public.amro_compliance_documents`, `public.quote_documents`, `public.carrier_rate_attachments`, `public.message_attachments` | 8+ attachment tables — see §1B.8(3). |
| Audit log | 14+ tables (see §1B.8(1)). `platform.audit_log` is the newest and closest to the right shape. | Fragmented; no unified contract. |
| Notifications | `public.notifications`, `public.vendor_notifications`, `markets.notifications` | Three locations — see §1B.8(2). |
| Outbox | `services/crm-api/src/events/crm-events.producer.ts` publishes via Kafka. No transactional outbox table — events fire from app code. | Risk: app crashes between DB commit and event publish = lost event. |
| LLM provider configs | `platform.llm_provider_configs` | Correct location; keep. |
| LLM usage accounting | `platform.llm_usage` + `platform.llm_usage_y2026m04..06` (monthly partitions) | Correct shape; keep partitioning strategy. |
| Idempotency keys | `platform.idempotency_keys` | Keep. |

---

## 3. Target schema (`core.*`)

### 3.1 Identity & tenancy

```sql
core.tenants          -- one row per customer org of the SaaS
core.users            -- one row per human; FK to auth.users (Supabase)
core.memberships      -- (tenant_id, user_id, role_id, status, created_at)
core.roles            -- (id, tenant_id NULL = global, name, description)
core.permissions      -- (id, role_id, resource, action)  // resource is "<module>:<entity>" e.g. "crm:lead"
```

`core.has_module_access(tenant_id uuid, module text, action text)` — SECURITY DEFINER function called by every module's RLS. Single source of truth for "can this JWT see this row."

### 3.2 Parties (the unified "who")

```sql
core.parties (
  id              uuid PK,
  tenant_id       uuid NOT NULL,
  party_type      text NOT NULL CHECK (party_type IN ('person','organization')),
  display_name    text NOT NULL,
  legal_name      text,                -- organizations only
  first_name      text,                -- persons only
  last_name       text,
  status          text DEFAULT 'active',
  external_refs   jsonb DEFAULT '{}',  -- {salesforce_id, sap_id, ...}
  created_at      timestamptz,
  updated_at      timestamptz
)

core.party_relationships (
  id, tenant_id, from_party_id, to_party_id,
  relationship_type   -- 'employs','subsidiary_of','parent_of','household_of'
)
```

**`crm.accounts` and `crm.contacts` are gone.** Instead:
- "Account" = a view: `SELECT * FROM core.parties WHERE party_type='organization' AND id IN (SELECT party_id FROM crm.account_extensions WHERE tenant_id = …)`.
- "Contact" = same pattern for `party_type='person'`.
- `crm.account_extensions` and `crm.contact_extensions` hold the CRM-only fields (industry, sales_owner_id, lifecycle_stage, etc.).

This unifies "the same human as an employee of company A and a contact at company B" — currently impossible.

### 3.3 Shared primitives

```sql
core.addresses         (id, tenant_id, line1, line2, city, region, postal_code, country, lat, lng, normalised)
core.address_links     (id, address_id, subject_type, subject_id, address_role)  -- polymorphic; subject_type='party'|'shipment'|'invoice'
core.phone_numbers     (id, tenant_id, e164, country)
core.phone_links       (id, phone_id, subject_type, subject_id, role)
core.email_addresses   (id, tenant_id, email, verified_at)
core.email_links       (id, email_id, subject_type, subject_id, role)
core.tax_ids           (id, tenant_id, party_id, jurisdiction, kind, value, validated_at)
core.tags              (id, tenant_id, namespace, slug, label, color)
core.tag_assignments   (id, tag_id, subject_type, subject_id, assigned_by, assigned_at)
```

Polymorphic linking (`subject_type + subject_id`) is the pattern. Tables stay small; usage scales.

### 3.4 Files (centralised — replaces 8+ tables from §1B.8)

```sql
core.files (
  id, tenant_id, storage_backend, storage_path, mime_type, size_bytes,
  sha256, virus_scanned_at, uploaded_by, created_at
)
core.file_links (
  id, file_id, subject_type, subject_id, link_role, created_at
)
core.file_versions (id, file_id, version, storage_path, created_at)
```

Every module that needs "attach a file" inserts one row in `core.files` and one in `core.file_links`. `subject_type` namespace is the schema-qualified entity name: `'logistics.shipment'`, `'amro.work_order'`, `'quotation.quote'`, etc.

### 3.5 Audit log (centralised — replaces 14+ tables from §1B.8)

```sql
core.audit_log (
  id              bigserial,
  tenant_id       uuid NOT NULL,
  occurred_at     timestamptz NOT NULL,
  actor_user_id   uuid,                -- NULL for system actions
  actor_kind      text,                -- 'user','service','integration'
  subject_type    text NOT NULL,       -- 'crm.lead','amro.work_order', etc.
  subject_id      uuid NOT NULL,
  action          text NOT NULL,       -- 'created','updated','status_changed','approved','rejected'
  diff            jsonb,               -- {before:..., after:...}
  metadata        jsonb,               -- ip, user_agent, request_id, etc.
  PRIMARY KEY (tenant_id, occurred_at, id)
) PARTITION BY RANGE (occurred_at);    -- monthly partitions like markets price_history
```

Per-module audit views are filtered selects: `CREATE VIEW amro.work_order_audit AS SELECT * FROM core.audit_log WHERE subject_type = 'amro.work_order';`

Trigger-based write path: every `INSERT/UPDATE/DELETE` on a module table fires a trigger that writes to `core.audit_log`. Removes the need for every module to remember to log.

### 3.6 Notifications (centralised — replaces 3 tables from §1B.8)

```sql
core.notifications (
  id, tenant_id, recipient_user_id, recipient_role_id,
  subject_type, subject_id,
  intent_kind,         -- 'lead.assigned','shipment.delayed', 'workorder.approved'
  payload jsonb,
  read_at, dismissed_at, created_at
)
```

`core` owns the *intent* to notify. `comms.*` owns the *delivery* (email/sms/push/in-app fan-out from this table). A poller in `services/comms-api` reads new rows and dispatches.

### 3.7 Outbox (transactional)

```sql
core.outbox (
  id            uuid PK,
  tenant_id     uuid NOT NULL,
  module        text NOT NULL,            -- 'crm','sales','logistics',...
  event_type    text NOT NULL,            -- 'created','updated','won','delivered',...
  entity_type   text NOT NULL,            -- 'opportunity','shipment','quote' (singular, no schema prefix)
  entity_id     uuid NOT NULL,
  occurred_at   timestamptz NOT NULL,
  version       int NOT NULL DEFAULT 1,
  payload       jsonb NOT NULL,
  published_at  timestamptz,              -- NULL = unpublished
  PRIMARY KEY (tenant_id, occurred_at, id)
)
```

Columns map **1:1** to the §2.4 event envelope. Topic on Kafka is `<module>.<entity_type>.<event_type>`. Every state change writes the entity update + an `outbox` row in the **same transaction**. A poller in each `services/<module>-api/` ships rows where `published_at IS NULL` to Kafka, then marks them. Replaces the at-most-once fire-from-app-code pattern in `services/crm-api/src/events/`.

### 3.8 Domains (lift from `platform.*`)

The existing `platform_domains` / `domain_config` / `domain_metadata` / `domain_relationships` tables move into `core.domains_*`. The `requiredDomainCode` route guard in App.tsx already calls into this — code path stays the same, just queries `core.domains` instead.

### 3.9 LLM accounting (lift from `platform.*`)

`platform.llm_provider_configs` → `core.llm_provider_configs`. `platform.llm_usage` + monthly partitions → `core.llm_usage`. A new shared client `packages/llm-client` wraps Anthropic + OpenAI calls and **writes one `core.llm_usage` row per call**. No module is allowed to instantiate provider SDKs directly.

---

## 4. RLS strategy for `core.*`

Three-layer policy applied to every table:

```sql
CREATE POLICY tenant_isolation ON core.parties
  USING (tenant_id = auth.jwt_tenant_id());

CREATE POLICY module_access ON core.parties
  USING (core.has_module_access(tenant_id, 'core', 'read'));

-- Ownership/role layer is per-table specific.
```

`core.parties` is special: any user in any module needs to read parties they have business access to. Read access is granted when **any** module the user has `:read` on has a relationship to that party. This is computed via a `core.party_visibility_for_user(party_id, user_id)` security-definer function that unions across module-specific relationship tables.

---

## 5. Events published

`core` publishes identity-level events; business modules publish their own.

| Event | When |
|---|---|
| `core.tenant.created` | New customer signup |
| `core.tenant.updated` | Tenant settings change |
| `core.user.created` | New user provisioned |
| `core.user.invited` / `core.user.activated` | Onboarding |
| `core.party.created` / `core.party.updated` / `core.party.merged` / `core.party.deleted` | Party lifecycle |
| `core.membership.granted` / `core.membership.revoked` | Module access changes |

Other modules subscribe. Notably: `comms` subscribes to `core.user.invited` to send the welcome email; `crm` subscribes to `core.party.created` to enrich the account_extensions row.

---

## 6. UI surface

`core` has minimal UI — it's substrate. The admin surface lives at `/dashboard/admin/*`:

- `/admin/tenants` — tenant management (super-admin only)
- `/admin/users` — user provisioning (tenant admin)
- `/admin/roles` — role + permission management
- `/admin/parties` — global party search + merge (deduplication tool)
- `/admin/audit` — audit log viewer (filtered by module + subject)
- `/admin/llm-providers` — LLM provider configs + usage dashboard
- `/admin/domains` — domain configuration (the AMRO/Logistics/etc. domain-code system)
- `/admin/files` — file repository (search/govern)

All gated by `core.platform_admin` or `core.tenant_admin` permission.

---

## 7. LLM hooks (specific to `core`)

`core` itself ships **no business LLM features**. But it owns:

1. **The shared LLM client** (`packages/llm-client`) — wraps Anthropic + OpenAI, enforces usage write-through. **Mandatory single entry point** for every module's AI call.
2. **Usage dashboard** at `/admin/llm-providers` — per-tenant, per-module, per-model spend, cached vs non-cached hit rate, error rates.
3. **Budget guards** — soft + hard caps per tenant per month. Hard cap = `core.llm_usage` sum > budget → calls return `{error:'budget_exceeded'}`.
4. **Party deduplication assistant** (one *core* LLM feature) — semi-automatic merge of duplicate parties using embeddings on name+address. Optional, opt-in.

---

## 8. Migration sequence

| Phase | What | Risk |
|---|---|---|
| 0 | Create empty `core.*` schema + helper functions. No data move. | Zero — additive. |
| 1 | Lift `platform.llm_*`, `platform.idempotency_keys`, `platform.audit_log`, `platform.feature_flags` into `core.*`. **`platform.integration_*` and `platform.webhook_subscriptions` move to `uim.*` instead** (per master §2.6). Drop `platform.*` schema after both lifts complete. | Low — small tables, low write volume. |
| 2 | Create `core.parties` + `core.*_links` tables. Backfill `core.parties` from `public.accounts ∪ public.contacts`. Keep public tables in place — read path unchanged. | Medium — data shape change; needs reconciliation script + dual-write window. |
| 3 | Build `core.audit_log` triggers; turn on shadow-write from every existing audit table. Run for 2 weeks, reconcile. | Medium — trigger overhead; needs perf test. |
| 4 | Cut over each module's reads to `core.parties` via views. Drop `public.accounts` / `public.contacts` after 30 days of zero direct reads. | High — most-FK'd tables in the DB. Needs per-module sequencing. |
| 5 | Centralise files: dual-link new attachments to `core.files`, backfill old. Drop legacy attachment tables once read-paths cut over. | Medium — touches many modules. |
| 6 | Centralise notifications. Lower risk than parties because volume is bounded. | Low. |

Phases 0–1 can ship in week 1. Phase 2 is the long pole — see migration plan in master doc §7.

---

## 9. Open decisions

1. **Tenants in `core` vs `platform`?** — Recommended: `core`. Tenants are the multi-tenancy primitive; every table FKs them. `platform.*` (if kept) is for things truly above tenancy (super-admin tools, billing of the SaaS itself).
2. **Files storage backend** — Supabase Storage vs S3 vs both. Current code uses Supabase Storage. Recommended: keep Supabase Storage; `core.files.storage_backend` is a discriminator for future flexibility, not a feature flag we use today.
3. **`auth_*` tables consolidation** — `auth_permissions`, `auth_role_permissions`, `auth_roles`, `auth_role_hierarchy` duplicate concepts. Recommended: kill `auth_*` in `public`; canonical is `core.roles` + `core.permissions`. Refactor `useAuth` hook accordingly.
4. **Audit-log trigger vs application-write** — Triggers are cleaner but add per-write overhead. Recommended: triggers for shape correctness; throttle high-volume tables (e.g., `core.outbox` itself doesn't write to audit_log).
5. **`crm.tag` and existing `crm`/`logistics` schema-tables** — Move into `core.tags` / `core.tag_assignments`. The two existing single-table schemas were aspirational; this absorbs them.

---

## 10. Acceptance criteria

Done when:

- [ ] `core` schema exists, all 9 listed tables created, all RLS policies in place.
- [ ] `core.has_module_access()` and `core.party_visibility_for_user()` functions exist and are unit-tested.
- [ ] `packages/llm-client` is the only path to LLM providers; CI lint forbids direct `@anthropic-ai/sdk` / `openai` imports outside this package.
- [ ] Audit log writes for every CRM/Sales/Quotation/Logistics/Finance/Compliance/Comms/AMRO/UIM/Markets table land in `core.audit_log` (verified via shadow-write reconciliation).
- [ ] At least one module (`crm`) has cut over party reads from `public.accounts/contacts` to `core.parties` views.
- [ ] Admin UIs for tenants, users, parties, audit, llm-providers exist at `/dashboard/admin/*`.
- [ ] `core.outbox` poller is running in every `services/<module>-api/`.

---
