# Self-Hosted Supabase Migration — Phase 1: Lean Stack on the Shared VPS - Design Specification

**Date:** 2026-08-22
**Scope:** Stand up a resource-capped, self-hosted Supabase-equivalent stack (Postgres + Auth + REST + Storage + Realtime + Edge Runtime, fronted by Kong) on the existing Hostinger/Coolify VPS (72.61.249.111), as the foundation for later migrating production off Supabase Cloud. This spec covers Phase 1 only — standing up and validating the stack with zero production traffic. Later phases (logical replication, storage file sync, edge function redeployment, JWT/auth continuity, the actual cutover, and Supabase Cloud decommission) are out of scope here and will get their own specs.
**Status:** Approved for implementation

**Revised 2026-08-22 during Task 2 execution:** the original design put Postgres on Coolify's native "Database" resource type (§3/§4 below described this). Implementation discovered this doesn't work: the `supabase/postgres` image's own entrypoint unconditionally requires a bind-mounted `99-roles.sql` file on every startup, and Coolify's generic Database resource type has no mechanism to supply it — confirmed by reading the image's `docker-entrypoint.sh` directly and by comparing against the working `avaipro-pg` precedent (which uses plain `postgres:17`, a fundamentally different image that doesn't need this file — the precedent didn't actually transfer). Postgres is now deployed as a `db` service inside the same docker-compose stack as the other six services, matching how every real Supabase self-host deployment actually works. §3 and §4 below reflect the corrected design; the superseded "Coolify-native Database resource" rationale has been removed rather than left as dead text.

## 1. Background

The platform ("Logic Nexus AI" / "SOS Logistic Pro Enterprise") currently runs entirely on Supabase Cloud (project `gzhxgoigflftharcmdqj`, confirmed directly from the live production JS bundle at `app.sosservices.online`, not assumed). The user wants to migrate off Supabase Cloud to a self-hosted stack on their own infrastructure, with near-zero downtime for the eventual cutover.

The app is deeply built on Supabase's full platform, not just Postgres — verified directly against the codebase and the live Supabase Cloud project:
- **155 Edge Functions** (Deno) — auth flows, AI features, billing, email pipelines, etc. (`supabase/functions/*`)
- **Auth** referenced in 102 files (`supabase.auth.*`)
- **Storage** referenced in 21 files
- **Realtime** referenced in 18 files (`.channel(`, `postgres_changes`)
- **~300 tables** in `public`, 361 files with RLS policies, extensions in active use: `vector` (pgvector, AI embeddings), PostGIS family, `pgroonga`, `pg_cron`, `pgjwt`, `pgsodium`, `pg_net`, `pg_graphql`

This rules out a "just move the database" migration — Auth/Storage/Realtime are the same Postgres instance plus separate services (GoTrue, PostgREST, Realtime, Storage API) that Supabase Cloud runs for you. Self-hosting means standing up that stack somewhere.

