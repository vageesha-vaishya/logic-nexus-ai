# Unified onboarding wizard — manual E2E checklist

Audience: solo operator. Run before handing the new B2B signup chain to a
friend or before flipping any marketing-site links to `sosservices.online`.
Estimated time: ~45 min on desktop + ~20 min on Android (Android optional
for B2B; retail-tenant Sthira device flow is covered by the earlier retail
runbook).

Companion docs:
- `docs/plans/2026-05-22-unified-platform-onboarding-design.md` (locked design)
- `docs/Runbooks/2026-05-22-supabase-auth-hook-config.md` (Auth-hook webhook URL)
- `docs/Runbooks/2026-05-22-self-onboarding-e2e-checklist.md` (Sthira retail
  E2E, still valid — this runbook covers the B2B half)

## Prereqs

1. Supabase Auth → Database Webhook for `auth.users INSERT` points at
   `provision-retail-user` (the dispatcher v2) — verified per the
   companion runbook.
2. Migrations applied through `20260522064818_trial_expiry_sweep.sql` on
   `gzhxgoigflftharcmdqj`.
3. Edge functions deployed: `provision-retail-user` (v2 dispatcher),
   `accept-invite` (v1), `domain-subscription` (v1).
4. `pg_cron` job `trial-expiry-sweep` is active (verify in Supabase
   dashboard → Database → Cron).
5. Three fresh `@yopmail.com` test emails for the three audiences:
   - `sthira-e2e-2026-05-22@yopmail.com` (retail individual)
   - `b2b-logistics-2026-05-22@yopmail.com` (logistics org)
   - `b2b-markets-2026-05-22@yopmail.com` (markets-advisor org)

## Track A — Entry surface

### A1. Root + welcome routing

- [ ] Sign out. Visit `https://sosservices.online/` — redirects to
      `/welcome` (Loader visible briefly while auth state resolves).
- [ ] `/welcome` shows three tiles: "I'm an individual investor",
      "Register an organization", "I have an invite link".
- [ ] Footer "Sign in" link goes to `/auth`.
- [ ] After logging in via /auth, visiting `/` redirects to `/dashboard`
      (the post-login surface), **not** back to `/welcome`.
- [ ] Visiting `/landing` still renders the legacy marketing page (kept
      for the future marketing-site graduation path).

### A2. Individual investor tile

- [ ] Click "I'm an individual investor" → lands on `/auth?intent=retail`.
- [ ] Sign up there → email verify → land in Sthira retail. (Existing
      retail flow; covered fully by the 2026-05-22 retail checklist.)

## Track B — B2B logistics signup (happy path)

### B1. Signup form

- [ ] `/welcome` → "Register an organization" → `/signup`.
- [ ] Two tiles: "Logistics CRM" and "Markets Advisor". Pick **Logistics CRM**.
- [ ] Land on `/signup/logistics`. Form fields: email, password, org
      name, country (defaults India). Submit disabled until validation
      passes.
- [ ] Submit with `b2b-logistics-2026-05-22@yopmail.com`, password ≥ 8
      chars, org "Acme Logistics QA", country India.
- [ ] "Check your email" success screen renders with the email echoed back.

### B2. Email verify + dispatcher

- [ ] Open the verification link. Land back at `/` while signed in →
      redirects to `/dashboard`.
- [ ] In Supabase dashboard → Edge Functions → `provision-retail-user`
      → Logs: confirm a `provision-on-signup: org ok` log with the new
      `tenant_id` + `assignment_id`.
- [ ] In SQL editor:
      ```sql
      SELECT t.name, t.slug, tda.subscription_status, pd.code, sp.slug AS plan_slug
      FROM   tenants t
      JOIN   tenant_domain_assignments tda ON tda.tenant_id = t.id
      JOIN   platform_domains pd           ON pd.id          = tda.domain_id
      JOIN   subscription_plans sp         ON sp.id          = tda.plan_id
      WHERE  t.billing_email = 'b2b-logistics-2026-05-22@yopmail.com';
      ```
      Expect one row: `subscription_status='active'`, `code='logistics'`,
      `plan_slug='logistics-freemium'`.

### B3. Topbar context switcher

- [ ] Topbar shows "Acme Logistics QA · …" pill with `Building2` icon.
- [ ] Open the switcher → only the new logistics tenant is listed.
- [ ] "Register another organization" footer item → `/signup`.

### B4. Setup cards visible on Home

- [ ] `/dashboard` renders the "Get set up" panel at the top with 4
      visible cards (3 "always" — `invite_team`, `connect_lead_channels`,
      `import_shipments`, `take_tour` — plus the `add_gst` card hidden
      until promoted).
- [ ] Progress bar reads "0 of 4".
- [ ] Click any card's "Mark done" → it strikes through, progress bumps,
      card disappears from the visible list at next mount.
- [ ] After completing 2 of 4, the panel auto-collapses (chevron flips).
- [ ] Complete all 4 → the panel disappears entirely on next mount.

