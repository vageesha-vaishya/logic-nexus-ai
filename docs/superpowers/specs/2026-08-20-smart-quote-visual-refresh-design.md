# Smart Quote Workspace - Visual & Layout Refresh - Design Specification

**Date:** 2026-08-20
**Scope:** Give `/dashboard/quotes/smart-quote` a distinctive visual identity and a card-based results view, replacing the current stock Shadcn look and Browse/Compare tab toggle entirely — the new card view is the only results view on this page, not an additional option alongside the old ones.
**Status:** Approved for implementation

## 1. Background

The user assessed the CRM Sales→Quote UI/UX as "traditional and conservative" and asked for a direction that reads as ahead of competitors rather than a stock component-library default. A visual concept (command-first build/compare layout, a maritime/industrial type and color system) was mocked up and approved as the target direction — published as an Artifact for reference (`command-quote-composer.html`, not part of this repo).

Scoping that concept into buildable work surfaced four largely independent pieces:
1. Visual identity (type/color tokens) + layout — **this spec**
2. A real, functional `⌘K` global command palette — deferred
3. Freeform-text-to-structured-fields AI parsing — deferred (no parser exists in the codebase today; the mockup's freeform textarea implied a capability that doesn't exist yet)
4. Applying the identity beyond this one page — deferred

This spec covers only piece 1, scoped to the one page whose existing structure (`src/pages/dashboard/SmartQuoteWorkspace.tsx`, created in `docs/superpowers/plans/2026-08-19-smart-quote-workspace.md`) already has the build/compare shape the concept calls for — it already renders a 400px form panel beside a results panel. There is no information-architecture change required, only presentation.

## 2. Goals / Non-Goals

**Goals:**
- Apply a distinctive, fixed visual identity (color + type tokens) to `SmartQuoteWorkspace.tsx`, scoped so no other page is affected.
- Replace the results panel's default Browse/Compare tab toggle with a single new card view styled per the approved concept (tier badge, tabular-mono pricing, route-leg dots).
- Add a live shipment recap strip above the results panel, built from real form state (no fabricated data).
- Preserve all existing functionality: rate generation, selection, quote detail viewing, and hand-off to `QuoteNew.tsx` via `QuoteTransferSchema`.

