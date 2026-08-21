# Charge Breakdown Granularity for Non-AI Quotes - Design Specification

**Date:** 2026-08-21
**Scope:** Give rate-engine-sourced (non-AI, non-simulated-client-side) quotes the same real charge-category detail AI-smart-mode quotes already have, instead of one generic "Base Freight" line wrapping the flat total.
**Status:** Approved for implementation

## 1. Background

Item 1 of the user's original six-item Smart Quote request:

> "1- in smart quote module I need complete breakup of charges f each transport leg with all charges category"

Investigation (verified directly against source, not assumed):

- `src/components/quotation/common/ChargeBreakdown.tsx` already exists and is fully-featured: per-leg + global charge grouping, list/grouped views, search/filter/sort, Excel export, print, edit/delete/add-charge hooks. It is rendered from `QuoteDetailView.tsx` (the "Details" dialog, itself reached from `SmartQuoteRateCard`) and `FinalizeSection.tsx` (the composer's finalize step). **The display component is not the gap.**
- The real gap is upstream, in two places:
  1. **`supabase/functions/rate-engine/index.ts`** (the Edge Function real quotes come from) computes a genuinely detailed 5-line `charge_breakdown` — `Base Freight` (80%), `Bunker Adjustment Factor` (10%), `Currency Adjustment Factor` (5%), `Terminal Handling Charges` (5%), `Documentation Fee` (flat $50) — but **only for its DB-backed path** (real `carrier_rates` rows). Its simulation/fallback path (used whenever fewer than 10 real rates exist for a lane, which is the common case) generates a flat `price` with no `charge_breakdown` at all.
  2. **`src/lib/quote-mapper.ts`'s `mapOptionToQuote`** — the client-side function every rate option passes through before reaching the UI — **never reads `charge_breakdown` at all**. Its `RateOption`/mapping logic only looks for `.charges`, `.legs`, or `.price_breakdown`, none of which `rate-engine` sets. So even when the Edge Function computes real per-component detail, the client silently discards it, falls through to its own synthesis logic, and produces exactly one generic `{category: 'Freight', name: 'Base Freight', amount: <the whole total>}` line, wrapped in one synthesized leg (`quote-mapper.ts:278-287`).
- AI-smart-mode quotes don't have this problem: the `ai-advisor` function's prompt (`useAiAdvisor.ts`) explicitly instructs the LLM to return real per-leg charges, and `mapOptionToQuote` already handles that shape correctly (`normalized.legs[].charges`, read at `quote-mapper.ts:202-219` and `:289+`).
- This is a **client + server** gap, confirmed by reading both sides directly — not a guess.

## 2. Goals / Non-Goals

**Goals:**
- Real DB-backed rate-engine quotes show their true 5-component charge breakdown in the UI (already-existing `ChargeBreakdown` component), instead of one generic line.
- Simulated/fallback rate-engine quotes (the common case — no exact `carrier_rates` match) also get a comparable breakdown, computed the same way the real-rate path already does it, instead of no breakdown at all.
- No change to the AI-smart-mode path — it already works correctly.
- No change to `ChargeBreakdown.tsx`, `QuoteDetailView.tsx`, or `FinalizeSection.tsx` — they already render whatever `legs[].charges` they're given correctly; the fix is purely about what data reaches them.

**Non-Goals:**
- Not attempting true multi-leg (pickup/main-carriage/delivery) structure for rate-engine quotes — `rate-engine` has no door-to-door leg concept today (it prices port-to-port or point-to-point as a single movement), and inventing one would require real routing logic, not just reading an existing field. This spec produces one leg with 5 real charge-component lines, not multiple legs. A future spec could pursue real multi-leg pricing if wanted.
- Not touching `useAiAdvisor.ts`'s mock-fallback data, `generateSimulatedRates` (the separate, purely-client-side simulation engine used when `rate-engine` itself is unreachable), or the two Edge Function bugs found while debugging the map feature (invalid OpenAI key, unimplemented `validate_carrier_service_availability` action) — those are tracked separately.
- Not changing `carrier_rates`' actual stored data or margin-rule logic — only how the breakdown is computed/read.

## 3. Architecture

```
Client-side fix (src/lib/quote-mapper.ts):

  rate-engine option arrives with charge_breakdown: [{code,name,amount,currency}, ...]
        ↓ (NEW: read charge_breakdown before falling into the generic single-line synthesis)
  mapOptionToQuote maps each charge_breakdown item -> Charge{category, name, amount, currency,
        rate_reference: code}, category derived from a small code->category table
        (BAS->Freight, BAF/CAF->Surcharge, THC/DOC->Fee — matching the category vocabulary
        ChargeBreakdown.tsx and the existing price_breakdown-derived synthesis already use)
        ↓
  wrapped into the existing single generated-leg (unchanged leg-synthesis mechanism —
  this spec adds real content to that leg's charges, not a new leg)
        ↓
  ChargeBreakdown.tsx renders it — no changes needed there, it already groups by category

Server-side fix (supabase/functions/rate-engine/index.ts):

  Simulation/fallback path (used when < 10 real carrier_rates matches exist for a lane)
        ↓ (NEW: compute the same 5-line breakdown the DB-backed path already computes,
           applied to simulatedPrice instead of the real carrier_rates total_amount)
  RateOption.charge_breakdown populated for simulated options too
        ↓
  Flows through the same client-side fix above
```

## 4. Components

### Modified
- `src/lib/quote-mapper.ts` — in `mapOptionToQuote`, before the existing "no charges, no legs → synthesize from `price_breakdown`" fallback (`:254-273`), add a check: if `opt.charge_breakdown` is a non-empty array, map it directly to `Charge[]` and use that instead of the generic single-line synthesis. Category mapping table:
  | Code | Category |
  |---|---|
  | `BAS` | `Freight` |
  | `BAF` | `Surcharge` |
  | `CAF` | `Surcharge` |
  | `THC` | `Fee` |
  | `DOC` | `Fee` |
  | *(unrecognized code)* | `General` (fallback, matching the existing default elsewhere in this file) |
- `supabase/functions/rate-engine/index.ts` — in the simulation/fallback loop (`:246-291`), compute a `breakdown` array analogous to the DB-backed path's (`:174-180`), scaled to `simulatedPrice` instead of `price`, and set it on the pushed `RateOption` as `charge_breakdown`. Requires redeploying this Edge Function to the `gzhxgoigflftharcmdqj` (SG-Logistics-Pro-Enterprise) Supabase project — **explicit deploy confirmation required before that step, separate from this spec's approval.**

### Untouched
- `src/components/quotation/common/ChargeBreakdown.tsx`, `QuoteDetailView.tsx`, `FinalizeSection.tsx` — already correct, no changes.
- `useAiAdvisor.ts`, `generateSimulatedRates` (client-side simulation engine), `useRateFetching.ts`'s `enrichOptionRouteData` — untouched; this spec's fix happens entirely inside `mapOptionToQuote`, which `enrichOptionRouteData` already calls (`enrichOptionRouteData(mapOptionToQuote(opt), routeContext)`), so no change to that call site is needed.
- The `carrier_rates` DB-backed path's own breakdown computation (`rate-engine/index.ts:174-180`) — already correct, just needs the client to actually read it. Left as-is except for extracting it into a small shared helper the simulation path also calls (see §5), to avoid duplicating the same 5-line percentage split twice.

## 5. Implementation note (avoiding duplication)

`rate-engine/index.ts` currently inlines the 5-line breakdown computation once (DB-backed path). Rather than copy-pasting it a second time for the simulation path, extract it into one small local function, e.g. `buildChargeBreakdown(totalPrice: number): RateOption['charge_breakdown']`, called from both places with the appropriate price. Same output shape, same percentages, single source of truth within the function file.

## 6. Data Flow / Error Handling

No new error states. If `opt.charge_breakdown` is missing, malformed, or empty (e.g. an older cached response, or a future non-rate-engine source that doesn't set it), `mapOptionToQuote` falls through to its existing generic single-line synthesis exactly as it does today — this is strictly additive, not a replacement of the existing fallback.

## 7. Testing

- `quote-mapper.ts`: new unit tests confirming `charge_breakdown` is correctly mapped to `Charge[]` with the right category per code, that the existing generic-fallback behavior is unchanged when `charge_breakdown` is absent/empty, and that AI-smart-mode options (which already set `legs[].charges` directly) are unaffected by this change (the new logic only triggers in the same branch where charges/legs were both previously absent).
- `rate-engine/index.ts`: this Edge Function has no existing local test suite (checked — `supabase/functions/rate-engine/` has no `*.test.ts`); verification for the server-side change will be a manual invocation check (confirm a simulated-fallback response now includes `charge_breakdown`) plus the existing DB-backed path continuing to work unchanged, before and after deployment.
- Manual/visual check: generate a quote for a lane with no real `carrier_rates` match (forcing the simulation path) and confirm the Details dialog's Cost Analysis tab now shows 5 real line items instead of one.

## 8. Rollout

Two independent commits: the client-side fix ships immediately (no deploy risk, pure logic change, covered by unit tests). The server-side Edge Function change requires an explicit, separately-confirmed deploy step to `gzhxgoigflftharcmdqj` before it takes effect in production — the client-side fix alone already fixes real DB-backed rates; the deploy only extends the improvement to the simulated/fallback path.
