# Implementation Plan & Roadmap

## Phase 1: Foundation & Data Model (Weeks 1-4)
**Goal**: Establish the relational database structure required for complex logistics.

*   **Week 1: Schema Migration**
    *   Create `master_consols`, `shipment_containers`, `job_charges` tables.
    *   Update `shipments` table with foreign keys.
    *   Create RLS policies for new tables.
*   **Week 2: TypeScript Types & SDK**
    *   Regenerate Supabase types.
    *   Create Zod schemas for new data models.
    *   Update `useCRM` hooks to fetch deep nested data (Consol -> House -> Cargo).
*   **Week 3: Navigation & UI Shell**
    *   Update Sidebar to split "Shipments" into "Ocean Imports", "Ocean Exports", "Air Imports", "Air Exports", "Rail", "Trucking", "Couriers".
    *   Create the "Consolidation Console" view (Master Shipment list).
*   **Week 4: Data Migration Scripts**
    *   Script to move existing flat shipments into the new hierarchical model (create dummy Master records for them).
    *   Backfill tenant_id/franchise_id where missing; verify referential integrity

## Phase 2: Ocean Freight Module (Weeks 5-8)
**Goal**: Enable end-to-end Ocean Import/Export processing.

*   **Week 5: Container Management UI**
    *   Build "Container List" component (Add/Edit/Delete containers).
    *   Implement "Manifest" view (Drag & drop shipments into containers).
*   **Week 6: Bill of Lading (BL) Logic**
    *   Implement BL Number generation logic.
    *   Create "Shipping Instructions" form.
*   **Week 7: Document Generation**
    *   Implement `generate-pdf` Edge Function.
    *   Design HBL and Manifest PDF templates.
*   **Week 8: Testing & Refinement**
    *   End-to-end test: Booking -> Container -> Manifest -> HBL -> Release.

## Phase 3: Financials & Job Costing (Weeks 9-12)
**Goal**: Enable profitability analysis per shipment.

*   **Week 9: Charge Catalog**
    *   UI to manage standard charge codes and GL codes.
    *   Link charges to specific vendors/carriers.
*   **Week 10: Charge Entry UI**
    *   Build "Financials" tab in Shipment Detail.
    *   Grid view for entering Payables (Costs) and Receivables (Revenue).
*   **Week 11: Profit Calculation Logic**
    *   Implement real-time margin calculation (Revenue - Cost).
    *   Handle multi-currency display.
*   **Week 12: Invoicing**
    *   Generate Invoice PDF from Receivable charges.
    *   Sync status to "Billed".

## Phase 4: Air & Road Modules (Weeks 13-16)
**Goal**: Expand mode support.

*   **Week 13: Air Freight Specifics**
    *   AWB Stock Management module.
    *   Volumetric Weight Calculator (1:6000).
*   **Week 14: Trucking & Dispatch**
    *   Driver/Vehicle assignment UI.
    *   Proof of Delivery (POD) upload mobile view.
*   **Week 15: Warehouse Entry**
    *   Simple "Receive Cargo" screen (generate Warehouse Receipt).
*   **Week 16: Final Polish**
    *   Dashboard widgets for "Profit this Month", "Tonnage Moved".
    *   User Acceptance Testing (UAT).

## Technology Stack & Security
- Frontend: React + Vite, TanStack Table, Playwright for E2E
- Backend: Supabase Postgres, Edge Functions (Deno), Sentry/PostHog for observability
- Performance: k6 load tests; Lighthouse CI for UX
- Security: Row Level Security; per-tenant secrets; HMAC webhooks; SOC 2-aligned controls

## Resource Allocation & Timelines
- Team: 2 FE engineers, 2 BE engineers, 1 QA, 1 PM
- Cadence: 2-week sprints; bi-weekly demos; weekly performance review
- Milestones:
  - M1 (Week 4): Consolidation schema live; migration complete
  - M2 (Week 8): Ocean workflows usable; HBL docs generated
  - M3 (Week 12): Job costing and invoicing live
  - M4 (Week 16): Air/Trucking features; UAT sign-off

## Data Migration Strategy
- Inventory existing shipments; classify direct vs consolidation
- Create Master records and attach Houses where needed
- Validate tenant/franchise scoping; repair orphan references
- Run in staging with parallel run; reconcile metrics; then production cutover with rollback plan
