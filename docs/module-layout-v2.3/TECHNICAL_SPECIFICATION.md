# Technical Specification – Module Layout v2.3

Version: 2.3.0  
Prepared by: Platform Engineering  
Date: 2026-04-08

## 1. Executive Scope
This specification defines production integration of Event Stream, CRUD Events, and Viewport Validation Checklist into the existing Grid + Record Detail workspace used by AMRO inventory operators.

## 2. Problem Statement
Current workspace behavior supports grid-detail navigation and CRUD interaction but lacks:
- durable event visibility for operational auditability,
- explicit CRUD event timeline for user traceability,
- viewport quality guardrails that continuously validate critical form visibility and accessibility rules.

## 3. In-Scope Objectives
- integrate Event Stream and CRUD event telemetry into workspace UX.
- provide sticky Viewport Validation Checklist with critical-field coverage.
- preserve high-performance behavior for large datasets.
- maintain accessibility standards (WCAG 2.1 AA target profile).

## 4. Out-of-Scope
- full backend event broker replacement.
- global design-system overhaul.
- non-AMRO domain-specific workflow changes.

## 5. Existing Architecture Summary
### 5.1 Workspace Components
- Grid view for inventory row navigation.
- Record Detail form for selected row.
- detail action bar for CRUD operations.
- panel resize/collapse controls and restoration mechanisms.

### 5.2 Data and API Surface
- AMRO inventory endpoints:
  - `sync`, `scan`, `work-order-sync`, `availability`, `reservations`.
- master-data entity handlers and contract endpoints.
- UIM sync target tables for canonical inventory state.

## 6. Functional Requirements
FR-01: Event Stream must show latest inventory and CRUD events in near real-time.  
FR-02: CRUD events must be visible in UI and exportable via callback telemetry.  
FR-03: Viewport checklist must remain visible and track pass/fail for critical fields.  
FR-04: Grid and detail panels must support resize/collapse/restore with keyboard parity.  
FR-05: Restore control must remain visible in all collapse states and scroll positions.

## 7. Non-Functional Requirements
NFR-01: render < 120 ms for 10k rows (virtualized mode).  
NFR-02: memory <= 150 MB/tab under standard workload profile.  
NFR-03: support up to 5,000 concurrent sessions at service tier.  
NFR-04: SOC-2 and GDPR-aligned auditability and PII minimization.  
NFR-05: bundle delta <= 5% for v2.3 integration.

## 8. Data Model
### 8.1 Event Stream Payload
Contract: [event-stream.schema.json](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/schemas/event-stream.schema.json)

Core fields:
- `event_id`
- `event_type`
- `occurred_at`
- `actor`
- `payload`
- optional `checksum`

### 8.2 CRUD Event UI State
```ts
type CrudUiEvent = {
  action: 'create'|'read'|'update'|'delete'|'save'|'cancel';
  recordId?: string;
  ts: string;
  actor?: string;
  outcome?: 'success'|'failed'|'blocked';
}
```

### 8.3 Viewport Checklist State
```ts
type ViewportCheck = {
  id: string;
  severity: 'critical'|'warning'|'info';
  label: string;
  passed: boolean;
  observedAt: string;
}
```

## 9. Component Interface Contracts
### 9.1 Grid Template Contract
- `onRecordSelectionChange`
- `onScrollPositionChange`
- `onViewModeChange`
- `onCrudAction`
- CRUD-specific callbacks (`onCreateRecord`, `onSaveRecord`, etc.)

### 9.2 Event Stream Panel Contract
- input: event array (append-only buffer with retention)
- output: selected event callback, filter state, export action callback

### 9.3 Viewport Checklist Contract
- input: viewport metrics + form field map
- output: checklist state + unresolved count

