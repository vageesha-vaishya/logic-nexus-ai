# P0 AI Security Fixes — Design

## Background

The AI/LLM audit (`docs/audits/2026-09-05-ai-llm-audit-findings.md`) produced a
six-part remediation roadmap. This spec covers **sub-project C, narrowed to its
three P0 items only** — the fixes that are correct to make regardless of how any
remaining open question resolves.

The audit was corrected mid-analysis (commit `ff71e359`) after a post-audit check
found it had missed the `main` router — the layer that actually enforces
per-function JWT on this deployment. That correction materially changed this
sub-project's scope, so the current facts, not the audit's original ones, are
what this spec is built on:

- **`ai-advisor` is the single remaining Critical.** It appears in
  `VERIFY_JWT_MAP` as `false`, so the router skips its JWT check, and its own
  body swallows auth failure — genuinely anonymous.
- **`generate-embedding` is not anonymously reachable.** It is absent from
  `VERIFY_JWT_MAP`, and `main/index.ts:336`'s `!== false` lookup therefore
  requires a valid JWT. It was downgraded Critical → Medium. Its real weakness
  is having no in-body check behind unguarded service-role writes.
- **The platform-wide finding was substantially mitigated** and is not in scope
  here.

### Why these three, and why now

All three are small, well-specified, and correct independent of the two questions
still open (active reachability testing; the 85-entry map review). Completing
them also unblocks pushing the audit trail: the repository is **public**, so the
audit commits are deliberately unpushed while they describe live rather than
fixed weaknesses.

## Goal

Close the one genuinely open AI endpoint, remove a latent client-side credential
trap, and add a missing second line of defence — without touching the larger
architectural questions the audit raised.

## Fix 1 — `ai-advisor` (Critical)

Three parts, all in `supabase/functions/ai-advisor/index.ts` plus one line
elsewhere.

### 1a. Stop swallowing auth failure

Current code at `index.ts:50-53`:

```ts
const { user, error: authError } = await requireAuth(req);
if (authError || !user) {
  logger.warn("Auth failed, continuing in anonymous mode", { correlationId, error: authError });
}
```

Execution continues; `user?.id ?? 'anonymous'` is used downstream. Replace with a
hard `401`. This is exactly the usage `_shared/auth.ts` documents for its own
helper — the current code deviates from the pattern its dependency prescribes:

```ts
//   const { user, error, supabaseClient } = await requireAuth(req);
//   if (error) return new Response(JSON.stringify({ error }), { status: 401, headers });
```

Safe to do: the function's only caller is `src/hooks/useAiAdvisor.ts:22`, an
authenticated frontend hook. No legitimate anonymous caller exists.

### 1b. Remove the `VERIFY_JWT_MAP` exemption

Delete the `"ai-advisor": false` entry from
`supabase/functions/main/verify_jwt_map.ts`. With the entry gone, `main/index.ts`'s
`VERIFY_JWT_MAP[name] !== false` default applies and the router enforces JWT
before the function body ever runs.

This is one targeted entry, **not** the deferred 85-entry map review. Its value is
defence in depth: after 1a and 1b, the body rejects anonymous callers even if the
map is later edited, and the router rejects them even if a swallow is
reintroduced.

### 1c. Scope the `rates` query to the caller's tenant

Current query at `index.ts:266-272` filters on `mode`, `origin`, `destination`
and nothing else:

```ts
const { data: rates } = await supabase
  .from('rates').select('base_price')
  .eq('mode', mode).ilike('origin', `%${origin}%`)
  .ilike('destination', `%${destination}%`).limit(5);
```

`supabase` here is the **service-role** client injected by `serveWithLogger`
(`_shared/logger.ts:210-211` constructs it from `SUPABASE_SERVICE_ROLE_KEY`), so
RLS is bypassed. The `rates` table has `tenant_id` and `franchise_id` columns.
Tenant-scoped table + RLS-bypassing client + no tenant predicate = cross-tenant
read.

**Fix by adding an explicit `.eq('tenant_id', <caller's tenant>)`.** The caller's
tenant is resolved from `user_roles` by `user.id`, the same lookup
`requireServiceRoleOrAdmin` already performs.

