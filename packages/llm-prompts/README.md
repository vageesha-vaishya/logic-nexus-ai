# `@platform/llm-prompts`

Versioned prompt repository. Per master §6.3, prompts live as files with YAML frontmatter under per-module directories. This package is the **loader + parser** — runtime resolution happens in `@platform/llm-client`.

## Directory layout (will populate as features ship)

```
packages/llm-prompts/
└── src/
    ├── index.ts            ← public API
    ├── types.ts            ← PromptDefinition, PromptFrontmatter
    ├── loader.ts           ← parseFrontmatter, FilesystemPromptLoader
    ├── crm/                ← module-owned prompts
    │   ├── activity_summarisation/
    │   │   ├── v1.prompt.md
    │   │   ├── v1.schema.json
    │   │   └── v1.fixtures.jsonl
    │   └── ...
    ├── sales/
    └── ...
```

## Frontmatter contract

Every `.prompt.md` file starts with:

```yaml
---
key: sales.lead.score_evaluation
version: 3
status: active                    # 'draft' | 'shadow' | 'active' | 'deprecated'
owner_module: sales
default_model: claude-haiku-4-5
fallback_model: gpt-4o-mini
expected_inputs: [lead, recent_activities, tenant_icp_profile]
output_schema: ./v3.schema.json
max_tokens: 600
temperature: 0.2
cache_ttl_seconds: 900
pii_handling: redact_emails_phones
safety_class: business_advisory   # 'business_advisory' | 'customer_facing' | 'regulatory'
---

You are a sales-qualification assistant ...
```

## Phase 0 scope

- Minimal frontmatter parser (no js-yaml dependency yet — Phase 0.5 swaps in)
- `FilesystemPromptLoader` is a skeleton; throws on `load()`
- No prompts shipped yet

The first prompts land in **Phase 9** alongside the LLM-client wiring.
