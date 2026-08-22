# Self-Hosted Supabase Phase 1 (Lean Stack on Shared VPS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a memory-capped, self-hosted Supabase-equivalent stack (Postgres 17 + Kong + GoTrue + PostgREST + Storage API + Realtime + Edge Runtime) on the existing shared Hostinger/Coolify VPS, deployed through Coolify, serving zero production traffic, with every container hard-capped so it cannot starve the other 24 apps already on that box.

**Architecture:** Postgres is a Coolify-native "Database" resource (matching the aviation-ai-pro precedent, `avaipro-pg`) rather than a raw docker-compose Postgres. The other six services are a single Coolify "Service" deployed from a docker-compose file tracked in this repo (`deploy/selfhosted-supabase/`), on their own isolated Docker network, fronted by Kong on a new subdomain. No repo application code changes — this is infrastructure-only.

**Tech Stack:** Coolify v4 (REST API + Traefik), Docker/docker-compose, `supabase/postgres:17`, `kong`, `supabase/gotrue`, `postgrest/postgrest`, `supabase/storage-api`, `supabase/realtime`, `supabase/edge-runtime`.

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
- Add a top-level `networks:` block defining one bridge network (e.g. `selfhost-net`) and put all six services on it — do not attach any service to the shared `coolify` network directly in this file (Coolify's own deployment step in Task 4 handles the Traefik-facing network separately).
- Storage service: set its backend to local disk (e.g. `STORAGE_BACKEND=file`, `FILE_STORAGE_BACKEND_PATH=/var/lib/storage`), not S3/MinIO, per the spec's "skip MinIO" decision. Mount a named volume for that path.
- Remove any `depends_on: db` entries (no local `db` service exists in this file).

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

### Task 2: Provision the Coolify-native Postgres Database resource

**Files:** none (Coolify-managed resource, no repo files) — this task's output is a live Coolify resource whose UUID subsequent tasks depend on.

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: a running Postgres reachable at an internal host:port that Task 4 will inject into the compose stack's `.env` as `POSTGRES_HOST`/`POSTGRES_PORT`.

- [ ] **Step 1: Create the database via the Coolify API**

```bash
export COOLIFY_API_TOKEN=$(grep '^COOLIFY_API_TOKEN=' env | cut -d'"' -f2)
curl -sS -X POST "http://72.61.249.111:8000/api/v1/databases/postgresql" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_uuid": "gkwk84gocoo44wkkcsscs0k8",
    "environment_uuid": "ko4o00k400ccgo44kk40s8gw",
    "server_uuid": "ewwc8w4oc4cs0w08g4goc0go",
    "name": "logicnexus-selfhost-pg",
    "description": "Phase 1 self-hosted Supabase Postgres for logic-nexus-ai (see docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md). No production traffic.",
    "image": "supabase/postgres:17.4.1.037",
    "postgres_db": "postgres",
    "postgres_user": "postgres",
    "is_public": false,
    "limits_memory": "3g",
    "limits_memory_swap": "3g"
  }'
```

Expected: HTTP 200/201 with a JSON body containing a `uuid` field. **Save this UUID** — every later step references it as `$PG_DB_UUID`.

- [ ] **Step 2: If the exact image tag in Step 1 doesn't exist, find the current one and retry**

```bash
curl -s -m 10 "https://hub.docker.com/v2/repositories/supabase/postgres/tags?page_size=5&ordering=last_updated" | node -e '
let data=""; process.stdin.on("data",d=>data+=d); process.stdin.on("end",()=>{
  JSON.parse(data).results.forEach(t=>console.log(t.name));
});'
```

Expected: a list of current tags. Pick the most recent `17.x.x.xxx`-style tag, redo Step 1 with that value if the first attempt 404'd.

- [ ] **Step 3: Start the database**

```bash
export PG_DB_UUID="<uuid from Step 1>"
curl -sS -X GET "http://72.61.249.111:8000/api/v1/databases/$PG_DB_UUID/start" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

Expected: HTTP 200.

- [ ] **Step 4: Verify it's running and capture the internal connection details**

```bash
curl -sS "http://72.61.249.111:8000/api/v1/databases/$PG_DB_UUID" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" | node -e '
let data=""; process.stdin.on("data",d=>data+=d); process.stdin.on("end",()=>{
  const d = JSON.parse(data);
  console.log("status:", d.status);
  console.log("limits_memory:", d.limits_memory);
  console.log("internal name (use as POSTGRES_HOST):", d.uuid);
});'
```

Expected: `status` is `running:healthy` (may need to re-run after ~15s if still `running:unhealthy` right after start), `limits_memory` is `3g` (confirms the cap actually took — if it shows `0`, Step 1's payload field name was wrong and must be fixed before proceeding). The database's internal Docker network hostname is its container name — confirm the actual container name via `ssh hostinger-vps "docker ps --filter name=$PG_DB_UUID --format '{{.Names}}'"` and use that as `POSTGRES_HOST` in Task 4.

- [ ] **Step 5: Re-verify the other 24 apps are unaffected (Global Constraints check)**

Run the four health-check curls from Global Constraints. All must return `200`.

---

### Task 3: Verify and enable the required Postgres extensions

**Files:** none.

**Interfaces:**
- Consumes: `$PG_DB_UUID` and its container name from Task 2.
- Produces: confirmation that `vector`, `postgis`, `pgroonga`, `pg_cron`, `pgjwt`, `pgsodium`, `pg_net`, `pg_graphql` are installed — Task 4's services assume these exist (GoTrue/Storage don't need them directly, but this is the same Postgres later phases will replicate real production data into, and production uses all of these).

- [ ] **Step 1: Check which extensions are already available in the image**

```bash
ssh hostinger-vps "docker exec <pg-container-name-from-task2-step4> psql -U postgres -c \"SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name IN ('vector','postgis','pgroonga','pg_cron','pgjwt','pgsodium','pg_net','pg_graphql') ORDER BY name;\""
```

Expected: all 8 rows present with a non-null `default_version`. If any are missing, `supabase/postgres` doesn't bundle it — stop and report back rather than guessing a fix (this would mean the spec's image choice needs revisiting).

- [ ] **Step 2: Enable each extension that isn't already installed**

```bash
ssh hostinger-vps "docker exec <pg-container-name> psql -U postgres -c \"
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

Expected: no errors. `pg_cron` may require `shared_preload_libraries=pg_cron` in `postgresql.conf` to actually activate (the `CREATE EXTENSION` can succeed but the background worker won't start without it) — the `supabase/postgres` image sets this by default; if `pg_cron` jobs don't run later, check `SHOW shared_preload_libraries;` first before assuming a config problem elsewhere.

- [ ] **Step 3: Verify all 8 are now installed**

```bash
ssh hostinger-vps "docker exec <pg-container-name> psql -U postgres -c \"SELECT extname FROM pg_extension WHERE extname IN ('vector','postgis','pgroonga','pg_cron','pgjwt','pgsodium','pg_net','pg_graphql') ORDER BY extname;\""
```

Expected: exactly 8 rows returned.

- [ ] **Step 4: Re-verify the other 24 apps are unaffected**

Run the four health-check curls from Global Constraints. All must return `200`.

---

### Task 4: Deploy the app-layer stack (Kong, Auth, REST, Storage, Realtime, Edge Runtime) via Coolify

**Files:**
- Modify: none in the repo (Coolify pulls `deploy/selfhosted-supabase/docker-compose.yml` from Task 1 directly from the `main` branch when deploying a Git-based compose service).

**Interfaces:**
- Consumes: `deploy/selfhosted-supabase/docker-compose.yml` and `.env.example` from Task 1; `POSTGRES_HOST`/`POSTGRES_PORT`/`POSTGRES_PASSWORD` from Task 2.
- Produces: a running Coolify service (`logicnexus-selfhost-supabase`) with Kong reachable at the domain chosen in the spec's Open Items (`supabase.sosservices.online`, unless changed) — Task 5's checks hit this domain.

- [ ] **Step 1: Generate real secrets for `.env` (not the placeholders from `.env.example`)**

```bash
export JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
export POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '\n' | tr '/+' '_-')
```

Note: per the spec (§2 Non-Goals), these are freshly generated, **not** aligned with Supabase Cloud's actual JWT secret — that alignment is Phase 5's job, out of scope here. Save both values somewhere durable (e.g. a local password manager entry) — they're needed again in Task 5 to mint a test JWT, and by Phase 5 later.

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

- [ ] **Step 3: Update the Postgres database's password to match Step 1's generated value**

```bash
ssh hostinger-vps "docker exec <pg-container-name> psql -U postgres -c \"ALTER USER postgres WITH PASSWORD '$POSTGRES_PASSWORD';\""
```

- [ ] **Step 4: Create the Coolify service from the repo's compose file**

```bash
curl -sS -X POST "http://72.61.249.111:8000/api/v1/services" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_uuid": "gkwk84gocoo44wkkcsscs0k8",
    "environment_uuid": "ko4o00k400ccgo44kk40s8gw",
    "server_uuid": "ewwc8w4oc4cs0w08g4goc0go",
    "type": "docker-compose",
    "name": "logicnexus-selfhost-supabase",
    "description": "Phase 1 self-hosted Supabase app layer (Kong/Auth/REST/Storage/Realtime/Edge Runtime). See docs/superpowers/specs/2026-08-22-supabase-selfhost-phase1-design.md.",
    "git_repository": "https://github.com/vageesha-vaishya/logic-nexus-ai.git",
    "git_branch": "main",
    "docker_compose_location": "/deploy/selfhosted-supabase/docker-compose.yml"
  }'
```

Expected: HTTP 200/201 with a `uuid` field — save as `$SVC_UUID`. If this specific request shape 404s or errors (Coolify's exact endpoint/payload for a Git-sourced compose service has shifted between versions before), fall back to creating the service through the Coolify UI at `http://72.61.249.111:8000` instead (New Resource → Docker Compose → point at this repo/branch/path) and note in this file which method actually worked, for future reference.

- [ ] **Step 5: Set the service's environment variables**

```bash
for kv in "POSTGRES_HOST=<pg-container-name-from-task2>" "POSTGRES_PORT=5432" "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" "JWT_SECRET=$JWT_SECRET" "ANON_KEY=<from step 2>" "SERVICE_ROLE_KEY=<from step 2>" "SITE_URL=https://supabase.sosservices.online"; do
  key="${kv%%=*}"; value="${kv#*=}"
  curl -sS -X POST "http://72.61.249.111:8000/api/v1/services/$SVC_UUID/envs" \
    -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"key\": \"$key\", \"value\": \"$value\", \"is_build_time\": false}"
done
```

Expected: HTTP 200/201 for each call.

- [ ] **Step 6: Set the domain on the `kong` sub-resource within this service and deploy**

Via the Coolify UI (this is the most reliable path for setting a per-container domain within a compose service — the API shape for this varies more than top-level resource creation): open the service, find the `kong` container's settings, set its domain to `supabase.sosservices.online` (or whatever was confirmed for the spec's Open Item), enable HTTPS. Then trigger deploy:

```bash
curl -sS -X GET "http://72.61.249.111:8000/api/v1/services/$SVC_UUID/start" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

- [ ] **Step 7: Confirm all 6 containers are running**

```bash
ssh hostinger-vps "docker ps --filter 'label=com.docker.compose.project' --format '{{.Names}}\t{{.Status}}' | grep -i 'kong\|auth\|rest\|storage\|realtime\|functions'"
```

Expected: 6 lines, all `Up ...`.

- [ ] **Step 8: Re-verify the other 24 apps are unaffected**

Run the four health-check curls from Global Constraints. All must return `200`.

---

### Task 5: Smoke-test the stack end-to-end through Kong

**Files:** none.

**Interfaces:**
- Consumes: `$ANON_KEY` from Task 4 Step 2, the domain from Task 4 Step 6.

- [ ] **Step 1: GoTrue health through Kong**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.sosservices.online/auth/v1/health -H "apikey: $ANON_KEY"
```

Expected: `200`.

- [ ] **Step 2: PostgREST root through Kong**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.sosservices.online/rest/v1/ -H "apikey: $ANON_KEY"
```

Expected: `200`.

- [ ] **Step 3: Storage API status through Kong**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.sosservices.online/storage/v1/status -H "apikey: $ANON_KEY"
```

Expected: `200`.

- [ ] **Step 4: Realtime through Kong (WebSocket upgrade check)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Connection: Upgrade" -H "Upgrade: websocket" -H "apikey: $ANON_KEY" https://supabase.sosservices.online/realtime/v1/
```

Expected: `101` (or `426` if the upgrade headers aren't perfectly formed by curl — either indicates the Realtime container itself responded, which is what this step is checking; a `502`/`503`/`000` means it's not reachable and needs investigation).

- [ ] **Step 5: Edge Runtime through Kong**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://supabase.sosservices.online/functions/v1/ -H "apikey: $ANON_KEY"
```

Expected: `404` is acceptable here (no functions deployed yet — that's Phase 4) as long as it's not `502`/`503`/`000`, which would mean the Edge Runtime container itself isn't reachable through Kong.

- [ ] **Step 6: Confirm each container's actual memory usage is within its cap under this light smoke-test load**

```bash
ssh hostinger-vps "docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}' | grep -i 'kong\|auth\|rest\|storage\|realtime\|functions'"
```

Expected: every value well under its configured cap (512m/256m/256m/512m/768m/768m).

---

### Task 6: VPS-wide safety verification and rollback documentation

**Files:**
- Modify: `deploy/selfhosted-supabase/README.md` (add the rollback section).

**Interfaces:** none — this is verification and documentation only.

- [ ] **Step 1: Full VPS health re-check (same battery used throughout the investigation)**

```bash
ssh hostinger-vps "free -h; echo '---'; dmesg | grep -i 'out of memory' | tail -5; echo '---'; docker ps --format '{{.Names}}' | wc -l"
```

Expected: no new OOM entries beyond the known 2026-08-15 incident, free/available memory not meaningfully worse than the pre-deployment baseline (966MB free / 6.15GB available), container count now ~7 higher than the pre-deployment count (94 vs 88 — the ~13 orphaned containers were removed earlier, plus the new 7: 1 database + 6 app-layer).

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

1. Stop the app-layer service: `curl -X GET "http://72.61.249.111:8000/api/v1/services/$SVC_UUID/stop" -H "Authorization: Bearer $COOLIFY_API_TOKEN"`, then delete it: `curl -X DELETE "http://72.61.249.111:8000/api/v1/services/$SVC_UUID" -H "Authorization: Bearer $COOLIFY_API_TOKEN"`.
2. Stop and delete the database: `curl -X DELETE "http://72.61.249.111:8000/api/v1/databases/$PG_DB_UUID" -H "Authorization: Bearer $COOLIFY_API_TOKEN"`.
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

**Spec coverage:** §3 Architecture (all 7 components) → Tasks 1, 2, 4. §4 Memory limits → Global Constraints + every task's mem_limit/limits_memory values. §5 Domain/networking → Task 1 Step 4 (isolated network), Task 4 Step 6 (domain). §6 Verification plan → Tasks 3, 5, 6 map 1:1 to the spec's 5 verification items. §7 Open items → Task 2 Step 1/2 handles the image tag by checking live rather than guessing; the domain name is used as given (`supabase.sosservices.online`) per the spec's stated default — flag to the user if they wanted a different one before Task 4 Step 6.

**Placeholder scan:** Task 2 Step 1's `image` tag is a best-guess string with an explicit fallback verification+retry step (Step 2) rather than a bare TBD — acceptable per the "No Placeholders" rule since it's a concrete, verifiable, self-correcting action. Task 4 Step 4's Coolify API shape has an explicit UI fallback if the guessed endpoint is wrong, for the same reason — Coolify's service-creation API is the least-verified endpoint in this plan (I confirmed `/api/v1/databases/postgresql` create-shape indirectly via the existing `avaipro-pg` resource's GET schema, but did not find and test the exact `/api/v1/services` POST payload before writing this plan).

**Type/name consistency:** compose service names (`kong`, `auth`, `rest`, `storage`, `realtime`, `functions`) are defined in Task 1 and referenced identically in Task 4 (env var injection, domain routing) and Task 5 (health-check paths) — verified consistent.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-22-supabase-selfhost-phase1.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?