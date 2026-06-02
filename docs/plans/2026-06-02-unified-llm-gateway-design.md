# Unified LLM Gateway — Design Document

- **Date:** 2026-06-02
- **Status:** Draft (pending implementation)
- **Authors:** brainstorm session (superpowers:brainstorming) + Phase 6 architecture context
- **Audience:** platform engineers, infra/ops, finance, compliance
- **Cross-refs:**
  - `docs/plans/2026-05-28-platform-modules-redesign.md` §6 (LLM infrastructure), §7.4 Phase 9 (rollout)
  - `packages/llm-client/` (existing Phase 0 skeleton — preserved contract)
  - `packages/llm-prompts/`, `packages/llm-improver/` (migrated into gateway)
  - `MEMORY.md` → `feedback_llm_provider_independence.md` (provider-independence requirement)

---

## 0. Executive Summary

One service — `services/llm-gateway/` — fronts every LLM call across every repo, every tenant, every domain, every franchisee. Per-language SDKs (TS, Python, others via OpenAPI codegen) are thin HTTP wrappers around its REST/SSE/webhook surface. The gateway owns:
- Cascading 6-layer provider resolution (feature-pin > user > franchisee > tenant > domain > platform-default) so any tenant on any domain can use any provider (Anthropic, OpenAI, Gemini, Mistral, Ollama, vLLM, Azure OpenAI), BYO-key or platform-paid, with hard egress controls and per-tenant data-residency enforcement.
- Prompt versioning + git-canonical authoring + admin-UI drafting + A/B promotion via outcome telemetry.
- PII redaction pre-egress, budget caps (3-level hierarchy), append-only audit log per tenant.
- Cost attribution dual-mode (platform-paid metered billing vs tenant-paid pass-through) with daily rollups partitioned monthly.
- Embeddings, tool-use, multi-modal, fine-tuning, agentic workflows — first-class.

**North-star metric:** minutes from idea-to-prod-LLM-feature. Target ≤30 min after P5.

**Total cost to "unified platform serving 2+ platforms with 5+ features live":** ~10 engineer-weeks across 11 elapsed calendar weeks (P0-P5).

---

## 1. Architecture, Topology & Operations

### 1.1 Service tier

One new service `services/llm-gateway/` — Node 22 (TS), OpenAPI-3.1-spec-driven. The `openapi.yaml` at the repo root IS the canonical contract; per-language clients are CODEGENED from it, not hand-written, eliminating multi-lang drift forever. Deployed on Coolify across **≥2 VPS instances behind nginx with health-check failover**; single-VPS topology only for dev/staging. Stateless service tier (state lives in DB + Redis), so horizontal scale = `coolify scale`.

### 1.2 Database

Dedicated Supabase project for gateway state. Schema:
- `gateway.tenant_provider_credentials` (vault-encrypted BYO-keys)
- `gateway.provider_configs` (the 6-layer cascade — §3)
- `gateway.prompts` + `gateway.prompt_versions` (— §5)
- `gateway.llm_invocations` (append-only via DELETE/UPDATE-block trigger — same pattern as `core.audit_log`)
- `gateway.llm_usage_daily` (rolled-up usage, partitioned monthly — §6)
- `gateway.budget_caps` (3-level hierarchy — §4)
- `gateway.quota_caps` (request-count quotas — §4)
- `gateway.tenant_pii_policy`
- `gateway.tenant_residency` (per-tenant region pinning)
- `gateway.provider_models` (catalog: cost, capabilities, deprecation)
- `gateway.provider_residency_map` (which provider serves which region)
- `gateway.tenant_billing_settings` (markup, currency, free tier)
- `gateway.provider_billing_periods` (provider-invoice reconciliation)

Per-invocation `retention_class` (compliance_7y for regulated tenants). PITR enabled + nightly cross-region snapshot. Documented RPO ≤ 1h / RTO ≤ 30min.

### 1.3 Multi-region & data residency

Per-region gateway deployments (`gateway-us`, `gateway-eu`, `gateway-in`); tenant pinned to a region at provisioning via `gateway.tenant_residency.region`; cross-region traffic forbidden at the gateway router. EU tenant data never traverses US infra. New region = clone deployment + replicate prompt+config tables (eventually-consistent ≤5min via Supabase replication).

### 1.4 Redis

Response cache keyed by `(tenant_id, prompt_key, prompt_version, variables_hash, resolved_provider_kind, model_id, temperature, max_tokens)`, per-(tenant, feature) rate-limit token buckets, 60s-TTL resolver cache, real-time budget counters.

### 1.5 Per-language clients

- TS: `@platform/llm-client` (the existing Phase 0 stub — gutted, repurposed as HTTP wrapper)
- Python: `platform-llm-client` (httpx wrapper)
- Go/Ruby/Java via OpenAPI codegen as needed

All thin (~150 LOC each) around generated OpenAPI client. Identical contract surface.

### 1.6 Provider adapters

Live in gateway only. Initial set: Anthropic, OpenAI, Google Gemini, Mistral, Ollama (self-hosted HTTP), vLLM (self-hosted HTTP), Azure OpenAI. Plus two non-provider providers:
- `echo` — deterministic mock for local dev (returns canned response based on prompt_key)
- `replay` — serves cached real responses from `services/llm-gateway/fixtures/` for golden-output integration tests

CI lint (extension of Phase 6 Step 32 ban) forbids these SDKs from being imported anywhere except `services/llm-gateway/src/providers/**`.

### 1.7 Three deployment modes (coexist per call)

| Mode | Credentials | Cost | Use case |
|---|---|---|---|
| `platform_paid` | Platform-owned vault key | Gateway absorbs; bills tenant via metered usage | Default for most tenants |
| `tenant_paid` (BYO-key) | Tenant's key in `gateway.tenant_provider_credentials` | Tenant's provider bill captures cost; gateway records for reporting | Cost-sensitive tenants; tenants under their own LLM contracts |
| `self_hosted` | Tenant's HTTP endpoint URL (Ollama/vLLM) | No external cost; tenant owns compute | Data-residency / on-prem requirements |

All three coexist per tenant, even per call (different features can resolve to different modes).

### 1.8 Egress controls

Per-tenant egress policy enforced at provider-call site. EU-residency tenant + provider mapped to US-only → throws `EGRESS_FORBIDDEN`, audit-logged with reason. Hard refusal: even if the tenant explicitly tries to override their region pin, the gateway refuses. Compliance non-negotiable. Mapping in `gateway.provider_residency_map(provider_kind, allowed_regions text[])`.

### 1.9 Existing-asset migration

