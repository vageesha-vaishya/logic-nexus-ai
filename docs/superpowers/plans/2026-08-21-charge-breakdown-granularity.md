# Charge Breakdown Granularity for Non-AI Quotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give rate-engine-sourced (non-AI) quotes the real charge-category detail they already have on the server but currently lose on the client, and extend that same detail to the simulated/fallback rate path.

**Architecture:** `rate-engine`'s DB-backed path already computes a 5-line `charge_breakdown` (Base Freight/BAF/CAF/THC/Documentation) but its response is silently discarded by `mapOptionToQuote`, which only reads `.charges`/`.legs`/`.price_breakdown`. Fix the client to read `charge_breakdown` when present, mapping it to real `Charge[]` instead of one generic line. Separately, extract the DB-backed path's breakdown computation into a small shared helper inside the Edge Function and reuse it for the simulation/fallback path too, so simulated quotes (the common case when no exact carrier rate exists) get the same detail once redeployed.

**Tech Stack:** Plain TypeScript, no new dependencies. `mapOptionToQuote` is a pure function (`src/lib/quote-mapper.ts`) with an existing test suite (`src/lib/__tests__/quote-mapper.test.ts`, 15 tests, no mocking needed). The Edge Function (`supabase/functions/rate-engine/index.ts`) has no local test harness — verification there is a careful code trace plus a post-deploy manual check, not automated tests.

**Design spec:** `docs/superpowers/specs/2026-08-21-charge-breakdown-granularity-design.md` — read it once for full rationale; this plan does not repeat the "why," only the "what" and "how."

## Global Constraints

- `mapOptionToQuote`'s existing behavior when `charge_breakdown` is absent must be completely unchanged — the new code path is additive, gated behind `Array.isArray(normalized.charge_breakdown) && normalized.charge_breakdown.length > 0`, never replacing the existing `price_breakdown`-derived synthesis for options that don't have it.
- AI-smart-mode options must be provably unaffected: they already populate `normalized.legs[].charges` directly, which short-circuits the entire fallback block (the `if` gate at `quote-mapper.ts:254` requires both "no charges" AND "no legs with charges" to be true) before either the new or old fallback logic ever runs.
- Category strings for the new mapping (`Freight`, `Surcharge`, `Fee`) must match the existing vocabulary already used by the `price_breakdown`-derived synthesis in the same function (`quote-mapper.ts:258-271`) — do not invent new category names `ChargeBreakdown.tsx` doesn't already group by.
- The Edge Function change must preserve the DB-backed path's exact existing behavior (same percentages, same rounding, same "total = sum of breakdown lines" self-consistency) — the refactor extracts a helper, it does not change what the DB-backed path computes or returns.
- The simulation path's final `price` must be recalculated from its own breakdown's sum (mirroring exactly how the DB-backed path already does this — see design spec §5 note and Task 2 below), not left as the pre-breakdown `simulatedPrice` — otherwise the option's displayed total and its own Charge Breakdown table would silently disagree.
- **Task 2 does not deploy anything.** It only changes and commits the local Edge Function source. Deploying `rate-engine` to the `gzhxgoigflftharcmdqj` (SG-Logistics-Pro-Enterprise) Supabase project is a separate, explicitly-confirmed step the controller performs after this plan's branch is reviewed and merged — never something a task implementer or this plan's execution does automatically.
- Run `npm run typecheck` and the relevant `npx vitest run <path>` after Task 1 before committing. Task 2 has no automated test command to run (see Testing section of the design spec) — its verification is a careful self-review trace, documented in the report.

---

### Task 1: Read `charge_breakdown` in `mapOptionToQuote`

**Files:**
- Modify: `src/lib/quote-mapper.ts`
- Modify: `src/lib/__tests__/quote-mapper.test.ts`

