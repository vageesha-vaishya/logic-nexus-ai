# Quote Map Visualizer - Real Geographic Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the schematic (non-geographic) route diagram in the shared `QuoteMapVisualizer` component with a real, interactive Leaflet map, falling back to today's exact schematic view whenever any leg's coordinates can't be resolved.

**Architecture:** Resolve coordinates once, at the leg level, inside `useRateFetching.ts`'s existing `enrichOptionRouteData` normalization pass (which every rate option already flows through, from both `SmartQuoteWorkspace` and `UnifiedQuoteComposer`). A new resolver module looks up each leg endpoint's name against four location tables. `QuoteMapVisualizer` then renders a real map when every leg resolved, or the untouched schematic otherwise. No other component needs to change — every consumer already passes its full `legs` array straight through.

**Tech Stack:** `leaflet@^1.9.4` + `react-leaflet@^4.2.1` (the last major compatible with this app's React 18.3.1 — `react-leaflet@5.x` requires React 19, verified against npm's published peer-dependency metadata), `@types/leaflet@^1.9.22`. Supabase (`@/integrations/supabase/client`, already globally mocked in tests — see Global Constraints).

**Design spec:** `docs/superpowers/specs/2026-08-21-quote-map-visualizer-design.md` — read it once for full rationale; this plan does not repeat the "why," only the "what" and "how."

## Global Constraints

- `react-leaflet@^4.2.1` and `leaflet@^1.9.4` specifically — not the latest majors. Verify the installed versions' peer dependencies list React `^18.0.0` before proceeding if this plan is executed after any further dependency changes.
- All coordinate resolution happens through `src/lib/location-coordinates.ts`'s `resolveCoordinates` — never a second, separate lookup path. A lookup miss returns `null`, never throws.
- `QuoteMapVisualizer.tsx` renders the real map only when **every** leg has both `originCoordinates` and `destinationCoordinates` resolved. Any single missing coordinate on any leg falls the whole option back to the schematic view — never a partially-broken map.
- Never use Leaflet's default `L.Icon` (image-based marker) — it is well known to break under bundlers. Use `react-leaflet`'s `CircleMarker` (SVG-drawn, no image asset) for all stops.
- `@/integrations/supabase/client`'s `supabase` export is already globally mocked for the entire test suite in `test/setup.ts` (`vi.mock('@/integrations/supabase/client', ...)`, `setupFiles` in `vitest.config.ts`) — its mock chain (`mockSupabaseChain()`, `test/setup.ts:87-104`) does **not** currently include an `ilike` method. Task 2 must add one (mirroring the existing `eq`/`neq`/`in`/`is` pattern) before wiring the resolver into `useRateFetching.ts`, or every pre-existing test that transitively exercises the real (non-mocked) `useRateFetching.ts` — this includes most of `UnifiedQuoteComposer`'s 30+ test files — breaks with `TypeError: ...ilike is not a function`.
- `enrichOptionRouteData` in `useRateFetching.ts` (module-level, not inside the hook) becomes `async`. It has 4 call sites: 3 are already inside `Promise.all(array.map(async (opt) => ...))` callbacks (only need `await` added); the 4th (`hybridConfig.options.map((opt) => enrichOptionRouteData(opt, routeContext))`, the final normalization pass) is a plain `.map()` and must become `await Promise.all(hybridConfig.options.map(...))`. All 4 sites are addressed in Task 2 — do not miss the 4th.
- `LocationAutocomplete.tsx`, `QuoteResultsList.tsx`, `QuoteDetailView.tsx`, `QuoteOptionsOverview.tsx` are **not modified** by this plan — verified that each already passes what's needed straight through (see design spec §4's "Explicitly not modified" section for why).
- Run `npm run typecheck` and the relevant `npx vitest run <path>` after every task before committing.

---

### Task 1: `src/lib/location-coordinates.ts` — the coordinate resolver

**Files:**
- Create: `src/lib/location-coordinates.ts`
- Test: `src/lib/__tests__/location-coordinates.test.ts`

