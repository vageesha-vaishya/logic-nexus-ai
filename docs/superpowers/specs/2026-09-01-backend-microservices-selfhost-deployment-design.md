# Backend Microservices Self-Host Deployment — Design

## Background

The self-hosted Coolify VPS currently runs the self-hosted Supabase stack, the
frontend (`app.sosservices.online`), and exactly one backend microservice
(`amro-api`). Seven other backend microservices that exist as code under
`services/` — `crm-api`, `sales-api`, `uim-api`, `finance-api`,
`logistics-api`, `compliance-api`, `comms-api` — have never been deployed to
this VPS at all (confirmed: none exist as Docker containers, running or
stopped).

> **Correction (added during final whole-branch review, 2026-09-01):** this
> claim was wrong for 5 of the 7 services. Mid-execution (during Task 3 of
> the implementation plan), querying Coolify's application list directly
> (`GET /api/v1/applications`) — rather than trusting the `docker ps -a |
> grep -iE '<service-name>'` check this design used, which can never match
> because Coolify container names are `<app-uuid>-<timestamp>` and never
> contain the service name — turned up pre-existing, live, healthy Coolify
> applications for `crm-api`, `comms-api`, `compliance-api`, `finance-api`,
> and `logistics-api`, all correctly configured against this exact repo.
> Only `sales-api` was genuinely missing (deployed fresh in Task 4); `uim-api`
> was legitimately created fresh in Task 2. See the implementation plan's
> ledger (`.superpowers/sdd/2026-09-01-backend-microservices-selfhost-deployment/progress.md`)
> for the full discovery writeup. Tasks 3, 5, 6, 7, and 8 of the plan were
> superseded as a result — nothing was deployed for those 5 services.

In local dev, `vite.config.ts`'s dev-server proxy routes specific path
prefixes to each of these services (e.g. `/api/v1/platform-domains` →
`uim-api`, `/api/crm` → `crm-api`, `/api/v1/invoices` → `finance-api`).
Production's `nginx.conf` has no equivalent routes for any of them — only
`/api/v2/amro/`, `/api/amro/`, and `/api/markets/` exist. Any dashboard
feature that calls one of the missing prefixes falls through nginx's SPA
catch-all (`try_files ... /index.html`) and receives HTML back instead of
JSON.

This was discovered as a side effect of unrelated Supabase self-host
migration work: `DomainService.ts`'s call to `/api/v1/platform-domains`
(backing the "authorized domains" feature and platform-domain-driven tenant
resolution) fails this way, confirmed via source inspection and a live
browser session. Five other console errors seen in that same session
(pipeline, sales forecast, win/loss metrics, revenue YTD, dashboard
preferences) were investigated and found to be unrelated — they are direct
Supabase table queries via `ScopedDataAccess`, and failed only because the
test account used had no tenant/role assignment (a `ScopedDataAccess`
scope-check throws synchronously in that case, before any network call).
That is a test-account artifact, not evidence those five widgets need a
backend microservice.

