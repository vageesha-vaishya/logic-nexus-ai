# Unified platform onboarding — design

Date: 2026-05-22 · Audience: solo operator + future contributors · Status:
locked, pending implementation

## Why now

The current `/SelfServiceOnboarding.tsx` page surfaces **all** subscription plans
across **all** brands with no filter, producing the duplicate "Starter" tiles
the user spotted on 2026-05-22 — one is `lnai-starter` (Markets-advisor),
one is `sos-starter` (Logistics). The page also blends two distinct
audiences (B2C retail individual and B2B organization) under one generic
"Register your organization" heading.

This document locks the architecture for the entire onboarding surface across
every audience and every domain. The retail-individual side already shipped
(see `docs/plans/2026-05-21-self-onboarding-wizard-design.md`). What's
designed here is the rest: B2B organization signup, the welcome branch
screen, the multi-membership identity model, the invite flow, and the
package catalog clean-up.

## Locked decisions

| # | Topic | Choice | Rationale |
|---|---|---|---|
| 1 | Scope | Full unified architecture (not just a page fix) | Multi-domain platform deserves a coherent onboarding model |
| 2 | Routing | URL subpaths under `sosservices.online`; subdomains later | One bundle / one DNS today; manifest router already supports subdomain graduation |
| 3 | Self-serve domains v1 | Logistics + Markets-advisor only; others sales-led | Matches actual product maturity |
| 4 | Tenant ↔ domain | Multi-domain capable; single domain at signup | `tenant_domain_assignments` already exists; expansion as post-signup action grows ARPU |
| 5 | Markets-advisor shape | Team-scaled Sthira tools at v1; client-management deferred | Buildable on existing retail code; defer SEBI sub-broker compliance |
| 6 | Identity model | One email = many memberships + context switcher | Matches Slack / Notion / Linear; minimal schema work |
| 7 | Root UX | Lightweight router; signed-out → `/welcome`; signed-in → last-used context | No marketing site exists yet; ships today |
| 8 | Billing model | Hybrid: freemium default + 14-day no-card paid trial → auto-downgrade | Fast activation + filtered tyre-kickers + Razorpay reuse |
| 9 | KYC / compliance | Tiered by usage threshold (freemium = minimal, paid = billing KYC, live money = domain KYC) | Lowest friction at signup, fields appear when relevant |
| 10 | Signup wizard | Single visible form + email verify; everything else as post-signup Setup cards | Highest conversion; matches Linear / Stripe / Vercel pattern |
| 11 | Invite flow | Magic link + admin-set role + same-email binding to existing `user_id` | Multi-membership compatible; no re-verify for existing users |

## URL map

```
sosservices.online
├── /                         redirect: signed-out → /welcome; signed-in → last-used context
├── /welcome                  three-tile branch screen (signed-out only)
│       ├── "Individual investor"   → /sthira/signup       (existing)
│       ├── "Register organization" → /signup              (domain picker)
│       └── "I have an invite"      → /invite              (token entry)
├── /sthira/...               existing Sthira retail (auth, onboarding, dashboard)
├── /signup                   Step 0: pick Logistics / Markets-advisor
├── /signup/[domain]          single-form B2B signup
├── /verify-email             Supabase email verification landing
├── /invite/[token]           tokenized invite landing
├── /auth/login               unified login
└── /dashboard                post-login surface, routed by active membership
```

Signed-in users never see `/welcome` — they go straight to the dashboard
of their last-used membership. Subdomain graduation (Q2-B) is a DNS flip,
not a code rewrite, because the manifest-driven router already keys on
domain code.

## Identity model

One `auth.users` row per email. Memberships live in the existing
`public.user_roles` table — Sthira retail is just one membership entry
under the `SOS Services / SOS-RETAIL` row.

**New table for active context:**

```sql
CREATE TABLE public.user_active_membership (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.user_roles(id) ON DELETE CASCADE,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- RLS: only the owning user can read or write their row.
```

Topbar context switcher reads this on app boot, feeds the domain manifest,
and mounts the right route subtree. Switching is a UI affordance only —
RLS already gives the user access to every membership; we just hide the
inactive ones.

Account merging: if a Sthira retail user clicks an org invite to the same
email, the invite-accept handler inserts a new `user_roles` row under their
existing `user_id`. No second password, no second email verify. Their
membership list grows by one.

## Tenant + domain assignments

A tenant is the legal/billing entity. A domain assignment turns on a
product surface. Multi-domain (Q4-C) = one tenant row, N assignment rows.

```sql
ALTER TABLE public.tenant_domain_assignments
  ADD COLUMN status        text NOT NULL DEFAULT 'active',   -- active|trialing|past_due|cancelled
  ADD COLUMN plan_id       uuid REFERENCES public.subscription_plans(id),
  ADD COLUMN trial_ends_at timestamptz,
  ADD COLUMN activated_at  timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX ON public.tenant_domain_assignments (tenant_id, domain_code);

ALTER TABLE public.subscription_plans
  ADD COLUMN domain_code text NOT NULL REFERENCES public.platform_domains(code);
```