## 10. Sequence Flows
### 10.1 Grid to Detail to Event Trace
1. User selects grid row.
2. Detail form hydrates selected record.
3. User triggers CRUD action.
4. CRUD callback emits event envelope.
5. Event stream appends entry and refreshes timeline.
6. Checklist recomputes if layout or required-field visibility changed.

### 10.2 Collapse/Restore Safety Flow
1. User collapses detail panel.
2. Floating restore action appears in persistent workspace layer.
3. User restores panel via button or `Ctrl/Cmd+Shift+E`.
4. Layout returns to previous split ratio.

## 11. C4 Model
### 11.1 Container View
- Browser client: React workspace.
- API layer: Next.js AMRO endpoints.
- Data layer: Supabase/Postgres + UIM integration tables.
- Observability: logging, analytics, error telemetry.

### 11.2 Component View
- `AmroInventoryDataGridTemplate`
- `EventStreamPanel` (prototype)
- `CrudTimelinePanel` (story/workbench integration)
- `ViewportChecklistBanner` (prototype)
- `inventoryApiService` / contract adapters

Source:
- [MODULE_LAYOUT_V23.drawio](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/c4/MODULE_LAYOUT_V23.drawio)

## 12. Security and Compliance Controls
- schema validation for all event envelopes.
- strict output encoding and sanitization for form text/object rendering.
- role-based access checks on CRUD and checklist update surfaces.
- audit trail with immutable event metadata and actor identity.
- PII minimization in event payload.

Reference:
- [THREAT_MODEL_AND_VALIDATION.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/security/THREAT_MODEL_AND_VALIDATION.md)

## 13. Performance Strategy
- row virtualization with overscan limits.
- memoized cell and detail section rendering.
- debounced scroll emissions.
- bounded event timeline retention.
- split-pane resize updates via lightweight state transitions.

## 14. Accessibility Specification
- keyboard parity for resize, collapse, restore.
- `role="separator"` with ARIA value range semantics.
- icon-only buttons with tooltips + ARIA labels.
- focus-visible ring and SR announcements for key transitions.
- target AA contrast profile for interactive elements.

## 15. Operational Telemetry
Metrics:
- event stream latency p50/p95
- CRUD callback success/failure counters
- checklist pass-rate trend by viewport category
- panel collapse/restore interaction frequencies

Dashboard artifact:
- [KPI_DASHBOARD_GRAFANA.json](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/KPI_DASHBOARD_GRAFANA.json)

## 16. Testing Requirements
- unit tests for component state machine and callbacks.
- integration flow tests (grid -> detail -> crud -> stream -> checklist).
- viewport-focused tests for 1366x768 and tablet/mobile breakpoints.
- security scan gates for SAST/DAST/dependency risk.

See:
- [TEST_STRATEGY.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/TEST_STRATEGY.md)

## 17. Deployment Plan
- alpha: internal Storybook and feature flag environment.
- beta: integrated module with telemetry and checklist gating.
- security gate: pen-test + ZAP + dependency policy pass.
- UAT: workflow sign-off by operations and QA.
- release: `v2.3.0` tag and changelog publication.

## 18. Backward Compatibility
- no breaking API contract introduced by UI-only additions.
- CRUD callback extensions are additive.
- event schema versioned for future compatibility.

## 19. Risks and Mitigations
| Risk | Mitigation |
|---|---|
| event payload XSS | schema and sanitizer gates |
| degraded performance under 10k rows | virtualization + perf budgets |
| panel restore UX regression | persistent restore controls + shortcut + tests |
| checklist false positives | revisioned rule model + calibration run |

## 20. Acceptance Criteria
- all critical checklist items visible at 1366x768 without horizontal form scrolling.
- restore control discoverable in every collapse state.
- CRUD actions reflected in timeline and callback telemetry.
- no high/critical security findings at release gate.

## 21. PDF Export Note
This markdown is authored as the canonical source for the required PDF deliverable.  
In CI/Confluence export stage, convert this file to PDF and publish under module-layout-v2.3 release artifacts.
