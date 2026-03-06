# Multi-Modal Quotation Template Selection & Rendering

## Overview
The system automatically selects the "Standard Multi-Modal" PDF template when a quotation involves complex transport configurations (multiple legs or specific transport modes). This ensures that all legs of the journey are clearly visible to the customer.

## Template Selection Logic

The template selection algorithm (in `generate-quote-pdf/index.ts`) follows this priority:

1.  **Explicit Template ID**: If `templateId` is provided in the request body, it is used.
2.  **Quote-Level Template**: If `quote.template_id` is set in the database, it is used.
3.  **Multi-Modal Auto-Detection**:
    The system analyzes the quotation's options and legs to detect multi-modal characteristics:
    -   **Multiple Legs**: Any option has > 1 leg.
    -   **Specific Modes**: Any leg has `mode` (or `transport_mode`) equal to 'ocean' or 'air'.
    
    If detected, the system attempts to load the template named **"Standard Multi-Modal"**.
    -   It prioritizes a tenant-specific version (where `tenant_id` matches the quote).
    -   It falls back to the global version (where `tenant_id` is null).

4.  **Default Fallback**: If no specific template is found, it uses the hardcoded `DefaultTemplate`.

## Data Mapping for Multi-Modal Quotes

To ensure correct rendering, the `RawQuoteData` is transformed into a `SafeContext`. Key mappings include:

-   **Transport Mode**: `leg.transport_mode` is used as the primary source, falling back to `leg.mode`.
-   **Carrier**: `leg.carrier_name` is used, falling back to `leg.carrier`.
-   **Locations**: `leg.pol` (Port of Loading) and `leg.pod` (Port of Discharge) are mapped to `Origin` and `Destination`.

## Rendering Logic

The `PdfRenderer` supports a specific section type: `multi_modal_details`.

-   **Section Key**: `multi_modal_details`
-   **Behavior**:
    -   Iterates through all Options in the quote.
    -   For each Option, lists all Legs in a table format.
    -   Columns: Mode, Origin, Destination, Carrier, Transit Time.
    -   Handles pagination automatically.

## Configuration

The "Standard Multi-Modal" template must include the `multi_modal_details` section in its JSON configuration:

```json
{
  "sections": [
    { "type": "header" },
    { "type": "customer_info", "title": "Customer Details" },
    { "type": "shipment_info", "title": "Shipment Details" },
    { "type": "multi_modal_details", "title": "Transport Leg Details" },
    { "type": "rates_table", "title": "Freight Rates" },
    { "type": "terms", "title": "Terms & Conditions" },
    { "type": "footer" }
  ]
}
```
