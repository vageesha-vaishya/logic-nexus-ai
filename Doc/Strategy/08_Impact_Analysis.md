# Comprehensive Impact Analysis: PAAS Enterprise System Implementation

## 1. Executive Summary
The transition from the current "SOS Logistics Pro" application to a **Domain-Agnostic PAAS Enterprise System** represents a **High-Risk, Fundamental Re-architecture**. The current platform is a **Vertical Monolith** where business logic (Logistics) is tightly coupled to the database schema and frontend components. Transforming this into a Micro-kernel Architecture requires breaking these deep dependencies, specifically moving domain-specific fields (e.g., `weight_kg`) out of core tables and decoupling the UI from direct database structures.

## 2. Platform Design Impact

### 2.1 Architectural Conflict: Service-Driven vs. UI-Coupled
*   **Current State:** The React Frontend (e.g., `QuotesWidget.tsx`, `OpportunityForm.tsx`) communicates directly with Supabase tables via the client SDK. Business logic is implicitly defined by the shape of the database response.
*   **New Design (HLD):** Mandates a **Strategy Pattern** where the Core Platform delegates to Domain Plugins (Logistics, Banking).
*   **Impact:**
    *   **Frontend Refactoring:** The UI must stop querying domain-specific tables directly. It requires an abstraction layer (e.g., `useQuoteAdapter`) that determines which fields to render based on `tenant.domain_type`.
    *   **API Layer:** A new orchestration layer (Supabase Edge Functions) is required to handle "Tax Calculation" and "Finalization" logic, as these complex, secure operations cannot reside in the client.

### 2.2 Non-Functional Requirements
*   **Performance:** The proposed "Tax Engine" (FR-TAX-001) adds a synchronous blocking call to every Quote/Invoice finalization.
    *   *Mitigation:* Implement an **Async Event Bus** for non-critical path operations (GL posting) and optimize Tax Calculation (Target: < 200ms).
*   **Scalability:** The current `quote_items` table will become a bottleneck if shared across all verticals.
    *   *Mitigation:* Vertical partitioning (sharding by `tenant_id`) and eventually separate physical tables per domain may be required.

## 3. Codebase Impact

### 3.1 Critical Dependency Analysis
The following components are heavily coupled to Logistics and **will break** or require major refactoring:

| Component | Current Dependency | Required Change |
| :--- | :--- | :--- |
| **`QuoteForm` / `ShipmentForm`** | Direct binding to `weight_kg`, `volume_cbm` | Refactor to **Dynamic Form Renderer** that loads fields based on Domain Config. |
| **`QuotesWidget`** | Displays hardcoded logistics columns | Convert to a generic widget that accepts a "Column Definition" prop from the Domain Plugin. |
| **Database Types (TypeScript)** | Generated from current SQL schema | Must be split into `CoreQuote` and `LogisticsQuote` interfaces. |

### 3.2 Scope of Code Changes
*   **New Development (~40%):**
    *   **Taxation Module:** `src/services/taxation/` (Edge Functions + UI for Tax Rules).
    *   **Financial Module:** `src/components/finance/` (Invoices, GL Views).
    *   **Plugin Registry:** A mechanism in the frontend to load the correct "Adapter" at runtime.
*   **Refactoring (~30%):**
    *   `src/components/crm/` needs to be stripped of logistics-specific logic and moved to `src/plugins/logistics/`.
*   **Deprecated:**
    *   Direct calls to `supabase.from('quote_items')` without checking domain type.

## 4. Database Impact

### 4.1 Schema Conflicts (High Severity)
The most critical conflict is in the `quote_items` and `quote_legs` tables.

*   **Current Schema (`schema_part_02.sql`):**
    ```sql
    CREATE TABLE quote_items (
      ...
      weight_kg numeric,       -- LOGISTICS ONLY
      volume_cbm numeric,      -- LOGISTICS ONLY
      cargo_type_id uuid,      -- LOGISTICS ONLY
      ...
    );
    ```
*   **Conflict:** A "Banking" tenant creating a Loan Quote does not have weight or cargo type. Keeping these columns violates the "Domain Agnostic" requirement and creates a sparse, messy table.

### 4.2 Migration Strategy
**Table Inheritance / Extension Tables:**
1.  **`public.quote_items` (Core):** `id`, `quote_id`, `line_number`, `amount`, `description`.
2.  **`logistics.quote_items_extension`:** `item_id` (FK), `weight_kg`, `volume_cbm`.
3.  **`banking.quote_items_extension`:** `item_id` (FK), `interest_rate`, `term_months`.

**ETL Requirement:**
*   A migration script is needed to move existing data from `public.quote_items` columns to `logistics.quote_items_extension` without data loss.

## 5. Risk Assessment & Mitigation

### Risk Register

| ID | Risk | Severity | Root Cause | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | **Breaking Logistics Quotes** | **Critical** | Moving `weight_kg` out of the main table will break *all* existing queries and UI forms immediately. | **Database Views:** Create a view named `quote_items_view` that joins Core + Logistics tables. Point existing UI to this View instead of the Table during transition. |
| **R-02** | **Tax Engine Latency** | High | Real-time Nexus checks (FR-TAX-001) on every item add/update will freeze the UI. | **Debouncing & Caching:** Only trigger Tax Calc on "Save" or "Finalize", not on every keystroke. Cache Tax Rules in Redis/Local Storage. |
| **R-03** | **Data Leakage** | Critical | "Banking" tenant seeing "Logistics" columns or data due to shared schema. | **Strict RLS:** Update Row Level Security policies to enforce isolation not just by `tenant_id` but also by `domain_type`. |
| **R-04** | **Schema Drift** | Medium | Local dev environment diverging from Production during the complex split. | **Idempotent Migrations:** Use the `make_schema_idempotent.cjs` script pattern we established to ensure safe, repeatable deployments. |

## 6. Recommendations
1.  **Phase 0 (Stabilization):** Create the `quote_items_view` immediately and refactor the current codebase to use it. This proves the concept of decoupling before any new features are added.
2.  **Sidecar Development:** Build the **Taxation** and **Financial** modules as additive changes first (new tables) to avoid disrupting the core path.
3.  **Strict Boundary:** Do not allow the new "Banking" plugin to access legacy tables. It must start with the clean "Core + Extension" pattern.
