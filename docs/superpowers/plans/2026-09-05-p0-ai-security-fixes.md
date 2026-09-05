# P0 AI Security Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the one genuinely open AI endpoint (`ai-advisor`), eliminate its two cross-tenant data paths, admin-gate `generate-embedding`, and delete the client-side OpenAI credential trap.

**Architecture:** Five sequential tasks. A schema migration lands first because later code depends on the column it adds; then the three code fixes, each independently reviewable; then a single deploy-and-verify pass.

**Tech Stack:** Deno edge functions (Supabase), React/TypeScript frontend, PostgreSQL, Coolify REST API for deployment.

**Spec:** `docs/superpowers/specs/2026-09-05-p0-ai-security-fixes-design.md` — read it for the rationale behind each fix, especially why 1c must not be "fixed" with a user-scoped client.

**Scope note:** the spec covers three fixes. This plan adds one item the spec did not anticipate — a cross-tenant leak in `ai_quote_cache`, discovered while writing the plan and approved for inclusion by the plan owner. Without it, `ai-advisor` would still serve one tenant's derived quote analysis to another, so the audit's Critical would not actually be closed.

## Global Constraints

### Secret handling

Every Coolify API call uses this exact pattern — never interpolate a token into a visible command line:

1. `grep -E '^COOLIFY_API_(URL|TOKEN)=' env > <local-scratch>/.coolify_env`
2. `scp <local-scratch>/.coolify_env hostinger-vps:/tmp/.coolify_env`
3. `rm -f <local-scratch>/.coolify_env` immediately
4. `ssh hostinger-vps 'chmod 600 /tmp/.coolify_env; set -a; source /tmp/.coolify_env; set +a; <curl using ${COOLIFY_API_URL} and ${COOLIFY_API_TOKEN}>; rm -f /tmp/.coolify_env'`

Never `cat` a whole env listing or build log — filter with `grep` for what you need.

### Permission and safety boundaries

- **Never retry a command a permission classifier explicitly denied.** Report BLOCKED and let the controller decide.
- The VPS hosts **24 applications belonging to unrelated products** (`avaipro-*`, `sthira`, `plane.so`, `jenkins`, others). Do not restart, modify, or otherwise disturb anything outside this plan's scope.
- Touch no pre-existing resource this plan does not name.

### The one live probe needs human sign-off

Task 5 verifies the fix by sending an **unauthenticated request to `ai-advisor` expecting a 401**. This is the same request the audit deferred pending authorization — the difference being it now confirms an endpoint is *closed* rather than probing whether it is open. **Do not run it without explicit human sign-off.** Every other verification step is observational or authenticated.

### Push ordering — CORRECTED mid-execution

The original plan said "do not push until Task 5," on the reasoning that the repository is public and the audit commits describe live weaknesses. That is now moot and the reasoning was partly wrong:

- All 16 commits (audit + fixes to that point) **were pushed** during the out-of-band 401 fast-track, on the controller's stated but **incorrect** premise that pushing was required to deploy an edge-function fix. It was not — see the corrected deployment section below. The disclosure happened and achieved nothing.
- `origin/main` is therefore already current. Push normally from here; there is nothing left to withhold.

### Deployment — CORRECTED mid-execution, read this carefully

The original plan assumed `git push` plus a Coolify deploy ships edge functions. **It does not.** Three findings, all verified:

1. The self-hosted stack (Coolify app `i64jlyerora7ao9vkw5sweh3`) deploys from branch **`deploy/supabase-selfhost-phase1`**, not `main`. That branch is **110 commits behind** `main` and does not even contain `supabase/functions/main/verify_jwt_map.ts`.
2. Yet the running container *has* that file — so the deployed functions came from neither branch.
3. **Edge functions are a read-only bind mount** from `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions` on the VPS host. It holds **115 entries, all last written 2026-08-28** — a hand-deployed snapshot from earlier Phase 4 work.

**Consequence: a Coolify deploy of the stack will not update any edge function.** Two deploys and a push were confirmed no-ops.

**To deploy an edge-function change** (Tasks 2 and 3), use the method proven during the 401 fast-track:

