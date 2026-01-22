# Multi-Carrier Rate Selection Analysis & Debugging Report

## 1. Executive Summary
This report details the analysis of the quotation composer module's functionality for multi-carrier rate selection. The investigation confirms that the system supports selecting multiple carrier rates from the Quick Quote module and converting them into a full quotation. The workflow from selection to persistence has been verified, with specific observations on field mapping, business logic, and potential areas for enhancement.

## 2. End-to-End Workflow Analysis

### 2.1 Rate Selection Process
-   **Component:** `QuickQuoteModal.tsx`
-   **Mechanism:**
    -   Users can select multiple rates via checkboxes in `QuoteResultsList` or `QuoteComparisonView`.
    -   State is managed via `selectedIds` array.
    -   A floating footer appears when options are selected, offering a "Create Quote with Selected" action.
-   **Data Flow:**
    -   `handleConvertSelected` filters the full `results` array against `selectedIds`.
    -   `navigate('/dashboard/quotes/new', { state: { selectedRates: [...] } })` passes the array to the quote creation page.

### 2.2 Quote Creation & Persistence
-   **Component:** `QuoteNew.tsx`
-   **Mechanism:**
    -   Upon initialization, the component checks for `location.state.selectedRates`.
    -   A `useEffect` hook (lines 131+) iterates through each selected rate.
    -   **Option Creation:** Creates a `quotation_version_options` record for each rate.
    -   **Leg Creation:** Iterates `rate.legs` to create `quotation_version_option_legs`. Defaults to a single leg if no specific leg data is provided.
    -   **Charge Creation:** Flattens `rate.price_breakdown` or uses `rate.price` to create `quote_charges`.
        -   **Logic:** Applies a default 15% margin calculation (Sell Price = Rate, Buy Price = Rate - 15%).
        -   **Split:** Creates both "Buy" (Cost) and "Sell" (Revenue) charge records.

## 3. Field-Level Functionality Review

### 3.1 Rate Calculation Fields
-   **Source:** `supabase/functions/rate-engine/index.ts`
-   **Fields Verified:**
    -   `price`: Calculated based on base rate + weight/quantity.
    -   `transitTime`: Derived from carrier data or simulated.
    -   `co2_kg`: Estimated based on mode and weight.
    -   `route_type` & `stops`: Generated for simulated rates; passed through for real rates.

### 3.2 Display Logic
-   **Component:** `QuoteResultsList.tsx`
-   **Verification:**
    -   **Tiers:** Correctly renders badges for 'Contract', 'Spot', 'Best Value', etc.
    -   **AI Attribution:** Displays "AI Generated" badge and explanation if present.
    -   **Details:** Expands to show Cost Breakdown (`QuoteDetailView`) and Route Map (`QuoteMapVisualizer`).

## 4. Business Logic Implementation

### 4.1 Margin Logic
-   **Observation:** `QuoteNew.tsx` applies a hardcoded 15% margin (`targetMarginPercent = 0.15`).
-   **Impact:** All converted quotes start with a 15% profit margin assumption.
-   **Recommendation:** This should be configurable via Tenant Settings or Margin Rules, rather than hardcoded.

### 4.2 Multi-Leg Routing
-   **Observation:** The system handles `rate.legs` array if provided.
-   **Fallback:** If `rate.legs` is missing (common in simulated/simple rates), it defaults to a single "Direct" leg.
-   **Risk:** Complex routes returned without explicit leg arrays in the API response will appear as direct shipments.

### 4.3 Charge Mapping
-   **Observation:** Charges are mapped to 'FREIGHT', 'TAXES', and 'SURCHARGE' categories.
-   **Fallback:** Defaults to 'FREIGHT' if category resolution fails.
-   **Status:** Robust fallback logic exists to ensure no charges are lost.

## 5. Technical Investigation & Findings

### 5.1 API Response Structure
The `rate-engine` returns a flat `options` array.
```typescript
interface RateOption {
  id: string;
  tier: 'contract' | 'spot' | 'market';
  // ...
  legs?: any[]; // Optional
  price_breakdown?: any; // Optional
}
```
**Issue:** The simulated rates in `rate-engine` (lines 190+) do **not** generate a `legs` array, only `route_type` and `stops`. This causes `QuoteNew.tsx` to trigger its fallback "single leg" logic for all simulated market rates.

### 5.2 State Propagation
-   **QuickQuote -> QuoteNew:** robust via React Router state.
-   **QuoteNew -> Composer:** robust via Database (persisted options).

## 6. Recommendations & Fixes

### 6.1 Fix: Generate Legs for Simulated Rates
**Component:** `rate-engine/index.ts`
**Issue:** Simulated rates lack `legs` data.
**Fix:** Construct a simple `legs` array in the simulation logic so the UI can visualize the route (e.g., Origin -> Intermediate -> Destination for transshipments).

### 6.2 Enhancement: Configurable Margins
**Component:** `QuoteNew.tsx`
**Issue:** Hardcoded 0.15 margin.
**Fix:** Fetch default margin settings from `tenant_settings` or `margin_rules` before processing the conversion.

### 6.3 Enhancement: Charge Categorization
**Component:** `QuoteNew.tsx`
**Issue:** Generic 'SURCHARGE' mapping.
**Fix:** Implement a more detailed map of known surcharge keys (e.g., 'BAF' -> Fuel Surcharge ID) to improve reporting accuracy.

## 7. Conclusion
The multi-carrier selection functionality is operational and technically sound. The identified issues are primarily related to data richness (missing leg details in simulations) and business logic flexibility (hardcoded margins), rather than critical bugs in the selection or persistence workflow.
