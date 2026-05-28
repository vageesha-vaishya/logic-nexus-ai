# `compliance` — Compliance Module

**Date:** 2026-05-28
**Status:** Draft — under review
**Depends on:** `core` (parties, audit, files), event subscriptions across `sales`, `logistics`, `quotation`, `finance`
**Note on AMRO:** Aviation airworthiness compliance stays inside `amro.*` (see master §2.6); only `core.files`-storage is shared.
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose

`compliance` owns **regulatory screening and risk-decision audit**: denied-party screening, sanctions checks, KYC/KYB verification, restricted-party screening, compliance obligations tracking, screening-decision audit trail.

It is a **cross-cutting consumer** — every module that creates a party-touching entity (lead, quote, booking, shipment, invoice payee) emits an event Compliance subscribes to. Compliance evaluates and publishes a decision: `passed`, `flagged_for_review`, `failed`. Other modules treat the decision as a **gate** (e.g., Quotation refuses to mark a quote `sent` if compliance.screening.failed for the customer).

---

## 2. Current state (evidence)

### 2.1 Frontend

`src/features/module-compliance/` is **further along than most modules** — already has manifest, workspace model, hooks, page wiring:

| File | LOC |
|---|---|
| `pages/RestrictedPartyScreeningVerticalPage.tsx` | 47 |
| `workspace/complianceWorkspaceModel.ts` | 80 |
| `workspace/complianceWorkspaceModel.test.ts` | 85 |
| `hooks/useComplianceWorkspaceState.ts` | 186 |
| `components/ComplianceOwnedWorkspace.tsx` | 243 |
| `components/ComplianceStatusBadgeContract.tsx` | 16 |
| `manifest.ts` | 19 |

Plus `src/components/compliance/ScreeningButton.tsx` (202 LOC) — the trigger UI consumed by other modules.

Total: **~1,183 LOC**. Smallest module by code size.

### 2.2 Services

`src/services/compliance/`:
- `ComplianceScreeningService.ts` — 175 LOC, generic screening dispatcher
- `RestrictedPartyScreeningService.ts` — 128 LOC, denied-party-specific path

These run in the browser today (Supabase RLS-mediated). Need to move server-side for credential safety (API keys for third-party screening services like Dow Jones, World-Check, MK Denial).

### 2.3 Routes (today)

| Route | Notes |
|---|---|
| `/dashboard/restricted-party-screening` | App.tsx:1148 — standalone page |
| `/dashboard/amro/compliance` | App.tsx:1174 — AMRO compliance (separate domain, stays in `amro.*`) |

### 2.4 Tables (today, public.*)

| Table | Purpose | Action |
|---|---|---|
| `public.compliance_checks` | Generic check records | → `compliance.checks` |
| `public.compliance_domain_verifications` | Domain-verification (email/SPF/etc. for compliance purposes) | → `compliance.domain_verifications` |
| `public.compliance_obligations` | Regulatory obligations | → `compliance.obligations` |
| `public.compliance_records` | Compliance entity master | → `compliance.records` |
| `public.compliance_rules` | Rule configuration | → `compliance.rules` |
| `public.compliance_screenings` | Screening invocations | → `compliance.screenings` |
| `public.quote_contacts_screening` | Quote-contact screening (from quotation subdoc) | → `compliance.screenings` (with `subject_type='quotation.quote'`) — unifies under one table |
| `public.amro_compliance_*` (6 tables) | Aviation airworthiness | **Stay in `amro.*`** — different regulatory domain |

**Result**: ~9 tables in `compliance.*`. The 6 AMRO compliance tables stay where they are.

---

## 3. Target schema (`compliance.*`)

