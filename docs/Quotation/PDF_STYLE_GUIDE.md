# Quotation PDF Style Guide & Implementation Standards

## 1. Overview
This document defines the design patterns, visual hierarchy, and implementation standards for the Logic Nexus-AI Quotation PDF system. It ensures consistency across all generated documents while supporting multi-tenant branding and accessibility requirements (WCAG 2.1 AA, PDF/UA-1).

## 2. Document Structure & Layout

### 2.1 Section Ordering
The quotation document follows a strict narrative flow to guide the customer from high-level summary to detailed pricing and terms:

1.  **Header**: Branding, Document Type (Quotation/Draft), References (Quote #, Date).
2.  **Executive Summary**: Key details (Origin, Destination, Cargo, Total Cost).
3.  **Shipment Details (Line Items)**: Granular cargo information (Packages, Dimensions, Weights).
4.  **Pricing Breakdown**: Detailed charge table (Freight, Surcharges, Locals).
5.  **Terms & Conditions**: Legal disclaimers, validity, and specific incoterms.
6.  **Footer**: Contact info, Bank Details, Page Numbers.

### 2.2 Layout Grid & Spacing
-   **Grid System**: 12-column grid for flexible content alignment.
-   **Margins**:
    -   Top/Bottom: 20mm (A4) / 0.75" (Letter)
    -   Left/Right: 15mm (A4) / 0.6" (Letter)
-   **Spacing Scale**:
    -   Base Unit: 4pt
    -   Components: 8pt (Gap), 16pt (Section Padding), 32pt (Section Margin).
-   **Modular Scale**: 1.25 (Major Third) for typography scaling.

## 3. Typography & Visual Hierarchy

### 3.1 Font Stack
-   **Primary**: Helvetica Neue / Arial (Sans-serif) for clarity and screen readability.
-   **Secondary**: Times New Roman / Georgia (Serif) for formal legal text (optional).
-   **Monospace**: Courier New (for codes/references).

### 3.2 Type Scale (Base 10pt)
| Element | Size | Weight | Line Height | Case |
| :--- | :--- | :--- | :--- | :--- |
| **Document Title** | 24pt | Bold | 1.2 | Uppercase |
| **Section Header** | 16pt | Bold | 1.3 | Title Case |
| **Sub-Header** | 12pt | Semi-Bold | 1.4 | Sentence Case |
| **Body Text** | 10pt | Regular | 1.5 | Sentence Case |
| **Small Text/Disclaimer** | 8pt | Regular | 1.4 | Sentence Case |
| **Table Header** | 9pt | Bold | 1.2 | Uppercase |
| **Table Data** | 9pt | Regular | 1.3 | - |

### 3.3 Accessibility (WCAG 2.1 AA)
-   **Contrast Ratio**: Minimum 4.5:1 for normal text, 3:1 for large text.
-   **Color Usage**: Never use color alone to convey meaning (e.g., status).
-   **Tags**: Ensure PDF tags (H1-H6, P, Table) are preserved for screen readers.

## 4. Branding & Customization

### 4.1 Branding Manifest (JSON)
Tenants configure branding via a JSON manifest stored in `quotation_configuration`.
```json
{
  "logo_url": "https://...",
  "primary_color": "#0056b3",
  "secondary_color": "#f8f9fa",
  "accent_color": "#ffc107",
  "font_family": "Helvetica",
  "header_text": "LOGISTICS PRO",
  "footer_text": "Registered Office: ...",
  "disclaimer_text": "Standard trading conditions apply..."
}
```

### 4.2 Dynamic Zones
-   **Logo**: Top-left or Top-center (max-height: 50pt).
-   **Colors**:
    -   Primary: Headers, Table Borders, Highlights.
    -   Secondary: Alternating row backgrounds (zebra striping).
    -   Accent: Call-to-action or critical alerts.

## 5. Data Visualization & Tables

### 5.1 Pricing Tables
-   **Structure**: Description | Basis | Qty | Rate | Currency | Amount
-   **Alignment**: Text-align left (Description), Text-align right (Numbers/Currency).
-   **Totals**: Bold, Top-bordered double-line.

### 5.2 Multi-Rate Presentation
Support for multiple rate options in a single request:

1.  **Single Mode**: One PDF for the selected option.
2.  **Consolidated Mode**:
    -   One PDF containing all options sequentially.
    -   Summary page comparing totals.
    -   Detailed breakdown per option.
3.  **Individual Mode**:
    -   ZIP archive containing separate PDFs for each option.
    -   Filename pattern: `Quote-{id}-RateOption-{index}.pdf`.

## 6. Implementation Guidelines

### 6.1 PDF Generation Engine (Edge Function)
-   **Library**: `pdf-lib` for manipulation, custom renderer for layout.
-   **Input**: `SafeContext` (validated JSON).
-   **Output**: `Uint8Array` (PDF binary) or ZIP.

### 6.2 Performance Benchmarks
-   **Generation Time**: < 3s for 50-page document (Consolidated).
-   **File Size**: < 500KB for typical 3-page quote.
-   **Memory**: Stream processing where possible (though `pdf-lib` loads in memory).

### 6.3 Automated Testing
-   **Visual Regression**: Compare generated PDF screenshots against baseline.
-   **Content Verification**: Extract text using `pdf-parse` to verify data mapping.
-   **Metadata Check**: Verify Title, Author, Subject, Keywords fields.

## 7. Code Snippets (Template Engine)

### 7.1 Conditional Block
```typescript
if (context.mode === 'consolidated') {
  renderSummaryPage(context.options);
}
```

### 7.2 Repeatable Rows with Page Break
```typescript
const drawTable = (items) => {
  let y = startY;
  items.forEach(item => {
    if (y < margin_bottom) {
      page = doc.addPage();
      y = page_top;
      drawHeader(page);
    }
    drawRow(page, item, y);
    y -= row_height;
  });
};
```
