# Quote Map Visualizer - Real Geographic Map - Design Specification

**Date:** 2026-08-21
**Scope:** Replace the schematic (non-geographic) route diagram in `QuoteMapVisualizer` with a real interactive map, for every consumer of that shared component.
**Status:** Approved for implementation

## 1. Background

The user asked for six improvements to the Smart Quote module. Given the size (spans data-quality work, a new visual feature, an audit, UX polish, and two phases of compliance work), this was decomposed into independent sub-projects per the brainstorming process, and the user chose to tackle the route map first:

> "2- Route map is not showing global map in this section"

Investigation (verified directly against the codebase, not assumed) confirmed:
- `src/components/quotation/shared/QuoteMapVisualizer.tsx` is **not a geographic map** — it's a schematic node-and-line strip, literally labeled `"Schematic View • Not to scale"` in its own markup. No real map component exists anywhere in this codebase.
- It is a **shared component**, rendered from `QuoteResultsList.tsx`, `QuoteDetailView.tsx` (used by Smart Quote's "Details" dialog), and `QuoteOptionsOverview.tsx` (used inside `UnifiedQuoteComposer`) — plus referenced by `src/lib/__tests__/ui-consistency.test.tsx`. Fixing it once fixes it everywhere it's used.
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
- Resolve real coordinates for the locations already known to the app: user-picked origin/destination (via `LocationAutocomplete`) and per-leg waypoints (via a new best-effort resolver against the four location tables above).
- Preserve today's schematic view as an automatic fallback whenever an option's coordinates can't be fully resolved — never a broken or empty map.
- Keep `QuoteMapVisualizer` visually theme-neutral: it is rendered both inside `SmartQuoteWorkspace` (which has its own fixed `--sq-*` identity, per the prior visual-refresh work) and inside `UnifiedQuoteComposer` (which does not) — it must not adopt either page's specific styling.

**Non-Goals:**
- Not building a geocoding pipeline for arbitrary freeform text — only locations resolvable against `ports_locations`/`airports`/`cities`/`transfer_points` get real coordinates. AI-inferred waypoint names with no match in those tables fall back to the schematic view for that option, by design.
- Not changing `QuoteResultsList.tsx`, `QuoteDetailView.tsx`, or `QuoteOptionsOverview.tsx`'s own logic — they only gain trivial prop-plumbing to pass new coordinate fields through to `QuoteMapVisualizer`.
- Not touching the other five items from the user's original six-item list (charges-per-leg breakdown, the audit's concrete bug fixes, UX enhancements, the two-phase compliance work, source-attribution-in-Details) — each is its own sub-project, to be brainstormed and planned separately.
- Not adding a map/geocoding API key or any paid service — the chosen approach (Leaflet + OpenStreetMap tiles) needs neither.

## 3. Architecture

```
Coordinate resolution (new, runs once per relevant event — never inside the map component's render):

  User picks origin/destination via LocationAutocomplete
        ↓ (existing select queries gain `coordinates`/`latitude`/`longitude` columns)
  originDetails / destinationDetails gain lat/lng
        ↓ (already flows through SmartQuoteWorkspace.tsx and the general composer today)

  Rate option legs arrive from rate-engine / AI advisor (plain from/to name strings)
        ↓
  useRateFetching.ts's existing enrichOptionRouteData pass
        ↓ (NEW: for each leg endpoint, call the new resolver)
  src/lib/location-coordinates.ts: resolveCoordinates(name) → {lat,lng} | null
        (priority-ordered lookup: ports_locations → airports → cities → transfer_points,
         in-memory cache keyed by normalized name, never re-queries within a session)
        ↓
  TransportLeg gains optional lat/lng on origin and destination

Rendering:

  QuoteMapVisualizer(origin, destination, legs)
        ↓
  every leg endpoint has resolved coordinates?
        ├─ yes → real Leaflet map: markers (custom divIcon, mode-colored, reusing the
        │         existing Ship/Plane/Truck/Train icon language) + polylines between
        │         consecutive stops, OpenStreetMap tile basemap, pan/zoom enabled
        └─ no  → today's exact schematic view (code kept as-is, not deleted)
```

## 4. Components

