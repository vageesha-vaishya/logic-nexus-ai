# Self-Hosted Supabase Phase 1 (Lean Stack on Shared VPS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a memory-capped, self-hosted Supabase-equivalent stack (Postgres 17 + Kong + GoTrue + PostgREST + Storage API + Realtime + Edge Runtime) on the existing shared Hostinger/Coolify VPS, deployed through Coolify, serving zero production traffic, with every container hard-capped so it cannot starve the other 24 apps already on that box.

**Architecture:** All 7 services (Postgres/`db` + Kong + Auth + REST + Storage + Realtime + Edge Runtime) are ONE Coolify "Service" deployed from a single docker-compose file tracked in this repo (`deploy/selfhosted-supabase/`), on the shared `coolify` Docker network (same as every other Coolify-managed resource on this VPS — required for container-name DNS reachability, not a special case), fronted by Kong on a new subdomain. Protection against resource contention with the other 24 apps comes from per-container memory limits, not network isolation. No repo application code changes — this is infrastructure-only.

**Revised 2026-08-22 during Task 2 execution:** the original plan had Postgres as a separate Coolify-native "Database" resource (matching the `avaipro-pg` precedent), with a distinct Task 2 (provision it) before Task 4 (deploy the other six services). This doesn't work: `supabase/postgres`'s own entrypoint unconditionally requires a bind-mounted `99-roles.sql` on every startup, which a bare Coolify Database resource cannot supply (confirmed directly against the image and against `avaipro-pg`, which uses a different, simpler image that doesn't need this file). Postgres is now a `db` service inside the same compose file as the other six — Tasks 2-6 below reflect this; the old Task 2 (Coolify-native resource) is dropped entirely, not deferred.

**Tech Stack:** Coolify v4 (REST API + Traefik), Docker/docker-compose, `supabase/postgres:17.6.1.136` (corrected from the plan's earlier `17.4.1.037` assumption during Task 2's actual execution — see its report), `kong/kong:3.9.3`, `supabase/gotrue:v2.189.0`, `postgrest/postgrest:v14.12`, `supabase/storage-api:v1.60.4`, `supabase/realtime:v2.102.3`, `supabase/edge-runtime:v1.74.0` (all image tags confirmed against the same live upstream fetch, not guessed).

## Global Constraints

(Copied verbatim from `docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md` — every task below implicitly includes these.)

- Every container in this stack MUST have an explicit Docker memory limit (cgroup v2 `memory.max`). No exceptions, no "add it later."
- No production traffic reaches this stack in Phase 1. It must not be referenced by `.env`, `.env.production.local`, the Jenkinsfile, or any of the 8 running microservices/frontend.
- Total hard-capped ceiling across all 7 containers: ~6.1GB (Postgres 3GB, Kong 512MB, GoTrue 256MB, PostgREST 256MB, Storage API 512MB, Realtime 768MB, Edge Runtime 768MB).
- Explicitly out of scope for this stack: Studio, Analytics/Logflare, imgproxy, Vector log shipper.
- Coolify base URL: `http://72.61.249.111:8000`. Auth: Bearer token, value already present as `COOLIFY_API_TOKEN` in the local `env` file (repo root) — **never hardcode the literal token value in any file that gets committed**; always reference it as `$COOLIFY_API_TOKEN` (export it in your shell from the `env` file before running any command below: `export COOLIFY_API_TOKEN=$(grep '^COOLIFY_API_TOKEN=' env | cut -d'"' -f2)`).
- Target Coolify project: `logic-nexus-dev` (uuid `gkwk84gocoo44wkkcsscs0k8`), environment `production` (uuid `ko4o00k400ccgo44kk40s8gw` — this is the only environment under that project; the name is misleading but it's the dev/test project, confirmed via `GET /api/v1/projects/gkwk84gocoo44wkkcsscs0k8`). This project already exists and is the appropriate place for non-production infra work on this platform. Server/destination: `localhost` (uuid `ewwc8w4oc4cs0w08g4goc0go`).
- SSH access to the VPS: `ssh hostinger-vps` (already configured, dedicated key, root access).
- After every destructive or resource-affecting step, re-verify the other 24 apps are healthy: `curl -s -o /dev/null -m 8 -w "%{http_code}\n" https://app.sosservices.online/`, same for `https://api.sosservices.online/health`, `https://amro.sosservices.online/health`, `https://app.aviation.sosservices.online/`. All must return `200`.

---

### Task 1: Get the authoritative upstream Kong/service config as a reference, then author the repo-tracked lean docker-compose + Kong config

**Why fetch upstream first:** the exact current image tags and Kong declarative-config syntax for Supabase's self-host stack change over time (Kong version, GoTrue env var names, etc.). Rather than hardcode potentially-stale values from memory, pull the live reference from `supabase/supabase` at execution time and adapt it — this is the same repo we already found (and removed) an abandoned clone of, so re-cloning it briefly for reference is a known-safe, temporary, read-only operation.

**Files:**
- Create: `deploy/selfhosted-supabase/docker-compose.yml`
- Create: `deploy/selfhosted-supabase/kong.yml`
- Create: `deploy/selfhosted-supabase/.env.example`
- Create: `deploy/selfhosted-supabase/README.md`

**Interfaces:**
- Produces: a `docker-compose.yml` with services named exactly `kong`, `auth`, `rest`, `storage`, `realtime`, `functions` (these exact names are referenced by Task 4's Coolify service deployment and Task 5's health-check steps — do not rename them).
- Produces: `kong.yml` routing `/auth/v1/*` → `auth:9999`, `/rest/v1/*` → `rest:3000`, `/storage/v1/*` → `storage:5000`, `/realtime/v1/*` → `realtime:4000/socket`, `/functions/v1/*` → `functions:9000` — these exact path prefixes are what Task 5's curl checks hit.

- [ ] **Step 1: Shallow-clone the upstream repo for reference (temporary, read-only, deleted at the end of this task)**

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase.git /tmp/supabase-upstream-ref
cd /tmp/supabase-upstream-ref
git sparse-checkout set docker
```

Expected: `/tmp/supabase-upstream-ref/docker/docker-compose.yml` and `/tmp/supabase-upstream-ref/docker/volumes/api/kong.yml` exist.

- [ ] **Step 2: Read the upstream `docker-compose.yml` and extract the `kong`, `auth`, `rest`, `storage`, `realtime`, `functions` service definitions**

Read `/tmp/supabase-upstream-ref/docker/docker-compose.yml`. Note the exact `image:` tag for each of these six services (they pin specific versions, e.g. `supabase/gotrue:v2.x.x` — use whatever the file actually says, not a guess). Note each service's required environment variables from the same file — GoTrue and PostgREST in particular have many.

- [ ] **Step 3: Read the upstream `kong.yml`**

Read `/tmp/supabase-upstream-ref/docker/volumes/api/kong.yml`. This is the DB-less declarative Kong config with `_format_version`, `consumers` (anon/service_role keyauth), `acls`, and `services` routing each path prefix to its backend. Copy it into `deploy/selfhosted-supabase/kong.yml` verbatim, removing only the Studio-related route/CORS entries if present (Studio is out of scope for Phase 1).

- [ ] **Step 4: Write `deploy/selfhosted-supabase/docker-compose.yml`**

Adapt the six extracted service definitions (same images/env vars as upstream) into a new compose file with these changes from upstream:
- Remove the `db` service entirely — Postgres is a separate Coolify-native Database resource (Task 2), not part of this compose file.
- Every remaining service's `POSTGRES`/`DB` connection env vars (e.g. `GOTRUE_DB_DATABASE_URL`, `PGRST_DB_URI`, database URL for `storage`, `realtime`, `functions`) point at `${POSTGRES_HOST}:${POSTGRES_PORT}` (placeholders filled from `.env` at deploy time — Task 2 produces the real host/port once the Database resource exists) instead of upstream's `db:5432`.
- Add an explicit `mem_limit:` to every service, matching the Global Constraints table: `kong: 512m`, `auth: 256m`, `rest: 256m`, `storage: 512m`, `realtime: 768m`, `functions: 768m`.
- **Network — corrected during plan audit, do not use an isolated network:** declare the top-level `networks:` block as `coolify: {external: true}` and put all six services on it. This is not optional: Coolify-native Database resources (including the one Task 2 creates) live on the shared `coolify` network, confirmed directly via `docker inspect y85hpjdrs9wlotcgqcbw8gdg` — if these services sit on a separate isolated network instead, they cannot reach Postgres by container name and the stack will report "running" while being completely non-functional. This matches how every other Coolify-managed resource on this VPS is already networked (confirmed on `avaipro-gotrue`/`avaipro-postgrest`/`avaipro-gateway`). The actual protection against resource contention with the other 24 apps is the `mem_limit` values above, not network topology — being on a shared bridge network has no bearing on CPU/memory cgroups.
- **Preserve Kong's env-var templating entrypoint — do not just copy `kong.yml` and the plain `kong` image config.** Upstream's `kong.yml` contains placeholders like `$SUPABASE_ANON_KEY` / `$SUPABASE_SERVICE_KEY` that only resolve into real values because the upstream `kong` service definition has a custom `entrypoint`/`command` that runs a substitution step (e.g. `bash -c 'eval "echo \"$(cat /path/to/kong.yml)\"" > /tmp/kong.yml && ...'` or equivalent — read the exact mechanism from the upstream file in Step 2/3, don't paraphrase it from memory) against the container's actual env vars before Kong starts. Copy that entrypoint/command verbatim (adjusted only for file paths if they differ in this compose file) alongside the image and env vars. If this is skipped, Kong will try to authenticate requests against the literal string `$SUPABASE_ANON_KEY` instead of the real key, and every API call through Kong will fail auth silently — this would not be caught by Task 5's `apikey` header checks unless the exact failure mode is understood (a `401`/`403` there is not automatically "the stack is misconfigured elsewhere," check this first).
- Storage service: set its backend to local disk (e.g. `STORAGE_BACKEND=file`, `FILE_STORAGE_BACKEND_PATH=/var/lib/storage`), not S3/MinIO, per the spec's "skip MinIO" decision. Mount a named volume for that path.
- Remove any `depends_on: db` entries (no local `db` service exists in this file).
- **Known Phase 1 limitation, not a blocker:** Realtime typically needs a tenant registered (via its `/api/tenants` endpoint or a setup script) to be fully functional beyond a bare WebSocket handshake — Task 5 Step 4 only checks that the container responds through Kong, not full tenant-scoped functionality. Real Realtime functionality is validated in a later phase once real data/replication exists; don't treat a working handshake as "Realtime is fully configured."

- [ ] **Step 5: Write `deploy/selfhosted-supabase/.env.example`**

Include every env var the compose file references (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SITE_URL`, and whatever else Step 2 found GoTrue/PostgREST/Storage/Realtime require), each with a placeholder value and a one-line comment — this mirrors the existing `deploy/env.example` convention already in this repo.

- [ ] **Step 6: Write `deploy/selfhosted-supabase/README.md`**

Document: what this is (Phase 1 of the self-host migration, see the linked spec), which Coolify project/environment it deploys to, and a link to `docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md`.

- [ ] **Step 7: Validate the compose file syntax**

```bash
docker compose -f deploy/selfhosted-supabase/docker-compose.yml config --quiet
```

Expected: exits 0 with no output (a non-zero exit or YAML error means Step 4 has a syntax mistake — fix before continuing).

- [ ] **Step 8: Clean up the temporary reference clone**

```bash
rm -rf /tmp/supabase-upstream-ref
```

- [ ] **Step 9: Commit**

```bash
git add deploy/selfhosted-supabase/
git commit -m "feat(selfhost-supabase): add Phase 1 lean-stack compose config

Docker-compose for Kong+Auth+REST+Storage+Realtime+Edge Runtime, memory-
capped per docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md.
Postgres itself is a separate Coolify-native Database resource (Task 2 of
docs/superpowers/plans/2026-08-22-supabase-selfhost-phase1.md), not in
this compose file."
```

---

### Task 2: Add Postgres (`db`) to the compose stack, bind-mounting the required upstream init files

**Why this replaces the old Task 2:** `supabase/postgres`'s own entrypoint unconditionally runs `psql -f /docker-entrypoint-initdb.d/init-scripts/99-roles.sql` (and other init SQL) on every startup — files that must be bind-mounted in from the same upstream reference Task 1 already used. A bare Coolify "Database" resource has no way to supply them (confirmed directly against the image and against the `avaipro-pg` precedent, which uses a different image that doesn't need this). Deploying Postgres as a `db` service in the same compose file Task 1 built is the fix.