```bash
D=/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions
# 1. Back up what you are about to overwrite, timestamped:
ssh hostinger-vps "cp $D/<path> /tmp/backup-<name>-$(date -u +%Y%m%d-%H%M%S).ts"
# 2. Export from the COMMIT (LF endings) rather than the Windows working tree:
git show <sha>:supabase/functions/<path> > /tmp/staged.ts
# 3. scp, then cp into place, then verify the content landed
# 4. Restart ONLY the functions container:
C=$(ssh hostinger-vps "docker ps --filter name=functions-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")
ssh hostinger-vps "docker restart $C"
```

**Before overwriting any file in that directory, diff the deployed copy against the version you are replacing it with** (CR-normalised — the deployed files are LF, the Windows working tree is CRLF, so a naive `diff` reports every line as changed). The deployed snapshot is a week old and may differ from `main` for files nobody has checked. Overwriting blind could silently revert someone else's change or alter unrelated behaviour.

**The frontend is different and unchanged:** Coolify app `b2lt2if6x6ovekc4tj7vg8tx` *does* build from git, and is **pinned to a specific `git_commit_sha`** — its pin must be PATCHed to the new commit *before* triggering a deploy, or the deploy silently rebuilds the old commit. Task 4's deployment path is unaffected by any of the above.

- The self-hosted DB container name changes on every redeploy. Always resolve it live:
  `DB=$(ssh hostinger-vps "docker ps --filter name=db-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")`

### Credential and role changes are escalate-first

Task 1's implementer hit `must be owner of table` running DDL as `-U postgres`, and switched to `-U supabase_admin` (a superuser) on its own judgement. The SQL was byte-identical and the outcome was verified correct, but it was a privilege escalation, not an execution detail. **Any change to the database role, credentials, or identity a command runs under must be reported before acting, not after** — even when the substantive operation is unchanged. The single exception is Task 1.5, where `-U supabase_admin` is pre-authorized for that one migration.

### Testing reality

There is **no test framework in the edge-functions codebase** — no jest, no deno test setup. Verification is type-checking plus live behavioural checks. Do not introduce a test framework as part of this plan.

### Verified signatures — use these, do not re-derive

```ts
// supabase/functions/_shared/auth.ts
requireAuth(req: Request, logger?: Logger)
  → { user: { id: string; email?: string; app_metadata?: any; user_metadata?: any } | null,
      error: string | null,
      supabaseClient: SupabaseClient }   // NOTE: this client is JWT-scoped and respects RLS

requireServiceRoleOrAdmin(req: Request, supabaseAdmin: SupabaseClient, logger?: Logger)
  → { authorized: boolean; status: number; error: string | null;
      user: { id: string; email?: string } | null; isServiceRole: boolean }
```

`serveWithLogger` injects a **service-role** client (`_shared/logger.ts:210-211` builds it from `SUPABASE_SERVICE_ROLE_KEY`), so RLS is bypassed for the `supabase` handler argument in every function.

---

### Task 1: Add `tenant_id` to `ai_quote_cache`

**Files:**
- Create: `supabase/migrations/20260905120000_ai_quote_cache_tenant_scope.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.ai_quote_cache.tenant_id uuid NOT NULL`, plus a composite index `idx_ai_quote_cache_tenant_hash` on `(tenant_id, request_hash)`. Task 2's code filters and populates this column.

**Why this is safe:** the table currently holds **76 rows, all already expired** (newest `expires_at` is `2026-05-21`, well before today). The read path filters `.gt('expires_at', now())`, so every existing row is already unreachable. Purging them costs nothing and lets `tenant_id` be `NOT NULL` from the start rather than nullable-forever.

- [ ] **Step 1: Write the migration**

```sql
-- ai_quote_cache was keyed only on request_hash (a hash of route/commodity/weight),
-- with no tenant dimension — so two tenants requesting the same lane shared cached
-- quote responses, including analysis derived from the other tenant's rates.
--
-- Safe to purge before adding NOT NULL: at time of writing all 76 rows were already
-- past expires_at, and the read path filters on expires_at > now(), so no reachable
-- data is lost.

BEGIN;

DELETE FROM public.ai_quote_cache;

ALTER TABLE public.ai_quote_cache
  ADD COLUMN tenant_id uuid NOT NULL;

ALTER TABLE public.ai_quote_cache
  ADD CONSTRAINT ai_quote_cache_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX idx_ai_quote_cache_tenant_hash
  ON public.ai_quote_cache USING btree (tenant_id, request_hash);

COMMIT;
```

- [ ] **Step 2: Confirm the FK target exists before applying**

