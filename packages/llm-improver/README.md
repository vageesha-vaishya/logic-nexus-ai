# `@platform/llm-improver`

Pluggable **Prompt Improver Agent** — proposes prompt variants from `core.llm_invocations` observability data. Master design doc §6.7–§6.8.

## Public API

```ts
import { NullImproverAgent } from '@platform/llm-improver';

const agent = new NullImproverAgent();         // Phase 0 default
const variants = await agent.proposeVariants({ /* ImproverInput */ });
// → [] in Phase 0
```

## Pluggable backing runtimes (decision in master §6.13)

Per the design, the improver runtime is a slot, not a fixed implementation. Adapters live alongside `NullImproverAgent`:

| Adapter | Backing | Phase |
|---|---|---|
| `NullImproverAgent` | Returns `[]` always — collects data without proposing | Phase 0 (now) |
| `WorkbenchImproverAgent` | Anthropic Claude proposes variants using a structured ReAct loop | Phase 9 |
| `DspyImproverAgent` | DSPy compiles prompts from examples | Future |
| `OpenpipeImproverAgent` | Hosted prompt optimisation | Future |
| `HermesImproverAgent` | User's custom Hermes-style agent (pending naming clarification) | When wired |

## Guardrails (every variant must satisfy)

Per master §6.8:
1. Same `safety_class` as control — cannot relax `regulatory` to `business_advisory`
2. Schema-valid output on 100% of frozen test fixtures
3. Cannot change the prompt's *task* — only phrasing, examples, structure (semantic-similarity check)
4. Promotion to `active` requires statistical significance on A/B OR explicit human approval

## Phase 0 scope

- Interface definitions (`PromptImproverAgent`, `PromptVariant`, `PromptMetrics`, `ImproverInput`)
- `NullImproverAgent` returns `[]` — collects data without proposing variants
- Real adapters land in Phase 9 alongside `core.llm_invocations` observability
