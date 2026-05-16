# Markets Domain & Platform Foundations — Design

| Field | Value |
|---|---|
| Status | **Draft — for review** |
| Date | 2026-05-14 |
| Author | brainstorm session (Vimal + Claude) |
| Scope | Add `markets` domain (multi-asset trading platform) on top of enterprise-grade platform foundations. India-first. |
| Reviewers | TBD |
| Supersedes | n/a |

---

## 🔴 T0 — IMMEDIATE: Production credentials are exposed in `.env`

**This must be completed before any other work in this plan begins.** Credentials in `.env` (committed to the repo at `lines 7–31` per audit) include Supabase service-role key, OpenAI key, Google API key, and a database password. Anyone with read access to the repo (current or historical) effectively owns the platform.

### Runbook — execute in order, do not skip

1. **Rotate every secret.** In each service's dashboard, generate a new credential and revoke the old one:
   - Supabase: service-role key, anon key, JWT secret, database password
   - OpenAI: API key
   - Anthropic: API key (if present)
   - Google: API keys (any), OAuth client secrets
   - Resend / SendGrid / other email
   - Razorpay / Stripe (when added)
   - Any third-party API keys in current use
2. **Verify rotations took effect.** Curl one endpoint per service with the new key; the old key must return 401/403.
3. **Purge the secrets from git history.** Use `git filter-repo` (preferred) or BFG. Coordinate with anyone who has a clone — they must re-clone, not pull. Command sketch (do not run without backup):
   ```
   git filter-repo --path .env --invert-paths --force
   git push origin --force-with-lease --all
   git push origin --force-with-lease --tags
   ```
4. **Force-push the cleaned history.** Notify all collaborators. Anyone who pushes from a stale clone will re-introduce the secret.
5. **Audit access logs.** In Supabase: `Settings → Logs → API logs` and `Database → Logs`. Look at the **last 90 days** for unfamiliar IP addresses, unexpected SQL, or service-role calls from unknown origins. Same for OpenAI / Google usage dashboards. If anomalies found, escalate as an incident: assume data exfiltration and follow CERT-In's 6-hour breach reporting requirement.
6. **Add `.env` to `.gitignore`.** Verify with `git check-ignore -v .env`. Commit a `.env.example` template containing variable names only, no values.
7. **Move secrets to a real manager.** Two layers:
   - **Database-side secrets** (encryption keys, broker tokens later) → Supabase Vault using `pgsodium`.
   - **Runtime secrets** (API keys, OAuth client secrets) → Doppler / Infisical / AWS Secrets Manager. Edge Functions and the Python worker read from there at boot, never from `.env`.
8. **Add CI scanner to block re-introduction.** Enable Gitleaks or TruffleHog in GitHub Actions on every PR. Hard-fail on detection.
9. **Document the incident.** Write a brief post-incident note in `docs/incidents/2026-05-14-env-exposure.md`: what was exposed, what was done, anomalies found, lessons.

**Target completion:** within 24 hours from the start of this plan. Everything below this section is blocked until T0 is closed.

---

## 1. Executive summary

We are adding a new business domain — `markets` — to provide a multi-asset trading platform for the Indian retail market. The domain will:

- Begin life as a **personal-use AI research and analysis tool** (no broker integration, no customers, no execution).
- Graduate, after internal trials, to a customer-facing platform offering portfolio analysis, AI-driven research, backtesting, and (later) broker-integrated execution.
- Be built on **enterprise-grade platform foundations**, several of which are present today and several of which are gaps surfaced by the readiness audit.

Two parallel themes:

1. **Markets domain build** — new `markets` schema, Python worker service, broker-adapter scaffold, LLM analysis engines, backtesting, portfolio tracking. Indian-market-first.
2. **Platform foundations hardening** — fixing critical gaps (secret management, distributed rate limiting, feature flags, threat model, observability, billing, etc.) so the platform can support `markets` and future domains at enterprise grade.

The two themes are sequenced so that foundations land before they're load-bearing, but the markets domain is not gated on completion of every foundation item.

---

## 2. Scope

### In scope (this plan)

- A formal architectural rule set (cross-cutting rules **001–020**, recorded as ADRs in appendix).
- The `markets` domain: schema, data model, ingestion layer, AI analysis engines, backtesting, paper portfolio, light UI for personal use.
- Platform foundation enhancements required by markets and not yet present (LLM gateway, MCP servers, integration registry, multi-level franchise hierarchy, service accounts, audited impersonation, tenant lifecycle, distributed rate limit, etc.).
- Indian regulatory alignment (SEBI, RBI, DPDP, CERT-In).
- A sequencing plan (T0 → T1 → T2 → T3 → T4).

### Out of scope (deferred)

- Live broker execution (deferred until broker-adapter framework is proven against paper trading).
- US/non-India markets.
- Crypto/VDA trading (FIU-IND registration, 30%/1% TDS regime makes this non-viable for v1).
- Account Aggregator (Sahamati) integration — deferred until first stakeholder customer requires it.
- Multi-region data residency / EU customers — defer until first non-India customer.
- Plugin marketplace / app store — deferred to T4.
- Public SDK in Go/Python/Node — deferred to T4.
- White-label theming / reseller program — deferred.
- Retrofit of existing `public.*` business tables into `platform.*` schema — separate tracked epic; this plan grandfathers them.

### Non-goals

- Replacing the existing logistics / AMRO / quotation modules. Markets is **additive**; existing modules continue unchanged.
- Becoming a SEBI-registered broker, RIA, or RA. The personal phase is a **non-regulated software product**; commercial phases will use partner brokers and (if needed) RIA registration — none of which require us to be a broker-dealer.

---

## 3. Glossary

| Term | Meaning |
|---|---|
| **Markets domain** | New business domain for multi-asset trading; first occupant of its own schema |
| **Platform schema** | `platform.*` — shared infrastructure (tenants, franchises, users, audit, integrations) |
| **Tenant** | A customer organization in the SaaS sense; one customer = one tenant |
| **Franchise** | A sub-unit of a tenant (branch / region / business unit); enforces data isolation within a tenant |
| **Compute Tier 1 (T1-compute)** | TS / Deno on Supabase Edge Functions — for CRUD and light logic |
| **Compute Tier 2 (T2-compute)** | Python service on FastAPI — for quant, ML, long-running LLM agent loops |
| **Sequencing phases T0–T4** | Distinct from compute tiers; refers to the *time-ordered* delivery phases of this plan |
| **MCP** | Model Context Protocol — open protocol for connecting Claude (and other agents) to data sources and tools |
| **Managed Agent** | Anthropic's hosted, autonomous agent template (e.g., KYC screener, Market researcher) |
| **Custom agent** | Agent we build on Anthropic API + Agent SDK, hosted in our Python worker |

---

## 4. Architectural overview

### 4.1 Layer model

```
┌─ L5: Stakeholder mode    (multi-tenant clients, advisors, audit dashboards)        — Phase 2+
├─ L4: Distribution        (UIs, APIs, mobile, white-label)                          — Light in v1
├─ L3: AI/LLM analysis     (LLM gateway, agents, RAG, backtesting, signals)
├─ L2: Domain logic        (portfolios, orders, strategies, risk, compliance hooks)
├─ L1: Data plane          (market data, news, fundamentals, prices, events)
└─ L0: Platform foundations (auth, RLS, multi-tenant, audit, jobs, observability)    — Mostly exists
```

The personal-use v1 ships L0 hardened + L1–L3 + a thin L4 (just enough UI for one user). L5 is added later when stakeholders come online; same L0–L3 code works unchanged because everything is tenant-aware from day 1.

### 4.2 Domain & schema map

| Schema | Purpose | Status |
|---|---|---|
| `platform` | Shared infrastructure (tenants, franchises, profiles, user_roles, audit_log, access_log, integrations, oauth, identity_providers, service_accounts) | New schema; some objects migrated from `public` over time per separate epic |
| `markets` | Trading domain (portfolios, holdings, watchlists, instruments, prices, news, signals, strategies, backtests, broker_connections — when applicable) | New |
| `public` | Legacy & shared lookup. **Frozen** for new business objects per ADR-001 forward-only policy. | Grandfathered |
| `auth`, `storage`, `realtime`, `extensions`, `vault` | Supabase-managed | Untouched |

Cross-schema foreign keys are allowed and encouraged for shared infra (e.g., `markets.portfolios.tenant_id → platform.tenants.id`). All DDL and DML must be schema-qualified — `search_path` must not be relied on.

### 4.3 Compute tier model

| Tier | When | Reference stack | Modules |
|---|---|---|---|
| T1-compute | CRUD, validation, light business rules, simple inference (~95% of modules) | Supabase Edge Functions (Deno/TS) + Hono router + Zod + supabase-js + Anthropic TS SDK | All existing modules (amro, crm, logistics, quotation, compliance, finance), plus most of `markets` UI/API surface |
| T2-compute | Backtesting, quant math, ML, long-running LLM agent loops, heavy data ingest | FastAPI + Pydantic v2 + RQ + DuckDB + Polars + Anthropic Python SDK + Claude Agent SDK + MCP servers + uv + ruff | The Python worker servicing the `markets` domain |

A module picks its tier based on actual compute need, not preference. Every T2 module pays an operational cost (additional deploy target, additional language), and that cost must be justified.

---

## 5. Cross-cutting rules — summary table

Each rule is detailed as an ADR in Appendix A.

| ADR | Rule | Scope |
|---|---|---|
| 001 | Domain Schema Isolation | All new business objects live in their domain schema; `public` is frozen |
| 002 | All persistence is Supabase Postgres + RLS | Single source of truth |
| 003 | Auth via Supabase Auth only | No parallel user tables |
| 004 | Multi-tenancy: `tenant_id` everywhere; RLS authoritative | Data safety |
| 005 | State-changing ops write to `platform.audit_log` | Replay + compliance |
| 006 | Structured JSON logging with `tenant_id`, `user_id`, `request_id`, `domain`, `op`, `ms` | Observability |
| 007 | Public APIs versioned (`/api/v1/markets/…`); breaking changes require new major | Stable contracts |
| 008 | Architectural decisions in `docs/architecture/decisions/` (or as appendices in design plans) | Decision traceability |
| 009 | Migrations: `<ts>_<domain>_<change>.sql`, schema-qualified DDL | Reproducible DB |
| 010 | Domain-to-domain comms: read via explicit view + GRANT, write via event or HTTP — never direct cross-schema writes | Loose coupling |
| 011 | Three-level hierarchy `platform → tenant → franchise → resource`, multi-level franchise via `parent_franchise_id` + LTREE | Org modeling |
| 012 | Every business table has both `tenant_id` AND `franchise_id` (NOT NULL, FK) — exceptions explicitly tagged | Isolation invariant |
| 013 | RLS is the authoritative enforcer; app checks are belt-and-braces | Defense in depth |
| 014 | Every access attempt + mutation logged to `platform.access_log` / `platform.audit_log` | Forensics |
| 015 | Every external integration registered in `platform.integrations` | No shadow integrations |
| 016 | Credentials encrypted via pgsodium / external KMS; access via SECURITY DEFINER fns only | Secret hygiene |
| 017 | Inbound auth: OAuth 2.1 + PKCE / signed JWT / HMAC for webhooks | Standards-based |
| 018 | Every external call logged to `platform.integration_log` | Audit trail |
| 019 | Webhooks: signed, idempotent, retry-with-backoff, dead-lettered | Async resilience |
| 020 | Outbound calls go through rate-limiter + circuit-breaker per (integration × tenant) | Concentration risk |

---

## 6. Data model

### 6.1 `platform.*` (shared infrastructure)

```text
platform.tenants
  id UUID PK, slug TEXT UNIQUE, name TEXT,
  parent_tenant_id UUID NULLABLE FK platform.tenants(id),   -- holding-company
  data_region TEXT,                                          -- 'ap-south-1' default
  lifecycle_state TEXT,                                      -- draft|trial|active|suspended|terminated|purged
  plan_tier TEXT, sso_enabled BOOLEAN,
  custom_role_enabled BOOLEAN DEFAULT false,
  created_at, updated_at

platform.franchises
  id UUID PK, tenant_id FK platform.tenants,
  parent_franchise_id UUID NULLABLE FK platform.franchises, -- multi-level
  path LTREE,                                                -- materialized ancestry
  name TEXT, code TEXT, region TEXT,
  lifecycle_state TEXT, manager_id UUID FK platform.profiles
  UNIQUE (tenant_id, code)

platform.profiles
  id UUID PK FK auth.users, email TEXT, first_name, last_name,
  is_active BOOLEAN, default_timezone TEXT, default_locale TEXT

platform.user_roles
  id UUID PK, user_id FK platform.profiles, role platform.app_role,
  tenant_id NULLABLE, franchise_id NULLABLE,
  scope_paths LTREE[] NULLABLE,        -- E1: span multiple subtrees
  granted_by FK platform.profiles, granted_at,
  expires_at NULLABLE,                  -- E4: time-bounded ABAC
  conditions JSONB NULLABLE,            -- E4: arbitrary predicates
  UNIQUE (user_id, role, tenant_id, franchise_id)

platform.audit_log
  id BIGSERIAL PK, ts, request_id, domain, op, op_ms,
  tenant_id, franchise_id, user_id,
  resource_type, resource_id, action,
  before JSONB, after JSONB, ip, user_agent

platform.access_log
  id BIGSERIAL PK, ts, request_id, domain, op,
  tenant_id, franchise_id, user_id,
  resource_type, resource_id,
  decision TEXT,                        -- 'allow' | 'deny'
  reason TEXT, ms INT

platform.integrations
  id, kind, name, vendor, tenant_id NULLABLE, franchise_id NULLABLE,
  scope_json JSONB, vendor_risk_class TEXT, owner_user_id,
  lifecycle_state, created_at

platform.integration_credentials
  id, integration_id, credential_type, ciphertext_pgsodium BYTEA,
  rotation_policy JSONB, expires_at, last_rotated_at, last_used_at

platform.integration_log
  id BIGSERIAL, ts, direction TEXT, integration_id,
  tenant_id, franchise_id, user_id,
  request_id, method, url_path, status, latency_ms,
  bytes_in, bytes_out, body_redacted JSONB

platform.webhook_subscriptions
  id, integration_id, tenant_id, target_url, event_filter JSONB,
  signing_secret_id, retry_policy JSONB, last_delivery_ts, status

platform.integration_dlq
  id, integration_id, payload JSONB, error TEXT,
  attempts INT, first_failed_at, last_failed_at

platform.oauth_clients          -- we as OAuth Provider
  id, tenant_id, client_id, client_secret_hash,
  redirect_uris TEXT[], scopes TEXT[], type TEXT

platform.oauth_tokens
  id, oauth_client_id, user_id, refresh_token_hash,
  scopes TEXT[], expires_at, revoked_at

platform.service_accounts
  id, tenant_id, franchise_id, name, scope TEXT[],
  key_hash, last_used_at, expires_at

platform.identity_providers     -- SSO per tenant
  id, tenant_id, protocol TEXT, metadata_json JSONB, claims_mapping_json JSONB

platform.impersonation_sessions
  id, real_user_id, impersonated_user_id, reason TEXT,
  started_at, ended_at, audit_event_id

platform.app_role ENUM ('platform_admin','tenant_admin','franchise_admin','manager','operator')
```

### 6.2 `markets.*` (trading domain — v1 sketch)

```text
markets.instruments
  id UUID PK, symbol TEXT, exchange TEXT,             -- NSE/BSE/MCX/CDS
  isin TEXT, instrument_type TEXT,                    -- equity|mf|fno|comm|bond|etf|sgb
  lot_size, tick_size, expiry, strike,
  metadata JSONB

markets.price_history             -- consider partitioning by date
  instrument_id, ts TIMESTAMPTZ, open, high, low, close,
  volume, oi (NULLABLE — F&O only)
  PRIMARY KEY (instrument_id, ts)

markets.portfolios
  id, tenant_id, franchise_id, owner_user_id,
  name, base_currency, mode TEXT,                     -- 'paper' | 'live'
  created_at

markets.holdings
  id, portfolio_id, instrument_id,
  qty NUMERIC, avg_cost NUMERIC,
  last_updated_at

markets.watchlists
  id, tenant_id, franchise_id, owner_user_id, name

markets.watchlist_items
  watchlist_id, instrument_id, added_at, note

markets.news_events
  id, ts, source, title, body,
  instruments TEXT[],                                  -- tickers mentioned
  sentiment_score NUMERIC, raw_url

markets.signals
  id, ts, instrument_id, strategy_id, signal_type, score, rationale TEXT,
  generated_by TEXT                                    -- agent or rule engine name

markets.strategies
  id, tenant_id, franchise_id, owner_user_id,
  name, description, dsl TEXT,                         -- English description
  compiled_code TEXT, lifecycle_state

markets.backtests
  id, strategy_id, started_at, finished_at, status,
  params JSONB, metrics JSONB,                         -- sharpe, max_dd, cagr, etc.
  results_url                                          -- to object storage if large

markets.briefs                   -- daily/weekly LLM-generated briefs
  id, ts, tenant_id, franchise_id, owner_user_id,
  scope TEXT,                                          -- 'portfolio'|'watchlist'|'sector'
  body MARKDOWN, sources JSONB, llm_provider, llm_model, cost_usd NUMERIC

markets.research_threads         -- conversational research sessions
  id, tenant_id, franchise_id, owner_user_id, title

markets.research_messages
  id, thread_id, role, content, tool_calls JSONB, created_at

markets.broker_connections       -- only when broker integration begins
  id, tenant_id, franchise_id, user_id, broker_name,
  oauth_token_id FK platform.oauth_tokens,
  scope TEXT[], state TEXT
```

Every `markets.*` business table has both `tenant_id` and `franchise_id` NOT NULL FK columns, except `instruments`, `price_history`, and `news_events` which are platform-wide reference data (and therefore live in `markets.*` but are publicly readable across tenants — explicit exception logged via ADR-012).

### 6.3 RLS helper functions (in `platform`)

