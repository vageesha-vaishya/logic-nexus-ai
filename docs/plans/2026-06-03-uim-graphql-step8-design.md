# Phase 7 UIM Step 8 — GraphQL Subgraph Design

Date: 2026-06-03
Author: Claude (Opus 4.7) — pair with @vimalbahuguna
Status: Draft for review
Predecessors:
- `docs/plans/2026-05-28-modules/uim.md` (master plan, §9.2 + §10 acceptance)
- 4b.10 commit `68561051` — hand-rolled GraphQL dispatcher (the shim this design replaces)

---

## 1. What we're solving

The 4b.10 shim is a `query.includes('uimHealth')` substring matcher
backing 3 fields. It satisfies the integration-contracts contract
surface but doesn't scale beyond demos: no schema validation, no
variable typing, no introspection, no field-level errors, no
DataLoader, no operation tracing.

Step 8 in the Phase 7 plan is "Resolve GraphQL subgraph (per uim.md
§9.2)". This document is the design that lets us put that step
behind us with a real schema, then keep adding fields without
schema rewrites.

§9.2 of the master plan already decided:
> **Recommend keep but isolate**: GraphQL is well-suited to
> inventory's read-heavy aggregations. Don't propagate to other
> modules. UIM-api hosts both REST routes (for mutations) and the
> GraphQL subgraph (for read aggregations).

So **mutations stay REST** on `uim-api`. **GraphQL is read-only**.
**No other module adopts GraphQL** during this phase.

This doc settles:
1. Library / runtime
2. Schema construction style (SDL vs code-first)
3. Schema scope for v1 (which fields, which entities)
4. Pagination style
5. Auth + context plumbing
6. N+1 protection (DataLoader strategy)
7. Federation decision
8. Migration from the 4b.10 shim
9. Observability / complexity limits
10. Rollout slices + acceptance

---

## 2. Library choice — recommended: **graphql-yoga + Pothos**

Three candidates, ranked:

| Option | Pros | Cons |
|---|---|---|
| **graphql-yoga + Pothos (recommended)** | Lightweight Express handler; first-class TS; code-first schema with full type inference; tiny dep footprint (yoga 4MB, no Apollo); excellent Pothos DX | Smaller ecosystem than Apollo |
| Apollo Server + SDL | Industry-standard; mature; built-in Apollo Studio | 30MB+ deps; SDL ↔ TS drift; opinionated; overkill for one subgraph |
| graphql-js raw + buildSchema | Zero extra deps | Hand-rolling resolvers, context, tracing, errors — we'd reinvent half of yoga |

Why **graphql-yoga + Pothos**:

- **Yoga** is a thin Express-compatible request handler. We mount it
  as another route on the existing `uim-api` Express app — no second
  server, no separate port, same auth middleware chain. Yoga gives
  us schema validation, variable typing, multipart uploads,
  GraphQL-over-HTTP spec compliance, and built-in plugins for
  tracing + complexity limits.
- **Pothos** is a code-first schema builder. We define types in
  TypeScript with `t.field({ type: 'Int', resolve: ... })` and the
  schema's executable type *and* the introspection SDL are derived
  from the same source. No `.graphql` files drifting away from
  resolvers; no `gql\`...\`` template strings; full IDE
  autocomplete on field args + parent objects.
- Same stack used by Hive, Linear, several reference subgraphs —
  not a niche pick.

**Reject Apollo Server** for v1: it adds ~25MB and a lot of opinion
(Apollo Sandbox, Apollo Studio, federation gateway machinery) we
won't use. If we later need federation across UIM + a second
module, we can swap yoga for Apollo Server in one slice — the
Pothos schema is portable.

**Reject raw graphql-js**: rebuilding context plumbing, request
parsing, error handling, complexity limits, and tracing for one
subgraph is busywork.

Dependencies added to `services/uim-api/package.json`:

```json
"graphql": "^16.10.0",
"graphql-yoga": "^5.7.0",
"@pothos/core": "^4.4.0",
"dataloader": "^2.2.3"
```

Total dep weight: ~6MB.

---

## 3. Schema construction style — recommended: **code-first via Pothos**

Two styles:

| Style | Verdict |
|---|---|
| **Code-first (Pothos)** | Recommended. Schema and resolvers live in the same file; types flow from one source. |
| SDL-first | Rejected. Requires keeping `.graphql` files in sync with TS resolver signatures. Drift bugs are silent and load-bearing in production. |

