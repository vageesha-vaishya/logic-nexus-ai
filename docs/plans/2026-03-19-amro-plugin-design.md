# AMRO Domain Master Design Reference
## Logic Nexus-AI Platform Integrated UI/UX and Implementation Blueprint

**Document ID:** DESIGN-AMRO-001  
**Version:** 2.0.0  
**Date:** 2026-03-19  
**Status:** Draft for Stakeholder Review and Approval Gate  
**Owner:** AMRO Architecture Working Group  
**Scope:** Complete AMRO domain design reference for current and future development

---

## 1. Purpose and Source Baseline

This document is the single master reference for AMRO domain design in Logic Nexus-AI. It consolidates architecture, UI/UX specifications, traceability, phased implementation planning, delivery status, and governance controls.

**Source baseline**
- AMRO requirements specification: `artifacts/mro/analysis/amro-plugin-requirements-spec-v1.0.md`
- AMRO implementation reference: `docs/plans/2026-03-19-amro-plugin-implementation-reference.md`
- AMRO implementation plan: `docs/plans/2026-03-19-amro-plugin-implementation.md`
- Current AMRO migrations and backend services in this repository

**Primary objectives**
- Keep design and implementation aligned with platform multi-tenancy, security, and compliance rules
- Define precise UI/UX behavior and reusable component patterns
- Provide requirement-to-design-to-validation traceability for every AMRO UI/UX component
- Govern implementation with approval gates, version control, and change protocols

---

## 2. Current Platform Architecture for AMRO

### 2.1 Integration Model

AMRO runs as a platform-integrated domain module:
- Reuses platform tenancy, auth, RBAC/ABAC, eventing, and observability
- Owns AMRO workflows, API surfaces, schema objects, and compliance logic
- Preserves backward compatibility using additive evolution and versioned endpoints

### 2.2 Architecture Layers

| Layer | Existing Platform Capability | AMRO Domain Extension | Current State |
|---|---|---|---|
| Presentation | Dashboard layout, shared UI primitives | AMRO workspace pages, mobile task execution UX | Partial |
| API | REST/GraphQL gateway, auth middleware | `/api/v1/work-packages`, `/api/v1/tasks`, AMRO event endpoints | Active |
| Domain Services | Shared service framework | Work package orchestration, qualification checks, audit recording | Partial |
| Data | PostgreSQL + Supabase, RLS model | AMRO operational tables + immutable `mro_audit` schema | Active |
| Eventing | Kafka backbone | Work package and task lifecycle topics | Active |
| Governance | CI/CD, quality gates | AMRO-specific traceability, approval, and release controls | In progress |

### 2.3 Data and Security Fundamentals

- Multi-tenancy enforced with `tenant_id` across AMRO tables
- Row-level security required for all AMRO entities
- Audit records and trails implemented as append-only with immutability triggers
- Domain types constrain status and workflow state values
- API contracts remain additive and semantically versioned

---

## 3. UI/UX Master Specification

### 3.1 UX Principles

- Safety-first interaction for compliance-sensitive actions
- Role-aware visibility and action enablement
- Progressive disclosure for technical detail and audit evidence
- High-speed operator workflows with minimal context switching
- Deterministic and auditable state transitions

### 3.2 Information Architecture

| AMRO Area | Primary User Roles | Primary Outcomes |
|---|---|---|
| AMRO Overview | Maintenance Manager, Planner | Monitor active workload and compliance risk |
| Work Packages | Planner, Supervisor | Create, assign, schedule, and track work packages |
| Task Execution | Technician, Inspector | Execute procedures and capture evidence |
| Materials | Planner, Store Control | Allocate parts and track shortages |
| Qualifications | Compliance Officer, Supervisor | Verify certifying authority and currency |
| Audit and Compliance | Compliance Officer, Auditor | Replay and validate maintenance history |

### 3.3 Screen-Level Wireframes

