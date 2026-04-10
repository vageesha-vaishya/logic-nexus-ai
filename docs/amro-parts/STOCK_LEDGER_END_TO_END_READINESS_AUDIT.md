# AMRO Parts Stock Ledger End-to-End Readiness Audit

## Audit Scope
This audit evaluates implementation readiness of the Stock Ledger module across five dimensions:
1. Feature and Functionality
2. UI/UX Enhancements
3. Reporting Enhancements
4. Operational Enhancements
5. Missing Features

Evidence sources:
- UI implementation:
  - `src/features/module-amro/components/parts/AmroStockLedgerPanel.tsx`
- Frontend API adapter:
  - `src/features/module-amro/components/parts/stockLedgerApi.ts`
- API adapter tests:
  - `src/features/module-amro/components/parts/stockLedgerApi.test.ts`
- Data model/migrations:
  - `supabase/migrations/20260408224500_amro_stock_ledger_module_foundation.sql`
  - `supabase/migrations/20260408233000_amro_stock_ledger_phase2_valuation_and_period_controls.sql`
- Existing functional docs:
  - `docs/amro-parts/STOCK_LEDGER_MODULE_IMPLEMENTATION_GUIDE.md`
  - `docs/amro-parts/STOCK_LEDGER_USER_MANUAL.md`
  - `docs/amro-parts/STOCK_LEDGER_UAT_SESSION_PLAN.md`

---

## Executive Summary
- **Overall readiness**: `Moderate` (foundation is strong, enterprise completion pending).
- **Strengths**:
  - robust core ledger transaction model and valuation schema
  - period close/reopen and approval queue data structures
  - reconciliation and audit export pathways
  - consistent UI integration in AMRO Parts workspace
- **Critical gaps**:
  - stock-ledger API routes are not present in this frontend repository’s local API tree (`src/pages/api/v2/amro`) and depend on external AMRO API service runtime
  - no explicit cycle-count workflow integration in module UI/API adapter
  - no barcode/RFID transaction capture flow in Stock Ledger UI
  - limited real-time dashboard/alert automation beyond manual actions and exports
  - no explicit concurrency conflict protocol (optimistic locking/version checks) surfaced in UI flow

Readiness scorecard (1-5):
- Feature/Functionality: `3.5`
- UI/UX: `3.0`
- Reporting: `3.0`
- Operational: `3.0`
- Missing Features Closure: `2.5`

---

## 1) Feature and Functionality Gap Analysis

### Current coverage
- Core transaction logging: implemented (`receipt/issue/consume/reserve/release/adjustment/transfer/return`).
- Valuation methods: schema supports `fifo`, `lifo`, `weighted_average`; UI supports selection in period controls.
- Multi-location handling: available via `part_inventory_id` and location-linked inventory records.
- Batch posting: supported by `/stock-ledger/batch` adapter.
- Period controls and approvals: open/close/reopen request/decision/reopen execution flows are implemented in UI and adapter.
- Reconciliation: manual run supported with summarized response.

### Gaps
- Integration orchestration with procurement/sales/warehouse is only implicit through `sourceModule/sourceReference`; no end-to-end transaction origin enforcement.
- Serial/batch lot traceability depth is limited in UI (no explicit lot genealogy view; fields exist but workflow is not surfaced).
- API implementation dependency risk:
  - adapter expects `/api/v2/amro/stock-ledger*` endpoints, but route files are not in this repo’s local AMRO API path.
  - runtime success depends on external AMRO API service availability and route parity.

### Recommendation priority
- `P0`: close API deployment/contract parity risk.
- `P1`: formalize source integration contracts for procurement/work-order/sales to ledger event generation.
- `P1`: expose lot/serial trace timeline view in Stock Ledger detail.

---

## 2) UI/UX Enhancement Assessment

### Current coverage
- Unified module surface, toolbar, KPI cards, and grid+detail patterns are in place.
- Core flows available:
  - create single/batch transactions
  - run reconciliation
  - period governance operations
  - report and audit export
- Error messaging and loading states are present.

### Gaps
- High-density action toolbar can overwhelm users on tablet widths.
- No guided “transaction wizard” for business-safe posting (e.g., issue vs consume domain checks).
- Accessibility is acceptable baseline but lacks task-level affordances:
  - no clear transactional keyboard shortcuts in Stock Ledger module
  - no dedicated inline validation summary for multi-field transaction errors.
- Mobile responsiveness for advanced period/approval operations remains interaction-dense.

### Recommendation priority
- `P1`: convert transaction creation into step-based wizard with domain-aware validation.
- `P2`: reduce toolbar action density with grouped “More Actions” menu on smaller breakpoints.
- `P2`: add a11y-first error summary and keyboard action map.

---

## 3) Reporting Enhancement Analysis

### Current coverage
- Report export adapter supports:
  - stock balance
  - transaction history
  - valuation summary
- Audit export endpoint support in adapter.

### Gaps
- No embedded real-time dashboard widgets specific to ledger variance trend, close-cycle performance, approval SLA breach.
- No customizable report templates or saved report definitions.
- Alert mechanisms are mostly manual (button-triggered reconciliation/export), no automated exception subscriptions.
- Limited scheduling/notification for periodic reports.

### Recommendation priority
- `P1`: add real-time dashboard KPIs:
  - unresolved variance count
  - open period age
  - pending approvals SLA
  - valuation drift trend
- `P2`: saved report templates + scheduled exports.
- `P2`: configurable alert policies (variance threshold, stale approvals, backdated posting attempts).

---

## 4) Operational Enhancement Review

### Current coverage
- Data model supports reconciliation runs/items, valuation layers/consumptions, audit timeline, approval queue.
- Negative stock prevention is documented and surfaced in user/manual flows.
- Batch ingest and period lock/reopen governance are present.

