# Closed-beta friend onboarding runbook

Owner: Vimal Bahuguna · Audience: solo operator during the friends/family
phase (≈10–20 users). Replaced by self-service signup (task #35) once
that's built.

## What this covers

How to provision a single friend so their first login to Sthira works.
The Sthira retail onboarding wizard does not currently create a tenant,
franchise binding, or portfolio for fresh users — those rows have to be
in place before the friend installs the APK or their first screen is an
empty Tier-Setup with no portfolio to link.

## Prereqs (one-time)

1. **Seed migration applied.** `supabase/migrations/20260522011746_retail_self_onboarding_foundation.sql` must be live on prod. Already applied on `gzhxgoigflftharcmdqj` as of 2026-05-22. (Supersedes the original 20260521143940 seed; that migration's "Sthira Retail" tenant was retired in favour of the existing SOS Services tenant + a new SOS-RETAIL franchise — see the migration file for the rationale.)
2. **Worker reachable.** `npm run dev:tunnel:check` must report a healthy
   path. The provisioning script POSTs to the worker to kick off signal
   generation — if the worker is unreachable the script logs a warning
   and continues; signals will start after the next worker restart.
3. **Service-role key in env.** `SUPABASE_SERVICE_ROLE_KEY` must be in
   `.env` (it already is). Do not share this key.

## Per-friend workflow

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ 1. Friend creates an account via /auth (you send them the URL).            │
│    They confirm their email. Nothing else happens automatically.           │
│                                                                            │
│ 2. You run:                                                                │
│      node scripts/provision-sthira-friend.mjs friend@example.com           │
│                                                                            │
│    Script does, idempotently:                                              │
│      - look up auth.users by email                                         │
│      - bind them to the SOS Services tenant + SOS-RETAIL franchise        │
│        with role 'user' in public.user_roles                              │
│      - create a default "My Portfolio" (paper mode) in markets.portfolios │
│      - POST /v1/jobs/bootstrap-portfolio to fire signal generation now    │
│        and schedule the daily 07:00 IST job                                │
│                                                                            │
│ 3. You send the friend the Sthira install link.                            │
│                                                                            │
│ 4. They log in. Their tenant + franchise resolves. They see their         │
│    portfolio in the dropdown during Tier-Setup. They onboard normally.    │
│                                                                            │
│ 5. The signal generator runs once for them on the immediate kick-off and  │
│    then daily at 07:00 IST. By the time they reach the Signals tab they   │
│    have content.                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

## Flags

- `--portfolio-name "Anil's portfolio"` — override the default "My Portfolio" name.

## Troubleshooting

**`No auth.users row found`**
Friend hasn't signed up yet. Send them the `/auth` URL first.

**`No tenant with slug=sos-services` or `No franchise with code=SOS-RETAIL`**
The seed migration hasn't been applied to the project the script is
pointing at. Re-apply `20260522011746_retail_self_onboarding_foundation.sql`
or check `SUPABASE_URL`.

**Worker bootstrap warning (script still exits 0)**
Means the rows are correct but the worker couldn't be reached. Either
the worker isn't running, or the LAN-IP path is broken. Re-run after
`npm run dev:tunnel:check` passes, or manually retry:
```bash
curl -X POST "${MARKETS_WORKER_URL:-http://127.0.0.1:8001}/v1/jobs/bootstrap-portfolio" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"portfolio_id":"<portfolio-id-the-script-printed>"}'
```

**Re-running for the same friend**
Safe. Each step checks before inserting and prints "already exists" if
it does. Use this when the worker was down on the first run and you
want signals re-bootstrapped.

## When to retire this runbook

Task #35 — self-service auto-provisioning. Once a `auth.users` INSERT
trigger or signup-hook edge function does the same chain server-side,
this runbook becomes unnecessary. Until then, every new friend is one
shell command.

## What the script does NOT cover

- **Broker connection.** The friend still needs to OAuth Zerodha/Fyers
  from inside Sthira to get real holdings. Until they do, their
  portfolio is in `mode='paper'`.
- **Push token registration.** Happens client-side when the user
  accepts the notification permission.
- **Risk profile + tier setup.** The friend completes these inside the
  Sthira onboarding wizard.

Those three are user-driven — the script only fills the gaps a
self-service flow would have filled automatically.
