# Self-hosted Supabase — Phase 1 lean stack

Docker-compose config for a resource-capped, self-hosted Supabase-equivalent
stack (Kong + Auth + REST + Storage + Realtime + Edge Runtime), deployed
through Coolify on the existing shared Hostinger VPS (`72.61.249.111`).

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

## What's in this directory

| File | Purpose |
|---|---|
| `docker-compose.yml` | The 6-service stack: `kong`, `auth`, `rest`, `storage`, `realtime`, `functions`. No `db` service — Postgres is a separate Coolify-native "Database" resource (see below). |
| `kong.yml` | Kong's DB-less declarative config — routes `/auth/v1`, `/rest/v1`, `/graphql/v1`, `/storage/v1`, `/realtime/v1`, `/functions/v1` to their backends. Adapted from upstream `supabase/supabase`, with Studio/postgres-meta/Analytics routes removed (out of scope). |
| `kong-entrypoint.sh` | Kong's custom entrypoint — substitutes `$SUPABASE_ANON_KEY`/`$SUPABASE_SERVICE_KEY` and builds the request-transformer Lua expressions into `kong.yml` before Kong starts. Copied verbatim from upstream; do not hand-edit the substitution logic. |
| `env.example` | Every env var the compose file references, with placeholders and comments. Copy to `.env` (not committed) and fill in real values. Named without a leading dot, like `deploy/env.example`, so the repo's pre-commit hook (which blocks any staged `.env*` file as a secrets-safety guard) doesn't reject it. |

## Where this deploys

- **Coolify project/environment**: the existing Coolify instance on
  `72.61.249.111`, alongside the platform's other resources (frontend,
  8 microservices, and ~24 unrelated apps). This stack is *additive* — it
  does not touch, replace, or reconfigure any existing Coolify resource.
- **Postgres**: a Coolify-native "Database" resource (Task 2 of the Phase 1
  plan), matching the precedent already proven by the `aviation-ai-pro` app
  on this same box — not a container in this compose file. `POSTGRES_HOST`/
  `POSTGRES_PORT` in `.env` point at that resource once it exists.
- **Network**: all 6 services join the shared, pre-existing `coolify` Docker
  network (`external: true` in `docker-compose.yml`) — the same network every
  other Coolify-managed resource on this VPS uses, including the Postgres
  resource above. This is required for container-name DNS resolution to work
  (confirmed via `docker inspect` against existing resources on this VPS);
  it is not an isolation boundary. Memory limits (below) are.
- **Gateway domain**: Kong is the only service meant to be exposed via
  Coolify's Traefik, proposed at `supabase.sosservices.online` (adjustable —
  confirm before DNS/Traefik provisioning). The other 5 services are reachable
  only from Kong and each other, over the internal `coolify` network.

Actually wiring this compose file up as a Coolify resource, provisioning the
Postgres "Database" resource, and Traefik/DNS routing are later tasks in the
Phase 1 plan (Task 2 and Task 4) — this directory only contains the
repo-tracked config, not a live deployment.

## Memory limits

Every service has an explicit `mem_limit`, matching the design spec's Global
Constraints table:

| Service | Cap | Image |
|---|---|---|
| `kong` | 512m | `kong/kong:3.9.3` |
| `auth` | 256m | `supabase/gotrue:v2.189.0` |
| `rest` | 256m | `postgrest/postgrest:v14.12` |
| `storage` | 512m | `supabase/storage-api:v1.60.4` |
| `realtime` | 768m | `supabase/realtime:v2.102.3` |
| `functions` | 768m | `supabase/edge-runtime:v1.74.0` |

Total: ~3.1GB for this compose file, plus Postgres's separate 3GB cap
(Task 2) — ~6.1GB combined, matching the design spec. This is the concrete
mechanism protecting the other 24 apps on the shared VPS from this stack: if
this stack's usage exceeds its own ceiling, the kernel OOM-kills a process
*inside this stack's cgroup*, not an unrelated app's process.

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

## Validating this compose file

```bash
docker compose -f deploy/selfhosted-supabase/docker-compose.yml config --quiet
```

Exits 0 with no output when the YAML/schema is valid. This does **not**
start any containers or require the Postgres resource to exist yet — it's a
syntax/schema check only.

## Rollback

Nothing in this directory deploys anything by itself (Task 1 of the Phase 1
plan is config-only). Once actually deployed (Task 4), the fast teardown
path is the same as any other Coolify-managed compose resource: delete the
resource in Coolify, or `docker compose -f docker-compose.yml down` on the
host. No existing app's config, network, or data is touched by that teardown.