The user has explicitly decided to deploy all 7 services regardless, since
they are part of the intended architecture per this repo's own `CLAUDE.md`
("Backend microservices (under `services/`): Express.js APIs for CRM, UIM,
and AMRO modules"), not just the one (`uim-api`) with a confirmed broken
feature today.

## Goal

Deploy all 7 missing backend microservices to the self-hosted VPS, each
reachable in production through `nginx.conf`, using the same deployment
pattern already proven for `amro-api`.

## Architecture

Each service becomes its own individual Coolify "application" — mirroring
`amro-api`'s existing deployment exactly, not a bundled multi-container
stack (rejected: unproven pattern on this VPS, and per-service independence
matches how `amro-api` is already managed). Concretely, per service:

- Its own Dockerfile (4 of 7 already have one: `finance-api`,
  `logistics-api`, `compliance-api`, `comms-api`, all following an identical
  template — `node:22-bullseye-slim` multi-stage build, `HEALTHCHECK` hitting
  `/health`, runs as the non-root `node` user). The 3 missing
  (`crm-api`, `sales-api`, `uim-api`) get a Dockerfile copied from that same
  template, adjusted only for each service's own listening port.
- Its own Coolify application resource, built from `services/<name>` as the
  build context, deployed as its own container attached to the shared
  `coolify` Docker network (the same network `amro-api-container` and the
  frontend are already on, so nginx can reach every one of them by
  container name with no additional network wiring).
- Its own env vars, mirroring `amro-api`'s existing production
  configuration:
  - `SUPABASE_URL=https://supabase.sosservices.online`
  - `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_SERVICE_KEY` (both set to the
    same current self-hosted service-role key — the codebase references
    both names in different places; setting both avoids relying on which
    one a given service happens to read)
  - `CORS_ORIGIN=https://app.sosservices.online`
  - `NODE_ENV=production`
  - Its own port variable, per service (these are **not** uniform — each
    service reads a different env var name for its port, falling back to a
    hardcoded default only when unset):
    | Service | Port env var | Default |
    |---|---|---|
    | crm-api | `PORT` | 3011 |
    | sales-api | `SALES_API_PORT` | 3201 |
    | uim-api | `UIM_API_PORT` (or `PORT`) | 3701 |
    | finance-api | `FINANCE_API_PORT` | 3301 |
    | logistics-api | `LOGISTICS_API_PORT` | 3401 |
    | compliance-api | `COMPLIANCE_API_PORT` | 3501 |
    | comms-api | `COMMS_API_PORT` | 3601 |

  All 7 services also read a shared, optional set of
  `CRM_AUTH_HEADER_*` auth-header-monitoring tuning vars — every one of
  these defaults sanely in code and none is required to boot. Leave them
  unset.

### Dependencies (confirmed safe to omit)

No message broker (Kafka) or cache (Redis) exists on this VPS, and none is
being added as part of this work. Checked each service's startup path
directly rather than assumed:

- `crm-api`: Kafka is fully decommissioned code-side (post-Phase-5 refactor
  moved its Kafka publishers to `sales-api`/`finance-api`); the
  `CRM_KAFKA_ENABLED` env is read but produces only a log line, never a
  behavior.
- `sales-api`: never attempts a Kafka connection at startup at all — its
  Kafka producer file exists but nothing in `index.ts`/`app.ts` boot path
  invokes it.
- `logistics-api`: explicitly wraps its events-producer `initialize()` in
  try/catch at boot, logs a warning ("events will skip") and continues to
  `app.listen()` on failure.
- `finance-api`: comment at the top of its Kafka init explicitly states
  "best-effort mode. If Kafka [unavailable, continues]," each of its 3
  init steps independently try/catch'd.
- `uim-api`, `compliance-api`, `comms-api`: no Kafka/Redis references in
  their source at all.

`comms-api` additionally reads provider credentials (`RESEND_API_KEY`,
`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`, `FCM_SERVICE_ACCOUNT_JSON`) for
actually sending email/SMS/push/WhatsApp messages. These are out of scope
for this deployment — the service will boot and serve `/health` and
non-sending routes without them; endpoints that actually dispatch a message
will fail until those credentials are separately provisioned. This is a
known, accepted limitation of this phase, not a blocker.

## Routing (nginx.conf)

New `location` blocks added to `nginx.conf`, each `proxy_pass`-ing to the
service's container name on its production port. Taken directly from
`vite.config.ts`'s dev proxy map (lines ~735-785), not reconstructed from
memory — cross-checked entry by entry against it during self-review, which
caught several gaps an earlier pass of this table had missed:

| Path prefix | Target | Must precede |
|---|---|---|
| `/api/crm/v1/leads` | `sales-api-container:3201` | `/api/crm` (leads were lifted from crm-api to sales-api; the narrower prefix must win) |
| `/api/crm` | `crm-api-container:3011` | — |
| `/api/sales` | `sales-api-container:3201` | — |
| `/api/v1/platform-domains`, `/api/v1/domain-assignments`, `/api/v1/domain-config`, `/api/v1/franchises` | `uim-api-container:3701` | — |
| `/api/v2/uim` | `uim-api-container:3701` | — |
| `/api/v1/invoices`, `/api/v1/tax` | `finance-api-container:3301` | — |
| `/api/finance` | `finance-api-container:3301` | — |
| `/api/logistics` | `logistics-api-container:3401` | — |
| `/api/v1/compliance` | `compliance-api-container:3501` | — |
| `/api/compliance` | `compliance-api-container:3501` | — |
| `/api/v1/comms` | `comms-api-container:3601` | — |
| `/api/comms` | `comms-api-container:3601` | — |

> **Correction (added during final whole-branch review, 2026-09-01):** the
> "Must precede: `/api/v1` catch-all" entries above, and the row that used
> to read `` `/api/v1` (catch-all, matching dev's fallback ordering) | the
> existing amro route ``, described something that has never existed in
> production `nginx.conf`. Only `vite.config.ts`'s dev-server proxy has a
> bare `/api/v1` fallback that routes to amro. In production, any
> `/api/v1/*` path not explicitly matched by one of the blocks above (or by
> the pre-existing `/api/v2/amro/`, `/api/amro/`, `/api/markets/` blocks) has
> always silently fallen through to the SPA's `try_files ... /index.html` —
> a pre-existing gap, not something this design or its implementation plan
> was asked to close. It remains open after this deployment.

The "must precede" column reflects *Vite's* proxy-table semantics
(first-match-wins, hence its own comments about ordering). nginx's plain
(non-regex) `location` blocks resolve overlapping prefixes differently —
by longest-match, independent of declaration order — so `/api/crm/v1/leads`
will correctly win over the shorter `/api/crm` in `nginx.conf` regardless of
which is written first. Declaration order in the new `nginx.conf` blocks is
therefore not load-bearing the way it is in `vite.config.ts`; grouping
related blocks together is for readability only. (This assumes all new
blocks stay plain-prefix `location` blocks, matching every existing block
in this file today — none use regex (`~`) matching.)

**Explicitly not routed**: `/api/v1/tenant-branding` and
`/api/v1/tenant-branding.css` proxy (in dev) to a distinct "Tenant Branding
API" that has no corresponding directory under `services/` at all — it is
not one of the 7 services this deployment covers, and dev's own proxy setup
for it is itself incomplete (no default target, a placeholder start
command). Left out of scope entirely; not an oversight.

All new blocks follow the existing amro blocks' shape exactly:
`proxy_http_version 1.1`, the four standard `proxy_set_header` lines
(`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`), and
`proxy_buffering off`.

## Verification (per service)

For each of the 7 services, in this order:
1. Deploy via Coolify; confirm the container reaches a healthy state
   (Docker `HEALTHCHECK` passing).
2. `docker exec <container> curl -f localhost:<port>/health` succeeds
   directly inside the container.
3. The new nginx route reaches the service externally (`curl
   https://app.sosservices.online/api/.../health` or equivalent, through
   Traefik/HTTPS, not just internally — tonight's earlier incident showed
   internal-only testing can miss a real proxy-layer bug).
4. The one concretely known dependent feature is exercised end-to-end in an
   actual browser session where applicable (confirmed today: `uim-api` →
   `DomainService`'s "authorized domains" load, `/dashboard` no longer
   logging `[DomainService] non-JSON response`). The other 6 services don't
   have a confirmed-broken feature today (per the corrected finding above),
   so their verification is limited to steps 1–3 (health reachable end to
   end) unless a specific broken feature is identified during
   implementation.

   > **Correction (added during final whole-branch review, 2026-09-01):**
   > step 4's "confirmed" claim for `uim-api` was a false positive. The
   > `/api/v1/platform-domains` etc. nginx blocks route correctly to
   > `uim-api`, but `uim-api`'s own application code has no domain-management
   > routes at all (confirmed: no file matches "domain" anywhere under
   > `services/uim-api/src/routes/`) — its actual routes are mounted at
   > `/api/v1/uim/*`. The "no longer logging non-JSON response" signal only
   > showed that nginx now hands the request to `uim-api`'s Express app
   > instead of falling through to the SPA; the response is `uim-api`'s own
   > JSON 404, not a working "authorized domains" answer. `DomainService`'s
   > "authorized domains" feature is **still broken** after this deployment.
   > A real fix requires implementing those routes in `uim-api`'s own
   > codebase — a separate, follow-on application-level task, out of scope
   > for this infrastructure-only deployment. What this deployment does fix
   > is `uim-api`'s actual implemented surface (integrations, forms,
   > commands, projections, reservations, analytics, etc.), which is now
   > reachable at `/api/v1/uim/*` via a dedicated nginx block added during
   > this final review.

## Out of scope

- Kafka/Redis or any other new shared infrastructure.
- `comms-api`'s third-party provider credentials (Resend/Twilio/FCM).
- Testing the 6 non-`uim-api` services against a real, fully-provisioned
  business account to look for currently-unknown broken features — the
  user chose to deploy all 7 on architectural grounds rather than gate this
  on further investigation; if a real bug surfaces later for one of them,
  it's a separate, follow-on fix.
- Bundling the 7 services into a single Coolify compose stack (considered,
  rejected in favor of mirroring `amro-api`'s proven per-service pattern).