- `packages/llm-client` → **gut + repurpose** as thin HTTP wrapper; `invoke()`/`recordOutcome()` contract preserved exactly
- `packages/llm-improver` (workbench-agent) → **moved** to `services/llm-gateway/src/prompt-improver/`; exposed via `POST /v1/admin/prompts/:key/iterate`
- `packages/llm-prompts/core/party_dedup_suggestion/` → **migrated** as the seed row in `gateway.prompts`
- `core.llm_usage` in logic-nexus-ai → **deprecated**; tenant-scoped view backed by gateway's `GET /v1/usage` replaces reads; 60-day parity window; eventual drop after 30-day no-direct-read
- `pii.ts` redaction → **moved server-side** to gateway so caller code can't bypass

### 1.10 Bootstrap & onboarding

Target: 10 min for a new platform.
1. Admin creates `service_token` in gateway UI for the new platform (scopes: invoke, record_outcome, read_usage as needed)
2. Platform installs `@platform/llm-client` or `platform-llm-client`
3. Sets `LLM_GATEWAY_URL` + `LLM_SERVICE_TOKEN` + `X_PLATFORM_ID` env vars
4. First call succeeds

Quickstart doc ships with the gateway repo (`README.md` + `docs/quickstart.md`).

---

## 2. API Surface & SDK Contract

### 2.1 Versioning

All routes prefixed `/v1/`. Major version is the only breaking-change boundary; additive changes (new optional request fields, new response fields, new error codes) are minor and don't bump. Gateway publishes a single canonical `openapi.yaml`; per-language clients are codegened — the SDK contract IS the OpenAPI spec.

### 2.2 Authentication

```
Authorization: Bearer <service_token>     # identifies the CALLING SERVICE
X-Platform-Id:  <platform_id>             # one of {logic-nexus-ai, aviation-ai-pro, sthira, …}
X-Tenant-Id:    <tenant_uuid>             # mirror of req body for header-only routes
Idempotency-Key: <ulid>                   # optional; dedupes within 24h
```

Service tokens carry capability scopes: `invoke`, `invoke_stream`, `record_outcome`, `submit_job`, `read_usage`, `admin_prompts`, `admin_configs`, `read_budget`. Issued by gateway admin UI. Stored in caller's vault.

### 2.3 Endpoints

```
POST   /v1/invoke                          # sync inference
POST   /v1/invoke/stream                   # SSE streaming response
POST   /v1/embed                           # embeddings (§9.2)
POST   /v1/estimate                        # cost/token-count estimate before invoking
POST   /v1/outcomes                        # recordOutcome
POST   /v1/jobs                            # submit async job (long-running)
GET    /v1/jobs/:job_id                    # poll async job
POST   /v1/jobs/:job_id/cancel             # cancel running job

POST   /v1/fine-tunes                      # submit fine-tuning job (§9.1)
GET    /v1/fine-tunes/:id                  # poll
POST   /v1/fine-tunes/:id/cancel

GET    /v1/prompts/:key                    # fetch resolved prompt (caller-side preview/dev)
POST   /v1/prompts/:key/render             # render with vars, NO LLM call (dev/test)

GET    /v1/usage                           # per-tenant per-feature rollup
GET    /v1/usage/export                    # CSV/JSON export for finance
GET    /v1/billing/invoice-preview         # projected invoice
GET    /v1/budgets/:tenant_id/:feature     # current cap + remaining
GET    /v1/quotas/:tenant_id/:feature      # current quota + remaining

# Admin only (admin_* scopes):
POST   /v1/admin/prompts                   # create/update prompt
POST   /v1/admin/prompts/:key/iterate      # invoke improver-agent
GET    /v1/admin/provider-configs          # list resolution overrides
POST   /v1/admin/provider-configs          # set/override at any scope
POST   /v1/admin/provider-configs/migrate-model  # bulk migrate deprecated model
POST   /v1/admin/reconciliation/:provider  # mark provider invoice reconciled
POST   /v1/admin/right-to-be-forgotten     # GDPR scrub (§9.5)
```

### 2.4 Error envelope

All non-2xx responses follow:
```json
{
  "error": {
    "code": "BUDGET_EXCEEDED",
    "message": "Tenant ACME exceeded $50/month cap for feature crm:lead_score",
    "details": { "tenant_id": "...", "feature": "...", "limit_usd": 50, "spent_usd": 51.2 },
    "request_id": "01HXY..."
  }
}
```

Codes enumerated in OpenAPI:
`INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `TENANT_NOT_FOUND`, `PROMPT_NOT_FOUND`, `BUDGET_EXCEEDED`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `EGRESS_FORBIDDEN`, `PROVIDER_UNAVAILABLE`, `PROVIDER_TIMEOUT`, `PROVIDER_NOT_CONFIGURED`, `MODEL_DEPRECATED` (warning, not error), `MODEL_CAPABILITY_MISMATCH`, `INVOCATION_NOT_FOUND`, `INTERNAL`. Stable contract; callers can branch on `code`.

### 2.5 Rate-limit + quota headers

On every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-Quota-Period`, `X-Quota-Remaining`. 429 returned with `Retry-After`.

### 2.6 SDK shape (TS reference; Python identical)

```ts
interface LlmClient {
  invoke<T = unknown>(req: InvokeRequest): Promise<InvokeResponse<T>>;
  invokeStream<T = unknown>(req: InvokeRequest, onChunk: (c: StreamChunk) => void): Promise<InvokeResponse<T>>;
  embed(req: EmbedRequest): Promise<EmbedResponse>;
  estimate(req: InvokeRequest): Promise<EstimateResponse>;     // tokens + cost prediction
  recordOutcome(invocation_id: string, outcome: Outcome): Promise<void>;
  submitJob(req: JobRequest): Promise<{ job_id: string }>;
  getJob(job_id: string): Promise<JobStatus>;
  renderPrompt(req: { key: string; variables: Record<string, unknown> }): Promise<{ rendered: string }>;
  // Admin-scoped:
  getUsage(filter: UsageFilter): Promise<UsageReport>;
  getBudget(tenant_id: string, feature: string): Promise<BudgetStatus>;
  getQuota(tenant_id: string, feature: string): Promise<QuotaStatus>;
}
```

`InvokeRequest` / `InvokeResponse` / `Outcome` keep the existing shapes from `packages/llm-client/src/types.ts` (Phase 0 contract). In-flight contract survives the gut-and-repurpose. The client is constructed once per process:

```ts
const llm = new LlmClient({
  gatewayUrl: process.env.LLM_GATEWAY_URL!,
  serviceToken: process.env.LLM_SERVICE_TOKEN!,
  platformId: 'logic-nexus-ai',
  defaults: { timeoutMs: 30_000, retries: 2 },
});
```

### 2.7 Idempotency

`Idempotency-Key` header → gateway looks up a 24h-TTL record of `(idem_key → invocation_id)`. Repeat with same key returns cached `InvokeResponse` (with `replayed: true` warning) — no re-billing, no re-emit to provider. Different request body with same key → 422 conflict.

### 2.8 Streaming chunks

