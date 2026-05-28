# `finance` — Finance Module

**Date:** 2026-05-28
**Status:** Draft — under review
**Depends on:** `core`, `quotation`, `logistics`, `sales` (for commission payouts)
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose

`finance` owns the **money lifecycle**: invoices, payments, general-ledger postings, taxes, dunning, credit notes, refunds, commission payouts, and the SaaS-of-the-SaaS subscription billing (tenants paying for the platform itself).

Finance is a **regulated module** — entries are append-only, audit-trail-mandatory, tax-rate accurate, and tied to GAAP/IFRS posting rules. The design treats `finance.*` as a controlled-write zone: most user-facing actions are *proposals* that get *posted* by deterministic engines, not direct table inserts.

---

## 2. Current state (evidence)

### 2.1 Frontend

`src/components/finance/` contains **one component**: `MarginRulesManager.tsx` (268 LOC). `src/components/billing/` exists but contains no TypeScript components today. Finance UI today is mostly page-level (in `src/pages/dashboard/`) with direct Supabase reads.

### 2.2 Routes (today, fragmented)

| Route | Component | Notes |
|---|---|---|
| `/dashboard/finance/invoices` | `Invoices` | App.tsx:1102 — admin-only |
| `/dashboard/finance/invoices/:id` | `InvoiceDetail` | App.tsx:1104 |
| `/dashboard/finance/margin-rules` | `MarginRules` | App.tsx:1103 |
| `/dashboard/finance/tax-jurisdictions` | `TaxJurisdictions` | App.tsx:1105 |
| `/dashboard/finance/tax-jurisdictions/:id` | `TaxJurisdictionDetail` | App.tsx:1106 |
| `/dashboard/billing/invoices/:id` | `BillingInvoiceDetail` | App.tsx:1154 — **second entry point** to invoices |
| `/dashboard/settings/billing` | (settings page) | App.tsx:661 |

Two finance entry points (`/finance/*` and `/billing/*`) with overlapping concepts. Resolution in §3.

### 2.3 Backend (partial)

`services/crm-api/src/services/`:
- `invoices.service.ts` — invoice operations
- `tax.service.ts` — tax calculation
- `billing/` subdir — likely the SaaS-tenant subscription side
- `gl/` subdir — general ledger posting (`GLPosterService.ts`)
- `billing.engine.test.ts` — test for billing engine

`services/crm-api/src/routes/`:
- `invoices.routes.ts` — `POST /v1/invoices/:id/finalize` (line 12)
- `tax.routes.ts` — `POST /v1/tax/calculate` (line 68), `POST /v1/tax/exemptions/certificates` (line 100)

**Action**: extract all of the above into `services/finance-api/`. CRM-API is left with leads only (which itself then moves to sales-api).

### 2.4 Tables (today)

| Table | Purpose | Action |
|---|---|---|
| `public.invoices` | Customer invoices | → `finance.invoices` (canonical) |
| `public.invoice_line_items` | Invoice lines | → `finance.invoice_lines` |
| `public.billing_invoices` | **Duplicate** of invoices | **Killed** — confirm no orthogonal data; backfill into `finance.invoices` |
| `public.payments` | Customer payments | → `finance.payments` (canonical) |
| `public.billing_payments` | **Duplicate** of payments | **Killed** — same |
| `public.subscription_invoices` | SaaS-tenant subscription invoices | → `finance.subscription_invoices` — distinct concept; **kept** |
| `public.payment_webhook_events` | Gateway webhook log (Razorpay, etc.) | → `finance.payment_webhook_events` |
| `public.tax_definitions` | Tax-rate config | → `finance.tax_definitions` |
| `public.charge_tier_config`, `public.charge_tier_ranges`, `public.charge_weight_breaks` | Pricing-tier ranges | **Move to `packages/quotation-engine/` reference data** OR stay in `finance.pricing_tiers_*` if used for invoicing too. See §9. |

**Net result**: ~14 tables in `finance.*` after consolidation, 2 tables killed (the `billing_*` duplicates), 1 distinct concept kept (`subscription_invoices` is **not** the same as customer `invoices`).

---

## 3. Target schema (`finance.*`)

