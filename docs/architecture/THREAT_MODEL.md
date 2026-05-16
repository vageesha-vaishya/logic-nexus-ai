# Threat Model — Logic Nexus AI Platform

| Field | Value |
|---|---|
| Status | **Living document — skeleton v1** |
| Created | 2026-05-16 |
| Last reviewed | 2026-05-16 |
| Author | Vimal + Claude (design session) |
| Methodology | STRIDE per surface |
| Scope | All domains: Markets, CRM, Logistics, AMRO, Finance, Quotation, Flypal, UIM |
| Regulatory context | DPDP Act 2023, SEBI, CERT-In CCMP 2022, RBI IT Outsourcing 2023 |

> **How to use this document.**  
> Add rows to a surface's table as new threats are identified. Never delete rows — mark resolved threats `✅ Mitigated` and note the migration/PR. Flag pre-production gates from `docs/plans/2026-05-14-*.md §16.11` as `⚠ Gate G-N`.  
> CERT-In requires a breach to be reported within **6 hours** — the `platform.access_log` + `platform.audit_log` tables are the primary forensic source.

---

## Surfaces

1. [Auth surface](#1-auth-surface)
2. [API surface](#2-api-surface)
3. [Data plane](#3-data-plane)
4. [Integration surface](#4-integration-surface)
5. [Admin / privileged access](#5-admin--privileged-access)
6. [AI / LLM surface](#6-ai--llm-surface)
7. [Infrastructure](#7-infrastructure)

Risk ratings: **Critical** · **High** · **Medium** · **Low**

---

## 1. Auth surface

**Components:** Supabase Auth (JWT), anon key, service-role key, `requireAuth()` shared helper, 124 Edge Functions, Python worker service-account auth.

| ID | Stride | Threat | Risk | Mitigation | Gap / Action |
|---|---|---|---|---|---|
| A-1 | S | Attacker presents forged or replayed JWT to call a mutating edge function | High | `requireAuth()` calls `supabase.auth.getUser(token)` which validates signature + expiry against Supabase Auth | ⚠ Gate G-1: 83 of 124 functions have `verify_jwt=false`; `requireAuth` is the only guard. Audit each function before production launch. |
| A-2 | S | Attacker uses the exposed service-role key (committed in `.env`) to call any API as `service_role`, bypassing RLS | Critical | T0 runbook prescribes rotation before production; access logs audited for last 90 days | ⚠ Gate G-2: rotation not yet done (deferred to pre-production). Until rotated, this key is assumed compromised. |
| A-3 | I | Anon key embedded in the SPA bundle is extracted by an attacker | Low | Anon key is intentionally public per Supabase design; RLS is the actual access control | Ensure RLS policies exist on every table before production (see §3). |
| A-4 | E | JWT with `role: service_role` injected via crafted request body — app trusts `x-tenant-id` header instead of verifying JWT role | High | `isServiceRoleAuthorizationHeader()` checks the JWT payload `role` field | Review all functions that read `x-tenant-id` without validating it matches the JWT's tenant claim. |
| A-5 | S | Python worker service-account key stolen from `.env` or env var, used to impersonate the worker | High | Service-account keys are JWTs signed by Supabase; rotation revokes old keys | ⚠ Gate G-2: rotate all worker credentials before production. Add key-rotation policy to `platform.service_accounts`. |
| A-6 | D | Brute-force or credential-stuffing against Supabase Auth login endpoint | Medium | Supabase Auth applies rate limits on `/auth/v1/token` | Enable Supabase Auth CAPTCHA (hCaptcha) before public-facing signup goes live. |

---

## 2. API surface

**Components:** 124 Supabase Edge Functions, Python worker (FastAPI `/v1/*`), `x-tenant-id` / `x-franchise-id` headers, in-memory rate limiter.

| ID | Stride | Threat | Risk | Mitigation | Gap / Action |
|---|---|---|---|---|---|
| B-1 | T | Attacker sends a crafted `x-tenant-id` header to access another tenant's data | High | RLS policies enforce `tenant_id = auth.uid()`-scoped access; `x-tenant-id` header is advisory, not authoritative for data access | Verify that no mutation path trusts `x-tenant-id` without a matching JWT claim. |
| B-2 | D | Rate-limit bypass: attacker hits multiple edge-function instances to exceed per-user or per-tenant limits | High | In-memory `Map` in `_utils/http.ts` enforces limits per process | ⚠ Gate G-6: in-memory rate limiter is per-process and bypassed by horizontal scaling. Replace with Redis sorted-sets (T1.5-P2). |
| B-3 | T | Mass-assignment: POST body with extra fields overrides server-set fields (e.g., `owner_user_id`, `tenant_id`) | Medium | Zod schemas and Pydantic models validate and strip unknown fields | Audit any raw `req.json()` → `supabase.insert()` paths that skip a validation layer. |
| B-4 | I | Verbose error responses leak stack traces, SQL errors, or internal IDs to unauthenticated callers | Medium | `serveWithLogger` catches unhandled exceptions and returns generic `Internal Server Error` | Verify non-`serveWithLogger` functions don't `throw` raw errors to the client. |
| B-5 | D | Long-running backtest or signal-generation job exhausts the Python worker's CPU/memory, starving other tenants | Medium | RQ job queue serialises work; `job_timeout` kills runaway jobs | Add per-tenant job-queue priority and a max-concurrent-jobs-per-tenant cap in T2. |
| B-6 | R | No request-level correlation ID in 120 of 124 edge functions prior to 2026-05-16 | Medium | `serveWithLogger` now auto-generates `correlationId` and writes to `platform.access_log` | ✅ Mitigated — `serveWithLogger` middleware deployed 2026-05-16. |

---

## 3. Data plane

**Components:** Supabase Postgres, 1026 RLS policies, multi-tenant + multi-franchise isolation, markets financial data (portfolio holdings, price history, signals, briefs), CRM contacts, transaction records.

| ID | Stride | Threat | Risk | Mitigation | Gap / Action |
|---|---|---|---|---|---|
| C-1 | I | RLS policy misconfiguration allows tenant A to read tenant B's portfolios or holdings | Critical | `platform.access_log` now records every edge function response; Supabase advisor monitors for RLS-disabled tables | ⚠ Gate G-13: 18 tables in `public` still have RLS disabled (advisor ERRORs). Resolve all before production. |
| C-2 | T | Privileged mutation via service-role bypasses RLS — no audit trail | High | `platform.audit_log` triggers write `before`/`after` on business tables | Verify triggers exist on all markets tables; `platform.audit_log` writes confirmed for high-value tables. |
| C-3 | I | Franchise-level isolation gap: rows with `franchise_id IS NULL` visible across franchises | High | P0 migration `20260515210000` + follow-up `20260516090000` enforced `franchise_id NOT NULL` on all retrofitted tables | ✅ Mitigated — all P0 tables enforced as of 2026-05-16. `compliance_checks` + `compliance_actions_log` still lack `tenant_id` anchor (separate epic). |
| C-4 | I | SQL injection via unsanitised input to a raw-SQL Supabase RPC or PostgREST filter | High | All client code uses the Supabase JS/Python SDK (parameterised queries); no raw SQL from user input | Review any `.rpc()` calls that concatenate user-supplied strings into the function arguments. |
| C-5 | I | `platform.audit_log` JSON columns (`before`, `after`) contain unredacted PII (emails, phone numbers, financial figures) | Medium | `Logger.maskPII()` in edge-function logger redacts email and phone patterns | Audit which triggers write PII-heavy columns to `before`/`after`; apply column-level redaction before production. |
| C-6 | D | Unbounded query: attacker requests all price history rows via crafted filter → query timeout or DB memory spike | Medium | Python worker's backtest job caps `_MAX_BARS * len(known_ids)` rows; PostgREST default row limit applies | Add explicit `LIMIT` guards on all public-facing select endpoints; PostgREST `db-max-rows` setting. |
| C-7 | T | Mass-delete via service-role client used by a compromised worker job | High | RQ jobs run as the worker service account; `platform.audit_log` records deletions | ⚠ Gate G-2: until service-role key is rotated, a stolen key can mass-delete. Narrow worker scope to least-privilege service account. |

---

## 4. Integration surface

**Components:** LLM providers (Anthropic, OpenAI, OpenRouter), Yahoo Finance (price ingest), NSE/BSE news feeds, future broker OAuth (Kite/Upstox/Angel/Breeze), outbound webhooks, inbound broker callbacks.

| ID | Stride | Threat | Risk | Mitigation | Gap / Action |
|---|---|---|---|---|---|
| D-1 | T | LLM provider API key stolen → attacker generates responses billed to the platform | High | Keys stored in Supabase Vault (`pgsodium`); never in code or logs | ⚠ Gate G-2: keys currently in `.env` (T0). Rotate and move to Vault before production. |
| D-2 | I | Sensitive portfolio data (holdings, quantities, prices) sent to a third-party LLM provider's API | High | Design limits prompt content to non-PII summaries; grounding rules enforce citation-only output | Audit `markets.daily_brief` and `markets.research_thread` prompts for PII leakage before multi-tenant use. |
| D-3 | D | LLM provider outage or rate-limit causes all brief generation and research threads to fail | Medium | LLM Gateway (`_shared/llm-gateway.ts`) catches errors and returns structured error responses | Add retry-with-backoff and a fallback provider in T1.5. Track per-tenant usage against budget cap. |
| D-4 | T | Inbound broker OAuth callback forged — attacker injects a malicious `code` into the OAuth flow | High | Not yet implemented; broker connections are deferred to T3+ | When implementing: enforce PKCE, bind `state` to session, verify `redirect_uri` exactly. |
| D-5 | T | Outbound webhook payload tampered in transit | Medium | Webhooks signed with HMAC secret per `platform.webhook_subscriptions` | Verify every inbound webhook receiver validates the signature before processing. |
| D-6 | I | Market data vendor (Yahoo Finance, news scraper) returns malicious HTML/JSON that is rendered unescaped in the UI | Medium | `ReactMarkdown` with `rehype-sanitize` strips dangerous HTML in brief bodies | Verify `news_events.body` and `brief.body` are sanitised before render; do not use `dangerouslySetInnerHTML`. |
| D-7 | D | Price ingest job triggers Yahoo Finance rate-limit → all symbols fail, NAV goes stale | Low | `price_ingest.py` catches per-symbol errors and continues; seed prices from ICICI used as fallback | Add exponential backoff and alert when >20% of symbols fail ingest. |

---

## 5. Admin / privileged access

**Components:** `platform_admin` role, `adminOverride` toggle, `platform.impersonation_sessions`, Edge Function service-role paths.

| ID | Stride | Threat | Risk | Mitigation | Gap / Action |
|---|---|---|---|---|---|
| E-1 | E | Attacker gains `platform_admin` role assignment in `public.user_roles` | Critical | RLS on `user_roles` restricts INSERT to existing platform_admins; `platform.audit_log` triggers on role changes | Confirm trigger covers `user_roles` inserts and updates; add alerting on `role = 'platform_admin'` insert. |
| E-2 | R | `adminOverride` flag flipped with no audit record | High | Flag is in client-side state/localStorage today | ⚠ Gate G-13 (H10): every flip must write to `platform.audit_log` with `acted_by`, `tenant_id`, reason. |
| E-3 | R | Platform admin impersonates a user but `acted_by` is not recorded on mutations made during the session | High | `platform.impersonation_sessions` table exists with schema for `real_user_id` / `impersonated_user_id` | Impersonation flow not yet wired in the UI. When built: tag every action during the session with `acted_by = real_user_id`. |
| E-4 | I | Platform admin can read any tenant's financial data (portfolios, holdings, briefs) via service-role client | Medium | By design: platform_admin scope is global. Every such access is logged to `platform.access_log`. | Enforce admin actions go through the impersonation flow (E-3) so there is always a human-readable audit trail. |
| E-5 | S | CI/CD pipeline secret (GitHub Actions `SUPABASE_SERVICE_ROLE_KEY`) stolen via a malicious PR | High | Gitleaks in CI blocks secrets in code; GitHub Actions secrets are not exposed to PR forks | Enable "required reviewers" on main branch; restrict secret access to protected branches only. |

---

## 6. AI / LLM surface

**Components:** `markets.daily_brief` prompt, `markets.research_thread` prompt, LLM Gateway (`_shared/llm-gateway.ts`, Python `llm_gateway.py`), `platform.llm_usage` cost tracking.

| ID | Stride | Threat | Risk | Mitigation | Gap / Action |
|---|---|---|---|---|---|
| F-1 | T | Prompt injection: user-supplied content in research thread manipulates the model to exfiltrate other users' data or produce harmful output | High | System prompt includes grounding rules; research thread context is scoped to the requesting user's portfolio (RLS) | Add a post-processing filter that rejects responses containing other users' UUIDs or credential-like patterns. |
| F-2 | D | Token-budget abuse: a tenant submits a research thread with a 100k-token payload, exhausting the per-tenant LLM budget | Medium | `MAX_OUTPUT_TOKENS` caps response size per task; `platform.llm_usage` tracks spend | Enforce per-tenant daily token budget in the LLM Gateway; return `429` when exceeded. |
| F-3 | I | LLM response cites a hallucinated price or trade recommendation that is acted upon by the user | Medium | Prompt v3 has strict grounding rules: claims must cite a `[N]` news item; CASE B instructs model to output "No fresh news" when data is absent | Evaluate output quality periodically; add `⚠ AI-generated — not investment advice` disclaimer in the UI. |
| F-4 | T | Malicious `markets.prompts` row (active state) injected by a compromised admin overwrites the daily_brief system prompt | Medium | `markets.prompts` is RLS-owned; writes require authenticated user | Add audit trigger on `markets.prompts` inserts/updates; require review of prompt changes via PR. |
| F-5 | I | Anthropic / OpenAI API response body logged to `system_logs` in full, exposing portfolio details | Low | `logger.maskPII()` strips email and phone; LLM response body is not currently logged at INFO level | Confirm LLM response body is not written to any log table at any level. |

---

## 7. Infrastructure

**Components:** Hostinger Nginx (static SPA), Supabase project `gzhxgoigflftharcmdqj` (ap-south-1), Python worker (VPS target), GitHub repo, Redis (planned T1.5).

| ID | Stride | Threat | Risk | Mitigation | Gap / Action |
|---|---|---|---|---|---|
| G-1 | D | DDoS against the Hostinger Nginx origin — static SPA becomes unreachable | High | Single-origin, no CDN today | ⚠ Gate G-10: Cloudflare in front of Hostinger origin before production launch. |
| G-2 | I | GitHub repo history contains `.env` secrets committed at `lines 7–31` | Critical | T0 runbook: `git filter-repo` + force-push + re-clone for all collaborators | ⚠ Gate G-2: deferred to pre-production. Until done, treat all secrets as compromised. |
| G-3 | D | Redis instance (when added) becomes a SPOF: rate-limiter and JWT cache down → all requests fall through uncached | Medium | Not yet deployed | When implementing: use Redis Sentinel or Upstash (managed HA); add circuit-breaker that falls back to in-memory on Redis unavailability. |
| G-4 | T | Supabase migration applied to production without review — drops a table or alters a column incorrectly | High | CI checks `DB-VERIFICATION` and `DB-ARCH-APPROVAL` metadata on every migration with a new `CREATE TABLE` | Extend check to cover `DROP TABLE`, `ALTER COLUMN TYPE`, `ALTER COLUMN SET NOT NULL` statements. |
| G-5 | I | Supabase project `ap-south-1` logs (API + DB) retain IP addresses and query patterns | Medium | Logs used for CERT-In 6-hour breach reporting; `platform.access_log` provides application-level forensics | Define log-retention policy per DPDP Act consent obligations; document in `docs/runbooks/`. |
| G-6 | E | `max_connections=60` + `pg.Pool max=50` → a single API process saturates the DB, allowing resource exhaustion that forces failover or data corruption | High | ⚠ Gate G-3: bump `max_connections` ≥500 on the Supabase plan; cap `pg.Pool` to 15; enforce Supavisor transaction-pool URL | Not yet done. |
| G-7 | I | Sentry session replay at 100% samples captures keystrokes, form inputs, PII in the browser | Medium | ✅ Mitigated 2026-05-15 — `replaysSessionSampleRate` set to 0 (errors only via `replaysOnErrorSampleRate=1.0`), `tracesSampleRate` to 0.05 in production. | Verify at launch that the env vars resolve correctly in the deployed build. |

---

## Pre-production launch gate checklist

Items in this section are **hard blockers** before any external user (paying or free) accesses the platform. Taken directly from `docs/plans/2026-05-14-*.md §16.11`.

| Gate | Description | Status |
|---|---|---|
| G-1 | Audit all 83 `verify_jwt=false` edge functions; flip all non-webhook/non-public to `true` | ⚠ Deferred |
| G-2 | Rotate all secrets (service-role key, anon key, JWT secret, DB password, LLM API keys); purge from git history | ⚠ Deferred |
| G-3 | `max_connections` ≥500; `pg.Pool` ≤15; Supavisor transaction-pool URL enforced everywhere | ⚠ Deferred |
| G-4 | Sentry sample rates corrected (tracing 5%, replay errors-only) | ✅ Done 2026-05-15 |
| G-5 | `VACUUM (FULL)` on `audit_logs` and `quotation_audit_log` | ✅ Done 2026-05-15 |
| G-6 | In-memory rate limiter replaced with Redis sorted-sets | ⚠ Deferred |
| G-7 | GitHub Actions CI + Gitleaks + Husky pre-commit blocking `.env` + lint-staged | ✅ Done 2026-05-16 |
| G-8 | BullMQ wired; PDF/email/brief jobs on queue with retry + DLQ | ⚠ Deferred |
| G-9 | Read replica or partition strategy for hot tables | ⚠ Deferred |
| G-10 | Cloudflare CDN in front of Hostinger origin | ⚠ Deferred |
| G-11 | CSP tightened — remove `unsafe-inline` from scripts | ⚠ Deferred |
| G-12 | `tenant_domain_assignments` audit for launch tenants; stale test rows removed | ⚠ Deferred |
| G-13 | Zero `ERROR`-level Supabase advisor findings; all SECURITY DEFINER views reviewed | ⚠ Deferred |

---

## Incident response

**CERT-In 6-hour reporting (mandatory for Indian operators):** If a breach is suspected, immediately query:

```sql
-- Last 1000 access events
SELECT * FROM platform.access_log ORDER BY ts DESC LIMIT 1000;

-- Mutations in the last 24 hours
SELECT * FROM platform.audit_log WHERE ts > now() - interval '24 hours' ORDER BY ts DESC;

-- LLM usage anomalies
SELECT tenant_id, sum(cost_usd), count(*)
FROM platform.llm_usage
WHERE ts > now() - interval '24 hours'
GROUP BY tenant_id ORDER BY sum DESC;
```

Runbook: `docs/runbooks/incident-cert-in.md` (to be created).

---

## Revision history

| Date | Author | Change |
|---|---|---|
| 2026-05-16 | Vimal + Claude | Initial skeleton — all 7 surfaces, STRIDE analysis, pre-production gate checklist |
