# `packages/`

Platform packages — shared libraries used across services and app code. Created in **Phase 0** of the platform-modules redesign (see `docs/plans/2026-05-28-platform-modules-redesign.md` §7.4).

## Inventory

| Package | Purpose | Status |
|---|---|---|
| `@platform/event-contracts` | Universal event envelope + per-topic JSON schemas (master §5.1) | Skeleton |
| `@platform/llm-client` | The only legal path to LLM providers (master §6.2) | Skeleton (throws on call) |
| `@platform/llm-prompts` | Versioned prompt repository: frontmatter parser, loader (master §6.3) | Skeleton |
| `@platform/llm-improver` | Pluggable Prompt Improver Agent (master §6.8) | `NullImproverAgent` returns `[]` |
| `@platform/db-types-core` | Generated TS types from the `core.*` Postgres schema | Stub (no `core.*` schema yet) |

## Import pattern

```ts
import { invoke, recordOutcome } from '@platform/llm-client';
import { validateEnvelope, type EventEnvelope } from '@platform/event-contracts';
import { parseFrontmatter, FilesystemPromptLoader } from '@platform/llm-prompts';
import { NullImproverAgent } from '@platform/llm-improver';
```

The path alias `@platform/*` → `packages/*/src` is configured in three places:

- `tsconfig.json` (root) — IDE + `tsc --noEmit`
- `tsconfig.app.json` — application typecheck
- `vite.config.ts` — runtime bundling

## Why not npm workspaces (yet)

This monorepo doesn't use npm workspaces today. Packages here are integrated via TypeScript path aliases only — **no `npm install` impact on existing services**. When the team is ready for true workspaces (publishing internal packages, isolating dependency trees per service), declaring `"workspaces": ["services/*", "packages/*"]` in the root `package.json` adopts these directories with zero migration.

## Layout of a package

```
packages/<name>/
├── package.json        ← metadata only (no install side-effects)
├── tsconfig.json       ← extends ../../tsconfig.app.json
├── README.md
└── src/
    ├── index.ts        ← public exports
    ├── types.ts
    └── <implementation>.ts
```

## Adding a new package

1. Create the directory + the four files above.
2. Add to the inventory table in this README.
3. (Optional) Add path alias if you want `@platform/<name>` resolution — already covered by the wildcard.

## See also

- Master design doc: `docs/plans/2026-05-28-platform-modules-redesign.md` (§6.2 client, §6.3 prompts, §6.8 improver, §7.4 Phase 0)
- Core module: `docs/plans/2026-05-28-modules/core.md` (§3.9 LLM tables, §10 acceptance criteria)