```sql
-- Rules engine
compliance.rules (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  name                     text NOT NULL,
  rule_kind                text NOT NULL,                            -- 'denied_party','sanctions','kyc','kyb','export_control','tax_id_validation','domain_health','custom'
  applies_to               text[],                                    -- subject_type values: ['sales.lead','quotation.quote',…]
  trigger_events           text[],                                    -- ['sales.lead.created','logistics.booking.created',…]
  criteria                 jsonb,                                     -- DSL with rule-kind specifics
  decision_on_match        text,                                      -- 'pass','flag','fail'
  is_active                boolean DEFAULT true,
  priority                 int,
  created_at, updated_at
)

-- Screenings (one row per evaluation)
compliance.screenings (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  subject_type             text NOT NULL,                             -- 'core.party','sales.lead','quotation.quote','logistics.booking','finance.payment'
  subject_id               uuid NOT NULL,
  subject_party_id         uuid REFERENCES core.parties(id) NULL,    -- denormalized for fast party-lookups
  rule_id                  uuid REFERENCES compliance.rules(id) NULL,
  triggered_by_event       text,                                      -- 'sales.lead.created',...
  provider                 text,                                      -- 'dow_jones','world_check','mk_denial','internal',...
  provider_request_id      text,
  status                   text NOT NULL,                             -- 'pending','passed','flagged','failed','error'
  hits                     jsonb,                                     -- raw provider hits + match scores
  decision                 text,                                      -- 'pass','review_required','fail'
  decided_by_user_id       uuid REFERENCES core.users(id) NULL,
  decided_at               timestamptz,
  decision_notes           text,
  evidence_file_ids        uuid[],                                    -- references core.files
  expires_at               timestamptz,                                -- screenings have shelf-life
  created_at, updated_at
)

-- Records (the compliance status of an entity over time — denormalised aggregate)
compliance.records (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  subject_type             text NOT NULL,
  subject_id               uuid NOT NULL,
  latest_screening_id      uuid REFERENCES compliance.screenings(id),
  current_status           text,                                      -- 'cleared','review_pending','blocked','expired'
  next_review_due_at       timestamptz,
  created_at, updated_at,
  UNIQUE (tenant_id, subject_type, subject_id)
)

-- Obligations (long-running compliance duties)
compliance.obligations (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  party_id                 uuid REFERENCES core.parties(id) NULL,
  obligation_kind          text NOT NULL,                             -- 'annual_kyc_refresh','export_license_renewal','aeo_audit',...
  due_at                   timestamptz,
  responsible_user_id      uuid REFERENCES core.users(id),
  status                   text,                                      -- 'open','in_progress','completed','overdue','waived'
  evidence_file_ids        uuid[],
  created_at, updated_at
)

-- Checks (lighter than full screenings — fast attribute validations)
compliance.checks (
  id, tenant_id, subject_type, subject_id, check_kind text /* 'tax_id_format','address_format','domain_mx_record' */,
  result text /* 'valid','invalid','warning' */, details jsonb, performed_at timestamptz
)

-- Domain verifications (specific to email sender domains)
compliance.domain_verifications (
  id, tenant_id, domain text, spf_status text, dkim_status text, dmarc_status text,
  last_checked_at timestamptz, evidence jsonb
)

-- Provider configuration (which screening provider is used)
compliance.providers (
  id, tenant_id, provider_kind text /* 'dow_jones','world_check',... */,
  credential_ref uuid REFERENCES core.secrets(id),
  config jsonb, is_active boolean
)

-- Provider response cache (avoid re-hitting expensive APIs for same input)
compliance.provider_cache (
  cache_key text PK,                                                   -- hash of (provider, normalised inputs)
  tenant_id uuid, response jsonb, hits int, created_at, expires_at
)

-- Audit decisions (manual overrides, with reason)
compliance.audit_decisions (
  id, tenant_id, screening_id, decision text, reason text,
  decided_by_user_id, decided_at, override_of_decision text
)
```

---

## 4. RLS strategy

Compliance is **role-gated tightly** — most users do not see compliance data.

```sql
CREATE POLICY view_screenings ON compliance.screenings FOR SELECT USING (
  tenant_id = auth.jwt_tenant_id()
  AND (
    auth.has_role(tenant_id, 'compliance_officer')
    OR auth.has_role(tenant_id, 'tenant_admin')
  )
);

-- Status badge is exposed to subject owners (e.g., a sales rep can see "their" lead's compliance status badge,
-- but cannot see the underlying hit details).
CREATE POLICY view_status_badge ON compliance.records FOR SELECT USING (
  tenant_id = auth.jwt_tenant_id()
  AND core.has_module_access(tenant_id, 'compliance', 'read_status')
  -- The subject's owning-module decides who sees its rows — call delegating helper
  AND compliance.subject_visible(subject_type, subject_id, auth.uid())
);
```