### New
- `src/lib/location-coordinates.ts` — `resolveCoordinates(name: string): Promise<{ lat: number; lng: number } | null>`. Queries `ports_locations`, `airports`, `cities`, `transfer_points` in that priority order (first non-null match wins), normalizing each table's different coordinate shape into `{lat, lng}`. In-memory `Map<string, {lat,lng}|null>` cache keyed by a normalized (trimmed, lowercased) name — a session lives as long as the page, so this is a plain module-level cache, not a persistent store.

### Modified
- `src/components/common/LocationAutocomplete.tsx` — add the relevant coordinate column(s) to all 5 `.select(...)` calls; extend the `location` object passed to `onChange` with resolved `{lat, lng}` (parsed the same way `PortLocationForm.tsx` already parses `ports_locations.coordinates`, for consistency with existing code, not a new parsing convention).
- `src/types/quote-breakdown.ts` — add optional `lat?: number; lng?: number` to `TransportLeg`.
- `src/hooks/useRateFetching.ts` — inside the existing `enrichOptionRouteData` normalization pass, call `resolveCoordinates` for each leg's origin/destination name and attach the result.
- `src/components/quotation/shared/QuoteMapVisualizer.tsx` — rewritten. Accepts the same `origin`/`destination`/`legs` props as today, now optionally carrying coordinates; internally decides real-map vs. schematic per the architecture above. Imports `leaflet/dist/leaflet.css` directly in this file (component-scoped, not global — this component is not on every page).
- `src/components/quotation/shared/QuoteResultsList.tsx`, `src/components/quotation/shared/QuoteDetailView.tsx`, `src/components/quotation/composer/QuoteOptionsOverview.tsx` — pass the now-available coordinate fields through to `QuoteMapVisualizer`; no other change.
- `package.json` — add `leaflet@^1.9.4`, `react-leaflet@^4.2.1` (dependencies), `@types/leaflet@^1.9.22` (devDependency). These specific versions are required, not the latest majors — `react-leaflet@5.x` needs React 19, which this app does not have.

### Untouched
- Everything about the schematic rendering path in `QuoteMapVisualizer.tsx` — kept verbatim as the fallback, not rewritten or deleted.
- `UnifiedQuoteComposer.tsx` and every other page — no direct changes; they benefit automatically because `QuoteMapVisualizer` is shared.

## 5. Marker rendering (a known Leaflet gotcha, addressed by design)

Leaflet's default marker icons are well known to break under bundlers (broken image paths under Vite/webpack). This design avoids the issue entirely by never using Leaflet's default `L.Icon` — all markers are custom `L.divIcon`s rendering the same mode icons (Ship/Plane/Truck/Train) already used by `QuoteLegsVisualizer` and `quote-badges.tsx`'s `getModeIcon`, keeping the visual language consistent with the rest of the app and sidestepping the bug rather than working around it.

## 6. Data Flow / Error Handling

No new user-facing error states. A coordinate-resolution miss is not an error — it is the normal trigger for the schematic fallback for that specific option. The resolver never throws to its caller; a lookup miss (network issue, no match in any table) resolves to `null`, same as "not found."

## 7. Testing

- Unit tests for `location-coordinates.ts`: table-priority order (a `ports_locations` hit wins over an `airports` hit for the same name), each table's shape-normalization (`Json` object vs. direct columns), cache behavior (second call for the same name does not re-query), and the `null`-on-miss contract.
- `QuoteMapVisualizer` tests for both render paths: real map when every leg resolves, schematic fallback when any leg doesn't (including the exact current schematic tests, if any exist in `ui-consistency.test.tsx`, continuing to pass).
- Before writing `react-leaflet`-based tests, verify Leaflet actually mounts cleanly under this repo's Vitest/jsdom setup (a known trouble spot for map libraries under test runners that lack real browser layout APIs) — resolve this as a concrete finding during plan-writing/Task 1, not assumed here.
- No new tests required for `QuoteResultsList`/`QuoteDetailView`/`QuoteOptionsOverview` beyond confirming their existing suites still pass with the new props threaded through.

## 8. Rollout

Single PR/commit series, additive at the shared-component level. No feature flag — every consumer gets the improvement automatically once the fallback logic is in place, and the fallback guarantees no regression for options whose coordinates can't be resolved.