**Files:**
- Modify: `deploy/selfhosted-supabase/docker-compose.yml` (add `db` service; change the other six services' Postgres connection env vars from `${POSTGRES_HOST}:${POSTGRES_PORT}` to the internal service name `db:5432`)
- Modify: `deploy/selfhosted-supabase/env.example` (replace `POSTGRES_HOST`/`POSTGRES_PORT` placeholders with whatever the `db` service actually needs — `POSTGRES_PASSWORD`, `POSTGRES_DB`, etc.)
- Create: `deploy/selfhosted-supabase/volumes/db/` — the bind-mounted init SQL files, copied verbatim from upstream (exact filenames depend on what Step 2 finds; do not invent contents)

**Interfaces:**
- Consumes: Task 1's `docker-compose.yml`, `env.example`.
- Produces: a `db` service named exactly `db` (matches what the other six services will reference as their Postgres host) with `mem_limit: 3g`, on the `coolify` network — Task 3 deploys this, Task 4 runs against it.

- [ ] **Step 1: Re-clone the upstream reference (same approach as Task 1 Step 1 — temporary, read-only)**

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase.git /tmp/supabase-upstream-ref
cd /tmp/supabase-upstream-ref
git sparse-checkout set docker
```

- [ ] **Step 2: Read the upstream `db` service definition and its volume mounts**

Read `/tmp/supabase-upstream-ref/docker/docker-compose.yml`'s `db` service block: note the exact image tag (compare against `supabase/postgres:17.4.1.037`, already confirmed to exist — use the same tag for consistency with Task 1/2's already-confirmed version unless the upstream file pins something meaningfully different, in which case flag it rather than silently picking one), every volume it bind-mounts under `docker/volumes/db/` (typically includes files like `realtime.sql`, `webhooks.sql`, `roles.sql`, `jwt.sql`, `_supabase.sql`, `logs.sql`, `pooler.sql`, and a `init/` directory — read the actual current list, don't assume this exact set), and its required environment variables (`POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `JWT_SECRET`, `JWT_EXP`, etc.).