### Gaps
- Concurrency handling is not explicit:
  - no visible row-version checks/ETag strategy in adapter calls.
- Performance/scalability controls are partial:
  - list API in UI currently requests fixed page size and uses client-side interactions without explicit lazy pagination controls in ledger view.
- Automated reconciliation cadence is not policy-driven in module (manual trigger only).
- Exception handling playbooks (retry/idempotency for partial batch failure) are not fully surfaced in UI.

### Recommendation priority
- `P0`: implement optimistic locking/version fields for mutable period/approval operations.
- `P1`: introduce server-driven pagination with UI paging and query cursor support.
- `P1`: add scheduled reconciliation with policy configuration and alert output.
- `P2`: enrich batch failure diagnostics with downloadable reject reasons and retry package generation.

---

## 5) Missing Features Inventory

Status summary:
- FIFO/LIFO tracking: **Partially implemented** (schema + period controls present; advanced operational transparency and verification UX limited).
- Cycle counting integration: **Missing/Not surfaced**.
- Barcode/RFID support: **Missing in Stock Ledger UI flow** (inventory scan endpoint exists at broader AMRO level, not integrated into stock-ledger posting workflow).
- Multi-currency handling: **Partially implemented** (`currency` field exists; no FX valuation policy/reporting layer in UI).
- Compliance requirements: **Partially implemented** (audit timeline and approvals exist; policy packs/compliance dashboards not fully integrated for stock-ledger domain).

---

## Prioritized Recommendations

### P0 (Immediate, release-blocking for enterprise rollout)
1. **API Contract Readiness Gate**
   - Verify and enforce stock-ledger route availability in runtime AMRO API service for all adapter paths.
   - Add startup/health check contract validation for `/stock-ledger*`.
2. **Concurrency Safety**
   - Add optimistic lock tokens (version/updated_at guards) to period close/reopen and approval decision workflows.

### P1 (High-value enhancements)
1. Source-system integration contract hardening (procurement/work-order/sales event mapping).
2. Server-driven pagination and high-volume performance tuning for ledger records.
3. Automated reconciliation scheduling + variance alert subscriptions.
4. Transaction wizard with rule-aware validations and guided UX.
5. Stock-ledger dashboard for variance, approvals, valuation movement trend.

### P2 (Maturity and optimization)
1. Saved/scheduled report templates.
2. Cycle-count integration flow and discrepancy posting wizard.
3. Barcode/RFID-assisted posting mode.
4. Multi-currency valuation analytics (base currency + FX delta reporting).
5. Compliance policy dashboards and evidence bundles.

---

## Technical Specifications for Key Gaps

## A) API Contract Readiness
- Add contract probe service at app startup:
  - endpoints: list, create, batch, reconcile, periods, approvals, reports, audit export.
- If probe fails:
  - disable mutation controls
  - show blocking status banner with actionable diagnostics.

## B) Concurrency Control
- Add `row_version` (or `updated_at` precondition) to:
  - period close/reopen
  - approval decision
  - reopen execution
- Backend returns `409 Conflict` on stale write; UI provides reload-and-compare resolution.

## C) High-volume Ledger UX
- Implement cursor/page API query support:
  - `page`, `page_size`, `sort`, `cursor`
- UI:
  - pagination controls
  - progressive rendering and skeleton rows
  - persisted filter state

## D) Batch and Exception Management
- Batch response enhancement:
  - include reject row index, reason code, field list, correlation id.
- UI:
  - reject download JSON/CSV
  - retry valid subset action.

## E) Cycle Count + Scan Integration
- Add cycle-count transaction type + workflow state.
- Integrate scan endpoint (`/api/v2/amro/inventory/scan`) into stock posting assistant.
- Validate scanned part/location against selected ledger posting context.

---

## Success Metrics
- Functional accuracy:
  - ledger-to-balance variance rate < `0.1%` across reconciliation runs.
- Reliability:
  - stock-ledger API availability >= `99.9%`.
- Performance:
  - p95 ledger list response < `800ms` for 100k+ transactions with filters.
  - UI interaction p95 < `120ms` for filter/sort updates on paged views.
- Governance:
  - `100%` period close/reopen actions with immutable audit hash.
- UX:
  - task completion time for “post issue + reconcile check” improved by `25%`.

---

## Phased Enhancement Plan

## Phase 1 (2-3 weeks) - Stability and Contract Hardening
Deliverables:
- API contract probe and readiness gating
- optimistic locking for mutable workflows
- improved conflict and error messaging
Testing/QA:
- contract probe tests
- stale write conflict tests
- regression for create/batch/reconcile/period flows

## Phase 2 (3-4 weeks) - Scale and Operational Automation
Deliverables:
- server-side pagination and query tuning
- scheduled reconciliation + alert policies
- dashboard KPIs for variance and approval SLA
Testing/QA:
- load tests at 10k/50k/100k transactions
- alert accuracy tests
- dashboard data consistency tests

## Phase 3 (4-6 weeks) - Advanced Inventory Intelligence
Deliverables:
- cycle count integration
- barcode/RFID-assisted posting workflow
- multi-currency valuation/report enhancements
Testing/QA:
- end-to-end cycle-count correction scenarios
- scan-to-post validation tests
- FX conversion and valuation reconciliation tests

---

## QA Acceptance Criteria by Area
- Feature completeness: all core transaction, period, approval, reconciliation paths pass deterministic UAT set.
- UX quality: no critical accessibility blockers; responsive behaviors validated at mobile/tablet/desktop.
- Reporting integrity: exported totals match API source of truth for all supported report types.
- Operational resilience: conflict, timeout, partial batch failure, and retry scenarios validated.
- Compliance traceability: every mutation has immutable audit trace and actor metadata.
