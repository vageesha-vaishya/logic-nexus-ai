# Incident Report: Quote Data Loading Failure (MGL-SYS-1770819021371)

**Date:** 2026-02-12  
**Status:** Resolved  
**Affected Modules:** Edit Quote, Quotation Composer

## 1. Issue Description
Users reported an issue where the "Edit Quote" and "Quotation Composer" interfaces failed to populate quote data for specific quotes (e.g., `MGL-SYS-1770819021371`). While the page would load, the form fields (items, cargo, options) remained empty or partially loaded, preventing users from modifying existing quotes.

## 2. Root Cause Analysis
The investigation revealed two primary issues:

1.  **Inconsistent Data Access Strategy:**
    - The `QuoteDetail` page (parent component) correctly used the `scopedDb` client, which handles tenant-aware data access and RLS policies effectively.
    - However, the `useQuoteRepositoryForm` hook (child component responsible for form hydration) was using the global `supabase` client directly.
    - In a multi-tenant environment, the global `supabase` client might not carry the necessary session context (e.g., `tenant_id` headers) required by Row Level Security (RLS) policies, leading to silent failures or empty result sets when fetching child entities like `quote_items`.

2.  **Partial Data Loading Risk:**
    - The data fetching logic in `useQuoteRepositoryForm` used `Promise.all` but lacked strict validation for partial failures. If the quote loaded but items failed (due to the RLS issue above), the form would initialize with an empty item list.
    - Saving the form in this state would inadvertently wipe out the existing items in the database, leading to data loss.

## 3. Solution Implementation
The following changes were implemented in `src/components/sales/quote-form/useQuoteRepository.ts`:

1.  **Switched to `scopedDb`:**
    - Replaced all direct `supabase` client calls with `scopedDb` (from `useCRM` hook) for fetching quotes, items, cargo configurations, and versions.
    - This ensures consistent tenant context and adheres to the application's data access patterns.

2.  **Enhanced Error Handling:**
    - Added strict checks for `itemsResult` and `cargoResult`.
    - If fetching items or cargo fails, the hook now throws an explicit error instead of returning empty arrays. This prevents the form from loading in a corrupted state and protects against accidental data loss.

3.  **Unit Test Updates:**
    - Updated `QuoteRepository.test.tsx` to mock `scopedDb.rpc` calls, reflecting the atomic save operation used by the repository.

## 4. Verification

### Automated Simulation
A diagnostic script (`scripts/diagnose_quote_data.ts`) was created to simulate the frontend data fetching logic. It verified that the backend data for `MGL-SYS-1770819021371` is intact and accessible when using the correct data access pattern.

### Regression Testing
An integration test script (`scripts/integration_test_quote_flow.ts`) was developed to validate the end-to-end flow:
1.  **Create:** Successfully created a new quote with items.
2.  **Fetch:** Simulated the "Edit" mode fetch using the corrected logic.
3.  **Update:** Simulated a "Save" operation using the `save_quote_atomic` RPC.
4.  **Verify:** Confirmed that updates were persisted correctly without data loss.

## 5. Files Modified
- `src/components/sales/quote-form/useQuoteRepository.ts`: Core logic fix.
- `src/components/sales/quote-form/__tests__/QuoteRepository.test.tsx`: Updated tests.
- `scripts/diagnose_quote_data.ts`: Diagnostic script (new).
- `scripts/integration_test_quote_flow.ts`: Regression test script (new).
