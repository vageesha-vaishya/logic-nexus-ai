# `@platform/llm-client`

**The only legal path from any module to any LLM provider.** CI lint forbids direct `@anthropic-ai/sdk` / `openai` / `@google/generative-ai` imports outside this package (`packages/llm-client/**`).

See master design doc §6.2 for the full contract.

## Public API

```ts
import { invoke, recordOutcome } from '@platform/llm-client';

const response = await invoke<{ score: number; reasoning: string }>({
  tenant_id: ctx.tenant_id,
  module: 'sales',
  feature: 'lead_scoring',
  prompt_key: 'sales.lead.score_evaluation',
  variables: { lead, recent_activities, tenant_icp_profile },
  subject: { type: 'sales.lead', id: lead.id },
});

// Later, when the user acts on the result:
await recordOutcome(response.invocation_id, { kind: 'accepted', user_id });
```

## What `invoke()` does (per §6.4 resolution pipeline)

1. Resolve active prompt version (incl. tenant overrides + active experiments)
2. Fill template variables
3. Apply PII redaction + output-schema injection
4. Pick model (override > tenant default > prompt default) + check budget
5. Call provider via cached adapter or direct call
6. Validate response, extract confidence, redact response PII
7. Write `core.llm_usage` + `core.llm_invocations` rows
8. Return `InvokeResponse` with `invocation_id`

## Phase 0 scope

This package is **skeleton only**:
- Public types and interfaces are stable
- `invoke()` and `recordOutcome()` throw `"not yet wired"`
- No provider SDK dependencies yet

The real implementation lands in **Phase 9** (LLM infrastructure rollout, master §7.4).

## What lives here later (Phases 9+)

- `src/providers/` — adapters for Anthropic, OpenAI, Gemini
- `src/cache.ts` — Redis-backed cache keyed on `(prompt_key, version, normalised_variables)`
- `src/budget.ts` — `core.llm_budgets` enforcement
- `src/pii.ts` — PII redaction pipeline
- `src/safety.ts` — Safety-class enforcement
- `src/observability.ts` — `core.llm_invocations` writer