The FK assumes `public.tenants(id)`. Verify, and if the table or column differs, adjust the migration to match rather than guessing:

```bash
DB=$(ssh hostinger-vps "docker ps --filter name=db-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")
ssh hostinger-vps "docker exec $DB psql -U postgres -d postgres -c \"select column_name, data_type from information_schema.columns where table_schema='public' and table_name='tenants' and column_name='id';\""
```
Expected: one row, `id | uuid`. If `public.tenants` does not exist, **stop and report** — do not silently drop the FK.

- [ ] **Step 3: Re-confirm all rows are expired immediately before applying**

The 76-rows-all-expired fact was measured while writing this plan. Re-check, because a live invocation between then and now would add a fresh row that the `DELETE` would discard:

```bash
DB=$(ssh hostinger-vps "docker ps --filter name=db-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")
ssh hostinger-vps "docker exec $DB psql -U postgres -d postgres -c 'select count(*) as total, count(*) filter (where expires_at > now()) as still_live from public.ai_quote_cache;'"
```
Expected: `still_live = 0`. If it is non-zero, the purge would discard reachable cache entries — harmless in principle (it is a cache), but **report it before proceeding** rather than deciding unilaterally.

- [ ] **Step 4: Apply the migration to self-hosted**

```bash
DB=$(ssh hostinger-vps "docker ps --filter name=db-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")
scp supabase/migrations/20260905120000_ai_quote_cache_tenant_scope.sql hostinger-vps:/tmp/mig.sql
ssh hostinger-vps "docker cp /tmp/mig.sql $DB:/tmp/mig.sql && docker exec $DB psql -U postgres -d postgres -f /tmp/mig.sql && docker exec $DB rm -f /tmp/mig.sql && rm -f /tmp/mig.sql"
```
Expected: `BEGIN`, `DELETE 76` (or current count), two `ALTER TABLE`, `CREATE INDEX`, `COMMIT` — no errors.

- [ ] **Step 5: Verify the resulting schema**

```bash
DB=$(ssh hostinger-vps "docker ps --filter name=db-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")
ssh hostinger-vps "docker exec $DB psql -U postgres -d postgres -c '\d public.ai_quote_cache'"
```
Expected: `tenant_id uuid not null` present, `idx_ai_quote_cache_tenant_hash` listed, FK constraint listed.

- [ ] **Step 6: Commit and push**

```bash
git add supabase/migrations/20260905120000_ai_quote_cache_tenant_scope.sql
git commit -m "fix(db): tenant-scope ai_quote_cache

The cache was keyed only on a hash of route/commodity/weight, so two
tenants requesting the same lane shared cached quote responses -
including analysis derived from the other tenant's historical rates.
Adds a NOT NULL tenant_id with an FK and a composite (tenant_id,
request_hash) index. All existing rows were already past expires_at
and therefore unreachable, so purging them loses nothing."
```

**Note on Supabase Cloud production:** this migration is applied to self-hosted only, where these functions run. Whether Cloud production also carries `ai_quote_cache` and needs the same change is an open question — record it in your report rather than assuming either way.

---

### Task 1.5: Tenant-scope `ai_quote_cache`'s RLS policies

**Files:**
- Create: `supabase/migrations/20260905130000_ai_quote_cache_rls_tenant_scope.sql`

**Interfaces:**
- Consumes: `ai_quote_cache.tenant_id` from Task 1.
- Produces: RLS policies that confine cache reads to the caller's own tenant. Task 2 depends on this landing first.

**Added mid-execution.** Task 1's implementer flagged, and the controller verified, that `ai_quote_cache`'s RLS is permissive enough to leak across tenants entirely independently of `ai-advisor`:

| Policy | cmd | roles | qual |
|---|---|---|---|
| `Allow read access to authenticated users` | SELECT | `authenticated` | `true` |
| `Authenticated users can read cache` | SELECT | `{public}` | `expires_at > now()` |
| `Allow insert access to authenticated users` | INSERT | `authenticated` | — |
| `Authenticated users can insert cache` | INSERT | `{public}` | — |
| `Service role can manage cache` | ALL | `{public}` | `auth.jwt() ->> 'role' = 'service_role'` |

`anon` holds the `SELECT` grant on the table, and `{public}` in Postgres means every role — so any holder of the (publicly-known) anon key could read every non-expired cached quote across all tenants via `/rest/v1/ai_quote_cache`. The permissive INSERT policies additionally allow cache poisoning by any authenticated user.

