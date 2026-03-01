# Quotation Reload Mechanism

## Overview

The **Quotation Reload Mechanism** ensures that when a user edits an existing quotation, all relevant data—including rates, customer details, line items, pricing, attachments, and version history—is fully restored and editable without data loss. This process is orchestrated by the `UnifiedQuoteComposer` component.

## Architecture

The reload process is triggered when the `UnifiedQuoteComposer` mounts with a valid `quoteId` prop. It uses a robust, multi-stage loading pipeline designed for resilience and data integrity.

### Key Components

1.  **UnifiedQuoteComposer (`src/components/sales/unified-composer/UnifiedQuoteComposer.tsx`)**: The central orchestrator that manages the loading state and coordinates data fetching.
2.  **ScopedDataAccess**: A secure data access layer that ensures multi-tenant data isolation.
3.  **Promise.allSettled**: A parallel execution pattern used to load independent data chunks (attachments, versions, items) so that partial failures do not block the main quote from loading.

## Data Loading Pipeline

The `loadExistingQuote` function executes the following steps:

1.  **Context Verification**: Validates the `tenantId` and user permissions.
2.  **Core Quote Fetch**: Retrieves the main quote record (`quotes` table) with a retry mechanism (exponential backoff) to handle transient network issues.
    -   *Fallback*: If `versionId` is not provided in props, the system defaults to the `current_version_id` from the quote record.
3.  **Parallel Data Fetching**:
    -   **Cargo Configurations**: `quote_cargo_configurations`
    -   **Line Items**: `quote_items`
    -   **Attachments**: `quote_documents`
    -   **Version History**: `quotation_versions`
    -   *Resilience*: Uses `Promise.allSettled`. If attachments fail to load, the user sees an error warning, but the quote form still loads.
4.  **Version-Specific Data**:
    -   If a specific `versionId` (or current version) is identified, the system fetches:
        -   **Options**: `quotation_version_options`
        -   **Legs**: `quotation_version_option_legs`
        -   **Charges**: `quote_charges` (grouped by leg and category)
5.  **State Initialization**:
    -   Dispatches `INITIALIZE` action to `QuoteStore`.
    -   Populates `React Hook Form` values (`form.reset`).
    -   Sets internal state for attachments, manual options, and UI visibility.

## Data Mapping & Restoration

| UI Field | Database Source | Notes |
| :--- | :--- | :--- |
| **Header Info** | `quotes` table | Title, Mode, Origin, Destination |
| **Customer** | `quotes.account_id`, `quotes.contact_id` | Linked to CRM data |
| **Cargo** | `quote_items` OR `quote_cargo_configurations` | Aggregates weight/volume from items if present |
| **Attachments** | `quote_documents` | Mapped to `ExtendedFormData.attachments` |
| **Pricing** | `quote_charges` | Grouped into Buy/Sell/Margin views |
| **Versions** | `quotation_versions` | Displayed in the "Version History" sheet |

## Error Handling

-   **Retry Logic**: The core quote fetch retries up to 3 times with increasing delays.
-   **Partial Failures**: Failures in non-critical data (like attachments) result in a warning toast and a visible error banner, but do not crash the application.
-   **User Feedback**: Specific error messages are displayed for failed components (e.g., "Failed to load line items").

## Testing

The reload mechanism is verified by `UnifiedQuoteComposer.reload.test.tsx`, which covers:
-   **Full Data Restoration**: Verifies that all fields are populated correctly.
-   **Attachment Management**: Tests adding and removing attachments after reload.
-   **Version History**: Confirms that previous versions are listed and accessible.
-   **Resilience**: Mocks partial failures to ensure the UI remains usable.
