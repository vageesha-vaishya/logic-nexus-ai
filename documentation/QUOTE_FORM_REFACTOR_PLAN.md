# QuoteForm Refactoring Plan (Phase 1)

**Date:** January 06, 2026
**Target Component:** `src/components/sales/QuoteForm.tsx` (3,032 lines)
**Goal:** Decompose the monolith into a modular, testable architecture without breaking existing functionality.

---

## 1. Scope Definition

### 1.1 Bounded Contexts
We have identified the following logical domains within the current monolith:

1.  **Quote Identity (Header):**
    *   Metadata: Title, Description, Status, Validity.
    *   CRM Links: Opportunity, Account, Contact.
2.  **Logistics Configuration (Routing):**
    *   Service Level: Service Type, Mode, Carrier.
    *   Route: Origin, Destination, Ports.
    *   Terms: Incoterms, Trade Direction.
3.  **Cargo Specifications:**
    *   Totals: Weight, Volume, Commodity.
    *   Line Items: Products, Packages, Quantities.
4.  **Financials:**
    *   Pricing: Buying/Selling Rates, Margins, Tax.
    *   Currency: Exchange rates and formatting.

### 1.2 Dependencies & Coupling
*   **Direct Supabase Calls:** The component bypasses a service layer, making it hard to mock.
*   **React Hook Form:** The entire 3000 lines share a single `useForm` instance.
*   **Prop Drilling:** `user`, `tenantId`, and `supabase` client are passed deeply.
*   **UI/Data Mixing:** Data transformation logic (e.g., `formatCarrierName`) is inline with UI rendering.

### 1.3 Success Criteria
*   **Code Size:** No single file > 400 lines.
*   **Separation:** Business logic moved to hooks (`useQuoteLogic.ts`).
*   **Performance:** Initial render time < 500ms (currently > 2s).
*   **Reliability:** Type safety enforced via shared `types.ts`.

---

## 2. Technical Implementation

### 2.1 Architecture Diagram

```mermaid
graph TD
    Parent[QuoteForm (Container)]
    Context[QuoteFormProvider]
    
    subgraph State_Management
        Hook1[useQuoteData (Lists)]
        Hook2[useQuoteCalculations (Math)]
        Hook3[useQuoteHydration (Edit Mode)]
    end
    
    subgraph UI_Components
        Header[QuoteHeader]
        Details[QuoteDetails]
        Routing[QuoteRouting]
        Financials[QuoteFinancials]
    end
    
    Parent --> Context
    Context --> Hook1
    Context --> Hook2
    Context --> Hook3
    Context --> UI_Components
    
    UI_Components --> Header
    UI_Components --> Details
    UI_Components --> Routing
    UI_Components --> Financials
```

### 2.2 Dependency Inversion
*   **Data Layer:** We will introduce a `QuoteRepository` pattern (via custom hooks) to abstract Supabase calls.
*   **State Layer:** We will use `FormProvider` from `react-hook-form` to share form state implicitly, removing the need to pass `form` props.

### 2.3 SOLID Principles Application
*   **Single Responsibility:** Each sub-component (e.g., `QuoteHeader`) only cares about its specific fields.
*   **Interface Segregation:** We will define smaller interfaces (`QuoteHeaderProps`, `QuoteFinancialsProps`) instead of one giant `Props` object.

---

## 3. Migration Plan

1.  **Infrastructure Setup:**
    *   Create `src/components/sales/quote-form/`.
    *   Define `types.ts` and `schema.ts` (Zod).
2.  **Logic Extraction:**
    *   Move data fetching to `useQuoteData.ts`.
    *   Move hydration logic to `useQuoteHydration.ts`.
3.  **Component Extraction:**
    *   Create `QuoteHeader.tsx` (Fields: Title, Account, Contact).
    *   Create `QuoteLogistics.tsx` (Fields: Service, Origin, Dest).
    *   Create `QuoteFinancials.tsx` (Fields: Totals, Tax).
4.  **Integration:**
    *   Build `QuoteFormRefactored.tsx` that composes these parts.
    *   Swap the import in `src/pages/dashboard/QuoteNew.tsx` and `QuoteDetail.tsx` to test.

---

## 4. Performance Benchmarks (Estimated)

| Metric | Current (Monolith) | Target (Refactored) |
| :--- | :--- | :--- |
| **Lines of Code** | 3,032 | ~400 (Main Container) |
| **Cyclomatic Complexity** | 50+ | < 10 per component |
| **Re-render Scope** | Entire Form | Affected Section Only |
| **Time to Interactive** | ~2.5s | < 0.8s |