**Interfaces:**
- No new exports — `mapOptionToQuote`'s signature and existing behavior for every current input shape are unchanged; this task only adds a new input shape it now handles (`opt.charge_breakdown` present).
- Consumed by: `useRateFetching.ts`'s `enrichOptionRouteData` (already calls `mapOptionToQuote(opt)` — no change needed there) and, transitively, `FinalizeSection.tsx`'s `useChargesManager` (already seeds from `selectedOption.legs` for new quotes — no change needed there either; verified during spec review, not assumed).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/__tests__/quote-mapper.test.ts` (append inside the existing `describe('mapOptionToQuote', ...)` block, alongside the 15 existing tests):

```ts
  it('maps rate-engine charge_breakdown to real per-category charges instead of one generic line', () => {
    const result = mapOptionToQuote({
      id: 'r1',
      carrier: 'Maersk',
      total_amount: 4900, // 3880 + 485 + 242.5 + 242.5 + 50 — consistent with the breakdown below
      currency: 'USD',
      origin: 'CNSHA',
      destination: 'USLAX',
      mode: 'ocean',
      charge_breakdown: [
        { code: 'BAS', name: 'Base Freight', amount: 3880, currency: 'USD' },
        { code: 'BAF', name: 'Bunker Adjustment Factor', amount: 485, currency: 'USD' },
        { code: 'CAF', name: 'Currency Adjustment Factor', amount: 242.5, currency: 'USD' },
        { code: 'THC', name: 'Terminal Handling Charges', amount: 242.5, currency: 'USD' },
        { code: 'DOC', name: 'Documentation Fee', amount: 50, currency: 'USD' },
      ],
    });

    expect(result.legs).toHaveLength(1);
    const charges = result.legs[0].charges;
    expect(charges).toHaveLength(5);
    expect(charges.map((c: any) => c.category)).toEqual(['Freight', 'Surcharge', 'Surcharge', 'Fee', 'Fee']);
    expect(charges.map((c: any) => c.amount)).toEqual([3880, 485, 242.5, 242.5, 50]);
    expect(charges.map((c: any) => c.rate_reference)).toEqual(['BAS', 'BAF', 'CAF', 'THC', 'DOC']);
    expect(charges[0].name).toBe('Base Freight');
  });

  it('falls back to an unrecognized-code default category for a charge_breakdown code it does not know', () => {
    const result = mapOptionToQuote({
      id: 'r2',
      total_amount: 100,
      currency: 'USD',
      charge_breakdown: [{ code: 'XYZ', name: 'Mystery Fee', amount: 100, currency: 'USD' }],
    });
    expect(result.legs[0].charges[0].category).toBe('General');
  });

  it('ignores an empty charge_breakdown array and falls back to the existing price_breakdown synthesis unchanged', () => {
    const result = mapOptionToQuote({
      id: 'r3',
      total_amount: 1000,
      currency: 'USD',
      charge_breakdown: [],
    });
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0].charges).toHaveLength(1);
    expect(result.legs[0].charges[0].name).toBe('Base Freight');
    expect(result.legs[0].charges[0].amount).toBe(1000);
  });

  it('does not use charge_breakdown when the option already has real per-leg charges (AI-smart-mode shape)', () => {
    const result = mapOptionToQuote({
      id: 'r4',
      total_amount: 2000,
      currency: 'USD',
      // Deliberately includes a charge_breakdown alongside real legs, to prove legs win —
      // this shape shouldn't occur in practice (AI options don't set charge_breakdown), but
      // it pins down that the existing "legs already has charges" short-circuit still governs.
      charge_breakdown: [{ code: 'BAS', name: 'Should Not Be Used', amount: 2000, currency: 'USD' }],
      legs: [
        { id: 'leg-1', mode: 'ocean', origin: 'A', destination: 'B', charges: [{ category: 'Freight', name: 'Real AI Charge', amount: 2000, currency: 'USD' }] },
      ],
    });
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0].charges).toHaveLength(1);
    expect(result.legs[0].charges[0].name).toBe('Real AI Charge');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/quote-mapper.test.ts`
Expected: FAIL — the first two new tests fail (charges come back as one generic "Base Freight" line, not 5 real ones; unrecognized-code test has nothing to assert against). The third and fourth new tests may already PASS (they assert today's existing behavior) — that's fine, they're regression pins, not required to fail first.

- [ ] **Step 3: Implement the fix**

In `src/lib/quote-mapper.ts`, add a module-level constant after the existing import (before `export const mapOptionToQuote = ...`):

```ts
import { matchLegForCharge } from '@/lib/charge-bifurcation';

