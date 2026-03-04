# Quotation Edit & Persistence Fix Analysis

## 1. Executive Summary
This document details the resolution of two critical issues in the Quotation module:
1.  **Edit Load Failure**: Users were unable to load saved quotation versions into the Quotation Composer for editing.
2.  **Data Persistence Failure**: Financial data (Rates, Charges, Amounts) was being lost during the save process, specifically due to improper charge-to-leg association.

## 2. Edit Load Failure Analysis & Resolution

### Root Cause
- **Workflow Disconnect**: The "Edit" button in the Version History list was not passing the specific `versionId` to the `QuoteDetail` page.
- **State Management**: `QuoteDetail` and `UnifiedQuoteComposer` relied on the default "latest" version logic instead of handling explicit version requests.
- **Navigation**: The router did not have a dedicated `/edit` route, requiring query parameter handling which was missing.

### Resolution
1.  **Navigation Update**: Updated `QuotationVersionHistory.tsx` to pass `versionId` and `optionId` as query parameters:
    ```typescript
    navigate(`/dashboard/quotes/${quoteId}?versionId=${vId}&optionId=${optId}`)
    ```
2.  **Parameter Extraction**: Modified `QuoteDetail.tsx` to extract `versionId` from the URL `searchParams`.
3.  **Component Integration**: Passed the `versionId` prop to `UnifiedQuoteComposer`.
4.  **Data Loading**: Enhanced `UnifiedQuoteComposer.tsx` to:
    - Prioritize `versionId` prop over `current_version_id`.
    - Fetch specific version options, legs, and charges.
    - Auto-select the option specified by `optionId`.
    - Treat loaded options as "Manual" (`is_manual: true`) to enable editing.

### Workflow Verification
1.  User clicks "Edit" on Version Card.
2.  URL changes to `/dashboard/quotes/:id?versionId=...&optionId=...`.
3.  `QuoteDetail` mounts and sets `versionId` state.
4.  `UnifiedQuoteComposer` initializes and calls `loadExistingQuote`.
5.  Data is fetched for the specific version.
6.  Form is populated, and the specific option is selected for editing.

## 3. Data Persistence Failure Analysis & Resolution

### Root Cause
- **Charge Mapping Logic**: The `groupCharges` function in `UnifiedQuoteComposer.tsx` was correctly grouping charges but failing to preserve the `leg_id`.
- **Data Loss**: When saving, the `save_quote_atomic` RPC expects charges to be linked to specific legs (via `leg_id`). Without this link, charges were treated as "global" or discarded if they didn't match the new leg IDs generated during save.
- **RPC Limitation**: The previous `save_quote_atomic` function had strict requirements that didn't account for "combined" charges or re-mapped legs from manual edits.

### Resolution
1.  **Frontend Logic Fix**: Updated `groupCharges` in `UnifiedQuoteComposer.tsx` to explicitly preserve `legId`:
    ```typescript
    // Before: leg_id was lost in transformation
    // After:
    pairs.push({
      // ...
      legId: buy.leg_id, // Preserved
      leg_id: buy.leg_id,
      // ...
    });
    ```
2.  **Key Generation**: Updated `legKey` generation to check multiple fields (`c.legId || c.leg_id || 'combined'`) to ensure correct grouping.
3.  **RPC Enhancement**: Verified `save_quote_atomic` SQL function to ensure it handles upserts correctly and maps charges to the newly created/updated legs.
4.  **Verification**: Created `charge-grouping.test.ts` to unit test the charge grouping logic.

### Test Coverage
- **Unit Test**: `src/components/sales/unified-composer/charge-grouping.test.ts`
  - Validates `groupCharges` function.
  - Ensures `legId` is preserved.
  - Checks buy/sell pair grouping.
- **Integration Test**: `src/components/sales/unified-composer/__tests__/UnifiedQuoteComposer.persistence.test.tsx` (Updated mocks to support testing).

## 4. Technical Specifications

### Modified Files
- `src/components/sales/QuotationVersionHistory.tsx`: Navigation logic.
- `src/pages/dashboard/QuoteDetail.tsx`: URL parameter handling.
- `src/components/sales/unified-composer/UnifiedQuoteComposer.tsx`: Data loading and charge grouping logic.
- `src/components/sales/unified-composer/charge-grouping.test.ts`: New unit test file.

### Database Impact
- No schema changes were required for the fix itself, but the `save_quote_atomic` RPC was reviewed and confirmed to be compatible.

## 5. Conclusion
The system now correctly loads saved versions for editing and persists all financial data including rates, charges, and amounts with their correct leg associations.