**Interfaces:**
- Produces: `export interface Coordinates { lat: number; lng: number }` and `export async function resolveCoordinates(name: string | null | undefined): Promise<Coordinates | null>`. Also `export function __clearCoordinatesCacheForTests(): void` (test-only, clears the module-level cache between test cases).
- Consumed by: Task 2 (`useRateFetching.ts`).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/location-coordinates.test.ts`. This file defines its own local `vi.mock('@/integrations/supabase/client', ...)` with a fully controllable `from` implementation — independent of the global test-setup mock (a local `vi.mock` in a test file takes precedence over the global one from `test/setup.ts` for that file):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

function chain(result: { data: any }) {
  return {
    select: () => ({
      ilike: () => ({
        limit: () => ({
          maybeSingle: () => Promise.resolve(result),
        }),
      }),
    }),
  };
}

import { resolveCoordinates, __clearCoordinatesCacheForTests } from '../location-coordinates';

describe('resolveCoordinates', () => {
  beforeEach(() => {
    __clearCoordinatesCacheForTests();
    mockFrom.mockReset();
  });

  it('returns null for an empty/blank name without querying', async () => {
    const result = await resolveCoordinates('   ');
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns null for null/undefined input', async () => {
    expect(await resolveCoordinates(null)).toBeNull();
    expect(await resolveCoordinates(undefined)).toBeNull();
  });

  it('resolves from ports_locations, parsing the {latitude,longitude} JSON shape', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ports_locations') return chain({ data: { coordinates: { latitude: 31.2, longitude: 121.5 } } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('CNSHA');
    expect(result).toEqual({ lat: 31.2, lng: 121.5 });
  });

  it('falls through to airports when ports_locations has no match', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ports_locations') return chain({ data: null });
      if (table === 'airports') return chain({ data: { latitude: 33.9, longitude: -118.4 } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('LAX');
    expect(result).toEqual({ lat: 33.9, lng: -118.4 });
  });

  it('falls through to cities when ports_locations and airports have no match', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'cities') return chain({ data: { latitude: 40.7, longitude: -74.0 } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('New York');
    expect(result).toEqual({ lat: 40.7, lng: -74.0 });
  });

  it('falls through to transfer_points when nothing else matches', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'transfer_points') return chain({ data: { latitude: 51.5, longitude: -0.1 } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('LondonHub');
    expect(result).toEqual({ lat: 51.5, lng: -0.1 });
  });

  it('returns null when nothing matches in any table', async () => {
    mockFrom.mockImplementation(() => chain({ data: null }));
    const result = await resolveCoordinates('Nowhereville');
    expect(result).toBeNull();
  });

  it('discards malformed coordinate data (non-numeric lat/lng)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ports_locations') return chain({ data: { coordinates: { latitude: 'not-a-number', longitude: null } } });
      return chain({ data: null });
    });
    const result = await resolveCoordinates('BadData');
    expect(result).toBeNull();
  });

  it('caches results — a second call for the same (normalized) name does not re-query', async () => {
    let portCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'ports_locations') {
        portCallCount += 1;
        return chain({ data: { coordinates: { latitude: 1, longitude: 2 } } });
      }
      return chain({ data: null });
    });
    await resolveCoordinates('CNSHA');
    await resolveCoordinates('  cnsha  ');
    expect(portCallCount).toBe(1);
  });

  it('returns null (not throw) when a query rejects', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        ilike: () => ({
          limit: () => ({
            maybeSingle: () => Promise.reject(new Error('network error')),
          }),
        }),
      }),
    }));
    const result = await resolveCoordinates('AnythingAtAll');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/location-coordinates.test.ts`
Expected: FAIL — `Cannot find module '../location-coordinates'`.

- [ ] **Step 3: Implement the resolver**

Create `src/lib/location-coordinates.ts`:

```ts
import { supabase } from '@/integrations/supabase/client';

export interface Coordinates {
  lat: number;
  lng: number;
}

const cache = new Map<string, Coordinates | null>();

function normalizeKey(name: string): string {
  return name.trim().toLowerCase();
}

function parsePortCoordinates(value: unknown): Coordinates | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function toCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  return { lat: latNum, lng: lngNum };
}

async function findPortCoordinates(name: string): Promise<Coordinates | null> {
  const byCode = await supabase
    .from('ports_locations')
    .select('coordinates')
    .ilike('location_code', name)
    .limit(1)
    .maybeSingle();
  const byCodeCoords = parsePortCoordinates(byCode.data?.coordinates);
  if (byCodeCoords) return byCodeCoords;

  const byName = await supabase
    .from('ports_locations')
    .select('coordinates')
    .ilike('location_name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  return parsePortCoordinates(byName.data?.coordinates);
}

async function findAirportCoordinates(name: string): Promise<Coordinates | null> {
  const byCode = await supabase
    .from('airports')
    .select('latitude, longitude')
    .ilike('iata_code', name)
    .limit(1)
    .maybeSingle();
  const byCodeCoords = byCode.data ? toCoordinates(byCode.data.latitude, byCode.data.longitude) : null;
  if (byCodeCoords) return byCodeCoords;

  const byName = await supabase
    .from('airports')
    .select('latitude, longitude')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  return byName.data ? toCoordinates(byName.data.latitude, byName.data.longitude) : null;
}

async function findCityCoordinates(name: string): Promise<Coordinates | null> {
  const byName = await supabase
    .from('cities')
    .select('latitude, longitude')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  return byName.data ? toCoordinates(byName.data.latitude, byName.data.longitude) : null;
}

async function findTransferPointCoordinates(name: string): Promise<Coordinates | null> {
  const byCode = await supabase
    .from('transfer_points')
    .select('latitude, longitude')
    .ilike('code', name)
    .limit(1)
    .maybeSingle();
  const byCodeCoords = byCode.data ? toCoordinates(byCode.data.latitude, byCode.data.longitude) : null;
  if (byCodeCoords) return byCodeCoords;

  const byName = await supabase
    .from('transfer_points')
    .select('latitude, longitude')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();
  return byName.data ? toCoordinates(byName.data.latitude, byName.data.longitude) : null;
}

export async function resolveCoordinates(name: string | null | undefined): Promise<Coordinates | null> {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;

  const key = normalizeKey(trimmed);
  if (cache.has(key)) return cache.get(key) as Coordinates | null;

  let resolved: Coordinates | null = null;
  try {
    resolved = await findPortCoordinates(trimmed);
    if (!resolved) resolved = await findAirportCoordinates(trimmed);
    if (!resolved) resolved = await findCityCoordinates(trimmed);
    if (!resolved) resolved = await findTransferPointCoordinates(trimmed);
  } catch {
    resolved = null;
  }

  cache.set(key, resolved);
  return resolved;
}

export function __clearCoordinatesCacheForTests(): void {
  cache.clear();
}
```