Schema files live under `services/uim-api/src/graphql/`:

```
services/uim-api/src/graphql/
  builder.ts          // PothosSchemaBuilder + context type
  server.ts           // yoga handler, plugins, mounted route
  types/
    inventory-item.ts
    catalog-item.ts
    projection-snapshot.ts
    reservation.ts
    ledger-entry.ts
    integration.ts
    health.ts
  loaders/
    catalog-item.loader.ts
    inventory-item.loader.ts
    reservation.loader.ts
  queries/
    inventory.queries.ts
    integration.queries.ts
    health.queries.ts
```

The builder + plugin wiring is in one file; each type/loader/query
group is its own ~100 LOC file. Pothos auto-merges them via
explicit `builder.queryFields(...)` calls from `server.ts`.

---

## 4. Schema scope for v1

**Read-only.** Mutations stay REST (per §9.2).

### 4.1 Existing fields (must preserve — 4b.10 callers depend on them)

```graphql
type UimHealth {
  status: String!
  apiVersion: String!
  schemaPath: String!
}

type ProjectionSnapshot {
  inventoryItemId: ID!
  projectedAvailableQuantity: Float!
  projectedReservedQuantity: Float!
  projectedConsumedQuantity: Float!
  replayVersion: Int!
  updatedAt: DateTime!
}

type InventoryItem {
  id: ID!
  catalogItemId: ID
  quantity: Float!
  status: String!
  locationId: ID
  updatedAt: DateTime!
}

type Query {
  uimHealth: UimHealth!
  uimProjectionItems(limit: Int = 50, offset: Int = 0): [ProjectionSnapshot!]!
  uimInventoryItem(id: ID!): InventoryItem
}
```

These ship in v1 with **byte-identical** responses to the 4b.10
shim so existing callers (frontend `useUimProjectionItems` hook,
ops dashboards) need zero change.

### 4.2 New fields in v1 (the actual win)

The point of replacing the shim is the things it can't do. v1 ships:

```graphql
type CatalogItem {
  id: ID!
  sku: String!
  partNumber: String
  title: String
  category: String
  unitOfMeasure: String
  isSerialized: Boolean!
  attributes: JSON
  # MRO profile fields hoisted as first-class
  maintenanceCategory: String
  ataChapterCode: String
  conditionCode: String
  certificationStatus: String
  aogPriority: Boolean!
}

type Reservation {
  id: ID!
  catalogItemId: ID!
  inventoryItemId: ID
  reservedQuantity: Float!
  status: String!
  reservationToken: String!
  referencedModule: String
  expectedUseDate: DateTime
  metadata: JSON
}

type LedgerEntry {
  id: ID!
  inventoryItemId: ID!
  transactionType: String!
  quantityChanged: Float!
  reservationId: ID
  referencedModule: String
  performedBy: ID
  createdAt: DateTime!
}

# CONNECTIONS (Relay-style cursor pagination)
type InventoryItemConnection {
  edges: [InventoryItemEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
type InventoryItemEdge {
  cursor: String!
  node: InventoryItem!
}

type ReservationConnection { edges: [ReservationEdge!]! pageInfo: PageInfo! totalCount: Int! }
type LedgerEntryConnection { edges: [LedgerEntryEdge!]! pageInfo: PageInfo! totalCount: Int! }

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

extend type Query {
  # Listings (Relay cursor pagination)
  inventoryItems(
    first: Int = 25
    after: String
    catalogItemId: ID
    status: String
    locationId: ID
  ): InventoryItemConnection!

  reservations(
    first: Int = 25
    after: String
    status: String
    referencedModule: String
  ): ReservationConnection!

  ledgerEntries(
    first: Int = 25
    after: String
    inventoryItemId: ID
    transactionType: String
    since: DateTime
  ): LedgerEntryConnection!

  # Single-entity reads
  catalogItem(id: ID!): CatalogItem
  catalogItemBySku(sku: String!): CatalogItem

  # Aggregations (the read-heavy use case from §9.2)
  availabilityByPartNumber(partNumbers: [String!]!): [PartAvailability!]!

  # Integration health
  integrations: [Integration!]!
  integration(id: ID!): Integration
  webhookDlqRetryable(limit: Int = 50): [DlqRetryableRow!]!
}

extend type InventoryItem {
  # Cross-entity fields — uses DataLoader
  catalogItem: CatalogItem
  activeReservations: [Reservation!]!
  recentLedger(limit: Int = 10): [LedgerEntry!]!
}
```

