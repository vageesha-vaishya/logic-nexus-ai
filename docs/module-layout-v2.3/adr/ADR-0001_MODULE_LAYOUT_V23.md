# ADR-0001: Module Layout v2.3 Integration Strategy

Status: Accepted  
Date: 2026-04-08  
Decision Owners: Front-end lead, Platform architect, QA lead

## Context
The Grid + Record Detail workspace requires operational observability and quality assurance overlays:
- Event Stream
- CRUD Events
- Viewport Validation Checklist

Constraints:
- render target < 120 ms for 10k rows
- memory target <= 150 MB/tab
- SOC-2 + GDPR compliance
- concurrency target up to 5,000 sessions

## Decision
Adopt a phased architecture:
1. Integrate Event Stream as adjacent side panel with shared workspace context and bounded event buffer.
2. Integrate Viewport Validation Checklist as sticky, always-visible banner with critical-field coverage tracking.
3. Keep CRUD Events integrated through icon action bar callback telemetry and visible timeline panel.
4. Defer FAB + drawer CRUD variant as optional enhancement after baseline stabilization.

## Alternatives Considered
### Alternative A: Drawer-first CRUD + no side stream
- Rejected: weaker observability and slower operator scanning for event updates.

### Alternative B: Single monolithic timeline panel
- Rejected: mixes validation and event semantics, reduces clarity.

### Alternative C: Full websocket-first redesign before UI integration
- Rejected: larger delivery risk and timeline expansion beyond budget cap.

## Consequences
Positive:
- clear UX hierarchy and reduced recovery friction.
- stable performance and lower bundle change impact.
- better traceability for operations and QA.

Trade-offs:
- added panel orchestration complexity.
- requires strict event schema governance.

## Evidence
- Prototype package and metrics:
  - [PHASE_3_COMPARATIVE_PROTOTYPES.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/PHASE_3_COMPARATIVE_PROTOTYPES.md)
- Security and validation:
  - [THREAT_MODEL_AND_VALIDATION.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/security/THREAT_MODEL_AND_VALIDATION.md)