### 3.1 Customer invoicing & payments

```sql
finance.invoices (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  invoice_number           text NOT NULL,                   -- tenant-scoped sequence
  customer_party_id        uuid NOT NULL REFERENCES core.parties(id),
  billing_address_id       uuid REFERENCES core.addresses(id),
  source_quote_ref         uuid,                            -- opaque, populated by ACL
  source_shipment_ref      uuid,                            -- opaque
  status                   text NOT NULL,                    -- 'draft','pending_approval','finalized','sent','partially_paid','paid','overdue','void','written_off'
  currency                 text NOT NULL,
  subtotal                 numeric NOT NULL,
  tax_total                numeric NOT NULL,
  total                    numeric NOT NULL,
  paid_total               numeric DEFAULT 0,
  due_date                 date,
  issued_at                timestamptz,
  finalized_at             timestamptz,
  finalized_by_user_id     uuid REFERENCES core.users(id),
  template_id              uuid,
  notes                    text,
  created_at, updated_at
)
-- finance.invoices is append-only after finalized_at set; updates go to finance.invoice_amendments

finance.invoice_lines (
  id, tenant_id, invoice_id,
  line_index int, description text,
  source_kind text,                                          -- 'shipment_charge','subscription','manual'
  source_external_ref text,
  quantity numeric, unit_price numeric, line_subtotal numeric,
  tax_code text, tax_amount numeric, line_total numeric
)
finance.invoice_amendments (
  id, tenant_id, invoice_id,
  amendment_kind text,                                       -- 'credit_note','debit_note','correction'
  reason text, total_delta numeric, issued_at timestamptz, created_by uuid
)

-- Payments (against customer invoices)
finance.payments (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  payment_number           text,
  customer_party_id        uuid REFERENCES core.parties(id),
  amount                   numeric NOT NULL,
  currency                 text NOT NULL,
  method                   text,                              -- 'card','bank_transfer','upi','cheque','other'
  gateway                  text,                              -- 'razorpay','stripe','manual',...
  gateway_payment_id       text,
  received_at              timestamptz,
  status                   text,                              -- 'pending','succeeded','failed','refunded','disputed'
  created_at, updated_at
)
finance.payment_allocations (
  id, tenant_id, payment_id, invoice_id, allocated_amount numeric, allocated_at timestamptz
)
finance.payment_webhook_events (
  id, tenant_id, gateway, event_type, raw_payload jsonb,
  received_at, processed_at, processing_status text, related_payment_id uuid
)

-- Credit notes & refunds
finance.credit_notes (
  id, tenant_id, credit_note_number, invoice_id, amount, reason, issued_at, status
)
finance.refunds (
  id, tenant_id, payment_id, amount, reason, status, gateway_refund_id, issued_at
)
```

### 3.2 General ledger (double-entry)

```sql
finance.accounts (
  id, tenant_id, code text, name text,
  account_type text,                                          -- 'asset','liability','equity','revenue','expense'
  parent_account_id uuid, is_active boolean
)
finance.journal_entries (
  id, tenant_id, entry_number,
  period_id uuid, entry_date date,
  source_kind text,                                           -- 'invoice','payment','manual','adjustment','closing'
  source_id uuid, posted_at timestamptz, posted_by uuid,
  status text                                                 -- 'draft','posted','reversed'
)
finance.journal_lines (
  id, tenant_id, journal_entry_id,
  account_id, debit numeric, credit numeric,
  description text, dimension jsonb                           -- {cost_center, project, ...}
)
-- Invariant: SUM(debit) = SUM(credit) per journal_entry. Enforced by trigger.

finance.periods (id, tenant_id, name, start_date, end_date, status text /* 'open','closing','closed' */)
```

### 3.3 Tax

```sql
finance.tax_jurisdictions (id, tenant_id NULL, country, region, name, code)
finance.tax_codes (id, tenant_id NULL, code text, jurisdiction_id, kind text /* 'vat','gst','sales','custom' */, rate_percent numeric, effective_from date, effective_to date)
finance.tax_exemption_certificates (
  id, tenant_id, customer_party_id, jurisdiction_id, certificate_number, valid_from, valid_to, file_id REFERENCES core.files(id)
)
finance.tax_calculations (
  id, tenant_id, source_kind text, source_id uuid,
  taxable_amount numeric, tax_amount numeric, tax_code_id uuid,
  calculated_at timestamptz
)
```

