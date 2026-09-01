# uim-api platform-domains route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `GET /api/v1/platform-domains` in `uim-api`, matching the response shape `DomainService.ts` already expects, so the dashboard's "authorized domains" feature stops falling back to a degraded client-side path.

**Architecture:** One small middleware change (expose `req.isPlatformAdmin`, currently computed but never attached) plus one new route file, mounted the same way every other `uim-api` route already is. No new services, no new infrastructure, no new dependencies.

**Tech Stack:** Node.js/Express (TypeScript, `tsc`), `@supabase/supabase-js` (service-role client, already a dependency), Coolify's REST API for deployment.

**Spec:** `docs/superpowers/specs/2026-09-01-uim-api-platform-domains-route-design.md` — read directly for full background; not repeated here except where a task needs exact values.

## Global Constraints

- **Never print secrets to a command line or into a chat/tool-output transcript.** The Coolify API token lives in the repo-root gitignored `env` file as `COOLIFY_API_TOKEN`/`COOLIFY_API_URL`. Use this exact pattern for every Coolify API call:
  1. `grep -E '^COOLIFY_API_(URL|TOKEN)=' env > <local-scratch-path>/.coolify_env`
  2. `scp <local-scratch-path>/.coolify_env hostinger-vps:/tmp/.coolify_env`
  3. `rm -f <local-scratch-path>/.coolify_env` immediately
  4. `ssh hostinger-vps 'chmod 600 /tmp/.coolify_env; set -a; source /tmp/.coolify_env; set +a; <curl command>; rm -f /tmp/.coolify_env'`
  Never type a secret's literal value into a command string or output.
- The same pattern applies to the self-hosted `SUPABASE_SERVICE_ROLE_KEY`, needed for end-to-end verification — read it fresh from the live `auth` container's own environment on the VPS. **Do not assume any previously-seen container name is still current** — check with `docker ps --filter name=auth-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'` first, then:
  `ssh hostinger-vps "docker exec <current-auth-container-name> sh -c 'echo SUPABASE_SERVICE_ROLE_KEY=\$SERVICE_ROLE_KEY' > /tmp/.sb_env2 && chmod 600 /tmp/.sb_env2"`
  (the redirect `>` must run on the HOST side, outside the `docker exec` argument, or the file lands inside the container instead). Never use the local repo's `env` file for this value — it's stale and points at a different (production Cloud) project.
- **No test framework exists in `uim-api`** — confirmed by direct inspection: no `jest.config.cjs`, no `jest`/`ts-jest`/`@types/jest` in `package.json`, no test script. Per the plan owner's explicit decision, this plan does NOT introduce one — verification is manual (`npm run build` for type-checking locally, then live curl checks against the deployed VPS in Task 3). Do not add jest or any test framework as part of this plan.
- `uim-api`'s Coolify application (uuid `fg1wffj6kp9yzwnwa1ow8wkd`) tracks `main`'s HEAD directly (`git_commit_sha: HEAD`, confirmed via the Coolify API) — unlike the frontend app, which is pinned to a specific commit SHA. Deploying this change is just: push, then trigger a deploy. No pin-update step needed.
- Windows/git-bash mangles literal `/tmp/...`-style paths embedded in a `python3 -c "..."` argument string. Pass such paths via an environment variable read through `os.environ` instead of a literal path in the script text, if a Python one-liner is needed.
- Run `npm run build` inside `services/uim-api` (not the repo-root `npm run typecheck`, which covers the frontend, not this service) before committing each task, to catch TypeScript errors before they reach deploy.

---

### Task 1: Expose `req.isPlatformAdmin` in uim-api's auth middleware

**Files:**
- Modify: `services/uim-api/src/middleware/auth.middleware.ts:11-15` (the `AuthRequest` interface), `services/uim-api/src/middleware/auth.middleware.ts:303` (where `hasPlatformAdmin` is computed)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `AuthRequest.isPlatformAdmin?: boolean`, set on every request that reaches `next()` (both the explicit-scope-override branch and the default-scope branch). Task 2's route reads this field.

The current interface (lines 11-15):
```typescript
interface AuthRequest extends Request {
  tenantId?: string;
  franchiseId?: string | null;
  userId?: string;
  user?: unknown;
}
```

`hasPlatformAdmin` is computed at line 303 (`const hasPlatformAdmin = roles.some(isPlatformAdminRole);`) but never attached to `req`. It needs to be set on **both** code paths that call `next()` after this point: the explicit tenant/franchise-scope-override branch (around line 361-364, where `req.tenantId`/`req.franchiseId` are already set before `next()`) and the default-scope branch (around line 395-398, same pattern). Do not add it to the earlier, early-return error branches (401/403/400 responses never reach a route handler, so there's nothing to attach it for).

- [x] **Step 1: Add `isPlatformAdmin` to the `AuthRequest` interface**

In `services/uim-api/src/middleware/auth.middleware.ts`, change:
```typescript
interface AuthRequest extends Request {
  tenantId?: string;
  franchiseId?: string | null;
  userId?: string;
  user?: unknown;
}
```
to:
```typescript
interface AuthRequest extends Request {
  tenantId?: string;
  franchiseId?: string | null;
  userId?: string;
  user?: unknown;
  isPlatformAdmin?: boolean;
}
```

- [x] **Step 2: Set `req.isPlatformAdmin` on the explicit-scope-override branch**

Find this existing block (around line 361-364):
```typescript
      req.tenantId = requestedTenantId;
      req.franchiseId = requestedFranchiseId;
      recordAuthHeaderResult(true, 'authorization', correlationId, req.path);
      next();
      return;