**Non-Goals:**
- No new AI/NLP capability. The Build panel keeps today's real structured inputs (mode tabs, `LocationAutocomplete`, `SharedCargoInput`) — no freeform-text entry field ships in this spec.
- No functional `⌘K` / global command palette. DashboardLayout's shared header chrome is untouched.
- No changes to `UnifiedQuoteComposer`, `QuoteNew.tsx`, or the "Smart Quote Mode" toggle inside the general composer. Both entry points continue to coexist as before.
- No changes to the shared `QuoteResultsList`, `QuoteComparisonView`, `QuoteDetailView`, or `QuickQuoteHistory` components' own styling — they are reused only where explicitly noted (the detail dialog, the history dialog trigger), never restyled internally, since all four are also rendered inside `UnifiedQuoteComposer`.
- Dropping the Market/AI source filter toggle (`QuoteResultsList`'s internal `filterType: all/market/ai`) from this page's default view is a deliberate scope cut, not an oversight — each new card still shows its own source-attribution badge (§5), so the information isn't lost, only the filter control. A filter can be reintroduced in a follow-up if needed.
- Not surfacing `marketAnalysis`/`confidenceScore`/`anomalies` (returned by `useRateFetching`) in the new results panel is not a regression: these props are already passed to `QuoteResultsList` today but never rendered anywhere in it or in `QuoteComparisonView` (verified by reading both files) — they are currently dead in the UI. Surfacing them is a reasonable future enhancement, explicitly deferred rather than pulled into this visual-only spec.
- No change to the tenant-configurable theme preset system (`useTheme`, `ui_themes`, `themeStyleFromPreset`) itself — this page simply stops consuming it (see §4).
- Not applying this identity to any other Quote page (Pipeline, Quotes list, `UnifiedQuoteComposer`) — candidate for a later spec.

## 3. Architecture

```
SmartQuoteWorkspace.tsx (restyled)
  ├─ .smart-quote-identity wrapper — scoped CSS custom properties (color + font tokens),
  │    replaces the current themeStyleFromPreset(theme) call on this page
  ├─ Build panel (existing form: mode tabs, LocationAutocomplete x2, SharedCargoInput)
  │    — restyled wrapper/spacing/labels only; all existing logic (react-hook-form,
  │      useContainerRefs, deriveSharedPayload) unchanged
  │    — NEW: ShipmentRecapStrip — reads form.watch() + cargoItem, renders chips once
  │      origin + destination are non-empty; purely derived, no new state
  ├─ Results panel — four states, all driven by existing `rateFetching` fields (no new state):
  │    — Empty (no fetch yet): restyled (new type/color), same copy intent ("fill out the form")
  │    — Loading (`rateFetching.loading === true`): NEW — today the panel body doesn't change
  │      while a request is in flight (only the button relabels to "Generating..."); this spec
  │      adds a `--sq-tide`-toned loading indicator in the results panel itself, echoing the
  │      approved concept's pulsing AI-status line. Reduced-motion-safe (see §7).
  │    — Error (`rateFetching.error` non-null): NEW — today an error only reaches the user via
  │      a toast; this spec adds an inline `--sq-rust`-toned error state in the results panel
  │      using the hook's real `error` string, alongside the existing toast (toast unchanged).
  │    — Results: NEW SmartQuoteRateCard list (replaces the current Browse/Compare
  │      Tabs + QuoteResultsList/QuoteComparisonView pairing) — one card per RateOption,
  │      multi-select via checkbox (existing `selectedIds`/`onToggleSelection` model — the
  │      approved concept mockup showed a single highlighted card, but actual behavior stays
  │      multi-select to preserve `handleConvertSelected`'s "N options selected" flow)
  │      — Results-panel header keeps the existing "Generate Smart Options" regenerate action
  │        (`onGenerateSmartOptions`, shown when `smartMode` is on), restyled
  │      — Each card's "Details" action opens the existing QuoteDetailView inside the
  │        existing Dialog pattern (unstyled, reused as-is — it's a modal overlay, not
  │        page chrome, so reuse carries no cross-page styling risk)
  │      — Each card's "Select" action calls the existing toggleSelection / handleConvertToQuote
  ├─ QuickQuoteHistory (header, next to breadcrumb) — reused as-is; only its trigger button is
  │    restyled via the `className` prop it already accepts. Its dialog content is untouched,
  │    same reasoning as QuoteDetailView (overlay, not page chrome) — it is also rendered
  │    inside UnifiedQuoteComposer, so its internals are out of scope here.
  └─ Sticky action bar (existing "N options selected / Create Quote with Selected") — restyled
       in place, same handleConvertSelected logic
```

Rate generation, selection state, and the hand-off contract to `QuoteNew.tsx` are entirely unchanged — this is a presentation-layer-only spec.

All existing `data-testid` attributes on retained interactive elements (e.g. `smart-mode-switch`) must be preserved through the restyle — other tests and any future cross-page consistency checks depend on them.

## 4. Visual Identity Tokens

**Color** (fixed — this page no longer calls `themeStyleFromPreset`; it does not read or react to the tenant's active theme preset, the same way the unrelated Sthira module has its own fixed type system):

| Token | Light | Dark | Use |
|---|---|---|---|
| `--sq-ink` | `#0E2430` | `#EAF1EF` | primary text |
| `--sq-bg` | `#EEF2F1` | `#0E2430` | page ground |
| `--sq-surface` | `#FFFFFF` | `#15303D` | panels/cards |
| `--sq-border` | `#D3DCDA` | `#2B4652` | borders |
| `--sq-accent` | `#C97F1C` | `#E3A64A` | primary action (buttons, selected state) |
| `--sq-accent-ink` | `#1A1103` | `#1A1103` | text on accent |
| `--sq-tide` | `#1B8F86` | `#4FC9BE` | AI/live-status accent — distinct from `--sq-accent`, never used for primary actions |
| `--sq-good` | `#2F8F5B` | `#5CC48D` | semantic success only (reliability score, low-emission/CO2 badge) — not the page accent |
| `--sq-rust` | `#B23A24` | `#E4826A` | semantic error/destructive only |

**Correction from initial draft:** this app does not use `prefers-color-scheme` or a `data-theme` attribute for dark mode — verified against `src/hooks/useTheme.tsx` and `tailwind.config.ts` (`darkMode: ["class"]`). Dark mode is a manually-toggled `.dark` class on `document.documentElement` (`useTheme.tsx`'s `toggleDark`, persisted to `localStorage`), independent of the tenant color preset. Dark-mode token values apply via a `.dark .smart-quote-identity { ... }` selector override, matching how the rest of the app scopes dark styling — not a media query.

**Type:**
- Display (`--sq-font-display`): "Big Shoulders Display" — page `h1`, panel headers.
- Body/UI (`--sq-font-body`): "IBM Plex Sans" — form labels, buttons, card copy.
- Mono (`--sq-font-mono`): "IBM Plex Mono" — route/port codes, prices, transit days, recap-chip values. `font-variant-numeric: tabular-nums` wherever prices or day counts stack vertically.

**Correction from initial draft:** this codebase's real precedent for a module with its own distinctive fonts is the Sthira module, which self-hosts via `@fontsource/*` npm packages imported at `src/main.tsx` (`@fontsource/source-serif-pro`, `@fontsource/inter`) — not a Google Fonts `<link>` tag, which was only how the earlier concept mockup (an Artifact, under a different CSP) loaded fonts. This spec follows the codebase's actual convention: add `@fontsource/big-shoulders-display`, `@fontsource/ibm-plex-sans`, and `@fontsource/ibm-plex-mono` as dependencies, imported only from the new `smart-quote-identity.css` (scoped to this page's lazy-loaded chunk, not `main.tsx`, so no other page's bundle grows). The `font-family` is applied only inside `.smart-quote-identity`, so no other page's typography changes.

## 5. Components

### New
- `src/components/quotation/smart-quote/SmartQuoteRateCard.tsx` — one rate option's card. Must carry forward every informational element the current shared card shows for this data (dropping any of these silently would be a functional regression, not just a restyle):
  - Carrier name, tier badge (new tier→label mapping matching `getTierBadge`'s tier strings — `contract`/`spot`/`best_value`/`cheapest`/`fastest`/`greenest`/`reliable` — rendered with the new badge tokens; `getTierBadge` itself returns hardcoded Tailwind colors and is not reused directly, only its tier-to-label semantics)
  - Source-attribution badge (AI Generated / Manual / Market Rate — same semantics as `OptionSourceBadge` in `QuoteResultsList.tsx`, restyled: e.g. `--sq-tide` for AI Generated, neutral ink for Manual/Market Rate)
  - Price in `--sq-font-mono` with `tabular-nums`; markup% and margin amount when present (`option.markupPercent`, `option.marginAmount`)
  - Transit time, a route-leg dot strip, "Verified" indicator + timestamp when `option.verified` is set
  - Reliability score badge and CO2/environmental badge when present (`option.reliability`, `option.co2_kg`/`option.environmental`) — semantic colors only (`--sq-good`/`--sq-rust` bands), never `--sq-accent`
  - AI explanation text when present (`option.ai_explanation`), tinted with `--sq-tide` instead of the current purple
  - `getModeIcon` (`src/components/quotation/shared/quote-badges.tsx`) is reused as-is for the transport-mode icon — it carries no hardcoded color and inherits `currentColor`
  - Props: `option: RateOption`, `isSelected: boolean`, `onToggleSelection: () => void`, `onSelect: () => void`, `onViewDetails: () => void`
- `src/components/quotation/smart-quote/ShipmentRecapStrip.tsx` — chip row summarizing current form state (mode, origin, destination, cargo). Props: plain derived values, no internal state. Renders `null` until origin and destination are both non-empty.
- `src/components/quotation/smart-quote/smart-quote-identity.css` (or a `<style>`/CSS-in-JS block colocated with the page — implementer's call, following whatever pattern `themeStyleFromPreset` already uses for scoped styling) — defines the token custom properties and font import.
- **Extraction required:** `QuoteResultsList.tsx`'s route-leg normalization (`mapLegsForVisualizer` and its `normalizePoint` helper, `QuoteResultsList.tsx:208-257`) is module-local and not exported today — the earlier draft's claim that the new card "reuses" it wasn't actually buildable as written. A near-identical normalization also exists inline inside `QuoteLegsVisualizer.tsx`. This spec requires extracting one shared, exported version (e.g. `src/lib/quote-legs.ts`) that `QuoteResultsList` and the new `SmartQuoteRateCard` both import, rather than adding a third divergent copy. `QuoteResultsList`'s own behavior must not change — this is a pure extraction, verified by its existing tests continuing to pass unmodified.

### Modified
- `src/pages/dashboard/SmartQuoteWorkspace.tsx`:
  - Remove the `useCRMModuleNavigationState('quotes', ...)` / `themeStyleFromPreset(theme)` call and its wrapping `style` prop; replace with the `.smart-quote-identity` wrapper.
  - Remove the `viewMode` state and Browse/Compare `Tabs`/`TabsList`/`TabsTrigger` around the results panel.
  - Replace `QuoteResultsList`/`QuoteComparisonView` rendering with a mapped list of `SmartQuoteRateCard`, plus a `Dialog` wrapping `QuoteDetailView` for the "Details" action (same pattern `QuoteResultsList` already uses internally, moved up into the page).
  - Insert `ShipmentRecapStrip` above the results panel, fed from `form.watch()` and `cargoItem`.
  - Restyle the Smart Quote Mode banner, mode tabs, buttons, breadcrumb, and sticky action bar to the new tokens; no logic changes to `smartMode`, `handleGenerate`, `toggleSelection`, `handleConvertToQuote`, `handleConvertSelected`.

### Untouched
- `QuoteResultsList`, `QuoteComparisonView` — no longer rendered by this page, left exactly as they are for `UnifiedQuoteComposer`, aside from the pure extraction noted above.
- `QuoteDetailView` — reused as-is inside a `Dialog`, unstyled.
- `QuickQuoteHistory` — reused as-is; only its trigger button's `className` changes.
- `useRateFetching`, `useContainerRefs`, `LocationAutocomplete`, `SharedCargoInput`, `QuoteTransferSchema`, `deriveSharedPayload`, `formatCommodityDisplay` — all logic unchanged.

## 6. Data Flow / Error Handling

No changes to success-path flow. `handleGenerate` still calls `rateFetching.fetchRates(...)`; `handleConvertToQuote` still validates via `QuoteTransferSchema.parse()` and navigates to `/dashboard/quotes/new` with the raw `selectedOptions` (per the existing, already-fixed leg-charges gotcha documented inline in the current code). Toasts for validation/generation errors are unchanged in trigger. New: the results panel also renders `rateFetching.error` inline (§3) — additive to the existing toast, not a replacement for it.

## 7. Quality Floor & Consistency

- **Accessibility:** all new interactive elements (cards, chips, badges acting as controls) get a visible keyboard-focus state; any pulsing/animated indicator (loading state, per §3) respects `prefers-reduced-motion`; token color pairs used for text-on-fill (e.g. `--sq-accent-ink` on `--sq-accent`) must meet WCAG AA contrast — verify at implementation time, not assumed from the concept mockup.
- **Copy/i18n:** `SmartQuoteWorkspace.tsx`'s own copy is already hardcoded English today (breadcrumb, headers, hints are not run through `useTranslation`, unlike the one string inside `QuoteResultsList`). New copy in this spec follows that existing page precedent — hardcoded English — rather than introducing a partial, inconsistent i18n boundary. Not a goal of this spec to newly localize the page.
- **Responsiveness:** the page's current fixed `w-[400px]` form / `flex-1` results split has no responsive collapse today. This spec preserves that existing behavior as-is (it is a desktop-oriented ops tool); adding mobile responsiveness is out of scope, not a regression to fix here.

## 8. Testing

- New render tests for `SmartQuoteRateCard` covering every carried-forward field in §5 (tier badge, source-attribution badge, price/markup/margin formatting, verified indicator, reliability/CO2 badges, AI explanation text, route-dot count) using `RateOption` fixtures already used elsewhere in the test suite.
- New render tests for `ShipmentRecapStrip` (renders null before origin/destination are set; renders expected chips once set).
- New tests for the extracted route-leg normalization util (§5), covering the same cases `QuoteResultsList`'s inline version handled — a pure move, not a behavior change.
- New render tests for the results panel's loading and error states (§3), since neither currently has dedicated coverage.
- Update `SmartQuoteWorkspace.test.tsx` / `SmartQuoteWorkspace.handoff.test.tsx` for the new markup (no Browse/Compare tabs to query for; assert against the new card list instead). The hand-off contract assertions (payload shape passed to `/dashboard/quotes/new`) do not change.
- Existing `QuoteResultsList`/`QuoteComparisonView`/`QuoteDetailView`/`QuickQuoteHistory` test suites must continue to pass unmodified after the extraction — they are the regression guard that the shared components truly weren't behaviorally touched.
- Manual/visual check: confirm `UnifiedQuoteComposer`'s results view (Grid/Table/Compare) renders identically before and after this change, since it consumes the same shared components this spec explicitly does not touch.

## 9. Rollout

Single PR/commit, additive-and-replacing within one page. No feature flag — `SmartQuoteWorkspace` is only reachable via the "Smart Quote" button, already shipped in this same initiative; no external dependents on its current visual markup.