Note: no `.or(...)` calls anywhere — a raw `.or()` filter string is comma/dot-delimited by Supabase's own syntax, and a location name containing a comma or period (e.g. "St. Louis") would silently break the filter. Every lookup here uses plain `.ilike(column, value)` calls instead, which pass `value` as a real parameter, not a string to parse.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/location-coordinates.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/location-coordinates.ts src/lib/__tests__/location-coordinates.test.ts
git commit -m "feat(quotation): add location coordinate resolver for the map visualizer"
```

---

### Task 2: Wire coordinate resolution into `useRateFetching.ts`

**Files:**
- Modify: `test/setup.ts` (prerequisite — see Global Constraints)
- Modify: `src/types/quote-breakdown.ts`
- Modify: `src/hooks/useRateFetching.ts`
- Modify: `src/hooks/__tests__/useRateFetching.test.ts`

**Interfaces:**
- Consumes: `resolveCoordinates` from Task 1.
- Produces: `TransportLeg.originCoordinates?: { lat: number; lng: number }` and `TransportLeg.destinationCoordinates?: { lat: number; lng: number }`, populated on every `RateOption` returned by `useRateFetching().fetchRates(...)`. Consumed by Task 3.

- [ ] **Step 1: Add `ilike` to the global Supabase test mock**

In `test/setup.ts`, find `mockSupabaseChain` (around line 87-104) and add one line to its chainable-method list, in the same style as the existing `eq`/`neq`/`in`/`is` entries:

```diff
   eq: vi.fn().mockReturnThis(),
   neq: vi.fn().mockReturnThis(),
   in: vi.fn().mockReturnThis(),
   is: vi.fn().mockReturnThis(),
+  ilike: vi.fn().mockReturnThis(),
   order: vi.fn().mockReturnThis(),
```

This is required before Step 4 below — without it, every pre-existing test that transitively renders `UnifiedQuoteComposer` (or otherwise exercises the real, non-mocked `useRateFetching.ts`) will fail with `TypeError: ...ilike is not a function` once `enrichOptionRouteData` starts calling the resolver.

- [ ] **Step 2: Add coordinate fields to `TransportLeg`**

In `src/types/quote-breakdown.ts`, add two fields to the `TransportLeg` interface (after the existing `charges?: Charge[];` line):

```diff
     sequence?: number; // Order in route
     charges?: Charge[];
+    originCoordinates?: { lat: number; lng: number };
+    destinationCoordinates?: { lat: number; lng: number };
 }
