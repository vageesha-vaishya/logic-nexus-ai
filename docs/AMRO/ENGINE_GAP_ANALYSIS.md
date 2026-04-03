# AMRO Aircraft Engine Module Gap Analysis

## 1. Lifecycle Management
- Current: lifecycle records, serialized install history, thrust-rating changes, on-wing timeline, configuration panel.
- Partial: formal configuration graph editing and LLP stack authoring.
- Gap: dedicated engine asset lifecycle API contract with immutable configuration snapshots.

## 2. Maintenance Scheduling
- Current: maintenance schedule rows, conflict and resource allocation views.
- Partial: engine-focused next-due policy evaluation not exposed as dedicated contract.
- Gap: deterministic next-due API tied to policy snapshots and compliance constraints.

## 3. Parts Inventory Tracking
- Current: work-order parts tracking and AMRO materials integration.
- Partial: engine-specific serialized parts trace within configuration context.
- Gap: rotable and LLP traceability search with chain-of-custody projection.

## 4. Work Order Management
- Current: work-order totals, recent work, digital signature workflow.
- Partial: engine shop-visit package orchestration.
- Gap: engine shop-visit state model with role-specific transition policies.

## 5. Compliance Documentation
- Current: AD/SB counters, regulator profiles, standards mapping.
- Partial: engine dossier generation is not a first-class pipeline.
- Gap: authority-specific engine release dossier export pack.

## 6. Predictive Maintenance
- Current: anomaly indicators, risk score, trend summary.
- Partial: model governance and drift/explainability telemetry.
- Gap: model lifecycle and confidence policy controls with operational gates.

## Recommended Priority
- P0: API-ENG-001/002 and read-model integration.
- P1: API-ENG-003 next-due + compliance linkage.
- P2: API-ENG-004 predictive/performance governance.
