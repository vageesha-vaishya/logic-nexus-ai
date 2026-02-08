# Quick Quote to Detailed Quote Data Inconsistency Audit

## 1. Overview
This document outlines the data flow, inconsistencies, and mapping gaps identified between the **Quick Quote / Smart AI Quote** module and the **Detailed Quote / Quotation Composer** modules.

## 2. Data Flow Architecture

### Quick Quote Module
- **Source**: `QuickQuoteModal.tsx`
- **Output Schema**: `QuoteTransferSchema` (`src/lib/schemas/quote-transfer.ts`)
- **Key Data**:
  - Origin/Destination (Strings + Details)
  - Mode (String)
  - Selected Rates (Array of Options)
  - AI Analysis (Market Analysis, Confidence Score, Anomalies)
  - Cargo Details (Container/Loose, Dims, Weight, Volume)

### Data Transfer
- **Mechanism**: React Router Navigation State (`navigate('/dashboard/quotes/new', { state: ... })`)
- **Validation**: `QuoteTransferSchema.safeParse` in `QuoteNew.tsx`

### Detailed Quote Creation (`QuoteNew.tsx`)
- **Receiver**: `src/pages/dashboard/QuoteNew.tsx`
- **Process**:
  1. Validates incoming state.
  2. Maps state to `QuoteFormValues` (`templateData`).
  3. Pre-populates `QuoteFormRefactored`.
  4. On save/conversion, populates `quotation_versions` and `quotation_version_options`.

## 3. Inconsistency Matrix

| Field Category | Quick Quote Field | Detailed Quote Field (Target) | Status | Gap / Issue |
| :--- | :--- | :--- | :--- | :--- |
| **Header** | `incoterms` | `incoterms` | ✅ Mapped | Quick Quote UI now includes Incoterms selection, and `QuoteNew.tsx` maps it correctly (defaulting to CIF/FOB if missing). |
| **Header** | `pickupDate`, `deliveryDeadline` | `pickup_date`, `delivery_deadline` | ✅ Resolved | Added new columns to DB schema and fields to `QuoteHeader.tsx`. Mapped correctly in `QuoteNew.tsx`. |
| **Header** | `specialHandling`, `vehicleType` | `vehicle_type`, `special_handling` | ✅ Resolved | Added dedicated columns to DB and fields to UI. Mapped correctly in `QuoteNew.tsx`. |
| **Pricing** | `selectedRates[0].price` | `items[].unit_price` | ✅ Resolved | `QuoteNew.tsx` now allocates the total price across line items (total / qty) to ensure the Detailed Quote is not zero-valued. |
| **Cargo** | `dims` (String "LxWxH") | `items[].attributes` (L,W,H) | ✅ Resolved | `QuoteNew.tsx` uses robust regex parsing with fallback for various delimiters (x, *, space). |
| **Cargo** | `htsCode` | `items[].attributes.hs_code` | ✅ Mapped | Mapped correctly, assuming `htsCode` is passed. |
| **Master Data** | `mode` (String) | `service_type_id` | ✅ Resolved | `QuoteNew.tsx` now prioritizes `service_type_id` if provided, falling back to name matching only if missing. |
| **Master Data** | `carrier` (String Name) | `carrier_id` | ✅ Resolved | `QuoteNew.tsx` prioritizes `carrier_id` from rate options before falling back to name lookup. |
| **AI Data** | `marketAnalysis`, `confidenceScore` | `quotation_versions` table | ✅ Mapped | Saved directly to DB during option insertion. Not visible in `QuoteForm` but visible in Composer. |

## 4. Root Cause Analysis

1.  **Unstructured Handoff**: Quick Quote captures "Quick" data (strings), while Detailed Quote requires "Structured" data (IDs, normalized objects).
2.  **Missing Fields**: Quick Quote UI was designed for speed, omitting detailed fields like Incoterms or complex cargo breakdown.
3.  **Fragile Mapping Logic**: `QuoteNew.tsx` contains hardcoded logic and regex parsers instead of using shared utility functions or structured objects.
4.  **Schema Divergence**: `QuoteTransferSchema` allows loose definitions (e.g., `dims` as string), whereas `quoteSchema` requires numbers.

## 5. Implementation Requirements (Fix Plan)

### A. Quick Quote Updates (`QuickQuoteModal.tsx`)
1.  **Add Incoterms**: Include a dropdown for Incoterms in the Quick Quote form.
2.  **Structured Dimensions**: Capture L/W/H separately or ensure strictly formatted output.
3.  **Pass IDs**: Ensure `carrier_id` and `service_type_id` (if possible) are included in the rate options from the engine.

### B. Mapping Logic Updates (`QuoteNew.tsx`)
1.  **Robust Parsing**: Improve `dims` regex or switch to structured input.
2.  **Direct ID Mapping**: Use IDs for Carriers/Services if provided, falling back to name matching only if necessary.
3.  **Structured Notes**: Format the `notes` field more cleanly using Markdown or a standard template.

### C. Detailed Quote Updates (`QuoteFormRefactored.tsx`)
1.  **Incoterms Support**: Ensure the form correctly loads the pre-populated `incoterms`.
2.  **Charges Breakdown**: Consider creating a default "Freight" charge line item from the `shipping_amount` instead of just setting the header total.

## 6. Testing Requirements
1.  **Integration Test**: Create a Quick Quote -> Convert -> Verify Detailed Quote flow.
    -   Check `incoterms` population.
    -   Check `dims` parsing accuracy.
    -   Check `carrier` and `service_type` selection.
    -   Check `price` transfer.
