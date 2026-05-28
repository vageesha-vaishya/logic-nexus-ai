# `@platform/db-types-core`

Auto-generated TypeScript types for the `core.*` Postgres schema (tenants, users, parties, audit_log, outbox, files, notifications, llm_*, etc.).

## How types get generated

Once `core.*` tables exist (Phase 1 onward):

```bash
# Just the core schema:
npm run db-types:generate:core

# All schemas at once (root supabase types + per-schema packages):
npm run db-types:generate:all
```

Under the hood this calls:

```
supabase gen types typescript --project-id $VITE_SUPABASE_PROJECT_ID --schema core
> packages/db-types-core/src/database.ts
```

The output is committed to the repo (regenerated as schema changes ship). Don't edit by hand.

## Consuming the types

```ts
import type { Database } from '@platform/db-types-core';

type Party = Database['core']['Tables']['parties']['Row'];
type PartyInsert = Database['core']['Tables']['parties']['Insert'];
type PartyUpdate = Database['core']['Tables']['parties']['Update'];

// Or use the convenience re-exports added to src/index.ts as tables ship.
```

## Phase 0 state

The `core` schema exists (Phase 0.10 migration `20260528120000_create_core_schema.sql`) but contains **no tables yet** — they land in Phase 1 (audit_log, outbox, llm_*, idempotency_keys, feature_flags, secrets, domains) and Phase 2 (parties, relationships).

Until then, `src/index.ts` exports an empty `Database` type so consumers stay compilable without errors.

## Per-module sibling packages

Parallel packages follow as each business module's schema is migrated:

- `@platform/db-types-crm` (Phase 4)
- `@platform/db-types-sales` (Phase 4)
- `@platform/db-types-quotation` (Phase 4)
- `@platform/db-types-logistics` (Phase 5)
- `@platform/db-types-finance` (Phase 5)
- `@platform/db-types-compliance` (Phase 6)
- `@platform/db-types-comms` (Phase 6)
- `@platform/db-types-amro` (Phase 8)
- `@platform/db-types-uim` (Phase 7)

Each has its own `db-types:generate:<module>` script that targets `--schema <module>`. Modules importing each other's database types is **forbidden** (lint rule once tables ship) — cross-module data flows through events per master §5.

## Why a separate package per schema (not one mega-types file)

Per master §2.8 — "types live in `packages/db-types-<module>`". Reasons:

1. **Independent regen cadence.** Markets schema changes shouldn't dirty AMRO's generated file.
2. **Per-package CODEOWNERS.** The owning module's team approves changes.
3. **Smaller dev-server reload.** Vite recompiles only the changed package.
4. **Module-boundary enforcement.** A future lint rule can forbid `db-types-crm` imports from inside `module-logistics/` code.

## See also

- Master design doc §2.8 — types per schema
- `docs/plans/2026-05-28-modules/core.md` §3 — target schema for what will populate this package
- `supabase/migrations/20260528120000_create_core_schema.sql` — Phase 0.10 schema-only migration