SSE event stream:
```
event: chunk
data: {"type":"token","content":"hello"}

event: chunk
data: {"type":"tool_call","name":"search","args":{...}}

event: chunk
data: {"type":"tool_result","tool_call_id":"...","result":...}

event: finish
data: {"invocation_id":"01HX...","usage":{...},"cost_usd":0.0012,"warnings":[]}
```

Final event always includes `invocation_id` so the caller can `recordOutcome` later.

### 2.9 Webhook contract (async jobs)

Caller registers `webhook_url` + `webhook_secret` per service-token at provisioning. Gateway POSTs on job completion:
```json
{ "job_id": "01HX...", "status": "completed", "invocation_id": "01HX...",
  "result_url": "/v1/jobs/01HX.../result", "completed_at": "2026-..." }
```
Signed with `X-Gateway-Signature: sha256=<hmac>` (HMAC-SHA256 of body using `webhook_secret`). Caller verifies signature before processing.

---

## 3. Provider Resolution & Config Schema

### 3.1 Resolution algorithm (cascading 6-layer)

```
function resolveProvider(req: InvokeRequest, ctx: CallContext): ResolvedProvider {
  const scopes = [
    { kind: 'feature_pin',     scope_id: req.prompt_key            },
    { kind: 'user',            scope_id: ctx.user_id               },
    { kind: 'franchisee',      scope_id: ctx.franchisee_id         },
    { kind: 'tenant',          scope_id: req.tenant_id             },
    { kind: 'domain',          scope_id: ctx.domain_id             },
    { kind: 'platform_default',scope_id: '*'                        },
  ];
  for (const s of scopes) {
    if (!s.scope_id) continue;
    const cfg = await db.one(`SELECT * FROM gateway.provider_configs
                              WHERE scope_kind = $1 AND scope_id = $2`, s.kind, s.scope_id);
    if (cfg) {
      enforceEgress(ctx.tenant_residency, cfg.provider_kind);
      validateCapabilities(cfg.provider_kind, cfg.model_id, req.required_capabilities);
      return loadCredentials(cfg);
    }
  }
  throw new Error('PROVIDER_NOT_CONFIGURED');
}
```

Resolver result cached in Redis for 60s keyed by `(tenant_id, prompt_key, ctx.user_id?)`. Admin config-change endpoints accept `invalidate_cache: true` for instant flip.

### 3.2 What's pinnable per layer

Only `(provider_kind, model_id, credentials_ref, endpoint_url, fallback_*, billing_mode)`. Temperature, max_tokens, system-prompt extensions live in **prompt frontmatter** (per-feature) or **InvokeOptions** (per-call). The cascade governs WHO/WHERE — not HOW. Keeps the override table tight; tenants can't accidentally degrade output quality via temperature creep.

### 3.3 Feature-pin (immutable)

When `is_pin=true` (only valid at `feature_pin` scope), resolution short-circuits cascade AND ignores `InvokeOptions.model_override`. Safety-critical features:
```sql
INSERT INTO gateway.provider_configs (scope_kind, scope_id, provider_kind, model_id, is_pin)
VALUES ('feature_pin', 'compliance.screening.hit_reasoning',
        'anthropic', 'claude-opus-4-7', true);
```
No tenant can route this to a cheap model. Audit-logged when attempted.

### 3.4 Schema

```sql
CREATE TABLE gateway.provider_configs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_kind         text NOT NULL CHECK (scope_kind IN
                       ('feature_pin','user','franchisee','tenant','domain','platform_default')),
  scope_id           text NOT NULL,
  provider_kind      text NOT NULL CHECK (provider_kind IN
                       ('anthropic','openai','google_gemini','mistral','ollama',
                        'vllm','azure_openai','echo','replay')),
  model_id           text NOT NULL,
  credentials_ref    uuid REFERENCES gateway.tenant_provider_credentials(id),
  endpoint_url       text,
  is_pin             boolean NOT NULL DEFAULT false,
  fallback_model_id  text,
  fallback_provider_kind text,
  billing_mode       text NOT NULL DEFAULT 'platform_paid'
                       CHECK (billing_mode IN ('platform_paid','tenant_paid')),
  required_capabilities text[],  -- e.g. {'tools','vision','json_mode'}; validated at config-write time
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  UNIQUE (scope_kind, scope_id),
  CONSTRAINT pin_only_on_feature_pin CHECK (is_pin = false OR scope_kind = 'feature_pin')
);
```

### 3.5 Credentials

```sql
CREATE TABLE gateway.tenant_provider_credentials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid,                                  -- NULL = platform-owned
  provider_kind   text NOT NULL,
  credential_kind text NOT NULL CHECK (credential_kind IN
                    ('api_key','bearer_token','azure_deployment','aws_iam','custom_header')),
  vault_secret_id text NOT NULL,
  last_rotated_at timestamptz,
  expires_at      timestamptz,
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','rotating','revoked')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  notes           text
);
```

Vault decryption once per request; never logged, never in API responses. Rotation: admin sets new vault_secret_id + status='rotating'; old credential serves traffic for 24h grace; auto-revoke at T+24h.

### 3.6 Provider catalog

```sql
CREATE TABLE gateway.provider_models (
  provider_kind                  text NOT NULL,
  model_id                       text NOT NULL,
  context_window                 integer,
  input_cost_per_million_tokens  numeric(10,4),
  output_cost_per_million_tokens numeric(10,4),
  capabilities                   text[] DEFAULT '{}',
                                 -- {'vision','tools','streaming','json_mode','fine_tuning','embeddings'}
  default_region                 text,
  deprecated_at                  timestamptz,
  replacement_model_id           text,
  PRIMARY KEY (provider_kind, model_id)
);
```

Powers cost computation, capability validation, deprecation warnings, bulk-migration tool.

### 3.7 Egress enforcement

`enforceEgress(tenant_residency, provider_kind)` consults `gateway.provider_residency_map(provider_kind, allowed_regions text[])`. EU-residency tenant + provider mapped to US-only → throws `EGRESS_FORBIDDEN`. Refusal is HARD.

### 3.8 Capability validation

`validateCapabilities(provider, model, required)` checks `gateway.provider_models.capabilities @> required`. Config-time: when a `provider_config` row is inserted with `required_capabilities`, validate against the chosen model — fail with `MODEL_CAPABILITY_MISMATCH` if the model doesn't support them. Runtime: same check on each invoke against `req.required_capabilities`. Prevents surprise breakage when a tenant picks a non-vision model for a vision feature.

### 3.9 Fallback chain

If resolved provider 5xx's (after 2 retries with exponential backoff), gateway tries `fallback_provider_kind` + `fallback_model_id` if set. Fallback uses SAME credentials path (so a tenant with BYO-Anthropic + fallback-OpenAI must also have an OpenAI credential). Success → response `warnings: ['fallback_used']`. Both fail → `PROVIDER_UNAVAILABLE`.

### 3.10 Per-call overrides