### B5. Settings → Team (invite flow)

- [ ] Navigate to `/dashboard/settings/team`. Members list shows you as
      "(you)" with role `Owner / tenant admin`. Pending invites empty.
- [ ] Click "Invite teammate". Enter `b2b-logistics-team-2026-05-22@yopmail.com`,
      role "Member", submit.
- [ ] Toast "Invite created — link copied to your clipboard."
- [ ] Pending invites list shows the new invite with "expires in 7d".
- [ ] Copy + revoke icons work; clicking revoke removes it from the list.

### B6. Invite-accept flow (signed-out + new email)

- [ ] Sign out. Paste the invite URL into the address bar. Lands on
      `/invite/<token>`.
- [ ] "You've been invited" screen. Click "Sign in to accept".
- [ ] Redirect → `/auth?next=/invite/<token>`. Click "Create an account
      first" or signup with the invited email.
- [ ] Email verify → return to `/invite/<token>` → auto-accept fires →
      "You're in — welcome to the team." → land on `/dashboard`.
- [ ] Topbar switcher now lists Acme Logistics QA as the only membership.

### B7. Invite-accept flow (signed-in same email)

- [ ] Re-invite a different email you have an existing account for.
- [ ] Click the invite link while already signed in → silent accept,
      redirect to `/dashboard`, switcher shows the new membership.

### B8. Invite-accept failure cases

- [ ] Revoked invite → 410 with "This invitation was revoked by the
      admin who sent it."
- [ ] Email-mismatch (sign in as wrong account, click invite) → 403
      with "Wrong account" + "Sign out and switch accounts" CTA.
- [ ] Visiting `/invite/garbage-token` → 404 with "We couldn't find this
      invitation."

## Track C — Markets-advisor B2B (parallel happy path)

### C1. Signup
- [ ] Repeat B1–B4 with `/signup/markets`, email
      `b2b-markets-2026-05-22@yopmail.com`, org "Quanta Advisors QA".
- [ ] SQL spot check: assignment is `code='markets'`, plan
      `markets-freemium`.

### C2. Setup cards
- [ ] Cards shown: `invite_advisors`, `connect_broker`, `take_tour` (3
      always cards). `add_pan_business` + `sebi_sub_broker_reg` hidden.
- [ ] `connect_broker` CTA → `/dashboard/markets/settings/brokers`.

## Track D — Plan upgrade + trial (D1)

### D1.1 Start trial

- [ ] In Acme Logistics QA, visit `/dashboard/settings/billing`.
- [ ] "Currently on Free" state card. Plan grid shows Free, Starter,
      Professional, Enterprise (4 cards).
- [ ] Click "Start 14-day trial" on Professional → toast "Started your
      Professional trial — 14 days, no card needed."
- [ ] Current-state card updates: "Currently on Professional · Trial —
      14 days left. Add a card to keep this plan past trial."
- [ ] Plan grid: Professional now badged "Current"; Free card disabled
      with "Default plan" copy.

### D1.2 Cancel trial

- [ ] In the same view click "Cancel trial & go back to Free" → toast
      "Trial cancelled — you're back on the Free plan."
- [ ] State reverts to "Currently on Free".

## Track E — Razorpay card capture (D2)

These steps require `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` to be set
on the Supabase project (Edge Function secrets). With test keys, payment
success is simulated through Razorpay's test-mode card numbers.

### E1. Razorpay not configured (default state)

- [ ] On a fresh project with no Razorpay env vars, click "Add card to
      keep this plan" during a trial. Sonner toast: "Razorpay isn't
      connected yet — ask the operator to set the API keys."
- [ ] Network tab shows a 503 from `/functions/v1/domain-subscription`
      with code `razorpay_not_configured`.

### E2. Razorpay configured — happy path

- [ ] Set test keys, redeploy `domain-subscription`. Start a trial again.
- [ ] Click "Add card to keep this plan" → Razorpay Checkout opens.
- [ ] Pay with Razorpay test card `4111 1111 1111 1111`, CVV 100, any
      future expiry, OTP 1234. Modal closes on success.
- [ ] Toast "Payment confirmed — you're on the paid plan."
- [ ] Current-state card now reads "Currently on Professional · Paid
      plan — billed monthly via Razorpay."
- [ ] SQL spot check:
      ```sql
      SELECT subscription_status, razorpay_subscription_id IS NOT NULL AS has_pay,
             plan_id IS NOT NULL AS has_plan, trial_ends_at
      FROM   tenant_domain_assignments
      WHERE  tenant_id = '<acme tenant id>';
      ```
      Expect `subscription_status='active'`, `has_pay=true`,
      `trial_ends_at=NULL`.

### E3. Razorpay failure paths

- [ ] Cancel Razorpay modal mid-checkout → no DB change. Click "Add
      card" again works.
- [ ] Use a Razorpay test card that fails (`4000 0000 0000 0002`) →
      Razorpay shows the failure inside its widget. On close, no
      assignment change.