**Why this must precede Task 2:** the table is empty right now (Task 1 purged all 76 rows). Task 2 re-enables cache writes. Landing Task 2 first would begin populating a cross-tenant-readable table. Doing this first means there is no exposure window at all.

- [ ] **Step 1: Write the migration**

```sql
-- ai_quote_cache RLS was permissive enough to leak across tenants independently
-- of ai-advisor: a {public}-role SELECT policy qualified only on expiry, plus an
-- authenticated SELECT policy qualified `true`, on a table where anon holds the
-- SELECT grant. Also drops the permissive INSERT policies — only the edge
-- function (service_role) legitimately writes this cache.
--
-- Depends on tenant_id, added in 20260905120000.

BEGIN;

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.ai_quote_cache;
DROP POLICY IF EXISTS "Authenticated users can read cache"       ON public.ai_quote_cache;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.ai_quote_cache;
DROP POLICY IF EXISTS "Authenticated users can insert cache"       ON public.ai_quote_cache;

-- Reads: own tenant only, and only unexpired entries.
CREATE POLICY "Tenant members read own cache"
  ON public.ai_quote_cache
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND expires_at > now()
  );

-- Writes stay service-role only, via the pre-existing
-- "Service role can manage cache" policy, which is left untouched.

COMMIT;
```

`public.get_user_tenant_id(check_user_id uuid)` is SECURITY DEFINER and is the same helper other tenant-scoped policies in this database already use. It is **schema-qualified deliberately**: a second overload exists at `platform.get_user_tenant_id(uid uuid)`, so an unqualified call depends on `search_path`.

- [ ] **Step 2: Confirm the service-role policy survives**

The edge function writes and reads through the service-role client, so `Service role can manage cache` must remain. Verify before and after that it is present and untouched:

```bash
DB=$(ssh hostinger-vps "docker ps --filter name=db-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")
ssh hostinger-vps "docker exec $DB psql -U postgres -d postgres -c \"select policyname, cmd from pg_policies where schemaname='public' and tablename='ai_quote_cache' order by policyname;\""
```

- [ ] **Step 3: Apply the migration**

Use the same mechanism as Task 1. **Note the role caveat from Task 1:** `psql -U postgres` cannot perform DDL on this table — it is owned by `supabase_admin` and `postgres` is not a superuser here. Task 1's implementer switched roles unilaterally to work around this; **do not repeat that pattern silently.** Using `-U supabase_admin` is the known-correct role for this table, and it is pre-authorized *for this migration only*. Any other credential or role change is escalate-first.

```bash
DB=$(ssh hostinger-vps "docker ps --filter name=db-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")
scp supabase/migrations/20260905130000_ai_quote_cache_rls_tenant_scope.sql hostinger-vps:/tmp/mig15.sql
ssh hostinger-vps "docker cp /tmp/mig15.sql $DB:/tmp/mig15.sql && docker exec $DB psql -U supabase_admin -d postgres -f /tmp/mig15.sql && docker exec $DB rm -f /tmp/mig15.sql && rm -f /tmp/mig15.sql"
```

- [ ] **Step 4: Verify the resulting policy set**

Re-run the query from Step 2. Expected: exactly two policies — `Service role can manage cache` (ALL) and `Tenant members read own cache` (SELECT). The four permissive policies must be gone.

- [ ] **Step 5: Commit (see the corrected push guidance in Global Constraints)**

```bash
git add supabase/migrations/20260905130000_ai_quote_cache_rls_tenant_scope.sql
git commit -m "fix(db): tenant-scope ai_quote_cache RLS

The table had a {public}-role SELECT policy qualified only on expiry and
an authenticated SELECT policy qualified true, while anon holds the
SELECT grant - so any anon-key holder could read every non-expired
cached quote across all tenants via PostgREST, independent of the
ai-advisor function. Also drops the permissive INSERT policies; only the
edge function's service-role client legitimately writes this cache."
```

---

### Task 2: Close `ai-advisor`

**Files:**
- Modify: `supabase/functions/ai-advisor/index.ts` (lines 50-53, 228, 239, 241-246, 266-272, 416)
- Modify: `supabase/functions/main/verify_jwt_map.ts:67`

