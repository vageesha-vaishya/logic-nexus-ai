# Auth Email / SMTP Configuration Repair — Design Specification

**Date:** 2026-09-01
**Scope:** Make auth email actually work on **both** the self-hosted stack and production Supabase Cloud: real SMTP delivery, correct email link paths, and a correct redirect base URL. This closes the top cutover blocker recorded in `deploy/selfhosted-supabase/README.md`'s "Open items before cutover" — self-hosted's signup/password-reset path being unusable — and repairs the same class of defect found on production during this design pass.
**Status:** Approved for implementation

## 1. Background

The self-hosted stack's broken email path was first surfaced during Phase 5 (Task 1's trigger verification had to route around `/auth/v1/signup` entirely) and has been carried as a known cutover blocker since: `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are literal `REPLACE_WITH_*` placeholders. With 103 real users now migrated there, that means no password reset, no magic link, no email change, no invite, and no new signup.

Investigating it for this phase turned up three further defects that a naive "fill in the SMTP credentials" fix would have left in place — all confirmed live:

1. **All four `MAILER_URLPATHS_*` values are corrupted** on self-hosted, reading `C:/Users/Vimal/AppData/Local/Programs/Git/auth/v1/verify` instead of `/auth/v1/verify`. This is MSYS2/Git-Bash path mangling: a leading `/auth/...` argument was expanded against the Git-for-Windows installation root when these were originally set from a Windows shell. Email links built from these paths would be malformed even with SMTP working.
2. **Self-hosted's `SITE_URL` points at the API gateway**, `https://supabase.sosservices.online`, not the application, `https://app.sosservices.online`. GoTrue uses `SITE_URL` both as the base for email links and — together with `URI_ALLOW_LIST` (currently empty) — as the allow-list against which a client-supplied `redirectTo` is validated. The application supplies `${window.location.origin}/auth` for password reset (`src/components/layout/DashboardLayout.tsx:559-560`), `${window.location.origin}/` for signup (`src/hooks/useAuth.tsx:400-405`), and `${window.location.origin}/auth/callback` for OAuth (`src/lib/auth/oauthSignIn.ts`). None of those match the current `SITE_URL`, and the allow-list is empty, so GoTrue would reject the supplied redirect and fall back to the API domain.
3. **Production has the same redirect defect, in a worse form.** Queried via the Management API: `site_url` is still `http://localhost:3000` (an unmodified default) and `uri_allow_list` is empty. Password-reset links issued by production today therefore point at localhost — i.e. this is not merely cutover preparation, it is a live defect affecting real users now.

**Additional production finding — load-bearing for this phase's goal:** production has **no custom SMTP** (`smtp_host = None`), so it uses Supabase's built-in sender, and `rate_limit_email_sent = 2` — two auth emails **per hour**, project-wide. Across 103 users that is not a working password-reset capability. Configuring custom SMTP without also raising this limit would satisfy the letter of "fix SMTP" while leaving email effectively broken, so §3 treats the limit as part of the fix rather than a separate concern. It is called out explicitly here rather than folded in silently, because it is the one change in this phase that alters a deliberate-looking safety setting.

**Verified during this design pass (facts the plan depends on):**
- `sosservices.online` is **verified** in Resend with `sending: enabled` (queried via the Resend API), so `noreply@sosservices.online` is a usable sender.
- The VPS can reach `smtp.resend.com` on ports 465, 587 and 2587 (TCP probe from the VPS itself).
- The existing `RESEND_API_KEY` **authenticates successfully** over SMTP as user `resend` — verified with a real `smtplib` login against `smtp.resend.com:465` from the VPS, which returned success without sending anything. This rules out the key being scoped API-only.
- **Port 465 is correct for GoTrue.** Its mailer calls `gomail.NewDialer(host, port, user, pass)` (`internal/mailer/mailmeclient/mailmeclient.go:67`), and gomail's `NewDialer` sets `SSL: port == 465` — so 465 gets implicit TLS automatically, matching what Resend expects on that port. No extra TLS configuration is needed.

## 1a. Audit pass (2026-09-01) — verified against GoTrue's redirect-validation source and this repo's dev config

Three findings, all from reading the actual validation code rather than reasoning about how it presumably works. One of them is a regression this design would have caused on production.

