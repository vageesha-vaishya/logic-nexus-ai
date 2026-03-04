# Data Persistence Investigation & Resolution Report

## Executive Summary
This report details the investigation into critical data persistence failures in the Quotation Version module. The system was failing to persist Rates, Charges, and Amount values correctly, resulting in incomplete quotation records. The root cause was identified as a misalignment between the frontend data structure (charge-leg association) and the backend RPC function `save_quote_atomic`.

## 1. Root Cause Analysis

### Findings
The investigation revealed two primary failure points:

1.  **Frontend Data Mapping**: The `UnifiedQuoteComposer` component was losing the association between charges and legs during the grouping process. Charges retrieved from the database or added via UI were being processed by `groupCharges`, but the `legId` property was not consistently preserved or utilized during the save payload construction. Consequently, charges belonging to specific legs were being categorized as "combined charges" (unassociated).
2.  **Backend RPC Logic**: The `save_quote_atomic` PostgreSQL function had logic gaps:
    -   It did not correctly handle the insertion of new options, legs, or charges when `id` was present but not found (though the primary issue was the association).
    -   More critically, because the frontend was sending charges as `combined_charges` due to the mapping error, the backend was inserting them with `leg_id = NULL`.
    -   The retrieval logic (loading a quote) relies on `leg_id` to associate charges with legs. Since `leg_id` was NULL, the charges were not displayed under their respective legs, appearing as "lost".

### Impact
-   **Data Loss**: Financial data (Rates, Charges) was effectively lost from the user's perspective because it wasn't associated with the correct leg.
-   **Edit Failure**: Attempts to edit saved quotes resulted in empty or incomplete charge lists.

## 2. Database Schema Verification

### Schema Status
-   **Table**: `quote_charges`
-   **Columns**: `id`, `quote_option_id`, `leg_id`, `rate`, `amount`, `currency_id`, etc.
-   **Constraint**: Foreign keys to `quotation_version_options` and `quotation_version_option_legs` are correct.
-   **Verification**: The schema itself supports the required data relationships. No schema changes were required, only logic updates in the RPC function.

## 3. API and Service Layer Investigation

### Analysis
-   **Function**: `save_quote_atomic` (RPC)
-   **Issue**: The function logic for handling the `legs` array within an option was correct in principle but relied on the payload structure matching the schema.
-   **Fix**: The RPC was updated to robustly handle upserts (INSERT/UPDATE) for options, legs, and charges, ensuring that even if an ID is provided, the system verifies existence or creates new records if necessary (though the primary fix was ensuring the payload structure was correct).

## 4. Frontend Integration Check

### Component: `UnifiedQuoteComposer`
-   **Function**: `groupCharges`
-   **Defect**: The function was returning charge objects without the `legId` property in some cases, or the `handleSaveQuote` function was not using the correct key to map charges to legs.
-   **Fix**:
    -   Updated `groupCharges` to explicitly include `legId: buy.leg_id`.
    -   Updated `handleSaveQuote` to use `c.legId || c.leg_id` when grouping charges for the payload.
    -   Ensured that charges are nested under their respective `legs` in the JSON payload sent to the backend.

## 5. Implementation Details

### Code Changes

#### `src/components/sales/unified-composer/UnifiedQuoteComposer.tsx`
-   **`groupCharges`**: Added `legId` to the returned object.
-   **`handleSaveQuote`**: Updated logic to correctly distribute charges into `chargesByLegId` map using `c.legId || c.leg_id`.

```typescript
// Before
const legKey = c.legId || 'combined';

// After
const legKey = c.legId || c.leg_id || 'combined';
```

#### `supabase/migrations/20260227100000_fix_save_quote_atomic.sql`
-   Refined the PL/pgSQL logic to ensure atomic updates and correct `leg_id` assignment during `INSERT`.

## 6. Testing and Validation

### Unit Tests
-   **File**: `src/components/sales/unified-composer/charge-grouping.test.ts`
-   **Scope**: Verifies that `groupCharges` correctly preserves `legId` and that charges are correctly categorized as leg-specific or combined.
-   **Result**: All tests passed.

### Manual Verification
-   **Scenario**: Create a quote with multiple legs and charges. Save. Reload.
-   **Result**: Charges persist and remain associated with their respective legs.

## 7. Conclusion
The data persistence issue has been resolved by aligning the frontend data mapping with the backend schema requirements. The system now correctly persists and retrieves all financial data associated with quotation versions.
