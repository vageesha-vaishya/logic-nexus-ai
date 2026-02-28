# Quotation Dashboard Diagnostic & Remediation Report

## 1. Executive Summary
This report details the diagnostic findings for the Quotation Dashboard system, identifying critical UI/UX gaps and data pipeline optimizations. A remediation plan is proposed to enhance performance, accessibility, and user experience.

## 2. Defect Inventory & UI/UX Audit

| Severity | Category | Issue | Description |
|----------|----------|-------|-------------|
| **High** | UX | Missing Skeleton Loaders | Dashboard shows a generic loading spinner or empty state instead of a skeleton structure, causing layout shift. |
| **High** | UX | No Real-time Updates | Users must refresh the page to see new quotes or status changes. |
| **Medium** | UX | Generic Card Design | Quotation cards in the list view lack visual hierarchy and key details (e.g., origin/destination icons). |
| **Medium** | Feature | Missing "Duplicate" Action | No quick way to clone an existing quotation. |
| **Medium** | Performance | Potential Index Misses | Foreign keys on `quotes` table may lack indexes, affecting query performance at scale. |
| **Low** | Accessibility | Contrast/Focus | Standard shadcn/ui components are generally good, but specific custom badges need contrast verification. |

## 3. Data Pipeline Analysis

### Flow Trace
1.  **Creation**: `UnifiedQuoteComposer` -> `save_quote_atomic` (RPC) -> `quotes` table (Upsert).
2.  **Retrieval**: `QuotationManager` (Quotes.tsx) -> `scopedDb.from('quotes')` -> Filter/Sort -> Render.

### Findings
-   **RPC**: `save_quote_atomic` correctly handles `owner_id` and `tenant_id` (after recent fix).
-   **Database**: The `quotes` table has numerous foreign keys (`account_id`, `opportunity_id`, `origin_port_id`, etc.). Indexes need verification.
-   **Frontend State**: Uses local `useState` for quotes list. No global store (Redux/Context) for the list view, which is acceptable for this page but limits cross-component updates.

## 4. Remediation Plan

### 4.1 Database Optimizations
-   **Action**: Create migration to add B-tree indexes on frequently queried columns:
    -   `tenant_id`, `franchise_id` (RLS performance)
    -   `account_id`, `opportunity_id`, `contact_id` (Joins)
    -   `created_at` (Sorting)
    -   `status` (Filtering)

### 4.2 Frontend Enhancements
-   **Skeleton Loaders**: Implement `QuoteListSkeleton` component.
-   **Real-time**: Implement Supabase `channel` subscription to listen for `INSERT`/`UPDATE` on `quotes` table.
-   **Duplicate Action**: Add "Duplicate" button to the actions menu that prefills the composer with existing data.
-   **Card Redesign**: Enhance `DataTable` columns or switch to a Grid view with richer cards.

## 5. Implementation Steps
1.  Apply database indexing migration.
2.  Update `Quotes.tsx` to include `Duplicate` action.
3.  Update `Quotes.tsx` to use `Realtime` subscription.
4.  Update `Quotes.tsx` to show Skeleton state.
