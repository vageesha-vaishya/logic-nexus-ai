# Self-hosted Supabase — Phase 1 lean stack

Docker-compose config for a resource-capped, self-hosted Supabase-equivalent
stack (Postgres + Kong + Auth + REST + Storage + Realtime + Edge Runtime),
deployed through Coolify on the existing shared Hostinger VPS
(`72.61.249.111`).

This is **Phase 1** of the "Logic Nexus AI" migration off Supabase Cloud
(project `gzhxgoigflftharcmdqj`) to self-hosted infrastructure. Phase 1 only
stands up empty, isolated infrastructure with **zero production traffic** —
nothing in the live app points at this stack yet. Full background, the
memory/networking rationale, and everything explicitly out of scope (Studio,
Analytics/Logflare, imgproxy, MinIO/S3) is in the design spec:

**[docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md](../../docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md)**

This directory follows the same documentation convention as the existing
[`deploy/`](../README.md) bundle (a different, legacy systemd-based
deployment path for the frontend + markets-worker) — a compose/config
bundle plus a README, not a script-driven install like that one.

> **Revised 2026-08-22 (final whole-plan review):** the sections below
> originally described a pre-revision architecture (Postgres as a separate
> Coolify-native "Database" resource, no `db` service in this compose file,
> "not a live deployment yet"). That was never true of the final, executed
> plan and directly contradicted the Rollback section below it. Corrected to
> describe the actual, current architecture: 7 services (including `db`) in
> one compose file, live and deployed as Coolify application
> `i64jlyerora7ao9vkw5sweh3`.

## What's in this directory

| File | Purpose |
|---|---|
| `docker-compose.yml` | The 7-service stack: `db`, `kong`, `auth`, `rest`, `storage`, `realtime`, `functions` — Postgres runs as the `db` service in this same compose file, not a separate Coolify-native "Database" resource (that approach was tried and doesn't work; see the plan's Task 2 history). |
| `kong.yml` | Kong's DB-less declarative config — routes `/auth/v1`, `/rest/v1`, `/graphql/v1`, `/storage/v1`, `/realtime/v1`, `/functions/v1` to their backends. Adapted from upstream `supabase/supabase`, with Studio/postgres-meta/Analytics routes removed (out of scope). |
| `kong-entrypoint.sh` | Kong's custom entrypoint — substitutes `$SUPABASE_ANON_KEY`/`$SUPABASE_SERVICE_KEY` and builds the request-transformer Lua expressions into `kong.yml` before Kong starts. Copied verbatim from upstream; do not hand-edit the substitution logic. |
| `env.example` | Every env var the compose file references, with placeholders and comments. Copy to `.env` (not committed) and fill in real values. Named without a leading dot, like `deploy/env.example`, so the repo's pre-commit hook (which blocks any staged `.env*` file as a secrets-safety guard) doesn't reject it. |
| `volumes/db/*.sql` | Postgres init scripts, bind-mounted into `db`'s `/docker-entrypoint-initdb.d/` — required unconditionally by `supabase/postgres`'s own entrypoint (see "Operational gotcha" below for why these can't just be edited and redeployed). |

## Where this deploys

- **Coolify project/environment**: the existing Coolify instance on
  `72.61.249.111`, alongside the platform's other resources (frontend,
  8 microservices, and ~24 unrelated apps). This stack is *additive* — it
  does not touch, replace, or reconfigure any existing Coolify resource.
- **Postgres**: the `db` service in this same `docker-compose.yml` — not a
  separate Coolify-native "Database" resource. That approach (matching the
  precedent proven by the `aviation-ai-pro` app on this same box) was the
  original plan but was abandoned during Task 2's execution: `supabase/postgres`'s
  own entrypoint unconditionally requires bind-mounted init SQL under
  `/docker-entrypoint-initdb.d/` (see `volumes/db/`), which a bare Coolify
  Database resource has no way to supply. `POSTGRES_HOST`/`POSTGRES_PORT` in
  `.env` are unused by `db` itself; every other service instead points its
  DB connection URL at the literal internal hostname `db:5432`.
- **Network**: all 7 services join the shared, pre-existing `coolify` Docker
  network (`external: true` in `docker-compose.yml`) — the same network every
  other Coolify-managed resource on this VPS uses. This is required for
  container-name DNS resolution to work (confirmed via `docker inspect`
  against existing resources on this VPS); it is not an isolation boundary.
  Memory limits (below) are.
- **Gateway domain**: Kong is the only service exposed via Coolify's Traefik,
  live at `https://supabase.sosservices.online`. The other 6 services are
  reachable only from Kong and each other, over the internal `coolify`
  network — Kong's `docker-compose.yml` port binding is loopback-only (see
  below), so Traefik reaches it purely by container name over `coolify`, the
  same as every other service-to-service hop in this stack.

This compose file is deployed and live as Coolify application
`i64jlyerora7ao9vkw5sweh3` (see Rollback below for full detail) — this
directory is not merely repo-tracked config awaiting deployment.

## Memory limits

Every service has an explicit `mem_limit`, matching the design spec's Global
Constraints table, and a `memswap_limit` equal to its own `mem_limit` (fixed
2026-08-22 — the six non-`db` services previously had no `memswap_limit` at
all, which meant each could swap up to 2x its memory cap; only `db` had this
set from the start). Setting `memswap_limit` equal to `mem_limit` means zero
extra swap headroom for any service — a clean OOM-kill inside this stack's
own cgroup beats swap-thrashing that could degrade the whole VPS.

| Service | Cap (`mem_limit` = `memswap_limit`) | Image |
|---|---|---|
| `db` | 3g | `supabase/postgres:17.6.1.136` |
| `kong` | 512m | `kong/kong:3.9.3` |
| `auth` | 256m | `supabase/gotrue:v2.189.0` |
| `rest` | 256m | `postgrest/postgrest:v14.12` |
| `storage` | 512m | `supabase/storage-api:v1.60.4` |
| `realtime` | 768m | `supabase/realtime:v2.102.3` |
| `functions` | 768m | `supabase/edge-runtime:v1.74.0` |

Total: ~6.1GB across all 7 containers in this one compose file, matching the
design spec. This is the concrete mechanism protecting the other 24 apps on
the shared VPS from this stack: if this stack's usage exceeds its own
ceiling, the kernel OOM-kills a process *inside this stack's cgroup*, not an
unrelated app's process.

## Known Phase 1 limitations (not blockers)

- **Edge Functions**: `functions` mounts `./volumes/functions` (not created by
  this task) — this only proves the Edge Runtime container starts and its
  healthcheck TCP port responds. None of the platform's 155 real Edge
  Functions are deployed yet (a later phase).
- **Realtime**: a bare WebSocket handshake through Kong is not the same as
  full tenant-scoped Realtime functionality, which needs a tenant registered
  via Realtime's `/api/tenants` endpoint. Deferred to a later phase once real
  data/replication exists.
- **Storage**: local-disk backend only (`STORAGE_BACKEND=file`), no
  MinIO/S3 — matches the spec's "skip MinIO" decision. Revisit only if a
  later phase actually needs S3-compatible access.
- **Coolify application status**: shows permanently as `restarting:unknown`
  in the Coolify UI/API, not `running`/`healthy` — this is `functions`'s
  known, permanent, isolated crash-loop (real Edge Function content doesn't
  exist yet, a later phase) dragging down the whole Compose application's
  aggregate status, even though the other 6 containers are individually
  healthy. Don't waste time chasing this as a regression; check each
  container's own health status instead (`docker ps`), not the application's
  rolled-up status.

## Open items before cutover

- **Closed by the auth-email/SMTP repair (see Phase 5c below): self-hosted's
  own signup/email path now works end-to-end.** `SMTP_HOST`/`SMTP_USER`/
  `SMTP_PASS` are populated (Resend) via Coolify's env store, the
  `MAILER_URLPATHS_*` corruption is fixed, `SITE_URL` points at the app
  domain, and a real password-reset email was delivered with a correct link.
  Two residual notes, not blockers for cutover but worth knowing: (1) the
  delivered email landed in the recipient's spam folder on both stacks. The
  authentication side is not the cause — DKIM is published, SPF is valid, and
  a DMARC record exists with relaxed alignment — so this is not an
  auth-config defect. The primary driver is shared by both stacks: a
  306-character unbranded template (one `<h2>`, one sentence, one link, no
  footer, no `List-Unsubscribe`) sent from a domain whose only prior traffic
  to this recipient was monitoring alerts, with DMARC still at `p=none`. A
  production-specific factor — its link domain
  (`gzhxgoigflftharcmdqj.supabase.co`) differing from its sender domain
  (`sosservices.online`), unlike self-hosted where both are on
  `sosservices.online` — is real but secondary: self-hosted's aligned sender
  lands in spam too, which rules out domain mismatch as the *primary* driver.
  Tracked as its own follow-up (branded templates and reputation warming
  first; a custom auth domain as production-specific polish, demoted from
  top fix), deliberately out of this phase's scope. (2) production's
  localhost allow-list, added so local dev against production keeps working,
  **is** proven end-to-end: verified via the emailless
  `GET /auth/v1/verify?token=deliberately-invalid&type=recovery&redirect_to=<target>`
  probe (reads the decision straight off the `Location:` header — no email
  sent, no token consumed), confirmed in both directions — the allow-listed
  `http://localhost:8081/auth` is honoured, and the unlisted
  `https://evil.example/steal` is rejected and falls back to `site_url` (the
  negative control that rules out an open redirect). See Phase 5c below.
- **The JWT secret's actual equality with production has never been
  independently verified.** Every check run so far — the `db` GUC's
  length (88 chars), token issuance/validation working end-to-end, the
  standard health-check curls — would look identical whether the secret
  supplied for this migration is really production's, or merely a
  wrong-but-internally-consistent 88-character string typed in error; none
  of those checks compare against a known-good production-signed artifact.
  **Practical importance of this item dropped after Phase 5b established that
  production now issues ES256-signed access tokens, not HS256** — so no
  currently-issued production token can serve as the HS256-signature artifact
  this bullet originally called for; any production access token obtainable
  today is signed with an algorithm this HS256 secret was never meant to
  verify. If this still needs closing, the artifact has to be an **old**
  production-issued token that predates production's move to ES256 (if one
  still exists and hasn't aged out of any retention window), or some other
  production-side record of the actual HS256 secret value — not a freshly
  requested token. The check itself is unchanged: verify HS256 signature
  validity of whichever artifact is actually available (expired is fine for a
  token — signature validity is independent of expiry) against self-hosted's
  secret, e.g. via the self-hosted `db` container's `pgjwt` `verify()`
  function, or an offline check. Still open, but now lower-priority than the
  JWKS-staleness risk called out in the next bullet and the Phase 6 cutover
  checklist below.
- **Closed by Phase 5b: production ES256 access tokens are now accepted by
  `auth`/`rest`.** See the Phase 5b section below for the full mechanism.
  **"Closed" here means the ES256 signature-verification mechanism is
  implemented and empirically confirmed — not that this item needs no further
  attention before cutover.** The key material is a static snapshot of
  production's JWKS taken at Phase 5b's implementation time; if production
  rotates its ES256 signing keys before the real cutover, verification breaks
  silently — no error, no log, no failing health check. This is why the
  Phase 6 cutover checklist below includes a mandatory JWKS re-check plus a
  post-redeploy assertion that `GOTRUE_JWT_KEYS` is actually present in the
  running `auth` container; do not treat this bullet as done without also
  completing those two checklist items immediately before cutover.
  Still open, unchanged by Phase 5b: `storage` and `realtime`'s own
  independent JWT verification (`AUTH_JWT_SECRET`/`API_JWT_SECRET`, both
  still the legacy HS256 secret) was not investigated by Phase 5b and very
  likely still rejects production-issued tokens the same way `rest` did
  before this phase. And the `functions` router's own JWT verification
  (`supabase/functions/main/index.ts`, hardcoded HMAC against `JWT_SECRET`,
  no algorithm branching, gating all 109 deployed edge functions) is
  **also unaddressed and is the largest of the three gaps** — it is this
  project's own code, not a third-party service's config, so closing it is a
  genuine code change, not an env-var change, and needs its own scoped piece
  of work.