Manual overrides are double-audited: a row in `compliance.audit_decisions` plus a row in `core.audit_log`.

---

## 5. Events

### Published

| Event | When |
|---|---|
| `compliance.screening.requested` | New screening initiated |
| `compliance.screening.passed` | Result `passed` |
| `compliance.screening.flagged` | Hit found, review queue |
| `compliance.screening.failed` | Definitive block — **gates downstream actions** |
| `compliance.screening.expired` | TTL hit; needs re-screen |
| `compliance.obligation.due_soon` | 30 days before `due_at` |
| `compliance.obligation.overdue` | Past `due_at` |
| `compliance.override.applied` | Manual decision override (audit-mandatory) |

### Subscribed

| Event | Action |
|---|---|
| `sales.lead.created` | Trigger `denied_party` screening on lead → emit decision |
| `sales.lead.qualified` | Trigger full KYC/KYB screening |
| `core.party.created` (party_type=organization) | Trigger KYB |
| `core.party.created` (party_type=person) | Trigger KYC |
| `quotation.quote.draft` | Trigger denied-party + export-control screening on customer + consignee |
| `logistics.booking.created` | Trigger shipper/consignee/notify-party screening |
| `logistics.shipment.created` | Re-verify if parties changed |
| `finance.payment.received` | Trigger high-value-payment screening (if amount > threshold) |
| `crm.account_extension.created` | Trigger initial customer due diligence |

ACL location: `services/compliance-api/src/acl/{sales,core,quotation,logistics,finance,crm}.ts`.

---

## 6. UI surface

Routes under `/dashboard/compliance/*`:

| Route | Notes |
|---|---|
| `/dashboard/compliance` | Compliance home — open reviews, obligations due, recent failures |
| `/dashboard/compliance/screenings` | Screening list, filters, status |
| `/dashboard/compliance/screenings/:id` | Screening detail — hits, decision, evidence files, override flow |
| `/dashboard/compliance/restricted-party` | Was `/dashboard/restricted-party-screening` — keep redirect 90 days |
| `/dashboard/compliance/obligations` | Obligations tracker (due dates, evidence) |
| `/dashboard/compliance/rules` | Rule administration |
| `/dashboard/compliance/providers` | Provider configuration (admin only) |
| `/dashboard/compliance/audit` | Audit-decisions log (filterable, exportable for regulator request) |

**Components organized under `src/features/module-compliance/components/`** (most already there):
- Move `src/components/compliance/ScreeningButton.tsx` (202 LOC) → `src/features/module-compliance/components/ScreeningButton.tsx`
- Existing `ComplianceOwnedWorkspace.tsx` (243 LOC) stays; expand to host the screenings list as a tab
- New: `ScreeningDetailPanel.tsx`, `ObligationCard.tsx`, `OverrideDialog.tsx`, `RuleEditor.tsx`

No god components to split — module is small.

---

## 7. LLM hooks (specific to Compliance)

| Rank | Feature | Mechanism | Cost notes |
|---|---|---|---|
| 1 | **Hit-reasoning summarisation** | A provider returns 5 potential hits for "John Smith of London". LLM evaluates strength of match vs `core.parties` row, surfaces top candidate + reasoning. Reduces reviewer load. | Per flagged screening; ~$0.005 |
| 2 | **Adverse-media synthesis** | Aggregate news search results about a party into a structured risk-summary. | Per KYB; ~$0.02 |
| 3 | **Override-reason guardrail** | When a compliance officer overrides a `failed` to `pass`, LLM checks the reason text against tenant policy and flags weak justifications. | Per override |
| 4 | **Obligation deadline reminder copy** | Generates the reminder messages sent to obligation owners. | Per reminder |
| 5 | **Document parsing for KYC** | Government-ID / certificate uploads → structured fields + flag forgeries / mismatches. | Per doc upload; ~$0.01 with OCR |
| 6 | **Rule recommendation** | Periodic — given recent screening history, suggest new rules or rule-tuning. | Weekly batch |
| 7 | **Sanctions-list change diffing** | When global sanctions lists update, identify which existing screened parties might now match. | Per list-update |

