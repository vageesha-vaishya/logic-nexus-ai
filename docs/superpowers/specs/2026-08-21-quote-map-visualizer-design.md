# Quote Map Visualizer - Real Geographic Map - Design Specification

**Date:** 2026-08-21
**Scope:** Replace the schematic (non-geographic) route diagram in `QuoteMapVisualizer` with a real interactive map, for every consumer of that shared component.
**Status:** Approved for implementation

## 1. Background

The user asked for six improvements to the Smart Quote module. Given the size (spans data-quality work, a new visual feature, an audit, UX polish, and two phases of compliance work), this was decomposed into independent sub-projects per the brainstorming process, and the user chose to tackle the route map first:

> "2- Route map is not showing global map in this section"

Investigation (verified directly against the codebase, not assumed) confirmed:
- `src/components/quotation/shared/QuoteMapVisualizer.tsx` is **not a geographic map** — it's a schematic node-and-line strip, literally labeled `"Schematic View • Not to scale"` in its own markup. No real map component exists anywhere in this codebase.
- It is a **shared component**, actually rendered in 2 files: once in `QuoteDetailView.tsx` (used by Smart Quote's "Details" dialog) and twice in `QuoteOptionsOverview.tsx` (used inside `UnifiedQuoteComposer`) — verified by finding every JSX usage, not just every import. `QuoteResultsList.tsx` imports it but never renders it (a pre-existing unused import, out of scope — nothing to change there). Fixing the component once fixes it everywhere it's actually used.
- **Every one of these 3 render sites derives its `origin`/`destination` props purely from `legs[0]` and `legs[legs.length - 1]`** (`opt.legs?.[0]?.from`/`.origin` and `opt.legs?.[legs.length-1]?.to`/`.destination`) — never from an independent source. This is a load-bearing finding: it means resolving coordinates at the **leg level only** is sufficient to cover the whole route, including the overall origin/destination markers — no separate resolution path is needed for `LocationAutocomplete`-picked locations.
- Both `SmartQuoteWorkspace` (via `useRateFetching`) and `UnifiedQuoteComposer` (also via `useRateFetching` — confirmed by import) funnel every rate option through the same `enrichOptionRouteData` normalization pass. Resolving coordinates once, there, covers every option reaching every render site.
- Coordinate data already exists in the database, in four different shapes that need normalizing:
  - `ports_locations.coordinates: Json | null` — a JSON object shaped `{ latitude, longitude }` (confirmed via `PortLocationForm.tsx`'s existing parsing code).
  - `airports.latitude: number`, `airports.longitude: number` — direct, required columns.
  - `cities.latitude: number | null`, `cities.longitude: number | null` — direct, nullable columns.
  - `transfer_points.latitude: number | null`, `transfer_points.longitude: number | null` — direct, nullable columns.
- `LocationAutocomplete.tsx` does not currently select any coordinate column in any of its 5 query sites (`id, location_name, location_code, location_type, country, city` only).
- No mapping library (Leaflet, Mapbox, react-simple-maps, Google Maps, etc.) is installed anywhere in `package.json`, and no map/geocoding API key exists in any `.env*` file. This is a green-field library choice.
- `react-leaflet`'s latest major (5.x) requires React 19 as a peer dependency; this app is on React 18.3.1. **`react-leaflet@^4.2.1` (paired with `leaflet@^1.9.4`) is the correct, React-18-compatible choice** — verified against npm's published peer-dependency metadata for both majors, not assumed.

## 2. Goals / Non-Goals

**Goals:**
- Render a real, interactive geographic map (pan/zoom, real basemap) showing a quote option's route, for every existing consumer of `QuoteMapVisualizer`.
- Resolve real coordinates for every leg endpoint via a new best-effort resolver against the four location tables above — this alone covers the overall route origin/destination too, since every render site derives those from the first/last leg (see Background).
- Preserve today's schematic view as an automatic fallback whenever an option's coordinates can't be fully resolved — never a broken or empty map.
- Keep `QuoteMapVisualizer` visually theme-neutral: it is rendered both inside `SmartQuoteWorkspace` (which has its own fixed `--sq-*` identity, per the prior visual-refresh work) and inside `UnifiedQuoteComposer` (which does not) — it must not adopt either page's specific styling.

**Non-Goals:**
- Not building a geocoding pipeline for arbitrary freeform text — only locations resolvable against `ports_locations`/`airports`/`cities`/`transfer_points` get real coordinates. AI-inferred waypoint names with no match in those tables fall back to the schematic view for that option, by design.
- Not changing `QuoteResultsList.tsx`, `QuoteDetailView.tsx`, or `QuoteOptionsOverview.tsx` at all — each already passes its full `legs` array straight through to `QuoteMapVisualizer`, so they need no code change once `TransportLeg` carries coordinates (see §4).
- Not touching the other five items from the user's original six-item list (charges-per-leg breakdown, the audit's concrete bug fixes, UX enhancements, the two-phase compliance work, source-attribution-in-Details) — each is its own sub-project, to be brainstormed and planned separately.
- Not adding a map/geocoding API key or any paid service — the chosen approach (Leaflet + OpenStreetMap tiles) needs neither.

## 3. Architecture

```
Coordinate resolution (new, runs once per rate-fetch — never inside the map component's render,
never a second, separate path for user-picked locations, per the finding above):

  Rate option legs arrive from rate-engine / AI advisor (plain from/to name strings)
        ↓
  useRateFetching.ts's existing enrichOptionRouteData pass, AFTER fillLegContinuity has
  settled each leg's final origin/destination name (continuity-filling must run first —
  resolving coordinates on a not-yet-continuity-filled leg would resolve the wrong, or an
  empty, name)
        ↓ (NEW: for each leg's final origin name and destination name, call the resolver)
  src/lib/location-coordinates.ts: resolveCoordinates(name) → {lat,lng} | null
        (priority-ordered lookup: ports_locations → airports → cities → transfer_points,
         in-memory cache keyed by normalized name, never re-queries within a session)
        ↓
  TransportLeg gains optional originCoordinates/destinationCoordinates (see §4 — a leg has
  two distinct endpoints, so this is two coordinate pairs, not one)

Rendering:

  QuoteMapVisualizer(origin, destination, legs)
        ↓
  every leg has both originCoordinates and destinationCoordinates resolved?
        ├─ yes → real Leaflet map: CircleMarker stops (SVG-drawn, no image asset — see §5) at
        │         legs[0].originCoordinates, each intermediate stop, and legs[last].destinationCoordinates,
        │         + mode-colored polylines between consecutive stops, OpenStreetMap tile basemap,
        │         pan/zoom enabled
        └─ no  → today's exact schematic view (code kept as-is, not deleted)
```

## 4. Components

### New
- `src/lib/location-coordinates.ts` — `resolveCoordinates(name: string): Promise<{ lat: number; lng: number } | null>`. Queries `ports_locations`, `airports`, `cities`, `transfer_points` in that priority order (first non-null match wins), normalizing each table's different coordinate shape into `{lat, lng}`. In-memory `Map<string, {lat,lng}|null>` cache keyed by a normalized (trimmed, lowercased) name — a session lives as long as the page, so this is a plain module-level cache, not a persistent store.

### Modified
- `src/types/quote-breakdown.ts` — add to `TransportLeg`: `originCoordinates?: { lat: number; lng: number }` and `destinationCoordinates?: { lat: number; lng: number }`. Two fields, not one — a leg connects two distinct points.
- `src/hooks/useRateFetching.ts` — inside the existing `enrichOptionRouteData` normalization pass, after `fillLegContinuity` settles each leg's final `origin`/`destination` names, call `resolveCoordinates` for each and attach the results as `originCoordinates`/`destinationCoordinates`. `enrichOptionRouteData` becomes `async`; its one call site that isn't already inside an async `.map()` callback (`hybridConfig.options.map((opt) => enrichOptionRouteData(opt, routeContext))`, the final normalization pass) must become `await Promise.all(hybridConfig.options.map((opt) => enrichOptionRouteData(opt, routeContext)))` — verified this is the only site needing that conversion; the other three call sites are already inside `Promise.all(array.map(async (opt) => ...))` callbacks and only need an `await` added.
- `src/components/quotation/shared/QuoteMapVisualizer.tsx` — rewritten. Accepts the same `origin`/`destination`/`legs` props as today (no prop-shape change needed at the call sites — `legs` already carries whatever `TransportLeg` carries); internally decides real-map vs. schematic based on whether every leg's `originCoordinates`/`destinationCoordinates` are present. Imports `leaflet/dist/leaflet.css` directly in this file (component-scoped, not global — this component is not on every page).
- `package.json` — add `leaflet@^1.9.4`, `react-leaflet@^4.2.1` (dependencies), `@types/leaflet@^1.9.22` (devDependency). These specific versions are required, not the latest majors — `react-leaflet@5.x` needs React 19, which this app does not have.

### Explicitly not modified (a scope reduction from the original proposal, found during verification)
- `LocationAutocomplete.tsx` — no changes needed. Since every `QuoteMapVisualizer` render site derives `origin`/`destination` purely from the first/last leg (never from an independent user-picked-location field), and every leg's coordinates are resolved once in `enrichOptionRouteData` regardless of whether that leg's name came from user selection or AI inference, a second resolution path through the autocomplete component would be redundant.
- `QuoteResultsList.tsx`, `QuoteDetailView.tsx`, `QuoteOptionsOverview.tsx` — no changes. They already pass `legs={...}` straight through; once `TransportLeg` carries coordinates, these components automatically forward them with no code change on their part.

### Untouched
- Everything about the schematic rendering path in `QuoteMapVisualizer.tsx` — kept verbatim as the fallback, not rewritten or deleted.
- `UnifiedQuoteComposer.tsx` and every other page — no direct changes; they benefit automatically because `QuoteMapVisualizer` is shared.

## 5. Marker rendering (a known Leaflet gotcha, addressed by design)

Leaflet's default marker icons are well known to break under bundlers (broken image paths under Vite/webpack). This design avoids the issue entirely by never using Leaflet's default `L.Icon` (image-based) at all — stops render as `react-leaflet`'s `CircleMarker` (SVG-drawn, mode-colored via `pathOptions`, no image asset involved whatsoever) with a `Tooltip` showing carrier/transit-time detail on hover, mirroring the information the current schematic's `TooltipProvider`/`Tooltip` already surfaces. This sidesteps the bundler-icon-path bug more completely than a custom `divIcon` would (no HTML-string marker content to build or escape either).

## 6. Data Flow / Error Handling

No new user-facing error states. A coordinate-resolution miss is not an error — it is the normal trigger for the schematic fallback for that specific option. The resolver never throws to its caller; a lookup miss (network issue, no match in any table) resolves to `null`, same as "not found."

## 7. Testing

- Unit tests for `location-coordinates.ts`: table-priority order (a `ports_locations` hit wins over an `airports` hit for the same name), each table's shape-normalization (`Json` object vs. direct columns), cache behavior (second call for the same name does not re-query), and the `null`-on-miss contract.
- `QuoteMapVisualizer` tests for both render paths: real map when every leg resolves, schematic fallback when any leg doesn't (including the exact current schematic tests, if any exist in `ui-consistency.test.tsx`, continuing to pass).
- Before writing `react-leaflet`-based tests, verify Leaflet actually mounts cleanly under this repo's Vitest/jsdom setup (a known trouble spot for map libraries under test runners that lack real browser layout APIs) — resolved during plan-writing (in the `QuoteMapVisualizer` rewrite task): `react-leaflet` is mocked entirely at the module boundary rather than relying on real Leaflet DOM/layout code executing under jsdom, since the component's own branching logic doesn't require exercising Leaflet's internals to verify.
- No new tests required for `QuoteResultsList`/`QuoteDetailView`/`QuoteOptionsOverview` — none of them are modified. Their existing suites should be run once as a regression check, since they render `QuoteMapVisualizer` and `TransportLeg` gains new optional fields, but no code change is expected in any of them.

## 8. Rollout

Single PR/commit series, additive at the shared-component level. No feature flag — every consumer gets the improvement automatically once the fallback logic is in place, and the fallback guarantees no regression for options whose coordinates can't be resolved.