- **Deploy-branch structural compose drift beyond scalar env vars is still
  unaddressed.** `deploy/supabase-selfhost-phase1` (the branch Coolify
  actually deploys from) and `main` had already diverged structurally by the
  time this was investigated. The Phase 5a section above found that scalar
  env-var drift between the two branches is *not* a live risk (Coolify
  injects its full env-var store into every container regardless of a
  service's `environment:` block), but structural drift — different image
  tags, added/removed services, changed volumes, ports, or healthchecks —
  only takes effect from whichever branch is actually checked out at
  redeploy time, and was flagged there as still worth keeping in sync
  deliberately. See the "Branch drift, corrected" paragraph under Phase 5a
  for the full analysis; it is cross-referenced here rather than repeated.

## Validating this compose file

```bash
docker compose -f deploy/selfhosted-supabase/docker-compose.yml config --quiet
```

Exits 0 with no output when the YAML/schema is valid. This does **not**
start any containers or require the Postgres resource to exist yet — it's a
syntax/schema check only.

## Operational gotcha: bind-mounted config files do not refresh from git on redeploy

**Read this before editing `kong.yml` or any of the `volumes/db/*.sql` init
scripts.** Coolify resolves this compose file's file-based bind mounts
(`kong.yml`, `kong-entrypoint.sh`, and the `volumes/db/*.sql` scripts) to a
**stable, per-application host path**
(`/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/...`) that persists
across redeploys — by design, so named volumes survive. But Coolify does
**not** re-sync an individual bind-mounted *file's content* from the git
checkout into that path on a later deploy; it only reads the repo for these
files the very first time a path is created. Editing one of these files in
the repo, committing, pushing, and redeploying updates the compose
definition and any image references, but the actual on-disk file the
container mounts stays pinned to whatever content was last manually placed
there.

This is confirmed **twice**, independently, in this Phase 1 rollout:
- Task 3's initial deploy: Coolify pre-created all 9 file-based mount paths
  as **empty directories** (before the git checkout was ever read), which
  had to be `rmdir`'d and manually `scp`'d with real file content.
- Task 5's Realtime routing fix: `kong.yml` was corrected in the repo,
  committed, pushed, and the app was redeployed — but the *live* bind-mounted
  `kong.yml` on the VPS still served the old, pre-fix content, because
  redeploy never re-synced that file. Only a manual re-seed fixed it.

**If you edit `kong.yml` or any `volumes/db/*.sql` file in this repo, a
normal Coolify redeploy is not sufficient by itself.** You must also:

1. Push the change and redeploy the Coolify application as usual (updates
   the compose definition/images).
2. Manually copy the corrected file to its live host path, e.g.:
   ```bash
   scp deploy/selfhosted-supabase/kong.yml \
     hostinger-vps:/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/kong.yml
   ```
   (adjust the relative path under `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/`
   to match whichever bind-mounted file you changed).
3. Restart the affected container(s) so they pick up the freshly-seeded file
   — e.g. `ssh hostinger-vps "docker restart kong-i64jlyerora7ao9vkw5sweh3-<id>"`.
   A full Coolify redeploy alone will **not** pick up the new file content;
   only restarting the container against the re-seeded host path does.

## Operational gotcha: environment variables — the flat `.env` on disk is a decoy

**Read this before adding or changing any env var for this app.** There is a
flat file at `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env` on
the VPS that looks like the obvious place to add a new secret — it already
holds `JWT_SECRET`, `POSTGRES_PASSWORD`, etc. **It is not what Coolify
actually deploys from.** Confirmed via an A/B test during Phase 4 Batch 2:
editing that file and triggering a redeploy did **not** change the running
container's environment at all; the new vars simply never appeared. The
real mechanism is Coolify's own database-backed env-var store, managed via
its API (or the dashboard's Environment Variables tab) — `docker-compose.yml`'s
`${VAR:-}` interpolations are resolved from *that* store at deploy time, not
from the flat file.

**To add or change an env var this app's compose file references:**
```bash
curl -X POST "http://72.61.249.111:8000/api/v1/applications/i64jlyerora7ao9vkw5sweh3/envs" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"key": "YOUR_VAR", "value": "the value"}'
```
(payload must be exactly `{key, value}` — Coolify's API rejects an
`is_build_time` field with a 422). Then trigger a redeploy (`POST
.../applications/i64jlyerora7ao9vkw5sweh3/start`) for the new container to
pick it up. The flat `.env` file is left in place (now with a warning
comment prepended) purely because something already relies on the file
existing at that path — do not treat its contents as authoritative for
anything live.

**Reconciling this with vars that also get hand-edited via the flat `.env`
elsewhere in this README (e.g. Phase 5b's `GOTRUE_JWT_KEYS`/`JWT_JWKS`).**
Both statements in this section are true in their own context: a normal
Coolify redeploy reads only Coolify's DB-backed store (above), while the
manual single-service recreate pattern used elsewhere in this README (e.g.
Phase 5a's `docker compose --env-file .env up -d <service>`) reads the flat
`.env` file directly, instead. Any var maintained via that manual pattern —
`GOTRUE_JWT_KEYS`/`JWT_JWKS` included — therefore has **two** sources of
truth that must be kept in sync by hand: update Coolify's store via the API
above, **and** apply the identical value to the on-disk `.env`, then verify
the two actually agree (e.g. compare byte lengths of the value in both
places) before recreating anything. Patching Coolify's store alone and
skipping `.env` leaves a future manual recreate silently reverting that
service to the stale value — with no error signaling it happened. **Before
appending anything to `.env`, always confirm the file currently ends in a
newline** (e.g. `tail -c1 .env | xxd` on the VPS copy) — appending onto a
file whose last line lacks a trailing `\n` concatenates the new `KEY=value`
directly onto the previous line, corrupting both. This exact failure
recurred live during Phase 5b (see that section below for the incident);
check it every time this file is edited, don't assume it still ends cleanly.

## Phase 5a: GoTrue upgraded to v2.195.0

Self-hosted `auth` (GoTrue) is now `supabase/gotrue:v2.195.0`, matching
production. This closed the schema gap identified during the Phase 2
handoff: `auth.custom_oauth_providers.custom_claims_allowlist` did not exist
self-hosted (`auth.schema_migrations` was at `20260302000000`, 239 `auth`
columns) but did exist in production. After this upgrade both sides converge
exactly: migration `20260625000000`, 240 `auth` columns,
`custom_claims_allowlist` present on both. See
[docs/superpowers/plans/2026-08-30-supabase-selfhost-phase5a-gotrue-upgrade.md](../../docs/superpowers/plans/2026-08-30-supabase-selfhost-phase5a-gotrue-upgrade.md)
and its design spec's §3 for the full background.

**Kong gotcha when verifying GoTrue's version — don't use the public
health route:** a public `curl https://supabase.sosservices.online/auth/v1/health`
does **not** return GoTrue's version JSON; it returns Kong's
`{"message":"No API key found in request"}`, because Kong's `key-auth`
plugin applies to that route (per `kong.yml`) and rejects the request before
it ever reaches `auth`. Don't misdiagnose that response as GoTrue being
down or misconfigured. To actually check GoTrue's version, bypass Kong
entirely and hit it in-container: `docker exec <auth-container> curl -s
http://localhost:9999/health`.

**Operational finding, from this sub-project's design-time audit (not this
upgrade's execution):** the design spec's fourth audit pass established, before
any implementation task ran, that the persistent
`/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/docker-compose.yaml` on
the VPS is **not** the file a real Coolify redeploy actually creates
containers from. A redeploy checks the compose file out fresh into an
ephemeral `/artifacts/<uuid>` directory each time, uses that to (re)create
the **entire 7-container stack together**. This is an inference from two
pieces of evidence gathered at design time — `docker inspect` creation-time
labels plus all 7 containers sharing identical uptime — not from directly
observing a redeploy happen live; no redeploy was executed during this
sub-project. Task 2's execution relied on this design-time finding rather
than re-deriving it. The persistent on-disk copy above is
only authoritative when you run `docker compose` directly against it
yourself — which is exactly what this task did to avoid a full-stack
recreate for a single-service change.

**This hand-edit is only durable if the same change also lands on
`deploy/supabase-selfhost-phase1`** (as Task 1 of this sub-project did for
this image-tag bump — see the paragraph below the code block). Editing only
the persistent on-disk file gets the running container upgraded now, but the
next real Coolify redeploy re-checks-out the compose file fresh from that
branch and would silently revert the hand-edit if the branch itself hadn't
also been updated.

```bash
# Edit the one image line on the persistent on-disk file, then:
cd /data/coolify/applications/i64jlyerora7ao9vkw5sweh3
docker compose -p i64jlyerora7ao9vkw5sweh3 --env-file .env -f docker-compose.yaml pull <service>
docker compose -p i64jlyerora7ao9vkw5sweh3 --env-file .env -f docker-compose.yaml up -d <service>
```

Matching the existing `-p i64jlyerora7ao9vkw5sweh3` project name is what lets
Compose recognize the other 6 running containers as already part of the
project with unchanged config, so only the named service(s) get recreated.

**This contradicts the "decoy" gotcha immediately above it — read both
together.** `--env-file .env` resolves this compose file's `${VAR}`/`${VAR:-}`
placeholders directly from the same flat, non-authoritative `.env` file the
section above says not to trust for anything live (Coolify's own deploy
mechanism resolves those placeholders from its DB-backed store instead, not
from this file). Using this manual pattern is only safe when `.env`'s current
values for whatever vars the target service's `environment:` block references
are actually known to be current — don't assume that; pair it with a live
equivalence check against Coolify's authoritative store (see below) rather
than trusting the file blindly. With that precondition made explicit: for a
single-service image bump like this one, this pattern is preferable to
triggering Coolify's `/start` redeploy endpoint, which would recreate all 7
containers together — it is not a context-free best practice for any future
single-service change.

**Live equivalence check, done as part of this fix wave (2026-08-31):** every
var the `auth` service's `environment:` block references
(`POSTGRES_PASSWORD`, `JWT_SECRET`, `API_EXTERNAL_URL`, `SITE_URL`, `SMTP_*`,
`MAILER_URLPATHS_*`, `DISABLE_SIGNUP`, `ADDITIONAL_REDIRECT_URLS`,
`ENABLE_*` flags, `JWT_EXPIRY`) was compared across the flat `.env` file used
by the `up -d auth` command above, the recreated container's actual resolved
environment (`docker inspect`), and the literal values Coolify itself had
already baked into the persisted on-disk `docker-compose.yaml` as of its last
deploy. All three agreed for every var checked — no drift from a stale
`.env` was found. (Coolify's `GET .../envs` API endpoint on this instance
returns only metadata — key names and flags, no `value` field — under the
token available for this check, so the comparison used the persisted
compose file's baked-in values as the proxy for Coolify's authoritative
state rather than a direct API value read; see the fix-wave report for
detail.) One pre-existing, unrelated anomaly was noticed while checking
(not introduced by this upgrade, not a drift/mismatch — see the fix-wave
report) and is flagged there for separate triage, not fixed here.

Also note: `deploy/supabase-selfhost-phase1` — the branch Coolify's
`git_branch` API field actually points to — needed this same
`supabase/gotrue:v2.189.0` → `v2.195.0` image-tag change applied as a
separate commit from `main`'s. The two branches had already diverged (see
the design spec's §3 and the Phase 1 branch-sync note further down this
README) so a change made only on `main` would not have reached what Coolify
deploys.

**Branch drift, corrected:** `deploy/supabase-selfhost-phase1` is still
significantly behind `main` (check
`git rev-list --count origin/deploy/supabase-selfhost-phase1..origin/main`
for the current count rather than trusting a specific figure here, per the
same caveat as the Rollback section below). This was flagged during final
review as a live risk to the `functions` service specifically — the theory
being that a future Coolify redeploy would leave `functions` unable to reach
`OPENAI_API_KEY`/`GOOGLE_API_KEY`/`VLLM_BASE_URL`/`VLLM_API_KEY`/
`VLLM_MODEL_NAME` because the phase1 branch's compose file doesn't declare
them in that service's `environment:` block. That specific mechanism does
**not** hold: `docker inspect` on the live `functions` container (created
from the phase1 branch's compose file, unchanged/untouched by this
sub-project) shows all five vars present with real values despite the
phase1 branch's `environment:` block never referencing them — direct,
live evidence that Coolify injects its full registered env-var store into
every container's runtime environment regardless of whether that service's
`environment:` block references a given key by name. A compose file's
explicit `environment:` entries matter for `${VAR:-default}` fallback
documentation, not for whether a Coolify-known scalar var reaches the
container. So scalar env-var drift between the two branches is not actually
a live risk. What genuinely would only take effect from whichever branch is
checked out at redeploy time — and so is still worth keeping in sync
deliberately rather than assuming it propagates — is *structural* compose
drift: different image tags, added/removed services, changed volumes,
ports, or healthchecks. Those come from the git-checked-out compose file
itself, unlike scalar env vars.

## Phase 5: Auth Data Migration & JWT Alignment

Phase 5 closed out the remaining Phase 2→5 handoff (see Phase 5a above for
the GoTrue version/schema half): migrated production's real 103
`auth.users` + 101 `auth.identities` rows into self-hosted, created the
`on_auth_user_created` trigger, and aligned self-hosted's JWT secret with
production's real one so a still-valid production access token keeps
validating against self-hosted immediately after a future cutover. Full
design rationale: `docs/superpowers/specs/2026-08-31-supabase-selfhost-phase5-auth-migration-design.md`;
implementation plan: `docs/superpowers/plans/2026-08-31-supabase-selfhost-phase5-auth-migration.md`.

**Data migration:** done via `pg_dump --data-only --inserts --rows-per-insert=1`
against production's true-direct host (`db.gzhxgoigflftharcmdqj.supabase.co:5432`
— **not** this repo's `DATABASE_URL`/`DIRECT_URL`, both pgbouncer-pooled
despite `DIRECT_URL`'s name and rejected outright by `pg_dump`), text-transformed
to add `ON CONFLICT (id) DO NOTHING`, applied via `psql` inside the
self-hosted `db` container. The trigger was created only *after* the bulk
migration completed — creating it first would have fired
`handle_new_user()` for every migrated row and collided with the
`public.profiles` rows Phase 2's replication had already brought over for
those same users (same primary key).

**Discovered along the way: self-hosted's own signup path is broken.**
`/auth/v1/signup` fails end-to-end — `SMTP_HOST` is an unfilled placeholder
(`REPLACE_WITH_SMTP_HOST`), a pre-existing gap unrelated to this migration.
Trigger and token-issuance verification during this phase used GoTrue's
Admin API (`POST /auth/v1/admin/users` with `email_confirm: true`, using
`SERVICE_ROLE_KEY`) instead of the public signup endpoint — a sound
substitute, since `on_auth_user_created` is a DB-level `AFTER INSERT`
trigger that fires regardless of which GoTrue code path produced the
`INSERT`. **This needs a real fix (real SMTP credentials) before self-hosted
takes actual user signups** — tracked as a follow-up, not fixed here.

**JWT secret alignment is two separate mechanisms, both required:**
1. Update `JWT_SECRET` in Coolify's env-var store and the on-disk `.env`,
   then recreate the containers that read it at runtime (`auth`, `rest`,
   `realtime`, `functions`). **Never recreate `db` for this** — its own copy
   of `JWT_SECRET` is consumed only by a one-time init script
   (`volumes/db/jwt.sql`) that doesn't rerun once `PGDATA` already exists;
   recreating `db` achieves nothing for this and needlessly restarts
   Postgres for all 6 dependent services.
2. Separately, run `ALTER DATABASE postgres SET "app.settings.jwt_secret"
   TO '<new-secret>';` directly against the live `db` container — this is
   what actually changes the GUC, takes effect for new sessions
   immediately, no recreate needed.

**Caveat: the named-services list above is not the actual blast radius.**
Every service declares `env_file: .env` — but **not** in this repo's own
`deploy/selfhosted-supabase/docker-compose.yml`, which has zero `env_file:`
lines (`grep -c env_file deploy/selfhosted-supabase/docker-compose.yml`
returns `0`). The `env_file: .env` declarations exist only in **Coolify's
own generated compose file on the VPS**,
`/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/docker-compose.yaml`
(note the `.yaml` extension, and the on-VPS-only path — there is no `.yaml`
file anywhere in this repo). Confirm live:
`ssh hostinger-vps "grep -c env_file /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/docker-compose.yaml"`
returns one hit per service, all 7. Running the equivalent `grep` against
this repo's checked-out file will correctly find nothing — that does **not**
mean the caveat below doesn't apply; it means you're looking at the wrong
compose file. Compose computes each service's config-hash
from the *entire* `.env` file's contents merged with that service's own
`environment:` block — not just the variables that service's own
`environment:` block happens to reference. This means ANY edit to `.env`
can make Compose decide to recreate ANY service, not only the ones named in
your `up -d` command. This is exactly what happened during this phase's
`JWT_SECRET`-only rotation: `docker compose up -d auth rest realtime
functions` also recreated `kong`, even though `kong`'s own `environment:`
block never references `${JWT_SECRET}` at all (per
`deploy/selfhosted-supabase/docker-compose.yml`, it interpolates `${ANON_KEY}`,
`${SERVICE_ROLE_KEY}`, `${SUPABASE_PUBLISHABLE_KEY:-}`, `${SUPABASE_SECRET_KEY:-}`,
`${ANON_KEY_ASYMMETRIC:-}`, and `${SERVICE_ROLE_KEY_ASYMMETRIC:-}` — `KONG_HTTP_PORT`
is actually referenced in kong's `ports:` block, not its `environment:` block).
It was confirmed
harmless here — `kong` is stateless, reloads its declarative config fresh
from a bind-mounted `kong.yml` on every start, and came back healthy within
seconds — but that is not something to assume will always be true. **Always
verify actual post-recreate container timestamps
(`docker ps --format '{{.Names}}\t{{.CreatedAt}}'`) against your intended
scope after any `.env` edit + `up -d`, rather than trusting the
named-services list you passed on the command line.**

**A third mechanism this phase's execution surfaced that the original plan
missed entirely:** `ANON_KEY` and `SERVICE_ROLE_KEY` are themselves
pre-generated JWTs, signed with self-hosted's *old* `JWT_SECRET` at Phase 1
bootstrap. Changing `JWT_SECRET` alone — without also regenerating these
two keys under the new secret — broke self-hosted's own REST API for
anon/service-role access immediately: `GET /rest/v1/...` with the old
`ANON_KEY` started returning `401 PGRST301 "No suitable key or wrong key
type"` the moment `auth`/`rest`/`realtime`/`functions` were recreated with
the new secret, confirmed live. The fix: regenerate both keys with the same
claims (`role`, `iss`, `iat`, `exp`) signed under the new secret, via the
self-hosted `db` container's `pgjwt` extension:
```sql
SELECT sign('{"role":"anon","iss":"supabase","iat":...,"exp":...}'::json, '<new-secret>', 'HS256');
```
**Caution for any future rotation:** this statement embeds the signing
secret directly in the SQL text, which risks the secret landing in Postgres
statement logs (`log_statement`) or an audit-logging extension's captured
statement text if either is active on the `db` container at the time. This
phase's fix-wave verified `log_statement = none`, `log_min_duration_statement
= -1`, and `pgaudit.log = none` on self-hosted `db` at check time (so no
statement-text capture was configured), and confirmed zero occurrences of
`sign(` in the container's own logs — but don't assume that configuration
holds for a future rotation without re-checking it first. Prefer passing the
secret as a bound parameter (e.g. `psql -v` or a driver-level parameterized
query) rather than interpolating it into literal SQL text, to remove the
risk entirely regardless of logging configuration.

**Known wrinkle:** this stack's `pgjwt` was installed with its bundled
`sign()`/`algorithm_sign()` functions hardcoded to call `public.hmac(...)`,
but `pgcrypto` (which provides `hmac()`) is installed into the `extensions`
schema here, not `public` — so `pgjwt`'s `sign()` fails with `function
public.hmac(text, text, text) does not exist` out of the box. Worked around
with a temporary bridge function
(`CREATE FUNCTION public.hmac(text,text,text) ... AS $$ SELECT
extensions.hmac($1,$2,$3) $$;`), dropped again immediately after generating
the two keys — not a permanent fixture, but worth knowing if this needs
doing again (e.g. Phase 5's next real cutover, or any future key rotation).
Once regenerated, both keys need the same treatment as `JWT_SECRET` above:
Coolify's env-var store, the on-disk `.env`, and a recreate — but this time
of `kong` and `storage` too (Kong's own `key-auth` plugin credential store
is these exact string values, compared literally against whatever `apikey`
header a client presents, not JWT-verified — it needs the new strings to
accept future requests using them).

**Coolify env-var API confirmed behavior (relevant beyond just this
phase):** every key gets two entries when first created — one
`is_preview: false` (what this app's live containers actually use) and one
`is_preview: true` (a preview-deployment shadow copy this app doesn't
otherwise use, since it runs no preview deployments). `POST
.../applications/{uuid}/envs` is for genuinely *new* keys (this project's
established pattern from Phase 4 Batch 2). For an *existing* key,
`PATCH .../applications/{uuid}/envs` with `{"key": ..., "value": ...}`
updates the production copy in place (same `uuid`, confirmed via a
disposable probe key during Phase 5's design pass — no duplicate created);
add `"is_preview": true` to the same body to reach the preview copy
instead. Using `POST` on a key that already exists was not tested and
should not be assumed safe.

**Production-security consequence of this phase (intended, not a defect —
but must be treated accordingly):** aligning self-hosted's `JWT_SECRET` with
production's real one means production's actual signing secret, plus the
two regenerated keys — `ANON_KEY` and `SERVICE_ROLE_KEY` (the latter an
RLS-bypassing credential, valid until ~2036 per its `exp` claim) — are now
production-valid credentials that live on this VPS: in Coolify's env-var
store, the on-disk `.env`, and the `db` container's
`app.settings.jwt_secret` GUC. This VPS is shared with 24 unrelated
production apps. From this phase forward, treat the VPS's env store, `.env`,
and `db` GUC as holding **production-secret-grade material**, not merely
self-hosted's own throwaway secrets — the operational caution that implies
(who can read `.env`/the Coolify store, what gets pasted into logs/tickets,
etc.) is materially higher than before this phase. See also the Rollback
section's note on what this means for tearing this stack down.

## Phase 5b: JWKS-based verification of production tokens

Phase 5 (above) aligned self-hosted's `JWT_SECRET` with production's real
HS256 secret, so self-hosted-issued tokens and production tokens signed with
that legacy secret both verify. But production had already moved on to
signing new access tokens with **ES256** (an asymmetric keypair, verified
via production's public JWKS endpoint), which GoTrue/PostgREST reject
outright at the algorithm gate — `403 bad_jwt: signing method ES256 is
invalid`, rejected before signature verification is even attempted. Phase 5b
closes that gap for `auth` and `rest` by teaching both services about
production's public verification keys, **without changing anything about
how self-hosted itself signs tokens.**

**What "closes that gap" means for `auth` specifically — signature
verification, not full authentication success.** GoTrue's
`requireAuthentication` → `maybeLoadUserOrSession` path looks up the token's
`session_id` claim against `auth.sessions` and returns `session_not_found` if
that row isn't there. Migrating `auth.sessions` is an explicit non-goal of
both Phase 5 and Phase 5b (only `auth.users`/`auth.identities` were migrated
— see the Phase 5 section above), so a *fresh, unexpired* production access
token would very likely still be rejected at `/auth/v1/user` — with
`session_not_found`, not `bad_jwt`. The useful asymmetry this surfaces:
PostgREST does **no** session lookup at all, so `/rest/v1` — the data plane
the app actually uses — is where a fresh production token genuinely works
end-to-end today. This is consistent with, and further evidenced by, the
expired-token check already run against `rest`: presenting production's
expired token to `/rest/v1/profiles?limit=1` returned `{"code":"PGRST303",
"message":"JWT expired"}` / HTTP 401 — PostgREST's **claims**-stage
rejection, reachable only after it already resolved production's ES256 key
and verified the signature (a signature failure would instead surface as
`PGRST301`/`JWSInvalidSignature`). None of this diminishes what this phase
closed — the ES256 signature/algorithm gate genuinely now passes for both
services — it just means "accepted by `auth`/`rest`" should not be read as
"a valid production token gets you a 200 from `/auth/v1/user`"; that
specific endpoint has its own, unrelated reason to still fail, unaffected by
anything Phase 5b did.

**Mechanism — one signing key, several verify-only keys:**
- `GOTRUE_JWT_KEYS` (a bare JSON array, on both the VPS `.env` and Coolify's
  env-var store) holds 3 entries: self-hosted's existing HS256 secret,
  re-expressed as an `oct` JWK with `kid: selfhosted-legacy-hs256` and
  `key_ops: ["sign"]` — the only entry with `sign` — followed by production's
  two ES256 public keys, copied verbatim from its JWKS endpoint, each with
  `key_ops: ["verify"]`.
- `JWT_JWKS` (a `{"keys": [...]}` object, same two locations) holds the same
  3 logical keys, but the `oct` entry there carries `key_ops: ["verify"]`
  instead of `["sign"]` — PostgREST has no separate signing role, so its copy
  of the legacy secret only ever needs to verify.
- **The signing key deliberately stayed HS256.** This is the whole reason
  `ANON_KEY`/`SERVICE_ROLE_KEY` needed no regeneration: both are themselves
  HS256-signed JWTs, and GoTrue/PostgREST's `ValidMethods` still includes
  HS256 precisely because the one designated *signing* key in
  `GOTRUE_JWT_KEYS` is still the `oct` secret. Anything that changed the
  signing key to ES256 would have forced regenerating both keys — a much
  larger, riskier change this design explicitly avoided (see Phase 5's own
  section above on why those keys are now production-secret-grade material).

**Never-blank hazard.** GoTrue's config decoder `json.Unmarshal`s
`GOTRUE_JWT_KEYS` with no guard for an empty string, and envconfig invokes
that decoder whenever the var is *set at all* — so a **present-but-empty**
value crash-loops `auth` (103 real users) identically to a malformed one.
Because of this, the variable was designed to go straight from **absent**
to its correct, fully-validated final value (validated offline in a separate
task before ever touching the live container) — never through an
intermediate blank state. The same asymmetry governs rollback: **delete the
variable, never blank it** — `DELETE
.../applications/{uuid}/envs/{uuid}` for both the production and preview
Coolify entries, plus `sed -i '/^GOTRUE_JWT_KEYS=/d'` on the VPS `.env` —
followed by re-running the `docker compose up -d auth rest` recreate and
confirming `auth` returns healthy.

**No compose-file change was needed.** Every service declares `env_file:
.env` — but, exactly as the Phase 5 section above already found for
`JWT_SECRET`, only in Coolify's own **generated** compose file on the VPS,
`/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/docker-compose.yaml`
(note the `.yaml` extension). This repo's own
`deploy/selfhosted-supabase/docker-compose.yml` has zero `env_file:` lines
(`grep -c env_file deploy/selfhosted-supabase/docker-compose.yml` returns
`0`, on both `main` and `deploy/supabase-selfhost-phase1`) — there is no
`.yaml` file anywhere in this repo. Coolify injects its *entire* env-var
store into every container regardless of that service's own `environment:`
block (the same finding Phase 5a made for scalar env vars — confirmed here
to also hold for this multi-line JSON blob). Registering
`GOTRUE_JWT_KEYS`/`JWT_JWKS` in Coolify's store and the on-disk `.env`, then
recreating just `auth` and `rest`, was sufficient; `docker-compose.yaml`
itself was untouched.

**This is a behavior, not a guaranteed contract.** The `env_file: .env`
declaration that gets `GOTRUE_JWT_KEYS` into the `auth` container at all
lives only in a file under no version control, generated by Coolify's own
(undocumented, to this project) compose-generation logic — not in anything
this repo tracks or this project controls. If Coolify's generation ever
changes, `GOTRUE_JWT_KEYS` silently stops reaching the `auth` container:
GoTrue falls back to `GOTRUE_JWT_SECRET`, production ES256 tokens stop
verifying, and there is no crash, no log, and no failing health check to
signal it. This is exactly why the Phase 6 cutover checklist below includes
a post-redeploy assertion that the var is actually present in the running
container's resolved environment.

**Operational gotcha, confirmed to actually recur:** appending a new
`KEY=value` line to the VPS `.env` with a bare `>>` is only safe if the
file's existing last line already ends in a newline. It did not, the first
time this was attempted live: `HOST=0.0.0.0` (the file's prior last line)
had no trailing `\n`, so appending `GOTRUE_JWT_KEYS=...` concatenated
directly onto it — corrupting `HOST`'s value and leaving `GOTRUE_JWT_KEYS`
unparseable as its own variable (this is the identical failure mode Phase 4
Batch 2 hit, which is why the delete-then-append `sed` pattern exists at
all; the delete guarded the *re-run*, but the concatenation still happened
on the line before it). Caught by checking `tail -3 .env` after the append
rather than trusting the write silently succeeded; fixed by restoring
`HOST=0.0.0.0`, deleting both new lines, confirming the file ends with `\n`,
and re-appending. **Always verify the file's last line ends in a newline
before appending to it, or re-verify with `tail`/`wc -c` immediately after
any append to this file.**

**Verifying a running container's actual resolved value, when the image has
no shell.** `postgrest/postgrest:v14.12` ships no `sh`, `env`, `printenv`, or
`cat` — `docker exec ... printenv VAR` simply fails with "executable file
not found." `docker inspect <container> --format '{{json .Config.Env}}'`
(run from the host, no exec into the container needed) returns the full
resolved environment as a JSON array and works regardless of what binaries
the image ships.

**The JWKS is a static snapshot, not a live refresh.** This phase copied
production's public keys once, at implementation time. If production
rotates its signing keys before the real cutover, self-hosted's copy goes
stale silently — there is no mechanism here that re-fetches
`https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/.well-known/jwks.json`
automatically. **Re-check production's JWKS kids against this stack's
`GOTRUE_JWT_KEYS`/`JWT_JWKS` manually, immediately before the real cutover**,
and redo this phase's registration steps if they've diverged. This re-check
is now also a standing item on the Phase 6 cutover checklist below — see
that section rather than relying on this narrative alone being remembered.

**Undocumented side effect: self-hosted's own public JWKS endpoint now
advertises production's public keys.**
`https://supabase.sosservices.online/auth/v1/.well-known/jwks.json` is
reachable without authentication (`kong.yml` routes it through the `cors`
plugin only, no `key-auth`) and previously returned `{"keys":[]}`; it now
returns production's two ES256 **public** keys under self-hosted's own
domain and issuer. Nothing secret leaks — GoTrue's `internal/api/jwks.go`
explicitly skips symmetric keys before serving this endpoint (`if
key.PublicKey == nil || key.PublicKey.KeyType() == jwa.OctetSeq { continue
}`, commented "don't expose hmac jwk in endpoint"), so the `oct` signing key
is correctly omitted — confirmed to hold here. But a client doing standard
JWKS discovery against self-hosted is now told this issuer signs with ES256
keys it never actually uses for signing, and has no way to discover the key
it does sign with from this endpoint alone.

**What this phase did not touch (see "Open items before cutover" above):**
`storage` and `realtime`'s own independent JWT verification, and the
`functions` router's hardcoded-HMAC verification for all 109 deployed edge
functions. A production-issued token presented directly to those endpoints
will very likely still be rejected after this phase.

## Phase 5c: Auth email/SMTP configuration repaired (both stacks)

Both self-hosted and production auth email were broken in different ways —
self-hosted had no SMTP at all (unfilled `REPLACE_WITH_SMTP_*` placeholders),
production had a working-but-crippled built-in mailer capped at
`rate_limit_email_sent=2`/hour project-wide, and self-hosted additionally had
its `MAILER_URLPATHS_*` values corrupted. This phase fixed both stacks to
send real mail via Resend and repaired the link/redirect defects, then
proved delivery with real password-reset emails to a real inbox.

**Both stacks now send via Resend from the same identity.** `smtp_host` /
`SMTP_HOST` = `smtp.resend.com`, port `465`, user `resend`, from
`noreply@sosservices.online`, sender name `Logic Nexus AI`. Self-hosted's
credentials live in Coolify's env store and the VPS `.env`; production's live
in Supabase Cloud's Auth config via the Management API
(`PATCH /v1/projects/{ref}/config/auth`) — neither is a file in this repo.

**The `MAILER_URLPATHS_*` corruption, its cause, and the rule that prevents
recurrence.** Self-hosted's `GOTRUE_MAILER_URLPATHS_CONFIRMATION` (and the
sibling `_RECOVERY`/`_INVITE`/`_EMAIL_CHANGE` vars) held
`C:/Users/Vimal/AppData/Local/Programs/Git/auth/v1/verify` instead of the
correct bare `/auth/v1/verify`. Root cause: this is MSYS2/Git-Bash's
automatic POSIX-path translation on Windows — Git-Bash's runtime rewrites
any value that *looks like* a POSIX absolute path (starts with `/`) into a
native Windows path rooted at the Git-Bash install directory, whenever that
value crosses through a shell/CLI argument or certain env-var tooling
invoked from Git Bash. A bare `/auth/v1/verify` typed or piped through such a
path became `C:/Users/Vimal/AppData/Local/Programs/Git` + `/auth/v1/verify`.
**The rule that prevents recurrence: never pass a leading-slash value as a
bare shell/CLI argument on this Windows+Git-Bash host.** Stage it to a file
(or keep it inside a script/heredoc/JSON body constructed in-process) and
have the consuming step read the file/script — never let MSYS's argv layer
see the raw string. This is exactly the method Task 1's `.env` rewrite and
Task 2's Management-API `PATCH` body both used: values were built as Python
dicts/JSON and written to files, never interpolated into a bare command
line.

**Why `SITE_URL` (`site_url` in the Management API) must be the *app*
domain, not the API/auth domain or a placeholder.** GoTrue uses `SITE_URL`
as the default redirect target after a user follows an auth email's action
link (verify/reset/invite/etc.) whenever the request that generated the
email did not supply an explicit, allow-listed `redirect_to`. Before this
phase, production's `site_url` was still the unchanged default
`http://localhost:3000` — every real user's password-reset link therefore
redirected their browser to `localhost` after completing the reset, a
deployment nobody but a developer's own machine could ever reach. Setting
`site_url` to the actual frontend, `https://app.sosservices.online`, makes
GoTrue's default same-origin redirect land on the real application for the
common case (no explicit `redirect_to` supplied).

**Production's allow-list intentionally carries localhost, self-hosted's
does not.** `uri_allow_list` on production is
`http://localhost:8081/**,http://localhost:4173/**`, so a developer running
the frontend locally against production's live auth/database can still
complete an auth flow with an explicit `redirectTo` back to their local dev
server, rather than always being bounced to the production app's
`site_url`. Self-hosted's own allow-list is deliberately left empty — nobody
develops against self-hosted the way they develop against production, and
its `SITE_URL` already points at itself.

**Resolved — the localhost allow-list is proven end-to-end.** The
verification first attempted was `POST /auth/v1/recover` with
`{"email":"...","options":{"redirectTo":"http://localhost:8081/auth"}}` in
the JSON body (per the plan's own script). The delivered email's
`redirect_to` came back rewritten to `https://app.sosservices.online`, i.e.
apparently *not* the localhost target. That result was inconclusive, not a
failure: reading the real `@supabase/auth-js` client source in this repo
(`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js` and
`lib/fetch.js`) shows the actual SDK sends `redirectTo` as the
**query-string parameter** `redirect_to` appended to the request URL — never
as a nested `options.redirectTo` JSON body field. GoTrue's
`utilities.GetReferrer` → `getRedirectTo` resolves the redirect target from,
in order: the query parameter, then post data, then the `Referer` header,
then `SiteURL` — the original probe supplied none of the first three, so it
fell straight through to `SiteURL` regardless of whether the allow-list
itself works.

**Re-tested with the corrected, emailless shape** — `/auth/v1/verify` with a
deliberately invalid token funnels through the same
`GetReferrer`/`getRedirectTo`/`isRedirectURLValid` path as `/recover` and
302s to the result immediately, so the decision is readable straight off the
`Location:` header, with no email sent and no token consumed:
```bash
curl -s -o /dev/null -D - "https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/verify?token=deliberately-invalid&type=recovery&redirect_to=http://localhost:8081/auth" -H "apikey: $SUPABASE_ANON_KEY" | grep -i '^location:'
curl -s -o /dev/null -D - "https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/verify?token=deliberately-invalid&type=recovery&redirect_to=https://evil.example/steal" -H "apikey: $SUPABASE_ANON_KEY" | grep -i '^location:'
```
Both directions passed: the allow-listed `http://localhost:8081/auth` was
honoured (`Location: http://localhost:8081/auth#error=...`), and the
unlisted `https://evil.example/steal` was rejected, falling back to
`site_url` (`Location: https://app.sosservices.online#error=...`) — the
negative control that rules out an open redirect. **This is a resolved
item, not an open one** — no further re-test is needed before cutover.

**Two GoTrue allow-list behaviors worth knowing, confirmed during final
review (upstream GoTrue behavior, not a Supabase Cloud quirk, and not
specific to this project's config):**
1. **GoTrue honours loopback-IP redirects regardless of `uri_allow_list`.**
   `http://127.0.0.1:<any port>/x`, `http://127.0.0.2:<any port>/x`, and
   `http://[::1]:<any port>/x` are all accepted on production, and also on
   self-hosted — whose `uri_allow_list` is **empty** — while the *hostname*
   `localhost:9999` is rejected on both (falls back to `site_url`). An empty
   or narrow allow-list therefore does **not** mean "no loopback redirects
   accepted."
2. **`http://localhost:8081` without a trailing slash does not match the
   configured pattern `http://localhost:8081/**`** — the `**` needs the
   literal `/` immediately before it. Confirmed:
   `redirect_to=http://localhost:8081` (no trailing slash) falls back to
   `site_url`, while `redirect_to=http://localhost:8081/` is honoured.
   Harmless today since every real call site appends a path, but worth
   knowing before hand-testing with a bare origin.

**`rate_limit_email_sent` raised 2 → 30/hour on production — a deliberate
relaxation of a safety limit, not incidental.** A 2/hour project-wide cap is
unusable for the 103 real migrated users; 30/hour was chosen as the new
ceiling. Self-hosted's mailer rate limit was not part of this change (it has
no equivalent field exposed the same way and was not a stated goal).

## Phase 2: Logical Replication

Phase 2 adds ongoing data replication from Supabase Cloud (production) into
this stack's `db`, across all 795 tables spanning the 21 application schemas
(`public` plus 20 others — see the Phase 2 design spec's §1a for the full
include/exclude list). Full history, defects found, and how they were fixed
is in the Phase 2 SDD progress ledger
(`.superpowers/sdd/2026-08-22-supabase-selfhost-phase2/progress.md`); this
section is the operational summary for running/tearing this down later.

**Objects:**
- `phase2_public_migration` — the publication on **production**, covering all
  21 schemas via `FOR TABLES IN SCHEMA` (dynamic — future tables in those
  schemas auto-join without needing to alter the publication).
- `phase2_replicator` — the dedicated role on production the subscription
  connects as (SELECT-only + `REPLICATION` + `BYPASSRLS`, no superuser).
- `phase2_public_migration_sub` / `phase2_public_migration_slot` — the
  subscription and its replication slot, both on self-hosted `db`.

**⚠ WAL retention: do not leave this subscription disabled for extended
periods.** Production's `max_slot_wal_keep_size` is 4GB, and this database's
write volume is enough to exceed that within roughly a day of normal
traffic if the slot sits idle while disabled (a disabled subscription still
pins its slot's `restart_lsn` in place while production keeps generating
WAL). This happened **twice** during Phase 2 development, each requiring a
full subscription rebuild (drop + recreate with a fresh slot, plus a full
data re-sync). If you must disable it to debug something, keep the window
to a few hours at most, or explicitly plan for a rebuild afterward rather
than a resume. Check slot health any time you're unsure:
```sql
-- On production:
SELECT slot_name, active, wal_status,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots;
```
`wal_status = 'lost'` means the slot is permanently dead — see "Rebuilding
after slot invalidation" below.

**Checking replication lag/health:**
```sql
-- On self-hosted:
SELECT subname, pid, received_lsn, latest_end_time FROM pg_stat_subscription;
SELECT srsubstate, count(*) FROM pg_subscription_rel GROUP BY 1;  -- all 795 should show 'r'
```
```sql
-- On production, confirm the two pre-existing Realtime publications are
-- unaffected (the durable evidence this phase hasn't degraded Realtime —
-- its replication slots are ephemeral and expected to come and go):
SELECT pubname, count(*) AS tables FROM pg_publication_tables
WHERE pubname IN ('supabase_realtime','supabase_realtime_messages_publication')
GROUP BY 1 ORDER BY 1;
```

**Rebuilding after slot invalidation** (or after any defect that leaves the
subscription's initial-copy mechanism unreliable — see the ledger's account
of a connection-churn defect in Postgres's native tablesync process that
made this necessary once): rather than trying to resume, do a full,
manually-driven rebuild:
1. `ALTER SUBSCRIPTION phase2_public_migration_sub SET (slot_name = NONE); DROP SUBSCRIPTION phase2_public_migration_sub;` on self-hosted (the slot is already dead/gone on the publisher, so it must be disassociated first or `DROP SUBSCRIPTION` will try and fail to drop it there). Drop the dead slot on production separately if it still shows up in `pg_replication_slots`.
2. Re-sync every table's data directly using [`scripts/phase2-manual-resync.sh`](scripts/phase2-manual-resync.sh) — this sidesteps Postgres's native tablesync mechanism entirely if that's what caused the problem. It dumps and reloads one table at a time (explicit non-generated column list on both sides to avoid column-mismatch errors, `SET LOCAL session_replication_role = replica` during the load to bypass FK/trigger ordering without needing topological table ordering, `DELETE FROM` rather than `TRUNCATE` since `TRUNCATE` fails on any table referenced by an FK even from an empty table). Generate the table list and run it:
   ```bash
   ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-103525206238 psql -U supabase_admin -d postgres -tAc \"SELECT schemaname||'.'||tablename FROM pg_publication_tables WHERE pubname='phase2_public_migration' ORDER BY 1;\"" > tables.txt
   PHASE2_PROD_CONN="host=db.gzhxgoigflftharcmdqj.supabase.co port=5432 dbname=postgres user=phase2_replicator password=<PHASE2_REPLICATOR_PASSWORD from env> sslmode=require" \
   PHASE2_SSH_HOST=hostinger-vps \
   PHASE2_DB_CONTAINER=db-i64jlyerora7ao9vkw5sweh3-103525206238 \
   PHASE2_TABLE_LIST=tables.txt \
   bash deploy/selfhosted-supabase/scripts/phase2-manual-resync.sh
   ```
   The script exits non-zero if any table failed — check its log (`./phase2-manual-resync.log` by default) for `FAIL` lines and re-run with just the failed tables in a new list file. The two `NOT VALID` CHECK constraints below are the known failure modes this hit during Phase 2 development; there may be others for tables not yet exercised this way.
3. `CREATE SUBSCRIPTION phase2_public_migration_sub ... WITH (copy_data = false, create_slot = true, slot_name = 'phase2_public_migration_slot');` — `copy_data = false` marks all 795 tables `'r'` immediately with no per-table tablesync workers involved, and streaming (CDC only) starts fresh from the new slot's creation point.
4. Verify: all tables `'r'`, apply worker running with no errors, slot `active = true`, and a full row-count reconciliation against production (a single `UNION ALL` query summing counts across all 795 tables run on both sides and diffed) shows no mismatches beyond ordinary lag on high-write-frequency tables.

**Teardown — clean path (publisher reachable), verified 2026-08-27/28
against disposable test objects (`phase2_teardown_test_sub`/`_slot`/`_pub`),
never against the real subscription:**
```sql
-- On self-hosted:
DROP SUBSCRIPTION phase2_public_migration_sub;
```
This alone drops the slot on the publisher too — confirmed via
`SELECT slot_name FROM pg_replication_slots WHERE slot_name = 'phase2_public_migration_slot';`
returning zero rows immediately after.

**Teardown — manual-detach path (publisher unreachable, or you don't want
`DROP SUBSCRIPTION` to depend on network connectivity to production at
all):**
```sql
-- On self-hosted — this sequence never needs to reach the publisher:
ALTER SUBSCRIPTION phase2_public_migration_sub DISABLE;
ALTER SUBSCRIPTION phase2_public_migration_sub SET (slot_name = NONE);
DROP SUBSCRIPTION phase2_public_migration_sub;
```
This leaves the slot **orphaned** on production (confirmed via testing —
the slot still exists after this sequence completes). Clean it up manually
once the publisher is reachable again:
```sql
-- On production:
SELECT pg_drop_replication_slot('phase2_public_migration_slot');
```

## Phase 3: Storage Sync

Phase 3 replicates Supabase Storage — bucket configs, RLS policies, and
actual file bytes — from production to self-hosted. Unlike Phase 2, this is
not ongoing replication: it's a point-in-time copy, re-run manually
whenever needed (most importantly, once just before Phase 6's cutover to
pick up anything uploaded to production in the interim). Full history is in
the Phase 3 implementation plan
(`docs/superpowers/plans/2026-08-28-supabase-selfhost-phase3.md`) and design
spec (`docs/superpowers/specs/2026-08-28-supabase-selfhost-phase3-design.md`).
(The SDD task reports this work was originally tracked under,
`.superpowers/sdd/2026-08-28-supabase-selfhost-phase3/task-1-report.md` and
`task-2-report.md`, are gitignored and not available on a fresh clone — use
the plan/spec above instead.)

**What got replicated:**
- All 9 `storage.buckets` rows (config only — id, name, `public`,
  `file_size_limit`, `allowed_mime_types`, `avif_autodetection`), via
  `phase3-storage-buckets.sql`.
- All 31 RLS policies on `storage.objects` (not 26 — a plan-authoring
  snapshot had gone stale by execution time on this actively-written
  production database), captured point-in-time in
  `phase3-captured-storage-policies.sql` via the generator query in
  `phase3-generate-storage-policies.sql`.
- Actual file bytes for every real object in `storage.objects`, via
  [`scripts/phase3-storage-sync.sh`](scripts/phase3-storage-sync.sh).

**⚠ `service_role` JWTs are full-access on both sides.** Unlike Phase 2's
`phase2_replicator` (a purpose-built, least-privilege role), Phase 3's
sync script authenticates to both production's and self-hosted's Storage
APIs using each side's `service_role` JWT — which bypasses RLS entirely and
can read/write any bucket. There is no scoped-down credential option here;
the Storage HTTP API doesn't support one. Treat both keys with the same
care as any other full-access production secret.

**Re-running `phase3-storage-sync.sh` before cutover:**
```bash
PROD_KEY="<value from env's SUPABASE_SERVICE_ROLE_KEY>"
SELFHOSTED_KEY="$(ssh hostinger-vps "grep -E '^SERVICE_ROLE_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")"
PHASE3_PROD_SERVICE_ROLE_KEY="$PROD_KEY" \
PHASE3_SELFHOSTED_SERVICE_ROLE_KEY="$SELFHOSTED_KEY" \
PHASE3_PROD_PG_CONN="postgresql://postgres:<postgres role password, same one in env's DIRECT_URL>@db.gzhxgoigflftharcmdqj.supabase.co:5432/postgres?sslmode=require" \
PHASE3_SSH_HOST=hostinger-vps \
PHASE3_DB_CONTAINER=db-i64jlyerora7ao9vkw5sweh3-103525206238 \
bash deploy/selfhosted-supabase/scripts/phase3-storage-sync.sh
```
It's safe to re-run repeatedly — uploads use `x-upsert: true`, so an
already-synced object is simply overwritten, not duplicated or errored on.

**Note on `PHASE3_PROD_PG_CONN`:** despite its name, env's `DIRECT_URL` (and
`DATABASE_URL` / `SUPABASE_DB_URL`, which are identical) is actually a
**pooled** connection (`aws-1-ap-south-1.pooler.supabase.com:6543`,
`pgbouncer=true`) — `psql` rejects the `pgbouncer` query parameter outright,
and even stripped of it a pooled connection isn't what this script's
`docker exec psql` invocation needs. Use the true direct host instead
(`db.gzhxgoigflftharcmdqj.supabase.co:5432`, `user=postgres`, same password
as `DIRECT_URL`), the same host Phase 2 verified extensively — see
`PHASE2_PROD_CONN` in the "Rebuilding after slot invalidation" section
above for the equivalent libpq-keyword form.

**Known pre-existing production data issue — 2 orphaned objects:** as of
the last sync (2026-08-28), production's `storage.objects` has 11 rows in
`organization-assets` but only 9 have real backing files. The other 2
(`11111111-1111-1111-1111-111111111111/logo.png` and
`22222222-2222-2222-2222-222222222222/admin_upload.png`, both org-id
placeholders from March 2026 seed data) return `404 NoSuchKey` from
**production's own** Storage API — confirmed directly, not a sync-side
issue — meaning their `storage.objects` metadata rows were created without
ever going through a real upload. `phase3-storage-sync.sh` correctly skips
these (logged as `FAIL(download:400)`) since there's nothing to copy. This
is why self-hosted legitimately has 9 objects where production's `count(*)`
shows 11; both sides' total byte size (155 kB) and per-object checksums
match exactly for everything that actually has content. Don't be alarmed by
this specific 11-vs-9 count gap on future re-runs; do investigate if the
gap changes shape (different objects failing, or a size mismatch).

**Known limitations of the API-based sync — `owner`/`owner_id`/`created_at`
are not preserved:** `phase3-storage-sync.sh` uploads through the Storage
HTTP API, so every synced object lands on self-hosted with `owner` and
`owner_id` set to whichever credential performed the upload (here,
`service_role`, so both come out null/different from production's original
values) rather than production's original uploader, and `created_at` set to
the upload time rather than production's original creation time. The two
alternatives that would preserve these — direct disk manipulation of the
storage backend, or manually rewriting `storage.objects` metadata rows
after upload — both carry worse trade-offs (reverse-engineering the
storage backend's undocumented on-disk layout, or a second write pass with
its own consistency risk) than the API approach's small, well-understood
gap; this is an accepted, inherent trade-off of that choice, not an
oversight.

As of 2026-08-28, production's `storage.objects` has 8 rows with a non-null
`owner` and 6 with a non-null `owner_id` (out of all 11 rows, including the
2 orphaned ones above — not just the 9 successfully-transferred real
objects), while self-hosted has 0 of either. Concretely, this means the RLS
policy `"Users can delete their own email attachments"` on
`storage.objects`, which depends on `auth.uid() = owner`, would misbehave
on self-hosted for any object relying on its original owner: today this is
zero-impact because the `email-attachments` bucket is empty in production,
but if an owner-scoped object exists there (or in any other bucket with a
similar owner-dependent policy) by the time of Phase 6's cutover, that
object's original owner would silently lose their ability to act on it
under self-hosted's RLS.

**Action for Phase 6's cutover checklist:** re-run the owner/owner_id check
above against production immediately before cutover to see whether any
owner-scoped object now exists in an affected bucket. If one does, decide
before relying on self-hosted for that bucket whether to accept the
ownership gap, manually patch the affected `storage.objects` rows on
self-hosted, or otherwise remediate — don't assume the zero-impact status
from 2026-08-28 still holds.

## Phase 4: Edge Functions

Phase 4 deploys the project's Supabase Edge Functions to self-hosted, in
secret-availability-ordered batches (functions needing a third-party API key
are deferred to a later batch until that secret is provisioned on the VPS).
Full history is in the Phase 4 Batch 1 implementation plan
(`docs/superpowers/plans/2026-08-28-supabase-selfhost-phase4-batch1.md`).
(The SDD task reports this work was tracked under,
`.superpowers/sdd/2026-08-28-supabase-selfhost-phase4-batch1/task-1-report.md`
and `task-2-report.md`, are gitignored and not available on a fresh clone —
use the plan above instead.)

**Architecture — one shared router, not one function per isolate:**
self-hosted's Edge Runtime (`supabase/edge-runtime`) is configured with
`--main-service` pointing at `supabase/functions/main/index.ts`. Every
request to `/functions/v1/<name>` arrives at this one router first, which:
1. Looks up `<name>` in `main/verify_jwt_map.ts`'s `VERIFY_JWT_MAP` and, if
   the map doesn't say `false`, verifies the request's bearer token's
   **signature and expiry** against `JWT_SECRET` itself (HS256, via Web
   Crypto's `crypto.subtle.verify` — no external dependency) — reconstructing
   production's actual per-function JWT-enforcement matrix (from
   `supabase/config.toml`'s `verify_jwt = false` entries), since self-hosted's
   Edge Runtime only exposes one global toggle, not a per-function one. This
   deliberately mirrors what production's own gateway (Kong) does for
   `verify_jwt = true`: signature/expiry only, no identity/claim check — both
   the anon key and the service_role key are validly-signed JWTs with no
   `sub` claim, and both must pass (real callers depend on it: the
   `markets_t1_ingest_crons` migrations call `verify_jwt=true`
   `markets-ingest-*` functions with the service-role key, and
   `invokeAnonymous()` in `src/lib/supabase-functions.ts` calls
   `verify_jwt=true` functions like `discover-email-settings` with the anon
   key). A function that needs a real authenticated end user (e.g.
   `admin-reset-password`) calls `_shared/auth.ts`'s `requireAuth()` itself,
   internally — the router's gate and a function's own `requireAuth()` call
   are independent, exactly as on production.
2. Dispatches to the target function's own module by temporarily shimming
   the global `Deno.serve` to capture the handler each function's own
   top-level `Deno.serve(...)` call (via `_shared/logger.ts`'s
   `serveWithLogger`, or directly) registers, then invokes that captured
   handler directly. This reuses every function's existing code completely
   unmodified. Captured handlers are cached by name after first use; a
   promise-chained lock serializes the shim-install/import/shim-restore
   critical section globally, so concurrent cold-start requests for
   different functions can't race each other's shim state.

**Static import map requirement (`function_importers.ts`) — read this
before adding a function to any future batch:** the router does NOT use a
computed-string dynamic import like `import(\`../${name}/index.ts\`)`. This
was tried and empirically fails against the real, self-hosted Rust Edge
Runtime: `--main-service` mode builds its executable module graph via
**static analysis** of the entrypoint's imports at boot time, materializing
only the files it can discover into an internal sandboxed compile directory.
A computed-string import is invisible to that analyzer, so the target file
is never materialized and the import throws `Module not found` at request
time for every function, regardless of whether it uses `serveWithLogger` or
raw `Deno.serve` (confirmed against all of Batch 1 during this phase's
implementation). A plain string-literal argument to `import()` **is**
discovered by the analyzer even when nested inside an object-literal value —
that's the mechanism `supabase/functions/main/function_importers.ts` relies
on: a generated `Record<string, () => Promise<any>>` with one literal
`() => import("../<name>/index.ts")` entry per deployed function, which the
router's `getHandler()` looks up instead of computing the path itself.
**This map is intentionally scoped to the currently-deployed batch only**
(Batch 1's 88 functions), unlike `verify_jwt_map.ts` (pure data, safe to
cover all 132 functions up front). Each entry here references a real file
path — an entry for a function not yet physically present on the bind-mount
risks a boot-time failure if the runtime's static analysis can't resolve it,
not just a request-time 404 like the old dynamic-import design. **To add
functions in a future batch:** append new literal entries (name and matching
`../<name>/index.ts` path) to `FUNCTION_IMPORTERS` in
`function_importers.ts` for every function that batch deploys, matching the
existing entries' exact form, before reseeding the bind-mount with those
functions' directories — do not deploy a function's directory without also
adding its importer entry, and don't add an importer entry for a function
whose directory isn't actually being deployed in that same reseed.

**Regenerating/extending `verify_jwt_map.ts`:** re-derive from
`supabase/config.toml`'s `verify_jwt = false` entries with:
```bash
python3 -c "
import re
with open('supabase/config.toml', encoding='utf-8') as f:
    content = f.read()
false_funcs = sorted(set(re.findall(r'\[functions\.([^\]]+)\]\s*\nverify_jwt = false', content)))
print(len(false_funcs))
for f in false_funcs: print(f.rstrip())
"
```
`config.toml` has Windows CRLF line endings — `f.rstrip()` above strips the
trailing `\r` that otherwise silently breaks name comparisons. Cross-check
the result against production's actual active function list before trusting
it wholesale; not everything in `config.toml` is production-active (e.g.
`comms-unsubscribe`/`comms-webhook-resend` are configured and exist locally
but aren't currently deployed anywhere).

**Bind-mount reseed procedure (this specific volume):** the live path,
confirmed empirically (this bind-mount was empty before Phase 4 and had
never been populated by an earlier phase), is
`/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions/` —
mounted read-only into the `functions` container
(`functions-i64jlyerora7ao9vkw5sweh3-103525190194`, Coolify's generated name
— NOT the literal `logic-nexus-functions` name an earlier plan draft
assumed) at `/home/deno/functions`. Reseed by staging locally-checked-out
files to a scratch dir on the VPS, then atomically swapping them in:
```bash
ssh hostinger-vps "mkdir -p /tmp/phase4-functions-staging"
scp -r supabase/functions/main supabase/functions/_shared supabase/functions/_types \
  supabase/functions/deno.json supabase/functions/import_map.json supabase/functions/types.d.ts \
  hostinger-vps:/tmp/phase4-functions-staging/
while read -r fn; do
  scp -r "supabase/functions/$fn" "hostinger-vps:/tmp/phase4-functions-staging/"
done < deploy/selfhosted-supabase/scripts/phase4-batch1-functions.txt   # or the current batch's list
ssh hostinger-vps "rm -rf /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions/* && \
  cp -r /tmp/phase4-functions-staging/* /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions/ && \
  rm -rf /tmp/phase4-functions-staging"
ssh hostinger-vps "docker restart functions-i64jlyerora7ao9vkw5sweh3-103525190194"
```
The container's healthcheck is a bare TCP port check (see
`docker-compose.yaml`), so `docker ps` reporting `healthy` only proves the
process is listening — it does **not** prove function dispatch works. Always
follow a restart with the four standard health-check curls below, plus a
router-correctness spot check (an unauthenticated request to a
`verify_jwt=false` function should return something other than the router's
own `{"error":"Function '<name>' not found or failed to load"}` 404 body).

**Batch status:**
- **Deployed — Batch 1** (this phase): 88 functions, listed in
  [`scripts/phase4-batch1-functions.txt`](scripts/phase4-batch1-functions.txt).
  All 88 confirmed reachable through the router (no function returned the
  router's 404 "not found or failed to load" body).
- **Deployed — Batch 2:** 21 LLM-provider-dependent functions, listed in
  [`scripts/phase4-batch2-functions.txt`](scripts/phase4-batch2-functions.txt)
  (`ai-advisor`, `ai-agent`, `ai-message-assistant`, `analyze-cargo-damage`,
  `analyze-email-threat`, `categorize-document`, `classify-email`,
  `ensemble-demand`, `extract-bol-fields`, `extract-invoice-items`,
  `generate-embedding`, `ingest-email`, `markets-enrich-news`,
  `markets-portfolio-brief`, `markets-portfolio-diagnostic`,
  `markets-research`, `nexus-copilot`, `portal-chatbot`,
  `process-franchise-import`, `smart-reply`, `suggest-transport-mode`). All
  21 confirmed dispatching through the router (none returned the router's
  404). `forecast-demand` and `route-optimization` remain deliberately
  excluded from every batch so far, pending their backing services.
  **Secrets (corrected 2026-08-28 — see below):** the `functions` service
  wires 5 env vars, not the 6 originally planned:
  `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `VLLM_BASE_URL`, `VLLM_API_KEY`,
  `VLLM_MODEL_NAME`, each defaulted to empty (`${VAR:-}`) so an unset one
  doesn't break compose validation. `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`,
  `UPSTASH_REDIS_REST_TOKEN`, and `UPSTASH_REDIS_REST_URL` are **deliberately
  not wired at all** (an earlier pass of this task added all 6 of the
  originally-planned vars including these 4; that was superseded on
  same-day review once each was checked against actual function source):
  - `OPENAI_API_KEY` — provisioned with a real value.
  - `GOOGLE_API_KEY` — provisioned with a real value.
  - `VLLM_BASE_URL` / `VLLM_API_KEY` / `VLLM_MODEL_NAME` — provisioned with
    real values pointing at this project's self-hosted vLLM rig. This is
    `_shared/llm-gateway.ts`'s `local-qwen` provider, used as the fallback
    when no tenant LLM config and no `ANTHROPIC_API_KEY` are set — verified
    live independently of this deployment (key authenticates against
    `/v1/models`, model id matches what's served, a real chat-completion
    round-trip succeeded).
  - `GEMINI_API_KEY` — not provisioned; `suggest-transport-mode` (its only
    caller) falls back to `GOOGLE_API_KEY` when this is absent (see that
    function's own source, `Deno.env.get('GEMINI_API_KEY') ||
    Deno.env.get('GOOGLE_API_KEY')`), which is provisioned above.
  - `ANTHROPIC_API_KEY` — not provisioned; superseded by the `VLLM_*`
    self-hosted fallback above per this project's direction to run LLM
    workloads against the self-hosted rig instead of a cloud Anthropic
    subscription. `_shared/llm-gateway.ts` falls back to `local-qwen` when
    `ANTHROPIC_API_KEY` is absent but `VLLM_BASE_URL`/`VLLM_API_KEY`/
    `VLLM_MODEL_NAME` are set, so `markets-enrich-news`,
    `markets-portfolio-brief`, `markets-portfolio-diagnostic`, and
    `markets-research` route to the vLLM rig instead of erroring.
  - `UPSTASH_REDIS_REST_TOKEN` / `UPSTASH_REDIS_REST_URL` — not provisioned;
    `_shared/rate-limit.ts` fails open by explicit design when these are
    unset (its own module header states this must never be changed to
    fail-closed), so rate limiting is simply inactive for this batch, not
    broken.

  **Critical operational finding (2026-08-28) — Coolify does not durably
  apply either env-var or `docker-compose.yml` changes made by hand,
  even though a normal redeploy *does* pick up compose-file changes:**
  a follow-up redeploy of `i64jlyerora7ao9vkw5sweh3` (triggered outside this
  task, most likely via the Coolify dashboard) silently reset **both**
  files this task edits at the paths this README's own bind-mount workflow
  above uses:
  - `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env` was
    regenerated from Coolify's own database-managed env-var list for this
    application (`GET /api/v1/applications/{uuid}/envs`) — any secret
    appended by hand via `ssh ... >> .env` (as an earlier pass of this task
    did for `OPENAI_API_KEY`/`GOOGLE_API_KEY`) is **wiped** the next time
    Coolify redeploys, because Coolify doesn't read from the file at all;
    it writes it, from vars it doesn't know about at all if they were only
    ever hand-appended.
  - `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/docker-compose.yaml`
    was reset to the exact HEAD of the `deploy/supabase-selfhost-phase1`
    git branch this application deploys from (confirmed via
    `GET /api/v1/applications/{uuid}` → `git_branch` +
    `git_commit_sha: "HEAD"` + `docker_compose_location`). A `scp`'d
    compose file (as an earlier pass of this task did) only lasts until
    the next real redeploy — it is **not** durable unless the same change
    also lands on that git branch, not just `main` (where all of this
    project's Phase 2–4 development happens, per this repo's established
    convention; the two branches otherwise agree on this file byte-for-byte
    except for exactly this task's own pending env-var lines).

  Batch 1 never hit this because it added no env vars and made no compose
  changes — only bind-mounted function files, which **do** persist across a
  real redeploy (confirmed still present after the surprise redeploy above:
  all 115 expected files, all 21 Batch 2 directories intact). Batch 2 is the
  first to need durable env vars, so this is the first time the gap surfaced.

  **Correct way to make secrets durably live, going forward:** provision
  each secret via Coolify's own env-var API/dashboard for this application
  (not by hand-editing the live `.env`), and land any `docker-compose.yml`
  change on the `deploy/supabase-selfhost-phase1` branch specifically (not
  only `main`) before relying on a redeploy to pick it up. Both of these are
  mutating actions against the live Coolify control plane and require
  explicit human sign-off in this project's operating model — see this
  batch's task-2-report.md for the exact commands attempted and where they
  were blocked.
- **Pending — later batches:** every function needing a third-party secret
  not yet provisioned on the self-hosted VPS (email/SMS/payment provider
  keys, etc.), to be grouped and deployed once each secret is available.
- **Permanently excluded** (not deployable under any batch — no reliable
  local source match): `feature-flags` (no local source exists in the
  repo), `migrate-flypal-directives` (superseded locally by
  `migrate-flypal-directives-v2`/`-v3`), and
  `flypal_configured_directives_id_match_with_code_form` (lowercase `code` —
  a legacy duplicate deployment; the correctly-cased
  `flypal_configured_directives_id_match_with_Code_form` has local source
  and is deployed in Batch 1).

**Note — this no longer affects the router's own gate, only functions that
call `requireAuth()` internally:** as of the Phase 4 Batch 1 final-review
fix pass, the router's own JWT check (see the Architecture section above)
verifies signature/expiry only, so both `ANON_KEY` and `SERVICE_ROLE_KEY`
pass it for any `verify_jwt=true` function, same as production. The
paragraph below is about `_shared/auth.ts`'s `requireAuth()` specifically —
still relevant for the handful of functions (e.g. `admin-reset-password`)
that call it themselves to require a real authenticated end user, on top of
(not instead of) the router's gate.

**Known gap — self-hosted `service_role` JWTs don't satisfy `requireAuth()`:**
a `service_role` JWT (from self-hosted's own `.env`) is rejected by
`_shared/auth.ts`'s `requireAuth()` with `"invalid claim: missing sub
claim"`, because `service_role` tokens carry no `sub` claim while
`requireAuth()`'s underlying `getUser`/`getClaims` check expects one (this
differs from what an earlier plan draft assumed). To exercise a function
that calls `requireAuth()` itself, obtain a real user session JWT
instead — self-hosted's GoTrue supports this via its own Auth API, e.g.
creating a throwaway user with the admin API and signing in:
```bash
curl -s -X POST "https://supabase.sosservices.online/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"<throwaway>@example.com","password":"<temp password>","email_confirm":true}'
curl -s -X POST "https://supabase.sosservices.online/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"<throwaway>@example.com","password":"<temp password>"}'
# use the response's access_token as the Authorization: Bearer value
```
(Self-hosted's anonymous sign-in provider is disabled, so `signInAnonymously`-
style flows return `anonymous_provider_disabled` — use the admin-create +
password-sign-in flow above instead.) Note also: this project's self-hosted
GoTrue admin `DELETE /auth/v1/admin/users/<id>` intermittently returns `504
request_timeout` even when the delete eventually succeeds — don't assume a
504 here means the delete failed; verify with a follow-up `GET` before
retrying.

**Leftover test user still on self-hosted `auth.users` (needs opportunistic
cleanup):** a throwaway user created while verifying this behavior during
Phase 4 batch 1 —
`phase4-batch1-verify-test@sosservices.online`
(id `02424458-e64b-4584-87ca-dd1d33f414c7`) — was never successfully deleted
(hit the `DELETE` 504 above) and, as of this task, is still present on
self-hosted's live `auth.users` table. It's inert (no associated app data)
but whoever next touches self-hosted auth should delete it opportunistically,
e.g.:
```bash
ssh hostinger-vps "docker exec db-i64jlyerora7ao9vkw5sweh3-103525206238 psql -U supabase_admin -d postgres -c \"DELETE FROM auth.users WHERE id = '02424458-e64b-4584-87ca-dd1d33f414c7';\""
```

**The four standard health-check curls** (run after every `functions`
container restart, or any other state-changing step on this shared VPS):
```bash
ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
```
Expected: all four `200`.

**Phase 6 cutover checklist (started here, not yet a full section):**
- **PostgREST schema exposure gap:** self-hosted's `rest` service only sets
  `PGRST_DB_SCHEMAS=public,graphql_public`
  (`deploy/selfhosted-supabase/env.example`), while production's PostgREST
  exposes 6 schemas, including `markets`, `platform`, `core`, and `comms`.
  This batch's 11 `markets-*` functions (see
  `scripts/phase4-batch1-functions.txt`) dispatch correctly through the
  router, but any of them that actually reads/writes the `markets` schema
  via PostgREST (as opposed to a direct `postgres://` connection) will fail
  once it does real work, since that schema isn't in `rest`'s exposed list.
  This is a real gap but was explicitly left out of Phase 4 Batch 1's scope
  (it's a Phase 1 `rest`-service config matter, not an edge-function code
  issue) — do not change the live `PGRST_DB_SCHEMAS` env var casually; widen
  it to match production's schema list (and restart the `rest` container)
  as part of Phase 6 cutover prep, then re-run the four standard
  health-check curls plus a spot check against one `markets-*` function that
  actually touches PostgREST.
- **Re-fetch production's JWKS and confirm the `kid`s still match (Phase
  5b):** re-fetch
  `https://gzhxgoigflftharcmdqj.supabase.co/auth/v1/.well-known/jwks.json`
  and confirm the `kid`s it returns still match what `GOTRUE_JWT_KEYS`/
  `JWT_JWKS` hold on this stack. Production rotating its ES256 signing keys
  before cutover silently breaks ES256 verification here — no error, no log,
  no health-check failure — so this needs a manual, deliberate re-check
  right before cutover, not an assumption that Phase 5b's one-time snapshot
  (see that section above) still holds.
- **Assert `GOTRUE_JWT_KEYS` is actually present in the running `auth`
  container after any redeploy (Phase 5b):**
  ```bash
  docker inspect <auth-container> --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -c '^GOTRUE_JWT_KEYS='
  ```
  should return `1`. This matters because the `env_file: .env` declaration
  that gets this var into the container at all lives only in Coolify's
  generated, non-version-controlled compose file on the VPS, not in anything
  this repo tracks (see the Phase 5b section above) — if Coolify's
  compose-generation logic ever changes, this var can silently stop reaching
  the container with no other symptom: GoTrue falls back to
  `GOTRUE_JWT_SECRET` and production ES256 tokens quietly stop verifying.
- **Assert `GOTRUE_SMTP_HOST`, `GOTRUE_SITE_URL`, and all four
  `GOTRUE_MAILER_URLPATHS_*` still hold their intended values after any full
  Coolify redeploy (Phase 5c):** Coolify's API on this instance cannot read
  back stored env *values* — the list endpoint returns only metadata (no
  `value`/`real_value`), a per-uuid `GET .../envs/{uuid}` 404s, and the
  application-show endpoint exposes no environment-variables array (all
  three confirmed during this phase). The live `auth` container and the VPS
  `.env` are proven correct today, but the Coolify *store's* actual contents
  were never independently verified — only inferred from 20/20 `PATCH`
  responses each returning a `uuid` and a re-`GET` showing exactly 2 entries
  per key. A targeted `docker compose up -d auth` (what this phase used)
  reads `.env` directly, but a **full** Coolify redeploy regenerates `.env`
  from the store — so if any stored value silently differs from what was
  intended, the whole email fix reverts with no error, no log, and no
  failing health check. Assert before trusting a post-redeploy `auth`
  container:
  ```bash
  docker inspect <auth-container> --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E '^GOTRUE_(SMTP_HOST|SITE_URL|MAILER_URLPATHS_(CONFIRMATION|RECOVERY|INVITE|EMAIL_CHANGE))='
  ```
  and confirm all six lines hold their intended values
  (`GOTRUE_SMTP_HOST=smtp.resend.com`,
  `GOTRUE_SITE_URL=https://app.sosservices.online`, all four
  `GOTRUE_MAILER_URLPATHS_*=/auth/v1/verify`) before trusting the redeploy.
- **Confirm `storage`, `realtime`, and `functions` still do not verify
  production ES256 tokens, and that this is still a deliberate deferral, not
  a forgotten gap (Phase 5b):** `storage`'s `AUTH_JWT_SECRET` and
  `realtime`'s `API_JWT_SECRET` both still resolve to the legacy HS256
  `JWT_SECRET` only (`docker-compose.yml` lines 215 and 267 respectively —
  neither reads `JWT_JWKS`/`GOTRUE_JWT_KEYS`), and the `functions` router
  (`supabase/functions/main/index.ts`) verifies with hardcoded HMAC against
  `JWT_SECRET` across all 109 deployed edge functions, with no ES256
  algorithm branching. All three were explicitly out of scope for Phase 5b
  (see that section above) and remain open going into cutover.
- **Localhost allow-list (Phase 5c): closed, not an open cutover item.**
  Verified end-to-end via the emailless
  `GET /auth/v1/verify?token=deliberately-invalid&type=recovery&redirect_to=<target>`
  probe (see Phase 5c above) in both directions —
  `http://localhost:8081/auth` honoured, `https://evil.example/steal`
  rejected and falling back to `site_url`. No further re-test is needed
  before cutover.
- **Capacitor native deep link is not in production's allow-list — a
  prerequisite for enabling `VITE_ENABLE_OAUTH`, not a defect of this
  phase:** `src/lib/auth/oauthSignIn.ts:101` defines `NATIVE_REDIRECT_URI =
  "com.sos.sthira://auth-callback"` for native (Capacitor) OAuth sign-in,
  registered in `android/app/src/main/AndroidManifest.xml`'s intent filter
  (the iOS platform has not been added to this repo yet — no `ios/`
  directory exists — but
  `docs/plans/2026-05-27-google-microsoft-auth-design.md` specifies the
  matching `Info.plist` `CFBundleURLTypes` entry for when it is). This
  custom-scheme URI is rejected by production's `uri_allow_list` today
  (confirmed via the emailless `/auth/v1/verify` probe above). Currently
  inert — `VITE_ENABLE_OAUTH` is absent from `env`, so OAuth sign-in is
  disabled entirely — but native OAuth will silently fail the day it's
  enabled unless `com.sos.sthira://auth-callback` is added to
  `uri_allow_list` first.
- **Reconsider `rate_limit_email_sent` (currently 30/hour) before cutover
  (Phase 5c):** raising it from 2 to 30/hour is correct and strictly
  *reduces* the denial-of-service exposure (exhausting the project-wide
  budget was 15x cheaper at 2/hour; per-address bombing is separately capped
  by `smtp_max_frequency=60` seconds). But 30/hour is still low against 103
  real users: a cutover-day mass password-reset or signup burst will hit it,
  and the user-visible failure is a silent `429` with no in-app explanation.
  Decide before cutover whether to raise it further.

## Rollback

This stack is live, deployed as Coolify application `i64jlyerora7ao9vkw5sweh3`
(name `logicnexus-selfhost-supabase`) on `72.61.249.111:8000`, deploying from
branch **`deploy/supabase-selfhost-phase1`** — deliberately **not** `main`.
That branch was created during Task 3 because 9 other Coolify applications on
this same VPS (`frontend`, `crm-api`, `amro-api`, `comms-api`,
`compliance-api`, `finance-api`, `logistics-api`, `markets-worker`,
`uim-api`) track `main` directly; pushing straight to `origin/main` risked
triggering their redeploys via whatever webhook/polling Coolify has
configured for that branch. Local `main` is kept significantly ahead of
`origin/main` throughout this project — check
`git rev-list --count origin/main..main` for the current count rather than
trusting any specific figure written here, since it drifts with every commit
and would otherwise go stale (an earlier draft of this section cited a fixed
"67 commits ahead," which was already wrong within days). `main` is
periodically synced onto `deploy/supabase-selfhost-phase1` (most recently as
part of this fix wave, via `git push origin main:deploy/supabase-selfhost-phase1`)
so the two point at the same commit content-wise — but Coolify's application
is still configured to track `deploy/supabase-selfhost-phase1` specifically,
not `main`. Repoint it via `PATCH /api/v1/applications/i64jlyerora7ao9vkw5sweh3`
with a `git_branch` change if that's ever deliberately decided instead.

If this stack needs to be torn down (resource pressure, or Phase 1 is
abandoned):

1. Stop the application:
   ```bash
   curl -X POST "http://72.61.249.111:8000/api/v1/applications/i64jlyerora7ao9vkw5sweh3/stop" \
     -H "Authorization: Bearer $COOLIFY_API_TOKEN"
   ```
   then delete it:
   ```bash
   curl -X DELETE "http://72.61.249.111:8000/api/v1/applications/i64jlyerora7ao9vkw5sweh3" \
     -H "Authorization: Bearer $COOLIFY_API_TOKEN"
   ```
   Note the endpoint is `/api/v1/applications/...`, **not**
   `/api/v1/services/...` — this stack is deployed as a Coolify
   **application** (custom git-sourced Docker Compose app,
   `build_pack: dockercompose`), not a Coolify **service** (the one-click
   template catalog). The two resource types have distinct, non-interchangeable
   API endpoints; using `/services/` against this UUID will 404.
2. This removes all 7 containers (`db`, `kong`, `auth`, `rest`, `storage`,
   `realtime`, `functions`) in one action, since they're all one Coolify
   Compose application — no separate database resource to clean up
   independently.
3. Re-run the four production health-check curls to confirm zero impact
   (same as every other step in this plan):
   ```bash
   curl -s -o /dev/null -m 8 -w "frontend -> %{http_code}\n" https://app.sosservices.online/
   curl -s -o /dev/null -m 8 -w "crm-api -> %{http_code}\n" https://api.sosservices.online/health
   curl -s -o /dev/null -m 8 -w "amro-api -> %{http_code}\n" https://amro.sosservices.online/health
   curl -s -o /dev/null -m 8 -w "aviation -> %{http_code}\n" https://app.aviation.sosservices.online/
   ```

Nothing in this stack is referenced by any production app's env vars, so
this teardown is safe at any time during Phase 1. The one caveat: tearing
down and later re-deploying this same stack from scratch will hit the
bind-mount-seeding gotcha documented above all over again (Coolify will
recreate the file-based mount paths from empty on a fresh deploy) — budget
time for the manual `scp` reseed step if that happens.

**This "safe at any time" framing is stale once Phase 5 has run.** The
paragraph above describes Phase 1's teardown risk (no production app reads
this stack's env vars) — it says nothing about the data or secrets *inside*
the stack. After Phase 5, this stack holds 103 real migrated users' emails
and password hashes, and its `JWT_SECRET`/`ANON_KEY`/`SERVICE_ROLE_KEY` are
now identical to production's real ones (see the production-security note
in the Phase 5 section above). A rollback/teardown decided *after* Phase 5
is a materially different, higher-stakes operation than one decided before
it: abandoning this migration would imply also rotating production's actual
JWT secret (since self-hosted now shares it, leaving it in place on a
to-be-deleted stack is itself a residual-exposure question), which would
invalidate every currently-issued production access/refresh token and both
production API keys. Treat a post-Phase-5 rollback as its own decision
requiring the plan owner's sign-off, not a mechanical repeat of the steps
above.