**Out of scope for v1:**
- Mutations (stay REST)
- Subscriptions (no real-time UI requirement yet)
- Federation (single subgraph)
- AMRO maintenance-order joins (waits on Step 9 boundary decision)
- Analytics KPIs (covered by REST `/api/v1/uim/analytics/kpis`)

### 4.3 Why these specific fields

- **Aggregation queries** (`availabilityByPartNumber`,
  `availableQuantityByLocation`) are what §9.2 specifically called
  out as the GraphQL win — REST would need N round-trips or a
  bespoke endpoint per question.
- **Cross-entity navigation** (`InventoryItem.catalogItem`,
  `.activeReservations`) demonstrates the DataLoader pattern and
  motivates v2 expansion.
- **Integration health** lifts the existing
  `/api/v1/uim/webhooks` + `/api/v1/uim/dlq` REST responses into a
  composable shape — ops dashboards can ask "show me all
  integrations with retryable DLQ rows" in one query.

---

## 5. Pagination — recommended: **Relay-style cursor**

The 4b.10 shim uses `limit/offset`. v1 keeps `limit/offset` on the
three legacy fields for compatibility but **all new collection
fields use Relay-style cursor pagination** (`first`, `after`,
`edges`, `pageInfo`).

Why:
- Offset pagination breaks on inserts (rows shift between pages).
  Cursor pagination is stable.
- Relay's `PageInfo` is a known shape; Apollo Client, urql, Relay,
  TanStack Query all have first-class helpers.
- Cursors encode tenant scope + sort key so they survive even if
  the underlying query plan changes.

Cursor format: opaque base64 of `{ "k": "updated_at_iso", "i": "id" }`.
Hidden from clients; tested round-trip in unit tests.

---

## 6. Auth + context plumbing

Yoga's request handler runs **after** the existing Express
`authMiddleware`. The middleware already populates
`req.userId / tenantId / franchiseId`. The yoga `context()` factory
reads those off the request and surfaces them on every resolver:

```ts
// services/uim-api/src/graphql/server.ts
const yoga = createYoga({
  schema,
  context: ({ request, params }) => {
    const auth = request as unknown as AuthRequest;
    if (!auth.userId || !auth.tenantId) {
      throw new GraphQLError('UNAUTHORIZED', { extensions: { code: 'UNAUTHORIZED', status: 401 } });
    }
    return {
      userId: auth.userId,
      tenantId: auth.tenantId,
      franchiseId: auth.franchiseId ?? null,
      supabase: getServiceRoleClient(),
      loaders: buildLoaders(),
    };
  },
  graphqlEndpoint: '/api/v1/uim/graphql',
  cors: false, // Express CORS middleware already applied
});
```

**Every resolver** reads `tenantId` from context and scopes its
SELECT. Pothos has no way to enforce this at the type system level,
so we add a **builder convention**: every `resolve()` MUST start
with `const { tenantId } = ctx;` or an ESLint rule blocks it. The
rule lives in `services/uim-api/.eslintrc.cjs` as an
`no-restricted-syntax` ban.

The 4b.10 path applied the same auth middleware — no functional
change for callers.

---

## 7. N+1 protection — DataLoader

Pothos has first-class DataLoader support. The pattern:

```ts
// services/uim-api/src/graphql/loaders/catalog-item.loader.ts
export function buildCatalogItemLoader(ctx: Context) {
  return new DataLoader<string, CatalogItemRow | null>(async (ids) => {
    const { data, error } = await ctx.supabase
      .from('uim_catalog_items')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .in('id', ids as string[]);
    if (error) throw new GraphQLError(`catalog batch failed: ${error.message}`);
    const byId = new Map((data ?? []).map((r) => [String(r.id), r]));
    return ids.map((id) => byId.get(String(id)) ?? null);
  });
}
```

Loaders are **per-request** (built once in the `context()` factory)
so they don't leak data across tenants. A single
`{ inventoryItems(first: 25) { catalogItem { sku } } }` results
in 2 SQL queries (inventoryItems list + 1 batched catalog fetch)
not 26.

