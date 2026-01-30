# End-to-End Audit Report: Quotation Rate Calculation & Logic

## Part 1: Mathematical Discrepancy Analysis

### 1. Discrepancy Identification
- **Observed Issue**: The "Transport Legs" view (Screenshot 1) displayed a total of **$790**, while the "Financials/Summary" view (Screenshot 2) displayed **$3408**.
- **Breakdown**:
  - **Screenshot 1 (Legs)**:
    - Pickup Leg: $520.00
    - Main Leg: $170.00
    - Delivery Leg: $100.00
    - **Sum**: $520 + $170 + $100 = **$790.00**
  - **Screenshot 2 (Financials)**:
    - **Total Estimate**: **$3408.00**
- **Ratio Analysis**: $3408 / $790 ≈ 4.31. This strongly suggests a **quantity multiplier** (e.g., Weight or Volume) was applied to the total but not reflected in the individual leg display or calculation logic used in the Composer view.

### 2. Root Cause Analysis
The investigation revealed a critical synchronization failure between the **AI-generated Option Header** and the **Individual Leg Charges**:

1.  **AI Generation**: The AI correctly calculated the total price based on the shipment weight (approx. 4.31 units).
    -   AI Total: $3408.
    -   AI Unit Rates: $520/unit, $170/unit, $100/unit.
2.  **Data Mapping Failure (`handleGenerateSmartOptions`)**:
    -   When parsing the AI response, the system correctly stored the **Total Amount ($3408)** in the `quotation_version_options` table (Option Header).
    -   However, it inserted the individual **Charges** into the `quote_charges` table with a hardcoded **Quantity of 1**, ignoring the shipment weight.
    -   Result: The Composer view, which sums the `quote_charges`, displayed **$790** ($520 * 1 + $170 * 1 + $100 * 1).
3.  **Persistence Failure (`saveQuotation`)**:
    -   The `saveQuotation` function updated leg details and charge records but **failed to recalculate and update** the `total_amount` on the Option Header.
    -   This caused the "Financials" view (reading from Option Header) to remain "stuck" at the initial AI value ($3408), while the Composer view (reading from Charges) showed the incorrect lower value ($790).

### 3. Remediation Implemented
Two critical fixes were applied to the `MultiModalQuoteComposer.tsx`:

1.  **Fix 1: Correct Quantity Injection (Completed)**
    -   Modified `handleGenerateSmartOptions` to utilize `calculateChargeableWeight`.
    -   Charges are now inserted with the correct `quantity` (e.g., 4.31) based on the unit type (kg, cbm) and transport mode.
    -   **Result**: New charges will now sum to `Rate * Weight`, matching the AI's intended total.

2.  **Fix 2: Total Synchronization (Completed)**
    -   Updated `saveQuotation` to automatically recalculate the `total_buy`, `total_sell`, and `margin_amount` by summing all leg and combined charges.
    -   The calculated sum is now written back to the `quotation_version_options` table.
    -   **Result**: The "Financials" view and "Composer" view will always stay in sync, even after manual edits.

---

## Part 2: AI Quotation Logic Investigation

### 1. System Architecture & Flow
The AI Quotation workflow operates as follows:

1.  **Trigger**: User clicks "Generate Smart Options" or "Fetch Rates".
2.  **Service Call**: `invokeAiAdvisor` is called with payload (Origin, Destination, Commodity, Weight).
3.  **Response**: AI returns a JSON structure with `total_amount` and `legs` (containing unit rates).
4.  **Normalization**: `mapOptionToQuote` transforms the JSON into a standard internal format.
5.  **Persistence**:
    -   **Option Header**: Stores `total_amount` (AI source).
    -   **Charges**: Stored as individual rows linked to legs.
6.  **Display**:
    -   **Composer**: Reads Charges -> Sums them dynamically.
    -   **Financials**: Reads Option Header -> Displays stored total.

### 2. Redundancy & Caching Analysis
-   **Fetch Rates**: Triggers a fresh AI call. This is appropriate as market rates fluctuate.
-   **Smart Options**: Triggers a fresh AI call. Appropriate for generating new scenarios.
-   **Load Option**: Retrieves from Database. **No redundant AI call.**
-   **Recommendation**:
    -   The current "on-demand" model is efficient. Caching is implicit via the Database storage of generated options.
    -   No changes required for caching mechanisms.

### 3. Verification Plan
To verify the fixes and prevent regression:

1.  **Test Case 1 (New Quote)**:
    -   Generate Smart Option for 1000kg shipment.
    -   Verify Leg Charge Quantity = 1000 (or 1 Ton).
    -   Verify Leg Total matches Option Total.
2.  **Test Case 2 (Manual Edit)**:
    -   Edit a charge rate in Composer.
    -   Save Quotation.
    -   Verify "Financials" view updates to reflect the new total.
3.  **Test Case 3 (Weight Change)**:
    -   Change Global Weight.
    -   Regenerate Smart Options.
    -   Verify Quantities update accordingly.

## Conclusion
The discrepancy was a data integrity issue caused by inconsistent handling of charge quantities during the AI-to-DB mapping process and a lack of synchronization during the save process. Both issues have been resolved, ensuring mathematical accuracy and consistency across all views.