```sql
platform.user_can_access_franchise(uid UUID, franchise_id UUID) RETURNS BOOLEAN
  -- handles multi-level subtree via LTREE <@ operator

platform.user_has_scope(uid UUID, scope TEXT) RETURNS BOOLEAN
  -- ABAC layer; supports scope_paths and conditions JSONB

platform.is_within_tenant_subtree(uid UUID, tenant_id UUID) RETURNS BOOLEAN
  -- handles parent-tenant relationships for holding-company structures

platform.is_platform_admin(uid UUID) RETURNS BOOLEAN
platform.get_user_tenant_id(uid UUID) RETURNS UUID
platform.get_user_franchise_id(uid UUID) RETURNS UUID
```

All SECURITY DEFINER, owned by `postgres`, with `SET search_path = ''` to prevent injection.

---

## 7. Hierarchy & access control

### 7.1 The model

`platform → tenant → franchise → resource`. Every business row carries both `tenant_id` and `franchise_id`. RLS enforces isolation at the database. App-layer checks are defense in depth, not the source of truth.

### 7.2 Role tier (v1 fixed enum)

| Role | Scope | `tenant_id` | `franchise_id` | `domain` |
|---|---|---|---|---|
| `platform_admin` | Global, all tenants and all franchises. SOS staff only. Every action audited. | NULL | NULL | NULL |
| `platform_domain_admin` | Platform-wide but **scoped to one domain** (e.g., a `markets` platform admin who sees all tenants' markets data but no other domains). Useful for delegated platform admin and segregation of duties. | NULL | NULL | **required** (e.g., `'markets'`) |
| `tenant_admin` | All franchises within their tenant (including subtree if multi-level franchise) | required | NULL | NULL |
| `franchise_admin` | Their specific franchise (and its sub-franchises if any) | required | required | NULL |
| `manager` | Their franchise; cannot manage users or franchise settings | required | required | NULL |
| `operator` | Their franchise; cannot view financial reports or admin | required | required | NULL |

The `domain` field on `user_roles` is `TEXT NULL`. It is required only for `platform_domain_admin` and must be `NULL` for every other role. Forward-compatible with a future `platform.domains` registry (FK) once the domain set is formalized.

Custom roles deferred until first paying customer asks (ADR-019, deferred).

### 7.3 Service accounts (ADR-015 dependency)

A non-human identity bound to a `(tenant_id, franchise_id, scope[])` tuple. Used for broker API integrations, webhooks, internal services. Keys rotated per policy. Treated as a user for RLS purposes (gets an `auth.users` entry under a system tenant).

### 7.4 Audited impersonation

`platform.impersonation_sessions` records every "act as user X" by a platform_admin or tenant_admin. Requires explicit reason. Bounded by max-session-duration. Every action during the session is double-tagged: `user_id` is the impersonated user, `acted_by` is the real user.

### 7.5 Tenant lifecycle

States: `draft → trial → active → suspended → terminated → purged`. Lifecycle transitions are gated by ADR-020. Suspended tenants are read-only at the RLS layer. Terminated tenants get a 30-day soft-delete window before purge; purge is irreversible and writes to `platform.audit_log` with `acted_by = system`.

---

## 8. Integration model

### 8.1 Surfaces

**Inbound** — public API consumers (OAuth 2.1 + PKCE / client_credentials), webhooks (HMAC + idempotency), enterprise SSO (SAML 2.0 / OIDC / SCIM 2.0), consumer logins, file/data drops.

**Outbound** — broker APIs (Kite / Upstox / Angel / Breeze; user-delegated OAuth), market data feeds (NSE/BSE/MCX, news, fundamentals), payment gateways (Razorpay / Stripe), email/SMS/push, AI/LLM providers (Anthropic, OpenAI, Gemini), Account Aggregator (deferred), tenant-owned webhook subscribers.

### 8.2 Adapter pattern

Brokers, IDPs, and market-data vendors each implement a common interface:

```python
class BrokerAdapter(Protocol):
    name: str
    def connect(user, oauth_callback) -> Connection: ...
    def get_holdings(connection) -> list[Holding]: ...
    def get_positions(connection) -> list[Position]: ...
    def stream_quotes(connection, symbols) -> AsyncIterator[Quote]: ...
    def place_order(...) -> OrderResult: ...   # gated by feature flag in v1
```

Concrete adapters: `KiteAdapter`, `UpstoxAdapter`, `AngelAdapter`. Adding a broker is plug-in work, not a rewrite. All adapters route through the integration gateway, so rate-limit / circuit-breaker / cost-tracking is uniform.

### 8.3 Webhook resilience

Inbound webhooks: signature verify → idempotency check (`platform.idempotency_keys`) → enqueue (RQ) → process async. Dead-letter on N failures.

Outbound webhooks: per-subscription signing secret rotation; exponential backoff with jitter; DLQ after N retries; replay UI for support.

### 8.4 Egress proxy

All outbound HTTP from the Python worker goes through a single proxy that enforces DNS allowlist + injects `request_id` + logs to `platform.integration_log`. Removes "someone added a `fetch()` somewhere" risk.

---

## 9. AI / LLM architecture

### 9.1 LLM Gateway (single chokepoint, Python worker)

All AI traffic — direct API calls, custom agents, Anthropic Managed Agents, fallback providers — routes through a single gateway in the Python worker. The gateway handles:

- Provider routing (Anthropic primary, OpenAI / Gemini for cost tier or fallback)
- Per-tenant rate limit + cost budget
- Per-request cost attribution (`platform.llm_usage` table)
- Prompt resolution from registry (`markets.prompts` versioned)
- Tool-use registry (which tools each agent may invoke)
- Response post-processing (citations, redaction, format validation)
- Eval gating (sampled outputs scored against golden set)

### 9.2 Anthropic hybrid strategy

**Build ourselves (Indian-market-specific):**
- Market Researcher (NSE/BSE specifics, Screener.in / Tickertape / Moneycontrol data, FII/DII flows, sectoral analysis)
- Earnings Reviewer (Indian quarterly format, MIS reports, conference call transcripts)
- Valuation Reviewer (Indian sector-specific multiples)
- Strategy Lab / Backtester (Python + Polars + DuckDB)
- Daily / weekly Brief Generator

**Adopt Anthropic Managed Agents (universal ops):**
- KYC Screener (after regional fine-tuning for Indian KYC norms)
- Statement Auditor (broker statement vs internal records)
- General Ledger Reconciler / Month-end Closer (internal treasury use)
- Pitch Builder (for advisor stakeholders later)

**Skipped:** Meeting preparer (not core), heavy Excel-shaped Model builder (our backtester replaces this).

### 9.3 MCP servers

Two MCP servers exposed by the Python worker:

- `markets-data` — read-only access to instruments, prices, fundamentals, news, FII/DII flows
- `markets-portfolio` — read/write access to a user's portfolio (paper or live), watchlists, briefs

Used by:
- Our custom agents (running in our Python worker via Claude Agent SDK)
- Anthropic Managed Agents (when adopted) — gives them access to Indian-market data they otherwise lack
- Future stakeholder integrations

Auth is service-account JWT; all access logged to `platform.integration_log`.

### 9.4 Prompt registry & eval framework

`markets.prompts` (versioned, with `state ∈ {draft, active, deprecated}`). Every agent run records the prompt version used. `markets.evals` defines golden inputs + expected outputs + scoring rubric; CI runs evals on prompt or model changes; regressions block merge.

### 9.5 Per-tenant cost attribution

`platform.llm_usage` table: every LLM call writes `tenant_id, franchise_id, user_id, provider, model, input_tokens, output_tokens, cost_usd, request_id`. Enables: tenant-level billing of AI usage, cost anomaly detection, internal cost dashboards.

### 9.6 Local / self-hosted LLM asset (owner-provided)

The platform owner already operates a **local Qwen 3.6 35B** installation on owned hardware, intended initially for personal use and later for tenant-scoped fine-tuning. The LLM Gateway (§9.1) MUST be designed so this local endpoint can be registered as just another provider — same routing, caching, cost-attribution, and prompt-registry plumbing — once integration becomes warranted.

**Use cases this unlocks (when adopted, not v1):**
- **Cost-floor inference** for high-volume narrow tasks (e.g., news headline classification, sentiment scoring) where Gemini Flash cost-per-call is acceptable today but a self-hosted model is even cheaper at sustained volume.
- **Fine-tuning** on tenant-private data (broker statement parsing patterns, India-specific KYC normalizations, internal SOP-following agents) without sending that data to a third-party API. Qwen supports LoRA / QLoRA fine-tuning on consumer-grade GPUs.
- **Data-residency-strict workloads** for tenants whose contracts forbid sending data to Anthropic / OpenAI / Google.
- **Offline / air-gapped scenarios** if a future tenant deployment requires it.
- **Fallback model** when external providers are throttled / down (graceful-degradation tier in the fallback chain).

**Why this is deferred (not v1):**
- Personal-use markets v1 has near-zero AI cost on Anthropic Sonnet (see ADR-024); no economic pressure yet.
- Ops cost of adding a self-hosted model into the LLM Gateway fallback chain is non-trivial — GPU monitoring, restart on OOM, prompt format differences (chat templates), tokenizer mismatches.
- Fine-tuning effort only pays off after we have labeled training data, which is a function of user volume.

**Implementation constraints when adopted** (record now to avoid surprises later):
- Local Qwen endpoint must speak an OpenAI-compatible REST API (vLLM, TGI, or Ollama's `/v1/chat/completions` shim) so the LLM Gateway provider abstraction stays uniform.
- All calls must still write to `platform.llm_usage` with `provider='local-qwen', cost_usd=0` so internal compute cost is tracked separately from external API spend.
- Fine-tuned model variants are versioned in `markets.prompts`-style registry (model_id + adapter_id), with eval gates before promoting to `active`.
- Tenant assignment of fine-tuned variants is per-domain (e.g., a Qwen LoRA tuned for AMRO maintenance manuals is invoked only for that tenant's AMRO workloads).

---

## 10. Indian regulatory overlay

Each requirement here maps to a concrete artifact in the data model or process model:

| Regulation | Requirement | Implementation hook |
|---|---|---|
| **SEBI Master Direction on IT Outsourcing & Cloud (2023)** | Vendor risk register, audit rights, exit plan per vendor | `platform.integrations.vendor_risk_class` column; per-vendor risk doc in `docs/vendors/` |
| **CERT-In Cyber Crisis Management Plan (2022)** | Security incident reported to CERT-In within 6 hours | `platform.integration_log` + `platform.access_log` are forensic sources; runbook in `docs/runbooks/incident-cert-in.md` |
| **DPDP Act 2023** | Consent records, data fiduciary disclosures, right-to-erasure, cross-border data restrictions | Consent records in `platform.consents` (T3 deliverable); erasure flow as tenant lifecycle `purged`; cross-border flagged via `platform.tenants.data_region` |
| **RBI Master Direction on Outsourcing of IT Services (2023)** | Concentration risk metrics | Per-vendor traffic share computed from `platform.integration_log` |
| **Account Aggregator framework (RBI / Sahamati)** | If pulling bank/MF data, FIU registration | **Deferred** — no AA integration in v1 |
| **SEBI Algo Trading Framework (2025)** | Algo registration, strategy IDs, rate limits per broker rules | Adapter layer enforces algo_id tagging on every order (T2/T3); brokers verify via their compliance flow |
| **SEBI RA / RIA framework (updated 2024-25)** | Personalized advice requires RIA registration; generic content does not | **Deferred** — personal-use phase produces no personalized recommendations for third parties; before commercial launch, obtain RIA or position as research-only |
| **GST + Reverse Charge** | LLM API costs billed by Anthropic (foreign vendor) attract reverse-charge GST | Finance to handle in TDS / RCM flow; tracked in `platform.llm_usage.cost_usd` |

---

## 11. Sequencing — T0 through T4

### T0 — Today (hours)

Secret rotation runbook in section 0. **Everything below is blocked until T0 is closed.**

### T1 — Pre-markets foundations (2–4 weeks)

Critical gaps that compromise the markets build or are too expensive to bolt on later.

- ADRs 001–020 written and accepted (this doc + appendices)
- `platform` schema created; new shared tables added (no migration of existing `public.*` yet — that's a separate epic per ADR-004)
- `platform.access_log` table + Edge Function middleware for access logging
- Distributed rate limiter (Redis or Upstash) — replace in-memory
- Feature flag system (Unleash or LaunchDarkly — pick in implementation)
- Pre-commit hooks (husky + lint-staged)
- Dependabot + Gitleaks/TruffleHog in CI
- CSP + security headers middleware
- Distributed tracing (OpenTelemetry collector + a backend — Datadog or Honeycomb)
- LLM Gateway scaffold in the Python worker
- Prompt registry + eval framework scaffolds
- `platform.llm_usage` table for cost tracking
- Migration naming convention enforced (lint check on PR)
- P0 hierarchy fixes: NOT NULL `franchise_id` on `accounts`, add to `quote_approval_rules`, `compliance_*`, finance tables
- `THREAT_MODEL.md` skeleton

### T2 — Markets domain build (8–10 weeks)

Built on T1 foundations; runs partly in parallel with T3.

- Python worker service stood up (FastAPI + RQ + DuckDB + Polars + Anthropic SDK + Claude Agent SDK)
- `markets` schema with all v1 tables (instruments, prices, portfolios, holdings, watchlists, signals, strategies, backtests, briefs, research_threads/messages)
- Data ingestion: NSE/BSE EOD prices, BSE StAR MF NAVs, news (free APIs to start)
- LLM analysis engines: Brief Generator, Market Researcher (custom), Earnings Reviewer (custom)
- Paper portfolio tracking
- Interactive research thread (chat over portfolio + market data)
- Backtest engine v1 (vectorized via Polars; fancy event-driven later)
- Multi-level franchise hierarchy (`parent_franchise_id` + LTREE) — applied to all of `markets.*` from day 1; existing `public.*` migration tracked separately
- Service accounts table + auth flow (no broker connections yet)
- MCP servers (`markets-data` read-only first; `markets-portfolio` second)
- Frontend: a thin set of pages in the existing React app (briefs, watchlists, portfolio, research chat)

### T3 — Commercial enablement (6–8 weeks, last half parallel with T2)

The set of items required *before* the platform can be sold to paying customers.

- Billing (Razorpay primary, Stripe secondary)
- Tax calc (GST, with proper HSN/SAC codes)
- Invoicing (PDF, GSTIN compliant)
- Trial enforcement + plan-tier entitlements (wired through feature flags)
- Self-serve signup flow (with eKYC via Aadhaar+OTP / DigiLocker if practical for the customer segment)
- Support ticketing (Freshdesk / Intercom)
- DPDP consent management + data export + erasure flow
- Data classification tags on PII fields
- Audited impersonation flow (UI + audit pipeline)
- Tenant lifecycle states wired through (`draft → trial → active → suspended → terminated → purged`)
- SSO / SAML / OIDC + SCIM (for enterprise customers)
- Multi-timezone enforcement (timestamptz everywhere, user TZ pref)

### T4 — Scale & polish (ongoing, in parallel)

- TimescaleDB for `markets.price_history` + `platform.integration_log` partitioning
- Eval framework matures (broader golden sets, automatic regression gates)
- Public SDK (Python + TypeScript)
- Webhook subscription marketplace UI
- Plugin / app marketplace surface
- Account Aggregator integration (when first customer needs it)
- Cross-region failover + formal DR drills + published RTO/RPO
- Account-level white-labeling
- Visual regression coverage expansion
- Migration of existing `public.*` business objects into proper domain schemas (separate epic per ADR-004; not gated by markets)

---

## 12. Existing platform audit summary

Two parallel audits informed this plan. Both retained in full in their respective sections of this doc; the high-order findings:

### 12.1 Access-control compliance

`B+ overall.` Hierarchy tables, RLS, role enum, audit triggers all present. ~80% of the spec is in place.

**P0 gaps (must close in T1 or early T2):**
- `accounts.franchise_id` is nullable — make NOT NULL
- `quote_approval_rules.franchise_id` is missing entirely — add
- `compliance_*` and parts of `finance.*` lack `franchise_id` — full retrofit
- `audit_logs.request_id` missing — add; require Edge Functions to write it
- Read-access logging absent — add `platform.access_log`
- Migration naming has drifted to UUID-suffixed format

### 12.2 Enterprise-grade readiness

`60–65% ready.` Of 70 dimensions audited: 24 ✅ mature, 28 🟡 partial, 18 ❌ missing.

**Pleasant surprises:** pgvector + Knowledge Base already exists; k6 load tests with SLA gates in CI; webhook framework already in place.

**Critical gaps by category:** secrets in repo (T0), billing/commerce missing (T3), feature flags missing (T1), distributed rate limit missing (T1), threat model missing (T1), vulnerability scanning missing (T1), pre-commit hooks missing (T1), distributed tracing missing (T1).

### 12.3 Module retrofit list (forward-only policy)

Per ADR-004, these modules are grandfathered. New work in them follows the new rules; their existing patterns are not retrofitted in this plan.

| Module | Compliance | Notes |
|---|---|---|
| AMRO | ✅ Compliant | tenant + franchise + RLS + audit all present |
| Logistics | ✅ Compliant | same |
| CRM | 🟡 Partial | `accounts.franchise_id` nullable — fix in T1 |
| Quotation | 🟡 Partial | `quote_approval_rules.franchise_id` missing — fix in T1 |
| Compliance | ❌ Non-compliant | franchise_id missing on rules/checks — fix in T1 |
| Finance | ❌ Non-compliant | franchise_id missing on invoices/transactions — fix in T1 |

The T1 fixes for CRM / Quotation / Compliance / Finance are tactical (add column, backfill, NOT NULL constraint, RLS policy update) — not a re-architecture.

---

## 13. Open items / deferred decisions

| ID | Item | Defer to |
|---|---|---|
| D-1 | Custom roles + permissions matrix (extend `app_role` enum to a `roles` table) | Until first paying customer asks |
| D-2 | ABAC layer (time-bounded grants, geo-bounded grants) | Until first compliance audit requires it |
| D-3 | Account Aggregator integration | Until first customer needs bank/MF pull |
| D-4 | Multi-region data residency / EU customers | Until first non-India customer |
| D-5 | Crypto/VDA trading | Indefinite (regulatory regime hostile) |
| D-6 | Live broker execution | After paper trading proves the adapter stack |
| D-7 | Anthropic Managed Agents adoption | After T2 establishes the LLM Gateway and MCP servers |
| D-8 | Migration of existing `public.*` business objects to domain schemas | Tracked epic, not gated by markets |
| D-9 | Public SDK in Python / TypeScript | T4 |
| D-10 | Plugin marketplace | T4 |
| D-11 | Integrate owner-operated local **Qwen 3.6 35B** as an LLM Gateway provider (§9.6) — for cost-floor inference, tenant-scoped fine-tuning (LoRA/QLoRA), data-residency-strict workloads, and fallback tier | After T2 LLM Gateway lands AND first concrete need surfaces (volume / fine-tune data / residency mandate) |

---

## 14. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `.env` exposure has already been exploited | Medium | Critical | T0 runbook + 90-day log audit; if exploited, treat as breach + CERT-In notification |
| Indian-market data sources change pricing / break terms | High | Medium | Adapter pattern abstracts data sources; fall back to alternates; budget for paid vendor if free APIs fail |
| Anthropic SDK GA slips beyond June 15, 2026 | Low | Low | We can build on the public API + raw tool use without the SDK |
| Backtest engine results inaccurate vs broker reality | High | High | Reconciliation suite that diffs paper vs live; backtester explicitly modeled as approximation; warnings in UI |
| SEBI changes algo trading rules mid-build | Medium | High | Adapter enforces algo_id tagging from day 1; design assumes the regime tightens |
| Multi-domain `public → platform` retrofit epic is harder than estimated | High | Medium | Forward-only policy ensures the markets build doesn't depend on it |
| Cost of Anthropic Managed Agents at scale exceeds plan | Medium | Medium | Per-tenant cost cap; fall back to custom agents when budget hit; gateway enforces |
| Python worker becomes a single point of failure | Low | High | Stateless service + horizontal scaling; Postgres is the source of truth; jobs are durable in RQ |
| Tenant cross-leak via a missed RLS policy | Low | Catastrophic | Defense in depth: RLS + app checks + access log + automated test suite that runs every PR querying "what can tenant X see of tenant Y" |
| Hiring / capacity constraints | High | High | Plan is sized for solo build; T2/T3 parallelism is optional; T3 can be sequential at cost of ~2 weeks |

---

## 15. Approval & next steps

This document supersedes the verbal decisions made during the 2026-05-14 brainstorm session. Once approved:

1. **T0 begins immediately** — credential rotation and history purge (within 24 hours).
2. **T1 work is broken into discrete implementation plans**, each authored separately per the writing-plans skill, and executed sequentially or in small parallel batches.
3. **The first T1 plan to write** is "platform schema bootstrap + access_log + integration registry + service accounts + helper functions" — these are the foundations every later piece depends on.
4. **Domain registry** at `docs/architecture/DOMAIN_REGISTRY.md` will be created with `markets` as a row (compute tier T2, lifecycle `draft`, owner TBD).
5. **Threat model skeleton** at `docs/architecture/THREAT_MODEL.md` will be created with STRIDE categories for at least the auth surface, integration surface, and data plane.

---

## 16. Platform-wide scale review (2026-05-15)

### 16.1 Purpose

This section captures the findings of a focused architecture review conducted on 2026-05-15, one day after the original draft of this design. The trigger was the recognition that the markets domain is one of several business domains (CRM, Sales, Logistics, AMRO, Finance, Quotation, Flypal, UIM, Markets) sharing the same IT infrastructure, and that scale problems unaddressed now compound across domains and become refactor debt later — especially against live production data. The review converts that recognition into evidence-backed action items, sequenced into §11.

### 16.2 Method

Four parallel automated audits were dispatched against the repository: (a) frontend size and bundling, (b) backend runtimes and shared libraries, (c) infrastructure and deployment, (d) cross-cutting concerns (auth, multi-tenancy, observability, audit). In parallel, Postgres diagnostics ran against the active Supabase project `gzhxgoigflftharcmdqj` (SG-Logistics-Pro-Enterprise, ap-south-1): connection limits, partitioning state, replication, RLS policy distribution, table sizes, hot-table DML, advisor lint counts, and `pg_stat_statements` hotspots. The frontend audit was partially blocked by tool permissions and captured only the gross file count; other dimensions remain unmeasured and are flagged in §16.9.

### 16.3 Current state — at a glance

The repository is meaningfully larger and more mature than its "pre-launch" framing implies. Concrete dimensions as observed on 2026-05-15:

| Layer | Metric | Value |
|---|---|---|
| Database | User tables | 503 |
| Database | User functions | 410 |
| Database | User views (all SECURITY DEFINER per advisor) | 13 |
| Database | RLS policies (total / in `public`) | 1,026 / 982 |
| Database | Tables with ≥3 permissive policies per command | 53 |
| Database | Partitioned tables | 3 (`public.system_logs`, `public.task_evidence`, `realtime.messages`) |
| Database | Active replication slots | 0 |
| Database | `max_connections` | **60** |
| Database | `shared_buffers` / `work_mem` | 224 MB / 2 MB |
| Database | DB total size | 3.8 GB (dominated by `system_logs` monthly partitions) |
| Backend | Supabase Edge Functions | 120+ |
| Backend | Largest function | `self-service-onboarding` (2,093 LOC) |
| Backend | API routes (Next.js-style under a Vite app) | ~40 across `src/pages/api/v1`, `/v2`, legacy |
| Backend | `pg.Pool` max (per `_utils/dbPool.ts`) | **50** |
| Backend | Background job system actually wired | none (BullMQ + ioredis installed, unused) |
| Backend | Rate-limit storage | in-memory `Map` (`_utils/http.ts:549-586`) |
| Frontend | `.ts`/`.tsx` files in `src/` | 1,845 |
| Frontend | Sentry browser-tracing sample rate | 100% |
| Frontend | Supabase Realtime usage | none (0 publication tables, 0 client `.channel()` subscriptions) |
| Infra | Production deployment target | static SPA on Hostinger Nginx |
| Infra | CI/CD pipeline | none (`.github/workflows/` empty) |
| Infra | Pre-commit / secret scanning | none |
| Cross-cutting | `console.log` instances in `src/` | 839 |
| Cross-cutting | `ScopedDataAccess` references | 165 (RLS + app-layer dual enforcement) |
| Hot table | `system_logs_y2026m05` | 2 GB, 1.8M rows (already partitioned by month — good) |
| Hot table | `audit_logs` | 135 MB / 2,022 rows / **never vacuumed** → severe bloat |
| Hot table | `quotation_audit_log` | 60 MB / 0 rows → dead bloat |
| Hot table | `directives` | 13,412 rows / 5,500 deletes / 5,821 updates — heaviest churn |
| Hot table | `tasks` | 4,573 rows / 27,310 updates / 282 deletes (covered by 2026-05-14 green-lane indexes) |

Existing modules — CRM, Logistics, AMRO, Finance, Quotation, Flypal, UIM — sit on this base. The CRM module specifically owns two parallel data models (`public.contacts/accounts` ~0 live rows + 20 MB bloat vs. `module_crm.module_crm_contacts/accounts` ~9k rows each), evidence of an incomplete refactor that other domains may have repeated.

### 16.4 Critical pitfalls — must close before exposure

Each will physically cap or break the platform before it reaches 100k users.

**C1. `max_connections=60` with `pg.Pool max=50` already configured in the API tier.** A single API process consumes 80% of the connection budget. Horizontal scaling of the API tier, addition of a Python worker (per §4.3), or any concurrent migration tool will starve the database. **Mitigation:** increase to ≥500 on the Supabase plan; route all clients through Supavisor's transaction-pool URL exclusively; reduce per-instance `pg.Pool` max to 10–15.

**C2. Edge Functions configured with `verify_jwt = false`.** **VERIFIED 2026-05-15** by counting `verify_jwt = false` entries in `supabase/config.toml`: **83 of 109 edge function folders** have JWT verification explicitly disabled. Zero functions have `verify_jwt = true` explicitly; the remaining 26 inherit the Supabase default (`true`). Functions configured `false` accept any caller bearing the project's anon `apikey` with no per-user JWT validation — a real attack surface for any function that mutates data based on a `tenant_id` in the request body. **Deferred per owner instruction 2026-05-15** (no immediate fix required during personal-use phase); see "Production Launch Gate" below for the strict pre-live audit requirement.

**C3. In-memory rate limiting.** `_utils/http.ts:549-586` stores rate-limit state in a per-process `Map`. Multi-instance deployment trivially bypasses limits. **Mitigation:** move to Redis sorted-sets (the `ioredis` dependency is already installed but unused).

**C4. No CI/CD, no pre-commit hooks, no secret scanner.** `.github/workflows/` is empty. The original `.env` secrets leak (see §T0) shows the failure mode. **Mitigation:** add a minimal GitHub Actions workflow (install + lint + vitest + playwright smoke + gitleaks) and Husky + lint-staged before any further team contributions land.

**C5. No background-job system actually running.** BullMQ v5.70.4 and `ioredis` are present in `package.json` but no queues are wired. PDF generation is currently DB-trigger-driven (INSERT on `quotation_versions` self-triggers the edge function) with no retry, no DLQ, no idempotency. Email sync is a 1,309-LOC edge function executed inline. **Mitigation:** activate BullMQ; define queues for PDF, email, report, and notification work; replace the DB-trigger pattern with explicit job enqueue.

**C6. Severe bloat on audit tables.** `audit_logs` has 2,022 rows in 135 MB and has never been vacuumed; `quotation_audit_log` has 0 rows in 60 MB. JSON `before`/`after` columns are toasted but heap is not reclaimed. **Mitigation:** `VACUUM (FULL, VERBOSE) audit_logs; VACUUM (FULL, VERBOSE) quotation_audit_log;` plus a recurring retention policy.

**C7. No read replicas.** `pg_replication_slots` is empty. All reads contend with all writes on a single instance. **Mitigation:** enable Supabase read replicas (paid feature); add a `SUPABASE_READONLY_URL` env and route SELECT-heavy paths to it.

**C8. Single-region static Hostinger Nginx; no CDN.** India users are well-served (project is in `ap-south-1`); other regions pay >300ms TTFB on every navigation. **Mitigation:** put Cloudflare (or equivalent) in front of the Hostinger origin — handles 1M MAU on free tier.

### 16.5 High-impact pitfalls — close before scale

| # | Pitfall | Evidence | Affected domains |
|---|---|---|---|
| H1 | Sentry browser-tracing at 100% sample + 10% session replay (100% on error) | `src/lib/sentry.ts` | All |
| H2 | 839 `console.log` calls in `src/` flushed to `system_logs` (already 1.8M rows / 2 GB in May 2026 alone) | grep + DB | All |
| H3 | 9,113 `multiple_permissive_policies` and 893 `auth_rls_initplan` per advisor | Supabase advisor 2026-05-14 | Storage (27 policies on `storage.objects`), CRM (982 policies in `public`) |
| H4 | 13 SECURITY DEFINER views (including the `amro_stock_*` family) bypass caller RLS | Advisor + audit | AMRO, Quotation |
| H5 | 18 ERROR-level RLS-disabled tables in `public` and `flypal` | Advisor | Flypal, AMRO compliance, schema_migrations, quote_acceptances |
| H6 | Two parallel data models for CRM (`public.contacts/accounts` vs. `module_crm.*`) | DB size + row counts | CRM (and likely a pattern repeated in other modules) |
| H7 | JWT verified via remote `authApi.getClaims()` call per request | `_shared/auth.ts` | All edge-function paths |
| H8 | ~~No real-time strategy in place~~ → **Resolved 2026-05-15 by ADR-023** (three-lane model: L-CDC via Supabase Realtime, L-FAN via dedicated WS service, L-STR via SSE). Event bus implementation still pending. | grep + audit + ADR-023 | Markets (worst), notification flows |
| H9 | `tenants.data_region` plumbed but unused — multi-region retrofit will be painful | Code audit | Future enterprise customers |
| H10 | `adminOverrideEnabled` toggle has no audit-log entry when flipped | Code audit | All — compliance violation |

### 16.6 What is already in place — preserve

The platform has more scaffolding than commonly recognized. Specifically:

- **`ScopedDataAccess`** (`src/lib/db/access.ts`, 165 references) implements RLS-plus-app-layer dual enforcement — strong tenant safety
- **Monthly partitioning of `system_logs`** is working; the partition pattern can be reused for `audit_logs`, `integration_log`, `llm_usage`
- **k6 load tests** (`tests/performance/uim-phase5-load.k6.js`) with profiles up to 2,000 VUs, p95 < 2.2s budgets, in `npm run perf:uim:k6:*`
- **Playwright matrix** across Chromium / Firefox / WebKit / iOS / Android / Edge
- **Sentry, PostHog, custom logger with PII masking** all initialized
- **`pgvector` extension installed** — RAG-ready
- **`pg_stat_statements`** active
- **Supavisor pooler present** (`pgbouncer` schema visible in the project) — the routing layer exists, just needs enforced use
- **Multi-tenant + multi-franchise + multi-domain organization** plumbed at type level (`TenantContext.tenantId/franchiseId/dataResidencyRegion`)
- **k8s manifest scaffolding intent** captured in `Dockerfile` and `docker-compose.yml` even though prod manifests are absent
- **Strong domain folder organization** in code (CRM, AMRO, Logistics, Finance, Quotation kept separate)

### 16.7 Per-domain implications

Each existing domain inherits the universal fixes (§16.8 Category 1) transparently. Domain-specific work is summarized below — **none requires re-architecture, only targeted cleanup.**

| Domain | Compliance signal | Domain-specific work for 1M scale |
|---|---|---|
| **CRM** | 982 policies dominated by this domain; duplicate `public.*` vs `module_crm.*` models | Pick `module_crm.*` as canonical home; collapse the permissive-policy explosion; green-lane FK indexes from 2026-05-14 already cover the main hot paths |
| **Logistics** | Schema-compliant per the original audit (§12.3) | Cache layer for rate-matrix reads; same `public`-vs-domain dedup discipline |
| **AMRO (parts, maintenance, work orders)** | Highest hot-DML — `tasks` 27k updates, `directives` 5.5k deletes; received 61 covering FK indexes on 2026-05-14 | Time-partition `amro_operational_telemetry` and `asset_health_signals` once they grow; convert the `amro_stock_*` SECURITY DEFINER views to `security_invoker=on` per §16.5-H4 |
| **Finance** | `franchise_id` missing on invoices/transactions per §12.3 | T1 retrofit (already in plan); async audit-log writes for invoice mutations |
| **Quotation** | `quote_approval_rules.franchise_id` missing per §12.3 | T1 retrofit; replace DB-trigger PDF generation with BullMQ job |
| **Flypal** | Own schema; 25k parts; low DML | Verify RLS coverage on `flypal.*` tables (several are RLS-disabled per advisor) |
| **UIM (inventory)** | Own schema; SECURITY DEFINER views flagged | Tighten views to `security_invoker=on`; ensure indexes on time-series tables |
| **Markets (new)** | Plan exists; not yet implemented | Build on the foundations from §16.8; do **not** extend the in-memory rate limiter or DB-trigger job patterns |

### 16.8 Action plan — additions to §11

The sequencing in §11 is preserved. The items below are added to specific phases.

#### Added to T0 (this week)

- **T0-S1.** ~~Verify `verify_jwt` deployment state on every edge function; enable where missing.~~ **Verified 2026-05-15** — 83 of 109 functions have `verify_jwt = false` in `supabase/config.toml`. Per-function fix **deferred** during personal-use phase per owner instruction. **Gated by §16.11 G-1 before production launch.**
- **T0-S2.** Bump `max_connections` to ≥500 on the Supabase plan (§16.4-C1).
- **T0-S3.** Drop Sentry sample rates: browser tracing 1-5%, replay only on error (§16.5-H1).
- **T0-S4.** Add minimal GitHub Actions workflow + gitleaks + Husky + lint-staged (§16.4-C4).
- **T0-S5.** `VACUUM (FULL)` `audit_logs` and `quotation_audit_log`; reclaim ~190 MB (§16.4-C6).

#### Added to T1.5 (new phase, between T1 and T2 — 4-6 weeks)

Universal-tier work that benefits CRM / Logistics / AMRO / Finance / Quotation / Flypal / UIM / Markets transparently:

- **T1.5-P1. Connection-pool discipline.** Mandatory Supavisor transaction-pool URL for all clients; per-instance `pg.Pool` max ≤ 15; documented in **ADR-021** (new).
- **T1.5-P2. Redis Cluster.** Activate the installed `ioredis` dependency for: distributed rate limiting (replaces in-memory `Map`), JWT verification cache with 60s TTL (eliminates remote `getClaims()` round-trips), idempotency keys, hot-quote cache, feature-flag values, future WS subscription state.
- **T1.5-P3. Background jobs on BullMQ.** Wire the queue. Move PDF generation, email sync, report rendering, notification fan-out into queue-backed workers with retry + DLQ + idempotency. Retire the DB-trigger-driven PDF pattern.
- **T1.5-P4. Async write pipeline for log tables.** Pattern: app → Redis Stream → batch flusher → Postgres. Applied to `audit_logs`, planned `integration_log`, planned `llm_usage`. The `system_logs` monthly-partition pattern continues unchanged. **ADR-022** (new) documents the pattern.
- **T1.5-P5. Log discipline.** ESLint rule banning `console.log` in `src/`; replace all 839 occurrences with `logger.debug()` gated by env. Expected ~80% drop in `system_logs` write volume.
- **T1.5-P6. Feature flags upgrade.** Replace env-baked flags with a runtime-resolvable model: keep the current `src/lib/feature-flags.ts` surface but resolve through a DB-backed `platform.feature_flag_overrides (tenant_id, flag, value)` lookup with a 60s Redis cache.
- **T1.5-P7. CDN.** Cloudflare in front of the Hostinger origin (free tier handles 1M MAU).
- **T1.5-P8. Observability.** OpenTelemetry collector; propagate W3C `traceparent` alongside the existing `X-Correlation-Id`; choose a backend (Honeycomb or Datadog) and ship traces from edge functions and the future Python worker.
- **T1.5-P9. Read-replica routing.** `SUPABASE_READONLY_URL` env; route SELECT-heavy paths (dashboards, list views, briefs) to the replica.
- **T1.5-P10. SLO baseline.** API p99 < 200ms · WS msg lag p99 < 500ms · brief gen p99 < 30s · broker order roundtrip p99 < 1s · expanded k6 load coverage hitting every domain (not just UIM).
- **T1.5-P11. `adminOverride` audit.** Every flip writes to `platform.audit_log` with `acted_by`, `tenant_id`, reason. Closes §16.5-H10.

#### Added to T2 (existing markets build phase)

- **T2-D1. Domain-by-domain RLS consolidation.** One PR per domain that:
  - Merges multiple permissive policies into 1-2 per `(role, command)`
  - Wraps `auth.uid()` in `(SELECT auth.uid())` — applies to all 893 `auth_rls_initplan` findings
  - Enables RLS on the 18 currently-disabled tables with appropriate policies
  - Converts SECURITY DEFINER views to `security_invoker=on` where they should respect caller RLS
  - Recommended order: `storage.objects` (27 policies — worst), `crm.*`, `amro.*`, `logistics.*`, `finance.*`, then `flypal.*` and `uim.*`.
- **T2-D2. CRM dedup.** Decide canonical home (`module_crm.*` is recommended given live row counts); deprecate `public.contacts/accounts`; same exercise for any other domain that has parallel `public.*` and `module_*.*` tables.

#### Promoted from T4 to T2

- **TimescaleDB extension** installed; `amro_operational_telemetry`, `asset_health_signals`, and the planned `markets.price_history` converted to hypertables.

### 16.9 Known gaps in this review

This review's evidence is uneven. Items requiring follow-up before relying on conclusions:

1. **Frontend bundling, code splitting, lazy-route coverage, and `src/types/supabase.ts` size are not measured.** The audit was blocked partway through. Until measured, treat the assumption "1,845 files → multi-MB initial bundle" as a hypothesis, not a finding. A 10-minute follow-up with `find` / `grep` / `wc` resolves this.
2. **`pg_stat_statements` is dominated by Supabase Studio metadata queries** (top entries are extension / policy / type introspection consuming ~70% of total exec time). Real application query hotspots are not yet visible. Either reset the stats and run a representative load test (k6 already exists), or filter by `userid` to exclude Studio.
3. **The `verify_jwt=false` finding** is sourced from one infra agent reading `supabase/config.toml` and may not reflect deployed state. Verify against the live project before treating as a crisis.
4. **Bloat estimates** on `audit_logs` and `quotation_audit_log` are inferred from size-vs-row mismatch; a `pgstattuple()` call would give the exact dead-tuple percentage.
5. **Multi-region readiness review** is out of scope here; `data_region` plumbing is unused but no per-region SLAs are yet promised.
6. **CRM dedup decision** assumes `module_crm.*` is canonical based on live row counts; confirm with the team before deprecating `public.contacts/accounts`.

### 16.10 New ADRs introduced by this review

Both ADRs are now inline in Appendix A (drafted 2026-05-15):

- **ADR-021 — Connection-pool Discipline.** All database clients route through Supavisor's transaction-pool URL. Per-instance `pg.Pool` max ≤ 15. Direct Postgres connection strings are reserved for migrations and DBAs only.
- **ADR-022 — Async Write Pipeline for High-volume Log Tables.** Tables that exceed 10k inserts/day (`audit_log`, `access_log`, `integration_log`, `llm_usage`, plus any future similar table) write via Redis Stream → batch flusher → Postgres, not synchronously. Monthly partitioning per the `system_logs` pattern. Retention policy required per table.

### 16.11 Production Launch Gate

The items below are **DEFERRED during the personal-use / internal-trial phase** but constitute hard blockers before the platform is exposed to any external user (paying or free, employee or customer). This is a launch checklist, not optional cleanup. Owner signed off 2026-05-15 on deferring; this section locks in what cannot be skipped at go-live.

| Gate item | Verified state on 2026-05-15 | What "passes" looks like at launch |
|---|---|---|
| **G-1. `verify_jwt = false` on edge functions** (§16.4-C2) | 83 of 109 functions have `verify_jwt = false` explicitly; 0 explicitly `true`; 26 inherit default `true`. Owner attack surface today: any holder of the project's anon `apikey` can invoke 83 functions without a user JWT. | Each of the 83 `verify_jwt = false` declarations audited individually. Three valid keep-`false` categories: (a) signature-verified webhooks (Stripe / Razorpay / broker callbacks), (b) scheduled service-role invocations, (c) intentionally public endpoints (health, robots, public-read brochure data). Every other function flipped to `verify_jwt = true`. Annotated rationale recorded inline in `config.toml` as a comment per `[functions.<name>]` stanza. |
| **G-2. Service role key rotation** | Original `.env` was committed; T0 secrets-rotation runbook in §0 of this doc was scoped accordingly. | Service role + anon + JWT secret + DB password rotated; old keys revoked; access logs audited for last 90 days for unfamiliar callers. |
| **G-3. `max_connections` bump + `pg.Pool` cap** (§16.4-C1 / ADR-021) | `max_connections = 60`, `pg.Pool max = 50`. One API instance consumes 80% of the budget. | Supabase plan upgraded to allow ≥500 connections; `_utils/dbPool.ts` capped at 15; all clients route through Supavisor transaction-pool URL. |
| **G-4. Sentry sample rates** (§16.5-H1) | ~~Browser tracing 100%, session replay 10% / 100% on error.~~ **Done 2026-05-15** — `src/lib/sentry.ts` now: prod tracesSampleRate=0.05, prod replaysSessionSampleRate=0.0 (errors only via replaysOnErrorSampleRate=1.0). Dev keeps 100%/10% for visibility. Also added `environment` field and tightened `tracePropagationTargets` (was placeholder `yourserver.io`). | Re-verify at launch the dev/prod env vars resolve correctly; consider dropping prod tracesSampleRate further (0.01) if event volume still high. |
| **G-5. `audit_logs` / `quotation_audit_log` vacuum** (§16.4-C6) | ~~Never vacuumed; 135 MB / 60 MB.~~ **Done 2026-05-15** — `VACUUM (FULL)` ran on both. **Reclaim was modest (~11 MB total: audit 135→132, qa 60→52)** because audit_logs heap is genuinely 126 MB of inline-JSONB (~62 KB/row × 2,023 rows of before/after snapshots) — not dead-tuple bloat. quotation_audit_log dropped from 60 → 52 MB with 0 live rows; residual 50 MB heap is empty pages that VACUUM FULL didn't reclaim, worth a follow-up `TRUNCATE` if confirmed unused. | Real long-term answer is ADR-022 (Redis-stream + partitioning + retention); pure VACUUM cannot solve growth from real JSONB content. Apply ADR-022 pipeline before launch and confirm quotation_audit_log can be `TRUNCATE`d safely (likely yes — it's been 0 rows for the entire audit window). |
| **G-6. In-memory rate limit replaced** (§16.4-C3) | `_utils/http.ts` rate limiter uses per-process `Map`. | Redis-backed; multi-instance safe. |
| **G-7. CI/CD + secret scanner** (§16.4-C4) | No `.github/workflows/`, no Husky, no Gitleaks. | GitHub Actions runs lint + vitest + playwright smoke + Gitleaks on every PR; Husky pre-commit blocks `.env` accidentally being staged. |
| **G-8. Background-job system actually running** (§16.4-C5) | BullMQ + `ioredis` installed but unused. PDF generation is DB-trigger-driven without retry / DLQ. | BullMQ wired; PDF, email, brief generation, report jobs all on queue with retry, DLQ, idempotency. |
| **G-9. Read replica or partition strategy for hot tables** (§16.4-C7 / §16.5-H4-5) | No replication slot; `directives` table 13K rows / 5.5K deletes already. | Read replica enabled and routed for SELECT-heavy paths; partitioning policy (per ADR-022) applied to log tables. |
| **G-10. CDN in front of Hostinger Nginx** (§16.4-C8) | Single-region static SPA from `ap-south-1`. Non-India users pay >300ms TTFB. | Cloudflare (or equivalent) fronts the origin with proper cache headers. |
| **G-11. CSP tightening** (§16.5-M8) | `unsafe-inline` permitted in scripts. | CSP allowlists only the Vite build artifacts and required vendor origins; nonce-based inline if any remain. |
| **G-12. Tenant-domain assignment audit** (this session) | Markets domain status = `planned`, assigned to SOS Services tenant only. | Promote markets `status` to `active` deliberately and per-tenant; review every `tenant_domain_assignments` row for the launch tenants; remove stale test-tenant rows. |
| **G-13. Run Supabase advisor & resolve all `ERROR` findings** (§16.4 / §16.5) | 34 security ERRORs, 0 perf ERRORs in 2026-05-14 audit. Green lane fixed some duplicates + PKs + FKs; the 18 RLS-disabled-in-public tables, 13 SECURITY DEFINER views, 3 policy-exists-RLS-off tables still outstanding. | Zero security ERRORs; all SECURITY DEFINER views converted to `security_invoker=on` (or explicitly retained with documented rationale); all 18 RLS-disabled-public tables either RLS-enabled with policies or moved into a domain schema. |

**Single source of truth.** Whenever the owner asks "what must we fix before launch?", this table is the answer. Items are crossed off only when fully verified, not when scheduled. New blockers discovered later append rows G-14, G-15… here — they do not get scattered into other sections.

---

# Appendix A — ADRs 001–020 (inline)

Each ADR follows the format: **Context → Decision → Consequences**. All have status **Proposed** unless noted otherwise; this design doc serves as the single approval gate.

---

### ADR-001 — Domain Schema Isolation

**Context.** A SaaS platform with multiple business domains in a single Postgres database tends to accumulate cross-domain coupling when all objects live in `public`. The cost of separating later grows superlinearly with the number of objects.

**Decision.** Every new business domain MUST be assigned a dedicated PostgreSQL schema. All domain-specific objects — tables, views, materialized views, functions, procedures, triggers, indexes, sequences, types, enums, and RLS policies — MUST be created inside that schema. The `public` schema is reserved for shared platform infrastructure that existed before this ADR; no new domain-specific objects may be created in `public`.

**Consequences.** PostgREST must explicitly expose each new schema (`db.schemas` in `supabase/config.toml`). Per-schema GRANTs are required. All SQL must be fully schema-qualified; `search_path` is unreliable. Cross-schema FKs are allowed and encouraged for shared infra. Cost: minor — boilerplate per new domain. Benefit: clean domain boundaries; easy future extraction to separate services.

---

### ADR-002 — Persistence is Supabase Postgres + RLS

**Context.** Multiple persistence systems multiply ops cost and create consistency bugs.

**Decision.** All durable state lives in Supabase Postgres. RLS is enabled on every table containing tenant or franchise data. The only exceptions allowed are platform-managed schemas (`auth`, `storage`, `realtime`, `extensions`, `vault`).

**Consequences.** Other stores (Redis, object storage, search indices) are caches or derived data — not source of truth. Compliance and audit are simpler. Cost: have to model everything relationally; not always ideal for blob/document data. Mitigation: use Supabase Storage for objects; use JSONB for genuinely schemaless fields.

---

### ADR-003 — Auth via Supabase Auth

**Context.** Parallel user tables drift; auth is the most security-sensitive surface to get wrong.

**Decision.** All authentication uses Supabase Auth. `auth.users` is the source of truth for identity. Application-level profile data lives in `platform.profiles` with `id` matching `auth.users.id`. Service accounts are also auth.users entries flagged via a metadata column.

**Consequences.** No second auth implementation can ever appear. SSO/SAML/OIDC plugged in via Supabase's SSO support (or a tenant-level IdP table when needed). Trade-off: tied to Supabase; mitigated by Supabase's openness and exportability.

---

### ADR-004 — Multi-Tenancy: `tenant_id` Everywhere, RLS Authoritative

**Context.** SaaS platforms leak cross-tenant data when app-layer checks miss a path.

**Decision.** Every business table has a NOT NULL `tenant_id` column. RLS policies are the authoritative enforcer — application code may *also* check, but the database refuses unauthorized access regardless. Existing `public.*` objects that violate this are grandfathered (this ADR + ADR-001's forward-only policy); their retrofit is a separate tracked epic.

**Consequences.** No database access path bypasses tenancy except explicit service-role calls, which must log to `platform.audit_log` with `acted_by = system`. Performance: an index on `tenant_id` is required on every business table.

---

### ADR-005 — State Changes Write to `platform.audit_log`

**Context.** Forensics, compliance, and replay all require an authoritative record of every mutation.

**Decision.** Every INSERT / UPDATE / DELETE on a business table writes a row to `platform.audit_log` via a trigger or via a write-through wrapper. The row includes `request_id`, `tenant_id`, `franchise_id`, `user_id`, `domain`, `op`, `resource_type`, `resource_id`, `before JSONB`, `after JSONB`.

**Consequences.** Storage cost grows with mutation volume; mitigated by partitioning by month and archiving cold partitions to object storage. Audit rows are themselves immutable — RLS denies UPDATE/DELETE on audit_log for every role except `platform_admin` (and even then, deletes are blocked outright).

---

### ADR-006 — Structured JSON Logging Standard

**Context.** Heterogeneous logs make incident triage slow.

**Decision.** All application logs are emitted as single-line JSON with at minimum: `ts`, `level`, `tenant_id`, `franchise_id`, `user_id`, `request_id`, `domain`, `op`, `latency_ms`, `msg`. Edge Functions and the Python worker share the same schema.

**Consequences.** Log collectors (Datadog / Honeycomb / etc.) ingest uniformly. Querying across services is one query. Trade-off: enforced via a shared logger library; PR review catches direct `console.log` / `print` calls.

---

### ADR-007 — Public APIs Are Versioned

**Context.** Breaking API changes break clients.

**Decision.** All public APIs are prefixed `/api/v1/...`, `/api/v2/...`. Breaking changes require a new major version, served in parallel for a deprecation window (minimum 90 days). Internal-only APIs (browser → BFF) are not subject to this rule but follow the same convention by default.

**Consequences.** Slight URL bloat; clearer contracts. Old versions retire after the deprecation window with a sunset header announcing date.

---

### ADR-008 — Architectural Decisions Live in `docs/architecture/decisions/` or Design-plan Appendices

**Context.** Decisions without written records get forgotten and re-litigated.

**Decision.** Every architectural decision becomes an ADR. ADRs may live as standalone files under `docs/architecture/decisions/NNN-title.md` OR as inline appendices of a design-plan document at `docs/plans/`. Format: Context → Decision → Consequences. Status: Proposed / Accepted / Deprecated / Superseded-by-N.

**Consequences.** When a future change conflicts with an ADR, the conflict is explicit (supersede or amend, not silently violate). Cost: discipline to write them; mitigated by short format and inline-in-plan option.

---

### ADR-009 — Migration Naming Convention

**Context.** Migration archaeology is impossible when filenames are opaque.

**Decision.** Migration files are named `<YYYYMMDDHHMMSS>_<domain>_<change>.sql`. All DDL inside is schema-qualified. Examples: `20260514120000_markets_create_schema.sql`, `20260520093000_platform_add_access_log.sql`.

**Consequences.** Easier `git log -- supabase/migrations/*_markets_*.sql`. Existing UUID-suffixed migrations are not renamed (immutable history); convention applies forward.

---

### ADR-010 — Domain-to-Domain Communication

**Context.** Domains coupled via direct cross-schema writes lose isolation.

**Decision.** Domains read each other's data through explicit views in the consuming domain's schema (with GRANT). Writes between domains happen via published events on a queue or via HTTP API — never via direct INSERT into another domain's tables. The `markets` domain reads `platform.tenants` / `platform.franchises` via direct FK (these are shared infra, not another business domain); reading `crm.accounts` or `logistics.shipments` would require an explicit view.

**Consequences.** Slightly more boilerplate. Strong loose coupling. Future domain extraction to separate services is cheap.

---

### ADR-011 — Three-level Hierarchy with Multi-level Franchise + Role Tiers

**Context.** Flat franchise structures fail for enterprise customers with regional / branch hierarchies. Additionally, "everything is either fully global or fully tenant-scoped" misses the real need for **domain-scoped platform administration** — e.g., a markets-only platform admin who manages all tenants' markets data but cannot see logistics or AMRO data.

**Decision.**
1. Hierarchy is `platform → tenant → franchise → resource`.
2. Franchises can be multi-level via `parent_franchise_id` and a materialized `path LTREE` column.
3. RLS helper `platform.user_can_access_franchise(uid, franchise_id)` uses `<@` against the user's authorized subtree(s).
4. The role enum has **six** values: `platform_admin`, `platform_domain_admin`, `tenant_admin`, `franchise_admin`, `manager`, `operator`.
5. `user_roles.domain` (TEXT, NULLABLE) is required for `platform_domain_admin` and must be NULL for every other role. Validated by trigger `trg_validate_user_roles_scope` and a pre-flight check on migration apply.
6. A franchise cannot be deleted if it is the last franchise of its tenant (trigger `trg_franchises_prevent_last_delete`). Tenant deletion in the same transaction is allowed to cascade.

**Consequences.** Adds two optional columns (`parent_franchise_id`, `path LTREE` on `franchises`; `domain` on `user_roles`) and an LTREE index; minor cost. Supports holding companies, regional structures, and domain-segregated platform admin from day 1. Retrofit later is expensive — must be added now.

---

### ADR-012 — Every Business Table Has `tenant_id` AND `franchise_id`

**Context.** Tables missing `franchise_id` leak across franchises within a tenant.

**Decision.** Every table in a domain schema that holds business data MUST have both `tenant_id` and `franchise_id` columns, both NOT NULL, both FK. Documented exceptions: shared reference data (e.g., `markets.instruments`, `markets.price_history`, `markets.news_events`, `platform.currencies`) which are explicitly cross-tenant public — these MUST be tagged via the `platform.public_reference_tables` registry and reviewed in security audit.

**Consequences.** Schema discipline up-front. Migrations that add `franchise_id` to existing tables (CRM, Quotation, Compliance, Finance) are a T1 deliverable.

---

### ADR-013 — RLS Is The Authoritative Enforcer

**Context.** App-layer checks are necessary but insufficient; one missed code path is a leak.

**Decision.** The Postgres RLS layer refuses cross-tenant/cross-franchise access regardless of application bugs. Application code may *additionally* check; never alone. Every domain table has at least one RLS policy. Test suite verifies "tenant X cannot see tenant Y's rows" for every table.

**Consequences.** RLS policies are non-trivial to write correctly; a shared helper-function library (`platform.user_can_access_franchise`, etc.) reduces duplication and bug surface.

---

### ADR-014 — Access Attempts + Mutations Are Logged

**Context.** Silent RLS denials leave no forensics; mutation logs alone miss exfiltration attempts.

**Decision.** `platform.access_log` records every attempted access with `decision ∈ {allow, deny}`. `platform.audit_log` records every successful mutation (already covered by ADR-005). Edge Function and Python worker middlewares write to access_log on every authenticated request. Storage cost mitigated by partitioning + archive policy.

**Consequences.** Storage is the largest cost; mitigated by sampling allow events at high traffic, always logging denials.

---

### ADR-015 — Integration Registry

**Context.** "Shadow integrations" (undocumented external calls) are an audit and security nightmare.

**Decision.** Every external integration (inbound or outbound) is registered in `platform.integrations` with kind, scope, owner, vendor risk class, and lifecycle state. Undocumented external calls in code are a P0 bug.

**Consequences.** CI lint detects HTTP egress not routed through the integration gateway. New integrations require a registry entry as part of the PR.

---

### ADR-016 — Encrypted Credentials, No Plaintext

**Context.** Plaintext secrets in env vars or files are the most common breach vector.

**Decision.** All credentials (API keys, OAuth tokens, signing secrets, certificates) live in `platform.integration_credentials` encrypted via `pgsodium` or in an external secret manager (Doppler / Infisical / AWS Secrets Manager). Access via SECURITY DEFINER functions only; every access logged.

**Consequences.** Initial setup cost: secret manager integration. Ongoing benefit: rotation is automatable; audit trail is complete.

---

### ADR-017 — Inbound Auth Standards

**Context.** Mixed auth schemes increase attack surface and developer cognitive load.

**Decision.** Inbound auth uses: **OAuth 2.1 + PKCE** for user-delegated access, **signed JWT (client_credentials)** for server-to-server, **HMAC-SHA256** for webhooks (with replay protection via timestamp + nonce). Plain API keys allowed only for legacy vendor mandates and flagged in `platform.integrations.lifecycle_state = 'legacy_auth'`.

**Consequences.** Standardization reduces ad-hoc auth code. Anyone adding a new integration uses the supported flows or files for an exception.

---

### ADR-018 — External Call Logging

**Context.** Without per-call records, debugging integrations is guesswork.

**Decision.** Every external call (inbound or outbound) writes a row to `platform.integration_log` capturing direction, integration_id, tenant_id, franchise_id, user_id (if delegated), request_id, method, url_path, status, latency_ms, bytes in/out, and (per data-classification policy) a redacted body.

**Consequences.** Storage cost — mitigated by partitioning + retention policy per data class. Forensics are dramatically simpler.

---

### ADR-019 — Webhooks Are Signed, Idempotent, Retried, Dead-lettered

**Context.** Webhook delivery is unreliable by nature; without these properties, fills get duplicated or lost.

**Decision.** Inbound webhooks: HMAC-signed, idempotency-key required, async-processed via RQ, dead-lettered after N failures into `platform.integration_dlq` for manual review. Outbound webhooks: same retry/DLQ semantics; per-subscription signing secret with rotation policy.

**Consequences.** Edge case complexity in implementation; library code amortizes the cost. Operationally, the DLQ is a real surface that needs UI + alerting.

---

### ADR-020 — Rate Limit + Circuit Breaker per (Integration × Tenant)

**Context.** A single tenant's runaway requests can starve other tenants or trip vendor rate limits for everyone.

**Decision.** All outbound calls flow through the integration gateway, which enforces per (integration, tenant) rate limits and per-integration circuit breakers (Hystrix-style). Vendor concentration metrics (% of traffic per vendor) are computed from `platform.integration_log` for compliance reporting.

**Consequences.** Gateway becomes a critical service — must be stateless + horizontally scalable; rate limit state in Redis. Cost: one Redis dependency. Benefit: graceful degradation, no cross-tenant blast radius.

---

### ADR-021 — Connection-pool Discipline

**Context.** Postgres connection limits are the primary scale ceiling for this platform. Direct connections multiply linearly with API instances, while Supavisor (Supabase's transaction-pool gateway) terminates and multiplexes connections so a small `max_connections` budget can serve thousands of concurrent clients. As of the 2026-05-15 platform-scale review (§16.4-C1), the active project has `max_connections = 60` and `_utils/dbPool.ts` is configured with `pg.Pool` max = 50 — a single API instance already consumes 80% of the budget, blocking horizontal scaling, Python worker addition, or concurrent migration tooling.

**Decision.** All database clients (Edge Functions, API routes, Python worker, edge workers, ingestion jobs, ad-hoc scripts in CI) MUST connect through Supavisor's transaction-pool URL. Per-instance `pg.Pool` max is capped at **15**. Direct Postgres URLs (`db.<ref>.supabase.co:5432`) are reserved for: schema migrations (`supabase db push`), DBA debug sessions, the `pg_dump` export pipeline, and explicitly-marked exception cases tagged in code. A pre-commit lint rule (T1.5-P1) flags any new direct-URL connection string that lacks an exception tag.

**Consequences.** Per-query overhead increases marginally (one pooler hop, sub-ms in `ap-south-1`). Persistent-connection patterns (`LISTEN/NOTIFY`, prepared-statement caches, advisory locks) require session-pool mode, not transaction-pool — explicitly flagged where used. Connection-limit headroom grows from ~50 effective to thousands. Combined with read-replica routing (T1.5-P9), the database tier no longer caps API tier scaling. `max_connections` can stay conservative (60–100) so each backend gets adequate `work_mem` without OOM risk.

---

### ADR-022 — Async Write Pipeline for High-volume Log Tables

**Context.** Tables that are write-heavy and read-rare — `platform.audit_log`, `platform.access_log`, `platform.integration_log`, `platform.llm_usage`, and any future similar table — become hot spots when written synchronously by triggers or inline app code. They serialize on the audited row, hold transactional locks, and bloat the heap (toasted JSONB columns rarely autovacuumed). As of the 2026-05-15 review (§16.4-C6), `public.audit_logs` has 135 MB / 2,022 rows and has **never been vacuumed** — concrete evidence of the synchronous-trigger anti-pattern at small scale. At 1M users the same pattern produces hundreds of GB of bloat per month.

**Decision.** Any table whose expected steady-state insert rate exceeds **10,000 rows/day** MUST be written via this pipeline:

```
app code  →  Redis Stream  (per-table, e.g. audit_log:stream)
              ↓
          batch flusher worker  (every 1–5s OR every N events)
              ↓
          Postgres bulk INSERT into the partitioned target table
```

The target table is monthly-partitioned (e.g., `audit_log_y2026m05`) following the existing `public.system_logs` pattern. Each table has an explicit retention policy with partition drops on schedule: 7 years for `audit_log` (compliance), 90 days for `access_log` (forensics), 30 days for `integration_log` (debugging), 13 months for `llm_usage` (billing reconciliation + YoY). Synchronous trigger-based writes for these tables are prohibited. Application code uses a typed `logAudit()` / `logAccess()` helper that publishes to Redis and returns immediately.

**Consequences.** Up to ~5 seconds of forensic lag if Redis crashes (accepted tradeoff — log loss is bounded and detectable via Redis-side persistence). The batch flusher worker becomes a hard dependency for durable log persistence and must run HA. Triggers move out of BEFORE/AFTER row hooks into a transactional outbox pattern OR explicit application emission. The existing `public.system_logs` table continues unchanged — it already follows this pattern via the client `Logger`'s 5-second batched flush. Cost: one Redis dependency (already required by ADR-020), one worker process. Benefit: write latency on business operations drops dramatically; partitioned reads scan only the relevant month; bloat is structurally prevented because old data is dropped, never UPDATEd.

---

### ADR-023 — Real-time / WebSocket Architecture (Three-Lane Model)

**Context.** Multiple modules — markets first, with future overflow into CRM notifications, AMRO operational telemetry, and quotation collaboration — need real-time data delivery to the browser. Supabase Edge Functions (§4.3 T1-compute) are stateless request-response and **cannot hold long-lived WebSocket connections**. Real-time workloads are not homogeneous: a portfolio-mutation event (~1-10 msg/user/min, durability matters) has fundamentally different requirements from a market tick (~100-500 msg/sec/user at peak, best-effort acceptable) or an LLM agent token stream (bursty unidirectional, partial output must be resumable). Forcing one transport to serve all three either over-engineers cheap paths or under-serves expensive ones. The original 2026-05-14 design did not commit to a real-time architecture — §16.5 H8 explicitly flagged this as a high-priority open item.

**Decision.** Real-time delivery is decomposed into **three lanes**, each with its own transport, durability contract, and scaling model. Cross-lane sharing of infrastructure (Redis, observability, auth) is preserved; transport choice is per use case.

| Lane | Use case | Transport | Volume profile | Latency budget | Durability |
|---|---|---|---|---|---|
| **L-CDC** | DB-change events: portfolio mutations, watchlist sync, brief-ready ping, audit notifications | **Supabase Realtime** (Phoenix Channels + Postgres logical replication) | Low — ~1-10 msg/user/min | 1-2s p99 | At-least-once; client reconciles state via REST snapshot on connect |
| **L-FAN** | High-rate fan-out: market quote ticks, depth, OI, live signal alerts | **Dedicated WS service** (Node.js `ws` or Python ASGI; horizontally scaled behind L4 NLB) + Redis Streams pub/sub | High — peak ~100-500 msg/sec/user, fan-out from a few hundred publishers to 10k-300k subscribers | <200ms p99 | Best-effort with sequence numbers; client detects gaps and refetches a REST snapshot |
| **L-STR** | Unidirectional streaming: LLM token streaming for research threads and brief generation progress | **Server-Sent Events (SSE)** over HTTP/2, terminated at the Python worker (§4.3 T2-compute) | Medium — bursty ~10-30 tokens/sec while streaming | <100ms first-token p99 | At-least-once with idempotency on `thread_message_id`; partial output resumable |

**Per-lane operational rules:**

1. **L-CDC.** Tables that emit real-time events are explicitly added to the `supabase_realtime` publication (currently 0 — markets.portfolios / markets.watchlists / markets.briefs join the publication in the same migration that introduces a UI subscriber). RLS applies to the publication, so cross-tenant leakage is structurally prevented. Client reconciles full state on (re)connect via a REST snapshot — lost messages are tolerable because the snapshot is authoritative.
2. **L-FAN.** Stateless WS termination behind an L4 NLB. **No sticky sessions** — per-connection subscription state lives in Redis keyed by `connection_id`, so any node in the WS fleet can resume any client's subscriptions after a reconnect. Message envelope: `{ seq, instrument_id, ts, payload }`. Backpressure: per-connection bounded outbound queue with `drop-oldest` policy on overflow. Slow consumers are disconnected after N consecutive overflows; clients reconnect to a less-loaded node behind the NLB. Auth: JWT verified once at connect; cached in Redis for the connection lifetime to avoid per-message Supabase Auth round-trips.
3. **L-STR.** Server-Sent Events pass through every HTTP proxy and CDN cleanly (unlike WebSocket which requires upgrade handling and often dies on corporate or mobile-carrier proxies). The Python worker streams tokens directly from the LLM Gateway (ADR-024) into the SSE response. Each chunk includes `thread_message_id` and a monotonic `chunk_seq`; clients resume from last-seen `chunk_seq` on reconnect.

**Cross-lane infrastructure (shared, not duplicated per lane):**

- **Redis Cluster** (already required by ADR-020 and ADR-022) is the spine: rate-limit counters per (lane, tenant), per-connection subscription state for L-FAN, JWT-verify cache, idempotency keys for L-STR resume.
- **Observability.** Every WS connect / disconnect / message-batch and every SSE stream-start / stream-end writes a sampled row to `platform.access_log` (per ADR-014) with `lane ∈ {L-CDC, L-FAN, L-STR}`. Per-lane SLOs are defined in §16.8 P10.
- **Client library `@platform/realtime`.** A single npm package in `src/lib/realtime/` exposes one factory per lane: `subscribeToTable()`, `subscribeToInstrument()`, `streamAgentResponse()`. Reconnection (exponential backoff with jitter, 1-30s), sequence-resume, REST-snapshot reconciliation, and degradation-to-polling fallbacks all live in the library — **module UI code never speaks the wire protocol directly**. Drift is prevented at the library boundary.

**Explicitly rejected alternatives:**

- **All-on-Supabase-Realtime.** Handles L-CDC well, but at 300k concurrent L-FAN subscribers × 100-500 msg/sec/user it would either cost prohibitively or hit Phoenix Channel ceilings. Realtime is right for change-data-capture; it is not a market-data feed multiplexer.
- **All-WebSocket (custom service for everything).** Would force database change events through bespoke transport when Supabase Realtime gives that for free with RLS already enforced. Wasted infra and a duplicated RLS surface.
- **Polling-only.** The accepted graceful-degradation fallback for any lane outage, not the steady state. Market ticks and LLM streaming need pushed delivery to feel live.

**Consequences.**

- A new long-lived service (the L-FAN WS tier) is added to the deploy footprint. It is the first service whose process holds open connections — but state actually lives in Redis, so the process is functionally stateless and horizontally scalable. Sizing: ~5-10 nodes serve 300k concurrent connections at typical tuning; monitored under the same OTel stack as Edge Functions and the Python worker.
- The Python worker (per §4.3 T2-compute) gains a second responsibility: hosting SSE endpoints for L-STR. Already in scope for LLM agents; no new tier created.
- `supabase_realtime` publication grows incrementally — each table that ships an L-CDC subscriber is added in the same migration. Auditable; one query (`SELECT * FROM pg_publication_tables`) lists every CDC-eligible table at any time.
- The frontend's `@platform/realtime` library becomes a hard dependency for any module that wants real-time. PR review rejects bespoke `new WebSocket()` or `supabase.channel()` calls in module UI code.
- Per-lane failure isolation: L-FAN outage does not affect L-CDC (different transport) or L-STR (different transport). Markets ticks may stop streaming while portfolio updates still arrive — degraded but useful, not broken.
- **Markets v1 (personal-use phase) may launch with only L-STR** wired (for the research thread and brief generation streaming) and **defer L-CDC + L-FAN** until customer-facing UI ships. The architecture supports this incremental adoption; nothing in the schema or RLS needs to change later.

---

### ADR-024 — LLM Provider Selection & Routing Strategy

**Context.** Multiple LLM providers exist with order-of-magnitude differences in cost and capability — approximate per-million-token pricing as of 2026: Claude Opus ~$15/$75, Sonnet ~$3/$15, Haiku ~$1/$5, Gemini Flash ~$0.075/$0.30, GPT-4o-mini ~$0.15/$0.60. Calling provider SDKs directly from each Edge Function or Python worker scatters cost visibility, prevents provider swaps without code changes, makes per-tenant budgeting impossible, and forces a model choice to be revisited via deploy rather than config. At sustained markets workload of ~1 brief/user/day on the default model, costs scale linearly with user count and become a six-figure monthly line item by 100k users without disciplined routing.

**Decision.**

1. **Every LLM call from this platform MUST route through the LLM Gateway (§9.1).** Direct provider-SDK calls outside the Gateway are prohibited. A lint rule + PR review enforce this — adding a new `import { Anthropic } from "@anthropic-ai/sdk"` or `import anthropic` outside the Gateway is a P0 block.
2. **Provider preference order:**
   - **Anthropic Claude** — primary; default for analysis, agents, multi-step reasoning, code/strategy generation
   - **Google Gemini** — secondary; default for high-volume cheap tasks (Flash) and long-context summarization (Pro); fallback when Anthropic returns 5xx / 429
   - **OpenAI GPT** — tertiary; reserved for tasks requiring fine-tuning that Anthropic does not currently support
   - **Local Qwen 3.6 35B (owner-operated, §9.6)** — quaternary; integrated per D-11 trigger conditions
   - **TimesFM** (already self-hosted in `docker-compose`) — purpose-built foundation model for time-series price/volume forecasting; invoked alongside, not instead of, chat models
3. **Default per-task model matrix** (initial, revisable in `markets.prompts` registry without code changes):
   - News classification / sentiment scoring → Gemini Flash
   - Earnings transcript summarization → Haiku 4.5 OR Gemini Flash
   - Daily / weekly portfolio briefs → Sonnet 4.x (prompt-cached)
   - Multi-step research agents → Sonnet (Opus only on explicit "deep dive" mode invoked by the user)
   - Code / strategy generation → Sonnet
   - Translation to/from Hindi or Indic languages → Gemini (or local Qwen once D-11 fires)
   - Time-series price forecasting → TimesFM
4. **Prompt caching is mandatory** for any call whose system prompt or persona section is repeated within a session or across users. The Gateway sets `cache_control: { type: "ephemeral" }` on the static prompt prefix automatically. Anthropic prompt caching cuts input cost ~90% on the cached portion.
5. **Every call MUST write to `platform.llm_usage`** (ADR-005 mutation-logging + §9.5 cost-attribution) with full attribution: `tenant_id, franchise_id, user_id, provider, model, prompt_version, input_tokens, output_tokens, cached_input_tokens, cost_usd, latency_ms, request_id`.
6. **Per-tenant monthly budget cap** is enforced by the Gateway. Soft alert fires at 80% of cap (notification to tenant_admin); hard cap at 100% returns a 429 from the Gateway with a structured `{ error: "tenant_llm_budget_exceeded", reset_at }` body.
7. **Fallback chain on transient failure**: primary 5xx/429 → secondary provider; second 5xx/429 → tertiary; final failure returns a structured error to the caller. Every provider switch writes a row to `platform.llm_usage` so cost-vs-failure tradeoffs are observable.
8. **Fine-tuning is explicitly deferred** (cross-reference §9.6 and D-11). Re-evaluation triggers: (a) labeled training data accumulates from real users to a usable volume, (b) a narrow high-volume task surfaces sustained $$ cost pressure that fine-tuning would meaningfully cut, or (c) a tenant contract mandates data-residency-strict inference that only a self-hosted fine-tuned model can satisfy.
9. **Model and prompt are NOT chosen at the call site.** The Gateway resolves `(task_id, tenant_id)` → `(provider, model, prompt_version)`. Call sites pass only `task_id` plus task-specific variables. This decouples agent code from model evolution.

**Consequences.**

- The LLM Gateway becomes a hard dependency for any AI feature, including markets v1 briefs. It must run in the Python worker with horizontal scaling and proper observability (per ADR-006 / ADR-018). Without the Gateway, no AI feature ships.
- Per-tenant cost predictability becomes a first-class platform feature, unlocking AI-usage-based billing (T3 commercial enablement, §11) without a separate metering pipeline.
- Provider swaps and prompt updates are config changes, not deploys. A/B tests run via the `markets.prompts` registry + Gateway routing without redeploying any Edge Function or worker.
- Slight latency overhead per call (one Gateway hop, single-digit ms in `ap-south-1`); negligible vs LLM round-trip times (hundreds of ms to seconds).
- Cost: no separate infra — the Gateway lives in the Python worker that already exists for §9.1 / T2 deliverables. One Redis (already required by ADR-020) handles budget counters and idempotency.
- Risk: Gateway is a single point of dependency for AI features. Mitigated by horizontal scaling, by the fallback chain (multi-provider) limiting blast radius, and by the fact that markets v1 personal-use phase has zero customer SLA to breach if the Gateway has incidents.

---

### ADR-025 — Frontend State-Management Standard

**Context.** The repository contains ~1,845 `.ts/.tsx` files across multiple domain modules (CRM, AMRO, Logistics, Quotation, Finance, Markets). `package.json` already includes **both** `@tanstack/react-query` and `zustand`, plus the audit found ~165 direct `@/integrations/supabase/client` imports scattered through components (per §16 platform-scale review). No standard for "which library serves which kind of state" has been written down, so every new module makes its own choice, and the same data ends up fetched, cached, and invalidated three different ways depending on which file you opened. Markets v1 is about to add more code; without a declared standard, that drift compounds. The four kinds of state — **server state**, **client/UI state**, **platform context**, and **form state** — have different lifecycles and benefit from different tools. Picking one library for all four is wrong in all four ways.

**Decision.** Frontend state is partitioned into four buckets, each with one canonical library. Existing modules are grandfathered (forward-only policy per ADR-001); new modules and new features in existing modules MUST follow this standard from day one.

| Bucket | What it holds | Canonical tool | Lifetime |
|---|---|---|---|
| **Server state** | Anything that came from Supabase / Edge Functions / external APIs — portfolios, watchlists, briefs, instruments, RLS-gated lists, RPC results | **@tanstack/react-query** | Tied to query key; auto-invalidated on mutation or realtime event |
| **Cross-component client state** | UI state shared across siblings or routes that is *not* server data — selected instrument in a dashboard, draft strategy under construction, multi-step wizard progress, ephemeral filters not yet committed | **Zustand** (one store per feature; never one global mega-store) | Component lifecycle or session, never persisted to Supabase |
| **Platform context** | Stable, app-wide identity & config — current `auth.user`, `TenantContext`, `franchise_id`, `TenantBrandingContext`, locale, theme, resolved feature flags | **React Context** (existing pattern preserved) | App lifetime (per session) |
| **Form state** | All forms — single-field to multi-step | **react-hook-form** | Form mount-to-submit |

**Operational rules:**

1. **Direct `@/integrations/supabase/client` calls in components are PROHIBITED.** All Supabase reads/writes from React land go through a feature hook (e.g., `usePortfolios()`, `useCreatePortfolio()`) that wraps react-query. Lint rule + PR review enforce this. The ~165 existing direct imports are grandfathered but flagged for retirement as features get touched.
2. **Feature hooks live in `src/features/<domain>/hooks/`** — e.g. `src/features/markets/hooks/usePortfolios.ts`. One file per server-state concern. Mutations colocate with their reads (`usePortfolios.ts` exports `usePortfolios()`, `useCreatePortfolio()`, `useUpdatePortfolio()`, `useDeletePortfolio()`).
3. **Query-key conventions** — flat tuple of `[domain, entity, ...filters]`. Examples: `['markets', 'portfolios']`, `['markets', 'portfolio', { id }]`, `['markets', 'instruments', { exchange: 'NSE' }]`, `['crm', 'contacts', { tenantId }]`. A shared helper at `src/features/<domain>/hooks/queryKeys.ts` exports a typed factory so invalidation never relies on string literals.
4. **Default react-query config** (set on `QueryClient` at app root, overridable per query):
   - `staleTime: 30_000` (30s) — avoids refetch-on-remount thrash on the same route
   - `gcTime: 5 * 60_000` (5min) — cache survives navigation
   - `retry: 3` with exponential backoff (1s, 2s, 4s)
   - `refetchOnWindowFocus: true` in production; `false` in dev to reduce noise
   - `refetchOnReconnect: true`
5. **Mutations declare invalidation/optimistic update at the call site** — every `useMutation` either invalidates specific query keys in its `onSuccess` or applies an optimistic `setQueryData`. Stale-data leaks are a P1 bug class.
6. **Real-time integration (ADR-023).** The `@platform/realtime` client library exposes `bindToQueryCache(queryClient)` so that L-CDC events (portfolio update, brief ready, etc.) call `queryClient.setQueryData()` or `queryClient.invalidateQueries()` automatically. Subscriptions live in feature hooks (`usePortfolioRealtime(portfolioId)`); UI components never subscribe directly. L-STR (LLM token streaming) uses a custom `useStreamingMessage()` hook (built on `useReducer`, since react-query's experimental streaming API is not yet GA) — also lives in the feature folder.
7. **Zustand stores are FEATURE-SCOPED, not global.** `src/features/markets/store.ts` exists; `src/store.ts` does NOT. Every Zustand store is < 200 LOC, has a typed selector helper, and exports its slice via a single named hook. No `useShallow()` everywhere — derive selectors at definition time.
8. **No `useEffect` for data fetching.** New code uses react-query. Existing `useEffect` data-fetch patterns are flagged on PR but not retroactively rewritten.
9. **`ScopedDataAccess` continues to wrap Supabase for tenant/franchise scope injection** — feature hooks call `useScopedDataAccess().from(...)` internally, so the existing 165-reference defense-in-depth pattern is preserved. The hook is the one place the client gets touched; react-query owns the cache around it.
10. **Realtime + server state are the same query** — when an L-CDC event arrives saying "portfolio X updated," the feature hook updates `['markets', 'portfolio', { id: X }]` in the query cache; every component reading that key re-renders without an extra fetch. This is the entire architectural win — one source of truth per piece of server data.

**Anti-patterns explicitly banned (PR-rejection material):**

- `setInterval` for polling server data — use `refetchInterval` on the relevant `useQuery`
- `useState` holding data that came from the network — use `useQuery`
- Lifting server-state more than 2 component levels — let react-query cache do the lifting
- One global Zustand store containing everything — fragments by feature
- Reading current tenant/franchise from Zustand or react-query — use the React Context (single source of truth for identity)
- Redux, Recoil, Jotai, MobX in any new code — we already have two state libraries; a third is debt

**Consequences.**

- A single query cache deduplicates every concurrent read of the same data → fewer DB hits, fewer Edge Function invocations, lower cost (especially after T1.5-P9 read-replica routing and §16.5-H1 Sentry sampling are in place).
- Mutations get optimistic-update + auto-rollback semantics for free.
- Realtime (ADR-023) integrates cleanly via the `bindToQueryCache` pattern — no module writes its own subscription-to-state plumbing.
- Test coverage improves: feature hooks are unit-testable in isolation (mock the Supabase client); components depend on hooks, not on Supabase directly.
- Bundle cost: ~12 KB gzipped for react-query (already paid), ~1.5 KB for Zustand (already paid), ~10 KB for react-hook-form (paid if not already). No new dependencies introduced by this ADR.
- Migration cost for existing modules is **zero** unless they're being touched — forward-only. The ~165 direct supabase-js imports are tracked as a §16-style backlog and burn down as features ship.
- Lint rule (`no-direct-supabase-client-import-in-components`) becomes a PR gate; one custom ESLint rule, ~30 LOC. Worth the cost.
- A future ADR may revisit form state (react-hook-form's `Controller` pattern is heavy in some libraries; alternative: `@conform-to/react`). Not changing now — react-hook-form is mature and fits.

---

### ADR-026 — Markets / Platform UI Design System & UX Principles

**Context.** Existing modules (CRM, AMRO, Logistics, Finance, Quotation, Flypal, UIM) each ship UI that works but does not feel like a finished consumer product — page layouts vary, numeric formatting drifts, dark mode is absent, empty/loading/error states are ad-hoc, real-time updates are non-existent, charting is absent, keyboard navigation is partial. The 2026-05-15 platform-scale review (§16.5-H6) flagged this drift indirectly via the CRM duplicate-data-model finding; the same drift exists at the visual layer. Markets v1's smoke-test UI (`src/features/markets/pages/PortfoliosPage.tsx`) is intentionally a database-admin-grade form-and-list — adequate to validate the chain (route → ProtectedRoute → react-query → Edge Function → RLS), wrong to ship to paying users. The platforms markets must compete against — Zerodha Kite, Upstox, TradingView, IBKR, Robinhood, Wealthfront, Public, Linear, Stripe Dashboard — set a quality bar that is achievable with disciplined choices but unreachable by accumulating ad-hoc patterns. The first paying customer is at T3 commercial enablement (§11), 14–18 weeks away. The decision to set the bar must be made before the markets domain accumulates more screens, not after.

**Decision.**

1. **Single composition root and component library.** All new UI lives in `src/design-system/` (existing) plus `src/components/` (existing). Markets-domain pages compose from these — they do not introduce new primitives unilaterally. Library stack:
   - **Tailwind CSS** (existing) — utility primitives
   - **shadcn/ui** (existing — confirmed by current usage of `text-muted-foreground`, `bg-primary`, `border-primary` tokens) — accessible, copy-into-codebase components built on Radix UI primitives
   - **`@tanstack/react-table`** + **`@tanstack/react-virtual`** — sortable / filterable / virtualized data tables (mandatory for any list > 50 rows)
   - **TradingView Lightweight Charts** (Apache 2.0, free) — all candle/line/area charts. No `recharts` for price data; `recharts` may stay for non-financial domain charts (logistics metrics, AMRO compliance dashboards).
   - **`framer-motion`** — layout transitions, value-change flash, slide-in panels. No bespoke CSS animations for state changes.
   - **`cmdk`** — command palette, mandatory across the app (Cmd-K). One implementation, every domain registers actions.
   - **`lucide-react`** — icon set. No mixing icon libraries; no bespoke SVGs unless explicitly justified.
   - **`sonner`** (existing) — all toasts. No `alert()`, no custom toast components.
   - **`@formatjs/intl-numberformat`** — Indian-locale number formatting; falls back to native `Intl.NumberFormat`.
   - **`date-fns`** (existing) — all dates. No `moment`, no `dayjs`.

2. **Mandatory primitives.** Before any markets-domain page can be merged, the following primitives MUST exist in `src/design-system/` (or its equivalent path) and be the only way the corresponding concern is expressed:
   - `<Numeric>` — formats currency / percent / P&L with sign-aware color, optional arrow, locale (`en-IN` default), lakh/crore mode toggle, `font-variant-numeric: tabular-nums`. Inputs: `value`, `format ∈ {currency, percent, pnl, integer, decimal}`, `currency = 'INR'`, `showSign`, `compact`, `accessibleLabel`.
   - `<MoneyDelta>` — value + arrow + color, follows the `<Numeric>` rules.
   - `<Sparkline>` — fixed-size 80×24 inline sparkline (canvas, no SVG fan-out); used in row-level mini-charts.
   - `<DataTable>` — wraps `@tanstack/react-table` + virtualization; supports column sort, filter, density toggle, sticky header, row click, row selection, export-to-CSV. Right-aligned numeric columns by default.
   - `<EmptyState>` — illustration slot (default: Lucide line-art), title, description, primary action button, optional secondary.
   - `<ErrorState>` — typed error card (`{ title, message, code?, retry?, learnMoreUrl? }`). Replaces freeform red text.
   - `<SkeletonRow>` / `<SkeletonCard>` — match final layout dimensions to prevent layout shift; never longer than 1s of show time before swap.
   - `<AppShell>` — top-nav (tenant + franchise + user + search + cmd-K trigger), collapsible sidebar (route categories), main outlet, optional right rail (AI assistant slot).
   - `<FormField>` — composed from `react-hook-form` + `zod`; renders label, control, error, character count, hint, autosave indicator in one consistent shape.
   - `<CommandPalette>` — registers actions from any module; default shortcuts: `Cmd-K` (open), `n` (new), `/` (focus search), `Esc` (close panels).

3. **The "instrument, not admin tool" test.** Every screen passes the following before merge: a user looking at this for 5 seconds can name (a) what they own, (b) what changed today, (c) what to do next. If a screen primarily lists database rows and labels with raw column names, it fails the test. PR review enforces.

4. **Dark mode is first-class, not retrofitted.** Theme is stored in `tenants.settings.theme ∈ {light, dark, auto}` (auto follows `prefers-color-scheme`) and propagated via the existing `TenantBrandingContext`. All design-system tokens have light and dark variants. New components ship with both verified visually (Storybook story per variant). Existing modules are grandfathered; new pages in any domain ship dark mode from day one.

5. **Color semantics with non-color affordance.** Up/positive uses `--up` token; down/negative uses `--down`. Both are paired with directional iconography (up arrow / down arrow) in every numeric-delta surface — colorblindness (≈8% of male users) cannot leave a P&L row ambiguous. Default palette is muted (≈50% saturation), not RGB-100% screaming green/red — improves long-session legibility.

6. **Number and currency formatting is mandatory through `<Numeric>`.** Raw `value.toFixed(2)` or `value.toLocaleString()` in JSX is a PR-rejection pattern. INR uses `en-IN` locale with lakh/crore grouping (₹1,23,456.78 not ₹123,456.78). A global `numberDisplayPreference` (default-precision vs lakh/crore-compact) is stored per user; `[k]` keyboard shortcut toggles it across all `<Numeric>` mounts in the current view.

7. **Real-time updates use ADR-023 patterns, never page reload.** L-CDC events (portfolio mutation, brief ready) feed react-query cache via `@platform/realtime.bindToQueryCache` (ADR-025 §6). L-FAN tick updates render via `framer-motion` value-change flash (600ms fade). L-STR LLM streaming uses SSE chunked rendering (no spinner; tokens appear progressively). Loading spinners are reserved for `<200ms` non-streaming waits where a skeleton makes no sense.

8. **Motion grammar.** All layout transitions are 200ms ease-out. Slide-in panels (create forms, detail views) animate from the right at 250ms. Value-change flash is 600ms ease-in-out. List add/remove uses `<AnimatePresence>` with default 200ms enter/exit. Anything longer than 400ms is a bug.

9. **Forms via `react-hook-form` + `zod`.** Validation schemas are defined once in `zod` and shared between client (form) and edge function (request body validation). Inline field errors only — no validation summary blocks. Submit buttons disable on `isPending`. Cmd-Enter submits any form.

10. **Keyboard model.** Cmd-K opens the global command palette. `n` (with no input focused) opens the primary create flow of the current route. `/` focuses search. `?` opens the shortcuts cheat sheet. `Esc` closes the top-most panel/modal/sheet. `g` then letter performs go-to navigation (`g h` = home, `g p` = portfolios, `g w` = watchlists). Documented in the cheat sheet and in Storybook.

11. **Indian-market UX baselines.** (a) `Intl.NumberFormat('en-IN')` for all rupee values; (b) NSE/BSE displayed side-by-side where both list the same security; (c) market hours awareness — out-of-hours instruments visually dimmed with a tooltip showing next session start; (d) F&O strike chains follow Indian-monthly + weekly expiry conventions when implemented; (e) Hindi locale (`hi-IN`) loaded as a route-level i18n bundle from day 1 even if initial strings are auto-translated — the infrastructure (`i18next`) is the commitment, the quality of translations is iterative.

12. **Accessibility — WCAG 2.2 AA.** Keyboard-only operation works for every primary user flow (verified in CI via `@axe-core/playwright`). Screen readers announce P&L changes via `aria-live="polite"`. Form errors are announced via `aria-describedby`. Color contrast: 4.5:1 for body text, 3:1 for large text and UI components. Focus rings are always visible (no `outline: none` without an explicit replacement). All interactive surfaces have minimum 44×44px touch target on mobile.

13. **Performance budgets.** LCP < 1.5s p75; INP < 200ms p75; CLS < 0.1; first-page bundle ≤ 200 KB gzipped per route. Heavy chart libraries lazy-load on route mount. Data tables > 50 rows are virtualized. Search inputs debounce 200ms. Chart calculations move off the main thread (`Web Worker`) when they exceed 16ms. Bundle budgets enforced by `vite-bundle-visualizer` output in CI; regression > 10% on any route fails the PR.

14. **Storybook is the design-system documentation.** Every primitive ships with a Storybook story covering: light + dark theme, default + loading + empty + error states, mobile + desktop viewport, RTL where applicable. The `storybook-static/` build artifact becomes the team's design reference; no separate Figma-as-source-of-truth (Figma is for early ideation only, not specification).

15. **Forward-only policy** (per ADR-001 / ADR-004 stance). Existing module UIs (CRM, AMRO, Logistics, Finance, Quotation, Flypal, UIM) are grandfathered. New pages — markets first; later additions to any domain — MUST follow this ADR from day one. Legacy pages migrate opportunistically when they are otherwise touched; no big-bang UI rewrite is scheduled.

**Consequences.**

- The markets v1 smoke-test page (`PortfoliosPage.tsx`) is throwaway — its successor screens are built against the primitives in §2 above. No iteration on the current page.
- T2.UX-1 (foundation primitives, 2-3 weeks) becomes a pre-requisite for T2 markets feature work that ships to users. The markets *backend* (data ingestion, LLM briefs, paper portfolio tracking) can proceed in parallel; only the user-facing surfaces gate on the primitive set.
- Storybook gains its first-class role as design-system source-of-truth. Currently it builds (`storybook-static/`) but the audit found unclear usage; this ADR clarifies that role and obligates new components to have stories.
- The "PR-rejection patterns" listed (raw number formatting, bespoke toasts, `alert()`, bespoke WS code, `outline: none`, etc.) become a custom ESLint rule set. Maintenance cost: low; benefit: drift prevention without manual review burden.
- Dark mode work is non-trivial — existing modules use `text-foreground` style tokens correctly (good) but have many hard-coded color literals (to audit). Forward-only stance means we don't fix them all now; we fix as we touch.
- Indian-locale formatting is one library (`@formatjs/intl-numberformat`) plus one wrapper component — cheap. Hindi strings infrastructure is `i18next` setup once; translation work is iterative.
- Accessibility CI gate via `@axe-core/playwright` adds 10-30s per PR; acceptable cost.
- Performance budgets enforced via CI — initial setup of `vite-bundle-visualizer` is one PR; ongoing cost is treating bundle bloat as a real failure mode.
- The institutional polish features (drag-resize multi-pane, per-user dashboards, tenant-branded theming, audit overlay, always-on AI assistant rail) are NOT in this ADR. They appear in §16.11 G-12 / T3 / T4. This ADR sets the floor; those are the ceiling.
- A future ADR may pick up form-state-management alternatives (`@conform-to/react`) if `react-hook-form` patterns prove heavy at scale — flagged in ADR-025 as a known revisit point.

---

# Appendix B — Compliance scorecard summary

See section 12 for the consolidated findings of the two audits. Detailed audit reports are retained in chat transcript and may be transcribed into separate doc files if needed.

---

# Appendix C — Glossary of Indian-market terms

| Term | Meaning |
|---|---|
| **NSE / BSE** | National / Bombay Stock Exchange (equities) |
| **MCX / NCDEX** | Multi Commodity / National Commodity & Derivatives Exchange |
| **CDS** | Currency Derivatives Segment |
| **F&O** | Futures & Options |
| **MF / NAV** | Mutual Fund / Net Asset Value |
| **ISIN** | International Securities Identification Number |
| **SGB** | Sovereign Gold Bond |
| **ETF** | Exchange-Traded Fund |
| **FII / DII** | Foreign / Domestic Institutional Investor (flow data is widely used in Indian retail signals) |
| **SEBI** | Securities and Exchange Board of India (regulator) |
| **RBI** | Reserve Bank of India (central bank) |
| **CDSL / NSDL** | Depositories (custody) |
| **RIA** | Registered Investment Adviser (SEBI license) |
| **RA** | Research Analyst (SEBI license) |
| **PMS** | Portfolio Management Service (SEBI license, ≥₹50 lakh min ticket) |
| **OBPP** | Online Bond Platform Provider (SEBI framework) |
| **VDA** | Virtual Digital Asset (crypto, taxed 30% + 1% TDS) |
| **Account Aggregator (AA)** | RBI consent-driven financial data framework (Sahamati network) |
| **CKYC / eKYC** | Centralized / electronic Know-Your-Customer (Aadhaar-based) |
| **UPI / ASBA** | Unified Payments Interface / Application Supported by Blocked Amount |
| **DPDP** | Digital Personal Data Protection Act 2023 |
| **CERT-In** | Indian Computer Emergency Response Team |
| **LRS** | Liberalised Remittance Scheme (RBI; $250K/year cap for international investments) |

---

## 17. Extended Trading Modules & Broker API Infrastructure (2026-05-16)

### 17.1 Scope addition

This section extends the original §2 scope to include **active trading modules** — not just portfolio tracking and analysis but live order placement, position management, and real-time market data across all Indian exchange segments. It also formalises the broker API infrastructure required to support execution.

**Trigger:** The import-holdings feature (§T2 — already shipped) demonstrated the value of multi-broker integration and surfaced the natural next step: going from read-only portfolio sync to live order execution. The platform already supports 10 broker CSV import formats (Zerodha, Groww, ICICI Direct, HDFC Securities, Angel One, Upstox, Kotak, CAMS MF, CDSL CAS, NSDL CAS). Live API connectivity is the logical progression.

---

### 17.2 Trading segment taxonomy

India's capital markets are divided into exchange segments, each with distinct instruments, regulatory rules, margin requirements, and settlement cycles. The platform must model all of them.

| Segment | Exchange | Instrument types | Product types | Settlement |
|---|---|---|---|---|
| **Equity Cash** | NSE / BSE | Stocks, ETFs, REITs, InvITs, SGBs | CNC (delivery), MIS (intraday), BO/CO | T+1 |
| **Equity F&O** | NSE (NFO) | Index futures, stock futures, index options, stock options | NRML (carry forward), MIS (intraday) | Daily MTM; final T+1 |
| **Currency Derivatives** | NSE (CDS) / BSE | USD-INR, EUR-INR, GBP-INR, JPY-INR; cross-currency pairs | NRML, MIS | T+2 (CDS) |
| **Commodity** | MCX | Gold, Silver, Crude Oil, Natural Gas, Copper, Zinc, Lead; Agri (castor, cotton, etc.) | NRML, MIS | Varies by contract |
| **Agri Commodity** | NCDEX | Guar seed, Chana, Maize, Soybean, Castor seed | NRML, MIS | Varies |
| **Mutual Funds** | BSE StAR MF / AMFI / RTA | Equity MF, Debt MF, Liquid MF, ELSS, Index funds, ETFs | Lumpsum, SIP, STP, SWP | T+1 (liquid), T+2–3 (others) |
| **IPO / New Issues** | NSE / BSE | Mainboard IPO, SME IPO, OFS, FPO | ASBA / UPI block | Allotment + T+6 listing |
| **SGB** | NSE / BSE (secondary) | Sovereign Gold Bond | CNC (secondary market) | T+1 |
| **Bonds / G-Secs** | NSE goBID / RBI Retail Direct | Government bonds, T-bills, SDL, OFCDs | Delivery | T+1 |

#### Order types (cross-segment)

| Order type | Description | Segments |
|---|---|---|
| Market (MKT) | Execute at best available price immediately | All |
| Limit (L) | Execute only at specified price or better | All |
| Stop-Loss Market (SL-M) | Trigger at stop price, fill at market | All |
| Stop-Loss Limit (SL) | Trigger at stop price, fill at limit | All |
| AMO | After-Market Order — queued for next session open | Equity, F&O |
| GTT | Good-Till-Triggered — conditional order stored at broker | Zerodha, Dhan |
| OCO | One-Cancels-the-Other — paired bracket | Dhan, Fyers |
| Iceberg | Large order sliced into smaller visible quantities | Zerodha, Angel |
| Basket | Multi-leg simultaneous order | All |

#### Product type codes

| Code | Meaning | Segments |
|---|---|---|
| CNC | Cash-and-Carry (delivery, no leverage) | Equity |
| MIS | Margin Intraday Square-off (auto-exit before close) | Equity, F&O, Currency, Commodity |
| NRML | Normal (positional, carry-forward F&O, margin required) | F&O, Currency, Commodity |
| BO | Bracket Order (entry + SL + target in one shot) | Equity (deprecated by some brokers) |
| CO | Cover Order (entry + compulsory SL) | Equity |

---

### 17.3 Broker API provider evaluation

#### Tier 1 — Recommended for implementation

| Provider | API name | Execution cost | Live data cost | Python SDK | WebSocket | Historical data | Algo registration |
|---|---|---|---|---|---|---|---|
| **Angel One** | SmartAPI | Free | **Free** | ✅ `smartapi-python` | ✅ | ✅ Free | Not required for personal use |
| **Dhan** | DhanHQ API | Free | Free (≥25 trades/30d) or ₹499/mo | ✅ `dhanhq` | ✅ | ✅ | Not required for personal use |
| **Zerodha** | Kite Connect | Free | **₹2,000/month** | ✅ `kiteconnect` | ✅ | ✅ (paid) | Required for automated execution |
| **Fyers** | Fyers API v3 | Free | **Free** | ✅ `fyers-apiv3` | ✅ (100k req/day) | ✅ | Required for automated execution |
| **ICICI Direct** | Breeze API | Free | **Free** | ✅ `breeze-connect` | ✅ | ✅ | Required for automated execution |

#### Tier 2 — Add later

| Provider | Notes |
|---|---|
| **Upstox** | v3 API; free; good WebSocket; Python SDK `upstox-python` |
| **HDFC Securities** | Relatively newer API; `hsapi`; free |
| **Kotak Neo** | Neo API; free; recently revamped |
| **5paisa** | Open API; free; good for commodity focus |
| **Groww** | No public trading API yet (import only today) |

#### Recommendation

**Start with Angel One SmartAPI** (primary) + **Zerodha Kite Connect** (secondary).

Rationale:
- Angel One is free end-to-end including live data, has the broadest language support, and an active developer community. Best for bootstrapping.
- Zerodha has the most mature ecosystem, widest third-party integrations, best-documented algo trading compliance, and is India's largest broker. Worth the ₹2,000/month at commercial scale.
- The adapter pattern (§17.4) means adding more brokers is plug-in work.

**For market data without a brokerage account:** Dhan's ₹499/month flat-rate data feed is the cheapest standalone historical + live data source if the user doesn't trade on that broker.

#### Auth flows

| Broker | Auth method | Session TTL | Notes |
|---|---|---|---|
| Angel One | TOTP-based login → access token + refresh | 1 day | Needs user's TOTP secret; can be automated |
| Zerodha | OAuth 2.0 with request token → access token | 1 day | Daily re-auth required; no refresh token |
| Fyers | OAuth 2.0 with auth code → access token | 1 day | No refresh token; daily re-auth |
| ICICI Breeze | Session-based (API key + secret + session token) | Configurable | Simpler flow |
| Dhan | API key + Client ID (stateless) | No expiry | Simplest auth model |
| Upstox | OAuth 2.0 | 1 day | Refresh token available |

**Platform implication:** Daily access-token refresh must be automated via a scheduled job. The `platform.integration_credentials` table already supports this via `rotation_policy JSONB` and `expires_at`.

---

### 17.4 Extended data model — new tables

These tables are additions to the existing `markets.*` schema. All have `tenant_id + franchise_id NOT NULL` per ADR-012.

#### `markets.broker_connections`
Stores per-user broker account links. One user can have multiple connections (Zerodha + Angel on same portfolio).

```sql
markets.broker_connections
  id                UUID PK default gen_random_uuid()
  tenant_id         UUID NOT NULL FK platform.tenants
  franchise_id      UUID NOT NULL FK public.franchises
  owner_user_id     UUID NOT NULL FK auth.users
  portfolio_id      UUID NULLABLE FK markets.portfolios   -- if scoped to one portfolio
  broker            TEXT NOT NULL                          -- 'zerodha' | 'angel' | 'fyers' | 'breeze' | 'dhan' | 'upstox'
  broker_client_id  TEXT NOT NULL                          -- broker's account/client ID
  display_name      TEXT                                   -- e.g. "Zerodha – Vimal"
  status            TEXT NOT NULL DEFAULT 'pending'        -- 'pending' | 'active' | 'expired' | 'revoked'
  access_token_enc  TEXT                                   -- encrypted; rotated daily by scheduler
  refresh_token_enc TEXT                                   -- where available
  token_expires_at  TIMESTAMPTZ
  last_synced_at    TIMESTAMPTZ
  scope             TEXT[]                                 -- ['orders', 'holdings', 'positions', 'mf', 'historical']
  metadata          JSONB NOT NULL DEFAULT '{}'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
```

#### `markets.orders`
Full order lifecycle — from placement through fills to final state.

```sql
markets.orders
  id                  UUID PK default gen_random_uuid()
  tenant_id           UUID NOT NULL FK platform.tenants
  franchise_id        UUID NOT NULL FK public.franchises
  owner_user_id       UUID NOT NULL FK auth.users
  portfolio_id        UUID NOT NULL FK markets.portfolios
  broker_connection_id UUID NOT NULL FK markets.broker_connections
  broker_order_id     TEXT                           -- broker's own order ID
  exchange            TEXT NOT NULL                  -- NSE | BSE | MCX | NCDEX | CDS
  segment             TEXT NOT NULL                  -- equity | fno | currency | commodity | mf
  instrument_id       UUID FK markets.instruments    -- NULL for ad-hoc MF orders
  tradingsymbol       TEXT NOT NULL                  -- broker-specific symbol (e.g. RELIANCE, NIFTY25JUNFUT)
  order_type          TEXT NOT NULL                  -- MARKET | LIMIT | SL | SL-M | AMO | GTT
  product             TEXT NOT NULL                  -- CNC | MIS | NRML
  transaction_type    TEXT NOT NULL                  -- BUY | SELL
  quantity            NUMERIC NOT NULL
  price               NUMERIC                        -- NULL for market orders
  trigger_price       NUMERIC                        -- for SL orders
  disclosed_quantity  NUMERIC DEFAULT 0
  validity            TEXT DEFAULT 'DAY'             -- DAY | IOC | TTL | GTC
  status              TEXT NOT NULL DEFAULT 'open'   -- open | pending | complete | cancelled | rejected | modified
  filled_quantity     NUMERIC DEFAULT 0
  avg_fill_price      NUMERIC
  pending_quantity    NUMERIC
  cancelled_quantity  NUMERIC DEFAULT 0
  status_message      TEXT
  tag                 TEXT                           -- algo tag (SEBI algo_id requirement)
  parent_order_id     UUID FK markets.orders         -- for bracket/OCO legs
  placed_at           TIMESTAMPTZ
  updated_at          TIMESTAMPTZ
  exchange_timestamp  TIMESTAMPTZ
  metadata            JSONB NOT NULL DEFAULT '{}'
```

#### `markets.positions`
Open positions — intraday (MIS) and positional (NRML for F&O/currency/commodity).

```sql
markets.positions
  id                  UUID PK default gen_random_uuid()
  tenant_id           UUID NOT NULL FK platform.tenants
  franchise_id        UUID NOT NULL FK public.franchises
  owner_user_id       UUID NOT NULL FK auth.users
  portfolio_id        UUID NOT NULL FK markets.portfolios
  broker_connection_id UUID NOT NULL FK markets.broker_connections
  exchange            TEXT NOT NULL
  segment             TEXT NOT NULL
  tradingsymbol       TEXT NOT NULL
  instrument_id       UUID FK markets.instruments
  product             TEXT NOT NULL                  -- MIS | NRML
  quantity            NUMERIC NOT NULL               -- net qty; negative = short
  overnight_quantity  NUMERIC DEFAULT 0
  buy_quantity        NUMERIC NOT NULL DEFAULT 0
  sell_quantity       NUMERIC NOT NULL DEFAULT 0
  buy_price           NUMERIC
  sell_price          NUMERIC
  avg_price           NUMERIC NOT NULL
  last_price          NUMERIC
  pnl                 NUMERIC                        -- unrealised P&L
  realised_pnl        NUMERIC DEFAULT 0
  m2m                 NUMERIC                        -- mark-to-market P&L (F&O)
  multiplier          NUMERIC DEFAULT 1              -- lot multiplier for F&O
  close_price         NUMERIC                        -- previous close
  value               NUMERIC                        -- abs qty × last_price × multiplier
  day_buy_qty         NUMERIC DEFAULT 0
  day_sell_qty        NUMERIC DEFAULT 0
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT now()
  metadata            JSONB NOT NULL DEFAULT '{}'
```

#### `markets.option_chain_snapshots`
Cached options chain data (polled from broker WebSocket or REST at intervals).

```sql
markets.option_chain_snapshots
  id            UUID PK
  underlying    TEXT NOT NULL           -- NIFTY | BANKNIFTY | FINNIFTY | stock symbol
  expiry        DATE NOT NULL
  ts            TIMESTAMPTZ NOT NULL    -- snapshot time
  chain         JSONB NOT NULL          -- { strikes: [{strike, CE: {oi, volume, ltp, iv, delta, gamma, theta, vega}, PE: {...}}] }
  metadata      JSONB
  UNIQUE (underlying, expiry, date_trunc('minute', ts))
```

#### `markets.mf_orders`
Mutual fund SIP and lumpsum orders via BSE StAR MF or direct RTA.

```sql
markets.mf_orders
  id                  UUID PK
  tenant_id           UUID NOT NULL
  franchise_id        UUID NOT NULL
  owner_user_id       UUID NOT NULL FK auth.users
  portfolio_id        UUID NOT NULL FK markets.portfolios
  broker_connection_id UUID FK markets.broker_connections  -- NULL = direct AMFI/RTA
  folio_number        TEXT
  isin                TEXT NOT NULL                        -- MF scheme ISIN
  scheme_name         TEXT
  order_type          TEXT NOT NULL                        -- PURCHASE | REDEMPTION | SIP | SWP | STP | SWITCH
  amount              NUMERIC                              -- for amount-based orders
  units               NUMERIC                              -- for unit-based redemption
  nav                 NUMERIC                              -- at allotment
  status              TEXT NOT NULL DEFAULT 'pending'      -- pending | submitted | allotted | cancelled | failed
  bse_order_id        TEXT
  rta_reference       TEXT
  sip_id              UUID FK markets.mf_orders            -- parent SIP registration
  sip_frequency       TEXT                                 -- monthly | weekly | daily (for SIP registration)
  sip_amount          NUMERIC
  sip_installments    INT
  sip_start_date      DATE
  sip_end_date        DATE
  allotment_date      DATE
  allotment_units     NUMERIC
  allotment_nav       NUMERIC
  metadata            JSONB NOT NULL DEFAULT '{}'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

### 17.5 Module-by-module feature specification

#### 17.5.1 Equity trading (cash segment)

**Delivery (CNC):**
- Buy and hold stocks, ETFs, REITs, InvITs, SGBs
- Corporate action handling: bonus, split, dividend (already tracked in `transactions`)
- Tax P&L: STCG (<1 year) 15%, LTCG (>1 year) 10% on gains > ₹1 lakh
- FIFO cost tracking (already in `tax_lots` per `transactions`)

**Intraday (MIS):**
- Auto-square-off before 3:20 PM (broker handles)
- Margin utilisation tracking
- Real-time P&L against entry price
- Intraday-only strategies in the backtest engine

**UI modules needed:**
- Order placement form (symbol search → order type → qty/price → confirm)
- Open orders management (modify, cancel)
- Order book (today's orders with status timeline)
- Trade book (today's fills)
- Holdings page (already built — connect to broker sync)
- Intraday positions panel
- P&L dashboard (day P&L + unrealised P&L)

#### 17.5.2 F&O — Futures & Options (NFO segment)

**Futures:**
- Index futures: NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY (monthly + weekly expiry)
- Stock futures: rolling lot sizes per SEBI F&O eligible stocks (~200 stocks)
- Margin: SPAN + Exposure margins calculated via broker API
- Rollover tracker: suggest roll before expiry based on open interest

**Options:**
- Options chain viewer: all strikes for a given underlying + expiry
- Greeks display: Delta, Gamma, Theta, Vega, IV (implied volatility)
- Strategy builder: Bull/Bear spread, Iron Condor, Strangle, Straddle, Calendar spread
- Payoff diagram: visualise P&L at expiry across strike range
- OI (Open Interest) tracker: PCR (Put-Call Ratio), OI buildup, OI unwinding
- IV chart: historical IV vs HV (historical volatility)

**Risk controls:**
- Max open positions per underlying
- Max loss per day (kill switch)
- Delta exposure limits

**SEBI algo trading:**
- Every system-generated order must carry an `algo_id` tag
- Strategy-level algo registration with the exchange (via broker)
- Not required for manual orders placed through the UI

#### 17.5.3 Currency derivatives (CDS segment)

**Instruments:**
- USD-INR, EUR-INR, GBP-INR, JPY-INR (NSE CDS; lot size 1000 units)
- Cross-currency: EUR-USD, GBP-USD, USD-JPY (NSE CDS; lot size 1000 units)
- USDINR options (liquid; weekly and monthly expiry)

**Use cases:**
- Hedging forex exposure in import/export businesses (relevant to the logistics domain!)
- Speculative currency directional plays
- Carry trade monitoring

**Data sources:** NSE CDS direct feed via broker WebSocket

#### 17.5.4 Commodity (MCX / NCDEX)

**MCX instruments (by category):**

| Category | Instruments | Contract size |
|---|---|---|
| Precious metals | Gold (1kg), Gold Mini (100g), Gold Guinea (8g), Silver (30kg), Silver Mini (5kg) | Varies |
| Energy | Crude Oil (100 bbl), Natural Gas (1250 mmBtu) | Varies |
| Base metals | Copper (2.5MT), Zinc (5MT), Lead (5MT), Aluminium (5MT), Nickel (1.5MT) | Varies |
| Agri | Cardamom, Cotton, CPO, Mentha Oil | Varies |

**NCDEX (agri):** Guar seed/gum, Chana, Maize, Mustard seed, Castor seed, Soybean, Turmeric, Jeera

**Key features:**
- Commodity price tracker (live MCX prices)
- Physical delivery flags (most contracts have physical delivery option at expiry)
- Basis tracker: spot vs futures spread
- Seasonal analysis for agri commodities

#### 17.5.5 Mutual Funds

**Order types:**
- Lumpsum purchase
- SIP (Systematic Investment Plan): weekly, monthly, quarterly
- SWP (Systematic Withdrawal Plan)
- STP (Systematic Transfer Plan)
- Switch: between schemes within same AMC
- Redemption: full or partial (in units or amount)

**Data sources:**
- AMFI: daily NAV, scheme master list (already integrated via `markets-ingest-mf-nav`)
- BSE StAR MF: live order placement (requires BSE membership or routing through a broker)
- CAMS / KFintech (Karvy): RTA data for folio consolidation

**Tax implications:**
- Equity MF: STCG 15% (<1yr), LTCG 10% (>1yr on gains > ₹1 lakh)
- Debt MF: Slab rate (short + long term)
- ELSS: 3-year lock-in, Section 80C deduction
- Dividend: added to income

**UI:**
- MF screener (filter by category, AMC, 1y/3y/5y returns, AUM, expense ratio)
- SIP calculator (target corpus → SIP amount → years)
- Portfolio X-ray: underlying stock exposure across all MF holdings
- SIP portfolio tracker: active SIPs, total invested, current value, XIRR

#### 17.5.6 Research & Analysis (cross-segment)

**Already built (T2):**
- Signals (buy/sell/hold with confidence score and rationale)
- Backtesting (rule-based and buy-and-hold strategies)
- AI research threads (Claude over portfolio + news context)
- Daily brief (AI-generated portfolio analysis from news)
- Price history charts (OHLCV)

**To add (T2.5):**
- **Options analytics:** IV percentile, IV rank, skew chart, term structure
- **FII/DII flow tracker:** Daily institutional activity on NSE (free public data)
- **Sector rotation:** Map each holding to GICS sector; display overweight/underweight vs Nifty 500
- **Earnings calendar:** Upcoming results with analyst estimates
- **Corporate actions calendar:** Dividends, bonuses, splits, rights, buybacks
- **Screener integration:** Pull data from Screener.in or Tickertape for fundamental analysis
- **Technical chart view:** Full-screen chart with indicators (already have price data; add candlestick chart + overlay indicators from `backtest_engine.py`)
- **Derivatives scanner:** Filter F&O strikes by OI, IV, PCR

---

### 17.6 Broker adapter protocol (Python)

Extends the `BrokerAdapter` Protocol first sketched in §8.2. Full interface:

```python
from typing import Protocol, AsyncIterator
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

@dataclass
class Quote:
    symbol:       str
    exchange:     str
    ltp:          Decimal          # last traded price
    bid:          Decimal | None
    ask:          Decimal | None
    volume:       int
    oi:           int | None       # open interest (F&O only)
    change:       Decimal          # absolute change from prev close
    change_pct:   Decimal
    ts:           datetime

@dataclass
class OrderRequest:
    tradingsymbol:   str
    exchange:        str
    transaction_type: str           # BUY | SELL
    quantity:        int
    order_type:      str           # MARKET | LIMIT | SL | SL-M
    product:         str           # CNC | MIS | NRML
    price:           Decimal | None
    trigger_price:   Decimal | None
    validity:        str = "DAY"
    tag:             str = ""      # algo_id for SEBI compliance
    disclosed_qty:   int = 0

@dataclass
class OrderResult:
    broker_order_id: str
    status:          str
    message:         str | None

@dataclass
class Position:
    tradingsymbol:   str
    exchange:        str
    product:         str
    quantity:        int
    avg_price:       Decimal
    last_price:      Decimal
    pnl:             Decimal
    m2m:             Decimal

@dataclass
class Holding:
    tradingsymbol:   str
    exchange:        str
    isin:            str
    quantity:        int
    avg_cost:        Decimal
    last_price:      Decimal
    pnl:             Decimal

class BrokerAdapter(Protocol):
    name:    str              # 'zerodha' | 'angel' | 'fyers' | 'breeze' | 'dhan'
    version: str

    # ── Auth ──────────────────────────────────────────────────────────────
    def get_auth_url(self, redirect_uri: str) -> str: ...
    def exchange_code(self, code: str) -> dict: ...          # returns token dict
    def refresh_token(self, refresh_token: str) -> dict: ... # raises if not supported

    # ── Market data ──────────────────────────────────────────────────────
    async def get_quote(self, symbols: list[str]) -> list[Quote]: ...
    async def stream_quotes(self, symbols: list[str]) -> AsyncIterator[Quote]: ...
    async def get_ohlcv(self, symbol: str, exchange: str,
                        interval: str, from_date: date, to_date: date) -> list[dict]: ...
    async def get_option_chain(self, underlying: str, expiry: date) -> dict: ...

    # ── Portfolio ─────────────────────────────────────────────────────────
    async def get_holdings(self) -> list[Holding]: ...
    async def get_positions(self) -> list[Position]: ...
    async def get_orders(self) -> list[dict]: ...
    async def get_trades(self, date: date | None = None) -> list[dict]: ...

    # ── Order management ─────────────────────────────────────────────────
    async def place_order(self, req: OrderRequest) -> OrderResult: ...
    async def modify_order(self, broker_order_id: str, **kwargs) -> OrderResult: ...
    async def cancel_order(self, broker_order_id: str) -> OrderResult: ...

    # ── Mutual funds (optional — not all brokers support) ────────────────
    async def place_mf_order(self, req: dict) -> dict: ...
    async def get_mf_holdings(self) -> list[dict]: ...
    async def get_mf_orders(self) -> list[dict]: ...
```

**SDK dependencies per adapter:**

```toml
# services/markets-worker/pyproject.toml additions
kiteconnect = "^5.0.0"       # Zerodha
smartapi-python = "^1.4.0"   # Angel One
fyers-apiv3 = "^3.0.0"       # Fyers
breeze-connect = "^1.0.0"    # ICICI Direct
dhanhq = "^2.0.0"            # Dhan
upstox-python = "^2.0.0"     # Upstox (Tier 2)
```

---

### 17.7 Real-time data architecture

#### WebSocket fan-out

Broker WebSocket feeds provide tick-by-tick quotes during market hours. The architecture:

```
Broker WS (Kite/SmartAPI/Fyers)
    ↓
Python worker: BrokerWebSocketManager
    ↓ subscribes to symbols from active portfolios + watchlists
    ├── Writes latest tick to Redis hash (key: quote:{exchange}:{symbol})
    ├── Publishes to Redis pub/sub channel (channel: ticks:{symbol})
    ├── Persists OHLCV aggregations to markets.price_history every 1-min
    └── Pushes to Supabase Realtime (for browser subscriptions)

Browser (SPA)
    ↓ subscribes via Supabase Realtime or direct SSE from Python worker
    └── Updates live quote display, positions P&L, order status
```

**ADR-023 (from §16.5-H8)** already defines the three-lane real-time model:
- **L-CDC**: Supabase Realtime for DB change propagation (order status, position updates)
- **L-FAN**: Dedicated WebSocket service for high-frequency tick data
- **L-STR**: SSE for progress bars, brief generation status

For market hours tick data (L-FAN), the Python worker acts as the aggregator, converting broker WebSocket frames to Supabase Realtime events at ≤1-second granularity.

#### Market data hierarchy (precedence)

```
1. Live broker WebSocket (market hours, 9:15–15:30 IST)
2. Broker REST snapshot (every 30s fallback)
3. Upstash Redis cache (sub-second read for quote display)
4. markets.price_history (EOD and 1-min candles persisted)
5. Yahoo Finance (historical OHLCV for non-broker-connected users)
```

---

### 17.8 Regulatory overlay — extended

Additions to §10, scoped to the new trading segments.

| Segment | Regulation | Requirement | Platform hook |
|---|---|---|---|
| **F&O — Algo trading** | SEBI Circular SEBI/HO/MRD2/TE/P/CIR/2021/3 | Every API-generated order must carry a unique algo_id; strategy must be registered with exchange via broker | `orders.tag` field carries algo_id; broker adapter enforces tagging; `markets.strategies` stores registration metadata |
| **F&O — Position limits** | SEBI F&O position limit rules | Client-level gross open position limits per underlying (e.g., 10% of market-wide position limit) | Position-limit check before order placement in broker adapter middleware |
| **Commodity — PMLA** | PMLA 2002 + PMLA Amendment 2023 | KYC + transaction monitoring for commodity trading entities | `platform.consents` + transaction monitoring via `platform.audit_log` |
| **MF — AMFI norms** | SEBI MF Regulations 1996 | ARN (AMFI Registration Number) required for distribution; direct plans don't need ARN | For direct MF orders, no ARN needed. Flag distributor flows explicitly. |
| **Currency — RBI** | RBI Master Direction on Currency Derivatives | Trading must have underlying forex exposure for hedging; speculative limits apply | UI disclosure; position size warnings for large speculative positions |
| **Intraday — Auto square-off** | Broker obligation | MIS positions auto-closed before market close; platform must not interfere with broker's square-off | Never send cancellation for MIS positions after 3:15 PM; mark as pending-sqoff |
| **Tax — STT** | Securities Transaction Tax | 0.025% on intraday equity sell; 0.1% on delivery sell; 0.0625% on F&O sell (futures); 0.125% on options sell (on premium) | `commission_model` in backtests already models STT; same for live P&L calculation |

---

### 17.9 Updated sequencing — new T2.5 phase

Insert between current T2 (Markets domain build) and T3 (Commercial enablement).

#### T2.5 — Active trading & live connectivity (10–12 weeks)

Prerequisite: T2 fully completed (✅ done as of 2026-05-16), T1 infra hardened.

**Phase A — Broker connectivity (weeks 1–3)**
- `markets.broker_connections` table + RLS + migration
- `BrokerAdapter` abstract protocol in Python worker (`services/markets-worker/src/markets_worker/brokers/`)
- Angel One SmartAPI adapter (primary — free live data)
- Zerodha Kite Connect adapter (secondary — institutional grade)
- Daily access-token refresh scheduler job (cron at 8:00 AM IST)
- Frontend: Broker Settings page (connect account → OAuth/TOTP flow → test connection)
- Edge function: `markets-broker-auth` (handle OAuth callback, store encrypted token)

**Phase B — Live portfolio sync (weeks 2–4)**
- `markets.orders`, `markets.positions` tables + RLS
- `broker_sync` RQ job: pull holdings + orders + positions from broker API → upsert DB
- Scheduled sync: every 30 min during market hours (9:00 AM–4:00 PM IST); on-demand via UI
- Frontend: sync status indicator on Portfolio page; last-synced timestamp
- Conflict resolution: broker data is authoritative for live mode; manual transactions kept for paper mode

**Phase C — Order placement (weeks 3–6)**
- Order placement form: symbol search (from `markets.instruments`) → segment/product selection → order type → qty/price → broker confirmation
- Real-time order status via Supabase Realtime (L-CDC)
- Order book + trade book pages
- Risk gate: max order value, margin availability check before send
- `markets.orders` lifecycle: open → pending → complete/cancelled/rejected
- SEBI algo_id tagging for system-generated orders

**Phase D — F&O module (weeks 5–8)**
- Options chain UI: underlying selector → expiry selector → chain table with strikes + Greeks
- `markets.option_chain_snapshots` table (cache; purge >2 days old)
- Options strategy builder: payoff diagram (P&L curve from current price through expiry)
- F&O position tracker: unrealised P&L, delta exposure, theta decay per day
- Greeks calculation: Black-Scholes (use `mibian` or `py_vollib` Python libraries)
- Margin calculator: SPAN + Exposure (via broker `margin_calculator` API)

**Phase E — MF ordering (weeks 6–9)**
- `markets.mf_orders` table
- MF screener UI (filter AMFI scheme master by category, AMC, returns, expense ratio)
- Lumpsum + SIP order placement via BSE StAR MF (Angel One supports this)
- SIP tracker: active SIPs, upcoming instalment dates, total invested vs current value
- XIRR calculator for MF portfolio returns

**Phase F — Currency + Commodity (weeks 8–12)**
- Currency derivatives: CDS segment order placement, USDINR options chain
- MCX commodity: basic order placement for Gold, Silver, Crude Oil, Natural Gas
- FII/DII flow dashboard: daily institutional activity table + chart (NSE public data)
- Sector allocation chart: holding-level sector breakdown vs index weights

---

### 17.10 Open items added by this section

Append to §13 deferred decisions table:

| ID | Item | Defer to |
|---|---|---|
| D-12 | BSE StAR MF membership or routing via broker for live MF order placement | T2.5-E |
| D-13 | SEBI algo registration workflow — which broker to register with first | T2.5-C |
| D-14 | Real-time tick fan-out service (ADR-023 L-FAN lane) — implement as Python asyncio WS server or use Supabase Realtime for ≤1s granularity | T2.5-D |
| D-15 | NCDEX (agri commodity) — low retail demand; add after MCX is proven | T3+ |
| D-16 | Currency derivatives for hedging (logistics business forex exposure) — natural fit given existing logistics domain | T2.5-F |
| D-17 | Bond / G-Sec trading via RBI Retail Direct — growing retail segment; assess demand | T3+ |
| D-18 | IPO / NCD application flow via ASBA/UPI — requires banking integration | T3+ |
| D-19 | Options Greeks server-side computation vs broker-provided values — broker values are faster but not always available; implement `py_vollib` as fallback | T2.5-D |
| D-20 | Multi-broker order routing — place order on cheapest-execution broker automatically | T4 |

---

*Section added 2026-05-16. Authored: Vimal + Claude.*

*End of design document.*