All routed through `packages/llm-client` → `core.llm_usage`. AI-summarised hits stored in `compliance.screenings.hits.ai_summary` (alongside raw provider data).

---

## 8. Migration sequence

| Phase | What | Risk |
|---|---|---|
| 0 | Wait for `core.parties` + `core.files` + `core.secrets` + `core.audit_log`. | — |
| 1 | Create `compliance.*` schema + tables. RLS + helpers. | Zero. |
| 2 | Build `services/compliance-api/`. Move `ComplianceScreeningService.ts` and `RestrictedPartyScreeningService.ts` server-side. Provider credentials go to `core.secrets`. | Medium — security-critical move. |
| 3 | Backfill `compliance.rules`, `compliance.records`, `compliance.checks`, `compliance.domain_verifications`, `compliance.obligations` from existing `public.compliance_*` tables. | Medium. |
| 4 | Consolidate `quote_contacts_screening` rows into `compliance.screenings` with `subject_type='quotation.quote'`. | Low. |
| 5 | Implement event subscriptions per §5 — start with `sales.lead.created` → screening. | Medium — first cross-module trigger. |
| 6 | Build `/dashboard/compliance/*` UI per §6. Move `ScreeningButton.tsx` to module-compliance. | Low. |
| 7 | Implement override flow with double-audit (`compliance.audit_decisions` + `core.audit_log`). | Low — net-new feature. |
| 8 | Ship LLM features #1, #2, #3. | Low. |
| 9 | Drop `public.compliance_*` and `public.quote_contacts_screening` after 30-day window. | Low. |

---

## 9. Open decisions

1. **Sync vs async screening** — Screen blocks creating the entity, or runs async with status badge? **Recommend async by default**, sync only for `denied_party` on high-risk subject types (`finance.payment` amount > $10k, `quotation.quote.sent`). Caller subscribes to `compliance.screening.failed` and rolls back if needed.
2. **Provider abstraction** — single internal provider interface or per-provider adapters? **Recommend per-provider adapter with a generic dispatcher** (`compliance.providers.provider_kind` drives routing).
3. **Hit retention** — full hit JSON forever, or summarise + drop raw after N days? **Recommend keep full for 7 years** (regulatory retention); large blobs go to `core.files` with screening row holding the file_id.
4. **AMRO compliance integration** — Stay separate, or surface combined view? **Recommend separate underlying schemas** (different regulators) but a **unified `/dashboard/compliance` page tab** that aggregates summary status from both `compliance.*` and `amro.compliance_*` via two queries.
5. **TTL for screenings** — when is a screening "stale"? **Recommend 365 days for KYC, 90 days for sanctions, 30 days for denied-party** (per industry norms); per-tenant override allowed.
6. **Cascading re-screen** — if a sanctions list updates and a previously-passed party now matches, what happens? **Recommend automatic re-screen + emit `compliance.screening.flagged`** (not silent — humans must review).
7. **Evidence files** — uploaded to verify KYC/KYB. Stored in `core.files` with subject_type='compliance.screening'? **Recommend yes**, with extra retention rule (regulatory minimum) applied via `core.files.retention_class` field.

---

## 10. Acceptance criteria

Done when:

- [ ] `compliance` schema exists with ~9 tables from §3.
- [ ] `services/compliance-api/` exists; provider credentials moved to `core.secrets`; no API keys in frontend code.
- [ ] `sales.lead.created` → `compliance.screening.requested` → `compliance.screening.{passed|flagged|failed}` chain works end-to-end.
- [ ] `quotation.quote.sent` is **blocked** if `compliance.screening.failed` for the customer (gate-test passes).
- [ ] Override flow writes to both `compliance.audit_decisions` AND `core.audit_log`.
- [ ] `/dashboard/compliance/*` UI exists; ScreeningButton moved into module-compliance.
- [ ] At least 3 of §7 LLM features shipped (recommend #1 hit-reasoning, #3 override-guardrail, #5 KYC doc parsing).
- [ ] All `public.compliance_*` and `public.quote_contacts_screening` dropped.
- [ ] Combined `/dashboard/compliance` tab shows both `compliance.*` and `amro.compliance_*` summary counts.
- [ ] Retention policy enforced on screening evidence files (7-year minimum).

---
