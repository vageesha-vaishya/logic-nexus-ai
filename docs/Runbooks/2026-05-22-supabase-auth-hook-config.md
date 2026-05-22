# Supabase post-signup Auth hook wiring

Audience: solo operator. One-time dashboard configuration. Step 3 of
the self-onboarding implementation plan
(`docs/plans/2026-05-21-self-onboarding-wizard-design.md`).

## Goal

When a new row lands in `auth.users` (i.e. a user completes email
verification on signup), Supabase fires an HTTP POST to the
`provision-retail-user` edge function, which atomically creates their
tenant binding, portfolio, paper-trading cash, NIFTY-50 ETF seed
holding, and retail-profile rows.

## Why this is dashboard-only

Supabase doesn't expose Auth Hook / Database Webhook configuration via
the public MCP / SQL API. It's a UI-only setting today (2026-05-22).
This step requires ~3 minutes in the dashboard, one time.

## Step-by-step

1. Open Supabase Studio for project `gzhxgoigflftharcmdqj` → **Database**
   → **Webhooks**. (NOT the older "Functions" → "Hooks" section — that's
   per-table triggers, not webhook configuration.)

2. Click **Create a new hook**. Fill in:
   - **Name**: `auth-users-provision-retail-user`
   - **Table**: `auth.users`
   - **Events**: tick **Insert** only. Leave Update + Delete unchecked.
   - **Type**: HTTP Request
   - **Method**: POST
   - **URL**: `https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/provision-retail-user`
   - **HTTP headers**: leave defaults. (The function has
     `verify_jwt: false` so no Authorization header is required.)
   - **HTTP params**: none.
   - **Timeout**: 5000ms (default OK; provision typically completes in
     <200ms).

3. Click **Create webhook**.

## Verify

Create a fresh signup via either:

- The Sthira app's `/auth` page (full E2E test), OR
- A direct API call from your laptop:
  ```bash
  curl -X POST "https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/signup" \
    -H "apikey: <your-anon-key>" \
    -H "Content-Type: application/json" \
    -d '{"email": "test-+sos-onboarding@yopmail.com", "password": "TestPass123!"}'
  ```

Then immediately check:
```sql
-- Should return 1 if the hook fired
SELECT count(*)
FROM public.user_roles ur
JOIN public.profiles  p  ON p.id = ur.user_id
JOIN public.tenants   t  ON t.id = ur.tenant_id
WHERE p.email = 'test-+sos-onboarding@yopmail.com'
  AND t.slug  = 'sos-services';
```

If 0 rows, check the webhook delivery log: Supabase Studio →
**Database** → **Webhooks** → your hook → **Recent deliveries**. Look
for the 200 status + the response body containing
`{"ok": true, "portfolio_id": "..."}`.

## Common failures

**Hook fires but function returns 500**
- Check the function logs: Supabase Studio → **Edge Functions** →
  `provision-retail-user` → **Logs**.
- Common culprits: `SOS-RETAIL franchise not found` (re-apply migration
  `20260522011746`); `auth.users row not found` (race condition —
  unlikely, log and retry).

**Hook doesn't fire at all**
- Verify the table is `auth.users` not `public.users` (Supabase
  sometimes auto-suggests `public.users`).
- Verify Events checkbox = Insert.
- Verify the webhook is *enabled* (toggle in the list view).

**Signup succeeds but the email-verification step seems to consume the
hook event**
- Verify users with `auth.users.email_confirmed_at` should still get
  provisioned. If only the unverified-row INSERT fires, that's correct
  — provision happens first, the user just can't log in until they
  click the verification email. Their portfolio is waiting for them.

## Belt-and-suspenders (frontend fallback)

The `/onboarding` route guard (implementation step 4) detects
unprovisioned state and calls the same edge function. So even if the
webhook misfires, the user gets provisioned on first login. The
webhook is the primary path; the frontend retry is the safety net.

## Disabling the hook

Toggle the webhook off in **Database → Webhooks**. Existing
provisioned users are unaffected. Future signups won't be
auto-provisioned until you re-enable.
