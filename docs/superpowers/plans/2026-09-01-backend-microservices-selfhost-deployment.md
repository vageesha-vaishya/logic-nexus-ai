# Backend Microservices Self-Host Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the 7 backend microservices (`crm-api`, `sales-api`, `uim-api`, `finance-api`, `logistics-api`, `compliance-api`, `comms-api`) to the self-hosted Coolify VPS, each as its own Coolify application mirroring the already-working `amro-api` deployment, and wire up production `nginx.conf` routing so the frontend can reach all of them.

**Architecture:** Each service is its own Coolify "application" resource, built from its own Dockerfile with `services/<name>` as the build context, deployed as its own container attached to the shared `coolify` Docker network — the same pattern already proven for `amro-api`. `nginx.conf` gets new `location` blocks proxying specific path prefixes to each service's container.

**Tech Stack:** Node.js/Express (TypeScript, compiled via `tsc`), Docker, Coolify's REST API, nginx, Traefik (already running, no changes needed to it in this plan).

**Spec:** `docs/superpowers/specs/2026-09-01-backend-microservices-selfhost-deployment-design.md` — read the Routing section there directly for the full path-prefix table; it is not repeated in full here except where a task needs the exact values.

## Global Constraints

- **Never print secrets to a command line or into a chat/tool-output transcript.** The Coolify API token lives in the repo-root gitignored `env` file as `COOLIFY_API_TOKEN`/`COOLIFY_API_URL`. Every task that calls the Coolify API must use this exact pattern (used successfully many times already this session):
  1. `grep -E '^COOLIFY_API_(URL|TOKEN)=' env > <local-scratch-path>/.coolify_env`
  2. `scp <local-scratch-path>/.coolify_env hostinger-vps:/tmp/.coolify_env`
  3. `rm -f <local-scratch-path>/.coolify_env` (delete the local copy immediately)
  4. `ssh hostinger-vps 'chmod 600 /tmp/.coolify_env; set -a; source /tmp/.coolify_env; set +a; <the actual curl command using ${COOLIFY_API_URL} and ${COOLIFY_API_TOKEN}>; rm -f /tmp/.coolify_env'`
  Never `cat`/`grep -A`/echo the token's value anywhere; never pass it as a literal `-H "Authorization: Bearer <value>"` string typed directly into a command.