#### AMRO Overview Dashboard

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ AMRO > Overview        [Date Range] [Filters] [Export] [Refresh]            │
├───────────────────────────────────────────────────────────────────────────────┤
│ KPI: Open WP | In Progress Tasks | Deferred Items | Compliance Alerts        │
├─────────────────────────────────────┬─────────────────────────────────────────┤
│ Work Package Pipeline (Kanban)      │ Risk and Compliance Panel              │
│ [Planning][Scheduled][In Progress]  │ - Expiring certifications              │
│ [On Hold][Completed][Closed]        │ - Audit anomalies                      │
├─────────────────────────────────────┴─────────────────────────────────────────┤
│ Bottom Summary: Throughput | SLA Breaches | Mean Downtime                    │
└───────────────────────────────────────────────────────────────────────────────┘
```

#### Work Package List and Filters

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ AMRO > Work Packages   [Search] [Filters] [Group] [Saved Views] [New]        │
├───────────────────────────────────────────────────────────────────────────────┤
│ Table: WO# | Aircraft | Type | Priority | Status | Due | Assignee | Actions  │
│ Row click -> Work Package Detail                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

#### Work Package Detail

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ WO-2026-00091 [Status Chip] [Assign] [Schedule] [Close Package]              │
├───────────────────────────────────────────┬───────────────────────────────────┤
│ Left: Overview, Tasks, Materials, Notes   │ Right: Activity and Audit Feed    │
│ - Aircraft and source references           │ - Sign-offs                        │
│ - Labor and downtime plan                  │ - Overrides                         │
│ - Qualification gate checks                │ - Evidence timeline                 │
└───────────────────────────────────────────┴───────────────────────────────────┘
```

#### Mobile Task Execution Card

```text
┌──────────────────────────────┐
│ Task 12/40  [In Progress]    │
├──────────────────────────────┤
│ Procedure Ref: ATA 27-30-01  │
│ Step checklist               │
│ [ ] Step A                   │
│ [ ] Step B                   │
│ Evidence                     │
│ [Add Photo] [Add Note]       │
│ Sign-off                     │
│ [PIN] [Digital Signature]    │
│ [Save Offline] [Submit]      │
└──────────────────────────────┘
```

### 3.4 Interaction Flows

#### Work Package Lifecycle Flow

```mermaid
flowchart LR
  A[Create Work Package] --> B[Plan Labor and Materials]
  B --> C[Assign and Schedule]
  C --> D[Task Execution]
  D --> E[Quality and Certifying Checks]
  E --> F[Close Package]
  F --> G[Immutable Audit Record]
```

#### Offline Task Execution and Sync

```mermaid
flowchart LR
  A[Open Task Card] --> B[Capture Steps and Evidence Offline]
  B --> C[Local Signed Event Queue]
  C --> D[Reconnect]
  D --> E[Conflict Resolver]
  E --> F[Persist Canonical State]
  F --> G[Append Audit Trail]
```

### 3.5 Design Patterns and Component Library

| Pattern | Purpose | AMRO Usage |
|---|---|---|
| Control Panel Pattern | Unified module actions and filtering | AMRO list, board, and analytics pages |
| Sheet + Activity Feed Pattern | Dense form plus timeline context | Work package detail page |
| Kanban Card Pattern | Pipeline visualization with drag transitions | Work package status board |
| Step Wizard Pattern | Procedure execution with verification | Mobile and desktop task execution |
| Evidence Capture Pattern | File, note, and checklist provenance | Task completion and closure gates |
| Compliance Gate Pattern | Hard stop validations before release | Work package close workflow |

| Component Group | Base Components | AMRO Extensions |
|---|---|---|
| Layout | `DashboardLayout` | AMRO module containers and route shell |
| Navigation | Header actions, search, filters | AMRO-specific action sets and saved views |
| Data Display | Table, cards, badges, tabs | Work package list, kanban, task cards |
| Forms | Inputs, selects, date-time controls | Qualification checks and sign-off forms |
| Timeline | Activity feed components | Audit replay and evidence timeline |
| Feedback | Toasts, inline validation, skeletons | Compliance gate failures and sync states |