const CHARGE_BREAKDOWN_CATEGORY: Record<string, string> = {
    BAS: 'Freight',
    BAF: 'Surcharge',
    CAF: 'Surcharge',
    THC: 'Fee',
    DOC: 'Fee',
};

export const mapOptionToQuote = (opt: any) => {
```

Then replace the existing fallback block (currently lines 254-273 — verify against the live file before editing, since Task numbers/line numbers can drift; match by content, not just line number):

```ts
    if ((!normalized.charges || normalized.charges.length === 0) && (!normalized.legs || !normalized.legs.some((l: any) => l.charges && l.charges.length > 0))) {
        const currency = price_breakdown.currency || normalized.currency || 'USD';
        
        if (price_breakdown.base_fare > 0) {
            charges = [...charges, { category: 'Freight', name: 'Base Freight', amount: price_breakdown.base_fare, currency, unit: 'per_shipment', note: 'Base Freight' }];
        }
        if (price_breakdown.taxes > 0) {
            charges = [...charges, { category: 'Tax', name: 'Taxes & Duties', amount: price_breakdown.taxes, currency, unit: 'per_shipment', note: 'Taxes & Duties' }];
        }
        if (price_breakdown.surcharges) {
            Object.entries(price_breakdown.surcharges).forEach(([key, val]: any) => {
                if (val > 0) charges = [...charges, { category: 'Surcharge', name: key, amount: val, currency, unit: 'per_shipment', note: key }];
            });
        }
        if (price_breakdown.fees) {
            Object.entries(price_breakdown.fees).forEach(([key, val]: any) => {
                if (val > 0) charges = [...charges, { category: 'Fee', name: key, amount: val, currency, unit: 'per_shipment', note: key }];
            });
        }
    }
```

with:

```ts
    if ((!normalized.charges || normalized.charges.length === 0) && (!normalized.legs || !normalized.legs.some((l: any) => l.charges && l.charges.length > 0))) {
        const currency = price_breakdown.currency || normalized.currency || 'USD';

        const rawBreakdown = Array.isArray(normalized.charge_breakdown) ? normalized.charge_breakdown : [];
        if (rawBreakdown.length > 0) {
            charges = [
                ...charges,
                ...rawBreakdown.map((item: any) => ({
                    category: CHARGE_BREAKDOWN_CATEGORY[item.code] || 'General',
                    name: item.name || item.code || 'Charge',
                    amount: safeNumber(item.amount),
                    currency: item.currency || currency,
                    unit: 'per_shipment',
                    rate_reference: item.code || undefined,
                    note: item.name || item.code || undefined,
                })),
            ];
        } else {
            if (price_breakdown.base_fare > 0) {
                charges = [...charges, { category: 'Freight', name: 'Base Freight', amount: price_breakdown.base_fare, currency, unit: 'per_shipment', note: 'Base Freight' }];
            }
            if (price_breakdown.taxes > 0) {
                charges = [...charges, { category: 'Tax', name: 'Taxes & Duties', amount: price_breakdown.taxes, currency, unit: 'per_shipment', note: 'Taxes & Duties' }];
            }
            if (price_breakdown.surcharges) {
                Object.entries(price_breakdown.surcharges).forEach(([key, val]: any) => {
                    if (val > 0) charges = [...charges, { category: 'Surcharge', name: key, amount: val, currency, unit: 'per_shipment', note: key }];
                });
            }
            if (price_breakdown.fees) {
                Object.entries(price_breakdown.fees).forEach(([key, val]: any) => {
                    if (val > 0) charges = [...charges, { category: 'Fee', name: key, amount: val, currency, unit: 'per_shipment', note: key }];
                });
            }
        }
    }
```

Note `safeNumber` is already defined earlier in this same function body (`quote-mapper.ts:6-13`) — no new import needed, it's already in scope.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/quote-mapper.test.ts`
Expected: PASS (19 tests: 15 pre-existing + 4 new).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/quote-mapper.ts src/lib/__tests__/quote-mapper.test.ts
git commit -m "feat(quotation): read rate-engine's charge_breakdown for real per-category charge detail"
```

---

### Task 2: Extend charge breakdown to `rate-engine`'s simulation path

**Files:**
- Modify: `supabase/functions/rate-engine/index.ts`

**Interfaces:**
- No client-facing interface change — `RateOption.charge_breakdown` (already declared in this file's local `RateOption` interface, line 39-44) is now populated for simulated options too, using the exact same shape the DB-backed path already produces (consumed by Task 1's client-side fix, already committed).
- **This task does not deploy.** It commits a local source change only. See Global Constraints.

- [ ] **Step 1: Extract the shared helper**

In `supabase/functions/rate-engine/index.ts`, add a function after the `CARRIERS` constant (module scope, before the `serveWithLogger(...)` call):

```ts
function buildChargeBreakdown(totalPrice: number): NonNullable<RateOption['charge_breakdown']> {
    return [
        { code: 'BAS', name: 'Base Freight', amount: Math.round(totalPrice * 0.8 * 100) / 100, currency: 'USD' },
        { code: 'BAF', name: 'Bunker Adjustment Factor', amount: Math.round(totalPrice * 0.1 * 100) / 100, currency: 'USD' },
        { code: 'CAF', name: 'Currency Adjustment Factor', amount: Math.round(totalPrice * 0.05 * 100) / 100, currency: 'USD' },
        { code: 'THC', name: 'Terminal Handling Charges', amount: Math.round(totalPrice * 0.05 * 100) / 100, currency: 'USD' },
        { code: 'DOC', name: 'Documentation Fee', amount: 50, currency: 'USD' }
    ];
}
```

- [ ] **Step 2: Use the helper in the DB-backed path (no behavior change)**

Replace the inline breakdown array (currently inside the `rates.forEach((r: any) => { ... })` block):

```ts
                // Detailed Charge Breakdown (Simulated/Calculated)
                const breakdown = [
                    { code: 'BAS', name: 'Base Freight', amount: Math.round(price * 0.8 * 100) / 100, currency: 'USD' },
                    { code: 'BAF', name: 'Bunker Adjustment Factor', amount: Math.round(price * 0.1 * 100) / 100, currency: 'USD' },
                    { code: 'CAF', name: 'Currency Adjustment Factor', amount: Math.round(price * 0.05 * 100) / 100, currency: 'USD' },
                    { code: 'THC', name: 'Terminal Handling Charges', amount: Math.round(price * 0.05 * 100) / 100, currency: 'USD' },
                    { code: 'DOC', name: 'Documentation Fee', amount: 50, currency: 'USD' }
                ];
```

with:

```ts
                // Detailed Charge Breakdown (Simulated/Calculated)
                const breakdown = buildChargeBreakdown(price);
```

Everything after this line (`breakdownTotal`, `finalPrice`, the `options.push(...)` call) stays exactly as-is — this step is a pure extraction, verify by hand-tracing that `buildChargeBreakdown(price)` produces byte-identical output to the array it replaces (same 5 objects, same field order, same rounding expression per field).

- [ ] **Step 3: Populate the breakdown for the simulation/fallback path**

In the `targetCarriers.forEach((carrierName, index) => { ... })` block (the "10+ Options Guarantee" fallback), find:

```ts
            const originalCost = simulatedPrice;

            options.push({
                id: `sim_${mode}_${index}_${Date.now()}`,
                tier: 'market',
                name: `${carrierName} ${isExpress ? 'Express' : 'Standard'}`,
                carrier: carrierName,
                price: Math.round(simulatedPrice * 100) / 100,
                buyPrice: Math.round(originalCost * 100) / 100,
                marginAmount: 0,
                currency: 'USD',
                transitTime: `${simulatedTransit} Days`,
                route_type: routeType,
                stops: stops,
                co2_kg: estimatedCo2,
                validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Valid for 7 days
            });
```

Replace with:

```ts
            const originalCost = simulatedPrice;

            // Real charge breakdown for this simulated option, mirroring the DB-backed path
            // above. The displayed price is recalculated from the breakdown's own sum
            // (percentages of simulatedPrice plus the flat $50 DOC fee) so the option's total
            // always matches what its own Charge Breakdown view shows — exactly the same
            // "total = sum of breakdown lines" rule the DB-backed path already follows.
            const breakdown = buildChargeBreakdown(simulatedPrice);
            const finalSimulatedPrice = breakdown.reduce((sum, item) => sum + item.amount, 0);

            options.push({
                id: `sim_${mode}_${index}_${Date.now()}`,
                tier: 'market',
                name: `${carrierName} ${isExpress ? 'Express' : 'Standard'}`,
                carrier: carrierName,
                price: Math.round(finalSimulatedPrice * 100) / 100,
                buyPrice: Math.round(originalCost * 100) / 100,
                marginAmount: 0,
                currency: 'USD',
                transitTime: `${simulatedTransit} Days`,
                route_type: routeType,
                stops: stops,
                co2_kg: estimatedCo2,
                validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Valid for 7 days
                charge_breakdown: breakdown
            });
```

`buyPrice` is deliberately left reading `originalCost` (the pre-breakdown `simulatedPrice`), unchanged — it represents cost, not the fee-inclusive sell price, matching exactly how the DB-backed path above also keeps `buyPrice` based on the pre-breakdown `originalCost`.

- [ ] **Step 4: Self-review by hand-trace (no automated test harness exists for this file)**

This Edge Function has no local test suite (confirmed during spec-writing: no `*.test.ts` under `supabase/functions/rate-engine/`). Verify correctness by hand-tracing, and record the trace in the report:

1. Pick a sample `basePrice` (e.g. `2800` for a 40ft ocean container) and compute `buildChargeBreakdown(2800)` by hand: `BAS=2240, BAF=280, CAF=140, THC=140, DOC=50`. Sum = `2850`. Confirm this matches what the code produces (read it, don't guess).
2. Confirm the DB-backed path's behavior is provably unchanged: `buildChargeBreakdown(price)` called with the same `price` variable that used to feed the inline array must produce the identical 5 objects in the identical order — this is a pure refactor, not a behavior change.
3. Confirm the simulation path's new `price` field equals `finalSimulatedPrice` (the breakdown sum), not the old pre-breakdown `simulatedPrice` — this is the one actual behavior change in this task, and it's deliberate (see Step 3's comment).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/rate-engine/index.ts
git commit -m "feat(quotation): extend rate-engine's charge breakdown to simulated/fallback rates"
```

Do not deploy. Deployment happens later, as an explicitly-confirmed step outside this plan's execution (see Global Constraints).

---

## Post-Plan

After Task 2, use `superpowers:finishing-a-development-branch` (if working in an isolated worktree/branch per `superpowers:using-git-worktrees`) to run the final whole-branch review and merge/PR flow, per `superpowers:subagent-driven-development`.

**Deployment (separate from branch-finishing):** Once the branch is merged, ask the user to explicitly confirm before deploying the updated `rate-engine` Edge Function to the `gzhxgoigflftharcmdqj` Supabase project. Only after that confirmation, deploy it (e.g. via the Supabase MCP `deploy_edge_function` tool) and do the manual verification the design spec's Testing section describes (generate a quote for a lane with no real `carrier_rates` match, confirm the Details dialog's Cost Analysis tab now shows 5 real line items).