- The same secret-handling rule applies to the self-hosted `SUPABASE_SERVICE_ROLE_KEY` if any step needs it (e.g. to test an authenticated endpoint) — read it from the live `auth` container's own environment on the VPS (`docker exec auth-i64jlyerora7ao9vkw5sweh3-054239010699 sh -c 'echo SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY' > /tmp/.sb_env2 && chmod 600 /tmp/.sb_env2'`, redirecting on the **host** side, not inside `docker exec`), never the local `env` file (its `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_URL` are stale, pre-rotation, and point at production Cloud, not self-hosted — confirmed the hard way this session).
- If a redeploy of the frontend app (`b2lt2if6x6ovekc4tj7vg8tx`) is needed in Task 9, remember: **this Coolify app is pinned to a specific `git_commit_sha`, not tracking `main`'s HEAD.** Triggering a deploy without first `PATCH`ing `git_commit_sha` to the new commit will silently rebuild the *old* pinned commit — discovered and fixed the hard way earlier this session. Always `git rev-parse main` locally, `PATCH /api/v1/applications/b2lt2if6x6ovekc4tj7vg8tx` with the full 40-char SHA, *then* trigger deploy.
- Windows/git-bash mangles literal `/tmp/...`-style paths embedded in a `python3 -c "..."` argument string (established trap this session). Pass such paths via an environment variable read through `os.environ` instead of a literal path in the script text.
- If any task modifies shared repo code (it shouldn't — this plan only adds new files under `services/*` and edits `nginx.conf`), run `npm run typecheck` per this repo's `CLAUDE.md` before committing.
- Every Coolify application-creation/env/deploy API call in this plan targets the **self-hosted** VPS's Coolify instance (`${COOLIFY_API_URL}` from the `env` file) — never confuse this with the Supabase Cloud production project.

### Concrete reference values (verified this session, not guessed)

Pulled directly from the existing `amro-api` Coolify application (uuid `c7dfnatpn9gaq4g0hjweubeu`) via `GET /api/v1/applications/c7dfnatpn9gaq4g0hjweubeu`, which is the proven-working reference for every value below:

| Field | Value |
|---|---|
| `git_repository` | `git@github.com:vageesha-vaishya/logic-nexus-ai.git` |
| `git_branch` | `main` |
| `build_pack` | `dockerfile` |
| `server_uuid` | `ewwc8w4oc4cs0w08g4goc0go` (server name: `localhost`) |
| `project_uuid` | `gkwk84gocoo44wkkcsscs0k8` (project name: `logic-nexus-dev`) |
| `environment_name` | `production` |
| `private_key_uuid` | `qi9mdfieo33cacnxewq8npf7` (Coolify's stored key, description: "Deploy key for vageesha-vaishya/logic-nexus-ai") |
| Docker network | `coolify` (all new containers must land on this network to be reachable by nginx and Traefik) |

**Not yet confirmed this session**: the exact Coolify application-creation API endpoint and request body schema. Every other Coolify API call used tonight (`GET`/`PATCH` on applications, `PATCH`/`POST` on `/envs`, `POST` on `/deploy`) was against an *already-existing* resource — creating a brand-new application has not been tested yet. Task 2 (the first deploy task) must determine this concretely (see its Step 1) rather than any later task assuming it blind.

**Also not yet confirmed**: what exact, stable, network-resolvable container name Coolify will assign each new application (the running `amro-api` container is unusually named `amro-api-container` via an internally-generated docker-compose service definition, not the `<uuid>-<timestamp>` pattern seen on the frontend app — the naming convention that produced this is not fully understood). Do **not** assume a new app named "crm-api" will automatically produce a container reachable at `crm-api-container`. Each deploy task's last step confirms and records the actual name; Task 9 (nginx) consumes those recorded names, not an assumed pattern.

---

### Task 1: Write the 3 missing Dockerfiles (crm-api, sales-api, uim-api)

**Files:**
- Create: `services/crm-api/Dockerfile`
- Create: `services/crm-api/.dockerignore`
- Create: `services/sales-api/Dockerfile`
- Create: `services/sales-api/.dockerignore`
- Create: `services/uim-api/Dockerfile`
- Create: `services/uim-api/.dockerignore`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: 3 working Dockerfiles that Tasks 2–4 (uim-api, crm-api, sales-api deploys) build from. Each service's own listen port is baked into its `EXPOSE`/`HEALTHCHECK` lines: crm-api → 3011, sales-api → 3201, uim-api → 3701 (matching the port table in the spec's Architecture section — confirmed against each service's own `src/index.ts` default this session).

All 3 Dockerfiles use the exact same template as the 4 already-existing ones (`services/finance-api/Dockerfile`, confirmed identical in `logistics-api`/`compliance-api`/`comms-api` too), adjusted only for the port number. All 3 services already have a matching `tsconfig.json` and a `"build": "tsc"` script producing `dist/index.js` (confirmed this session) — no build-step changes needed beyond the Dockerfile itself.

- [ ] **Step 1: Write `services/crm-api/Dockerfile`**

```dockerfile
FROM node:22-bullseye-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --progress=false

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bullseye-slim

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --progress=false \
 && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3011

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent --show-error http://localhost:3011/health > /dev/null || exit 1

USER node

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Write `services/crm-api/.dockerignore`**

```
node_modules
dist
npm-debug.log
.env
.env.*
*.log
.git
.gitignore
README.md
```

- [ ] **Step 3: Write `services/sales-api/Dockerfile`** (identical shape, port 3201)

```dockerfile
FROM node:22-bullseye-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --progress=false

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bullseye-slim

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --progress=false \
 && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3201

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent --show-error http://localhost:3201/health > /dev/null || exit 1

USER node

CMD ["node", "dist/index.js"]
```

- [ ] **Step 4: Write `services/sales-api/.dockerignore`** (identical content to Step 2)

- [ ] **Step 5: Write `services/uim-api/Dockerfile`** (identical shape, port 3701)

```dockerfile
FROM node:22-bullseye-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --progress=false

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bullseye-slim

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --progress=false \
 && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3701

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD curl --fail --silent --show-error http://localhost:3701/health > /dev/null || exit 1

USER node

CMD ["node", "dist/index.js"]
```

- [ ] **Step 6: Write `services/uim-api/.dockerignore`** (identical content to Step 2)

- [ ] **Step 7: Verify each builds locally**

Run for each of the 3 (adjust path):
```bash
docker build -t crm-api-test services/crm-api
docker build -t sales-api-test services/sales-api
docker build -t uim-api-test services/uim-api
```
Expected: all 3 succeed with no errors. If `npm ci` fails on a lockfile mismatch, do not edit `package-lock.json` as part of this task — stop and report it (that would be a pre-existing repo issue, out of scope here).

- [ ] **Step 8: Commit**

```bash
git add services/crm-api/Dockerfile services/crm-api/.dockerignore \
        services/sales-api/Dockerfile services/sales-api/.dockerignore \
        services/uim-api/Dockerfile services/uim-api/.dockerignore
git commit -m "feat(services): add Dockerfiles for crm-api, sales-api, uim-api

Mirrors the existing finance-api/logistics-api/compliance-api/comms-api
Dockerfile template (node:22-bullseye-slim multi-stage build, HEALTHCHECK
on /health, non-root user), adjusted per-service only for the listen port."
```

---

### Task 2: Deploy uim-api to the self-hosted VPS

**Files:** none (infrastructure-only task; no repo changes).

**Interfaces:**
- Consumes: `services/uim-api/Dockerfile` from Task 1.
- Produces: a running, healthy `uim-api` Coolify application. Record and report forward to Task 9: (a) the app's Coolify `uuid`, (b) the container's actual resolvable name on the `coolify` network (confirmed via `docker ps`/`docker inspect`, **not** assumed to be `uim-api-container`).

This is the pathfinder task — it establishes the exact Coolify application-creation call for every later deploy task (Tasks 3–8) to reuse verbatim (with only per-service values changed). Do this one first and get it fully right before repeating the pattern.

- [ ] **Step 1: Determine the exact Coolify application-creation endpoint**

The reference app (`amro-api`) uses `build_pack: dockerfile` with an SSH (`git@github.com:...`) repository and a stored Coolify private key (`private_key_uuid: qi9mdfieo33cacnxewq8npf7`) — this combination in Coolify's API is created via `POST {COOLIFY_API_URL}/api/v1/applications/private-deploy-key`. Using the secret-handling pattern from Global Constraints, attempt:

```bash
ssh hostinger-vps 'chmod 600 /tmp/.coolify_env; set -a; source /tmp/.coolify_env; set +a; curl -s -w "\nHTTP:%{http_code}\n" -X POST "${COOLIFY_API_URL}/api/v1/applications/private-deploy-key" -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" -H "Content-Type: application/json" -d "{
  \"project_uuid\": \"gkwk84gocoo44wkkcsscs0k8\",
  \"server_uuid\": \"ewwc8w4oc4cs0w08g4goc0go\",
  \"environment_name\": \"production\",
  \"private_key_uuid\": \"qi9mdfieo33cacnxewq8npf7\",
  \"git_repository\": \"git@github.com:vageesha-vaishya/logic-nexus-ai.git\",
  \"git_branch\": \"main\",
  \"build_pack\": \"dockerfile\",
  \"base_directory\": \"/services/uim-api\",
  \"ports_exposes\": \"3701\",
  \"name\": \"uim-api\"
}" > /tmp/create_resp.json; cat /tmp/create_resp.json; rm -f /tmp/.coolify_env'
```

If this returns a 2xx with a `uuid` field, that confirms the endpoint and schema — reuse this exact shape for Tasks 3–8. If it returns a 4xx, read the error body (Coolify's validation errors are descriptive — e.g. naming a missing/wrong-typed required field) and adjust the payload accordingly; do not guess blindly past 2 failed attempts — if still failing, check `{COOLIFY_API_URL}/api/v1/applications` (`GET`, no body) to see if any application was partially created and needs cleanup before retrying, and check Coolify's own web UI (if reachable) for an application-creation form as a fallback reference for the correct field names.

Record the returned `uuid` — this is the app's identity for every subsequent step.

- [ ] **Step 2: Set the required env vars**

For each of the following, `POST {COOLIFY_API_URL}/api/v1/applications/<uuid>/envs` (per-key, matching the pattern used successfully for `AMRO_API_UPSTREAM` earlier this session):
- `SUPABASE_URL` = `https://supabase.sosservices.online`
- `SUPABASE_SERVICE_ROLE_KEY` = (the current self-hosted key — read from the `auth` container's own environment per Global Constraints, never the local `env` file)
- `SUPABASE_SERVICE_KEY` = same value as `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGIN` = `https://app.sosservices.online`
- `NODE_ENV` = `production`
- `UIM_API_PORT` = `3701`

- [ ] **Step 3: Trigger deploy and poll to completion**

```bash
ssh hostinger-vps 'chmod 600 /tmp/.coolify_env; set -a; source /tmp/.coolify_env; set +a; curl -s -X POST "${COOLIFY_API_URL}/api/v1/deploy?uuid=<uuid>" -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"; rm -f /tmp/.coolify_env'
```
Poll `GET /api/v1/deployments/<deployment_uuid>` (returned by the above call) every ~15s until `status` is `finished` (or `failed` — if failed, read the deployment logs via Coolify's API/UI before retrying).

- [ ] **Step 4: Confirm the container and find its real name**

```bash
ssh hostinger-vps "docker ps --filter 'label=coolify.applicationId' --format '{{.Names}}\t{{.Status}}\t{{.Labels}}' | grep -i uim"
```
Confirm `Status` shows healthy (Docker `HEALTHCHECK` passing, matching the `HEALTHCHECK` baked into the Dockerfile from Task 1). Record the exact `{{.Names}}` value — this is what Task 9's nginx `proxy_pass` will target.

- [ ] **Step 5: Verify health from inside the container**

```bash
ssh hostinger-vps "docker exec <confirmed-container-name> curl -f localhost:3701/health"
```
Expected: a 200/JSON health response, not a hang or connection error.

- [ ] **Step 6: Report forward**

In this task's completion report, state explicitly: the app's Coolify `uuid`, the confirmed container name from Step 4, and confirmation Step 5 passed. Task 9 needs these values verbatim.

---

### Task 3: Deploy crm-api to the self-hosted VPS

> **SUPERSEDED (final whole-branch review, 2026-09-01):** `crm-api` was
> discovered already deployed, running, and healthy on this VPS
> (`bcbbeslsh2h71pl69zw5q0gg`, container `bcbbeslsh2h71pl69zw5q0gg-083159351627`)
> mid-execution, during this task. Nothing below was performed — no new
> application was created, no env vars set, no deploy triggered. See the
> ledger (`.superpowers/sdd/2026-09-01-backend-microservices-selfhost-deployment/progress.md`)
> for the discovery writeup. Task text preserved below for the record.

**Files:** none (infrastructure-only task).

**Interfaces:**
- Consumes: `services/crm-api/Dockerfile` from Task 1; the confirmed Coolify application-creation endpoint/schema from Task 2 Step 1.
- Produces: a running, healthy `crm-api` Coolify application — its `uuid` and confirmed container name, for Task 9.

Repeat Task 2's Steps 1–6 exactly, substituting:
- `base_directory`: `/services/crm-api`
- `ports_exposes`: `3011`
- `name`: `crm-api`
- Port env var: `PORT` = `3011` (crm-api reads the generic `PORT` var, not a service-specific one — confirmed this session; do not set `CRM_API_PORT`, it reads `process.env.PORT`)
- Health check target: `localhost:3011/health`
- Container filter: `grep -i crm`

All other env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `CORS_ORIGIN`, `NODE_ENV`) identical to Task 2.

- [ ] **Step 1: Create the Coolify application** (payload as above, using the endpoint confirmed in Task 2 Step 1)
- [ ] **Step 2: Set env vars** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `CORS_ORIGIN`, `NODE_ENV`, `PORT=3011`)
- [ ] **Step 3: Trigger deploy and poll to completion**
- [ ] **Step 4: Confirm the container and find its real name** (`grep -i crm`)
- [ ] **Step 5: Verify health** (`docker exec <container> curl -f localhost:3011/health`)
- [ ] **Step 6: Report forward** (uuid + confirmed container name)

---

### Task 4: Deploy sales-api to the self-hosted VPS

**Files:** none (infrastructure-only task).

**Interfaces:**
- Consumes: `services/sales-api/Dockerfile` from Task 1; the confirmed creation endpoint/schema from Task 2 Step 1.
- Produces: a running, healthy `sales-api` Coolify application — its `uuid` and confirmed container name, for Task 9.

Substituting:
- `base_directory`: `/services/sales-api`
- `ports_exposes`: `3201`
- `name`: `sales-api`
- Port env var: `SALES_API_PORT` = `3201` (confirmed this session — sales-api does **not** read a generic `PORT`)
- Health check target: `localhost:3201/health`
- Container filter: `grep -i sales`

- [ ] **Step 1: Create the Coolify application**
- [ ] **Step 2: Set env vars** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `CORS_ORIGIN`, `NODE_ENV`, `SALES_API_PORT=3201`)
- [ ] **Step 3: Trigger deploy and poll to completion**
- [ ] **Step 4: Confirm the container and find its real name** (`grep -i sales`)
- [ ] **Step 5: Verify health** (`docker exec <container> curl -f localhost:3201/health`)
- [ ] **Step 6: Report forward** (uuid + confirmed container name)

---

### Task 5: Deploy finance-api to the self-hosted VPS

> **SUPERSEDED (final whole-branch review, 2026-09-01):** `finance-api` was
> discovered already deployed, running, and healthy on this VPS
> (`uzo1ozwjn0llussqi8fbjqb0`, container `uzo1ozwjn0llussqi8fbjqb0-082837933770`)
> mid-execution, during Task 3. Nothing below was performed. See the ledger
> (`.superpowers/sdd/2026-09-01-backend-microservices-selfhost-deployment/progress.md`)
> for the discovery writeup. Task text preserved below for the record.

**Files:** none (infrastructure-only task). Dockerfile already exists (`services/finance-api/Dockerfile`) — no Task-1 dependency for the Dockerfile itself, only for the confirmed creation endpoint from Task 2.

**Interfaces:**
- Consumes: existing `services/finance-api/Dockerfile`; confirmed creation endpoint/schema from Task 2 Step 1.
- Produces: a running, healthy `finance-api` Coolify application — its `uuid` and confirmed container name, for Task 9.

Substituting:
- `base_directory`: `/services/finance-api`
- `ports_exposes`: `3301`
- `name`: `finance-api`
- Port env var: `FINANCE_API_PORT` = `3301`
- Health check target: `localhost:3301/health`
- Container filter: `grep -i finance`

- [ ] **Step 1: Create the Coolify application**
- [ ] **Step 2: Set env vars** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `CORS_ORIGIN`, `NODE_ENV`, `FINANCE_API_PORT=3301`)
- [ ] **Step 3: Trigger deploy and poll to completion**
- [ ] **Step 4: Confirm the container and find its real name** (`grep -i finance`)
- [ ] **Step 5: Verify health** (`docker exec <container> curl -f localhost:3301/health`)
- [ ] **Step 6: Report forward** (uuid + confirmed container name)

---

### Task 6: Deploy logistics-api to the self-hosted VPS

> **SUPERSEDED (final whole-branch review, 2026-09-01):** `logistics-api` was
> discovered already deployed, running, and healthy on this VPS
> (`hdmsjbd6ulfq8t7j9zi4panw`, container `hdmsjbd6ulfq8t7j9zi4panw-082623660677`)
> mid-execution, during Task 3. Nothing below was performed. See the ledger
> (`.superpowers/sdd/2026-09-01-backend-microservices-selfhost-deployment/progress.md`)
> for the discovery writeup. Task text preserved below for the record.

**Files:** none (infrastructure-only task). Dockerfile already exists (`services/logistics-api/Dockerfile`).

**Interfaces:**
- Consumes: existing `services/logistics-api/Dockerfile`; confirmed creation endpoint/schema from Task 2 Step 1.
- Produces: a running, healthy `logistics-api` Coolify application — its `uuid` and confirmed container name, for Task 9.

Substituting:
- `base_directory`: `/services/logistics-api`
- `ports_exposes`: `3401`
- `name`: `logistics-api`
- Port env var: `LOGISTICS_API_PORT` = `3401`
- Health check target: `localhost:3401/health`
- Container filter: `grep -i logistics`

- [ ] **Step 1: Create the Coolify application**
- [ ] **Step 2: Set env vars** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `CORS_ORIGIN`, `NODE_ENV`, `LOGISTICS_API_PORT=3401`)
- [ ] **Step 3: Trigger deploy and poll to completion**
- [ ] **Step 4: Confirm the container and find its real name** (`grep -i logistics`)
- [ ] **Step 5: Verify health** (`docker exec <container> curl -f localhost:3401/health`)
- [ ] **Step 6: Report forward** (uuid + confirmed container name)

---

### Task 7: Deploy compliance-api to the self-hosted VPS

> **SUPERSEDED (final whole-branch review, 2026-09-01):** `compliance-api`
> was discovered already deployed, running, and healthy on this VPS
> (`x12lnwcgde45v27is4y6326t`, container `x12lnwcgde45v27is4y6326t-082623349600`)
> mid-execution, during Task 3. Nothing below was performed. See the ledger
> (`.superpowers/sdd/2026-09-01-backend-microservices-selfhost-deployment/progress.md`)
> for the discovery writeup. Task text preserved below for the record.

**Files:** none (infrastructure-only task). Dockerfile already exists (`services/compliance-api/Dockerfile`).

**Interfaces:**
- Consumes: existing `services/compliance-api/Dockerfile`; confirmed creation endpoint/schema from Task 2 Step 1.
- Produces: a running, healthy `compliance-api` Coolify application — its `uuid` and confirmed container name, for Task 9.

Substituting:
- `base_directory`: `/services/compliance-api`
- `ports_exposes`: `3501`
- `name`: `compliance-api`
- Port env var: `COMPLIANCE_API_PORT` = `3501`
- Health check target: `localhost:3501/health`
- Container filter: `grep -i compliance`

- [ ] **Step 1: Create the Coolify application**
- [ ] **Step 2: Set env vars** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `CORS_ORIGIN`, `NODE_ENV`, `COMPLIANCE_API_PORT=3501`)
- [ ] **Step 3: Trigger deploy and poll to completion**
- [ ] **Step 4: Confirm the container and find its real name** (`grep -i compliance`)
- [ ] **Step 5: Verify health** (`docker exec <container> curl -f localhost:3501/health`)
- [ ] **Step 6: Report forward** (uuid + confirmed container name)

---

### Task 8: Deploy comms-api to the self-hosted VPS

> **SUPERSEDED (final whole-branch review, 2026-09-01):** `comms-api` was
> discovered already deployed, running, and healthy on this VPS
> (`fcz1wje9cv7wlxe8iwj1lbzn`, container `fcz1wje9cv7wlxe8iwj1lbzn-082918708797`)
> mid-execution, during Task 3. Nothing below was performed. See the ledger
> (`.superpowers/sdd/2026-09-01-backend-microservices-selfhost-deployment/progress.md`)
> for the discovery writeup. Task text preserved below for the record.

**Files:** none (infrastructure-only task). Dockerfile already exists (`services/comms-api/Dockerfile`).

**Interfaces:**
- Consumes: existing `services/comms-api/Dockerfile`; confirmed creation endpoint/schema from Task 2 Step 1.
- Produces: a running, healthy `comms-api` Coolify application — its `uuid` and confirmed container name, for Task 9.

Substituting:
- `base_directory`: `/services/comms-api`
- `ports_exposes`: `3601`
- `name`: `comms-api`
- Port env var: `COMMS_API_PORT` = `3601`
- Health check target: `localhost:3601/health`
- Container filter: `grep -i comms`

Per the spec's Dependencies section, `comms-api` will boot and serve `/health` without `RESEND_API_KEY`/`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`FCM_SERVICE_ACCOUNT_JSON` — do **not** set these as part of this task (out of scope per spec); only routes that actually dispatch a message will fail, which is an accepted limitation, not a blocker for this task's health-check-based verification.

- [ ] **Step 1: Create the Coolify application**
- [ ] **Step 2: Set env vars** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`, `CORS_ORIGIN`, `NODE_ENV`, `COMMS_API_PORT=3601`)
- [ ] **Step 3: Trigger deploy and poll to completion**
- [ ] **Step 4: Confirm the container and find its real name** (`grep -i comms`)
- [ ] **Step 5: Verify health** (`docker exec <container> curl -f localhost:3601/health`)
- [ ] **Step 6: Report forward** (uuid + confirmed container name)

---

### Task 9: nginx routing, frontend redeploy, and full verification sweep

**Files:**
- Modify: `nginx.conf` (add new `location` blocks after the existing `/api/v2/amro/`, `/api/amro/`, `/api/markets/` blocks and before the `location /health` block)

**Interfaces:**
- Consumes: the 7 confirmed container names. **Plan revision, mid-execution**: Tasks 3, 5, 6, 7, 8 (deploy crm-api/finance-api/logistics-api/compliance-api/comms-api) turned out to be unnecessary — a broad Coolify applications-list check (not the original, flawed `docker ps` name-grep check) found all 5 already exist as healthy, correctly-configured production services from an earlier, unrelated deployment. Only `uim-api` (Task 2) and `sales-api` (Task 4) were actually newly deployed tonight. All 7 container names below are already confirmed and filled in directly — no further discovery needed for this step.
- Produces: production `nginx.conf` routes all 7 services correctly; the frontend is redeployed with these routes live.

Confirmed container names (verbatim, from live `docker ps` on the VPS):

| Service | Container name | Port |
|---|---|---|
| crm-api | `bcbbeslsh2h71pl69zw5q0gg-083159351627` | 3011 |
| sales-api | `3qu9lzupojtxrxxuh7g3bwnh-155143376746` | 3201 |
| uim-api | `fg1wffj6kp9yzwnwa1ow8wkd-152835457880` | 3701 |
| finance-api | `uzo1ozwjn0llussqi8fbjqb0-082837933770` | 3301 |
| logistics-api | `hdmsjbd6ulfq8t7j9zi4panw-082623660677` | 3401 |
| compliance-api | `x12lnwcgde45v27is4y6326t-082623349600` | 3501 |
| comms-api | `fcz1wje9cv7wlxe8iwj1lbzn-082918708797` | 3601 |

**Caveat for the implementer**: these container names include a timestamp suffix that Coolify regenerates on every redeploy of that app. If any of these 7 apps gets redeployed between when this was written and when you execute this task, re-confirm the current name via `docker ps` before using it — don't blindly trust this table if there's reason to think time has passed or something changed.

- [ ] **Step 1: Add the new `location` blocks to `nginx.conf`**

Insert this block into `nginx.conf` immediately after the existing `location /api/markets/ { ... }` block (around line 114 as of this session), using the container names from the table above (already substituted below — verify they still match live reality first per the caveat above):

```nginx
    # crm-api: leads sub-route must be a distinct, more specific location
    # than /api/crm below so nginx's longest-prefix match picks it first.
    location /api/crm/v1/leads {
        proxy_pass http://3qu9lzupojtxrxxuh7g3bwnh-155143376746:3201;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/crm {
        proxy_pass http://bcbbeslsh2h71pl69zw5q0gg-083159351627:3011;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/sales {
        proxy_pass http://3qu9lzupojtxrxxuh7g3bwnh-155143376746:3201;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/v1/platform-domains {
        proxy_pass http://fg1wffj6kp9yzwnwa1ow8wkd-152835457880:3701;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/v1/domain-assignments {
        proxy_pass http://fg1wffj6kp9yzwnwa1ow8wkd-152835457880:3701;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/v1/domain-config {
        proxy_pass http://fg1wffj6kp9yzwnwa1ow8wkd-152835457880:3701;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/v1/franchises {
        proxy_pass http://fg1wffj6kp9yzwnwa1ow8wkd-152835457880:3701;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/v2/uim {
        proxy_pass http://fg1wffj6kp9yzwnwa1ow8wkd-152835457880:3701;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/v1/invoices {
        proxy_pass http://uzo1ozwjn0llussqi8fbjqb0-082837933770:3301;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/v1/tax {
        proxy_pass http://uzo1ozwjn0llussqi8fbjqb0-082837933770:3301;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/finance {
        proxy_pass http://uzo1ozwjn0llussqi8fbjqb0-082837933770:3301;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/logistics {
        proxy_pass http://hdmsjbd6ulfq8t7j9zi4panw-082623660677:3401;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/v1/compliance {
        proxy_pass http://x12lnwcgde45v27is4y6326t-082623349600:3501;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/compliance {
        proxy_pass http://x12lnwcgde45v27is4y6326t-082623349600:3501;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/v1/comms {
        proxy_pass http://fcz1wje9cv7wlxe8iwj1lbzn-082918708797:3601;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    location /api/comms {
        proxy_pass http://fcz1wje9cv7wlxe8iwj1lbzn-082918708797:3601;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
```

Per the spec: nginx's plain-prefix `location` blocks resolve by longest-match, not declaration order, so the above ordering is for readability only — it is not load-bearing the way `vite.config.ts`'s ordering is. Do not add a bare `/api/v1` block in this task; that catch-all already exists (routes to amro) and must remain last/unchanged.

> **Correction (added during final whole-branch review, 2026-09-01):** the
> claim above — that a bare `/api/v1` catch-all "already exists (routes to
> amro)" in production `nginx.conf` — is false. It has never existed there;
> only `vite.config.ts`'s dev-server proxy has such a fallback. In
> production, any `/api/v1/*` path not explicitly matched by one of this
> task's new blocks (or the pre-existing `/api/v2/amro/`, `/api/amro/`,
> `/api/markets/` blocks) silently falls through to the SPA. This was a
> pre-existing gap this plan was never asked to close, and it remains open.

- [ ] **Step 2: Verify nginx syntax locally isn't broken**

There's no local nginx to run this against directly, but re-read the full edited file and confirm every new block matches the existing amro blocks' bracket/semicolon structure exactly (a stray missing semicolon or brace here will break nginx startup on the next deploy, the same class of mistake fixed earlier this session with the CSP header).

- [ ] **Step 3: Commit**

```bash
git add nginx.conf
git commit -m "feat(nginx): route crm/sales/uim/finance/logistics/compliance/comms APIs

Adds production location blocks for all 7 newly-deployed backend
microservices, mirroring vite.config.ts's dev proxy routing table.
Container names are the actual Coolify-assigned names confirmed during
each service's deployment (Tasks 2-8), not assumed."
```

- [ ] **Step 4: Push and redeploy the frontend**

```bash
git push origin main
```

Per Global Constraints: get the new commit's full SHA (`git rev-parse main`), `PATCH` the frontend app's `git_commit_sha` to it, *then* trigger deploy — do not trigger deploy first (it will silently rebuild the old pinned commit, as happened earlier this session). Poll the deployment to `finished` the same way as Tasks 2–8.

- [ ] **Step 5: Full external verification sweep**

Important: none of these 7 services mount `/health` under their routed prefix — each registers it at the bare root (`app.get('/health', ...)`, confirmed this session), while their real business routes are all mounted generically at `app.use('/api', authMiddleware, ...)` (also confirmed this session — none of them re-mount under a service-specific sub-path internally; nginx forwards the full original URI unchanged, matching how `vite.config.ts`'s dev proxies handle these same prefixes with no `rewrite`). So an external request like `https://app.sosservices.online/api/crm/health` will 404 even on a perfectly correct deployment — that is not a bug, don't chase it.

Don't assume a uniform expected status code per service — checked this session and the 7 services don't mount routes at a uniform internal depth relative to `/api` (e.g. `crm-api` has been reduced to an auth+audit shim with only `/api/_status` registered internally; nginx forwards the full external path unchanged, so `/api/crm` itself won't even match that one route, and would hit crm-api's *own* 404 handler rather than `authMiddleware`). Chasing an exact status code per service here is a rabbit hole with a low payoff. Use the same signal that actually diagnosed the original `uim-api`/`DomainService` bug this session: **response `Content-Type`**, not status code. A real backend (even returning its own 404 or 401) responds with `application/json`; nginx's SPA catch-all falls back to `text/html`. That distinction alone proves whether nginx is routing to the container at all — which is what this step needs to prove; each service's own internal route correctness is not this plan's concern.

```bash
for path in /api/crm /api/sales /api/v1/platform-domains /api/finance /api/logistics /api/compliance /api/comms; do
  curl -s -o /dev/null -w "$path -> %{http_code} %{content_type}\n" "https://app.sosservices.online$path"
done
```
Expected: every line shows a `content_type` starting with `application/json` (or empty body with no `text/html`), regardless of the specific status code. A `text/html` content type on any of them means that prefix is still falling through to the SPA — check for a missing/mistyped nginx block, wrong container name, or (given nginx's longest-prefix-wins semantics) an accidental typo making a block not match the intended path at all.

Each internal per-service `/health` check already happened in Tasks 2–8 Step 5 (hit directly inside the container at bare `localhost:<port>/health`, bypassing nginx entirely) — that already proves each service itself is healthy; this step proves nginx's routing to it is correct, which is a distinct and equally necessary check.

- [ ] **Step 6: Browser verification of the one confirmed dependent feature**

Log in with a fresh magiclink (self-hosted, using the current live `SUPABASE_SERVICE_ROLE_KEY` per Global Constraints — not the stale local `env` file) and load `/dashboard`. Confirm the `[DomainService] non-JSON response from authorized domains API` console error from earlier this session is gone. This is the one feature with a confirmed pre-existing break (`uim-api`'s absence); the other 6 services don't have a confirmed broken feature today, so no further browser verification is required for them per the spec — health-reachable-externally (Step 5) is sufficient.

> **Correction (added during final whole-branch review, 2026-09-01):** this
> step's "confirmed fixed" reading was a false positive. The console error
> going away only meant nginx now routes `/api/v1/platform-domains` to
> `uim-api` instead of the SPA falling through with `text/html` (which is
> what the "non-JSON response" message was actually detecting). `uim-api`'s
> own application code has no domain-management routes at all — its real
> routes are mounted at `/api/v1/uim/*` (confirmed: no file matches "domain"
> anywhere under `services/uim-api/src/routes/`) — so the request lands on
> `uim-api`'s own 404 handler, which happens to answer with
> `application/json`, silencing the specific console warning without making
> "authorized domains" actually work. **`DomainService`'s "authorized
> domains" feature is still broken.** A real fix requires implementing
> those routes in `uim-api`'s own codebase — out of scope for this
> infrastructure-only plan. A follow-on nginx block for `/api/v1/uim` (added
> during this final review) does make `uim-api`'s real, already-implemented
> routes reachable, which is a genuine improvement independent of this gap.

- [ ] **Step 7: Update the SDD-style record**

If this plan is executed under `superpowers:subagent-driven-development`, its own ledger mechanism covers this. If executed standalone, append a summary of what was deployed (7 apps, their uuids and container names, the nginx changes, and the Step 5/6 verification results) to a suitable project record before considering this plan complete.
