# Smart Quote Mode & Rate Visibility Logic

## Overview
This document details the implementation of **Smart Quote Mode** and the rate visibility logic within the Unified Quotation Composer. The goal is to ensure precise control over which rate options are displayed to the user, preventing the "critical display logic error" where market rates were incorrectly populated.

## Core Concepts

### 1. Smart Quote Mode vs. Standard Mode
The `UnifiedQuoteComposer` operates in two distinct modes, determined by the `isSmartMode` state:

*   **Standard Mode**:
    *   **Behavior**: Traditional rate fetching.
    *   **Default Selection**: Automatically selects the highest-ranked rate option (usually the first one returned).
    *   **Visibility**: Displays the selected default option in the "Rate Options" list. All other fetched options are hidden in "Available Market Rates".
    *   **AI Analysis**: Optional/Supplementary.

*   **Smart Quote Mode**:
    *   **Behavior**: AI-driven analysis with market rate context.
    *   **Default Selection**: **NONE**. No rate options are pre-selected.
    *   **Visibility**:
        *   **AI Market Analysis**: Prominently displayed at the top.
        *   **Rate Options**: **HIDDEN** initially (since no option is selected).
        *   **Available Market Rates**: All fetched market rates are listed here for manual selection.
    *   **User Action**: Users must explicitly "Add" a rate from the "Available Market Rates" list to build their quote.

### 2. Rate Visibility Control
Visibility is managed strictly through the `visibleRateIds` state array in `UnifiedQuoteComposer`.

*   **Source of Truth**: `visibleRateIds` contains the IDs of rates that should appear in the main "Rate Options" list (and thus be part of the quote).
*   **Filtering**:
    *   `fetchedResults`: All rates returned by the API.
    *   `displayResults`: `fetchedResults` filtered by `visibleRateIds`.
    *   `availableOptions`: `fetchedResults` EXCLUDING `visibleRateIds`.

This decoupling ensures that API responses do not automatically flood the quote with options unless explicitly authorized by the logic.

## Component Hierarchy & Data Flow

```
UnifiedQuoteComposer (State: visibleRateIds, isSmartMode)
├── FormZone (Triggers search, sets isSmartMode)
├── ResultsZone (Props: results, smartMode, availableOptions)
│   ├── AiMarketAnalysis (Renders AI insights)
│   ├── QuoteResultsList (Renders 'displayResults' - The selected options)
│   └── [Available Rates Section] (Renders 'availableOptions')
└── FinalizeSection (Only visible if selectedOption exists)
```

### Critical Logic Points

1.  **Initialization (useEffect in UnifiedQuoteComposer)**:
    ```typescript
    useEffect(() => {
      if (rateFetching.results && rateFetching.results.length > 0) {
        if (!isSmartMode) {
          setVisibleRateIds([rateFetching.results[0].id]); // Standard: Select 1st
        } else {
          setVisibleRateIds([]); // Smart: Select NONE
        }
      }
    }, [rateFetching.results, isSmartMode]);
    ```

2.  **Rendering (ResultsZone)**:
    *   If `smartMode` is active, `AiMarketAnalysis` is rendered first.
    *   `QuoteResultsList` is only rendered if `results` (the visible ones) is non-empty.
    *   "Available Market Rates" section is always rendered if `availableOptions` exist.

### 3. "Add Option" (Manual) Button Visibility
The "Add Option" button (for creating purely manual rates) is located within the "Rate Options" section header.
*   **Visibility Rule**: It is only visible when `hasResults` is true (i.e., at least one option is currently selected/visible).
*   **Implication for Smart Mode**: Initially, since no options are selected, the "Rate Options" section (and thus the "Add Option" button) is hidden. Users must select at least one market rate from the "Available Market Rates" list to reveal the "Rate Options" section, after which they can add manual options if desired. This enforces a workflow where Smart Quotes start with market data.

## Validation & Constraints

*   **At Least One Option**: The `FinalizeSection` (containing the Save button) is conditionally rendered `selectedOption && ...`. Since `selectedOption` is derived from `displayResults`, a user **cannot save a quote** without selecting at least one option. This implicitly enforces the constraint.
*   **Deletion**: When removing an option, `handleRemoveOption` prevents removing the last visible option to maintain a valid state (once an option is selected).

## Testing

*   **Unit Tests**: `src/components/sales/unified-composer/__tests__/SmartMode.test.tsx` verifies:
    *   Standard Mode selects default option.
    *   Smart Mode selects NO option and shows analysis.
*   **Component Tests**: `src/components/sales/unified-composer/__tests__/ResultsZone.test.tsx` verifies correct rendering of sections based on props.

## Troubleshooting

If market rates appear when they shouldn't:
1.  Check `isSmartMode` state in `UnifiedQuoteComposer`.
2.  Verify `visibleRateIds` initialization logic.
3.  Ensure `ResultsZone` is receiving the correctly filtered `results` prop.