- [ ] Tamper with the signature in DevTools network replay → confirm
      endpoint returns 400 `signature_mismatch`.

## Track F — Trial-expiry sweep (D3)

The pg_cron job runs daily at 03:30 UTC. To exercise it on demand:

### F1. Manual invocation

- [ ] In Supabase SQL editor: insert a trialing-expired row for the
      Acme Logistics tenant:
      ```sql
      UPDATE tenant_domain_assignments
      SET    subscription_status = 'trialing',
             trial_ends_at       = now() - interval '1 hour',
             razorpay_subscription_id = NULL,
             plan_id             = (SELECT id FROM subscription_plans WHERE slug='lnai-pro')
      WHERE  tenant_id = '<acme tenant id>';

      SELECT public.expire_trials_and_downgrade();
      ```
- [ ] Expect the function to return `1`. Re-running returns `0`.
- [ ] Verify the row:
      ```sql
      SELECT subscription_status, plan_id::text, trial_ends_at
      FROM   tenant_domain_assignments
      WHERE  tenant_id = '<acme tenant id>';
      ```
      Expect `'active'`, freemium plan id, `NULL` trial_ends_at.

### F2. Cron schedule + logs

- [ ] In Supabase dashboard → Database → Cron, confirm
      `trial-expiry-sweep` is **active** with schedule `30 3 * * *`.
- [ ] After the next 03:30 UTC run, click into the job's last run logs
      and confirm a `NOTICE: expire_trials_and_downgrade: N rows
      downgraded` message (where N is the number of expired trials).

## Track G — Cross-cutting checks

### G1. RLS sanity

- [ ] Sign in as a `Member` (non-admin) of Acme Logistics QA.
- [ ] Visit `/dashboard/settings/team` — members list visible, but
      "Invite teammate" submit fails with 403 (RLS on
      `invitations.invitations_tenant_admin_insert`).
- [ ] Visit `/dashboard/settings/billing` — page renders read-only;
      "Start 14-day trial" click results in toast "Could not save"
      from `tenant_domain_assignments` RLS.
- [ ] Confirm member can read `tenant_setup_progress` (Setup cards
      render) but cannot mark any complete — `tenant_setup_progress_admin_write`
      enforces tenant_admin / franchise_admin / platform_admin.

### G2. Multi-domain expansion (post-signup)

- [ ] As tenant_admin of Acme Logistics, no Settings UI exists yet to
      add the Markets domain — that's the documented graduation path.
      Verify via SQL that adding a new `tenant_domain_assignments` row
      pointing at the markets domain *does* work end-to-end (we don't
      need a UI for this in v1, but the data model must support it).

### G3. Existing-email invite (cross-tenant)

- [ ] As Acme Logistics admin, invite an email that already has a Sthira
      retail account.
- [ ] Recipient clicks link → signed-in (Sthira context) → auto-accept
      fires → context switcher gains the Acme Logistics entry; Sthira
      entry preserved.
- [ ] Switcher: picking Sthira reloads dashboard into Sthira retail;
      picking Acme reloads into the logistics dashboard.

## Failure modes — symptom map

| Symptom | Likely cause | Fix |
|---|---|---|
| `/signup` 404s | Routes not wired in `App.tsx` | Confirm `<Route path="/signup">` + `<Route path="/signup/:domain">` exist |
| Signup email never arrives | Supabase email provider not configured | Settings → Auth → SMTP |
| Dispatcher logs "domain_code missing" | `raw_user_meta_data` didn't include `domain_code` | Confirm `useAuth().signUp(..., { domain_code, org_name, country })` in `SignupForm.tsx` |
| `provision_org_tenant` raises "freemium plan not found" | Missing freemium seed for that domain | Re-run `20260522045658_unified_onboarding_foundation.sql` seed inserts |
| `accept-invite` always 401 | Auth header missing from supabase-js invoke | Verify `verify_jwt=true` deployment + that the client is signed-in before the call |
| Trial banner stays "0 days" after sweep ran | Stale TanStack-Query cache | Refresh; or invalidate `["tenant-domain-assignment"]` after the sweep |
| Razorpay 503 with `razorpay_not_configured` | Keys missing in edge-function secrets | Set `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` on the function, redeploy |
| Razorpay 400 `signature_mismatch` | Client tampered with payment params, or wrong key_secret | Verify `RAZORPAY_KEY_SECRET` matches the test/live key_id you're using |
| Context switcher shows nothing | `useMemberships` returns 0 rows | Confirm `user_active_membership` got an insert from `provision_org_tenant` (or fall back to first user_roles row) |

## When this checklist is green

Tag the build, write the U0 epic done, and start linking marketing
content to the new signup paths. Remaining graduation work (subdomain
DNS split, Markets-advisor client-management product, AMRO + Banking +
Trading self-serve, marketing site) is intentionally deferred per the
design doc §"Documented graduation paths".
