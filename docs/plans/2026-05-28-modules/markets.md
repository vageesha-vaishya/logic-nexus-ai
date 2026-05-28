# `markets` — Markets Module (contract conformance audit)

**Date:** 2026-05-28
**Status:** Draft — under review
**Depends on:** `core`
**Parent doc:** [`../2026-05-28-platform-modules-redesign.md`](../2026-05-28-platform-modules-redesign.md)

---

## 1. Purpose

Markets is the **retail investment + trading platform** module — portfolios, holdings, orders, watchlists, ideas, AI-driven research, broker integrations. It is also the **most-mature module on the platform** and the closest existing implementation of the §2 contract. This subdoc is primarily a **conformance audit**: what already holds, what subtly diverges, what to fix before assuming markets is "done."

---

## 2. Current state (evidence)

| Concept | Current state |
|---|---|
| Schema | `markets.*` with **61 tables** (`supabase/migrations/20260515024101_markets_schema_v1_foundation_v2.sql`, `…children_and_outputs.sql`). Most-complete schema separation in the platform. |
| Frontend | `src/features/markets/` with **27 routed pages** under `/dashboard/markets/*` (App.tsx:1206–1243), plus sub-areas `terminal`, `retail`, `sthira` (mobile audience). |
| Backend worker | `services/markets-worker/` — **Python / FastAPI** (different stack from CRM-API/AMRO-API which are Node). Has `.venv`, pytest, ruff. |
| Routes guarded by | `requiredDomainCode="MARKETS"` — already conforms to §2.7(5) domain-code system. |
| LLM integration | `services/markets-worker/src/markets_worker/llm_gateway.py`, `routers/chat.py`, `routers/portfolio_pnl.py`, `jobs/signal_generator.py`, `src/features/markets/hooks/useLlmConfigs.ts`, `useProviderModels.ts`, `pages/LlmSettingsPage.tsx`. The most-developed LLM surface on the platform. |
| RLS | Markets-specific migration `20260515024241_markets_enable_rls_on_price_history_partitions.sql` covers partitioned tables. Tenant-isolation policies present. |
| Cross-module integration | `markets_portfolios_crm_integration.sql` (mig `20260515114554`) — **already references CRM data**. Worth inspecting. |

---

## 3. Conformance against the §2.1 Module Contract

| # | Contract requirement | Markets status |
|---|---|---|
| 1 | Own a dedicated Postgres schema | ✅ `markets.*`, 61 tables |
| 2 | Reference shared identity only via `core.*` | ⚠️ Today references `public.users` directly. Will need rewrite to `core.users` once core lands. The `markets_portfolios_crm_integration` migration is the surface where this matters most. |
| 3 | Publish domain events through the platform event bus | ❌ **No outbox poller visible in `services/markets-worker/`**. No `markets.* → Kafka` publishing. Markets is functionally self-contained today, which has hidden the gap. |
| 4 | Subscribe to other modules only via an ACL | ⚠️ The `markets_portfolios_crm_integration` migration appears to **direct-read** CRM data, not ACL-mediated. Needs verification. |
| 5 | Register routes through `manifest.ts` | ⚠️ `src/features/markets/manifest.ts` exists; routes still in App.tsx (lines 1206–1243). Same gap as every other module. |
| 6 | Backend service mediates all access | ⚠️ Frontend reads `markets.*` tables directly via Supabase client (`src/features/markets/hooks/*`). Worker is for *server-side jobs* (LLM, signals, P&L), not request mediation. |
| 7 | Own test suite + RLS tests | ✅ `services/markets-worker/tests/` exists; RLS policies present. RLS-specific test coverage not confirmed — should be verified. |

**Headline:** markets is closest to the contract but **not at-spec on events, ACL discipline, or backend mediation**. Those gaps will become visible the moment another module needs to react to a markets event.

---

## 4. Target schema notes

`markets.*` schema stays as-is structurally. Required changes:

1. **FK rewrites** — any `markets.* → public.users / public.tenants` FK becomes `markets.* → core.users / core.tenants`. Identify via:
   ```sql
   SELECT conrelid::regclass, conname FROM pg_constraint
   WHERE confrelid::regclass::text LIKE 'public.%' AND conrelid::regclass::text LIKE 'markets.%';
   ```
2. **`markets.broker_portfolio_links` (CRM integration)** — re-route through `core.parties`. If the link is "this broker connection belongs to this customer," that customer should be a `core.parties` row, not a `public.accounts` row.
3. **LLM tables** — `markets.ai_briefs`, `markets.chat_sessions`, `markets.chat_messages`, `markets.research_messages`, `markets.research_threads`, `markets.prompts` should write LLM-usage rows to `core.llm_usage` (currently `platform.llm_usage`, which moves to core).
4. **Notifications** — `markets.notifications` table currently exists in markets schema. Per §2.7(2), this becomes a *view* over `core.notifications WHERE subject_type LIKE 'markets.%'`. The markets-specific delivery channels (push notifications via `markets.push_tokens`) stay in markets.

---

## 5. RLS strategy

Markets already has tenant-isolation policies. Required upgrades:

- Use `core.has_module_access(tenant_id, 'markets', action)` instead of inline `tenant_id = auth.uid_tenant()` checks. Centralises module-access logic.
- Add policy tests in `services/markets-worker/tests/test_rls.py` — assert that a user in CRM cannot read `markets.portfolios` they don't have markets access to.
- Verify **partitioned-table policies inherit correctly** to `markets.price_history_y2027` etc. The `20260515024241_markets_enable_rls_on_price_history_partitions.sql` migration suggests partition RLS has been a problem; needs ongoing attention as new yearly partitions roll over.

