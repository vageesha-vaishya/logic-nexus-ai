# Broker → Portfolio Routing (m:n)

**Status:** Design — ready for implementation
**Date:** 2026-05-26
**Author:** brainstorm session, multi-broker thread

## Context

The `markets.broker_portfolio_links` join table was added on 2026-05-21
(`20260521163344_broker_portfolio_links_and_holdings_source.sql`) with a
backfill that copies the existing 1:1 `broker_connections.portfolio_id`
mapping into the new structure. The schema supports weighted partitioning
and JSON `sync_filter`, but **no code reads from it yet** — the worker
still routes holdings using the connection's single `portfolio_id`. This
design activates the join table for the most common user need: routing
holdings from one broker into different portfolios by segment.

Today's gap, told concretely: a user with **ICICI Direct (Breeze API)**
who wants their equity book in a "Core" portfolio and their F&O book in
an "Experimental" portfolio has to either pick one and ignore the other,
or run two ICICI connections (which Breeze doesn't allow). The schema
already has the right shape — we just need to wire UI + worker.

## Decision summary

- **Additive** over the existing 1:1 default; `broker_connections.portfolio_id`
  remains the catch-all destination.
- **Override rules** live in `broker_portfolio_links`, keyed on
  `sync_filter.segments[]` for v1.
- **Edit surface** is on the broker-connection card; the portfolio page
  will eventually show inbound routing read-only (out of v1 scope).
- **Filter dimension**: segment only (`equity / fno / currency / commodity / mf`)
  — covers ~95% of split cases. Asset-class and symbol-list filters are
  deferred.
- **Weight stays at 1.0** for v1. The schema supports fractional weights
  but partial-quantity allocation is exotic and gets no UI now.
- **Holdings only**. Positions, orders, GTTs stay scoped per-connection;
  trade execution remains 1:1.

## Architecture

### Order of evaluation at sync time

Per holding from the broker SDK:

1. Compute the holding's segment from its `exchange`:
   `NSE/BSE → equity`, `NFO/BFO → fno`, `CDS/BCD → currency`,
   `MCX → commodity`, else `other`.
2. Walk the user's `broker_portfolio_links` rows for this
   `broker_connection_id`; pick the first whose
   `sync_filter["segments"]` contains the holding's segment.
3. If a link matched → route to `link.portfolio_id`.
4. Else → route to `broker_connections.portfolio_id` (the default).
5. If both are unset → drop the holding, log
   `broker_sync.holding_unrouted`.

### Why this shape

- **Zero migration cost.** Existing connections see no behaviour change
  on day one. The override path activates only when the user explicitly
  creates a rule.
- **Schema-aligned.** The 2026-05-21 migration's docstring already
  describes this contract:
  > "broker_connections.portfolio_id remains the default destination for
  > backward compatibility."
- **Holdings-only scope** dovetails with the holdings unique key
  (`portfolio_id, broker_connection_id, instrument_id`) added in
  `20260526105027_holdings_multibroker_unique` — one connection can write
  to multiple portfolios without clobber, and each `(portfolio, connection,
  symbol)` triple has its own row.

## UI: "Routing rules" sheet

Each connected-broker card on `/dashboard/markets/settings/brokers` gains
one inline action — **`Routing →`** — next to the existing
*View Portfolio · Broker Data · sync · disconnect* row.

Tapping it opens a right-side `Sheet` (same pattern as ConnectSheet),
titled `Routing rules — {display_name}`. Body has three regions:

### 1. Default destination

A `Select` at the top showing the user's portfolios with the connection's
current `broker_connections.portfolio_id` selected. Editable inline —
saving immediately writes back. Hint copy:

> *"Holdings that don't match a specific rule go here."*

Editing the default was previously impossible after connect time — this
surface unblocks it as a side benefit.

### 2. Override rules list

Zero or more rows, each `[segment chips] → [portfolio name]   [✕ remove]`.
Rows are read-only labels; editing a rule = delete + re-add (keeps the
UI shallow). Empty state copy:

> *"No overrides. All holdings from this broker land in the default
> portfolio above."*

### 3. Add rule (inline form)

- **Segments**: multi-select chips of the connection's `supports` array
  (e.g. `equity / fno / currency / commodity / mf`). User-friendly
  labels; translated to filter keys at write time.
- **Destination portfolio**: `Select` with the user's portfolios plus
  "Create new portfolio…" (parity with ConnectSheet's portfolio binding).
- **Save** writes a `broker_portfolio_links` row:
  ```json
  {
    "broker_connection_id": "...",
    "portfolio_id":         "...",
    "owner_user_id":        "...",
    "tenant_id":            "...",
    "franchise_id":         "...",
    "sync_filter":          { "segments": ["fno"] },
    "weight":               1.0,
    "is_active":            true
  }
  ```
- **Segment-conflict block**: if an active link for this connection
  already includes any of the chosen segments, the Save button is
  disabled and a warning chip says
  *"equity is already routed via another rule. Remove that one first."*
- **After save**, trigger a sync for this connection so the new routing
  takes effect immediately.

### Worked example — ICICI Direct (Breeze)

1. User connects ICICI Direct → connect flow sets `portfolio_id = Core`
   by default (existing behaviour).
2. User wants F&O isolated. Opens `Routing →` on the ICICI card.
3. Adds rule: `segments: [fno]` → `Experimental portfolio`.
4. Sync fires automatically.
5. ICICI's NSE/BSE equities continue to land in Core; ICICI's NFO
   contracts now land in Experimental. Positions, orders, GTTs still
   show under the single ICICI connection.

## Worker: `broker_sync.py` changes

### Load routing config (once per sync)

```python
links = (
    db.schema("markets").from_("broker_portfolio_links")
    .select("portfolio_id, sync_filter")
    .eq("broker_connection_id", conn_id)
    .eq("is_active", True)
    .execute()
).data or []
default_portfolio_id = row["portfolio_id"]  # may be None
```

Typical N for `links` is 0–3 per broker; the in-memory pass is cheap and
keeps the inner loop free of DB calls.

### New helper

```python
def _segment_for(exchange: str) -> str:
    exch = (exchange or "").upper()
    if exch in ("NSE", "BSE"):           return "equity"
    if exch in ("NFO", "BFO"):           return "fno"
    if exch in ("CDS", "BCD"):           return "currency"
    if exch in ("MCX",):                 return "commodity"
    if exch in ("MF", "AMFI"):           return "mf"
    return "other"
```

### Per-holding routing

```python
def _route(h: Holding, links, default_pid) -> str | None:
    seg = _segment_for(h.exchange)
    for L in links:
        if seg in (L["sync_filter"] or {}).get("segments", []):
            return L["portfolio_id"]
    return default_pid
```

### Group + upsert

Group `holdings` by `target_pid`, then call `_upsert_holdings` once per
group. The existing partial unique index
`holdings_broker_scoped_uniq (portfolio_id, broker_connection_id,
instrument_id) WHERE broker_connection_id IS NOT NULL` already accommodates
one connection writing to N portfolios. No schema change.

### Stranded-rows cleanup

Before per-portfolio upserts:

```python
target_pids = {pid for pid in groups.keys() if pid is not None}
if target_pids:
    db.schema("markets").from_("holdings").delete() \
        .eq("broker_connection_id", conn_id) \
        .not_.in_("portfolio_id", list(target_pids)) \
        .execute()
```

This removes rows previously written by this connection into portfolios
that are no longer routing targets. Scoped strictly to this connection's
broker-sourced rows; manual rows (`broker_connection_id IS NULL`) are
untouched.

### Unchanged

`_upsert_positions`, `_upsert_orders`, GTT, token refresh — all stay
exactly as today.

## Edge cases + invariants

- **No matching rule AND no default**: drop the holding, log
  `broker_sync.holding_unrouted` with symbol + segment. Becomes
  observable when a user deletes the destination portfolio of an
  exclusive routing setup.
- **Two active rules claim the same segment**: blocked by UI; if it
  happens via DB-direct edit / race, first-by-row-order wins,
  `broker_sync.rule_conflict` logged. No silent fix.
- **Destination portfolio deleted**: `broker_portfolio_links.portfolio_id`
  has `ON DELETE CASCADE` — the link disappears. Holdings in that
  portfolio CASCADE too. The connection's default `portfolio_id` is
  `ON DELETE SET NULL` so the connection survives as "no default".
- **Connection deleted**: existing `remove_connection` flow handles
  holdings/positions/orders/GTTs; the join table CASCADEs on
  `broker_connection_id`.
- **Concurrency**: user saves a routing change during an in-flight sync
  — accept eventual consistency. The post-save sync trigger queues a
  fresh job and the next run reconciles. No advisory locks for v1.

## Testing

### JS (vitest) — UI
- `RoutingRulesSheet.test.tsx` — render with 0/N rules, Add-rule form,
  segment-conflict block, remove-rule confirmation, default-portfolio
  switch. Mock `useBrokerConnections`, `usePortfolios`, new
  `useBrokerPortfolioLinks(connectionId)` hook. ~8 cases.
- `useBrokerPortfolioLinks.test.ts` — list/create/delete + cache
  invalidation. ~4 cases.

### Python (pytest) — worker routing
- `test_broker_sync_routing.py`, mirroring
  `test_holdings_multibroker_upsert.py`'s mocking pattern:
  - Equity holding with `{fno → p2}` link routes to default, not p2.
  - F&O holding with same link routes to p2.
  - No default + no match: holding dropped, `holding_unrouted` logged.
  - Stranded-rows cleanup: pre-existing rows in a portfolio no longer in
    the routing set are deleted.
  - Conflict (two links cover same segment): first-by-row-order wins,
    `rule_conflict` logged.
- ~6 cases.

### SQL (`supabase/tests/markets_multibroker_rls.sql`)
- T7: `broker_portfolio_links` cross-user isolation (already true per
  existing owner_select; assert anyway).
- T8: admin SELECT bypass on `broker_portfolio_links` (already shipped
  in `20260526105155`; assert).
- T9: re-sync writes correct rows per partial unique index — no
  duplicates for `(portfolio_id, broker_connection_id, instrument_id)`.
- Total grows to ~13.

### Manual smoke
On the Sthira APK against prod:
1. Connect ICICI Direct, default = Core.
2. Open `Routing →`, add rule `fno → Experimental`, save.
3. Verify auto-sync fires.
4. Open Portfolio detail for Core — expect NSE equities only.
5. Open Portfolio detail for Experimental — expect NFO contracts only.
6. Remove the rule, re-sync. Verify NFO rows vacate Experimental and
   reappear in Core.

## Out of scope (v1)

- **Fractional weights** (`weight < 1.0` partitioning) — schema-supported
  but no UI. Future: "50% of RELIANCE qty goes to Core, 50% to
  Experimental" for accounting/attribution.
- **Symbol-list filter** (`sync_filter.symbols`) — exotic.
- **Asset-class filter** beyond segments — equity ⊃ NSE+BSE is already
  covered by the segment chip `equity`.
- **Portfolio-page inbound view** — read-only list of "this portfolio
  receives X from Broker Y, Z from Broker W". Useful, but the edit
  surface is on the connection so view is non-blocking.
- **Order routing** — "send BUY orders for symbol X via the broker
  routed to portfolio Y". Tracked separately; not part of holdings
  routing.

## Migration / rollout

No schema migration required — the join table and the partial unique
index are already live in prod (applied 2026-05-26). The change is pure
code:

1. New worker logic deployed via Coolify (`markets-worker`).
2. New web UI deployed via Coolify (`frontend`).
3. New mobile shell rebuilt + re-installed via `npm run mobile:build:markets`.

Rollback: disable the new "Routing →" entry on connection cards (one
prop on the action row) and revert `broker_sync.py` to ignoring
`broker_portfolio_links`. The existing 1:1 contract via
`broker_connections.portfolio_id` remains correct, so rollback is
non-destructive.