---

## 4. Comprehensive Traceability Matrix

### 4.1 Requirement and Source Index

| Requirement ID | Requirement Summary | Source Document |
|---|---|---|
| FR-AMRO-001 | Create work orders from defects/checks/regulatory sources | AMRO Requirements v1.0 |
| FR-AMRO-002 | Plan labor, materials, and downtime | AMRO Requirements v1.0 |
| FR-AMRO-003 | Schedule work packages with constraints | AMRO Requirements v1.0 |
| FR-AMRO-004 | Execute digital task cards with e-signature and evidence | AMRO Requirements v1.0 |
| FR-AMRO-005 | Closure gate before release | AMRO Requirements v1.0 |
| FR-AMRO-011 | Offline cache and secure local execution | AMRO Requirements v1.0 |
| FR-AMRO-012 | Deterministic offline conflict resolution | AMRO Requirements v1.0 |
| FR-AMRO-016 | AD/SB ingestion and compliance closure | AMRO Requirements v1.0 |
| FR-AMRO-017 | MEL/CDL deferral control | AMRO Requirements v1.0 |
| FR-AMRO-018 | Certifying privilege checks | AMRO Requirements v1.0 |
| FR-AMRO-019 | Component traceability and LLP tracking | AMRO Requirements v1.0 |
| FR-AMRO-020 | Line/base maintenance separation | AMRO Requirements v1.0 |
| FR-AMRO-026 | Immutable maintenance records | AMRO Requirements v1.0 |
| NFR-AMRO-001 | Scale and latency targets | AMRO Requirements v1.0 |
| NFR-AMRO-003 | Availability and recovery objectives | AMRO Requirements v1.0 |
| NFR-AMRO-004 | Security and encryption controls | AMRO Requirements v1.0 |
| NFR-AMRO-005 | RBAC + ABAC policy model | AMRO Requirements v1.0 |
| NFR-AMRO-009 | 10-year immutable retention and replay | AMRO Requirements v1.0 |
| IR-AMRO-001 | API versioning and backward compatibility | AMRO Requirements v1.0 |
| IR-AMRO-003 | ERP adapter pattern | AMRO Requirements v1.0 |

### 4.2 UI/UX Component Traceability Matrix