**Finding 1 — `ADDITIONAL_REDIRECT_URLS=https://app.sosservices.online/**` is redundant.** `internal/utilities/request.go:99-113` shows GoTrue allows a redirect whenever its scheme, hostname and port all match `SITE_URL`'s — checked *before* the allow-list loop is ever reached. So once `SITE_URL` is `https://app.sosservices.online`, all three URLs the app actually sends (`/`, `/auth`, `/auth/callback`) are already permitted. §3 step 3's allow-list entry buys nothing.

**Finding 2 — but the allow-list *is* needed, for something this design missed entirely: local development runs against production.** `env`'s `VITE_SUPABASE_URL` points at the production project, and `vite.config.ts:704-706` pins the dev server to port **8081** (`strictPort: true`), with preview on 4173. Production's `site_url` is currently `http://localhost:3000` — which does not match the real dev port either, so localhost redirects are *already* misconfigured there. But changing production's `site_url` to the app domain, as §3 step 6 proposes, converts that from "wrong port" into "developer gets redirected to the live production app," because the same-origin rule in Finding 1 requires hostname **and** scheme to match, and the localhost exemption at line 111 applies only to the *port* comparison — it does not rescue a hostname mismatch. **Corrective decision: the allow-list on production should carry the real local-development origins (`http://localhost:8081/**`, and `http://localhost:4173/**` for preview) rather than the redundant production-domain entry.** Whether to include them is a judgement call for the plan owner — it slightly widens what production will redirect to, in exchange for not breaking local development against it — so it is surfaced here rather than decided unilaterally.

**Finding 3 — each allow-list entry carries a small startup-crash risk, which argues for keeping the list short.** `internal/conf/configuration.go:1211` compiles every entry with `glob.MustCompile(uri, '.', '/')`. The `Must` form panics on a malformed pattern, and this runs during config load at startup — the same hazard class as Phase 5b's empty-`GOTRUE_JWT_KEYS` crash-loop, on the same service now backing 103 real users. This does not argue against the entries in Finding 2, but it does mean every pattern should be syntax-checked before deployment rather than typed straight into a live env store, and that the redundant entry from Finding 1 is worth dropping on risk grounds alone, not just tidiness. (Note the separators passed are `.` and `/`, so `**` — not `*` — is the wildcard that crosses path segments and dots; a `*`-only pattern would silently fail to match sub-paths.)

**Also confirmed during this pass:** production's `mailer_urlpaths_*` are **not** corrupted — they are absent from the Management API response, meaning they sit at GoTrue's correct defaults. The Git-Bash path mangling is self-hosted-only, so §3's step 2 correctly has no production counterpart.

## 2. Goals / Non-Goals

**Goals:**
- Self-hosted `auth` sends real email via Resend, and a password-reset email arrives at a real inbox with a link that resolves to the application.
- Self-hosted's four `MAILER_URLPATHS_*` values are correct (`/auth/v1/verify`).
- Self-hosted's `SITE_URL` is the application domain, and the app's three real redirect URLs are accepted rather than rejected.
- Production's `site_url` and `uri_allow_list` are corrected so its currently-broken reset links resolve to the application.
- Production sends via Resend rather than the built-in sender, with an email rate limit that is usable for 103 users.
- Production's pre-change configuration is captured verbatim first, so rollback is real rather than aspirational.

**Non-Goals:**
- Email template customisation (branding, copy, layout) — templates stay at their defaults.
- Changing `mailer_autoconfirm`, `disable_signup`, `external_email_enabled`, or `mailer_secure_email_change_enabled` on either stack.
- The `storage` / `realtime` / `functions`-router JWT verification gaps — separate tracked items from Phase 5b, untouched here.
- Any change to the 103 migrated users' rows, the replication subscription, or JWT/JWKS configuration.
- Inbound/receiving email — Resend's `receiving` is disabled for this domain and this phase does not need it.

## 3. Approach

**Part A — self-hosted (env-var only; no compose change, per the Phase 5b finding that Coolify injects its whole env store into every container):**

1. Set `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASS=<RESEND_API_KEY>`, `SMTP_ADMIN_EMAIL=noreply@sosservices.online`. `SMTP_SENDER_NAME` is already `Logic Nexus AI` and stays.
2. Set all four `MAILER_URLPATHS_*` to `/auth/v1/verify`. **These must be written in a way that cannot be re-mangled** — the corruption being repaired was caused by a Windows shell expanding a leading-slash argument, so the implementation must avoid passing these values as bare arguments through a Git-Bash command line (write via a file, or quote in a way that defeats MSYS2 path conversion, and verify the resulting container value byte-for-byte).
3. Set `SITE_URL=https://app.sosservices.online`. **Leave `ADDITIONAL_REDIRECT_URLS` empty on self-hosted** — per §1a Finding 1, `SITE_URL`'s implicit same-origin rule already permits every URL the app sends, and per Finding 3 each unnecessary allow-list entry is an avoidable startup-panic risk.
4. Register all of the above in Coolify's env store **and** the on-disk `.env` — both, per the dual-source-of-truth rule documented in the README — then recreate only `auth`.