v1 ships loaders for:
- catalogItem (by id)
- inventoryItem (by id)
- reservations by inventoryItemId
- ledger entries by inventoryItemId
- integration by id

---

## 8. Federation — recommended: **NO for v1**

§9.2 said GraphQL doesn't propagate to other modules during this
phase. Without a second subgraph, federation buys nothing.

If a second module ever adopts GraphQL, we swap yoga for Apollo
Server (or stay on yoga with `@graphql-tools/federation`) in one
slice. Pothos has a `@pothos/plugin-federation` plugin that
augments types with `@key` directives — additive change, not a
rewrite.

The integration-contracts response continues advertising
`/api/v1/uim/contracts/uim-subgraph.graphql` so external connectors
can introspect.

---

## 9. Migration from the 4b.10 shim

Three-phase migration, each its own commit:

### Phase A — Land the schema (additive)
- Mount yoga at `/api/v1/uim/graphql/v2` (separate path).
- Existing `/api/v1/uim/graphql` keeps serving the shim.
- 3 legacy fields ship in v2 with identical responses verified by
  shared response-equality tests.

### Phase B — Cutover
- Frontend hooks + ops dashboards migrate from `/v2` to the main
  path one PR at a time.
- After all callers migrate (audit via grep), the shim route swaps
  to a redirect: `POST /api/v1/uim/graphql → POST /api/v1/uim/graphql/v2`.

### Phase C — Cleanup
- Delete `services/uim-api/src/routes/graphql.routes.ts` (the
  shim).
- Rename `/v2` back to `/` — yoga handler becomes the canonical
  path.
- Update integration-contracts registry + connector manifests.

Phase A is the only one that adds capability; B and C are pure
consolidation. A frontend rollback at any point is a one-line
config flag.

---

## 10. Observability + safety

Yoga plugins enabled in v1:

- **`useDeferStream`** — supports `@defer/@stream` so big
  aggregations can stream incrementally.
- **`useDepthLimit({ maxDepth: 10 })`** — blocks pathological
  nested queries.
- **`useCostLimit({ maxCost: 5000 })`** — per-field cost weights
  prevent the dreaded `inventoryItems(first: 1000) { reservations { ledger { reservation { ... } } } }` 
  abuse pattern.
- **OpenTelemetry tracing** via the existing `correlation-id`
  middleware — every resolver inherits the request's
  correlation_id; spans emit to the same Grafana board as REST
  routes.

**Authz cost**: Pothos's
`@pothos/plugin-validation` plugin enforces the tenant-scope
ESLint rule at runtime as a fallback — wraps every resolver in a
`if (!ctx.tenantId) throw new GraphQLError('UNAUTHORIZED')`.

---

## 11. Rollout slices

Each slice ≤ 400 LOC, builds clean, and ships independently:

| # | Slice | LOC est | Risk |
|---|---|---|---|
| 8.1 | Yoga + Pothos scaffold + 3 legacy fields at `/v2` | ~250 | Low — no functional change, additive route |
| 8.2 | InventoryItem connection + DataLoader + catalogItem cross-field | ~280 | Low — read-only, tenant-scoped |
| 8.3 | Reservation + LedgerEntry connections + activeReservations / recentLedger cross-fields | ~250 | Low |
| 8.4 | Aggregation queries: availabilityByPartNumber, availableQuantityByLocation | ~200 | Med — multi-table joins, perf-sensitive |
| 8.5 | Integration health: integrations / integration / webhookDlqRetryable | ~180 | Low — wraps existing REST data |
| 8.6 | Cutover frontend hooks + ops dashboards to `/v2` (per-caller PRs) | ~150 each | Low |
| 8.7 | Cleanup: delete shim, rename `/v2` → `/`, update contracts | ~80 | Low — coordinated with 8.6 completion |

Total Step 8 scope: ~7 slices, ~1,500 LOC, 1-2 weeks of autonomous
development.

---

## 12. Acceptance criteria (Step 8 specifically)

