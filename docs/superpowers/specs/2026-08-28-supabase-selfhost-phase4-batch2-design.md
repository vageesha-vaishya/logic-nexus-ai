# Self-Hosted Supabase Migration — Phase 4 Batch 2: LLM-Provider Functions - Design Specification

## 1. Background

Phase 4 Batch 1 (complete) authored and validated the self-hosted Edge Function router — a `Deno.serve`-interception shim with a global concurrency lock, dispatching via a generated static import map (`supabase/functions/main/function_importers.ts`) after two real architectural discoveries (dynamic-path imports aren't statically discoverable by the real Rust Edge Runtime; `serveWithLogger`/raw `Deno.serve()` calls needed interception rather than modification) were resolved and independently verified live. 88 secret-free functions are deployed and reachable. This batch deploys the next group: 23 functions needing at least one LLM provider key.

**No architecture work remains.** This spec exists to scope the batch precisely and flag what's genuinely new (secret provisioning, not routing mechanics) — see the parent design spec (`docs/superpowers/specs/2026-08-28-supabase-selfhost-phase4-design.md`) for everything architectural, which applies unchanged.

## 2. Goals / Non-Goals

**Goals:**
- Deploy exactly these 21 functions (re-derived live against production immediately before writing this spec — production's function list is unchanged, 135 functions, since Batch 1's classification): `ai-advisor`, `ai-agent`, `ai-message-assistant`, `analyze-cargo-damage`, `analyze-email-threat`, `categorize-document`, `classify-email`, `ensemble-demand`, `extract-bol-fields`, `extract-invoice-items`, `generate-embedding`, `ingest-email`, `markets-enrich-news`, `markets-portfolio-brief`, `markets-portfolio-diagnostic`, `markets-research`, `nexus-copilot`, `portal-chatbot`, `process-franchise-import`, `smart-reply`, `suggest-transport-mode`. (`forecast-demand` and `route-optimization` were part of the original 23-function classification but are excluded here — see Non-Goals.)
- Add 21 new entries to `function_importers.ts` (the only file needing new entries — all 16 of this batch's `verify_jwt=false` functions among these 21 are already present in `verify_jwt_map.ts`, confirmed directly; the remaining 5 default to `verify_jwt=true`, requiring no map entry per the router's existing logic).
- Provision the distinct third-party secrets this batch's functions actually need: `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL` — real credential values, must come from the user.
- Split execution at the natural secrets boundary: everything not requiring a real secret value (generating map entries, preparing the reseed file list) happens now; the live deployment (injecting real secrets into the `functions` container's env, restarting, verifying) waits for the user to supply them.

**Non-Goals:**
- Any router/dispatch mechanism changes — Batch 1's design is proven and unchanged.
- Full business-logic testing of what these functions actually produce (e.g., whether `ai-advisor`'s OpenAI-backed output is *correct*) — matching Batch 1's precedent, this batch proves deployment/routing/secret-wiring work, not AI output quality.
- **`forecast-demand` and `route-optimization`, deliberately excluded from this batch.** Both depend on internal service URLs, not third-party credentials (`TIMESFM_URL`, `VROOM_URL`), and neither backing service exists yet — confirmed directly: the local `env` file's `TIMESFM_URL` is a `localhost`-only dev address (unreachable from a self-hosted container) and `VROOM_URL` is literally unset (`%`), and neither `timesfm` nor `vroom` appears anywhere in the VPS's running or stopped containers. Deploying either function now would make it "reachable" by this batch's own verification standard while being completely non-functional the moment it's actually invoked — worse than not deploying it. Both are deferred to a later batch, once/if those backing services are stood up (a separate, not-yet-scoped piece of infrastructure work, likely bigger than "supply a secret value").

## 3. Architecture

Unchanged from the parent spec and Batch 1's implementation. The only two files touched:
- `function_importers.ts`: append 23 entries in the same literal-string `import("../<name>/index.ts")` form already proven to be statically discoverable by the runtime.
- `deploy/selfhosted-supabase/scripts/phase4-batch2-functions.txt`: the new 23-name list, same convention as Batch 1's `.txt` file.

Secret provisioning follows the same mechanism already wired for Batch 1's env vars (`JWT_SECRET`, `SERVICE_ROLE_KEY`, etc.) — added to the Coolify-managed `.env` at `/data/coolify/applications/i64jlyerora7ao9vkw5sweh3/.env`, then referenced in `docker-compose.yml`'s `functions` service environment block via `${VAR}` substitution (this requires an entry per secret in that block, per the project's established `env.example` documentation convention — a new step, not a change to how secrets flow once declared there).

## 4. Safety & Monitoring

Identical to Batch 1: zero production traffic served by self-hosted throughout, read-only against production, four standard health-check curls after every container restart, no interaction with Phases 2/3's replicated data or storage sync.

## 5. Verification Plan

Same shape as Batch 1's, scaled to this batch: `function_importers.ts` entry count matches the `.txt` file exactly (23), a `verify_jwt=false` sample function is callable without auth, a `verify_jwt=true` sample is rejected without auth and succeeds with a validly-signed token (using the router's now-corrected signature-only check from Batch 1's final review — not an identity check), health checks green throughout, no regression to Batch 1's already-deployed 88 functions (a fresh spot-check of a few, given they share the same router process).

## 6. Open Items

- **Where do real secret values come from**: the user's decision (during brainstorming) was to plan this batch now and pause before deployment — the actual `OPENAI_API_KEY`/`GOOGLE_API_KEY`/`GEMINI_API_KEY`/`ANTHROPIC_API_KEY`/`UPSTASH_REDIS_REST_TOKEN`/`UPSTASH_REDIS_REST_URL` values are not yet available and must be supplied via the repo-root gitignored `env` file before the plan's deployment task can run.
- **`forecast-demand`/`route-optimization`'s eventual batch** isn't scoped anywhere yet — whenever `TIMESFM_URL`/`VROOM_URL` become real, reachable addresses, that pair needs its own (likely very small) batch; not urgent, just noting it as genuinely open rather than silently dropped.
