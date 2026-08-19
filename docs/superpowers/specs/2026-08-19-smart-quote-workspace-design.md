# Smart Quote Workspace - Design Specification

**Date:** 2026-08-19
**Scope:** Revive the deleted standalone Smart Quote / Quick Quote module as an independent page in the Quotation module
**Status:** Approved for implementation

## 1. Background

A standalone "Quick Quote" / "Smart Quote" module existed in this codebase from commit `095b64b9` (2026-01-23) until it was consolidated into `UnifiedQuoteComposer` in commit `a98b136c` (2026-02-18). That consolidation deleted the standalone modal/page (`QuickQuoteModal.tsx`, `QuickQuoteModalContent.tsx`, `MultiModalQuote.tsx`, `MultiModalQuoteComposer.tsx`) but **kept every backend dependency and result-rendering component alive**, relocating the latter to `src/components/quotation/shared/` where they're still used today by `UnifiedQuoteComposer`'s `ResultsZone`.

Verified still-live and unchanged:
- Edge function `rate-engine` (invoked via `useRateFetching`), 5-tier AI ranking (Best Value/Cheapest/Fastest/Greenest/Reliable)
- `ai_quote_requests` table (migration `20260126000000_ai_quote_requests.sql`)
- `QuoteTransformService` (`@/lib/services/quote-transform.service`)
- `PricingService` (`@/services/pricing.service`)
- `mapOptionToQuote`, `calculateQuoteFinancials` (`@/lib/quote-mapper`)
- `QuoteTransferSchema` (`@/lib/schemas/quote-transfer`)
- Shared result components: `QuoteResultsList`, `QuoteComparisonView`, `QuoteDetailView`, `QuoteLegsVisualizer`, `QuoteMapVisualizer`, `QuickQuoteHistory` — all in `src/components/quotation/shared/`
- The receiving half of the hand-off is already live in `QuoteNew.tsx`, which builds `initialData` from `location.state` (comment references "QuickQuoteHistory pre-population")
- Documented pipeline: `docs/quote-data-pipeline.md`

This spec restores the *sending* side as a real, independent page rather than re-merging it into the general composer.

## 2. Goals / Non-Goals

**Goals:**
- A standalone page at `/dashboard/quotes/smart-quote`, separate from `UnifiedQuoteComposer`.
- Full feature parity with the deleted module: 5-tier AI generation, results list, comparison view, map visualizer, route-legs visualizer, quote history.
- Hands off into the *same* `quotes`/`quote_versions` tables as the rest of the Quotation module via the existing `QuoteNew.tsx` receiving logic — not an isolated data island.
- The "Smart Quote" button already added to `QuotationManager.tsx` and `Quotes.tsx` becomes the entry point to this page.

**Non-Goals:**
- Not reviving `MultiModalQuoteComposer.tsx` (2,910 LOC) — fully superseded by `UnifiedQuoteComposer`; reviving it would be pure duplication.
- Not removing or altering the in-composer "Smart Quote Mode" toggle in `UnifiedQuoteComposer`/`FormZone` — both entry points coexist.
- Not changing the `rate-engine`/`ai-advisor` edge functions or their schemas.
- Not resurrecting all 17 deleted test files verbatim (they tested a modal, not a page) — new tests target the actual page + hand-off contract.

## 3. Architecture

```
User clicks "Smart Quote" button (QuotationManager.tsx / Quotes.tsx)
        ↓
  navigate('/dashboard/quotes/smart-quote')
        ↓
  SmartQuoteWorkspace.tsx  (new page, DashboardLayout + breadcrumb)
        ↓ (lightweight shipment form: mode/origin/destination/cargo/dates)
  useRateFetching → rate-engine edge function (5-tier AI ranking)
        ↓
  Results render via shared components:
    QuoteResultsList / QuoteComparisonView / QuoteMapVisualizer / QuoteLegsVisualizer
        ↓ (user selects one option)
  QuoteTransformService + quote-mapper build a QuoteTransferSchema payload
        ↓
  navigate('/dashboard/quotes/new', { state: payload })
        ↓
  QuoteNew.tsx (existing receiving logic) → persists into quotes/quote_versions
        ↓
  QuickQuoteHistory (shared component) shows past Smart Quote runs
```