`InvokeOptions`:
- `model_override` — pin a different model (subject to `is_pin` block)
- `provider_override` — pin a different provider (admin tooling)
- `cache_ttl_seconds` — override cache TTL
- `timeout_ms` — override request timeout
- `required_capabilities` — per-call capability requirements

Every invocation records `resolved_scope_kind`, `resolved_scope_id`, `provider_kind`, `model_id`, `billing_mode`, `fallback_used` so admins can answer "which override served this call?" at any time.

---

## 4. Tenant Isolation: Cache, Budget, Quota, PII, Audit

### 4.1 Cache keys are tenant-prefixed (mandatory)

Every cache lookup hashes `(tenant_id, prompt_key, prompt_version, variables_canonicalized, resolved_provider_kind, model_id, temperature, max_tokens)` into SHA-256. Leading `tenant_id` is non-optional. Two tenants asking identical "summarize this contract" with byte-identical input MUST NOT share a cached completion — it's their customer data; cross-pollination is a leak even if the response text would have been identical.

Cache TTL from prompt frontmatter (`cache_ttl_seconds: 3600` default; `0` disables). Per-call override via `InvokeOptions.cache_ttl_seconds`. Redis keyspace partitioned `cache:{tenant_id}:{hash}`. Per-tenant cache size cap (default 100 MB; admin-configurable) prevents a chatty tenant from monopolizing memory.

### 4.2 Budget buckets (hierarchical $)

Three layers, evaluated bottom-up at request time:
```
platform.monthly_limit_usd       ($10,000 example)
  ↳ tenant.{ACME}.monthly_limit_usd      ($500)
      ↳ tenant.{ACME}.feature.{crm.lead_score}.daily_limit_usd  ($20)
```
Reject at first cap hit with `BUDGET_EXCEEDED` + which-cap in `details`. Soft warning at 80% via `core.notifications` (severity=`warning`, intent_kind=`gateway.budget.warning`); at 100% another notification + the rejection.

```sql
CREATE TABLE gateway.budget_caps (
  id              uuid PK,
  scope_kind      text CHECK IN ('platform','tenant','tenant_feature','franchisee'),
  scope_id        text NOT NULL,
  period_kind     text CHECK IN ('daily','weekly','monthly'),
  limit_usd       numeric NOT NULL,
  warning_pct     integer DEFAULT 80,
  hard_cap        boolean DEFAULT true,
  tenant_paid_uncapped boolean DEFAULT false,
  current_period_started_at timestamptz NOT NULL,
  UNIQUE (scope_kind, scope_id, period_kind)
);
```

Spend tracked via Redis INCRBYFLOAT per `(scope, period_window)` for sub-ms cap checks; async persist to `gateway.llm_usage_daily`. Counters auto-reset via pg_cron at period boundary. `billing_mode='tenant_paid'` invocations count against tenant cap if set, unless `tenant_paid_uncapped=true`.

### 4.3 Quota caps (hierarchical request-count)

Distinct from $ budgets — useful for free-tier tenants where you cap invocations/month rather than dollars.

```sql
CREATE TABLE gateway.quota_caps (
  id              uuid PK,
  scope_kind      text CHECK IN ('platform','tenant','tenant_feature','franchisee'),
  scope_id        text NOT NULL,
  period_kind     text CHECK IN ('daily','weekly','monthly'),
  limit_invocations integer,
  limit_tokens    bigint,
  hard_cap        boolean DEFAULT true,
  current_period_started_at timestamptz NOT NULL,
  UNIQUE (scope_kind, scope_id, period_kind)
);
```

Reject with `QUOTA_EXCEEDED`. Free-tier example: `tenant.{X}.monthly` with `limit_invocations=1000, limit_tokens=500000`. Same Redis counter pattern.

### 4.4 PII redaction (pre-egress)

Pipeline:
```
caller → invoke({variables}) → gateway resolves provider + reads tenant_pii_policy →
  redactor swaps PII → variables_redacted → upstream provider → response →
  optional un-redact (token-mapped) → caller
```

```sql
CREATE TABLE gateway.tenant_pii_policy (
  tenant_id        uuid PK,
  policy_kind      text CHECK IN ('strict','moderate','pass_through','custom'),
  redact_kinds     text[] DEFAULT '{email,phone,ssn,credit_card,api_key,address}',
  custom_patterns  jsonb DEFAULT '[]'::jsonb,
  preserve_mapping boolean DEFAULT true,
  reject_on_unredactable boolean DEFAULT false,
  pii_pass_through_consented_at timestamptz
);
```

`strict` = redact everything, no exceptions. `moderate` = redact + warn caller. `pass_through` = no redaction; requires `pii_pass_through_consented_at` set + audit-log entry per request. `custom` = caller-defined patterns. Token mapping (e.g. `Alice → <PII:NAME_1>` → response → swap back) stored encrypted in invocation row, dropped after `response_retention_days` (default 7).

Detection engine pluggable: default Presidio-equivalent regex+NER. Per-tenant `custom_patterns` for industry-specific PII (aviation tail numbers as quasi-PII in AMRO tenants).

### 4.5 Audit row visibility

`gateway.llm_invocations` is append-only — DELETE and UPDATE blocked via trigger (mirroring `core.audit_log` pattern from Phase 6).

Schema includes: `tenant_id`, `resolved_provider_kind`, `resolved_scope_kind`, `model_id`, `billing_mode`, `prompt_version_id`, `variables_redacted_hash`, `response_hash`, `parent_invocation_id` (§9.4), `usage`, `cost_usd`, `latency_ms`, `warnings[]`, `created_at`, `retention_class`. Body retention via `gateway.tenant_settings.response_retention_days` (default 7); after that, body NULL'd, metadata retained per `retention_class` (default `general_2y`; compliance-regulated tenants `compliance_7y`).

RLS on `gateway.llm_invocations`: tenant admins SELECT only own tenant_id; platform admins via service-role bypass. Direct `psql` always shows tenant_id; no anonymous cross-tenant aggregates.

### 4.6 Resource fairness

Per-tenant rate limits via Redis token bucket (`(tenant_id) → tokens/sec`). Default: 100 req/min per tenant; per-tenant override. Per-tenant provider-connection-pool cap (max 20 concurrent calls to any one provider on behalf of one tenant) prevents starving the connection pool.

### 4.7 Logging hygiene

Gateway structured logs always carry `tenant_id`, `request_id`, `invocation_id`, `feature`, `model_id`, `cost_usd`, `latency_ms`. NEVER log: credentials, raw (un-redacted) variables, response bodies, vault secret values. Log levels: INFO normal; WARN for budget/PII/deprecation; ERROR for provider failures. Egress refusals logged WARN with `EGRESS_FORBIDDEN` reason.

---

## 5. Prompt Management

### 5.1 Canonical location: gateway DB

`gateway.prompts` + `gateway.prompt_versions`. Hot path reads with 5-min in-process cache. Existing `packages/llm-prompts/core/party_dedup_suggestion/` migrates as first seed row.

