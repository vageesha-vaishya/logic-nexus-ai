# Unified Quote Composer — Design Document

**Date**: 2026-02-17
**Status**: Approved
**Goal**: Replace the two separate quote creation flows (QuickQuoteModal + MultiModalQuoteComposer) with a single progressive-disclosure page.

---

## Problem

Users encounter two different UIs for creating quotes depending on where they click:

- **QuickQuoteModal** (1,113 lines) — a dialog accessible from the Quotes list and Pipeline pages. Despite being called "quick", it includes AI features, carrier filtering, multi-container config, and compliance checks.
- **MultiModalQuoteComposer** (2,910 lines) — a 4-step wizard (Quote Details → Transport Legs → Charges → Review & Save) loaded on the QuoteNew and QuoteDetail pages.

Both duplicate significant logic (carrier selection, mode switching, container config, AI integration). Data handoff between the modal and full composer is fragile. Users are confused about when to use which flow.

## Solution

One single-page quote creator with progressive disclosure. Start with 4-5 essential fields, expand as needed. No modal, no multi-step wizard.

---

## Layout

The page splits into two vertical zones:

### Form Zone (top)

```
┌─────────────────────────────────────────┐
│  ← Back to Quotes          Draft saved  │
├─────────────────────────────────────────┤
│  [Air] [Ocean] [Road] [Rail]   ← tabs  │
│                                         │
│  Origin ______   Destination ______     │
│  Commodity ____  Weight ____            │
│                                         │
│  ▸ More options (carrier, cargo, legs)  │
│                                         │
│  [Get Rates]            [Save as Draft] │
└─────────────────────────────────────────┘
```

- **Always visible**: Transport mode tabs, origin, destination, commodity, weight/volume.
- **"More options" expandable**: A single flat panel (not nested accordions) with mode-specific optional fields in a 2-column grid.
- **Sticky action buttons**: "Get Rates" and "Save as Draft" are always accessible.

Nothing in "More options" is required to get rates. A user can fill mode + origin + destination + commodity + weight and submit immediately.

### Results Zone (bottom)

```
┌─────────────────────────────────────────┐
│  Sort: Price | Transit | Carrier  [≡/▦] │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Option 1│ │ Option 2│ │ Option 3│   │
│  │ Carrier │ │ Carrier │ │ Carrier │   │
│  │ $2,400  │ │ $2,850  │ │ $3,100  │   │
│  │ 14 days │ │ 10 days │ │ 7 days  │   │
│  │ [Select]│ │ [Select]│ │ [Select]│   │
│  └─────────┘ └─────────┘ └─────────┘  │
│                                         │
│  AI: "Ocean rates trending 8% above Q4" │
├─────────────────────────────────────────┤
│  FINALIZE (appears after selecting)     │
│  Selected: Carrier X — $2,400 — 14 days│
│  Charges table (editable)               │
│  Margin input                           │
│  Notes field                            │
│  [Save Quote]         [Generate PDF]    │
└─────────────────────────────────────────┘
```

- Empty state before rates are fetched: "Configure above and hit Get Rates."
- Cards in a horizontal row, scrollable on small screens.
- Sorting controls: Price (default), Transit Time, Carrier. List/grid toggle.
- Selecting an option highlights the card and reveals the "Finalize Quote" inline section below.
- AI insights render as a subtle banner between results and finalize section.

---

## More Options — Mode-Specific Fields

### Air
- Carrier preferences (multi-select dropdown)
- Dimensions (L x W x H)
- Dangerous goods toggle
- Special handling notes

### Ocean
- Carrier preferences
- Container config (type, size, quantity + "add another" for multi-container)
- FCL / LCL toggle
- Dangerous goods toggle

### Road
- Carrier preferences
- Vehicle type selector
- Pickup date / delivery deadline

### Rail
- Carrier preferences
- Container config (same as ocean)
- Pickup date / delivery deadline

### All Modes
- HTS code / Schedule B (AI auto-suggest from commodity)
- Special handling notes

The panel remembers its open/closed state during the session. Toggling modes does not collapse it.

---

## Editing Existing Quotes

The same page serves create and edit. When opened with a `quoteId` (`/quotes/:id/edit`):

- Form pre-populates with saved data
- "More options" auto-expands if optional fields have values
- Results zone shows the previously selected rate with a "Selected" badge
- Finalize section pre-fills with saved charges and notes

**Re-running rates**: User can hit "Get Rates" again for fresh results. A confirmation prompt appears: "This will replace current rates. Your charges will be preserved. Continue?"

**Versioning**: Each save after re-running rates creates a new version (existing `versionId` system). This page always edits the latest version.

**Draft auto-save**: Form auto-saves to draft every 30 seconds (debounced) via `save_quote_atomic` with `status: 'draft'`. A "Draft saved" indicator shows in the top bar. Navigating away and returning restores the draft.

---

## Migration Plan

### Entry Points Changed

| Location | Before | After |
|----------|--------|-------|
| `Quotes.tsx` | `<QuickQuoteModal>` dialog | `<Button>` navigating to `/quotes/new` |
| `QuotesPipeline.tsx` | `<QuickQuoteModal>` dialog | `<Button>` navigating to `/quotes/new` |
| `/quotes/new` route | `QuoteNew.tsx` (loads composer) | New unified component |
| `/quotes/:id/edit` route | `QuoteDetail.tsx` (loads composer) | Same unified component, pre-populated |

### Components Removed

- `QuickQuoteModal.tsx` (1,113 lines)
- `QuickQuoteModalContent.tsx`
- `QuoteResultsList.tsx` — absorbed into new results zone
- `QuoteComparisonView.tsx` — absorbed into new results zone

### Components Kept & Reused

- `MultiModalQuoteComposer.tsx` — restructured into the new single-page layout
- `ChargesManagementStep` — becomes inline charges editor in finalize section
- `TransportModeSelector` — becomes the tab bar in form zone
- `CarrierSelect` — reused in "More options" panel
- `ValidationFeedback`, `SaveProgress` — reused as-is
- `LocationAutocomplete`, `SmartCargoInput` — reused in form zone
- All hooks: `useAiAdvisor`, `useContainerRefs`, `useCarriersByMode`, `useQuoteRepository`
- All services: `QuoteOptionService`, `QuoteTransformService`, `PricingService`

### Tests

- 5 QuickQuoteModal tests → rewrite for new component
- Existing composer tests (charges, legs, validation) → stay valid, update imports

### Net Impact

- ~2,000 lines of duplicated UI code removed
- One flow replaces two
- Same underlying data layer, no backend changes needed
