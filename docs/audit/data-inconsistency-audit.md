# Data Inconsistency Audit Report: Quote Modules

## 1. Executive Summary
This audit identifies data flow inconsistencies between the **Quick/Smart AI Quote** module, the **Create Detailed Quote** module (QuoteForm), and the **Quotation Composer** module. The primary goal is to ensure seamless data transfer and integrity across the lifecycle of a quote.

**Key Findings:**
-   **Currency Context Loss**: Quick Quotes and Composer support multiple currencies, but the Detailed Quote Form (`QuoteFinancials`) defaults to numeric values without explicit currency selection. *Mitigation: Currency code is now appended to notes.*
-   **Date Field Mismatches**: `pickupDate` and `deliveryDeadline` from Quick Quotes have no direct counterparts in the Detailed Quote header schema (`quoteSchema`). *Mitigation: Mapped to `notes`.*
-   **Missing Fields**: several fields from Quick Quote (e.g., `specialHandling`, `vehicleType`) are not mapped to structured fields in the Detailed Quote. *Mitigation: Mapped to `notes`.*
-   **Status Synchronization**: Logic for syncing status changes in Composer back to the parent Quote header was identified as a critical requirement and has been addressed.

## 2. Data Flow Analysis

### 2.1 Pipeline
1.  **Source**: Quick Quote / Smart AI Quote (Output: `QuoteTransferSchema`)
    -   Generates: `QuoteTransferPayload` (Origin, Destination, Mode, Rates, Items, Dates, Incoterms).
2.  **Transition**: `QuoteNew.tsx`
    -   Action: Receives `location.state`.
    -   Transformation: Maps `QuoteTransferPayload` -> `QuoteFormValues` (`templateData`).
    -   Persistence: Auto-saves to `quotes` table (via `useQuoteRepository`).
    -   Handover: Switches to `MultiModalQuoteComposer` view.
3.  **Destination**: Quotation Composer (`MultiModalQuoteComposer.tsx`)
    -   Action: Loads data from `quotes` and `quotation_versions`.
    -   Refinement: User edits line items, charges, and status.
    -   Sync: Updates `quotation_versions` and syncs totals/status back to `quotes`.

### 2.2 Data Structures
-   **Quick Quote**: `QuoteTransferSchema` (Rich, flat structure with AI context).
-   **Detailed Quote**: `quoteSchema` (Hierarchical: Header -> Items -> Attributes).
-   **Composer**: Relational DB View (`quotation_versions`, `quotation_version_options`, `legs`, `charges`).

## 3. Inconsistency Matrix

| Field Category | Quick Quote Field | Detailed Quote Field | Status | Severity | Resolution |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Logistics** | `origin` (string) | `origin_port_id` (UUID) | **Mismatch** | High | Resolved: String-to-ID resolution logic in `QuoteNew`. |
| | `destination` (string) | `destination_port_id` (UUID) | **Mismatch** | High | Resolved: String-to-ID resolution logic in `QuoteNew`. |
| | `pickupDate` | `notes` (unstructured) | **Lossy** | Medium | Mapped to Notes (Schema limitation). |
| | `deliveryDeadline` | `notes` (unstructured) | **Lossy** | Medium | Mapped to Notes (Schema limitation). |
| | `incoterms` | `incoterms` | **Mapped** | Low | Fixed: Explicit mapping added in `QuoteNew`. |
| **Cargo** | `htsCode` | `items[].attributes.hs_code` | **Mapped** | Low | Verified: Correctly mapped in item attributes. |
| | `dims` (string) | `items[].attributes.{l,w,h}` | **Mapped** | Low | Fixed: Enhanced regex parsing for decimals. |
| | `dangerousGoods` | `items[].attributes.hazmat` | **Mapped** | Low | Verified: Boolean to object mapping exists. |
| **Financials** | `price` | `shipping_amount` | **Mapped** | Low | Fixed: Mapped `primaryRate.price` to `shipping_amount`. |
| | `currency` | `notes` | **Lossy** | High | Mapped to Notes. Detailed Quote lacks explicit currency field. |
| **Meta** | `specialHandling` | `notes` | **Lossy** | Low | Mapped to Notes. |
| | `vehicleType` | `notes` | **Lossy** | Low | Mapped to Notes. |

## 4. Root Cause Analysis
1.  **Schema Divergence**: The `quotes` table schema (legacy/core) is less flexible than the `QuoteTransferSchema` (modern/AI-driven).
2.  **Implicit Assumptions**: `QuoteFinancials` assumes a simplified pricing model compared to the multi-currency, multi-leg model of Composer.
3.  **Unstructured Mapping**: `QuoteNew.tsx` relies on dumping extra data into `notes`, making it hard to query or validate later.

## 5. Implementation & Fixes

### 5.1 Completed Fixes
-   **Cargo Error**: Resolved `tenant_id` filter conflict in `MultiModalQuoteComposer`.
-   **Dimensions Parsing**: Enhanced regex in `QuoteNew.tsx` to handle decimals and varied formats.
-   **Parent Sync**: Added logic to `MultiModalQuoteComposer` to sync total weight/volume/amount/incoterms/validity to parent `quotes` header on save.
-   **Mapping Gaps**:
    -   Added explicit mapping for `incoterms` and `shipping_amount` in `QuoteNew.tsx`.
    -   Verified `pickupDate` and `deliveryDeadline` are preserved in `notes`.
    -   Verified `htsCode` propagation.

### 5.2 Pending Validation
1.  **Integration Testing**: Verify the end-to-end flow from Quick Quote -> Detailed Quote -> Composer in a live environment to ensure no regressions.
2.  **Status Sync**: Confirm `VersionStatusSelector` updates reflect in the parent quote header (logic exists in `useVersionStatus`, needs E2E verification).

## 6. Testing Requirements
-   **Integration Test**: Create a Quick Quote -> Detailed Quote -> Composer flow.
    -   Verify `origin`/`destination` resolution.
    -   Verify `shipping_amount` and `items` population.
    -   Verify `notes` contain the overflow data (dates, currency).
    -   Verify Status change in Composer updates `quotes.status`.

## 7. Performance & Metrics
-   **Data Consistency Rate**: Target > 95% automated mapping success.
-   **Manual Correction**: Monitor frequency of user edits to mapped fields immediately after creation.