### 5.2 Authoring: hybrid git + admin UI

- **Git-authored (canonical):** files under `packages/llm-prompts/<module>/<feature>/<key>.md` with YAML frontmatter. PR review enforced. CI step parses + validates + ships to `gateway.prompts` via `POST /v1/admin/prompts` on merge to main.
- **Admin-UI-authored (experimental):** ops/PMs create new versions via admin UI; land as `status='draft'`; never served to prod traffic until promoted. Promotion requires either (a) PR codifying in git, OR (b) admin user with `prompt_promoter` scope.

Both paths write to same tables; `source='git'` + `git_sha` vs `source='admin_ui'` + `created_by_user_id`. Same lifecycle.

### 5.3 Schema

```sql
CREATE TABLE gateway.prompts (
  key             text PRIMARY KEY,
  module          text NOT NULL,
  feature         text NOT NULL,
  description     text,
  active_version_id uuid REFERENCES gateway.prompt_versions(id),
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','deprecated','archived')),
  created_at, updated_at
);

CREATE TABLE gateway.prompt_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key      text NOT NULL REFERENCES gateway.prompts(key),
  version_number  integer NOT NULL,
  body            text NOT NULL,
  body_variants   jsonb NOT NULL DEFAULT '{}'::jsonb,
  frontmatter     jsonb NOT NULL,
  input_schema    jsonb,
  output_schema   jsonb,
  default_capability text,
  default_temperature numeric(3,2),
  default_max_tokens integer,
  cache_ttl_seconds  integer,
  safety_class    text DEFAULT 'standard'
                    CHECK (safety_class IN ('standard','elevated','restricted')),
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','active','superseded','rolled_back')),
  source          text NOT NULL CHECK (source IN ('git','admin_ui')),
  git_sha         text,
  created_by_user_id uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  promoted_at     timestamptz,
  promoted_by_user_id uuid,
  UNIQUE (prompt_key, version_number)
);
```

### 5.4 Frontmatter format

```yaml
---
key: compliance.screening.hit_reasoning
module: compliance
feature: screening.hit_reasoning
description: Explain why a denied-party screening hit matched
inputs:
  party:        { type: object, required: [name, country] }
  hits:         { type: array, items: { type: object } }
output_schema:
  type: object
  required: [verdict, confidence, reasoning]
  properties:
    verdict:    { enum: [true_positive, false_positive, uncertain] }
    confidence: { type: number, minimum: 0, maximum: 1 }
    reasoning:  { type: string, maxLength: 2000 }
default_capability: reasoning-high
default_temperature: 0.0
default_max_tokens: 800
cache_ttl_seconds: 0
safety_class: restricted
tags: [compliance, screening, advisory]
---
You are a sanctions-compliance officer. The screening system flagged
the following hits against party "{{party.name}}" ({{party.country}}).
Determine if each hit is a true match or false positive. Respond in
the structured-output format.

Party:
{{party | json}}

Hits ({{hits | length}}):
{{hits | json}}
```

### 5.5 Model-agnostic strategy

One canonical body + per-provider overrides only where needed. Default: `body` field used for all providers; gateway adapter wraps in provider-specific scaffolding (system/user role split for OpenAI, message-array for Anthropic, etc.). Output schema validated post-call via provider's structured-output mode (Anthropic tool-use, OpenAI function-calling, Mistral JSON-mode, Ollama JSON-mode).

When a specific provider underperforms, prompt author adds `body_variants.{provider}` with hand-tuned version. Per-call: `body_variants[resolved_provider_kind] ?? body`. Most prompts will have `body_variants = {}` forever. Audit-tracked which variant served each invocation.

### 5.6 Improver loop

`packages/llm-improver/workbench-agent` migrates to `services/llm-gateway/src/prompt-improver/`. Surface: `POST /v1/admin/prompts/:key/iterate` with `{ failures: [{invocation_id, expected_output, actual_output}] }`. Improver agent invokes high-capability model to propose revised prompt. Output is a new `prompt_versions` row with `status='draft'`.

A/B promotion: admin sets `gateway.prompt_experiments (prompt_key, variant_a_id, variant_b_id, traffic_split numeric, started_at, target_invocations, target_signal)`. Resolver picks A or B per call. Outcomes accumulate. Statistical-significance check (chi-sq on accept-rate; default p<0.05) → auto-promote winner. Rollback: admin sets `prompts.active_version_id` back to prior; takes effect on next cache miss (≤5min).

### 5.7 Validation pipeline

- **On create/update:** parse YAML frontmatter against meta-schema; render `body` with sample variables from `frontmatter.examples`; assert rendered length under `min(provider.context_window)` across configured providers.
- **On admin promote:** if no `recordOutcome` data for N=20 invocations on draft, require explicit `force_promote=true`.
- **On first prod use:** structured warning in `InvokeResponse.warnings` if version has zero outcome telemetry (`new_prompt_version_no_telemetry`).

### 5.8 `renderPrompt` endpoint

`POST /v1/prompts/:key/render` returns rendered prompt WITHOUT calling LLM. Dev tool — verify template substitution + length before going live. Powers a CI step that renders every prompt + every example to catch template breakages on PR.

---

## 6. Cost Attribution & Billing Rollup

### 6.1 Per-invocation cost

Every `gateway.llm_invocations` row records:
```sql
prompt_tokens         integer
completion_tokens     integer
total_tokens          integer
provider_cost_usd     numeric(10,6)   -- raw cost paid to provider
billed_cost_usd       numeric(10,6)   -- post-markup; what tenant is charged (platform_paid only)
billing_mode          text            -- 'platform_paid' | 'tenant_paid'
billing_period        date            -- first-of-month bucket
```

Computed at response-write using `gateway.provider_models.{input,output}_cost_per_million_tokens`. Tenant-paid invocations record `provider_cost_usd` for reporting but `billed_cost_usd = 0`.

### 6.2 Rollup hierarchy

```
platform (all repos)
  ├── repo / platform_id
  │   ├── domain
  │   │   ├── tenant
  │   │   │   ├── franchisee
  │   │   │   │   └── user (rare; admin tooling)
  │   │   │   └── feature (cross-cuts tenant)
```

Pre-aggregated daily:
```sql
CREATE TABLE gateway.llm_usage_daily (
  date_utc           date NOT NULL,
  platform_id        text NOT NULL,
  domain_id          uuid,
  tenant_id          uuid,
  franchisee_id      uuid,
  feature            text NOT NULL,
  provider_kind      text NOT NULL,
  model_id           text NOT NULL,
  billing_mode       text NOT NULL,
  invocations        integer NOT NULL DEFAULT 0,
  cache_hits         integer NOT NULL DEFAULT 0,
  prompt_tokens      bigint  NOT NULL DEFAULT 0,
  completion_tokens  bigint  NOT NULL DEFAULT 0,
  provider_cost_usd  numeric(14,6) NOT NULL DEFAULT 0,
  billed_cost_usd    numeric(14,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (date_utc, platform_id, COALESCE(domain_id, '0'::uuid),
               COALESCE(tenant_id, '0'::uuid),
               COALESCE(franchisee_id, '0'::uuid),
               feature, provider_kind, model_id, billing_mode)
) PARTITION BY RANGE (date_utc);
```