| UI/UX Element ID | Design Element | Requirement IDs | Technical Spec Linkage | Source Document | Implementation Status | Validation Criteria |
|---|---|---|---|---|---|---|
| UX-AMRO-001 | AMRO overview KPI header | FR-AMRO-001, NFR-AMRO-001 | Dashboard shell + AMRO metrics API | Design + Requirements | Pending | KPI load <1s and role-filtered values |
| UX-AMRO-002 | Work package kanban board | FR-AMRO-003, FR-AMRO-005 | Kanban card and drag transition events | Design + Implementation Plan | Pending | Status transition rules and audit entry per move |
| UX-AMRO-003 | Work package list grid | FR-AMRO-001, FR-AMRO-002 | Table with scoped filtering and pagination | Design + Requirements | Pending | Filter accuracy, saved views, keyboard support |
| UX-AMRO-004 | Work package creation drawer | FR-AMRO-001, FR-AMRO-020 | Form schema, validation, source mapping | Design + Requirements | Pending | Required fields, defaults, tenant-scoped create |
| UX-AMRO-005 | Work package detail sheet | FR-AMRO-002, FR-AMRO-005 | Sheet layout + tab routing | Design + Implementation Plan | Pending | Tab persistence and no unsaved data loss |
| UX-AMRO-006 | Task list in work package detail | FR-AMRO-004 | Task table and inline status updates | Design + API Spec | Pending | Step ordering and assignment integrity |
| UX-AMRO-007 | Mobile task execution card | FR-AMRO-004, FR-AMRO-011 | Offline-safe form state and sync queue | Design + Requirements | Pending | Offline submit and later sync reconciliation |
| UX-AMRO-008 | E-signature capture modal | FR-AMRO-004, NFR-AMRO-004 | Signature method domain + auth challenge | Design + Security Spec | Pending | Signature required for closure actions |
| UX-AMRO-009 | Evidence upload and notes | FR-AMRO-004, FR-AMRO-026 | Media attachment and evidence metadata model | Design + API Spec | Pending | Evidence timestamping and actor attribution |
| UX-AMRO-010 | Compliance gate dialog | FR-AMRO-005, FR-AMRO-018 | Blocking policy engine integration | Design + Requirements | Pending | Blocks closure when qualifications invalid |
| UX-AMRO-011 | Materials allocation panel | FR-AMRO-002, FR-AMRO-019 | Work package materials APIs | Design + Requirements | Pending | Allocation totals and shortage indicators |
| UX-AMRO-012 | Qualification status chips | FR-AMRO-018 | Qualification query + status rules | Design + Requirements | Pending | Expiry warning thresholds and action gating |
| UX-AMRO-013 | Audit timeline viewer | FR-AMRO-026, NFR-AMRO-009 | `mro_audit` query model and timeline UI | Design + Implementation Reference | In progress | Strict chronological replay and immutable markers |
| UX-AMRO-014 | Compliance replay filters | FR-AMRO-016, FR-AMRO-017 | Filter presets and export actions | Design + Requirements | Pending | Filter reproducibility and export consistency |
| UX-AMRO-015 | Offline sync status banner | FR-AMRO-011, FR-AMRO-012 | Sync engine state and conflict outcomes | Design + Mobile Spec | Pending | Accurate queue count and conflict state visibility |
| UX-AMRO-016 | API/UX error fallback states | NFR-AMRO-003, NFR-AMRO-004 | Error boundaries + toast strategy | Design + Platform Standards | In progress | User-safe retries and no sensitive data exposure |
| UX-AMRO-017 | Role-aware action menu | NFR-AMRO-005 | Permission matrix in client and API | Design + Security Spec | Pending | Hidden/disabled actions by role context |
| UX-AMRO-018 | Export and reporting controls | FR-AMRO-016, IR-AMRO-001 | Report jobs and versioned export formats | Design + Requirements | Pending | Format validity and scoped data exports |
| UX-AMRO-019 | Scheduler board workspace | FR-AMRO-003 | Constraint visuals and slot assignments | Design + Implementation Plan | Pending | No overlapping slot assignments |
| UX-AMRO-020 | Future ERP integration panel | IR-AMRO-003 | Adapter status view and retry controls | Design + Integration Plan | Pending | Adapter state accuracy and resilient retries |

---

## 5. Phase-Wise Implementation Plan

### Phase 1: Core UI Components and Basic User Flows

**Scope**
- AMRO route shell, overview dashboard, work package list and detail baseline
- Core task listing and basic status transitions
- Initial role-aware action visibility

**Primary deliverables**
- UX-AMRO-001 to UX-AMRO-006
- Base AMRO module navigation and layout
- End-to-end create-plan-view work package flow

**Exit criteria**
- Users can create and manage work packages with tenant isolation
- Basic UI test suite and API integration checks pass

### Phase 2: Advanced Features and Complex Interactions

**Scope**
- Mobile task execution, offline queueing, e-signature, evidence capture
- Compliance gates, materials planning panel, qualification checks
- Scheduler board and advanced interaction states

**Primary deliverables**
- UX-AMRO-007 to UX-AMRO-015 and UX-AMRO-019
- Offline sync flow with conflict resolution UI
- Closure gate with blocking validations

**Exit criteria**
- Offline-to-online execution flow validated
- Compliance blocks enforce certifying and material prerequisites

### Phase 3: Optimization, Accessibility, and Performance Enhancements

**Scope**
- Accessibility remediation, keyboard-first interactions, focus order, contrast hardening
- Performance tuning for board and list rendering at high volume
- Error recovery and retry patterns

