# Workstream 3: Client and browser surface

## Scope covered

Examined `src/` (the Vite/React frontend) for any code path where the browser itself
initiates an AI/LLM-related network call, or reads an environment variable shaped like
a credential. Specifically read in full:

- `src/hooks/useAiAdvisor.ts`
- `src/features/module-communications/components/email/EmailToLeadDialog.tsx` (lines 150–240)
- `src/components/ai/NexusCopilotWidget.tsx`
- `src/features/admin/llm-gateway/useLlmGatewayLists.ts`
- `src/lib/supabase-functions.ts` (the `invokeFunction`/`invokeAnonymous` helpers used by the above)
- `src/lib/network-logger.ts`
- `src/features/markets/pages/LlmSettingsPage.tsx`, `src/features/markets/hooks/useLlmConfigs.ts`, `src/features/markets/hooks/useProviderModels.ts` (found via the Step 1 greps, outside the brief's named file list but the same surface — client-side LLM provider configuration)

Also performed a live, empirical scan of the deployed production JS bundle at
`https://app.sosservices.online/` (Step 3) rather than relying only on source/env
inspection.

Not covered (out of scope for this workstream, owned by others): edge function
internals beyond what the browser's request shape reveals (W2), the `services/llm-gateway`
and `_shared/llm-gateway.ts` implementations themselves (W1), Coolify env-var contents
and vLLM rig trust boundary (W4), non-LLM workloads and DB-level observability (W5).

## Inventory

| Component | Location | What it does | Deployment status |
|---|---|---|---|
| `useAiAdvisor` hook | `src/hooks/useAiAdvisor.ts` | Smart-quote AI advisor. Primary: invokes `ai-advisor` edge function via `invokeFunction`. Fallback 1: direct browser→OpenAI call using `VITE_OPENAI_API_KEY`. Fallback 2: hardcoded mock data. | Live — used by `ChargesManagementStep.tsx`, `QuoteDetailsStep.tsx`, `UnifiedQuoteComposer.tsx`, `useRateFetching.ts`, `RateManagement.tsx` |
| `EmailToLeadDialog` | `src/features/module-communications/components/email/EmailToLeadDialog.tsx` | Suggests transport mode/options from an email. Primary: invokes `suggest-transport-mode` edge function. Fallback: direct browser→OpenAI call using `VITE_OPENAI_API_KEY`. | Live — used by `EmailDetailDialog.tsx`, `EmailDetailView.tsx` |
| `NexusCopilotWidget` | `src/components/ai/NexusCopilotWidget.tsx` | Q&A widget; calls `POST /functions/v1/nexus-copilot` directly via a raw relative `fetch`, no auth header, no use of the `invokeFunction`/`invokeAnonymous` helpers. | **Not imported or referenced by any other file in `src/`** — orphaned/unmounted. Not user-reachable today. |
| `useLlmGatewayLists.ts` | `src/features/admin/llm-gateway/useLlmGatewayLists.ts` | Backs an admin page (prompts, experiments, audit log, budget status). Calls `llm-admin-list` edge function via `supabase.functions.invoke`; per its own header comment, that function does the `platform_admin` role check and proxies to `/v1/admin/*` on the gateway server-side. | Live (admin-only) |
| `LlmSettingsPage` + `useLlmConfigs` | `src/features/markets/pages/LlmSettingsPage.tsx`, `src/features/markets/hooks/useLlmConfigs.ts` | Per-tenant LLM provider config UI (list/add/rotate/delete). Tenant-entered API keys are sent to `markets-llm-config` edge function via `supabase.functions.invoke` for server-side vault storage — the browser does not call the configured provider directly with these keys. | Live |
| `useProviderModels.ts` | `src/features/markets/hooks/useProviderModels.ts` | Fetches the OpenRouter public model catalog (`https://openrouter.ai/api/v1/models`, or a user-supplied `baseUrl` override) directly from the browser. No API key sent or required. | Live, gated to `provider === "openrouter"` |
| `network-logger.ts` | `src/lib/network-logger.ts` | Global `window.fetch` wrapper for correlation-ID injection and debug logging. Explicitly special-cases and bypasses instrumentation for `openrouter.ai`, `api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com` because their CORS allow-headers lists don't include `X-Correlation-ID`. | Live (cross-cutting infra, not an AI feature itself) |

## Findings

### F-3.1 — `useAiAdvisor.ts` falls back to a direct, browser-held OpenAI key [High]
**What:** When the `ai-advisor` edge function call fails with a non-auth error (network error, 5xx, etc.), the hook reads `import.meta.env.VITE_OPENAI_API_KEY` from the client bundle and, if present and shaped like `sk-...`, calls `https://api.openai.com/v1/chat/completions` directly from the browser with that key in the `Authorization` header.
**Evidence:** `src/hooks/useAiAdvisor.ts:38-95` (key read at line 40, fetch at line 81).
**Observed or inferred:** Observed (read directly from source).
**Impact today:** Confirmed unset in the local `.env`, `.env.example`, `.env.local.example`, `.env.production.local`, and `.env local docker` files (checked for presence/emptiness only, no values printed), and confirmed absent from the live production bundle (see F-3.3). With the variable unset, `clientSideKey` is falsy, the `if` guard fails, and the code falls through to Fallback 2 (hardcoded mock quote data) — the feature degrades silently to mock data rather than erroring visibly to the user. **What would make this Critical:** the moment anyone sets `VITE_OPENAI_API_KEY` in the frontend build environment (Coolify app `b2lt2if6x6ovekc4tj7vg8tx` per the plan's known facts) and redeploys, the key ships in the public JS bundle, readable by anyone who loads the app, with no rate limiting or tenant attribution — an unbounded, unattributed spend and exfiltration vector. It is High and not Critical only because the variable is currently unset; this is a latent trap, not an active exposure.

### F-3.2 — `EmailToLeadDialog.tsx` has the identical direct-OpenAI-fallback pattern [High]
**What:** Same mechanism as F-3.1, independent code path. On `suggest-transport-mode` edge function failure, reads `VITE_OPENAI_API_KEY` and, if set and `sk-`-shaped, calls `https://api.openai.com/v1/chat/completions` directly from the browser with the email subject/body content as the prompt.
**Evidence:** `src/features/module-communications/components/email/EmailToLeadDialog.tsx:180-217` (key read at line 182, fetch at line 187).
**Observed or inferred:** Observed.
**Impact:** Same analysis as F-3.1 — currently a no-op (key unset, falls through to the error-message path below it), but a second, independent trigger for the same Critical-on-set condition. Notably this path also sends the lead's email subject/body as the prompt content directly to OpenAI from the browser if ever activated — a data-handling concern in addition to the credential-exposure one, since there is no PII scrubbing in this fallback branch (contrast with the `suggest-transport-mode` edge function primary path, which is server-side and may or may not apply `_shared/pii-guard.ts` — that check is W2's remit).

### F-3.3 — Live production bundle scan: no AI credential found [Informational]
**What:** Ran the exact Step 3 pipeline against the live production frontend.
**Evidence:**
```
bundle: /assets/index-BAs43-cJ.js
count: 0
```
Confirmed the bundle itself is real and fully fetched, not an error page: `curl -s -o /dev/null -w "http_code=%{http_code} size=%{size_download}\n" https://app.sosservices.online/assets/index-BAs43-cJ.js` → `http_code=200 size=1164472`.
**Observed or inferred:** Observed, live probe against production, run 2026-09-05.
**Impact:** Corroborates F-3.1/F-3.2's analysis — `VITE_OPENAI_API_KEY` is not baked into the currently-deployed bundle. No escalation triggered (count is 0, matching the expected/required value). This is a point-in-time result; it says nothing about bundles from other deploys before or after this scan (see Unknowns).

### F-3.4 — `NexusCopilotWidget.tsx` is orphaned client code calling an edge function with no auth header [Low]
**What:** The component exists, is fully wired to call `POST /functions/v1/nexus-copilot`, but is not imported by any route, page, or other component anywhere in `src/` (`grep -rln "NexusCopilotWidget" src` matches only its own definition file).
**Evidence:** `src/components/ai/NexusCopilotWidget.tsx` (whole file, 67 lines); `grep -rln "NexusCopilotWidget" src --include=*.tsx --include=*.ts` returns only `src/components/ai/NexusCopilotWidget.tsx` itself.
**Observed or inferred:** Observed for "not imported anywhere in `src/`". Inferred that this means it is not currently reachable by any end user — a component could in principle still be reachable via a dynamic path this grep wouldn't catch, but no such mechanism was found.
**Impact:** No current user-facing exposure. Worth flagging because (a) it is dead code that should be deleted or wired up deliberately, and (b) if it is ever mounted, it calls the edge function with no `Authorization`/`apikey` header at all (unlike every other call site inventoried here, which goes through `invokeFunction`/`invokeAnonymous` or `supabase.functions.invoke`) — whether `nexus-copilot` is publicly invocable without a JWT is an edge-function auth-posture question for W2, not verified here.

### F-3.5 — Browser fetches OpenRouter's public model catalog directly, with a user-editable base URL [Informational]
**What:** `useProviderModels.ts` calls `https://openrouter.ai/api/v1/models` (or a `baseUrl` override typed into the settings form) directly from the browser. No API key is sent or needed — this is explicitly a public, unauthenticated catalog endpoint per the code's own comment.
**Evidence:** `src/features/markets/hooks/useProviderModels.ts:23,39-46`.
**Observed or inferred:** Observed.
**Impact:** Not a credential exposure (no key involved) and not a server-side SSRF vector (the fetch runs in the user's own browser against a URL they typed into their own settings form, so it can only affect what that user's own browser requests). Recorded as informational inventory: this is a legitimate, intentional client-side AI-adjacent call and the one place in the audited surface where a third-party AI-ecosystem host is reached with no server mediation, by design.

### F-3.6 — Provider API keys entered in Markets LLM settings are vaulted server-side, not used client-side [Informational — good practice]
**What:** `LlmSettingsPage.tsx` lets tenant/franchise/platform admins add, rotate, or delete an LLM provider config including an API key. The key is sent to the `markets-llm-config` edge function via `supabase.functions.invoke` (confirmed for delete at `useLlmConfigs.ts:104-109`; add/update follow the same `supabase.functions.invoke` pattern at lines 46 and 78) for server-side vault storage. No code path in this page calls the provider directly with the entered key from the browser — the only direct browser→provider call on this page is the keyless OpenRouter catalog fetch (F-3.5).
**Evidence:** `src/features/markets/pages/LlmSettingsPage.tsx:1-15` (header comment describing the vault flow); `src/features/markets/hooks/useLlmConfigs.ts:46,78,104-109` (all three mutations use `supabase.functions.invoke`, none use a raw `fetch` to a provider host).
**Observed or inferred:** Observed for the browser-side code. Whether the `markets-llm-config` function actually stores the key in a proper vault (vs. a plaintext table column) and correctly enforces the `tenant_admin`/`franchise_admin`/`platform_admin` role check the header comment claims, is server-side and not verified by this workstream — see Unknowns.

## Unknowns / not verified

- **Auth posture of `nexus-copilot` and whether it's publicly invocable.** `NexusCopilotWidget.tsx` sends no auth header at all; whether the edge function requires a JWT (project default) or has a per-function override is a W2 question, not checked here.
- **Whether `markets-llm-config` actually vaults keys securely and enforces its claimed role check.** The browser-side code sends the key to that function; what the function does with it (proper Vault vs. plaintext column, RLS, role enforcement) was not inspected — server-side, out of this workstream's scope.
- **History of `VITE_OPENAI_API_KEY` in prior deploys.** F-3.3 is a point-in-time scan of the bundle live today (`index-BAs43-cJ.js`). Whether any earlier deployed bundle ever contained this key, or whether the Coolify frontend build env has ever had it set, was not checked here — only today's live bundle and today's local repo env files were inspected. (The plan's "Known facts" table states it is confirmed unset via the Coolify envs API as of 2026-09-01; this workstream did not re-verify that via Coolify and instead relied on the independent live-bundle scan, which corroborates it.)
- **Whether `suggest-transport-mode`'s server-side primary path applies PII scrubbing** before sending email content to OpenAI — relevant context for F-3.2's data-handling note, but the function internals are W2's remit.
- **Whether any other dynamic-import or lazy-loaded component references `NexusCopilotWidget`** through a mechanism a static `grep` wouldn't catch (e.g., a string-keyed widget registry). Not found, but not exhaustively ruled out beyond the grep performed.

## Notes for synthesis

- Two independent, identically-shaped latent traps exist (F-3.1, F-3.2) that both key off the same env var, `VITE_OPENAI_API_KEY`. A remediation item should address both call sites together, not just one, and should consider removing the client-side fallback entirely rather than just leaving the var unset (defense in depth against a future misconfiguration).
- The browser-originating consumers identified for Task 6's fragmentation map:
  - `useAiAdvisor.ts` → primary: `ai-advisor` edge function (governance unknown to W3, see W1/W2). Fallback: direct-to-OpenAI, ungoverned by construction (no gateway, no audit, no budget — it's a raw browser fetch).
  - `EmailToLeadDialog.tsx` → primary: `suggest-transport-mode` edge function. Same ungoverned fallback.
  - `NexusCopilotWidget.tsx` → `nexus-copilot` edge function directly, unauthenticated request from the client, currently unreachable (dead code) but wired and functional if ever mounted.
  - `useLlmGatewayLists.ts` (LLM Gateway admin page) → `llm-admin-list` edge function → proxies to gateway `/v1/admin/*` server-side. This is the one browser-originating path that is explicitly gateway-mediated and role-gated per its own code comments.
  - `LlmSettingsPage.tsx` / `useLlmConfigs.ts` → `markets-llm-config` edge function (key vaulting) — browser never touches the provider with a tenant key.
  - `useProviderModels.ts` → OpenRouter public catalog directly, no key, no server mediation — lowest-risk of all the browser-originating calls found.
- No evidence of any AI provider credential currently reaching the browser (F-3.3, count 0). The exposure risk in this workstream is entirely latent/structural (F-3.1, F-3.2), not active.
- Cross-reference for W1/W2: the LLM Gateway admin surface (`useLlmGatewayLists.ts`) is real, live, and browser-driven — if W1 finds the underlying gateway service undeployed or the `llm-admin-list` function's proxy target unreachable, that's a live admin-page-is-broken finding, not just an inventory note.
