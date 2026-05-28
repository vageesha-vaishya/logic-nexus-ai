# `@platform/db-types-core`

Auto-generated TypeScript types for the `core.*` Postgres schema (tenants, users, parties, audit_log, outbox, files, notifications, llm_*, etc.).

## How types get generated

Once `core.*` tables exist (Phase 0.10 + Phase 1):

```bash
npm run supabase:types:gen
```

This regenerates `src/database.ts` with row/insert/update types per table. Consumers import from `@platform/db-types-core`:

```ts
import type { Database } from '@platform/db-types-core';
type Party = Database['core']['Tables']['parties']['Row'];
```

## Phase 0 scope

This package is a **stub**. No tables exist in `core.*` yet (that lands in Phase 0.10 — empty schema, and Phase 1 — first lifts). `src/index.ts` exports nothing useful until then.

A parallel `@platform/db-types-<module>` package follows for each business module once its schema is migrated.