**Primary deliverables**
- UX-AMRO-016, UX-AMRO-017, targeted optimizations across all prior elements
- WCAG-focused test coverage and UI performance baselines

**Exit criteria**
- Accessibility validation passed for critical workflows
- p95/p99 UI interaction performance targets achieved in staging

### Phase 4: Future Enhancements and Scalability Considerations

**Scope**
- ERP adapter UX, advanced reporting, predictive maintenance surfaces
- Cross-module interoperability with logistics and finance
- Scalable extension points and feature-flagged rollout architecture

**Primary deliverables**
- UX-AMRO-018 and UX-AMRO-020
- Extensibility hooks for integrations and analytics

**Exit criteria**
- Adapter control plane available
- Documented and tested extension APIs for future AMRO capabilities

---

## 6. Implementation Status Tracking

### 6.1 Completed Implementations

| Element | Version | Deployment Date | Evidence | Notes |
|---|---|---|---|---|
| AMRO operational schema foundation | v0.1.0-db | 2026-03-19 | Migration `20260319143000` | Core tables, domain types, RLS policies |
| Immutable audit schema foundation | v0.1.1-db | 2026-03-19 | Migration `20260319143100` | Append-only audit records and trails |
| AMRO API service scaffold | v0.2.0-api | 2026-03-19 | Implementation reference M0-3 | Work package and task CRUD endpoints |
| AMRO event stream baseline | v0.2.1-api | 2026-03-19 | Implementation reference M0-4 | Kafka event publication for AMRO lifecycle |

### 6.2 Work in Progress

| Element | Current Status | Owner Group | Blockers | Next Milestone |
|---|---|---|---|---|
| Audit timeline viewer (UX-AMRO-013) | Backend and UI binding in progress | Backend + Frontend | Timeline pagination and replay filtering | Phase 2 completion |
| Error fallback states (UX-AMRO-016) | Standardized error envelope active; UI fallback alignment pending | Frontend | Consistent UX mapping per API code | Phase 3 completion |

### 6.3 Pending Implementations

| Element ID | Priority | Estimated Effort | Dependencies | Planned Phase |
|---|---|---|---|---|
| UX-AMRO-001 | High | 3 engineer-days | Metrics endpoint readiness | Phase 1 |
| UX-AMRO-002 | High | 6 engineer-days | Status policy service, drag API | Phase 1 |
| UX-AMRO-004 | High | 4 engineer-days | Work package create endpoint hardening | Phase 1 |
| UX-AMRO-007 | High | 8 engineer-days | Mobile offline storage and sync APIs | Phase 2 |
| UX-AMRO-008 | High | 5 engineer-days | Signature provider and auth challenge flow | Phase 2 |
| UX-AMRO-010 | High | 4 engineer-days | Compliance gate service integration | Phase 2 |
| UX-AMRO-015 | Medium | 4 engineer-days | Conflict resolution API events | Phase 2 |
| UX-AMRO-019 | High | 7 engineer-days | Scheduling engine output contract | Phase 2 |
| UX-AMRO-018 | Medium | 5 engineer-days | Reporting jobs and export formats | Phase 4 |
| UX-AMRO-020 | Medium | 6 engineer-days | ERP adapter orchestration service | Phase 4 |

---

## 7. Step-by-Step Implementation Instructions

### 7.1 Standard Engineering Checklist for Every UI/UX Component

1. Confirm traceability mapping entry (UI element ID, requirement IDs, validation criteria).  
2. Define API contract and state model changes using additive compatibility rules.  
3. Implement UI component with role-aware controls and tenant-safe data access.  
4. Integrate with existing platform shell and AMRO route conventions.  
5. Add automated tests for rendering, behavior, access control, and failure states.  
6. Run lint, typecheck, and module-specific tests before merge.  
7. Prepare deployment with feature flag and rollback script path.  
8. Update this document with version, status, and validation evidence.

### 7.2 Technical Specifications and Coding Standards