**Interfaces:**
- Consumes: `ai_quote_cache.tenant_id` from Task 1; `requireAuth` from `_shared/auth.ts`.
- Produces: an `ai-advisor` that rejects anonymous callers and cannot read or write another tenant's data.

Four changes. They belong in one task because they are one function's security posture — a reviewer would reject any subset as incomplete.

> **PARTIALLY DONE — read before starting.** Steps 1 and 7 were completed out of band in commit `f3b8d527` and are **already deployed and verified live** (an unauthenticated request that returned `200` with a real body now returns `401`). They are kept below for context; **do not redo them** — the files already contain those changes. Your work is Steps 2–6, 8 and 9: the tenant-scoping that Steps 1 and 7 deliberately did not cover.
>
> Note that Task 1 made `ai_quote_cache.tenant_id` `NOT NULL` while the deployed function's insert still omits it, so cache writes are currently failing silently — quotes still generate, but nothing caches. Step 5 fixes that, which is part of why this task should not sit half-done.

- [x] **Step 1: Replace the swallowed auth with a hard 401** — DONE in `f3b8d527`, deployed, verified 401 live

Current code at `index.ts:50-53`:

```ts
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      logger.warn("Auth failed, continuing in anonymous mode", { correlationId, error: authError });
    }
```

Replace with:

```ts
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      logger.warn("Rejecting unauthenticated request", { correlationId, error: authError });
      return new Response(
        JSON.stringify({ error: authError || "Unauthorized" }),
        { status: 401, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }
```

`headers` is already in scope from `const headers = getCorsHeaders(req)` at line 40. This matches the canonical usage `_shared/auth.ts` documents for its own helper.

- [ ] **Step 2: Resolve the caller's tenant**

Insert immediately after the block from Step 1:

```ts
    const { data: roleRows, error: roleError } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .not('tenant_id', 'is', null)
      .limit(1);

    const tenantId: string | null = roleRows?.[0]?.tenant_id ?? null;
    if (roleError || !tenantId) {
      logger.warn("Caller has no tenant assignment", { correlationId, userId: user.id, error: roleError?.message });
      return new Response(
        JSON.stringify({ error: "No tenant assignment for this user" }),
        { status: 403, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }
```

403 rather than 401: the caller authenticated successfully but lacks the scope this function requires.

- [ ] **Step 3: Pass the tenant into `generateSmartQuotes`**

Change the signature at `index.ts:228` from:

```ts
async function generateSmartQuotes(payload: any, apiKey: string | undefined, supabase: any, logger: Logger, userToken?: string, userId?: string) {
```
to:

```ts
async function generateSmartQuotes(payload: any, apiKey: string | undefined, supabase: any, logger: Logger, tenantId: string, userToken?: string, userId?: string) {
```

And update the call site at `index.ts:93` from:

```ts
        result = await generateSmartQuotes(payload, openAiKey, supabase, logger, userToken, user?.id);
```
to:

```ts
        result = await generateSmartQuotes(payload, openAiKey, supabase, logger, tenantId, userToken, user.id);
```

`user.id` rather than `user?.id`: after Step 1, `user` is guaranteed non-null.

- [ ] **Step 4: Tenant-scope the cache read**

Change the query at `index.ts:241-246` from:

```ts
        const { data, error } = await supabase
            .from('ai_quote_cache')
            .select('response_payload')
            .eq('request_hash', cacheKey)
            .gt('expires_at', new Date().toISOString())
            .single();
```
to:

```ts
        const { data, error } = await supabase
            .from('ai_quote_cache')
            .select('response_payload')
            .eq('tenant_id', tenantId)
            .eq('request_hash', cacheKey)
            .gt('expires_at', new Date().toISOString())
            .single();
```

- [ ] **Step 5: Tenant-scope the cache write**

Change the insert at `index.ts:416-419` from:

```ts
    await supabase.from('ai_quote_cache').insert({
        request_hash: cacheKey,
        response_payload: aiResponse
    });
```
to:

```ts
    await supabase.from('ai_quote_cache').insert({
        tenant_id: tenantId,
        request_hash: cacheKey,
        response_payload: aiResponse
    });
```

After Task 1 the column is `NOT NULL`, so an insert omitting it fails at runtime. Note this insert's result is unchecked in the existing code — leave that as it is; adding error handling here is out of scope and would be an unrelated change.

- [ ] **Step 6: Tenant-scope the `rates` query**

Change the query at `index.ts:266-272` from:

```ts
        const { data: rates } = await supabase
            .from('rates')
            .select('base_price')
            .eq('mode', mode)
            .ilike('origin', `%${origin}%`)
            .ilike('destination', `%${destination}%`)
            .limit(5);
```
to:

```ts
        const { data: rates } = await supabase
            .from('rates')
            .select('base_price')
            .eq('tenant_id', tenantId)
            .eq('mode', mode)
            .ilike('origin', `%${origin}%`)
            .ilike('destination', `%${destination}%`)
            .limit(5);
```

**Do not instead switch this query to `requireAuth`'s JWT-scoped `supabaseClient`.** That is the tidier-looking fix and it is wrong here: `public.rates` has RLS **enabled with zero policies**, which is deny-all for any non-service-role caller. Using the scoped client would return zero rows and silently remove the historical-context feature rather than securing it.

- [x] **Step 7: Remove the router's JWT exemption** — DONE in `f3b8d527`, deployed, verified (map went 85 → 84 entries, exactly one removed)

Delete this line from `supabase/functions/main/verify_jwt_map.ts` (line 67):

```ts
  "ai-advisor": false,
```

With the entry gone, `main/index.ts:336`'s `VERIFY_JWT_MAP[name] !== false` default applies and the router enforces JWT before the function body runs. This is one targeted entry, **not** the deferred 85-entry map review — leave every other entry untouched.

- [ ] **Step 8: Type-check**

```bash
npx tsc --noEmit -p supabase/functions/ai-advisor 2>&1 | head -20 || npx tsc --noEmit supabase/functions/ai-advisor/index.ts 2>&1 | head -20
```
Deno edge functions are not covered by the repo's main tsconfig; if neither command produces a usable result, say so in your report rather than claiming a clean type-check. At minimum, re-read every changed hunk and confirm `tenantId` is in scope at each use.

- [ ] **Step 9: Commit and push**

```bash
git add supabase/functions/ai-advisor/index.ts supabase/functions/main/verify_jwt_map.ts
git commit -m "fix(ai-advisor): reject anonymous callers and scope all reads to the caller's tenant

The function called requireAuth but only logged a warning on failure and
continued in anonymous mode, and it was exempted from the main router's
JWT check - so it was genuinely anonymously invocable. Its rates query
and its quote cache both used the service-role client with no tenant
predicate, so an anonymous caller could read across tenants.

- Hard 401 on auth failure, 403 when the caller has no tenant
- Removes the verify_jwt_map exemption so the router gates it too
- Scopes the rates read, the cache read, and the cache write by tenant_id

The rates query keeps the service-role client deliberately: public.rates
has RLS enabled with zero policies, so a JWT-scoped client would return
zero rows and silently kill the feature."
```

---

### Task 3: Admin-gate `generate-embedding`

**Files:**
- Modify: `supabase/functions/generate-embedding/index.ts`

**Interfaces:**
- Consumes: `requireServiceRoleOrAdmin` from `_shared/auth.ts`.
- Produces: a `generate-embedding` that rejects non-admin callers in its own body.

This function is already gated by the router (it is absent from `VERIFY_JWT_MAP`, so JWT is required). It is protected by omission rather than decision, and behind that gate it performs unguarded service-role writes — `admin.from("knowledge_base").update(...)` at lines 46 and 61, `admin.from("master_hts").update(...)` at lines 78 and 93. This adds the missing second line of defence.

- [ ] **Step 1: Add the import**

At the top of `supabase/functions/generate-embedding/index.ts`, alongside the existing imports:

```ts
import { requireServiceRoleOrAdmin } from "../_shared/auth.ts";
```

- [ ] **Step 2: Add the gate at the start of the handler**

The handler currently begins:

```ts
serveWithLogger(async (req, logger, supabase) => {
  if (req.method === "OPTIONS") return new Response(null);
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });

  const payload = (await req.json()) as Payload;
```

Insert the gate after the method checks and before `req.json()`:

```ts
  const { authorized, status, error } = await requireServiceRoleOrAdmin(req, supabase, logger);
  if (!authorized) {
    return new Response(
      JSON.stringify({ error: error || "Forbidden" }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }

  const payload = (await req.json()) as Payload;
```

`supabase` here is the service-role client `serveWithLogger` injects, which is what `requireServiceRoleOrAdmin` expects as its `supabaseAdmin` argument.