Partitioned monthly (auto-provisioner pattern from Phase 6 Step 41). Daily roll-forward job: pg_cron 00:05 UTC; idempotent UPSERT. Hot dashboards query `llm_usage_daily`, never per-invocation.

### 6.3 Cross-platform analytics

```sql
-- "ACME tenant spend, last 30 days, across all platforms, by feature"
SELECT platform_id, feature,
       sum(billed_cost_usd) AS billed,
       sum(provider_cost_usd) AS raw_cost,
       sum(invocations) AS calls
FROM gateway.llm_usage_daily
WHERE tenant_id = 'acme-uuid'
  AND date_utc >= current_date - 30
GROUP BY platform_id, feature
ORDER BY billed DESC;
```

### 6.4 Markup model

```sql
CREATE TABLE gateway.tenant_billing_settings (
  tenant_id            uuid PRIMARY KEY,
  billing_currency     text NOT NULL DEFAULT 'USD',
  markup_pct           numeric(5,2) NOT NULL DEFAULT 0,
  flat_fee_per_call_usd numeric(10,6) DEFAULT 0,
  free_tier_invocations_per_month integer DEFAULT 0,
  invoice_prefix       text,
  finance_integration  text                        -- 'razorpay' | 'stripe' | 'manual'
);
```

Markup applied at row-write — `billed_cost_usd` is source of truth. Markup changes only affect future invocations; historic rows preserve markup-at-the-time (auditable).

### 6.5 Franchisee chargeback

```
GET /v1/billing/franchisee-rollup?tenant_id=...&period=2026-06
→ [
  { franchisee_id: 'delhi', invocations: 1240, billed_cost_usd: 12.40 },
  { franchisee_id: 'mumbai', invocations: 880, billed_cost_usd: 8.80 },
  { franchisee_id: null, invocations: 50, billed_cost_usd: 0.50, note: 'tenant-level' }
]
```

Tenant decides whether to pass costs through to franchisees.

### 6.6 Export & finance integration

```
GET /v1/usage?tenant_id=&from=&to=&group_by=feature|model|day|domain
GET /v1/usage/export?tenant_id=&from=&to=&format=csv|json|invoice_xml
GET /v1/billing/invoice-preview?tenant_id=&period=2026-06
POST /v1/billing/invoices                          # admin: cut invoice manually
POST /v1/billing/invoices/:id/mark-paid            # admin: record payment
```

### 6.7 Provider-invoice reconciliation

Monthly: admin uploads provider invoice via `POST /v1/admin/reconciliation/:provider`. Gateway compares against `sum(provider_cost_usd) WHERE billing_mode='platform_paid' AND provider_kind=$1` for the month. Variance >5% → admin notification. Status in `gateway.provider_billing_periods`.

### 6.8 Real-time budget vs billing

Budget caps operate on `billed_cost_usd` in Redis (sub-ms). Billing rollups use `gateway.llm_usage_daily` (durable). After Redis flush, budget counters reseed from `llm_usage_daily` + same-day partial from `llm_invocations`.

### 6.9 Cost estimation

`POST /v1/estimate` returns `{ prompt_tokens_est, completion_tokens_max, cost_usd_est, cost_usd_max }` for a given InvokeRequest WITHOUT calling the LLM. Powers UX patterns like "this query will cost ~$0.02; continue?" Uses gateway's tokenizer + model catalog rates.

---

## 7. Migration & Adoption Roadmap

### 7.1 Phased plan (~11 weeks elapsed; ~10 engineer-weeks effort)

| Phase | Window | Deliverables | Gate |
|---|---|---|---|
| **P0 Scaffold** | wk 1-2 | gateway service skeleton, schema migrations, deploy infra (Coolify multi-instance, Redis), `/v1/invoke` returning `echo` only | echo p99 ≤50ms at 100 req/s |
| **P1 Providers** | wk 3-4 | Anthropic + OpenAI + Gemini adapters, `replay` provider, resolver+cache, vault integration, Ollama/vLLM scaffolds | Real provider calls ±0.1% cost accuracy |
| **P2 Governance** | wk 5-6 | service-token auth + scopes, rate-limit, budget+quota caps, PII redactor, egress controls, append-only audit | PII ≥99.5%; budget rejects under burst; EGRESS_FORBIDDEN fires |
| **P3 Prompts** | wk 7 | git→gateway sync, admin UI MVP, A/B logic, improver migration | A/B promotes winner end-to-end |
| **P4 Clients** | wk 8 | TS gut+repurpose, Python new, OpenAPI codegen baseline | Identical-contract tests green; <200ms cold start |
| **P5 LNX Migration** | wk 9-10 | first prod feature (`compliance.screening.hit_reasoning`), `core.llm_usage` deprecation, party_dedup seeded | Feature live 7 days no regression; reconciliation ±5% |
| **P6 2nd platform** | wk 11+ | Aviation-AI-Pro onboards; Sthira mobile WebView wrapper | 2nd platform's first feature in prod ≤1 working day |
| **P7 Feature rollout** | ongoing | 25-30 features at 10-30 min each | Per-feature smoke green |

### 7.2 Suggested first wave

`compliance.screening.hit_reasoning` (P5), `compliance.screening.override_guardrail`, `comms.inbound_classification`, `comms.reply_drafting`, `sales.lead.score_evaluation`, `sales.email_to_lead_extraction`.

### 7.3 Backwards-compatibility windows

- `packages/llm-client` (Phase 0 throwing stub) → P4 ships working version proxying to gateway. Import paths unchanged.
- `core.llm_usage` (existing) → stays 60 days post-P5. Read paths swap to gateway view. Eventual drop after 30-day no-direct-read window.
- `packages/llm-improver/null-agent` + standalone `workbench-agent` continue to work; gateway-integrated improver is additive.

### 7.4 Risk register & rollback

- Gateway DB outage → callers see `PROVIDER_UNAVAILABLE`. Feature-flag at caller-side bypasses LLM (most features advisory; business flow continues).
- Wrong provider configured → admin UI reverts via `gateway.provider_configs` history (audit-logged).
- Cost runaway → real-time budget caps; warn 80%, reject 100%; tenant admins notified within seconds.
- Schema migrations → same Supabase MCP pattern as Phase 6; smoke harness (Step 60) catches regressions before merge.

---

## 8. Success Metrics & KPIs

**North star:** minutes from idea-to-prod-LLM-feature. Target ≤30 min after P5.

### 8.1 Adoption