**Part B — production (Supabase Management API, `PATCH /v1/projects/{ref}/config/auth`):**

5. **Capture the current config first** and store it as the rollback baseline. Recorded during this design pass, to be re-confirmed at execution time: `site_url='http://localhost:3000'`, `uri_allow_list=''`, `smtp_host/port/user/pass/admin_email/sender_name` all `None`, `smtp_max_frequency=60`, `rate_limit_email_sent=2`.
6. Set `site_url` to `https://app.sosservices.online`. For `uri_allow_list`, set the **local-development origins** `http://localhost:8081/**,http://localhost:4173/**` (§1a Finding 2) — not the production domain, which `site_url` already covers. This preserves local development against production, which changing `site_url` would otherwise break. Syntax-check both globs before submitting (Finding 3). **Decided by the plan owner (2026-09-01): include the localhost origins.** The widening is bounded to loopback addresses, which an attacker cannot usefully receive redirected tokens on remotely, and the alternative — silently breaking local development against production — was judged the worse trade.
7. Set the same Resend SMTP settings as step 1.
8. Raise `rate_limit_email_sent` from `2` to `30` per hour — the ceiling exists because the built-in shared sender needed protecting; on a dedicated Resend domain it is a self-imposed outage for a 103-user tenant. **This is the one item here that relaxes a safety limit, and is flagged for explicit confirmation at review rather than treated as routine.**

Part A is done and verified before Part B begins, so the riskier live-production change happens only after the same configuration is proven working somewhere real.

## 4. Verification Plan

Delivery alone is insufficient — the corrupted paths and the wrong `SITE_URL` would both survive a "did the email arrive?" check. Each stack is verified on **link correctness**, not just receipt.

1. **Self-hosted, container state:** `auth` reports healthy; its resolved env shows the four `MAILER_URLPATHS_*` as exactly `/auth/v1/verify` with no Windows path prefix (byte-for-byte, not eyeballed), and `SITE_URL`/`GOTRUE_URI_ALLOW_LIST` as intended. Confirm only `auth` was recreated and `db` was not.
2. **Self-hosted, real delivery:** trigger a password reset for `bahuguna.vimal@gmail.com` (a real migrated user) through self-hosted, confirm the email arrives, and confirm the link's host is `supabase.sosservices.online/auth/v1/verify?...` with a `redirect_to` of `https://app.sosservices.online/...` — **not** `localhost`, not the API domain as the landing target, and not containing `C:/Users/...`.
3. **Self-hosted, redirect acceptance:** confirm GoTrue accepted the app-supplied `redirectTo` rather than silently substituting `SITE_URL` — the failure mode the allow-list change exists to fix, and one that a delivered email can otherwise hide.
4. **Production, config applied:** re-read the auth config via the Management API and confirm each changed field holds its new value.
5. **Production, real delivery:** the same password-reset test against production, with the same link-correctness assertions. This is the stronger test of the two, since production is the stack with live users.
6. **Production, no collateral change:** re-read the fields listed as Non-Goals (`mailer_autoconfirm`, `disable_signup`, `external_email_enabled`, `mailer_secure_email_change_enabled`) and confirm they are unchanged from the step-5 baseline — a `PATCH` that quietly resets an unrelated field is a realistic failure mode of this API.
7. The four standard production health-check curls remain `200`.
8. Confirm the 103/101/104 row counts are untouched — this phase changes configuration only.

## 5. Rollback

- **Self-hosted:** restore the previous env-var values (the `REPLACE_WITH_*` placeholders and the prior `SITE_URL`) and recreate `auth`. This returns the stack to its current state — email non-functional, which is the status quo, so rollback costs nothing that is presently working.
- **Production:** `PATCH` the captured step-5 baseline back. Two caveats worth stating plainly: (a) reverting `site_url` restores a **broken** state (links to `localhost:3000`), so rollback should be reserved for a genuine regression rather than reflexively applied; and (b) reverting SMTP to the built-in sender also restores the 2/hour limit, so the two should be reverted together or not at all.
- Neither stack's user data, tokens, or JWT configuration is touched by this phase, so there is nothing to restore in those areas.