**Infrastructure constraint driving this spec's approach:** the user has one existing VPS (Hostinger, `72.61.249.111`, managed via Coolify), already hosting 24 unrelated production apps (frontend + 8 backend microservices for this platform, the aviation-ai-pro/avaipro stack, Plane.so, 3 Jenkins instances, sos-astral/imac.sosservices.online, marketing sites, etc.) across ~88 containers. There is currently no budget for a new/upgraded VPS (revenue-dependent, per the user directly). A full audit of this VPS found:
- **A confirmed OOM-kill incident on 2026-08-15**: the kernel killed the `celery` process (aviation-ai-pro's worker, ~4.4-4.6GB RSS each) 8 times in 15 minutes. This is real evidence of memory pressure causing production disruption, not a hypothetical.
- Current state: 966MB "free" RAM but **6.15GB "available"** (free + reclaimable cache) — the free/available distinction matters, since most of what's "used" is reclaimable page cache, but the Aug 15 incident shows sudden large allocations can still outrun reclaim.
- Swap 68% utilized (2.79GB / 4GB) — system is actively swapping.
- CPU steal time up to ~12% in samples — this VPS shares its physical host with other tenants.
- CPU load average (0.86-1.15 on 4 cores) and disk I/O (<3% utilized) are both fine — memory is the actual constraint, not CPU or disk.
- **None of the 24 existing apps' containers have memory limits set**, except Plane.so (which does, and is the only stack with real per-container caps). This is part of why the Aug 15 incident could happen at all — an unbounded container can consume the whole box.

Also found and cleaned up during this investigation (see git history / conversation record, not part of this spec's deliverable): an abandoned, unhealthy, zero-data self-hosted Supabase attempt (`logicprodev`, 13 containers + a stray `supabase-gateway` nginx container, ~8.5GB disk + ~1.1GB RAM) from an earlier session, confirmed isolated and safe to remove, and removed. This freed the VPS from 587MB→1.2GB free RAM and 81GB→100GB free disk before this spec's stack is even deployed, and is the reason the "current state" numbers above are healthier than they were.

**Reference precedent**: the aviation-ai-pro app already runs a *lighter* self-hosted slice successfully on this same box — GoTrue + PostgREST + Storage API behind Caddy, backed by a Coolify-native Postgres "Database" resource (not a raw docker-compose Postgres) — actively maintained, properly integrated into Coolify's shared network. It proves a minimal self-hosted footprint is viable here, though that app doesn't use Kong, Realtime, or Edge Functions, so it's a smaller footprint than what this platform actually needs.

**Decision** (explicit, informed trade-off, made by the user after this audit): build the lean stack on the existing shared VPS rather than wait for budget for a dedicated one, accepting that this reduces but does not eliminate risk to the other 24 apps. This spec's design is built around minimizing that residual risk as concretely as possible.

## 2. Goals / Non-Goals

**Goals:**
- Stand up a working self-hosted Supabase-equivalent stack (Postgres 17 + Kong + GoTrue + PostgREST + Storage API + Realtime + Edge Runtime) on the existing VPS, with the same Postgres extensions the production app uses (`vector`, PostGIS, `pgroonga`, `pg_cron`, `pgjwt`, `pgsodium`, `pg_net`, `pg_graphql`).
- Every container in this new stack has an explicit, hard memory limit (Docker `--memory`, i.e. cgroup v2 `memory.max`) — so if this stack's actual usage exceeds its own ceiling, the kernel OOM-kills a process *inside this stack's cgroup*, not a process belonging to any of the other 24 apps. This is the concrete mechanism substituting for the isolation a dedicated VPS would have given for free.
- No production traffic touches this stack in Phase 1. It runs empty/idle, fully testable in isolation, with zero risk to the live app (which stays on Supabase Cloud throughout this phase).
- Deployed through Coolify as one Docker Compose service (all 7 containers, including `db`) so it's manageable through the existing panel like every other app on this box — a Coolify-native "Database" resource for Postgres was tried and doesn't work for the `supabase/postgres` image (see revision note above); this isn't the same bind-mount-outside-Coolify's-management pattern as the abandoned stack that was removed, since this compose file is itself Coolify-managed (tracked in this repo, deployed as a proper Coolify resource) rather than a manually-run `docker compose` project outside Coolify entirely.

**Non-Goals (deferred to later phases, each getting its own spec):**
- No data migration yet — this phase stands up empty infrastructure only.
- No logical replication setup (Phase 2).
- No Storage file sync from Supabase Cloud (Phase 3).
- No Edge Function deployment/testing of the actual 155 functions yet (Phase 4) — Phase 1 only proves the Edge Runtime container itself starts and can serve a trivial function.
- No JWT secret alignment with Supabase Cloud yet (Phase 5) — Phase 1 uses freshly generated secrets.
- No cutover, no changes to any of the 8 running production microservices or the frontend's env vars.
- Not building Studio (admin UI) as an always-on service, not building Analytics/Logflare, not building imgproxy (see §4 for why).
- Not addressing the pre-existing RLS-disabled finding on 10 production tables (flagged separately to the user; unrelated to this migration).

## 3. Architecture

```
                      Existing shared VPS (72.61.249.111, Coolify-managed)
                      ─────────────────────────────────────────────────
                      24 existing apps, ~88 containers, NO memory limits
                      (frontend, 8 microservices, avaipro/aviation stack,
                       Plane.so, 3x Jenkins, sos-astral, marketing sites...)

                      ┌─────────────── NEW: logic-nexus self-host stack ────────────────┐
                      │   ONE Coolify Docker Compose service, 7 containers, every one    │
                      │   with a hard --memory cap (cgroup v2)                           │
                      │                                                                  │
                      │   db (Postgres 17, supabase/postgres image)         cap: 3GB     │
                      │   extensions: vector, postgis, pgroonga, pg_cron,                │
                      │   pgjwt, pgsodium, pg_net, pg_graphql                            │
                      │   bind-mounts roles.sql/init-scripts from the upstream           │
                      │   reference (image's own entrypoint hard-requires these —        │
                      │   a bare Coolify "Database" resource cannot supply them;          │
                      │   found and corrected during Task 2 execution, see revision      │
                      │   note above)                                                    │
                      │                     ▲                                           │
                      │                     │ shared `coolify` Docker network (same     │
                      │                     │ one every Coolify resource on this box    │
                      │                     │ uses — see §5)                            │
                      │        ┌────────────┼─────────────┬──────────────┬─────────┐    │
                      │        │            │             │              │         │    │
                      │     GoTrue      PostgREST      Storage API    Realtime  Edge Rtm │
                      │   cap: 256MB   cap: 256MB     cap: 512MB    cap: 768MB cap: 768MB│
                      │   (Auth)       (REST API)     (local disk    (Elixir/   (Deno,   │
                      │                                backend, no   BEAM,     155 fns   │
                      │                                MinIO)        most      later)    │
                      │                                              variable)           │
                      │        └────────────┴─────────────┴──────────────┴─────────┘    │
                      │                              │                                   │
                      │                        Kong (gateway)              cap: 512MB    │
                      │                     routes /auth, /rest, /storage,               │
                      │                     /realtime, /functions — matches              │
                      │                     what Supabase client libraries expect        │
                      │                              │                                  │
                      └──────────────────────────────┼───────────────────────────────────┘
                                                       │
                                          Coolify Traefik (shared proxy,
                                          same as all 24 other apps)
                                                       │
                                    supabase.sosservices.online (proposed;
                                    adjustable — see §7 Open Items)

   Total new hard-capped ceiling: ~6.1GB across 7 containers, all deployed as one
   Coolify Docker Compose service. Explicitly skipped: Studio (SSH tunnel + local
   Studio on demand instead of always-on), Analytics/Logflare (was the crash-looping
   piece in the stack we removed; not essential), imgproxy (only needed if Storage
   image transforms are actually used — not confirmed yet), Vector log shipper
   (Coolify already aggregates logs).
```

**Why Kong instead of Caddy** (aviation-ai-pro's choice): aviation's app doesn't use Realtime or Edge Functions, so a hand-rolled Caddy config was sufficient for its 3 routes. This platform's client code expects the standard Supabase routing surface (`/auth/v1`, `/rest/v1`, `/storage/v1`, `/realtime/v1`, `/functions/v1`) with JWT verification at the gateway — Kong with Supabase's standard `kong.yml` is the proven, maintained way to get that, and re-implementing it in Caddy would be extra bespoke work for no benefit.

**Why Postgres is a `db` service in the compose stack, not a Coolify-native Database resource** (revised 2026-08-22 — see the revision note at the top of this document): the original design reasoned by analogy to `avaipro-pg`, a working Coolify-native Database resource. That precedent uses plain `postgres:17`, which self-initializes with no external files. `supabase/postgres` is a fundamentally different, specialized image whose own entrypoint (`docker-entrypoint.sh`, confirmed by reading it directly out of the image) unconditionally runs `psql -f /docker-entrypoint-initdb.d/init-scripts/99-roles.sql` on every single startup — a file that must be bind-mounted in, which Coolify's generic Database resource type has no facility to do. Deploying it as a compose service (like every real Supabase self-host setup) lets us bind-mount that file and the rest of the upstream reference's `db`-service setup directly, exactly as intended.

## 4. Memory Limits & Safety Rationale

| Component | Image | Memory cap | Rationale |
|---|---|---|---|
| Postgres (`db` service) | `supabase/postgres:17.6.1.136` (corrected 2026-08-22: this is what upstream's `docker-compose.yml` actually pins as of the Task 2 re-clone; the earlier `17.4.1.037` also exists on Docker Hub but is a stale snapshot — every other image tag in this table was confirmed against the same upstream fetch as this one, so the discrepancy was isolated to Postgres specifically, not a stale fetch overall) | 3GB | Modest `shared_buffers` (~768MB, tunable), room for per-connection work_mem given ~300 tables but currently modest real row counts |
| Kong | `kong/kong:3.9.3` (confirmed, pulled directly from upstream's current reference during Task 1) | 512MB | Gateway/routing only, no heavy state |
| GoTrue | `supabase/gotrue:v2.189.0` | 256MB | Auth is lightweight per-request |
| PostgREST | `postgrest/postgrest:v14.12` | 256MB | Stateless REST layer |
| Storage API | `supabase/storage-api:v1.60.4` | 512MB | Local-disk backend (no MinIO — one less container, matches "lean" goal) |
| Realtime | `supabase/realtime:v2.102.3` | 768MB | Elixir/BEAM; most variable under real connection load, generous relative to others |
| Edge Runtime | `supabase/edge-runtime:v1.74.0` | 768MB | Deno; will run 155 functions in later phases, none in Phase 1 |
| **Total** | | **~6.1GB hard cap** | |

This is the core safety mechanism replacing the isolation a dedicated VPS would give for free: **every container above gets an explicit Docker `--memory` limit**, which maps to a cgroup v2 `memory.max`. If this stack's actual combined usage tries to exceed ~6.1GB, the kernel's OOM killer acts *within this stack's cgroup scope* — it kills a process belonging to this stack, not a process belonging to any of the other 24 apps. This directly targets the failure mode observed on 2026-08-15 (an unbounded container — that incident's `celery` process had no limit set at the time relative to its actual usage spike — triggering a system-wide OOM sweep that could pick any process).

This does not make the risk zero: if literal system-wide available memory (not just this stack's own ceiling) is exhausted by the *combination* of everyone's actual usage, a global OOM event can still occur and the kernel is not guaranteed to only pick from within one cgroup in every scenario. The mitigation is real but partial — consistent with what was told to the user when this option was chosen.

**Additional safety measures for Phase 1 specifically:**
- Deploy and validate with **zero production traffic** — nothing depends on this stack yet, so if something goes wrong, the blast radius is contained to an empty, non-critical stack.
- After deployment, re-run the same health checks used earlier in this investigation (`docker stats`, `free -h`, `vmstat`, a check for new OOM entries in `dmesg`/`journalctl`) to confirm the other 24 apps are unaffected — the same verification pattern already used after the `logicprodev` cleanup.
- Document a fast teardown path (`docker compose down` / Coolify service deletion) as an explicit rollback, before declaring Phase 1 done — mirrors how cleanly the abandoned stack came out.

## 5. Domain / Networking

**Corrected during plan audit (2026-08-22):** the first draft of this section said the new stack would sit on its own isolated Docker network, separate from the shared `coolify` network — modeled on the isolation we confirmed for the abandoned `logicprodev` stack before removing it. That's wrong for this design: Coolify-managed resources (both its native Database type, e.g. `avaipro-pg`/`y85hpjdrs9wlotcgqcbw8gdg`, and its Traefik-routed compose services, e.g. `avaipro-gotrue`/`avaipro-postgrest`/`avaipro-gateway`) all live on the shared `coolify` network — confirmed directly via `docker inspect` on both. Building this stack on a separate isolated network as originally written would have left `auth`/`rest`/`storage`/`realtime`/`functions` unable to reach `db` by container name at all — the stack would report "running" but be non-functional.

- All 7 containers (Postgres + Kong + GoTrue + PostgREST + Storage + Realtime + Edge Runtime) join the shared `coolify` Docker network — this is simply how every Coolify-managed resource on this box works, not a special exception for this stack.
- The actual safety property against the other 24 apps is **not** network isolation — it's the per-container memory limits (§4). Network topology was never the right lever for that concern; being on a shared bridge network doesn't cost CPU/memory or affect other containers' resource cgroups.
- Kong is the only component exposed via Coolify's Traefik, on a new subdomain (see Open Items §7 for the exact name).
- Postgres, GoTrue, PostgREST, Storage, Realtime, Edge Runtime don't need host port exposure — reachable from Kong (and from each other, and from Postgres) via the shared `coolify` network's internal container-name DNS, same as every other Coolify app already does.

## 6. Verification Plan for Phase 1

Before Phase 1 is considered done:
1. All 7 containers report healthy in `docker ps`.
2. Each container's actual memory usage stays within its cap under a basic smoke test (Kong routing a request through to each backend service, e.g. GoTrue `/health`, PostgREST root, Storage API `/status`, a trivial "hello world" Edge Function).
3. Postgres extensions confirmed installed and functional: `SELECT * FROM pg_extension` includes `vector`, `postgis`, `pgroonga`, `pg_cron`, `pgjwt`, `pgsodium`, `pg_net`, `pg_graphql`.
4. Re-run the VPS-wide health check (RAM/swap/OOM log check + the same handful of production health-endpoint curls used throughout this investigation: frontend, crm-api, amro-api, aviation app) to confirm zero impact on existing apps.
5. Rollback path (full teardown) documented and dry-run-able.

## 7. Open Items (explicit, to resolve before/during implementation)

- ~~**Postgres image tag**~~ — resolved: `supabase/postgres:17.6.1.136` (corrected 2026-08-22 — the compose-stack Task 2 re-clone found upstream actually pins this, not the `17.4.1.037` first noted during the original, now-superseded Coolify-native-Database-resource attempt).
- **Domain name for the gateway**: proposed default `supabase.sosservices.online`, matching the "one clear subdomain per concern" pattern already used across the other 24 apps (`api.`, `amro.`, `uim.`, `db.aviation.`, etc.). Adjustable — confirm with the user before provisioning DNS/Traefik routing.
- **Storage backend**: local disk (proposed default, matches "lean" goal) vs. adding MinIO later if S3-compatible access becomes necessary for a later phase — deferred, not blocking Phase 1.