```
Change it to:
```typescript
      req.tenantId = requestedTenantId;
      req.franchiseId = requestedFranchiseId;
      req.isPlatformAdmin = hasPlatformAdmin;
      recordAuthHeaderResult(true, 'authorization', correlationId, req.path);
      next();
      return;
```

- [x] **Step 3: Set `req.isPlatformAdmin` on the default-scope branch**

Find this existing block (around line 395-398):
```typescript
    req.tenantId = defaultRole.tenant_id;
    req.franchiseId = defaultRole.franchise_id ?? null;
    recordAuthHeaderResult(true, 'authorization', correlationId, req.path);
    next();
```
Change it to:
```typescript
    req.tenantId = defaultRole.tenant_id;
    req.franchiseId = defaultRole.franchise_id ?? null;
    req.isPlatformAdmin = hasPlatformAdmin;
    recordAuthHeaderResult(true, 'authorization', correlationId, req.path);
    next();
```

- [x] **Step 4: Type-check**

```bash
cd services/uim-api
npm run build
```
Expected: succeeds with no TypeScript errors. This is a purely additive optional field — no existing code reads or assigns `isPlatformAdmin`, so nothing should break.

- [x] **Step 5: Commit**

```bash
git add services/uim-api/src/middleware/auth.middleware.ts
git commit -m "feat(uim-api): expose isPlatformAdmin on AuthRequest

hasPlatformAdmin was computed in the auth middleware but never
attached to req, so no route could read it. Needed by the upcoming
platform-domains route to correctly report isPlatformAdmin in its
response instead of hardcoding it (the dev-mode reference handler's
own gap)."
```

---

### Task 2: Implement `GET /api/v1/platform-domains`

**Files:**
- Create: `services/uim-api/src/routes/platform-domains.routes.ts`
- Modify: `services/uim-api/src/app.ts` (add import + mount line)

**Interfaces:**
- Consumes: `AuthRequest.isPlatformAdmin`, `AuthRequest.tenantId`, `AuthRequest.userId` (Task 1) and `req.correlationId` (already attached by existing app-level middleware in `app.ts:70-76` — do not generate a new one in this route).
- Produces: the route itself — nothing later in this plan consumes it as code, but Task 3's verification depends on it being live.

The route reads (public schema, not `uim.*` — `platform_domains` and `tenant_active_domain_assignments` are both in the default `public` schema, unlike `integrations.routes.ts`'s `.schema('uim')` calls, which is specific to that route's own UIM-schema tables. Do not copy the `.schema('uim')` call into this route.)

- [x] **Step 1: Write `services/uim-api/src/routes/platform-domains.routes.ts`**

```typescript
import { Router, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

import { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import type { ErrorResponse } from '../types/uim.types.js';

const router = Router();

interface PlatformDomainRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  status: string;
}

function getServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('uim-api requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'Authentication required',
    code: 'UNAUTHORIZED',
    statusCode: 401,
  } as ErrorResponse);
}