### 3.4 Margin & pricing tiers

```sql
finance.margin_rules (
  id, tenant_id, name, criteria jsonb, margin_percent numeric, is_active boolean, priority int
)
-- charge_tier_* tables consolidated:
finance.pricing_tier_configs (id, tenant_id, name, kind text /* 'weight_break','volume','revenue' */)
finance.pricing_tier_ranges (id, tier_config_id, lower_bound numeric, upper_bound numeric, rate numeric)
```

### 3.5 Subscription billing (SaaS-tenant side)

```sql
finance.subscription_plans (id, name, price_monthly, currency, features jsonb, is_active boolean)
finance.subscriptions (
  id, tenant_id_billed uuid,                                  -- the tenant being charged (not the customer)
  plan_id, status text, started_at, current_period_end, cancelled_at
)
finance.subscription_invoices (
  id, subscription_id, period_start, period_end,
  amount numeric, status text, paid_at, gateway_invoice_id
)
```

### 3.6 Dunning

```sql
finance.dunning_policies (id, tenant_id, name, steps jsonb, is_active boolean)
finance.dunning_runs (id, tenant_id, invoice_id, policy_id, current_step int, last_action_at, next_action_at, status text)
```

---

## 4. RLS strategy

```sql
CREATE POLICY view_invoices ON finance.invoices FOR SELECT USING (
  tenant_id = auth.jwt_tenant_id()
  AND core.has_module_access(tenant_id, 'finance', 'read')
  AND (auth.has_role(tenant_id, 'finance_team') OR auth.has_role(tenant_id, 'tenant_admin'))
);

-- Invoices are append-only after finalize
CREATE POLICY no_update_finalized ON finance.invoices FOR UPDATE USING (
  status NOT IN ('finalized','sent','paid','void','written_off')
);

-- Journal entries are post-and-freeze
CREATE POLICY no_update_posted ON finance.journal_entries FOR UPDATE USING (status = 'draft');
```

Customer portal access (a customer viewing their own invoices) uses the signed-JWT bridge from `core.portal_tokens` scoped to a `customer_party_id`.

---

## 5. Events

### Published

| Event | When |
|---|---|
| `finance.invoice.drafted` | Created in draft |
| `finance.invoice.finalized` | `finalized_at` set; immutable thereafter |
| `finance.invoice.sent` | Sent to customer (delivered through Comms) |
| `finance.invoice.paid` / `.partially_paid` | Payment allocations cover invoice |
| `finance.invoice.overdue` | Past due_date with unpaid balance |
| `finance.invoice.voided` / `.written_off` | Lifecycle ends |
| `finance.payment.received` / `.failed` / `.refunded` | Payment lifecycle |
| `finance.credit_note.issued` | Credit issued |
| `finance.journal.posted` | GL entry posted (immutable) |
| `finance.dunning.escalated` | Dunning step advance |
| `finance.subscription.invoiced` / `.payment_failed` / `.cancelled` | SaaS subscription lifecycle |
| `finance.commission.computed` | Sales commission computed and ready to disburse |

### Subscribed