| Metric | Target | Source | Cadence |
|---|---|---|---|
| New-platform onboarding time | ≤1 working day | manual + git log | per-onboarding |
| New-feature ship time | ≤30 min p50, ≤2h p95 | prompt-PR merge → first prod invoke | weekly |
| Features in prod per module | ≥3 by P6+6mo; ≥10 platform-wide by P7+12mo | `count(distinct prompts.key) active` | weekly |
| Platforms integrated | ≥4 by P6+12mo | `count(distinct platform_id) FROM llm_usage_daily` | weekly |
| % LLM calls via gateway | 100% by P6+30d | grep + lint enforcement | weekly |

### 8.2 Engineering velocity

| Metric | Target | Source |
|---|---|---|
| Engineering hours per LLM feature | ≤2h (vs ~16h baseline) | PR labels |
| Hours saved vs build-N-times baseline | (16h × features) − (2h × features + 400h gateway) > 0 by feature #25 | computed |
| Prompt-iteration cycle time | edit → A/B → promote ≤24h | prompt_versions timestamps |
| % features reusing improver | ≥50% by P7+6mo | improver telemetry |

### 8.3 Performance & reliability

| Metric | Target |
|---|---|
| `/v1/invoke` p99 latency (excluding provider) | ≤80ms |
| End-to-end p99 (with provider) | ≤3s chat-class, ≤8s reasoning-class |
| Cache hit rate | ≥30% platform; ≥60% deterministic features |
| Gateway uptime | ≥99.9% (≤43min/mo downtime) |
| Provider-fallback rate | ≤1% |
| Provider error rate (after retries) | ≤0.1% |

### 8.4 Cost & financial

| Metric | Target |
|---|---|
| Cost per invocation (platform-paid avg) | trending down QoQ |
| Margin (platform-paid) | ≥30% |
| Reconciliation variance | ≤5% per provider per month |
| Cost-per-feature trend | flag any feature whose cost/invocation grew >20% MoM |
| Infra cost as % of LLM spend | ≤5% |

### 8.5 Quality & outcomes

| Metric | Target |
|---|---|
| Outcome telemetry coverage | ≥70% of invocations recorded within 7 days |
| Accept rate per feature | feature baseline; alert on >10% drop WoW |
| Edit-distance for accepted-after-edit | track distribution; flag features needing revision |
| Prompt-version regression | A/B B-variant accept-rate < A 95% CI → auto-rollback |

### 8.6 Security & compliance

| Metric | Target |
|---|---|
| PII redaction effectiveness | ≥99.5% on labeled corpus; zero false-negatives on email/ssn/credit_card |
| EGRESS_FORBIDDEN refusals | tracked; investigated case-by-case |
| Cross-tenant data leak incidents | **zero** (any leak = sev-1) |
| Credential rotation age | ≤90 days per BYO-key |
| Audit-log immutability | 100% (any DELETE/UPDATE = trigger refused) |
| Per-tenant retention compliance | 100% conformance to `retention_class` |

### 8.7 Dashboard surface

All metrics exposed as views `gateway.v_*` mirroring the Phase 6 v_saga_state / v_cron_status / v_outbox_health pattern. Single `gateway.v_north_star` view: rolling 30-day "minutes from PR-open to prod-invoke" per feature.

### 8.8 Alerting cadence

- **Real-time (Slack/PagerDuty):** gateway 5xx >1%, cache hit rate cliff (>50% drop), budget reject burst, reconciliation variance >10%, PII false-negative discovered
- **Daily digest:** adoption, ship times, cost trends
- **Weekly report:** full KPI rollup + flagged anomalies

---

## 9. Extended Capabilities

### 9.1 Fine-tuning pipelines

Surface:
```
POST /v1/fine-tunes                # submit job: { provider_kind, base_model_id, dataset_url, hyperparameters, ... }
GET  /v1/fine-tunes/:id            # status: queued | preparing | training | succeeded | failed
POST /v1/fine-tunes/:id/cancel
GET  /v1/fine-tunes                # list per tenant
```

Job lifecycle in `gateway.fine_tune_jobs` table; provider adapters implement `submitFineTune()`. On success, fine-tuned model becomes a new entry in `gateway.provider_models` with `parent_model_id` reference; pinnable via normal `provider_configs`. Fine-tune cost rolls up to `tenant.fine_tune_cost_usd` (separate column from inference cost).

### 9.2 Embeddings

```
POST /v1/embed
{ "tenant_id": "...", "model": "text-embedding-3-small", "inputs": ["text1", "text2", ...] }
→ { "embeddings": [[...], [...]], "usage": {...}, "cost_usd": ... }
```

Caching keyed by `(tenant_id, model, input_hash)`. Storage of embeddings is caller's responsibility (caller's pgvector / Pinecone / etc.) — gateway is stateless for embeddings. Cost tracked same as inference.

### 9.3 Tool use / function calling

Caller passes tools in InvokeRequest:
```typescript
interface InvokeRequest {
  ...
  tools?: ToolDef[];           // { name, description, parameters_schema }
  tool_choice?: 'auto' | 'required' | { name: string };
}
```

Gateway adapter translates to provider-specific function-calling shape (Anthropic tool-use, OpenAI functions, etc.). Response includes `tool_calls`; caller executes tools out-of-band and either calls `invoke` again with tool results OR submits to a workflow loop. SSE streams emit `tool_call` and `tool_result` chunk types (§2.8).

### 9.4 Multi-step / agent workflows

`gateway.llm_invocations.parent_invocation_id` (nullable) — caller passes the previous invocation's id when starting a follow-up call (e.g. tool-result loop, chain-of-thought next step). Enables:
- Trace tree reconstruction (`SELECT ... WHERE root_invocation_id = X`)
- Cost attribution per agent run (sum cost over a chain)
- Outcome propagation (accept/reject the chain as a whole, not just final call)

`gateway.v_agent_chains` view stitches chains via recursive CTE.

### 9.5 Multi-modal inputs

InvokeRequest supports binary content:
```typescript
interface InvokeRequest {
  variables: Record<string, unknown>;
  attachments?: Attachment[];   // { kind: 'image'|'audio'|'document', mime_type, content_base64 OR url }
}
```

Gateway adapter passes appropriately to provider (Anthropic vision, OpenAI gpt-4o vision, Gemini multi-modal). Capability validation (§3.8) ensures pinned model supports requested modality. PII redactor extended: image detection (face blurring) for `strict` tenants via Presidio-image or equivalent.

### 9.6 GDPR right-to-be-forgotten

```
POST /v1/admin/right-to-be-forgotten
{ "tenant_id": "...", "subject_kind": "user|party", "subject_id": "..." }
```

Gateway:
1. Locates all `llm_invocations` referencing `subject_id` (via `subject` field stored on each invocation)
2. NULLs the `variables_redacted_hash`, `response_hash`, `attachments` columns (body) but preserves metadata + cost
3. Writes a `right_to_forget_log` row recording the action + actor + timestamp + invocation count