---

## 6. Events

**Today: zero outbound events.** Markets is treated as a leaf consumer. This is a hidden risk: when Finance needs to know about realised gains, or Compliance needs to know about a large trade for surveillance, the only path today would be polling.

**Target events to publish:**

| Event | When | Consumers |
|---|---|---|
| `markets.portfolio.created` / `markets.portfolio.updated` | Portfolio lifecycle | Comms (welcome), Compliance (KYC trigger if first portfolio) |
| `markets.order.placed` / `markets.order.filled` / `markets.order.cancelled` | Order lifecycle | Compliance (surveillance), Finance (settlement tracking) |
| `markets.position.closed` | Round-trip on a holding | Finance (realised P&L for tax) |
| `markets.alert.fired` | Price alert / SIP trigger | Comms (notify user) |
| `markets.broker.connected` / `markets.broker.disconnected` | Broker connection state | Compliance (track which broker holds tenant funds) |
| `markets.signal.generated` | AI signal | Comms (notify if user opted in) |

**Subscribed events:**
- `core.user.created` (when audience is `retail`, kick off retail onboarding flow)
- `core.party.created` (link to broker accounts later)
- `comms.notification.delivered` (track engagement for AI fine-tuning)

ACL location: `services/markets-worker/src/markets_worker/acl/` (new).

---

## 7. UI surface (existing, no redesign)

27 routes; no proposed changes. The retail/desktop split (`/dashboard/markets/retail`) and mobile shell (`/sthira/*`) are already well-architected per the existing memory `project_sthira_native_routing.md`.

Required hygiene:
- Move route registration from App.tsx into `src/features/markets/manifest.ts` as part of the platform-wide manifest migration.

---

## 8. LLM hooks (already extensive)

Markets is the **template** for how the rest of the platform should integrate LLMs:

| Feature | Current location | Provider |
|---|---|---|
| AI chat / advisor | `markets-worker/routers/chat.py` | Configurable (Anthropic / OpenAI / Gemini) |
| Portfolio P&L narrative | `markets-worker/routers/portfolio_pnl.py` | Same |
| Signal generation (nightly) | `markets-worker/jobs/signal_generator.py` | Same |
| AI briefs | `markets.ai_briefs` table | Same |
| Holdings news synthesis | `markets-worker/routers/holdings_news.py` | Same |
| Prompts library | `markets.prompts` table | — |

**Required upgrades:**
1. All LLM calls migrate to `packages/llm-client` (from `core`). Today's `llm_gateway.py` becomes a thin adapter calling the shared client over HTTP, OR the shared client is ported to Python and used directly. Decision deferred — see open questions.
2. LLM usage rows write to `core.llm_usage` (already do via `platform.llm_usage` — just a rename when core lands).
3. Cache discipline: `markets.ai_briefs` rows are written but cache-hit rate isn't observable today. Add `cache_hit boolean` to `core.llm_usage` and instrument every call.

---

## 9. Migration sequence

Markets is **low-risk** to bring fully into compliance because the schema is already separated.

| Phase | What | Risk |
|---|---|---|
| 0 | Wait for `core` Phase 1 (LLM lift). Markets gets `core.llm_usage` for free via rename. | Zero — additive. |
| 1 | Rewrite markets FKs to `core.users` / `core.tenants` / `core.parties`. Single migration. | Low. |
| 2 | Add `core.outbox` poller to `markets-worker`. Start publishing the 6 events from §6. No consumers yet — safe. | Low. |
| 3 | Migrate route registration from App.tsx to `markets/manifest.ts`. | Low — UI-only. |
| 4 | Replace direct CRM reads in `markets_portfolios_crm_integration` with ACL-mediated reads (subscribe to `core.party.*` events, build local read model). | Medium — requires understanding the existing integration's intent. |
| 5 | Port shared LLM client to Python OR have markets-worker call shared HTTP gateway. | Medium — architectural decision. |

---

## 10. Open decisions

1. **Python shared LLM client vs HTTP gateway** — markets-worker is Python; the proposed `packages/llm-client` (§core.7) is Node. Three options: (a) port the client to Python, (b) markets-worker calls a Node gateway over HTTP, (c) accept two clients with shared usage-write contract enforced via test. Recommend (a) — small client, avoids extra hop.
2. **`markets.notifications` table merge into `core.notifications`** — markets may have markets-specific fields. Inspect before collapsing.
3. **Retail audience module split** — `markets-retail` and `markets-terminal` are different *audiences*, not different modules. Confirm we don't want to split them schema-wise.
4. **Sthira mobile shell relationship** — Sthira is the consumer-brand mobile app over markets-retail. Conformance: it should subscribe to markets events, not query markets tables. Today's `project_sthira_native_routing.md` memory suggests direct DB access. Audit deferred to a Sthira-specific review.
5. **Price-history partitions** — yearly partition rollover automation. Currently manual? Verify cron.

---

## 11. Acceptance criteria

Done when:

- [ ] All `markets.* → public.*` FKs rewritten to `markets.* → core.*`.
- [ ] `core.outbox` poller running in `markets-worker`; the 6 events from §6 publish on the expected triggers.
- [ ] All LLM calls write to `core.llm_usage`; CI lint forbids direct `anthropic` / `openai` imports outside the shared client.
- [ ] `markets/manifest.ts` is load-bearing; App.tsx no longer hard-codes markets routes.
- [ ] RLS test suite for markets passes including module-access checks.
- [ ] Yearly price-history partition rollover automated.

---
