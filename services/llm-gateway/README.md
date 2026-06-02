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

## Production deploy (Coolify / Docker)

The repo ships a multi-stage `Dockerfile` matching the other Phase-6 services
(comms-api, compliance-api, …). Build + run locally:

```bash
docker build -t llm-gateway:latest .
docker run --rm -p 3020:3020 \
  -e LLM_GATEWAY_AUTH_MODE=enforced \
  -e SUPABASE_URL=https://… \
  -e SUPABASE_SERVICE_ROLE_KEY=… \
  -e ANTHROPIC_API_KEY=… \
  -e OPENAI_API_KEY=… \
  llm-gateway:latest
```

Coolify deploy checklist:
- Service type: Docker image (Dockerfile in repo)
- Build context: `services/llm-gateway`
- Port: 3020
- Healthcheck: container `HEALTHCHECK` already configured (GET /healthz)
- Required env vars:
  - `LLM_GATEWAY_AUTH_MODE=enforced` (fail-closed in prod)
  - `LLM_GATEWAY_PORT=3020` (matches `EXPOSE`)
  - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (for DB-backed stores)
- Optional provider env vars (set only the ones you want to enable):
  - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`
- One-time DB tasks (already in `supabase/migrations/`):
  - Apply gateway.* migrations (15+ tables, 9 RPCs)
  - Add `gateway` to the project's PostgREST exposed-schemas list
  - Mint at least one service token:
    `SELECT * FROM gateway.mint_service_token('logic-nexus-ai', ARRAY['invoke'], 'first prod')`

After deploy:
- Verify: `curl https://<your-gateway-url>/healthz`
- Smoke any callsite that hits `/v1/invoke` (e.g. compliance "Explain with AI"
  on `/dashboard/compliance/screenings/:id`).

## What's NOT here yet (operational follow-ups)

- Provider fine-tune submission worker (storage live; training submission pending)
- Real-time WebSocket / SSE `/v1/invoke/stream`
- Redis-backed budget counters (Postgres-backed shipped; Redis is a perf upgrade)
- OpenTelemetry SDK initialization (W3C traceparent propagation already
  ships; full span emission needs a collector deployment)
- Gateway admin UI (currently admin via direct DB)
- Per-tenant data residency enforcement at routing-time (egress policy is
  in place; multi-region deployment is operational work)