| Event | Consumer logic |
|---|---|
| `quotation.quote.accepted` | Optionally create draft invoice — gate on per-tenant flag (`auto_invoice_on_quote_accept`) |
| `logistics.shipment.delivered` | Create draft invoice from shipment charges — typical trigger |
| `sales.opportunity.won` | Compute commission payable per `commission_plans`; emit `finance.commission.computed` (read by Sales for the rep's view, by Finance for the actual disbursement) |
| `comms.email.delivered` (subject_type='finance.invoice') | Mark invoice `sent_at` |
| Gateway webhooks (via UIM) | Insert `finance.payment_webhook_events`, attempt allocation |

ACL location: `services/finance-api/src/acl/{quotation,logistics,sales,comms,core}.ts`.

---

## 6. UI surface

Reorganised under `src/features/module-finance/`. Routes converge under `/dashboard/finance/*` (the dual `/billing/*` entry is killed):

| Route | Notes |
|---|---|
| `/dashboard/finance` | Finance home — AR aging, cash collected, P&L snapshot |
| `/dashboard/finance/invoices` | Invoice list |
| `/dashboard/finance/invoices/new` | Manual invoice creation (rare; most are event-triggered) |
| `/dashboard/finance/invoices/:id` | Invoice detail — lines, payments, amendments, dunning history |
| `/dashboard/finance/credit-notes` | Credit-note list |
| `/dashboard/finance/payments` | Payment list, allocations |
| `/dashboard/finance/refunds` | Refund list |
| `/dashboard/finance/gl` | Journal entries browser |
| `/dashboard/finance/gl/accounts` | Chart of accounts |
| `/dashboard/finance/gl/periods` | Period open/close |
| `/dashboard/finance/taxes` | Tax codes + jurisdictions |
| `/dashboard/finance/taxes/exemptions` | Exemption certificates |
| `/dashboard/finance/margin-rules` | Margin-rule admin (was `/finance/margin-rules`) |
| `/dashboard/finance/pricing-tiers` | Charge tier ranges |
| `/dashboard/finance/dunning` | Dunning runs + policies |
| `/dashboard/finance/subscriptions` | SaaS-of-the-SaaS billing — visible only to platform admins |
| `/dashboard/finance/commissions` | Commission view for sales-managers (read-only here; sales owns the plans) |
| `/portal/customer/:token` (customer-facing) | Customer can view own invoices, pay online |
| `/dashboard/settings/billing` | **Deprecated** — redirect to `/dashboard/finance/subscriptions` |

---

## 7. LLM hooks (specific to Finance)

| Rank | Feature | Mechanism | Cost notes |
|---|---|---|---|
| 1 | **Invoice line classification** | When a shipment delivers, charge-codes vary across providers. LLM classifies free-text charges into canonical line-types (freight, fuel-surcharge, demurrage, customs-clearance-fee, doc-fee). | Per invoice; ~$0.002 |
| 2 | **Payment reconciliation** | Bank-statement CSV + unallocated payments → matched allocations with confidence. Manual review queue for low-confidence. | Per stmt-upload; ~$0.01 |
| 3 | **Dunning copy generation** | Generates per-step dunning messages tuned by tone (polite → firm → final-notice) and tenant brand. | Per dunning escalation; ~$0.001 |
| 4 | **Tax-jurisdiction inference** | Customer address + shipment origin/destination → applicable tax regimes (GST, VAT, sales tax). Cross-checks against `tax_codes`. | Per invoice draft |
| 5 | **Margin-rule conflict detection** | Existing rules + new draft rule → flag overlap/contradiction. | Per rule edit |
| 6 | **Anomaly detection** | Periodic batch — unusual invoice amounts, suspicious payment patterns, missing-postings detection. | Nightly batch |
| 7 | **Audit narrative** | At period-close, LLM writes a summary explaining variances vs prior period. | Per period close |
| 8 | **HS code → duty estimate** | For customs invoicing, suggest duty amounts from HS code + value + jurisdiction. | Per line |

All routed through `packages/llm-client` → `core.llm_usage`.

---

## 8. Migration sequence

| Phase | What | Risk |
|---|---|---|
| 0 | Wait for `core.parties` + `core.files` + `core.audit_log` + `core.outbox`. | — |
| 1 | Create `finance.*` schema + all tables + GL invariant triggers. | Zero — additive. |
| 2 | Build `services/finance-api/` — extract `invoices.service.ts`, `tax.service.ts`, `GLPosterService.ts`, `billing.engine.test.ts` from crm-api. | Medium — service split. |
| 3 | Reconcile `public.invoices` ↔ `public.billing_invoices` (decide canonical), backfill into `finance.invoices`. **Critical**: run a parity script for 2 weeks to confirm no data loss. | High — duplicate-table reconciliation. |
| 4 | Same for `payments` ↔ `billing_payments`. | High — same. |
| 5 | Backfill `finance.invoice_lines`, `finance.payment_allocations`, `finance.payment_webhook_events`. | Medium. |
| 6 | Migrate tax data: `tax_definitions` → `finance.tax_definitions` + populate `finance.tax_jurisdictions` + `finance.tax_codes`. | Medium — schema reshape. |
| 7 | Migrate `charge_tier_*` → `finance.pricing_tier_*`. | Low. |
| 8 | Migrate `subscription_invoices` → `finance.subscription_invoices`; build `finance.subscriptions` + `finance.subscription_plans` for the SaaS-of-the-SaaS side. | Medium. |
| 9 | Build dunning workflow + UI. | Low — net-new. |
| 10 | Implement event-triggered invoice draft creation (subscribe to `logistics.shipment.delivered`, `quotation.quote.accepted` with tenant flags). | Medium — first event-driven business flow. |
| 11 | Cut frontend reads to `services/finance-api/`. Build new UI under `src/features/module-finance/`. | Medium. |
| 12 | Deprecate `/dashboard/billing/*` routes. Redirect to `/dashboard/finance/*`. | Low — UI. |
| 13 | Ship LLM features (#1, #2, #3 first). | Low. |
| 14 | Drop `public.invoices`, `public.billing_invoices`, `public.payments`, `public.billing_payments`, `public.tax_definitions`, `public.charge_tier_*` after 30-day window. | Low. |

---

## 9. Open decisions

1. **Canonical invoice table** — `public.invoices` or `public.billing_invoices`? **Recommend `public.invoices`** as canonical (it's the conventional name); audit `billing_invoices` rows for orthogonal data first.
2. **`charge_tier_*` ownership** — finance or quotation? **Recommend finance** because tiers drive *both* pricing-engine inputs and invoice generation. Quotation engine reads them via API call to finance-api; doesn't own them.
3. **Commission ownership split** (cross-reference Sales §9.4) — Sales owns *plans + assignments*; Finance computes *payouts* on `sales.opportunity.won`. `finance.commission.computed` event carries `payable_amount`, `payable_to_user_id`. **Confirmed in both subdocs.**
4. **SaaS-tenant billing in same DB as customer billing** — Yes, `subscription_*` lives in `finance.*` of each tenant's tenant_id NULL row. **Alternative**: separate schema `platform_billing.*`. **Recommend same DB** for simplicity; subscriptions are admin-only and tenant-id-isolated.
5. **Razorpay vs Stripe vs both** — Memory says T3 Billing is Razorpay-built for GST invoices. **Keep Razorpay primary**; design `finance.payments.gateway` to be a string allowing future providers without schema change.
6. **GL period close** — auto vs manual? **Recommend manual** with reminder events. Auto-closing creates audit risk.
7. **Multi-currency strategy** — every monetary column carries `currency`; `finance.fx_rates` (which is a duplicate-named table per §1B.8(4) — resolve to `core.fx_rates` or `finance.fx_rates`?) provides conversion. **Recommend `core.fx_rates`** since Markets also uses fx data.
8. **Invoice immutability boundary** — once finalized, no edits. Amendments go to `invoice_amendments` (credit/debit notes). **Confirmed in schema.**

---

## 10. Acceptance criteria

Done when:

- [ ] `finance` schema exists with the ~25 tables from §3.
- [ ] `services/finance-api/` exists; CRM-API no longer hosts invoices/tax/GL routes.
- [ ] `public.billing_invoices` and `public.billing_payments` dropped after parity reconciliation.
- [ ] GL invariants enforced by triggers (debit = credit per entry); test suite covers violations.
- [ ] `finance.invoice.finalized` is immutable in RLS; updates blocked except for amendments.
- [ ] `logistics.shipment.delivered` triggers draft-invoice creation in test scenarios.
- [ ] `sales.opportunity.won` triggers `finance.commission.computed` event with correct amounts.
- [ ] Customer portal works via signed-JWT for own-invoice access.
- [ ] At least 3 of §7 LLM features shipped (recommend #1 invoice-line classification, #2 payment reconciliation, #3 dunning copy).
- [ ] Razorpay webhook events arrive via UIM, populate `payment_webhook_events`, auto-allocate.
- [ ] All `core.llm_usage` rows for finance attributable per tenant + per feature.

---