Audit-immutable rows remain (cannot DELETE per §4.5) but their PII-bearing fields are scrubbed. Compliant with GDPR Art. 17.

---

## 10. Operational Concerns

### 10.1 Testing strategy

**Pyramid:**
- **Unit tests** (per-file): provider adapter request/response shaping, resolver logic, PII redactor regex+NER, cost calculator, budget counter math
- **Integration tests** (per-endpoint): gateway with `echo` + `replay` providers via testcontainers Postgres + Redis; full request → response cycle
- **Contract tests** (per-language client): TS + Python clients hit a shared gateway test instance; assert identical contract behavior on all endpoints; runs in CI for both repos
- **Load tests** (pre-prod): k6 or artillery against staging; baseline throughput per gateway instance; verify rate-limit fairness under burst
- **Chaos tests** (pre-prod): provider-side 5xx injection; verify fallback chain + retry behavior + budget counter accuracy
- **Smoke tests** (post-deploy): adapt Phase 6 Step 60 harness — `scripts/run-gateway-smokes.sh` iterates `services/llm-gateway/tests/*.sql` against deployed env

### 10.2 Observability / distributed tracing

OpenTelemetry spans on every request:
- `gateway.request.received` (root span)
- `gateway.auth.validate`
- `gateway.resolver.find_provider`
- `gateway.pii.redact`
- `gateway.budget.check`
- `gateway.cache.lookup` (with `cache.hit` attribute)
- `gateway.provider.invoke` (with `provider.kind`, `model.id`)
- `gateway.cache.store`
- `gateway.usage.record`

Caller spans propagate via W3C traceparent header. Sink: existing Grafana stack per `project_aviation_ai_pro_deployment.md` memory; per-tenant dashboards filterable by `tenant_id` tag.

Per-invocation trace_id stored on `llm_invocations.trace_id` for fast lookup from logs → traces.

### 10.3 Schema migrations

Gateway DB managed via standard Supabase migrations under `services/llm-gateway/supabase/migrations/`. Same naming convention as logic-nexus-ai (`YYYYMMDDHHMMSS_description.sql`). Applied via MCP `apply_migration` or `supabase db push`. Migration smoke included in Step-60-style harness.

### 10.4 Backup & disaster recovery

- **PITR:** Supabase Pro tier on gateway DB; 7-day point-in-time recovery
- **Nightly cross-region snapshot** to S3 (encrypted at rest)
- **RPO:** ≤1h (PITR), ≤24h (snapshot)
- **RTO:** ≤30min (snapshot restore to new Supabase project; DNS swap of `LLM_GATEWAY_URL`)
- **DR runbook** as separate operational doc (out of scope for this design)
- **Credential vault DR:** Supabase Vault inherits PITR; BYO-keys recoverable

### 10.5 Multi-step deploy

- Schema migration first (additive only; never DROP in same deploy as code change)
- Gateway code deploy via Coolify (rolling restart across instances; nginx health-check drains)
- Per-language client npm/pip publish AFTER gateway deploy succeeds (clients always target deployed contract)

### 10.6 Tenant onboarding self-service (out of scope v1; mentioned for roadmap)

In v1, tenant onboarding is platform-admin operated. Future v2: tenant admin self-service UI lets them set their own BYO-key, budget, residency, PII policy. Not blocking initial rollout — onboarding flow stays manual.

### 10.7 Compliance posture

Architecture supports (but doesn't earn — those are organizational):
- **SOC 2 Type II:** append-only audit log, per-tenant RLS, credential vault, change tracking
- **ISO 27001:** documented controls, access scoping, incident logging
- **HIPAA (US healthcare):** PHI redaction via PII engine extended with HIPAA Safe Harbor identifiers; BAA with providers (Anthropic + Azure OpenAI support BAAs)
- **GDPR:** RTBF endpoint (§9.5), residency enforcement, consent tracking via `pii_pass_through_consented_at`
- **CCPA:** same machinery as GDPR

Earning certifications is a separate operational project.

---

## 11. Glossary & Conventions

- **Tenant** — a customer organization of the SaaS
- **Platform** — a distinct SaaS deployment (logic-nexus-ai, aviation-ai-pro, sthira, …)
- **Domain** — a hostname (e.g. logicnexus.in)
- **Franchisee** — a sub-org within a tenant (e.g. ACME-Delhi within ACME)
- **Feature** — a named LLM use case (e.g. `compliance.screening.hit_reasoning`)
- **Prompt key** — stable identifier for a prompt (`<module>.<feature>` convention)
- **Invocation** — one `/v1/invoke` call; one row in `gateway.llm_invocations`
- **Outcome** — caller-reported quality signal: accepted / rejected / overridden / edited
- **BYO-key** — tenant brings their own provider credentials; gateway routes only
- **Platform-paid** — gateway uses platform credentials; tenant billed via metered usage
- **Resolution** — the 6-layer cascade that picks provider+model for a call
- **Egress** — outbound HTTP from gateway to a provider; subject to residency policy

---

## 12. Open Questions (to be resolved during P0)

1. Gateway hosted on its own Supabase project vs `gateway.*` schema in main project? (Recommend dedicated project; cleaner isolation.)
2. Initial set of `safety_class` values — `standard | elevated | restricted` enough, or add `experimental` / `deprecated`?
3. Tenant self-service onboarding UI in v1 or v2? (Recommend v2.)
4. Webhook delivery retry policy — same exponential backoff as `core.outbox_retries`, or stricter?
5. Embeddings provider catalog — start with OpenAI + open-source, or also Cohere / Voyage / Anthropic?
6. Fine-tuning UI — admin-only in v1, or expose to tenant admins under their BYO-key?
7. Region availability — start with US + IN, add EU at P6+30d, or all three at launch?

---

## 13. References

- `docs/plans/2026-05-28-platform-modules-redesign.md` — master plan (§6 LLM, §7.4 Phase 9 rollout, §2.6 module ownership)
- `docs/plans/2026-05-28-modules/*.md` — per-module subdocs (LLM feature inventories in §7 of each)
- `docs/ADR-0013.md` — AMRO ↔ UIM boundary (pattern reference for cross-schema FKs + outbox events)
- `packages/llm-client/src/types.ts` — preserved contract
- `packages/llm-prompts/src/loader.ts` — prompt-loader patterns to extend
- `packages/llm-improver/src/workbench-agent.ts` — improver-agent to migrate
- Phase 6 Step 51 (`core.v_outbox_health`), Step 49 (`core.v_cron_status`), Step 41 (`outbox_partition_autoprovisioner`), Step 60 (smoke harness) — reusable patterns
- MEMORY: `feedback_llm_provider_independence.md`, `project_coolify_access.md`, `project_aviation_ai_pro_deployment.md`, `project_marketing_sites.md`
