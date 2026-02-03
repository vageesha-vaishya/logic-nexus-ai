# Quote Creation Guide

This document outlines the two methods for creating quotes in the system: **Quick Quote** and **Detailed Quote**.

## 1. Quick Quote
**Best for:** Rapid price estimations, spot rates, and simple A-to-B shipments.

- **Access**: Click the "Quick Quote" button in the Quotes dashboard.
- **Features**:
  - **AI-Powered**: Uses AI to suggest HS codes and packaging types.
  - **Fast Entry**: Minimal fields required (Origin, Destination, Weight, Volume).
  - **Instant Rates**: Fetches rates from connected carriers in real-time.
  - **Lightweight**: Does not require full customer details initially.
- **Limitations**:
  - Limited line item details.
  - No complex discount structures or tiered pricing breakdown.
  - Simplified tax handling.

## 2. Detailed Quote (Create Detailed Quote)
**Best for:** Formal proposals, complex projects, multi-leg shipments, and negotiated contracts.

- **Access**: Click the **"Create Detailed Quote"** button (next to Quick Quote).
- **Features**:
  - **Full Customer Management**: Link to Opportunities, Accounts, and Contacts, or create Standalone quotes.
  - **Detailed Line Items**: 
    - Add multiple cargo items.
    - Specify HS Codes per item.
    - **Discount Structure**: Apply specific discount percentages per line item.
  - **Advanced Financials**:
    - **Pricing Tiers**: Calculate shipping costs based on volume/weight tiers via the "Calculate Estimate" engine.
    - **Tax & Surcharges**: Granular control over tax rates and additional fees.
    - **Estimate Breakdown**: View detailed freight breakdowns before applying to the quote.
  - **Logistics**: detailed routing and incoterms selection.
- **Workflow**:
  1. **General Info**: Select customer and status.
  2. **Logistics**: Define route and service type.
  3. **Cargo**: Add detailed items with specific dimensions and discounts.
  4. **Financials**: Use the Calculator to get accurate tiered pricing, verify against server logic, and finalize the total.

## Key Differences

| Feature | Quick Quote | Detailed Quote |
|---------|-------------|----------------|
| **Speed** | High (< 1 min) | Medium (3-5 mins) |
| **Complexity** | Low | High |
| **Line Items** | Aggregate / Simple | Detailed / Multiple |
| **Discounts** | N/A | **Per-item Discount %** |
| **Pricing** | Spot Rates | **Tiered & Contract Rates** |
| **CRM Link** | Optional | **Integrated** |

## Developer Notes
- **Code Location**: 
  - Quick Quote: `src/components/sales/quick-quote/QuickQuoteModal.tsx`
  - Detailed Quote: `src/components/sales/quote-form/QuoteFormRefactored.tsx`
- **Validation**: Detailed Quote uses a comprehensive Zod schema ensuring all mandatory fields (including specific cargo attributes) are present before submission.
- **Permissions**: Both methods respect RBAC. Detailed Quote allows "Standalone" mode for non-CRM users if permitted.