Backfill kills the duplicate-Starter bug:
```sql
UPDATE public.subscription_plans
SET    domain_code = CASE
  WHEN slug LIKE 'lnai-%' THEN 'MARKETS'
  WHEN slug LIKE 'sos-%'  THEN 'LOGISTICS'
END
WHERE  domain_code IS NULL;
```

Franchise hierarchy stays as is. A B2B tenant starts with one default
franchise named after the org; multi-branch organisations add more from
Settings → Franchises.

Per-domain billing — each assignment carries its own plan and Razorpay
subscription id. Invoices roll up at the tenant level; line items break
out per domain.

## Signup wizard + provisioning

**`/signup` (domain picker, ~5 s).** Two tiles: Logistics / Markets-advisor.
Pick one → routes to `/signup/[domain]`. URL-share-friendly.

**`/signup/[domain]` (single form, ~30 s).** Fields: work email, password,
organisation name, country (defaults to India from IP). Footer line:
"You'll start on the free plan — no card needed." Turnstile (already
wired) gates Submit.

Submit → `supabase.auth.signUp({ ..., options: { data: { org_name, country, domain_code }, captchaToken } })`
→ returns instantly with "Check your email."

**Email-verify landing.** User clicks magic link → Supabase fires the
existing post-signup Auth Hook. The hook handler branches on
`raw_user_meta_data.domain_code`:

```ts
const domain = body.record.raw_user_meta_data?.domain_code ?? 'SOS-RETAIL';
switch (domain) {
  case 'SOS-RETAIL':      return await provisionRetailUser(body);      // existing
  case 'LOGISTICS':       return await provisionOrgTenant(body, 'LOGISTICS');
  case 'MARKETS-ADVISOR': return await provisionOrgTenant(body, 'MARKETS');
}
```

`provisionOrgTenant` (one shared SQL function, `SECURITY DEFINER`,
idempotent like `provision_new_retail_user`) does:

1. `INSERT tenants` with `name = org_name`
2. `INSERT franchises` (default, named after org)
3. `INSERT user_roles` (signer = `tenant_admin` of that franchise)
4. `INSERT tenant_domain_assignments` (status='active', plan_id=freemium for that domain)
5. `INSERT user_active_membership` pointing to the new role row
6. Returns `{ tenant_id, assignment_id, role_id }`

**Failure paths.** Edge function 500 → frontend retry button (same
affordance as retail flow). Captcha fails → inline error, no signup
attempt. Email already exists → "This email already has an account.
Sign in?" link.

## Setup cards + invite flow

**Setup cards on the new-tenant dashboard.** Top of Home shows a
"Get set up" panel. State in a new table:

```sql
CREATE TABLE public.tenant_setup_progress (
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain_code  text NOT NULL,
  task_key     text NOT NULL,
  status       text NOT NULL DEFAULT 'pending', -- pending|completed|dismissed
  completed_at timestamptz,
  PRIMARY KEY (tenant_id, domain_code, task_key)
);
```

**Per-domain task definitions (v1):**

| domain_code | task_key | trigger | unlocks |
|---|---|---|---|
| LOGISTICS | `invite_team` | always | — |
| LOGISTICS | `add_gst` | first invoice send | tax invoices |
| LOGISTICS | `connect_lead_channels` | always | inbound leads (WhatsApp / Email) |
| LOGISTICS | `import_shipments` | always | analytics seed |
| LOGISTICS | `take_tour` | always | — |
| MARKETS | `invite_advisors` | always | — |
| MARKETS | `add_pan_business` | upgrade to paid | tax invoices |
| MARKETS | `connect_broker` | always | real-money mode |
| MARKETS | `sebi_sub_broker_reg` | first live trade | live-money signals |
| MARKETS | `take_tour` | always | — |

`always` tasks appear at signup. Trigger-based tasks promote themselves
when the user attempts the gated action (Stripe pattern). Compliance-
required cards re-promote when the action is retried.

**Invite flow.** Settings → Team → "Invite". Admin enters email + picks
role (`tenant_admin` / `franchise_admin` / `user`) + optional franchise.
Writes to a new `invitations` table (token, expires_at 7d, scoped to
tenant/franchise/role). Magic-link email sent.

Recipient lands on `/invite/[token]`. Edge function `accept-invite`:
- Token valid + signed-in same email → insert `user_roles`, switch active membership, redirect to dashboard
- Token valid + signed-out + email already has an account → "Sign in to accept"
- Token valid + signed-out + email is new → minimal signup (password only) → email verify → accept
- Expired / invalid → friendly error + "Request a new invite"

## Package catalog + trial mechanics

Each domain in v1 has four rows in `subscription_plans`:

- **Freemium** (`price_monthly = 0`, capped limits)
- **Starter** (paid)
- **Pro** (paid)
- **Enterprise** (sales-led, no self-checkout — "Contact us" CTA)

**Trial mechanics (hybrid freemium + no-card paid trial).** Upgrading
from Settings → Billing:
- `tenant_domain_assignments.status = 'trialing'`, `trial_ends_at = now() + interval '14 days'`
- No Razorpay subscription created yet
- Dashboard banner: "Pro trial — 14 days left · Add card to keep it"

Nightly cron (markets-worker scheduler) sweeps
`trial_ends_at < now() AND status = 'trialing' AND razorpay_subscription_id IS NULL`
and downgrades to `status = 'active', plan_id = freemium_plan_id` with
an email + in-app notification.

Adding a card promotes the assignment to `status = 'active'` with the
paid plan and a fresh Razorpay subscription.

## Data model summary

New tables:
- `public.user_active_membership`
- `public.tenant_setup_progress`
- `public.invitations`

Extended tables:
- `public.tenant_domain_assignments` (+ status, plan_id, trial_ends_at, activated_at, razorpay_subscription_id)
- `public.subscription_plans` (+ domain_code; backfill `lnai-*` → MARKETS, `sos-*` → LOGISTICS)

New SQL functions:
- `provision_org_tenant(p_user_id uuid, p_domain_code text, p_org_name text)` (idempotent, `SECURITY DEFINER`)

New edge functions:
- `accept-invite` (token validation + membership insert)
- `provision-on-signup` (branching shim over existing `provision-retail-user`)

Existing edge function reused:
- `provision-retail-user` (Sthira retail path unchanged)

## Implementation phasing

| Phase | Scope | Effort |
|---|---|---|
| **A** | Schema migration (`domain_code`, `status`, `plan_id`, `trial_ends_at`). Backfill plans + delete duplicate Starter rendering. Build `/welcome`, `/signup`, `/signup/[domain]` single-form. Build `provisionOrgTenant` SQL + branching shim in Auth-hook. Land context switcher + `user_active_membership` table. | ~5 d |
| **B** | Build invite flow end-to-end (table, edge function, `/invite/[token]` page, Settings → Team UI). | ~3 d |
| **C** | Build Setup-cards panel + `tenant_setup_progress` table. Define + ship the 10 task cards. Wire feature-gate triggers for GST and SEBI. | ~4 d |
| **D** | Paid-plan flow: in-app upgrade, Razorpay autopay, trial-expiry cron, downgrade pathway, email templates. | ~4 d |

Total ~16 days. Phase A unblocks everything else and fixes the
screenshot bug. B and C can run in parallel after A. D is the longest
single-task phase and is the only one that touches money.

## Testing

- Unit tests for `provision_org_tenant` (idempotency + cross-domain isolation)
- Unit tests for the trial-expiry cron sweep predicate
- Integration test: signup → email-verify → tenant exists → dashboard loads with Setup cards visible
- Integration test: existing-email invite → no re-verify, membership added, context switcher updates
- E2E manual checklist (modelled on `docs/Runbooks/2026-05-22-self-onboarding-e2e-checklist.md`) covering both domains' signup, upgrade-to-trial, trial expiry, downgrade, invite-accept

## Documented graduation paths (intentionally deferred)

- **DNS split** to per-domain subdomains (Q2-B). Manifest router already supports it.
- **Markets-advisor client-management sub-product** (Q5-B). Requires SEBI sub-broker compliance review.
- **Self-serve onboarding for AMRO / Banking / Trading / Insurance / Customs / Telecom / RealEstate / Ecommerce** — currently `/contact-sales` form.
- **Marketing site** at `www.sosservices.online` (Webflow / Framer); root redirect changes when ready.

## Open questions

None blocking. Items to revisit during implementation:

- **Razorpay subscription cancellation flow** — covered by D but the cancellation UI itself (cancel + refund + downgrade path) needs a small mockup pass.
- **Country detection at signup** — IP-based default is good enough for v1; if marketing wants targeted landing pages they can pass `?country=IN` and we'll prefer that.
- **Multi-language** — English-only at signup for v1; Hindi / regional later via the existing i18n layer.
- **GDPR / data-residency** — India-only signup for v1 (existing infra is in `ap-south-1`); EU / US requires a separate residency design.

## References

- `docs/plans/2026-05-21-self-onboarding-wizard-design.md` — Sthira retail flow (already built)
- `docs/plans/2026-05-20-multi-domain-platform-sequence-design.md` — Phase 0/1/2/3 platform sequence
- `docs/plans/2026-03-14-tenant-onboarding-functional-technical-architecture.md` — original tenant onboarding doc
- `docs/Runbooks/2026-05-22-supabase-auth-hook-config.md` — existing Auth-hook wiring
- `docs/Runbooks/2026-05-22-self-onboarding-e2e-checklist.md` — retail E2E checklist (template for B2B equivalent)