- [ ] `services/uim-api/src/graphql/` exists with Pothos schema builder + yoga server mount.
- [ ] POST `/api/v1/uim/graphql` serves the new schema (shim deleted).
- [ ] Introspection works: `query { __schema { types { name } } }` returns the type list.
- [ ] The 3 legacy 4b.10 fields ship with byte-identical responses (response-equality tests pass).
- [ ] New cross-entity queries (e.g., inventory item → catalog item → MRO profile fields) execute with N+1 protection (≤ 1 SQL per loader per request, verified in tests).
- [ ] Aggregation queries (`availabilityByPartNumber`) match REST `/api/v1/uim/integrations/external-mro-pipeline?part_numbers=...` field-by-field.
- [ ] Tenant scoping enforced on every resolver (ESLint rule + runtime check + integration test with two tenants asserting zero cross-leak).
- [ ] Depth + cost limits documented and enforced.
- [ ] Integration-contracts registry advertises the same path with `type: 'subgraph'`.
- [ ] Connector-manifests `fields` list updated to match the new schema.
- [ ] All slices land via the standard ship pattern (commit + push + build clean + memory update).

---

## 13. Open questions for review

1. **`@defer/@stream` exposure**: yoga supports it; do we want it
   in v1, or wait until a frontend actually asks?
   → Recommend wait. Adds spec-version complexity; nobody is asking.

2. **Persisted queries**: yoga + Apollo Client / urql have a
   well-known persisted-query plugin. Reduces client→server
   payload by ~90% for hot queries. Want it in v1?
   → Recommend skip for v1; revisit if we see >100KB query strings
   in production logs.

3. **JSON scalar**: `attributes: JSON` and `metadata: JSON` punt
   on schema-ifying our existing JSONB columns. Should we instead
   declare typed sub-objects (`MroProfile`, `ReservationMetadata`)?
   → Recommend JSON in v1, typed sub-objects in v2 when we have
   real client demand for autocomplete on those fields.

4. **Should mutations follow later?** §9.2 said REST owns
   mutations. But once we have a working subgraph, the
   "single round-trip for read+write" GraphQL pattern is tempting
   for the inventory commands surface (`receive`, `move`, `reserve`,
   `consume` — all currently REST).
   → Recommend stay REST for v1 + v2. Revisit at 6 months. The
   command pattern's idempotency key envelope (see 4b.8) is
   awkward to express in GraphQL.

---

## 14. Estimated effort + sequencing

- Step 8 spec is **independent** of Steps 7 and 9.
- Step 7 (first external connector) blocks Phase 7 close-out;
  Step 8 doesn't.
- **Recommend sequencing**: 8.1 → 8.2 → 8.3 in parallel with Step
  7 design. 8.4-8.7 after Step 7 ships.
- Total wall-clock: ~2 weeks for Step 8 with 1 person + autonomous
  slices.

---

## 14a. Callsite audit (2026-06-03)

Ran `grep -rn '/api/v1/uim/graphql\|/api/v2/uim/graphql\|uimProjectionItems\|uimInventoryItem\|uimHealth\|UIM_GRAPHQL_PATH'` across the repo excluding `node_modules`, `dist`, and the worktrees.

**Result: zero production callers.** Every match is server-side:

- `services/uim-api/src/routes/graphql.routes.ts` — the 4b.10 shim itself.
- `services/uim-api/src/routes/graphql-v2.routes.ts` — the new yoga mount.
- `services/uim-api/src/routes/contracts.routes.ts` — advertises the path in the integration-contracts registry.
- `src/pages/api/v2/uim/graphql.ts` + `.test.ts` — legacy Next-API-style route, part of the documented shadow tree, removal scheduled separately.

**Implications for Phase B (cutover):**

- There are no frontend hooks, no admin dashboards, no external connector code currently calling the GraphQL endpoint.
- The per-caller PR sequence in §9 (Phase B) is effectively a no-op.
- We can collapse Phase B into Phase C and ship the shim removal as one slice (8.7).

This is good news — the only cost of the migration is updating one path constant in `contracts.routes.ts` from `/api/v1/uim/graphql` to the new path. No client-side rollout coordination needed.

---

## 15. References

- Pothos docs: https://pothos-graphql.dev/docs
- graphql-yoga: https://the-guild.dev/graphql/yoga-server
- Master plan: `docs/plans/2026-05-28-modules/uim.md` §9.2
- Current shim: `services/uim-api/src/routes/graphql.routes.ts` (commit `68561051`)
- Integration contracts registry: `services/uim-api/src/routes/contracts.routes.ts`