```

- [ ] **Step 3: Write a failing test for the new coordinate behavior**

In `src/hooks/__tests__/useRateFetching.test.ts`, add a new mock near the top (with the other `vi.mock` calls, after the existing ones) and one new test at the end of the `describe('useRateFetching', ...)` block:

```ts
const mockResolveCoordinates = vi.fn();
vi.mock('@/lib/location-coordinates', () => ({
  resolveCoordinates: (name: string) => mockResolveCoordinates(name),
}));
```

Add to `beforeEach`:
```diff
   beforeEach(() => {
     vi.clearAllMocks();
     mockInvokeAiAdvisor.mockResolvedValue({ data: null, error: null });
+    mockResolveCoordinates.mockResolvedValue(null);
     vi.mocked(generateSimulatedRates).mockReturnValue([]);
```

New test, added as the last `it(...)` in the `describe` block:

```ts
  it('attaches resolved coordinates to each leg when the resolver finds a match', async () => {
    mockResolveCoordinates.mockImplementation(async (name: string) => {
      if (name === 'Shanghai') return { lat: 31.2, lng: 121.5 };
      if (name === 'Rotterdam') return { lat: 51.9, lng: 4.5 };
      return null;
    });
    mockInvokeFn.mockResolvedValueOnce({
      data: {
        options: [
          { id: 'r1', carrier: 'Test', price: 1000, total_amount: 1000, currency: 'USD', transit_days: 14 },
        ],
      },
      error: null,
    });

    const { result } = renderHook(() => useRateFetching());

    await act(async () => {
      await result.current.fetchRates(mockParams, mockResolver);
    });

    const option = result.current.results![0];
    expect(option.legs?.[0]?.originCoordinates).toEqual({ lat: 31.2, lng: 121.5 });
    expect(option.legs?.[0]?.destinationCoordinates).toEqual({ lat: 51.9, lng: 4.5 });
  });

  it('leaves coordinates undefined when the resolver finds no match (existing behavior unaffected)', async () => {
    mockInvokeFn.mockResolvedValueOnce({
      data: {
        options: [
          { id: 'r1', carrier: 'Test', price: 1000, total_amount: 1000, currency: 'USD', transit_days: 14 },
        ],
      },
      error: null,
    });

    const { result } = renderHook(() => useRateFetching());

    await act(async () => {
      await result.current.fetchRates(mockParams, mockResolver);
    });

    const option = result.current.results![0];
    expect(option.legs?.[0]?.originCoordinates).toBeUndefined();
    expect(option.legs?.[0]?.destinationCoordinates).toBeUndefined();
    // Confirms the existing test suite's behavior (this file's other assertions) is unaffected.
    expect(option.carrier).toBe('Test');
  });
```

- [ ] **Step 4: Run the test file to verify the two new tests fail**

Run: `npx vitest run src/hooks/__tests__/useRateFetching.test.ts`
Expected: the two new tests FAIL (coordinates are never attached yet — `enrichOptionRouteData` doesn't call the resolver). All pre-existing tests in this file should still PASS (nothing else has changed yet).

- [ ] **Step 5: Modify `enrichOptionRouteData` and its call sites**

In `src/hooks/useRateFetching.ts`:

Add the import near the top, with the other local imports:
```diff
 import { QuotationRankingService } from '@/services/quotation/QuotationRankingService';
+import { resolveCoordinates } from '@/lib/location-coordinates';
```

Replace the function signature (currently `const enrichOptionRouteData = (option: any, fallbackRoute: { origin: string; destination: string }) => {`) and its final `legs`/`return` block (currently lines ~337-361: from `const legs =` through the closing `};`) with:

```ts
const enrichOptionRouteData = async (option: any, fallbackRoute: { origin: string; destination: string }) => {
  const optionOrigin = resolveOptionLocation(option, ORIGIN_LOCATION_KEYS) || fallbackRoute.origin;
  const optionDestination = resolveOptionLocation(option, DESTINATION_LOCATION_KEYS) || fallbackRoute.destination;

  const sourceLegs = Array.isArray(option?.legs) ? option.legs : [];
  const normalizedLegs = sourceLegs.map((leg: any) => {
    const origin = resolveLegLocation(leg, ORIGIN_LOCATION_KEYS);
    const destination = resolveLegLocation(leg, DESTINATION_LOCATION_KEYS);
    return {
      ...leg,
      carrier: resolveCarrierName(leg, option),
      departure_date: resolveDepartureDate(leg, option),
      origin: origin || '',
      destination: destination || '',
      from: origin || '',
      to: destination || '',
    };
  });
  const continuityLegs = fillLegContinuity(normalizedLegs, {
    origin: optionOrigin || fallbackRoute.origin,
    destination: optionDestination || fallbackRoute.destination,
  }).map((leg) => ({
    ...leg,
    carrier: leg.carrier || resolveCarrierName(leg, option),
    departure_date: leg.departure_date || resolveDepartureDate(leg, option),
    from: leg.origin || optionOrigin || 'Origin',
    to: leg.destination || optionDestination || 'Destination',
  }));

  const legs =
    continuityLegs.length > 0
      ? continuityLegs
      : [
          {
            id: option?.id ? `${option.id}-route-leg` : `route-leg-${Date.now()}`,
            mode: option?.mode || option?.transport_mode || 'ocean',
            sequence: 1,
            leg_type: 'transport',
            carrier: option?.carrier || option?.carrier_name || 'Unknown Carrier',
            origin: optionOrigin || 'Origin',
            destination: optionDestination || 'Destination',
            from: optionOrigin || 'Origin',
            to: optionDestination || 'Destination',
            charges: Array.isArray(option?.charges) ? option.charges : [],
          },
        ];

  // NEW: resolve real-world coordinates for each leg's endpoints, after continuity-filling has
  // settled the final origin/destination names — resolving before continuity-filling would
  // look up the wrong (empty or pre-fill) name for legs that had sparse endpoints.
  const legsWithCoordinates = await Promise.all(
    legs.map(async (leg: any) => {
      const originCoordinates = await resolveCoordinates(leg.origin);
      const destinationCoordinates = await resolveCoordinates(leg.destination);
      return {
        ...leg,
        originCoordinates: originCoordinates ?? undefined,
        destinationCoordinates: destinationCoordinates ?? undefined,
      };
    })
  );

  return {
    ...option,
    origin: optionOrigin || legsWithCoordinates[0]?.origin || '',
    destination: optionDestination || legsWithCoordinates[legsWithCoordinates.length - 1]?.destination || '',
    legs: legsWithCoordinates,
  };
};
```

Then update the 4 call sites. The first three (already inside `Promise.all(array.map(async (opt) => ...))` callbacks) just need `await` added:

```diff
-              const mapped = enrichOptionRouteData(mapOptionToQuote(opt), routeContext);
+              const mapped = await enrichOptionRouteData(mapOptionToQuote(opt), routeContext);
```
(this exact line appears 3 times — inside the legacy-options loop, the AI-options loop, and the simulation-fallback loop; change all 3)

The 4th call site (the final normalization pass, currently a plain `.map()`) must be converted to `Promise.all`:

```diff
-      const normalizedCombinedOptions = hybridConfig.options.map((opt) => enrichOptionRouteData(opt, routeContext));
+      const normalizedCombinedOptions = await Promise.all(
+        hybridConfig.options.map((opt) => enrichOptionRouteData(opt, routeContext))
+      );
```

- [ ] **Step 6: Run the test file to verify all tests pass**

Run: `npx vitest run src/hooks/__tests__/useRateFetching.test.ts`
Expected: PASS — all pre-existing tests plus the 2 new ones (this file has 9 pre-existing `it(...)` blocks + 2 new = 11 tests total).

- [ ] **Step 7: Broad regression check — confirm the global test-mock fix actually prevents the breakage it was added for**

Run a sample of `UnifiedQuoteComposer` tests that render the real component (not all 30+, but enough to prove the `ilike` fix works in practice — pick files that don't mock `useRateFetching` themselves):

Run: `npx vitest run src/components/quotation/unified-composer/__tests__/UnifiedQuoteComposer.smart.test.tsx src/components/quotation/unified-composer/__tests__/ResultsZone.integration.test.tsx src/components/quotation/unified-composer/UnifiedQuoteComposer.simple.test.tsx`

Expected: PASS, or the exact same pass/fail counts as a baseline run of these same 3 files taken *before* Step 1's change (if any of them were already failing before this task — e.g. the known-broken `UnifiedQuoteComposer.save.test.tsx` fixture issue from the unrelated prior audit — that's a pre-existing condition, not something this task should fix or that this task should regress further). If a file that was passing before Step 1 now fails with an `ilike`-related error, Step 1's fix is incomplete — investigate before proceeding.

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add test/setup.ts src/types/quote-breakdown.ts src/hooks/useRateFetching.ts src/hooks/__tests__/useRateFetching.test.ts
git commit -m "feat(quotation): resolve and attach real coordinates to rate option legs"
```

---

### Task 3: Rewrite `QuoteMapVisualizer` to render a real map

**Files:**
- Modify: `package.json` (add `leaflet`, `react-leaflet`, `@types/leaflet`)
- Modify: `src/components/quotation/shared/QuoteMapVisualizer.tsx`
- Test: `src/components/quotation/shared/__tests__/QuoteMapVisualizer.test.tsx` (new)

**Interfaces:**
- Consumes: `originCoordinates`/`destinationCoordinates` on leg objects (Task 2).
- No prop-shape change for callers — `QuoteDetailView.tsx`, `QuoteOptionsOverview.tsx` (the 2 real render sites, verified in the design spec's Background) need zero changes; they already pass `legs={...}` which now structurally includes the new optional coordinate fields.

- [ ] **Step 1: Install dependencies**

Run: `npm install leaflet@^1.9.4 react-leaflet@^4.2.1` and `npm install --save-dev @types/leaflet@^1.9.22`

Verify after install: `npm ls react-leaflet leaflet` shows `react-leaflet@4.2.x` (not 5.x) and `leaflet@1.9.x`. If npm resolved a different major for either package, stop and fix the version pin before continuing — a `react-leaflet@5.x` install here means a peer-dependency mismatch against this app's React 18.

- [ ] **Step 2: Write the failing tests**

Create `src/components/quotation/shared/__tests__/QuoteMapVisualizer.test.tsx`. This mocks `react-leaflet` entirely — real Leaflet needs real browser layout APIs that jsdom doesn't fully provide, and this component's own logic (which branch to render, how many markers/lines, correct colors) doesn't require actually exercising Leaflet's internals to test:

```tsx
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuoteMapVisualizer } from '../QuoteMapVisualizer';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, bounds }: any) => (
    <div data-testid="mock-map-container" data-bounds={JSON.stringify(bounds)}>{children}</div>
  ),
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  CircleMarker: ({ children, center }: any) => (
    <div data-testid="mock-circle-marker" data-center={JSON.stringify(center)}>{children}</div>
  ),
  Polyline: ({ pathOptions }: any) => (
    <div data-testid="mock-polyline" data-color={pathOptions?.color} />
  ),
  Tooltip: ({ children }: any) => <div data-testid="mock-tooltip">{children}</div>,
}));

const OCEAN_LEG_RESOLVED = {
  from: 'Shanghai',
  to: 'Los Angeles',
  origin: 'Shanghai',
  destination: 'Los Angeles',
  mode: 'ocean',
  transit_time: '21 days',
  carrier: 'Test Carrier',
  originCoordinates: { lat: 31.2, lng: 121.5 },
  destinationCoordinates: { lat: 33.7, lng: -118.2 },
};

const ROAD_LEG_RESOLVED = {
  from: 'Los Angeles',
  to: 'Chicago',
  origin: 'Los Angeles',
  destination: 'Chicago',
  mode: 'road',
  originCoordinates: { lat: 33.7, lng: -118.2 },
  destinationCoordinates: { lat: 41.8, lng: -87.6 },
};

const UNRESOLVED_LEG = {
  from: 'Nowhereville',
  to: 'Somewhereton',
  mode: 'road',
};

describe('QuoteMapVisualizer', () => {
  it('renders the real map when every leg has resolved coordinates', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Los Angeles" legs={[OCEAN_LEG_RESOLVED]} />);
    expect(screen.getByTestId('mock-map-container')).toBeInTheDocument();
    expect(screen.getAllByTestId('mock-circle-marker')).toHaveLength(2);
    expect(screen.getAllByTestId('mock-polyline')).toHaveLength(1);
    expect(screen.queryByText(/Schematic View/i)).not.toBeInTheDocument();
  });

  it('falls back to the schematic view when any leg is missing coordinates', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Somewhereton" legs={[OCEAN_LEG_RESOLVED, UNRESOLVED_LEG]} />);
    expect(screen.queryByTestId('mock-map-container')).not.toBeInTheDocument();
    expect(screen.getByText(/Schematic View/i)).toBeInTheDocument();
  });

  it('falls back to the schematic view when legs is empty', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Los Angeles" legs={[]} />);
    expect(screen.queryByTestId('mock-map-container')).not.toBeInTheDocument();
    expect(screen.getByText(/Schematic View/i)).toBeInTheDocument();
  });

  it('draws one polyline per leg, colored by mode, and one CircleMarker per stop', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Chicago" legs={[OCEAN_LEG_RESOLVED, ROAD_LEG_RESOLVED]} />);
    const polylines = screen.getAllByTestId('mock-polyline');
    expect(polylines).toHaveLength(2);
    expect(polylines[0]).toHaveAttribute('data-color', '#2563eb');
    expect(polylines[1]).toHaveAttribute('data-color', '#d97706');
    expect(screen.getAllByTestId('mock-circle-marker')).toHaveLength(3);
  });

  it('still shows the mode-count badges on the real-map branch', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Los Angeles" legs={[OCEAN_LEG_RESOLVED]} />);
    expect(screen.getByText('1 Ocean')).toBeInTheDocument();
  });

  it('still shows the mode-count badges on the schematic fallback branch (pre-existing behavior)', () => {
    render(<QuoteMapVisualizer origin="Shanghai" destination="Somewhereton" legs={[UNRESOLVED_LEG]} />);
    expect(screen.getByText('1 Road')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/quotation/shared/__tests__/QuoteMapVisualizer.test.tsx`
Expected: FAIL — the component doesn't yet render `mock-map-container` for resolved legs (still always renders the schematic).

- [ ] **Step 4: Rewrite the component**

Full replacement of `src/components/quotation/shared/QuoteMapVisualizer.tsx`:

```tsx
import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, MapPin, Plane, Ship, Train, Truck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type QuoteMapLegMode = 'ocean' | 'air' | 'road' | 'rail' | 'other';

interface QuoteMapCoordinates {
  lat: number;
  lng: number;
}

interface QuoteMapLegInput {
  from?: string | null;
  to?: string | null;
  origin?: string | null;
  destination?: string | null;
  mode?: string | null;
  transit_time?: string | number | null;
  border_crossing?: boolean | null;
  carrier?: string | null;
  originCoordinates?: QuoteMapCoordinates | null;
  destinationCoordinates?: QuoteMapCoordinates | null;
}

interface QuoteMapVisualizerProps {
  origin: string;
  destination: string;
  legs: QuoteMapLegInput[];
}

const MODE_COLORS: Record<QuoteMapLegMode, string> = {
  ocean: '#2563eb',
  air: '#0284c7',
  road: '#d97706',
  rail: '#ea580c',
  other: '#6b7280',
};

export function QuoteMapVisualizer({ origin, destination, legs }: QuoteMapVisualizerProps) {
  const normalizedLegs = useMemo(() => {
    const toMode = (rawMode: string | null | undefined): QuoteMapLegMode => {
      const value = String(rawMode || '').toLowerCase();
      if (value.includes('ocean') || value.includes('sea')) return 'ocean';
      if (value.includes('air')) return 'air';
      if (value.includes('rail')) return 'rail';
      if (value.includes('road') || value.includes('truck')) return 'road';
      return 'other';
    };

    return legs.map((leg) => ({
      from: String(leg.from || leg.origin || 'Origin'),
      to: String(leg.to || leg.destination || 'Destination'),
      mode: toMode(leg.mode),
      transitTime: leg.transit_time ? String(leg.transit_time) : 'N/A',
      borderCrossing: Boolean(leg.border_crossing),
      carrier: leg.carrier ? String(leg.carrier) : 'N/A',
      originCoordinates: leg.originCoordinates ?? null,
      destinationCoordinates: leg.destinationCoordinates ?? null,
    }));
  }, [legs]);

  const modeCounts = useMemo(() => {
    return normalizedLegs.reduce(
      (acc, leg) => {
        if (leg.mode === 'ocean') acc.ocean += 1;
        if (leg.mode === 'air') acc.air += 1;
        if (leg.mode === 'road') acc.road += 1;
        if (leg.mode === 'rail') acc.rail += 1;
        return acc;
      },
      { ocean: 0, air: 0, road: 0, rail: 0 },
    );
  }, [normalizedLegs]);

  const iconForMode = (mode: QuoteMapLegMode) => {
    if (mode === 'ocean') return <Ship className="h-4 w-4 text-primary" />;
    if (mode === 'air') return <Plane className="h-4 w-4 text-primary" />;
    if (mode === 'rail') return <Train className="h-4 w-4 text-primary" />;
    return <Truck className="h-4 w-4 text-primary" />;
  };

  const stops = useMemo(() => {
    if (normalizedLegs.length === 0) return null;
    const hasAllCoordinates = normalizedLegs.every(
      (leg) => leg.originCoordinates && leg.destinationCoordinates
    );
    if (!hasAllCoordinates) return null;

    const result: { lat: number; lng: number; label: string }[] = [
      { ...(normalizedLegs[0].originCoordinates as QuoteMapCoordinates), label: normalizedLegs[0].from },
    ];
    normalizedLegs.forEach((leg) => {
      result.push({ ...(leg.destinationCoordinates as QuoteMapCoordinates), label: leg.to });
    });
    return result;
  }, [normalizedLegs]);

  const header = (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="space-y-1">
        <h4 className="flex items-center gap-2 text-xs font-semibold">
          <MapPin className="h-3 w-3 text-primary" />
          Route Visualization
        </h4>
        <p className="text-[10px] text-muted-foreground">
          {origin} → {destination}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="h-5 text-[10px]">{modeCounts.ocean} Ocean</Badge>
        <Badge variant="outline" className="h-5 text-[10px]">{modeCounts.air} Air</Badge>
        <Badge variant="outline" className="h-5 text-[10px]">{modeCounts.road} Road</Badge>
        <Badge variant="outline" className="h-5 text-[10px]">{modeCounts.rail} Rail</Badge>
      </div>
    </div>
  );

  if (stops && stops.length > 0) {
    const bounds = stops.map((stop) => [stop.lat, stop.lng] as [number, number]);
    return (
      <Card className="w-full min-h-[300px] border-border bg-card overflow-hidden">
        {header}
        <div className="h-[320px] w-full">
          <MapContainer
            bounds={bounds}
            boundsOptions={{ padding: [24, 24] }}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {normalizedLegs.map((leg, index) => (
              <Polyline
                key={`leg-${index}`}
                positions={[
                  [stops[index].lat, stops[index].lng],
                  [stops[index + 1].lat, stops[index + 1].lng],
                ]}
                pathOptions={{ color: MODE_COLORS[leg.mode], weight: 3 }}
              />
            ))}
            {stops.map((stop, index) => (
              <CircleMarker
                key={`stop-${index}`}
                center={[stop.lat, stop.lng]}
                radius={7}
                pathOptions={{ color: '#0f172a', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
              >
                <LeafletTooltip>{stop.label}</LeafletTooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full min-h-[300px] border-border bg-card">
      {header}

      <div className="p-4">
        <div className="flex items-center overflow-x-auto rounded-md border border-border bg-muted/20 px-3 py-6">
          <div className="flex items-center gap-3">
            <div className="flex min-w-[120px] flex-col items-center gap-1">
              <div className="h-4 w-4 rounded-full border-2 border-primary bg-background" />
              <span className="max-w-[120px] truncate text-xs font-medium">{origin}</span>
            </div>
            {normalizedLegs.map((leg, index) => (
              <React.Fragment key={`${leg.from}-${leg.to}-${index}`}>
                <div className="h-px w-8 bg-border" />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex min-w-[140px] cursor-default flex-col items-center gap-1 rounded-md border border-border bg-background px-3 py-2">
                        <span className="text-[10px] text-muted-foreground">{leg.from} → {leg.to}</span>
                        <span className="flex items-center gap-1 text-xs font-medium">
                          {iconForMode(leg.mode)}
                          {leg.mode.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{leg.transitTime}</span>
                        {leg.borderCrossing ? (
                          <Badge variant="destructive" className="h-4 px-1 text-[9px]">Customs</Badge>
                        ) : null}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1 text-xs">
                        <p><span className="text-muted-foreground">From:</span> {leg.from}</p>
                        <p><span className="text-muted-foreground">To:</span> {leg.to}</p>
                        <p><span className="text-muted-foreground">Carrier:</span> {leg.carrier}</p>
                        <p><span className="text-muted-foreground">Transit:</span> {leg.transitTime}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </React.Fragment>
            ))}
            <div className="h-px w-8 bg-border" />
            <div className="flex min-w-[120px] flex-col items-center gap-1">
              <div className="h-4 w-4 rounded-full border-2 border-primary bg-background" />
              <span className="max-w-[120px] truncate text-xs font-medium">{destination}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 px-4 pb-3 text-[10px] text-muted-foreground">
        <Info className="h-3 w-3" />
        Schematic View • Not to scale
      </div>
    </Card>
  );
}
```

The schematic branch (everything from the second `return` onward) is copied verbatim from the file's current content — same classes, same structure, same "Schematic View • Not to scale" copy — only now reached conditionally instead of unconditionally, and sharing the factored-out `header` (identical rendered output to before; factoring a repeated JSX block into a `const` does not change what's rendered).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/quotation/shared/__tests__/QuoteMapVisualizer.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Run the full regression suite for everything this plan touched**

Run: `npx vitest run src/lib/__tests__/location-coordinates.test.ts src/hooks/__tests__/useRateFetching.test.ts src/components/quotation/shared/__tests__/QuoteMapVisualizer.test.tsx src/lib/__tests__/ui-consistency.test.tsx`

Expected: PASS across all 4 files. `ui-consistency.test.tsx` already mocks `QuoteMapVisualizer` entirely (verified during planning), so it's included here purely as a regression check that the rewrite didn't somehow break its mock contract — it should need no changes.

- [ ] **Step 7: Manual/visual check**

Start the dev server (`npm run dev:vite`), navigate to a Smart Quote flow, generate quotes for a route where both endpoints are well-known ports/cities (e.g. Shanghai → Los Angeles), open a rate option's "Details" dialog, and confirm a real interactive map renders (pan/zoom work, route line and stops visible). Then try a route with an obscure or freeform destination name unlikely to match any location table, and confirm it falls back to the schematic view rather than showing a broken or empty map. Also spot-check `UnifiedQuoteComposer`'s results view (where `QuoteOptionsOverview` renders the same component) to confirm it works there too, since it's a shared component.

- [ ] **Step 8: Typecheck and lint**

Run: `npm run typecheck`
Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/components/quotation/shared/QuoteMapVisualizer.tsx src/components/quotation/shared/__tests__/QuoteMapVisualizer.test.tsx
git commit -m "feat(quotation): render a real interactive map in QuoteMapVisualizer, with schematic fallback"
```

---

## Post-Plan

After Task 3, use `superpowers:finishing-a-development-branch` (if working in an isolated worktree/branch per `superpowers:using-git-worktrees`) to run the final whole-branch review and merge/PR flow — that review is where cross-task concerns spanning the whole diff get caught, per `superpowers:subagent-driven-development`.