- [ ] **Step 3: Copy the required volume files into this repo**

Copy every file the `db` service bind-mounts (from Step 2) into `deploy/selfhosted-supabase/volumes/db/`, preserving the same relative filenames upstream uses (so the compose file's mount paths need minimal adaptation). Do not paraphrase or hand-author SQL — copy verbatim.

- [ ] **Step 4: Add the `db` service to `deploy/selfhosted-supabase/docker-compose.yml`**

- Service name: exactly `db`.
- Image: `supabase/postgres:17.4.1.037` (or the upstream-confirmed equivalent from Step 2).
- `mem_limit: 3g`, `mem_limit_swap` equivalent set so swap adds zero extra headroom (mirror Task 1's pattern of capping swap equal to the memory limit, for the same reasoning: a clean OOM-kill is better than swap-thrashing a database).
- `networks: [coolify]` — same as the other six services, not an isolated network (this is required for the other services to reach `db` by name at all, and matches every Coolify-managed resource on this box).
- Bind-mount every file copied in Step 3 to the exact container paths upstream uses.
- Environment: `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}`, `POSTGRES_DB: ${POSTGRES_DB:-postgres}`, `POSTGRES_PORT: 5432`, `JWT_SECRET: ${JWT_SECRET}`, `JWT_EXP: ${JWT_EXP:-3600}`, plus anything else Step 2 found required.
- Healthcheck: use upstream's own healthcheck definition for `db` if present (typically a `pg_isready` check), not a hand-invented one.

- [ ] **Step 5: Update the other six services' Postgres connection strings**

In `docker-compose.yml`, change every reference from `${POSTGRES_HOST}:${POSTGRES_PORT}` to the literal internal service name `db:5432` (e.g. `GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-postgres}` — adjust exact role names per what Task 1's original extraction already found in each service's env block; do not invent role names not already present in the file). Remove `POSTGRES_HOST`/`POSTGRES_PORT` from `env.example` since they're no longer externally injected — replace with `POSTGRES_PASSWORD` and `POSTGRES_DB` if not already present.

- [ ] **Step 6: Validate the compose file syntax on the real VPS Docker (not a substitute check)**

```bash
scp deploy/selfhosted-supabase/docker-compose.yml deploy/selfhosted-supabase/kong.yml deploy/selfhosted-supabase/kong-entrypoint.sh deploy/selfhosted-supabase/env.example hostinger-vps:/tmp/compose-validate-task2/
ssh hostinger-vps "cd /tmp/compose-validate-task2 && docker compose --env-file env.example -f docker-compose.yml config --quiet; echo \"EXIT: \$?\""
```

(Copy `deploy/selfhosted-supabase/volumes/` too if the compose file's bind-mount paths are relative to it.) Expected: `EXIT: 0`, no error output. This mirrors how Task 1's validation gap was closed by the controller — do it directly this time since Docker is confirmed reachable via `ssh hostinger-vps`.

- [ ] **Step 7: Clean up**

```bash
rm -rf /tmp/supabase-upstream-ref
ssh hostinger-vps "rm -rf /tmp/compose-validate-task2"
```

- [ ] **Step 8: Commit**

```bash
git add deploy/selfhosted-supabase/
git commit -m "feat(selfhost-supabase): add db service to compose stack

Postgres deploys as a db service in the same compose file as the other
six services, not a separate Coolify-native Database resource — that
approach doesn't work because supabase/postgres's entrypoint requires
bind-mounted init SQL files a bare Database resource can't supply.
See docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md
revision note (2026-08-22)."
```

---

### Task 3: Deploy the full stack (all 7 services) via Coolify

**Files:**
- Modify: none in the repo (Coolify pulls `deploy/selfhosted-supabase/docker-compose.yml` from the `main` branch when deploying a Git-based compose service).

**Interfaces:**
- Consumes: `deploy/selfhosted-supabase/docker-compose.yml`, `env.example`, and `volumes/db/` from Tasks 1-2.
- Produces: a running Coolify service (`logicnexus-selfhost-supabase`) with all 7 containers, Kong reachable at the domain chosen in the spec's Open Items (`supabase.sosservices.online`, unless changed) — Task 4 and Task 5's checks depend on this.

- [ ] **Step 1: Generate real secrets**

```bash
export JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
export POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr '/+' '_-')
```

Note: per the spec (§2 Non-Goals), these are freshly generated, **not** aligned with Supabase Cloud's actual JWT secret — that alignment is Phase 5's job, out of scope here. Save both values somewhere durable — needed again in Task 4/5.

- [ ] **Step 2: Generate the ANON_KEY and SERVICE_ROLE_KEY JWTs signed with `$JWT_SECRET`**

```bash
node -e '
const crypto = require("crypto");
function b64url(input) { return Buffer.from(JSON.stringify(input)).toString("base64url"); }
function sign(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const data = b64url(header) + "." + b64url(payload);
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return data + "." + sig;
}
const secret = process.env.JWT_SECRET;
const now = Math.floor(Date.now() / 1000);
console.log("ANON_KEY=" + sign({ role: "anon", iss: "supabase", iat: now, exp: now + 10 * 365 * 24 * 3600 }, secret));
console.log("SERVICE_ROLE_KEY=" + sign({ role: "service_role", iss: "supabase", iat: now, exp: now + 10 * 365 * 24 * 3600 }, secret));
'
```

Expected: two `KEY=eyJ...` lines. Save both.

- [ ] **Step 3: Create the Coolify service from the repo's compose file**

```bash
export COOLIFY_API_TOKEN=$(grep '^COOLIFY_API_TOKEN=' env | cut -d'"' -f2)
curl -sS -X POST "http://72.61.249.111:8000/api/v1/services" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_uuid": "gkwk84gocoo44wkkcsscs0k8",
    "environment_uuid": "ko4o00k400ccgo44kk40s8gw",
    "server_uuid": "ewwc8w4oc4cs0w08g4goc0go",
    "type": "docker-compose",
    "name": "logicnexus-selfhost-supabase",
    "description": "Phase 1 self-hosted Supabase stack for logic-nexus-ai (db+Kong/Auth/REST/Storage/Realtime/Edge Runtime). See docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md.",
    "git_repository": "https://github.com/vageesha-vaishya/logic-nexus-ai.git",
    "git_branch": "main",
    "docker_compose_location": "/deploy/selfhosted-supabase/docker-compose.yml"
  }'
```

Expected: HTTP 200/201 with a `uuid` field — save as `$SVC_UUID`. If this specific request shape 404s or errors, fall back to creating the service through the Coolify UI at `http://72.61.249.111:8000` (New Resource → Docker Compose → point at this repo/branch/path) and note which method worked, for future reference. (Task 2's execution confirmed the Coolify API generally works well once the right HTTP verb/fields are found via its own error messages — apply that same trial pattern here if needed, rather than treating a first-attempt error as a hard blocker.)

- [ ] **Step 4: Set the service's environment variables**

```bash
for kv in "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" "POSTGRES_DB=postgres" "JWT_SECRET=$JWT_SECRET" "ANON_KEY=<from step 2>" "SERVICE_ROLE_KEY=<from step 2>" "SITE_URL=https://supabase.sosservices.online"; do
  key="${kv%%=*}"; value="${kv#*=}"
  curl -sS -X POST "http://72.61.249.111:8000/api/v1/services/$SVC_UUID/envs" \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"key\": \"$key\", \"value\": \"$value\", \"is_build_time\": false}"
done
```

Add any further env vars Task 2 Step 2 found required that aren't listed here — check `env.example` for the authoritative full list before running this.

- [ ] **Step 5: Set the domain on the `kong` sub-resource within this service and deploy**

Via the Coolify UI: open the service, find the `kong` container's settings, set its domain to `supabase.sosservices.online` (or whatever was confirmed for the spec's Open Item), enable HTTPS. Then trigger deploy:

```bash
curl -sS -X POST "http://72.61.249.111:8000/api/v1/services/$SVC_UUID/start" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

(Note: Task 2's execution found the analogous database `/start` endpoint requires `POST`, not `GET`, despite older docs — try `POST` first here too.)

- [ ] **Step 6: Confirm all 7 containers are running**

```bash
ssh hostinger-vps "docker ps --filter 'label=com.docker.compose.project' --format '{{.Names}}\t{{.Status}}' | grep -i 'kong\|auth\|rest\|storage\|realtime\|functions\|^db\b\|_db_'"
```

Expected: 7 lines, all `Up ...`. If `db` doesn't reach a healthy state, check its logs immediately (`ssh hostinger-vps "docker logs <db-container-name> --tail 50"`) before assuming anything else is wrong — Task 2's diagnosis pattern (read the entrypoint, compare against the working precedent) is the right approach if it crash-loops again.

- [ ] **Step 7: Re-verify the other 24 apps are unaffected**

Run the four health-check curls from Global Constraints. All must return `200`.

---

### Task 4: Verify and enable the required Postgres extensions

**Files:** none.

**Interfaces:**
- Consumes: the running `db` container from Task 3.
- Produces: confirmation that `vector`, `postgis`, `pgroonga`, `pg_cron`, `pgjwt`, `pgsodium`, `pg_net`, `pg_graphql` are installed.

- [ ] **Step 1: Check which extensions are already available in the image**

```bash
ssh hostinger-vps "docker exec <db-container-name-from-task3-step6> psql -U supabase_admin -c \"SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name IN ('vector','postgis','pgroonga','pg_cron','pgjwt','pgsodium','pg_net','pg_graphql') ORDER BY name;\""
```

Note: the bootstrap superuser is `supabase_admin` (confirmed during Task 2's diagnosis — `supabase/postgres`'s own migration scripts assume this role, not `postgres`), not the plain `postgres` user the original plan assumed.

Expected: all 8 rows present with a non-null `default_version`. If any are missing, `supabase/postgres` doesn't bundle it — stop and report back rather than guessing a fix.

- [ ] **Step 2: Enable each extension that isn't already installed**

```bash
ssh hostinger-vps "docker exec <db-container-name> psql -U supabase_admin -c \"
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgroonga;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgjwt;
CREATE EXTENSION IF NOT EXISTS pgsodium;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_graphql;
\""
```

Expected: no errors. `pg_cron` may require `shared_preload_libraries=pg_cron` in `postgresql.conf` to actually activate — the `supabase/postgres` image sets this by default; if `pg_cron` jobs don't run later, check `SHOW shared_preload_libraries;` first.

- [ ] **Step 3: Verify all 8 are now installed**

```bash
ssh hostinger-vps "docker exec <db-container-name> psql -U supabase_admin -c \"SELECT extname FROM pg_extension WHERE extname IN ('vector','postgis','pgroonga','pg_cron','pgjwt','pgsodium','pg_net','pg_graphql') ORDER BY extname;\""
```

Expected: exactly 8 rows returned.

- [ ] **Step 4: Re-verify the other 24 apps are unaffected**

Run the four health-check curls from Global Constraints. All must return `200`.

---

### Task 5: Smoke-test the stack end-to-end through Kong

**Files:** none.

**Interfaces:**
- Consumes: `$ANON_KEY` from Task 3 Step 2, the domain from Task 3 Step 5.

- [ ] **Step 1: GoTrue health through Kong**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.sosservices.online/auth/v1/health -H "apikey: $ANON_KEY"
```

Expected: `200`.

- [ ] **Step 2: PostgREST root through Kong**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.sosservices.online/rest/v1/ -H "apikey: $ANON_KEY"
```

**Corrected post-execution (2026-08-22, final whole-plan review):** actual
live result is `403`, not `200` — Kong's ACL config makes this route
admin-only, so the anon key alone is rejected. The check that actually
proves Kong→PostgREST connectivity works is the same request with the
`service_role` key instead:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.sosservices.online/rest/v1/ -H "apikey: $SERVICE_ROLE_KEY"
```

Expected (revised): `403` with the anon key (proves Kong's ACL is enforcing,
not that something is broken); `200` with the real PostgREST OpenAPI root
body when using `service_role`.

- [ ] **Step 3: Storage API status through Kong**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.sosservices.online/storage/v1/status -H "apikey: $ANON_KEY"
```

Expected: `200`.

- [ ] **Step 4: Realtime through Kong (WebSocket upgrade check)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Connection: Upgrade" -H "Upgrade: websocket" -H "apikey: $ANON_KEY" https://supabase.sosservices.online/realtime/v1/
```

Expected: `101` (or `426` if the upgrade headers aren't perfectly formed by curl — either indicates the Realtime container itself responded; a `502`/`503`/`000` means it's not reachable and needs investigation).

**Corrected post-execution (2026-08-22, final whole-plan review):** actual
live result is `403`, not `101`/`426`. This is Realtime's own Cowboy server
responding (confirming the request reached the container through Kong), but
rejecting it for lack of a registered tenant — a tenant-auth gap, not a
routing failure. A `403` here should be read the same way the original
`101`/`426` expectation was: proof the container is reachable. Only
`502`/`503`/`000` indicates an actual reachability problem.

- [ ] **Step 5: Edge Runtime through Kong**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.sosservices.online/functions/v1/ -H "apikey: $ANON_KEY"
```

Expected: `404` is acceptable here (no functions deployed yet — that's Phase 4) as long as it's not `502`/`503`/`000`.

**Corrected post-execution (2026-08-22, final whole-plan review):** actual
live result is `503`, because the `functions` container itself is down (a
known, permanent, isolated crash-loop — real Edge Function content doesn't
exist yet, deliberately deferred to a later phase, not a Task 5 defect). A
future re-run of this plan should expect `503` here until `functions` has
real content to serve, not the `404` originally predicted.

- [ ] **Step 6: Direct Postgres connectivity check (new — wasn't needed under the old split-resource design)**

```bash
ssh hostinger-vps "docker exec <db-container-name> psql -U supabase_admin -c 'SELECT 1;'"
```

Expected: returns `1`. This directly confirms `db` itself is healthy and accepting connections, independent of whatever Kong/PostgREST report — cheap and worth doing given Task 2/3's history with this specific image.

- [ ] **Step 7: Confirm each container's actual memory usage is within its cap under this light smoke-test load**

```bash
ssh hostinger-vps "docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}' | grep -i 'kong\|auth\|rest\|storage\|realtime\|functions\|^db\b\|_db_'"
```

Expected: every value well under its configured cap (3g for `db`, 512m/256m/256m/512m/768m/768m for the rest).

---

### Task 6: VPS-wide safety verification and rollback documentation

**Files:**
- Modify: `deploy/selfhosted-supabase/README.md` (add the rollback section).

**Interfaces:** none — this is verification and documentation only.

- [ ] **Step 1: Full VPS health re-check (same battery used throughout the investigation)**

```bash
ssh hostinger-vps "free -h; echo '---'; dmesg | grep -i 'out of memory' | tail -5; echo '---'; docker ps --format '{{.Names}}' | wc -l"
```

Expected: no new OOM entries beyond the known 2026-08-15 incident, free/available memory not meaningfully worse than the pre-deployment baseline (966MB free / 6.15GB available), container count now 7 higher than the actual pre-deployment baseline of **71** (confirmed via `docker ps -a --format '{{.Names}}' | wc -l` — after the `logicprodev`/`supabase-gateway` cleanup, and after Task 2's original blocked attempt was fully cleaned up) — so expect **78** total: 71 + 7 (all one Coolify Compose service now, not split across a database resource + a separate service).

**Corrected post-execution (2026-08-22, final whole-plan review):** the
verified stable actual count is **77 total / 76 running**, not 78. The
71-baseline used above had itself already been corrected once during an
earlier audit pass (from an original 88); it reconciles as 70 non-stack
containers (not 71) + this stack's 7 = 77 total, with one of the 7
(`functions`) perpetually restarting rather than running, hence 76 running.
Treat 77/76 as the figure to check against on any future re-run, not 78.

- [ ] **Step 2: Re-run all four production health-check curls one final time**

```bash
curl -s -o /dev/null -m 8 -w "frontend -> %{http_code}\n" https://app.sosservices.online/
curl -s -o /dev/null -m 8 -w "crm-api -> %{http_code}\n" https://api.sosservices.online/health
curl -s -o /dev/null -m 8 -w "amro-api -> %{http_code}\n" https://amro.sosservices.online/health
curl -s -o /dev/null -m 8 -w "aviation -> %{http_code}\n" https://app.aviation.sosservices.online/
```

Expected: all `200`.

- [ ] **Step 3: Document and dry-run the rollback path**

Append to `deploy/selfhosted-supabase/README.md`:

```markdown
## Rollback

If this stack needs to be torn down (resource pressure, or Phase 1 is abandoned):

1. Stop the service: `curl -X POST "http://72.61.249.111:8000/api/v1/services/$SVC_UUID/stop" -H "Authorization: Bearer $COOLIFY_API_TOKEN"`, then delete it: `curl -X DELETE "http://72.61.249.111:8000/api/v1/services/$SVC_UUID" -H "Authorization: Bearer $COOLIFY_API_TOKEN"`.
2. This removes all 7 containers (including `db`) in one action, since they're all one Coolify Compose service — simpler than the original two-resource design.
3. Re-run the four production health-check curls to confirm zero impact (same as every other step in this plan).

Nothing in this stack is referenced by any production app's env vars, so this teardown is safe at any time during Phase 1.
```

- [ ] **Step 4: Commit**

```bash
git add deploy/selfhosted-supabase/README.md
git commit -m "docs(selfhost-supabase): document Phase 1 rollback path"
```

---

## Plan Self-Review

**Spec coverage (post-revision numbering):** §3 Architecture (all 7 components, all one compose service) → Tasks 1, 2, 3. §4 Memory limits → Global Constraints + every task's `mem_limit` values, including `db`'s 3g in Task 2. §5 Domain/networking → all 7 services on `coolify` network (Task 1 for the six, Task 2 for `db`), domain in Task 3 Step 5. §6 Verification plan → Tasks 4, 5, 6 map to the spec's 5 verification items, plus Task 5's new direct-Postgres check. §7 Open items → Postgres image tag resolved (confirmed `17.4.1.037` during the original Task 2 attempt); domain name used as given (`supabase.sosservices.online`) per the spec's stated default.

**Placeholder scan:** Task 3 Step 3's Coolify API shape has an explicit UI fallback if the guessed endpoint is wrong — Coolify's service-creation API is the least-verified endpoint in this plan; the analogous database-creation endpoint needed a live fix (POST not GET for `/start`) during the original Task 2 attempt, so the same trial-and-adapt approach is called out explicitly here rather than assumed to work first-try.

**Type/name consistency:** compose service names (`kong`, `auth`, `rest`, `storage`, `realtime`, `functions`, and now `db`) are defined in Tasks 1-2 and referenced identically in Task 3 (env var injection, domain routing) and Tasks 4-5 (extension checks, health-check paths) — verified consistent.

**Second audit pass (2026-08-22, requested by user):** re-checked this plan against live evidence rather than re-reading it for tone. Found and fixed three real issues:
1. **Network architecture bug:** the original Task 1 (and spec §5) put the app-layer services on an isolated network separate from `coolify`. Re-verified directly (`docker inspect y85hpjdrs9wlotcgqcbw8gdg`) that Coolify-native Database resources live on the shared `coolify` network — as originally written, `auth`/`rest`/`storage`/`realtime`/`functions` would never have been able to reach Postgres by container name. Fixed in both the spec and Task 1: all 7 containers now join `coolify`; the actual protection against the other 24 apps is the memory limits, not network topology.
2. **Kong auth-templating gap:** Task 1 said to copy `kong.yml` and note each service's env vars, but didn't call out that upstream's `kong.yml` placeholders (`$SUPABASE_ANON_KEY` etc.) only resolve because the upstream `kong` service has a custom entrypoint doing variable substitution — omitting that would have caused silent, hard-to-diagnose auth failures on every request through Kong. Fixed in Task 1 with an explicit instruction and failure-mode warning.
3. **Stale container-count baseline in Task 6:** used the pre-cleanup figure (88) instead of the actual current baseline. Re-verified live (`docker ps -a | wc -l` = 71) and corrected the expected post-deployment count to 78.

Also flagged (not a bug, a known limitation): Realtime needs tenant registration for full functionality beyond a bare WebSocket handshake — Task 5's check only validates the handshake, noted explicitly in Task 1 so this isn't mistaken for "fully working" later.

**Third revision (2026-08-22, discovered during Task 2 execution, not an audit pass — a real BLOCKED report):** Task 1 completed and passed review cleanly. Task 2 (original: provision Postgres as a Coolify-native Database resource) came back BLOCKED: `supabase/postgres`'s entrypoint unconditionally requires a bind-mounted `99-roles.sql` on every startup, which Coolify's generic Database resource type cannot supply — confirmed by the implementer reading the image's own `docker-entrypoint.sh` and by contrast with the working `avaipro-pg` precedent (plain `postgres:17`, a different image that doesn't need this). This is a genuine plan defect, not a retry-able mistake — escalated to the user per this skill's BLOCKED-handling guidance rather than guessed through. User chose: fold Postgres into the compose stack as a `db` service. Both the spec and this plan were revised accordingly (old Task 2 dropped entirely; Tasks 3-6 renumbered/adjusted — see the "Revised" notes at the top of this document and in the spec). The dead-end Coolify Database resource from the blocked attempt was deleted and confirmed gone before continuing.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-22-supabase-selfhost-phase1.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?