router.get(
  '/v1/platform-domains',
  asyncHandler(async (req, res) => {
    const authReq = req as AuthRequest;
    if (!authReq.userId) return unauthorized(res);

    try {
      const supabase = getServiceRoleClient();
      let domains: PlatformDomainRow[] = [];

      if (authReq.isPlatformAdmin) {
        const { data, error } = await supabase
          .from('platform_domains')
          .select('id, code, name, description, is_active, status')
          .eq('is_active', true);
        if (error) throw error;
        domains = (data || []) as PlatformDomainRow[];
      } else {
        const { data, error } = await supabase
          .from('tenant_active_domain_assignments')
          .select('platform_domains!inner(id, code, name, description, is_active, status)')
          .eq('tenant_id', authReq.tenantId);
        if (error) throw error;
        const seen = new Set<string>();
        for (const row of (data || []) as Array<{ platform_domains: PlatformDomainRow }>) {
          const pd = row.platform_domains;
          if (!pd || !pd.id || seen.has(pd.id)) continue;
          seen.add(pd.id);
          domains.push(pd);
        }
      }

      res.json({
        version: 'v1',
        correlationId: (req as { correlationId?: string }).correlationId || null,
        data: {
          domains,
          tenantDomainCount: domains.length,
          tenantId: authReq.tenantId ?? null,
          isPlatformAdmin: Boolean(authReq.isPlatformAdmin),
        },
      });
    } catch (err) {
      logger.error('uim.platform-domains list error', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to list platform domains',
        code: 'PLATFORM_DOMAINS_QUERY_FAILED',
        statusCode: 500,
      } as ErrorResponse);
    }
  }),
);

export default router;
```

- [x] **Step 2: Mount the new router in `app.ts`**

Add this import alongside the other route imports (near `services/uim-api/src/app.ts:18`, after `import integrationsRoutes from './routes/integrations.routes.js';`):
```typescript
import platformDomainsRoutes from './routes/platform-domains.routes.js';
```

Add this mount line alongside the other `app.use('/api', authMiddleware, auditApiRequest, ...)` lines (near `services/uim-api/src/app.ts:204`, after `app.use('/api', authMiddleware, auditApiRequest, integrationsRoutes);`):
```typescript
app.use('/api', authMiddleware, auditApiRequest, platformDomainsRoutes);
```

- [x] **Step 3: Type-check**

```bash
cd services/uim-api
npm run build
```
Expected: succeeds with no TypeScript errors.

- [x] **Step 4: Manual local sanity check (no test framework — see Global Constraints)**

Confirm the built output actually contains the new route, since there's no automated test to catch a build-config or export mistake:
```bash
cd services/uim-api
grep -c "platform-domains" dist/app.js
```
Expected: at least 1 (the mounted path string compiled into the output). If 0, the import/mount didn't make it into the build — investigate before proceeding.

- [x] **Step 5: Commit**

```bash
git add services/uim-api/src/routes/platform-domains.routes.ts services/uim-api/src/app.ts
git commit -m "feat(uim-api): implement GET /api/v1/platform-domains

