# Phase 4 Batch 1: Edge Function Router + Secret-Free Functions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the `main` router function self-hosted's Edge Runtime needs (per its already-configured `--main-service` mode), and deploy the 88 production Edge Functions that need no third-party secrets — the first of several secret-availability-ordered batches from the Phase 4 design spec.

**Architecture:** One router (`supabase/functions/main/index.ts`) dynamically dispatches every `/functions/v1/<name>` request to that function's own handler, performing JWT verification itself (via the same `requireAuth()`/GoTrue delegation pattern functions already use internally) for any function not explicitly marked `verify_jwt = false` in `supabase/config.toml` — reconstructing production's actual per-function enforcement matrix, since self-hosted's Edge Runtime only exposes one global toggle. A generated data file (`verify_jwt_map.ts`) is the single source of truth the router consults, covering every function this migration will ever touch (not just this batch), so later batches never need to regenerate it.

**Tech Stack:** Deno/TypeScript (matches every existing function), `supabase/functions/_shared/auth.ts`'s existing `requireAuth()` for JWT validation (delegates to GoTrue, works identically against self-hosted's own Auth service), bash/scp for the bind-mount deployment (matching Phase 1-3's established pattern).

## Global Constraints

- Self-hosted VPS via SSH alias `hostinger-vps`. The `functions` container is `logic-nexus-functions` (per `docker-compose.yml`'s `container_name`) on Coolify application `i64jlyerora7ao9vkw5sweh3`.
- The bind-mount live path on the VPS is `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions/` (same pattern as `kong.yml`'s reseed path documented in the README's "Operational gotcha" section — confirm the exact `volumes/functions` sub-path via `ssh hostinger-vps "ls /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/"` before the first reseed, since this is the first time this specific bind-mount has ever been populated and its directory may not exist yet).
- A `functions` container restart is a state-changing step on shared infrastructure — run the four standard health-check curls after every restart:
  ```bash
  ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
  ```
- Self-hosted's function endpoints are reachable at `https://supabase.sosservices.online/functions/v1/<name>` (Kong routes `/functions/v1` to the `functions` service per Phase 1's `kong.yml`).
- This plan never writes to production. All production interactions (function listing, reading `config.toml`) are reads against files already in this repo or read-only MCP calls.
- 3 production-active functions are explicitly OUT OF SCOPE for this and every future Phase 4 batch, discovered during planning and not resolvable by this migration: `feature-flags` (no local source exists anywhere in the repo — cannot deploy what isn't there), `migrate-flypal-directives` (superseded locally by `migrate-flypal-directives-v2`/`-v3`, no exact-name match), and `flypal_configured_directives_id_match_with_code_form` (lowercase `code` — a legacy duplicate deployment; the correctly-cased `flypal_configured_directives_id_match_with_Code_form` is the one with local source and IS in this batch). Do not attempt to deploy the 3 excluded names under any batch.

---

### Task 1: Author the router function and its JWT verification map

**Files:**
- Create: `supabase/functions/main/verify_jwt_map.ts`
- Create: `supabase/functions/main/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (first task in this plan).
- Produces: `verify_jwt_map.ts` exports `export const VERIFY_JWT_MAP: Record<string, boolean>`, consumed by `index.ts` in this same task and by no other task in this plan (Task 2 only deploys files, it doesn't import this module). Any LATER batch's plan reuses this same map file as-is — it already covers all 132 functions with a local/production name match, not just this batch's 88, so it needs no regeneration when future batches add more functions.

- [ ] **Step 1: Write `verify_jwt_map.ts` with the real, derived-from-`config.toml` data**

This data was derived by parsing `supabase/config.toml`'s 85 explicit `verify_jwt = false` entries and cross-referencing against the 132 functions that have both a production deployment and local source (excluding the 3 named in Global Constraints). Functions not listed here default to `true` (the map only needs entries the router will actually look up — see Step 3's lookup logic, which treats a missing key as `true`, matching production's own implicit default).

```typescript
// supabase/functions/main/verify_jwt_map.ts
//
// Per-function JWT enforcement, derived from supabase/config.toml's explicit
// `verify_jwt = false` entries. Any function NOT in this map defaults to
// `true` (Supabase's own platform default) - see index.ts's lookup.
//
// Regenerate by re-deriving from config.toml if it changes; this file is a
// snapshot, not a live read of config.toml (avoids adding a TOML parser
// dependency to the edge runtime for a value that changes rarely).
export const VERIFY_JWT_MAP: Record<string, boolean> = {
  "admin-reset-password": false,
  "anomaly-detection": false,
  "anomaly-detector": false,
  "autonomous-email": false,
  "calculate-lead-score": false,
  "carrier-scoring": false,
  "check-expiring-documents": false,
  "cleanup-logs": false,
  "create-franchise": false,
  "create-user": false,
  "delete-user": false,
  "email-scan": false,
  "email-stats": false,
  "escalate-message": false,
  "execute-sql-external": false,
  "export-data": false,
  "fleet-utilization": false,
  "get-account-label": false,
  "get-contact-label": false,
  "get-opportunity-full": false,
  "get-opportunity-label": false,
  "get-service-label": false,
  "ingest-linkedin": false,
  "ingest-web": false,
  "lead-event-webhook": false,
  "lead-scoring": false,
  "list-edge-functions": false,
  "margin-optimizer": false,
  "metrics-quotation": false,
  "mgl-quotation-api": false,
  "moderate-message": false,
  "plan-event-webhook": false,
  "predict-eta": false,
  "process-email-retention": false,
  "process-lead-assignments": false,
  "process-scheduled-emails": false,
  "process-sequences": false,
  "rate-engine": false,
  "remote-import": false,
  "restore-quotation-version": false,
  "revenue-forecasting": false,
  "route-email": false,
  "save-quotation-version": false,
  "search-emails": false,
  "send-web": false,
  "send-whatsapp": false,
  "subscription-plans": false,
  "sync-all-mailboxes": false,
  "sync-cn-hs-data": false,
  "sync-emails": false,
  "sync-emails-v2": false,
  "sync-hts-data": false,
  "win-probability": false,
  // Remaining functions with verify_jwt=false in config.toml, not in this
  // batch (needs-secrets or excluded) but included so this map stays
  // complete for future batches without regeneration:
  "ai-advisor": false,
  "ai-agent": false,
  "ai-message-assistant": false,
  "alert-notifier": false,
  "analyze-cargo-damage": false,
  "analyze-email-threat": false,
  "categorize-document": false,
  "classify-email": false,
  "container-demand": false,
  "domains-register": false,
  "domains-verify": false,
  "ensemble-demand": false,
  "exchange-oauth-token": false,
  "extract-bol-fields": false,
  "extract-invoice-items": false,
  "forecast-demand": false,
  "generate-quote-pdf": false,
  "ingest-email": false,
  "ingest-telegram": false,
  "nexus-copilot": false,
  "portal-chatbot": false,
  "process-franchise-import": false,
  "push-migrations-to-target": false,
  "risk-scoring": false,
  "route-optimization": false,
  "salesforce-sync-opportunity": false,
  "self-service-onboarding": false,
  "send-email": false,
  "smart-reply": false,
  "suggest-transport-mode": false,
};
```

This full map (all 83 `verify_jwt=false` functions that have both a production deployment and local source, out of `config.toml`'s 85 total `false` entries) was derived and independently reconciled during planning via the script below. The other 2 (`comms-unsubscribe`, `comms-webhook-resend`) are configured in `config.toml` and exist locally, but are NOT in production's current active function list — they belong to the ~15 unused/deprecated local directories the design spec's Non-Goals already excludes from every batch, not a new category of problem. Neither is one of the 3 functions named in this plan's Global Constraints (those are the opposite case: production-active with no reliable local match).
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
**Note for whoever runs this again:** `config.toml` has Windows CRLF line endings — a naive regex capture across a `\n`-anchored pattern picks up a trailing `\r` on every captured name (invisible in a terminal, but breaks every string comparison silently, exactly as it did once during this plan's own authoring). Strip it (`f.rstrip()`, included above) before comparing names.

- [ ] **Step 2: Verify the derivation script's output count matches `config.toml`'s actual count**

```bash
grep -c "verify_jwt = false" supabase/config.toml
```
Expected: `85` — this is `config.toml`'s raw total, not the map's key count. `verify_jwt_map.ts` should have exactly `83` keys: 2 of the 85 (`comms-unsubscribe`, `comms-webhook-resend`) are configured locally but not currently active on production, so they're correctly excluded from this map (which only covers functions this migration actually deploys). Verify:
```bash
grep -c ': false,$' supabase/functions/main/verify_jwt_map.ts
```
Expected: `83`. If this doesn't match, reconcile against the derivation script's output (minus `comms-unsubscribe`/`comms-webhook-resend`) before continuing.

- [ ] **Step 3: Write `index.ts`, the router itself**

```typescript
// supabase/functions/main/index.ts
//
// Self-hosted's Edge Runtime is configured with `--main-service` pointing
// here (see deploy/selfhosted-supabase/docker-compose.yml's `functions`
// service). Every request under /functions/v1/* arrives here first; this
// router dispatches to the target function's own handler after performing
// JWT verification for any function not explicitly exempted.
import { requireAuth } from "../_shared/auth.ts";
import { VERIFY_JWT_MAP } from "./verify_jwt_map.ts";

// @ts-ignore
declare const Deno: any;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  // Path arrives as /functions/v1/<name>[/...] from Kong; extract <name>.
  const segments = url.pathname.split("/").filter(Boolean);
  const functionsIdx = segments.indexOf("functions");
  const name = functionsIdx >= 0 && segments.length > functionsIdx + 2
    ? segments[functionsIdx + 2]
    : null;

  if (!name) {
    return new Response(
      JSON.stringify({ error: "Could not determine target function from path" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Default true (Supabase's own platform default) when the map has no
  // entry - matches production's behavior for any function not explicitly
  // exempted in config.toml.
  const requiresJwt = VERIFY_JWT_MAP[name] !== false;

  if (requiresJwt) {
    const { user, error } = await requireAuth(req);
    if (error || !user) {
      return new Response(
        JSON.stringify({ error: error || "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  let handlerModule;
  try {
    handlerModule = await import(`../${name}/index.ts`);
  } catch (_err) {
    return new Response(
      JSON.stringify({ error: `Function '${name}' not found or not deployed` }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  if (typeof handlerModule.default !== "function" && typeof handlerModule.handler !== "function") {
    // Functions in this codebase call serveWithLogger(...)/Deno.serve(...)
    // at module load time (see _shared/logger.ts's serveWithLogger), which
    // registers its own listener rather than exporting a callable handler.
    // Re-invoking the module's own registered Deno.serve handler directly
    // isn't possible from here without changing every function's export
    // shape - see this task's Step 4 for how this is resolved.
    return new Response(
      JSON.stringify({ error: `Function '${name}' does not export a callable handler` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const handler = handlerModule.default ?? handlerModule.handler;
  return handler(req);
});
```

- [ ] **Step 4: Resolve the handler-shape mismatch Step 3 flagged**

Read `supabase/functions/_shared/logger.ts`'s `serveWithLogger` implementation:
```bash
cat supabase/functions/_shared/logger.ts
```
Determine whether `serveWithLogger` (used by most functions, per Task brief's earlier sampling of `admin-reset-password/index.ts`) calls `Deno.serve()` internally (registering a process-wide listener, incompatible with per-request dynamic dispatch from a router) or returns/exports a plain `(req) => Response` handler function the router can call directly. If it calls `Deno.serve()` internally: this is a real, non-trivial compatibility problem between the existing per-function code (written for Supabase Cloud's one-function-per-isolate model) and self-hosted's main-service model, and needs a decision from the plan owner before Task 2 can deploy anything real — STOP and report this specific finding rather than guessing at a fix, since the resolution (e.g., a `serveWithLogger` variant that returns a handler instead of calling `Deno.serve` when running under the router, detected via an env var like `EDGE_RUNTIME_MAIN_SERVICE`) touches shared code every function depends on and deserves explicit sign-off, not an implementer's unilateral judgment call. If it already returns a callable handler (no internal `Deno.serve()` call): update Step 3's router code above to match the actual export shape precisely, and note in your report which case applied.

- [ ] **Step 5: Local sanity check (no live infra needed)**

```bash
cd supabase/functions
deno check main/index.ts
```
If `deno` isn't installed in this environment, skip this specific command and instead visually trace `main/index.ts`'s imports against `verify_jwt_map.ts`'s actual exports and `_shared/auth.ts`'s actual exported function name (`requireAuth`) to catch any typo/signature mismatch before deployment - state which method you used in your report.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/main/
git commit -m "feat(functions): add self-hosted main router with per-function JWT enforcement"
```

---

### Task 2: Deploy Batch 1 (router + 88 secret-free functions) and verify

**Files:**
- Create: `deploy/selfhosted-supabase/scripts/phase4-batch1-functions.txt`

**Interfaces:**
- Consumes: `supabase/functions/main/` from Task 1 (must exist and have passed Task 1's Step 4 resolution — if Task 1 stopped at Step 4 needing a decision, this task cannot proceed until that's resolved).
- Produces: nothing further tasks in later batches depend on programmatically — later batches independently reseed their own additional function directories onto the same bind-mount without needing anything from this task's outputs beyond the now-working router.

- [ ] **Step 1: Write the Batch 1 function list**

```
accept-invite
admin-reset-password
anomaly-detection
anomaly-detector
autonomous-email
calculate-lead-score
calculate-quote-financials
carrier-scoring
check-expiring-documents
cleanup-logs
clone-user-from-example
create-franchise
create-user
delete-user
discover-email-settings
email-scan
email-stats
emit-event
escalate-message
execute-sql-external
export-data
fleet-utilization
flypal_configured_directives_create_tasks
flypal_configured_directives_id_match
flypal_configured_directives_id_match_with_Code_form
flypal_configured_directives_parse_frequency
generate-aircraft-tasks
get-account-label
get-contact-label
get-opportunity-full
get-opportunity-label
get-service-label
ingest-linkedin
ingest-web
ingest-x
lead-event-webhook
lead-scoring
list-edge-functions
margin-optimizer
markets-compute-nav
markets-ingest-commodity-prices
markets-ingest-corporate-actions
markets-ingest-fo-prices
markets-ingest-fx-rates
markets-ingest-mf-nav
markets-ingest-news
markets-ingest-prices
markets-llm-config
markets-push-notify
markets-watchlists
metrics-quotation
mgl-quotation-api
migrate-flypal-directives-v2
migrate-flypal-directives-v3
moderate-message
parse-directive-frequency-temp
payment-webhook-handler
plan-event-webhook
portfolio-pnl
predict-eta
process-email-retention
process-lead-assignments
process-scheduled-emails
process-sequences
provision-retail-user
quote-event-webhook
rate-engine
reconcile-quote
remote-import
restore-quotation-version
retail-risk-score
revenue-forecasting
route-email
save-quotation-version
scheduled-reconcile
search-emails
send-web
send-whatsapp
subscription-plans
sync-all-mailboxes
sync-cn-hs-data
sync-emails
sync-emails-v2
sync-hts-data
track-email
update-aircraft-template-model-json
verify-email-credentials
win-probability
```
Save as `deploy/selfhosted-supabase/scripts/phase4-batch1-functions.txt` (88 lines). Verify: `wc -l deploy/selfhosted-supabase/scripts/phase4-batch1-functions.txt` must show `88`.

- [ ] **Step 2: Confirm none of these 88 actually reference a non-`SUPABASE_*` secret (re-verify, don't just trust this plan's classification)**

```bash
while read -r fn; do
  hits=$(grep -rhoE "Deno\.env\.get\(['\"][A-Z_]+['\"]" "supabase/functions/$fn" "supabase/functions/_shared" 2>/dev/null | grep -v "SUPABASE_" | sort -u)
  if [ -n "$hits" ]; then
    echo "MISCLASSIFIED: $fn uses: $hits"
  fi
done < deploy/selfhosted-supabase/scripts/phase4-batch1-functions.txt
```
Expected: no output. This checks each function's own directory plus the shared imports it might use — a coarser but independent check than Task brief's original transitive-import trace. If this finds a hit, remove that function from the list (it belongs in a later, secret-dependent batch) and update the count check in Step 1.

- [ ] **Step 3: Reseed the bind-mount on the VPS**

First, confirm the live path:
```bash
ssh hostinger-vps "ls /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/ | grep -i function"
```
Then copy the router, shared helpers, root config files, and each of the 88 function directories (adjust the destination path based on what Step 3's `ls` actually shows — this is the first time this bind-mount has been populated, so don't assume the exact same reseed command Phase 1 used for `kong.yml` applies verbatim):
```bash
scp -r supabase/functions/main supabase/functions/_shared supabase/functions/_types \
  supabase/functions/deno.json supabase/functions/import_map.json supabase/functions/types.d.ts \
  hostinger-vps:/tmp/phase4-functions-staging/
while read -r fn; do
  scp -r "supabase/functions/$fn" "hostinger-vps:/tmp/phase4-functions-staging/"
done < deploy/selfhosted-supabase/scripts/phase4-batch1-functions.txt
ssh hostinger-vps "rm -rf /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions/* && cp -r /tmp/phase4-functions-staging/* /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/volumes/functions/ && rm -rf /tmp/phase4-functions-staging"
```

- [ ] **Step 4: Restart the functions container and confirm it stays up**

```bash
ssh hostinger-vps "docker restart logic-nexus-functions"
sleep 5
ssh hostinger-vps "docker ps --filter name=logic-nexus-functions --format '{{.Names}}\t{{.Status}}'"
```
Expected: `Up` (healthy once its healthcheck passes, per `docker-compose.yml`'s TCP-port check). If it's crash-looping, capture `ssh hostinger-vps "docker logs logic-nexus-functions --tail 100"` before proceeding — a bad import or the Step 4-from-Task-1 handler-shape issue would surface here first if it wasn't fully caught earlier.

- [ ] **Step 5: Run the four standard health-check curls**

```bash
ssh hostinger-vps "curl -s -o /dev/null -w 'app: %{http_code}\n' https://app.sosservices.online/; curl -s -o /dev/null -w 'api: %{http_code}\n' https://api.sosservices.online/health; curl -s -o /dev/null -w 'amro: %{http_code}\n' https://amro.sosservices.online/health; curl -s -o /dev/null -w 'aviation: %{http_code}\n' https://app.aviation.sosservices.online/"
```
Expected: all four `200`.

- [ ] **Step 6: Verify router correctness — a `verify_jwt=false` function is callable without auth**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://supabase.sosservices.online/functions/v1/list-edge-functions
```
Expected: NOT `401` (whatever status `list-edge-functions` itself returns for an unauthenticated call is fine — the point is the router didn't block it before the function's own code ran).

- [ ] **Step 7: Verify router correctness — a `verify_jwt=true` function is rejected without auth**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://supabase.sosservices.online/functions/v1/calculate-quote-financials
```
Expected: `401` (the router's own `requireAuth()` check rejects it before ever importing the function's handler).

- [ ] **Step 8: Verify a request WITH a valid JWT reaches the verify_jwt=true function**

Obtain a valid JWT the same way this project has for prior verification (a service-role JWT satisfies `requireAuth()`'s `getUser`/`getClaims` check just like a real user JWT does, since both are valid Supabase-issued JWTs):
```bash
SELFHOSTED_KEY="$(ssh hostinger-vps "grep -E '^SERVICE_ROLE_KEY=' /data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env | cut -d= -f2-")"
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $SELFHOSTED_KEY" \
  https://supabase.sosservices.online/functions/v1/calculate-quote-financials
```
Expected: NOT `401` (whatever `calculate-quote-financials` itself returns for a JWT-authenticated-but-otherwise-empty request is fine — the point is the router let it through to the function).

- [ ] **Step 9: Spot-check 3 more functions across the batch for basic reachability**

Pick 3 more names from `phase4-batch1-functions.txt` spanning different areas (e.g. `markets-watchlists`, `sync-hts-data`, `export-data`) and confirm each returns something other than the router's own `404 Function not found` message (proving the dynamic import resolved correctly for functions beyond the 2 already tested):
```bash
for fn in markets-watchlists sync-hts-data export-data; do
  echo "$fn: $(curl -s -o /dev/null -w '%{http_code}' https://supabase.sosservices.online/functions/v1/$fn)"
done
```
Expected: none return `404` (a 401/400/500/200 all indicate the router found and invoked the function; only 404 means the dynamic import itself failed).

- [ ] **Step 10: Commit**

```bash
git add deploy/selfhosted-supabase/scripts/phase4-batch1-functions.txt
git commit -m "feat(selfhost-supabase): deploy Phase 4 Batch 1 (router + 88 secret-free functions)"
```

- [ ] **Step 11: Document this phase in the README**

Add a "Phase 4: Edge Functions" section to `deploy/selfhosted-supabase/README.md` (after "Phase 3: Storage Sync"), covering: the router's role and location, the `verify_jwt_map.ts` mechanism and how to regenerate it, the bind-mount reseed procedure for this specific volume (including the exact live path discovered in Step 3, now that it's known), which batch has been deployed so far (Batch 1, 88 functions, listed by reference to `phase4-batch1-functions.txt`) and which are still pending (everything needing a third-party secret, plus the 3 excluded functions from Global Constraints), and the four standard health-check curls.

```bash
git add deploy/selfhosted-supabase/README.md
git commit -m "docs(selfhost-supabase): document Phase 4 Batch 1 (edge function router)"
```

---

## Plan Self-Review

**Spec coverage:** Design spec §2 Goals → Task 1 (router authoring, matches "standard Supabase-documented self-hosted pattern"), Task 1 Steps 1-2 (secret classification already done during planning, re-verified live in Task 2 Step 2 rather than only trusted from the brief), Task 2 (batched deployment ordered by secret availability - this plan IS Batch 1). §3b's JWT-verification gap → Task 1 Steps 1-4 (the map + router logic) and Task 2 Steps 6-8 (proving both enforcement paths actually work, not just that the code compiles). §5 Verification Plan's 5 items → Task 2 Steps 6-9 (router correctness + JWT matrix + spot-check reachability), Step 5 (health checks); item 5 ("no regression to already-deployed batches") doesn't apply yet since this is the first batch - noted for the next batch's plan to include. §6 Open Items: batch grouping → resolved, this plan IS the first batch, natural groups for remaining batches will be written once secrets arrive; the ~15 unused/deprecated directories → explicitly named the 3 discovered exclusions rather than silently omitting them, and confirmed the other ~12 simply aren't in production's active list at all (never referenced in this plan since they need no exclusion logic, just aren't in the 88-list to begin with).

**Placeholder scan:** Task 1 Step 4 is the one deliberately-open item in this plan — the router's compatibility with `serveWithLogger`'s actual internal implementation could not be verified without reading that file live, so Step 4 gives the implementer a concrete decision procedure (read the file, determine which of two cases applies, STOP and escalate for one case rather than guessing) instead of assuming an answer. This is a genuine unresolved technical question this plan cannot know in advance without reading a file that changes independently of this plan, not a lazy TBD - matching the same category as Phase 2's plan leaving a live password lookup for the implementer rather than guessing it. No other TBD/TODO. All 88 function names in Task 2 Step 1 are real, independently-derived data (traced transitively through `_shared/` imports), not a placeholder list.
**Round 2, after fixing a real defect this self-review found:** `verify_jwt_map.ts`'s "second block" (the 30 `verify_jwt=false` functions outside this batch, included only for future-batch completeness) was initially fabricated — plausible-sounding names invented rather than derived, none of which actually matched `config.toml`'s real content when checked. Caught by actually running the derivation script rather than trusting the drafted table, and replaced with the real, verified 30 names. Also caught mid-fix: `config.toml` has Windows CRLF line endings, which silently broke the first cross-check attempt (every name carried a trailing `\r`, so `comm`/`grep -x` comparisons found zero matches despite real overlap existing) — Step 1 now carries an explicit warning about this for whoever re-runs the derivation later. Also caught: my own claim that "the 2 unaccounted `false` entries are among the 3 excluded functions" was itself wrong on first pass — they're actually two different, previously-undiscussed functions (`comms-unsubscribe`, `comms-webhook-resend`) that are locally present and `config.toml`-configured but not currently active on production — corrected in Step 1's text and Step 2's verification command (which now checks for exactly 83 map keys, not conflating the map's key count with `config.toml`'s raw 85-entry total).

**Type/name consistency:** `VERIFY_JWT_MAP` (Task 1 Step 1) is imported by exact name in Task 1 Step 3's `index.ts`. `requireAuth` (imported from `_shared/auth.ts`) matches that file's actual exported function name, confirmed by reading the file directly during planning, not assumed. `phase4-batch1-functions.txt` (Task 2 Step 1) is read by the same relative path in Task 2 Steps 2 and 3 — no drift.