**Deliberately not fixed by switching to a user-scoped client.** That is the
architecturally tidier instinct and it would be wrong here: `rates` has RLS
**enabled with zero policies**, which in Postgres is deny-all for any
non-service-role caller. `requireAuth` returns a JWT-scoped `supabaseClient` that
respects RLS — using it for this query would return zero rows and silently remove
the historical-context feature rather than securing it. Explicit filtering is the
correct surgical fix.

*(That `rates` carries RLS-enabled-with-no-policies is itself worth recording —
it means no authenticated user can read the table directly, and the feature works
only because it bypasses RLS. Adding proper policies is a legitimate improvement
but is a shared-table change affecting every other consumer, so it is out of
scope here and noted for a future pass.)*

## Fix 2 — `generate-embedding` (Medium)

Add `requireServiceRoleOrAdmin` from `_shared/auth.ts` to the body of
`supabase/functions/generate-embedding/index.ts`. Signature:

```ts
requireServiceRoleOrAdmin(req, supabaseAdmin, logger?)
  → { authorized, status, error, user, isServiceRole }
```

The function performs unguarded service-role writes —
`admin.from("knowledge_base").update(...)` at lines 46 and 61, and
`admin.from("master_hts").update(...)` at lines 78 and 93 — with no in-body auth
of any kind. It is protected today only because it is absent from
`VERIFY_JWT_MAP`, i.e. by omission rather than by decision.

Keep the function rather than delete it: it batch-backfills embeddings, and the
audit separately found pgvector columns on 6 tables at 0% populated (F-5.6), so a
backfill is plausibly needed. Admin-gating is the right level for a maintenance
endpoint.

## Fix 3 — Client-side OpenAI fallback (High)

Delete the direct-to-OpenAI fallback blocks in:

- `src/hooks/useAiAdvisor.ts` (the `VITE_OPENAI_API_KEY` read at line 40 and the
  fallback block around it)
- `src/features/module-communications/components/email/EmailToLeadDialog.tsx`
  (the same pattern at line 182)

Any `VITE_*` variable is inlined into the production bundle at build time, so
setting this variable once would publish the key to every visitor. The variable
is **not** currently set in the frontend's Coolify build env, and the live bundle
was scanned clean (audit F-3.3, count 0) — so there is no behaviour change today.

Delete the fallback rather than merely leaving the variable unset: relying on a
configuration value staying absent is not a control, and the next person to
reasonably conclude "the app needs an OpenAI key" would publish it.

## Deployment and verification

**Edge functions** (Fixes 1 and 2) deploy to the self-hosted Supabase stack,
Coolify app `i64jlyerora7ao9vkw5sweh3`.

**The frontend** (Fix 3) is Coolify app `b2lt2if6x6ovekc4tj7vg8tx` and is pinned
to a specific `git_commit_sha` rather than tracking `main`. Its pin must be
PATCHed to the new commit **before** triggering a deploy, or the deploy silently
rebuilds the old commit.

**Verification of Fix 1 requires a live unauthenticated request** to `ai-advisor`,
expecting `401`. This is the same request the audit deferred pending
authorization — the difference is that it now confirms an endpoint is *closed*
rather than probing whether it is open, and a `401` is the success condition. It
still needs explicit sign-off before running, and it is the only live probe in
this sub-project.

Other verification is observational: confirm the map entry is gone, confirm the
tenant filter is present, confirm the client fallback code no longer exists and
the rebuilt bundle still scans clean.

**Push ordering.** The repository is public. The audit commits and these fix
commits should be pushed together once the fixes are deployed and verified, so
the public history describes resolved rather than live weaknesses.

## Out of scope

- The 85-entry `VERIFY_JWT_MAP` review (the deferred platform-wide decision).
- Adding RLS policies to `rates`, or changing `serveWithLogger` to stop injecting
  a service-role client globally — both are shared-surface changes affecting many
  consumers.
- Gateway consolidation (B), observability (D), compliance mapping (E), rollout
  (F).
- Any other finding from the audit, including the remaining High-severity ones.

## Success criteria

- An unauthenticated request to `ai-advisor` returns `401`.
- `ai-advisor`'s `rates` query cannot return rows belonging to a tenant other
  than the caller's.
- `generate-embedding` rejects a valid non-admin JWT.
- `VITE_OPENAI_API_KEY` appears nowhere in `src/`, and the rebuilt production
  bundle scans clean for credential-shaped strings.
- No behaviour change for authenticated users of either function or of the two
  frontend features.