- [ ] **Step 3: Confirm nothing else calls this function**

```bash
grep -rn "generate-embedding" --include=*.ts --include=*.tsx --include=*.sql --include=*.toml . | grep -v node_modules | grep -v "^./.worktrees/" | grep -v "^./supabase/functions/generate-embedding/"
```
Expected: only `supabase/functions/main/function_importers.ts:125`. If anything else appears, a caller exists that this gate may break — **report it before committing**.

- [ ] **Step 4: Commit and push**

```bash
git add supabase/functions/generate-embedding/index.ts
git commit -m "fix(generate-embedding): require service-role or admin

The function had no in-body auth of any kind behind service-role writes
to knowledge_base and master_hts. It is gated today only because it is
absent from verify_jwt_map - by omission rather than decision - so it
had no second line of defence if that ever changed."
```

---

### Task 4: Delete the client-side OpenAI fallback

**Files:**
- Modify: `src/hooks/useAiAdvisor.ts` (the `VITE_OPENAI_API_KEY` read at line 40 and its enclosing fallback block)
- Modify: `src/features/module-communications/components/email/EmailToLeadDialog.tsx` (the same pattern at line 182)

**Interfaces:**
- Consumes: nothing.
- Produces: no client-side code path that reads an AI provider key.

Any `VITE_*` variable is inlined into the production bundle at build time. The variable is not currently set in the frontend's Coolify build env and the live bundle scans clean, so there is **no behaviour change today** — this removes the trap so that setting the variable later cannot publish a key to every visitor.

- [ ] **Step 1: Remove the fallback from `useAiAdvisor.ts`**

Read the file first. The fallback begins with the comment `// Fallback 1: Try Client-Side OpenAI Call if Supabase fails (and it's not an auth error)` and contains `const clientSideKey = import.meta.env.VITE_OPENAI_API_KEY;` guarded by `action === 'generate_smart_quotes' && clientSideKey && clientSideKey.startsWith('sk-')`.

Delete the entire fallback branch, including its inline `systemPrompt` and the direct `fetch` to OpenAI. Leave intact: the preceding `error.status === 401 || error.code === 401` early return, and whatever the function returns when no fallback applies. The function must still return a well-formed `{ data, error }` result on the failure path — verify by reading the surrounding function, not by assuming.

- [ ] **Step 2: Remove the fallback from `EmailToLeadDialog.tsx`**

Same pattern at line 182. Read the enclosing block, delete the client-side OpenAI branch, and confirm the component still handles the edge-function failure path coherently (an error state or a user-visible message — not a silent no-op).

- [ ] **Step 3: Confirm no client code reads any provider key**

```bash
grep -rn "VITE_OPENAI_API_KEY\|api.openai.com\|api.anthropic.com" src/ --include=*.ts --include=*.tsx
```
Expected: no matches. Any remaining hit is either another instance of the same trap (report it) or a comment (fine — say which).

- [ ] **Step 4: Type-check and build**

```bash
npm run typecheck
npm run build
```
Expected: both succeed. The build must pass before Task 5 deploys the frontend — a build failure discovered at deploy time costs a full round trip.

- [ ] **Step 5: Commit and push**

```bash
git add src/hooks/useAiAdvisor.ts src/features/module-communications/components/email/EmailToLeadDialog.tsx
git commit -m "fix(client): remove direct-to-OpenAI fallback

Both call sites fell back to a browser-held OpenAI key read from
VITE_OPENAI_API_KEY. Any VITE_* variable is inlined into the public
bundle at build time, so setting it once would publish the key to every
visitor. The variable is unset in production today, so this is no
behaviour change - it removes the trap rather than relying on a config
value staying absent."
```

---

### Task 5: Deploy, verify, and push

**Files:** none (deployment and verification only).

**Interfaces:**
- Consumes: the commits from Tasks 1–4.
- Produces: fixes live and verified; the audit trail and fix commits pushed together.

- [ ] **Step 1: Deploy the edge functions — CORRECTED, do not use Coolify for this**

The original instruction here was to trigger a Coolify deploy of the stack. **That is a no-op for edge functions** — see the corrected deployment section in Global Constraints. Functions live in a host bind mount, not the git clone.

Deploy each changed function file individually:

```bash
D=/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions

# For each changed file — ai-advisor/index.ts (Task 2) and
# generate-embedding/index.ts (Task 3); main/verify_jwt_map.ts is already deployed:

# 1. Diff the deployed copy against what you are replacing it with, CR-normalised.
ssh hostinger-vps "cat $D/<path>" > /tmp/deployed.ts
git show HEAD:supabase/functions/<path> > /tmp/new.ts
diff --strip-trailing-cr /tmp/deployed.ts /tmp/new.ts
```
Expect the diff to show **only your intended changes**. Anything else means the deployed snapshot has drifted from `main` for that file — **stop and report** rather than overwriting someone else's change.

```bash
# 2. Back up, copy in, verify:
ssh hostinger-vps "cp $D/<path> /tmp/backup-<name>-$(date -u +%Y%m%d-%H%M%S).ts"
git show HEAD:supabase/functions/<path> > /tmp/staged.ts   # LF, from the commit
scp /tmp/staged.ts hostinger-vps:/tmp/staged.ts
ssh hostinger-vps "cp /tmp/staged.ts $D/<path> && rm -f /tmp/staged.ts"
# confirm a distinctive string from your change is present in the deployed file

# 3. Restart ONLY the functions container:
C=$(ssh hostinger-vps "docker ps --filter name=functions-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'")
ssh hostinger-vps "docker restart $C"
```
Then confirm the container returns to `healthy` before verifying behaviour.

- [ ] **Step 2: Verify `generate-embedding` rejects a non-admin caller**

Generate a session for the known test account (`phase4-batch1-verify-test@sosservices.online`, which has no tenant or admin role) and call the function with that token. Read the service-role key fresh from the live `auth` container — resolve its name first, it changes on redeploy:

```bash
ssh hostinger-vps "docker ps --filter name=auth-i64jlyerora7ao9vkw5sweh3 --format '{{.Names}}'"
```
Expected result: **403** (authenticated but not admin), not 200. A 401 would mean the router rejected it before the body ran — also acceptable, but note which you got.

- [ ] **Step 3: Verify `ai-advisor` rejects an authenticated caller with no tenant**

Using the same test-account token, POST to `ai-advisor` with `{"action":"generate_smart_quotes","payload":{}}`.

Expected: **403** with `"No tenant assignment for this user"` — this exercises Step 2 of Task 2 and confirms the tenant gate works, without needing a real business account.

- [x] **Step 4: The unauthenticated probe** — DONE, authorized and run during the out-of-band fast-track

Both directions are already on record for `ai-advisor`, using the identical request:

| | Status | Body |
|---|---|---|
| Before the fix | `200` | `{"unit":"kg","confidence":0.4,"source":"ai-mock"}` |
| After the fix | `401` ×3 | `{"error":"Missing Authorization header"}` |

The `401` is emitted by the `main` router, so the request is now rejected before the function body runs — confirming both layers. `suggest_unit` was chosen deliberately: it resolves from an in-code lookup table (`"source":"ai-mock"`) and makes no provider call, so the probe cost nothing.

**Re-run this same probe after deploying Task 2's changes** to confirm the tenant-scoping work did not regress the auth gate. That re-run needs no fresh sign-off — it is now a regression check on a closed endpoint, not a probe of an open one.

- [ ] **Step 5: Deploy the frontend (pin first)**

```bash
git rev-parse main    # full 40-char SHA
```
PATCH `git_commit_sha` on app `b2lt2if6x6ovekc4tj7vg8tx` to that SHA, **then** trigger the deploy, then poll to `finished`. Deploying without updating the pin silently rebuilds the old commit.

- [ ] **Step 6: Re-scan the rebuilt bundle**

```bash
BUNDLE=$(curl -s https://app.sosservices.online/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
echo "bundle: $BUNDLE"
curl -s "https://app.sosservices.online${BUNDLE}" | grep -coE "sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,}|sk-ant-[A-Za-z0-9_-]{20,}"
```
Expected: `0`. Report the bundle name and the count.

- [ ] **Step 7: Push everything**

Only now, and only if Steps 1–6 passed. This pushes the 11 unpushed audit commits together with this plan's fix commits, so the public history describes resolved rather than live weaknesses:

```bash
git push origin main
```

- [ ] **Step 8: Report**

State plainly: each verification's actual result, whether the unauthenticated probe was authorized and run, what was pushed, and the open question from Task 1 about whether Supabase Cloud production needs the same `ai_quote_cache` migration.
