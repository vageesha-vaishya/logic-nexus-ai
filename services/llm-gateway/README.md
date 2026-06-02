# llm-gateway

Unified LLM gateway for the multi-platform SaaS estate. See the canonical design at
[`docs/plans/2026-06-02-unified-llm-gateway-design.md`](../../docs/plans/2026-06-02-unified-llm-gateway-design.md).

## Phase

**P0 (this scaffold)** ships the Express skeleton + `/v1/invoke` backed by the `echo` provider only. No DB writes, no Redis, no real providers, no auth enforcement, no PII redaction, no budgets. Gate: echo p99 ≤ 50ms at 100 req/s.

P1 will add the resolver + real providers (Anthropic / OpenAI / Gemini / Mistral) + replay provider + Supabase Vault credentials. See [`§7.1 Phased plan`](../../docs/plans/2026-06-02-unified-llm-gateway-design.md) for the rest.

## Quickstart

```bash
cd services/llm-gateway
npm install
npm run dev                 # tsx watch on :3020
```

Smoke:

```bash
curl http://localhost:3020/healthz

curl -X POST http://localhost:3020/v1/invoke \
  -H 'Content-Type: application/json' \
  -d '{
    "tenant_id":"00000000-0000-4000-8000-000000000001",
    "module":"compliance",
    "feature":"screening.hit_reasoning",
    "prompt_key":"compliance.screening.hit_reasoning",
    "variables":{"party":{"name":"ACME Corp","country":"US"}}
  }'
```

Expected response shape:

```json
{
  "invocation_id": "...",
  "output": { "kind": "echo", "prompt_key": "...", "tenant_id": "...", "echo": { ... } },
  "cache_hit": false,
  "model_used": "echo-v1",
  "provider_kind": "echo",
  "usage": { "prompt_tokens": 24, "completion_tokens": 51, "total_tokens": 75 },
  "cost_usd": 0,
  "latency_ms": 6,
  "warnings": ["echo_provider_used"],
  "scaffold_phase": "P0"
}
```

## Tests

```bash
npm test          # supertest over the Express app, no network
npm run build     # tsc to dist/
```

## Env

| Var | Default | Notes |
|---|---|---|
| `LLM_GATEWAY_PORT` | `3020` | Service port |
| `LLM_GATEWAY_CORS_ORIGIN` | `*` | CORS origin (P2: tighten to known callers) |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

## OpenAPI

[`openapi.yaml`](./openapi.yaml) is the canonical contract. Per-language SDKs will be codegened from this file starting P4 (TS + Python first). For P0 only `/healthz`, `/readyz`, and `/v1/invoke` are populated; the rest of the spec lives in `docs/plans/2026-06-02-unified-llm-gateway-design.md §2.3`.

## Directory layout

```
src/
  app.ts                      # Express factory (createApp) + default export
  index.ts                    # Server entry (loads .env, listens on PORT)
  types/gateway.types.ts      # Contract: InvokeRequest, InvokeResponse, ProviderAdapter, ...
  providers/
    index.ts                  # Provider registry (P0: echo only)
    echo.ts                   # Deterministic mock provider
  routes/
    invoke.ts                 # POST /v1/invoke
    health.ts                 # GET /healthz, GET /readyz
  middleware/
    correlation.ts            # X-Correlation-Id propagation
    error.ts                  # Error envelope per design §2.4
  utils/
    logger.ts                 # Structured JSON logger

tests/
  invoke.test.ts              # supertest coverage of the P0 surface
  setup-env.ts                # Test env vars
```

## What's NOT here yet (deferred to later phases)

- Real LLM provider adapters (P1)
- 6-layer provider resolution cascade (P1)
- Supabase Vault BYO-key credential storage (P1)
- Prompt management (`gateway.prompts`) (P3)
- A/B promotion via improver loop (P3)
- Service-token auth + scopes (P2)
- Rate limits, budgets, quotas (P2)
- PII redaction (P2)
- Append-only audit log (`gateway.llm_invocations`) (P2)
- Egress controls / per-tenant data residency (P2)
- Cost attribution + daily rollup (P5)
- Per-language SDK codegen (P4)
- `/v1/invoke/stream` SSE (P2)
- `/v1/embed`, `/v1/estimate`, `/v1/fine-tunes`, agent workflows (P5+)

Each phase has its own gate and rollback story documented in the design doc.