Matches DomainService.ts's expected response shape exactly. Platform
admins get all active platform_domains directly; tenant users get
their tenant's assigned domains via tenant_active_domain_assignments,
filtered explicitly by tenant_id in application code (the service-role
client bypasses RLS, so this mirrors what RLS already does implicitly
for the dev-mode reference handler). Query failures return 500;
DomainService.ts's existing client-side fallback handles that
gracefully already."
```

---

### Task 3: Deploy and verify end-to-end

**Files:** none (deployment/verification only).

**Interfaces:**
- Consumes: Tasks 1-2's committed code.
- Produces: a live, verified `GET /api/v1/platform-domains` on the deployed `uim-api`.

- [x] **Step 1: Push**

```bash
git push origin main
```

- [x] **Step 2: Trigger a Coolify redeploy for uim-api**

Using the secret-handling pattern from Global Constraints:
```bash
ssh hostinger-vps 'chmod 600 /tmp/.coolify_env; set -a; source /tmp/.coolify_env; set +a; curl -s -X POST "${COOLIFY_API_URL}/api/v1/deploy?uuid=fg1wffj6kp9yzwnwa1ow8wkd" -H "Authorization: Bearer ${COOLIFY_API_TOKEN}"; rm -f /tmp/.coolify_env'
```
This returns a `deployment_uuid`. Poll `GET /api/v1/deployments/<deployment_uuid>` (same secret-handling pattern) every ~15s until `status` is `finished` (or `failed` — if failed, check the deployment logs via the Coolify API/UI before retrying).

- [x] **Step 3: Confirm the new container is healthy**

```bash
ssh hostinger-vps "docker ps --filter 'label=coolify.applicationId' --format '{{.Names}}\t{{.Status}}' | grep -i fg1wffj6kp9yzwnwa1ow8wkd"
```
Expected: a container `Up ... (healthy)`. Record its name — needed for Step 4.

- [x] **Step 4: Verify the route directly inside the container first**

This isolates "does the route exist and not crash" from "is nginx/auth working end-to-end" — check the simpler thing first.
```bash
ssh hostinger-vps "docker exec <container-name-from-step-3> curl -s -o /dev/null -w '%{http_code}' localhost:3701/api/v1/platform-domains"
```
Expected: `401` (no `Authorization` header sent) — this proves the route exists and `authMiddleware` correctly rejects an unauthenticated request, rather than 404 (route missing) or 500 (route crashes on load).

- [x] **Step 5: Get a real, authenticated request working externally**

Generate a fresh magiclink for the known test account (`phase4-batch1-verify-test@sosservices.online`, used throughout this engagement), using the current live `SUPABASE_SERVICE_ROLE_KEY` per Global Constraints:
```bash
ssh hostinger-vps 'set -a; source /tmp/.sb_env2; set +a; curl -s -X POST "https://supabase.sosservices.online/auth/v1/admin/generate_link" -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "Content-Type: application/json" -d "{\"type\":\"magiclink\",\"email\":\"phase4-batch1-verify-test@sosservices.online\"}" > /tmp/link_resp.json; python3 -c "
import json
d = json.load(open(\"/tmp/link_resp.json\"))
print(d[\"action_link\"])
"; rm -f /tmp/link_resp.json /tmp/.sb_env2'
```
This test account has no tenant/role assignment (confirmed earlier this session via direct DB query) — expect the request to reach `authMiddleware`'s `401 NO_TENANT_ASSIGNMENT` branch, which is itself a valid, meaningful verification (proves auth + routing work correctly end-to-end up to the tenant-scope check) even without a fully-scoped test identity. If a browser tool is available, complete the magiclink flow and check `/dashboard`'s console for the absence of `[DomainService] non-JSON response from authorized domains API`; if not, verify via `curl` against `https://app.sosservices.online/api/v1/platform-domains` with the completed session's access token instead, confirming a JSON response (not HTML, not a generic 404) — either a real domains list or the `401 NO_TENANT_ASSIGNMENT` body, both of which prove the route is live and functioning, as opposed to the previous behavior (falling through nginx to the SPA, or `uim-api`'s own blanket 404).

- [x] **Step 6: Report the final verification result**

Note plainly whether full end-to-end success (a real tenant/platform-admin identity getting a real domains list) was demonstrated, or whether verification stopped at the `401 NO_TENANT_ASSIGNMENT` check due to the test account's own limitations — the latter is still a meaningful, positive verification of this plan's actual scope (the route exists, deploys, and behaves correctly), just not a full proof that a real business user sees real data. If a real business account is available to test with, use it instead of the throwaway test account for a more complete verification.