- Use existing platform component primitives and naming conventions
- Preserve strict tenant and franchise scoping behavior in all data operations
- Enforce typed contracts across UI, API clients, and backend responses
- Use explicit loading, empty, error, and retry states on all AMRO screens
- Keep audit-significant actions deterministic and idempotent

### 7.3 Integration Requirements with Existing Platform

- Use platform dashboard shell and route hierarchy
- Reuse platform auth context and role permissions
- Integrate with versioned AMRO API endpoints only
- Publish UI-significant lifecycle changes to AMRO event topics when required
- Respect existing backward compatibility policies for APIs and schema changes

### 7.4 Testing Procedures and Acceptance Criteria

- Unit tests for component rendering and interaction state transitions
- Integration tests for API binding, role constraints, and data scope filters
- End-to-end tests for critical flows: create-plan-execute-close and audit replay
- Accessibility checks on keyboard navigation, focus order, and contrast
- Acceptance criteria pass only when traceability validation criteria are met

### 7.5 Deployment Procedures and Rollback Plans

- Deploy behind feature flag for nontrivial UI behavior
- Verify migration and API compatibility in staging before production rollout
- Promote in controlled waves by tenant cohort where required
- Rollback path: disable feature flag, revert UI bundle, preserve additive DB state
- Post-deploy: validate KPIs, error budgets, and audit integrity checks

---

## 8. Future Development Guidelines

### 8.1 Extensibility and Modular Design

- Implement AMRO features as modular route-level packages with explicit boundaries
- Keep domain UI components independent of logistics/CRM specifics
- Prefer composition over inheritance for reusable AMRO widgets
- Expose extension points through typed configuration and event contracts

### 8.2 Technology Roadmap and Upgrade Paths

| Horizon | Upgrade Focus | Outcome |
|---|---|---|
| Near-term | Scheduler UX, mobile offline hardening, compliance replay | Phase 2 completion |
| Mid-term | Performance optimization and accessibility certification | Phase 3 completion |
| Long-term | ERP control plane, predictive insights, cross-domain analytics | Phase 4 and beyond |

### 8.3 Design System Maintenance Procedures

- Maintain AMRO component catalog with semantic versioning
- Track visual and interaction changes through changelog entries
- Run regression visual tests for shared components before release
- Review reusable patterns quarterly with design and engineering

### 8.4 Version Control and Documentation Update Protocol

- Every AMRO implementation change must include:
  - Updated traceability row(s)
  - Updated status row(s) with version and date
  - Validation evidence reference
- Documentation updates are required in the same pull request as feature changes
- Breaking behavior proposals require architecture review before implementation

---

## 9. Governance, Review, and Approval Workflow

### 9.1 Mandatory Approval Gate

No AMRO phase implementation begins until this document version is reviewed and approved by all required stakeholders.

### 9.2 Stakeholder Review Matrix

| Stakeholder | Responsibility | Review Status | Approval Status | Date |
|---|---|---|---|---|
| Engineering Lead | Architecture and technical feasibility | Pending | Pending | — |
| Product Owner | Scope and UX priorities | Pending | Pending | — |
| Compliance Officer | Regulatory and audit requirements | Pending | Pending | — |
| Operations Lead | Release, observability, and rollback readiness | Pending | Pending | — |

### 9.3 Review Checklist

- Architecture consistency with platform constraints
- UI/UX consistency with design system and accessibility goals
- Requirement coverage and traceability completeness
- Validation criteria testability
- Deployment and rollback readiness

---

## 10. Document Control

| Version | Date | Author | Change Summary | Status |
|---|---|---|---|---|
| 1.0.0 | 2026-03-19 | AI-Assisted Design Session | Initial AMRO plugin design baseline | Superseded |
| 2.0.0 | 2026-03-19 | AMRO Architecture Working Group | Master design reference with full UI/UX, traceability, phased plan, status tracking, and governance | Draft for Review |

**Sign-Off**
- [ ] Engineering Lead
- [ ] Product Owner
- [ ] Compliance Officer
- [ ] Operations Lead