## 4. Components

### New
- `src/pages/dashboard/SmartQuoteWorkspace.tsx` — the page. Wraps content in `DashboardLayout`, `themeStyleFromPreset(theme)` (matching every other Quotation page), breadcrumb `Dashboard > Quotes > Smart Quote`. Contains the ported form + generation logic from the deleted `QuickQuoteModalContent.tsx`, adapted from modal chrome to page layout (no `Dialog`/`DialogContent` wrapper; a `Cancel`/`Back to Quotes` action replaces modal close).

### Reused as-is (no changes)
- `useRateFetching` (`src/hooks/useRateFetching.ts`)
- `QuoteResultsList`, `QuoteComparisonView`, `QuoteDetailView`, `QuoteLegsVisualizer`, `QuoteMapVisualizer`, `QuickQuoteHistory` (`src/components/quotation/shared/`)
- `QuoteTransformService`, `PricingService`, `quote-mapper`, `QuoteTransferSchema`
- `SharedCargoInput`, `useContainerRefs`, `useIncoterms` (form building blocks already used elsewhere in the composer)

### Modified
- `src/pages/dashboard/QuotationManager.tsx` — "Smart Quote" button `onClick` changes from `navigate('/dashboard/quotes/new')` to `navigate('/dashboard/quotes/smart-quote')`.
- `src/pages/dashboard/Quotes.tsx` — same button change.
- `src/App.tsx` — new lazy-loaded route:
  ```tsx
  const SmartQuoteWorkspace = lazy(() => import('./pages/dashboard/SmartQuoteWorkspace'));
  ...
  <Route
    path="/dashboard/quotes/smart-quote"
    element={
      <ProtectedRoute requiredPermissions={["quotes.view"]}>
        <SmartQuoteWorkspace />
      </ProtectedRoute>
    }
  />
  ```
  (permission matches the existing `/dashboard/quotes/pipeline` route)

## 5. Data Flow / Hand-off Contract

The page never writes directly to `quotes`/`quote_versions`. It only:
1. Calls `rate-engine` (read-only rate generation, may write to `ai_quote_requests` for caching/audit, matching old behavior).
2. On selection, builds a `QuoteTransferSchema`-shaped payload via the existing `QuoteTransformService`/`quote-mapper`.
3. Navigates to `/dashboard/quotes/new` with that payload as router state.

This means all validation, persistence, and GL/downstream side effects stay exactly where they already are today in `QuoteNew.tsx` — the new page is purely a generation/selection front-end feeding the existing pipeline, matching the original module's boundary.

## 6. Error Handling

No new patterns. Reuse what the rest of the Quotation module already does:
- `toast.error(...)` on `rate-engine` failures (same pattern as `UnifiedQuoteComposer`).
- DB/API fallback banner styling consistent with other CRM/Quotation pages (amber banner, `resolveCrmFallbackBannerCopy`-style copy) if `rate-engine` is unreachable.
- Form validation errors surfaced inline, same as `FormZone`.

## 7. Testing

- Smoke test: `SmartQuoteWorkspace` renders, route is reachable, permission-gated correctly.
- Integration test: generation → selection → hand-off payload shape matches what `QuoteNew.tsx` expects from `location.state` (this is the contract that matters most, since it's the actual "pipeline").
- No new tests for the shared result components — they already have coverage from their current use inside `UnifiedQuoteComposer`.

## 8. Rollout

Single PR/commit. No feature flag — the page is net-new and additive; the "Smart Quote" button repoint is the only behavior change to existing pages, and it was added by us in this same work session (not yet shipped/depended upon), so no migration concern.
