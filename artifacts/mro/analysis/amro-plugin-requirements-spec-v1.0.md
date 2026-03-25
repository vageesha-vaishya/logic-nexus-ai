# AMRO Plugin Module Requirements Specification

## Document Control

| Field | Value |
| --- | --- |
| Document ID | RSD-AMRO-001 |
| Title | AMRO (Asset Maintenance, Repair, and Overhaul) Plugin Module Requirements Specification |
| Version | 1.0.0 |
| Status | Draft for Stakeholder Review |
| Baseline Date | 2026-03-19 |
| Parent Architecture Reference | `artifacts/mro/analysis/mro-project-analysis.md` |
| Backward Compatibility Policy | Zero-disruption deployment, additive interfaces, two-version API compatibility minimum |
| Configuration Governance | Feature-flagged rollout with blue-green switching and rollback window ≤ 5 minutes |

## Traceability Framework

### Identifier and Versioning Scheme

- Business Case: `BC-AMRO-XXX@vN`
- Use Case: `UC-AMRO-XXX@vN`
- Functional Requirement: `FR-AMRO-XXX@vN`
- Non-Functional Requirement: `NFR-AMRO-XXX@vN`
- Test Case: `TC-AMRO-XXX@vN`
- Acceptance Criteria: `AC-AMRO-XXX@vN`

Change management rule:

- Any update increments node version and requires bi-directional impact analysis across linked nodes.
- Any node marked `Deprecated` must provide successor node IDs and migration notes.
- No requirement is approved unless it traces to at least one test case and one acceptance criterion.

## 1. Executive Summary

The AMRO plugin extends Logic Nexus-AI into an enterprise-grade maintenance domain with aviation-first process depth and cross-vertical extensibility for rail, energy, and heavy assets. The plugin is designed as a modular, backward-compatible extension aligned to the platform’s multi-tenant architecture and operational workflows.

Strategic business objectives:

- Reduce unplanned downtime through predictive and condition-based maintenance.
- Improve maintenance planning and execution quality across line, base, and component workflows.
- Increase supply-chain efficiency for parts, tooling, and repair loops.
- Achieve regulatory-grade digital compliance evidence and audit readiness.
- Enable enterprise-scale operations with secure integration into existing ERP/EAM ecosystems.

Target ROI and KPI outcomes:

- MTTR reduction: ≥ 30%
- Inventory turns: ≥ 12
- Compliance score: ≥ 99.5%
- Planning accuracy improvement: ≥ 25%
- Repeat defect rate reduction: ≥ 20%

## 2. Current-State Architecture Analysis

### 2.1 Gap Analysis Against Existing Platform Baseline

Based on `mro-project-analysis.md`, current Logic Nexus-AI strengths include multi-tenant architecture, logistics workflow capabilities, modular extensibility, and CRM integration. Primary AMRO gaps:

- Aviation regulatory depth (FAA/EASA evidence and controlled approvals)
- Asset engineering lifecycle depth (programs, task cards, AD/SB orchestration)
- Airworthiness traceability across serialized components and release-to-service workflows
- High-throughput maintenance analytics and reliability modeling

### 2.2 Interface Inventory and Contracts

| Interface ID | Type | Direction | Current Contract | Target Contract | Compatibility |
| --- | --- | --- | --- | --- | --- |
| IF-AMRO-001 | REST | Inbound | v1 logistics APIs | SemVer v1.1 additive | Backward compatible |
| IF-AMRO-002 | GraphQL | Inbound | N/A | `amro` schema v1.0 | Additive |
| IF-AMRO-003 | Event (Kafka) | Bi-directional | Generic ops events | `amro.workorder.*` v1 | Idempotent consumers |
| IF-AMRO-004 | MQTT | Outbound | N/A | Telemetry topics `amro/twin/*` | Additive |
| IF-AMRO-005 | Queue | Inbound | Existing job queue | AMRO schedulers v1 | Backward compatible |
| IF-AMRO-006 | File Feed | Inbound | CSV import v1 | Signed bulk import v1.1 | Backward compatible |
| IF-AMRO-007 | Webhook | Outbound | Basic webhook v1 | AMRO event catalog v1.0 | Two-version support |

### 2.3 Migration and Coexistence Strategy

- Deployment model: Blue-green with feature flags per tenant and per module capability.
- Rollback window: ≤ 5 minutes with data-safe checkpointing and queue drain.
- Coexistence: Dual-read/dual-write adapters during migration period where required.
- Release waves: Pilot tenants first, then regional cohorts, then global enablement.
- Backward compatibility: API contracts remain additive; no destructive schema changes.

## 3. AMRO Domain Segregation Model

### 3.1 Data Taxonomy by Vertical

| Vertical | Core Assets | Maintenance Context | Compliance Focus |
| --- | --- | --- | --- |
| Aviation | Aircraft, engines, APUs, rotable components | Line/base/component checks, MEL/CDL, reliability programs | FAA, EASA, SACAA |
| Rail | Locomotives, wagons, bogies, traction systems | Interval maintenance, depot overhauls, route conditioning | ISO 55000, local rail authority |
| Energy | Turbines, generators, substations, pipelines | Condition-based inspections, outage maintenance | ISO 55000, energy safety codes |
| Heavy Asset | Cranes, mining fleets, construction plant | Utilization-driven preventive and corrective maintenance | ISO 55000, regional industrial regulations |

### 3.2 Multi-Tenant Isolation Schema

- Isolation strategy: Schema-per-tenant for high-separation deployments plus row-level security for shared service operations.
- Access model: `tenant_id` and `franchise_id` enforced in all AMRO entities.
- Data access enforcement: All module data operations through scoped access layer only.
- Tenant-level keys: Per-tenant key wrapping for encrypted data segments.

### 3.3 Regulatory Partition and Evidence Chains

- Regulatory partitions by authority profile: FAA, EASA, SACAA, ISO 55000.
- Rule packs activated by tenant compliance profile and operating certificate.
- Cryptographic evidence chain:
  - Signed event hash per maintenance action
  - Hash-linking of inspection and sign-off steps
  - Immutable evidence ledger with timestamp authority

## 4. Functional Requirements

### 4.1 Work Order Lifecycle

- FR-AMRO-001@v1: Create work orders from defects, schedules, campaigns, and telemetry triggers.
- FR-AMRO-002@v1: Plan and estimate labor, skills, tools, spares, and downtime windows.
- FR-AMRO-003@v1: Schedule with constraints (hangar/line availability, shift, certifying staff).
- FR-AMRO-004@v1: Execute with digital task cards, checklists, e-signatures, and evidence capture.
- FR-AMRO-005@v1: Close with quality gates, RTS eligibility checks, and cost finalization.
- FR-AMRO-006@v1: Analyze lifecycle outcomes and feed reliability analytics.

### 4.2 Predictive Maintenance AI Integration

- FR-AMRO-007@v1: Integrate AI failure-mode library with coverage for ≥ 25,000 assets.
- FR-AMRO-008@v1: Generate risk-ranked maintenance recommendations with confidence scores.
- FR-AMRO-009@v1: Support explainability logs for AI-assisted decisions in regulated workflows.

### 4.3 Digital Twin and Mobility

- FR-AMRO-010@v1: Synchronize digital twin status with end-to-end latency ≤ 500 ms.
- FR-AMRO-011@v1: Support mobile offline mode with 30-day encrypted cache.
- FR-AMRO-012@v1: Support delta sync conflict resolution and deterministic merge behavior.

### 4.4 Globalization

- FR-AMRO-013@v1: Provide multi-currency support for ≥ 160 currencies.
- FR-AMRO-014@v1: Provide localization for ≥ 30 locales including RTL support where required.
- FR-AMRO-015@v1: Provide multi-UOM conversions and domain-specific unit standards.

### 4.5 Aviation-First Process Requirements

- FR-AMRO-016@v1: Support AD/SB tracking and compliance closure workflow.
- FR-AMRO-017@v1: Support MEL/CDL-driven dispatch constraints and maintenance deferrals.
- FR-AMRO-018@v1: Support certifying staff role checks and controlled sign-off authorities.
- FR-AMRO-019@v1: Support serialized component traceability and removal/installation history.
- FR-AMRO-020@v1: Support line/base maintenance package planning and execution separation.

## 5. Non-Functional Requirements

- NFR-AMRO-001@v1 Performance: 10,000 concurrent users, p99 response ≤ 1s, throughput ≥ 5,000 TPS.
- NFR-AMRO-002@v1 Scalability: Horizontal autoscaling from 10 to 500 nodes in ≤ 3 minutes.
- NFR-AMRO-003@v1 Availability: 99.99% SLA, RPO ≤ 1 minute, RTO ≤ 5 minutes.
- NFR-AMRO-004@v1 Security: OWASP Top-10 controls, SOC-2 Type II controls, AES-256 end-to-end encryption.
- NFR-AMRO-005@v1 Authorization: RBAC with attribute-based policy engine for contextual constraints.
- NFR-AMRO-006@v1 Observability: OpenTelemetry traces, 60-day log retention, real-time anomaly detection.
- NFR-AMRO-007@v1 Compliance: Aviation-first validation paths must be available and auditable by authority profile.

## 6. Integration Points

- API strategy: REST and GraphQL contracts versioned by SemVer with two supported backward versions minimum.
- Event choreography: Kafka and MQTT with idempotency keys, deduplication windows, and poison-queue handling.
- Legacy adapters:
  - ADP-AMRO-001 for SAP PM
  - ADP-AMRO-002 for IBM Maximo
  - ADP-AMRO-003 for Oracle EAM
- Webhook catalog: Outbound event bundles for BI tools, digital twin platforms, and compliance dashboards.

## 7. World-Class Differentiators

- FR-AMRO-021@v1 AR/VR-assisted maintenance instructions with spatial anchoring.
- FR-AMRO-022@v1 Blockchain-backed parts provenance and counterfeit detection.
- FR-AMRO-023@v1 Carbon footprint optimizer aligned to ISO 14064.
- FR-AMRO-024@v1 Voice-enabled conversational AI for hands-free maintenance execution.
- FR-AMRO-025@v1 Swarm robotics orchestration for autonomous inspection workflows.

## 8. End-to-End Traceability Matrix

| Business Case | Use Case | Functional Requirement | Non-Functional Requirement | Test Case | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| BC-AMRO-001@v1 Reduce MTTR by 30% | UC-AMRO-001@v1 Accelerated WO lifecycle | FR-AMRO-001/002/003/004/005@v1 | NFR-AMRO-001/006@v1 | TC-AMRO-001@v1 Lifecycle performance under load | AC-AMRO-001@v1 MTTR KPI report shows ≥30% reduction over baseline |
| BC-AMRO-002@v1 Improve inventory turns to 12+ | UC-AMRO-002@v1 Parts planning optimization | FR-AMRO-002/013/015@v1 | NFR-AMRO-001/003@v1 | TC-AMRO-002@v1 Spares reservation and cycle analytics | AC-AMRO-002@v1 Inventory turns trend meets or exceeds 12 |
| BC-AMRO-003@v1 Compliance ≥99.5% | UC-AMRO-003@v1 Regulatory evidence and signatures | FR-AMRO-004/016/018/019@v1 | NFR-AMRO-004/007@v1 | TC-AMRO-003@v1 Authority audit replay and evidence verification | AC-AMRO-003@v1 Compliance dashboard shows ≥99.5% conformance |
| BC-AMRO-004@v1 Predictive reliability | UC-AMRO-004@v1 AI-driven risk predictions | FR-AMRO-007/008/009@v1 | NFR-AMRO-001/006@v1 | TC-AMRO-004@v1 Failure-mode model inference accuracy test | AC-AMRO-004@v1 AI recommendations improve lead-time and reduce repeat defects |
| BC-AMRO-005@v1 Real-time digital twin ops | UC-AMRO-005@v1 Twin sync for maintenance state | FR-AMRO-010@v1 | NFR-AMRO-001/002@v1 | TC-AMRO-005@v1 Twin update latency benchmark | AC-AMRO-005@v1 End-to-end sync latency ≤500ms p99 |
| BC-AMRO-006@v1 Field productivity | UC-AMRO-006@v1 Mobile offline execution | FR-AMRO-011/012@v1 | NFR-AMRO-003/004@v1 | TC-AMRO-006@v1 Offline cache and delta conflict scenarios | AC-AMRO-006@v1 30-day offline cache with successful conflict-free sync |
| BC-AMRO-007@v1 Global operations | UC-AMRO-007@v1 Localization and finance harmonization | FR-AMRO-013/014/015@v1 | NFR-AMRO-001/005@v1 | TC-AMRO-007@v1 Locale/currency/UOM regression suite | AC-AMRO-007@v1 30+ locales and 160 currencies validated |
| BC-AMRO-008@v1 Aviation dispatch assurance | UC-AMRO-008@v1 MEL/CDL and deferral control | FR-AMRO-017/020@v1 | NFR-AMRO-007@v1 | TC-AMRO-008@v1 Dispatch constraint and deferral rule tests | AC-AMRO-008@v1 Non-compliant dispatch attempts are blocked and logged |
| BC-AMRO-009@v1 Integration resilience | UC-AMRO-009@v1 Cross-system maintenance orchestration | FR-AMRO-006@v1 | NFR-AMRO-003/004@v1 | TC-AMRO-009@v1 API/event compatibility and idempotency tests | AC-AMRO-009@v1 No data-loss or duplicate processing under retry storm |
| BC-AMRO-010@v1 Sustainable and advanced operations | UC-AMRO-010@v1 Carbon and advanced automation | FR-AMRO-021/022/023/024/025@v1 | NFR-AMRO-006@v1 | TC-AMRO-010@v1 Differentiator capability validation pack | AC-AMRO-010@v1 Differentiator features pass functional pilot criteria |

### Living Requirements Repository Requirements

- Tooling: Jira + ReqIF export with linked IDs and versions.
- Rule: Every business case maps to at least one test case and one acceptance criterion.
- Change control: Any change request must generate a bi-directional impact analysis report.
- Governance: Release board cannot approve scope changes without updated matrix linkage.

## 9. Compliance and Audit

- Immutable audit trails retained for 10 years minimum.
- Electronic signature workflow compliant with 21 CFR Part 11.
- Continuous compliance monitoring dashboards by authority profile (FAA/EASA/SACAA/ISO 55000).
- Time-stamped traceability logs must support forensic replay across user, asset, and transaction scope.

## 10. Deliverables and Quality Gates

### 10.1 Mandatory Deliverables

- Approved requirements baseline package (RSD + traceability matrix + interface contracts).
- Capability prototype demo per business case within 4 weeks of baseline approval.
- Automated requirement-validation test suite integrated into CI/CD.
- Compliance evidence pack and audit-readiness checklist.

### 10.2 Quality Gates

- Sign-off required from Product Owner, Domain Architect, and Compliance Officer.
- Peer review coverage must be 100% with zero critical findings.
- Pre-merge quality gate requires ≥ 90% pass rate for requirement-validation tests.
- Backward compatibility gate requires successful two-version compatibility verification.

### 10.3 Stakeholder Approval Workflow

The following stakeholders must approve this document before design and development start:

- Engineering
- Operations
- Finance
- Legal
- AMRO domain experts

Approval state transitions:

- Draft → Review → Approved Baseline → Controlled Change
- Any post-baseline change must include revised node versions and impact report references.

## 11. Overview Dashboard Competitive Benchmark and Requirements Baseline

### 11.1 Benchmark Scope

- Platforms benchmarked: SAP A&D MRO, IBM Maximo Application Suite, Oracle Fusion Cloud Maintenance, Infor Birst-enabled maintenance analytics.
- Evaluation dimensions: dashboard architecture, KPI composition, navigation hierarchy, role-focused experience, predictive maintenance enablement, integration patterns, and operational reliability controls.

### 11.2 Competitive Findings Matrix

| Platform | Dashboard Strengths | Operational Gaps Observed | AMRO Adoption Decision |
| --- | --- | --- | --- |
| SAP A&D MRO | Deep spare-parts and planning visibility, regulated maintenance support, consolidated maintenance planning board patterns | Limited out-of-box predictive explainability and cross-surface KPI storytelling | Adopt planning board style for work package and fleet readiness summaries |
| IBM Maximo Application Suite | AI-infused monitoring, condition-driven maintenance, risk-centric health insight and anomaly workflows | UX density can impact rapid decision cycles for frontline users | Adopt risk-ranked health cards, anomaly first-class widgets, and health trend drilldowns |
| Oracle Fusion Cloud Maintenance | Smart Operations with maintenance plus supply chain plus finance context, real-time asset and backlog visibility | Requires careful role simplification to prevent operator cognitive overload | Adopt integrated backlog, cost, and service logistics visibility with role-scoped views |
| Infor Analytics (Birst) | Role-specific KPI dashboards, embedded analytics widgets, strong workspace-level BI composition | Maintenance-specific user journeys often require domain tailoring | Adopt modular KPI workspace patterns and role-aware analytics composition |

### 11.3 Best-Practice Synthesis for AMRO Overview

- Dashboard architecture must separate critical operational insight from analytical deep-dives while preserving one-click drill-down.
- KPI framework must support executive, planner, and frontline technician personas with shared metric definitions and persona-specific emphasis.
- Predictive maintenance insight must combine confidence, risk score, recommendation reason, and affected work-package context in one surface.
- Navigation must preserve platform shell consistency while allowing AMRO route-level specialization.
- Refresh model must use dual cadence (critical and standard) with visible freshness, degraded mode messaging, and retry behavior.
- Integration state must be continuously visible with failed attempt, failure-rate, and recent-failure context.

### 11.4 Next-Generation AMRO Overview Functional Requirements

- FR-AMRO-026@v1: Provide role-aware AMRO overview layout with executive, operations, and reliability sections in one unified route.
- FR-AMRO-027@v1: Provide live KPI strip with criticality tiering, trend context, and domain-scoped filtering support.
- FR-AMRO-028@v1: Provide predictive recommendation panel with confidence segmentation and risk-ranked action queue.
- FR-AMRO-029@v1: Provide integration and compliance command panel with real-time health state and gate queue visibility.
- FR-AMRO-030@v1: Provide graceful fallback and degraded-state UX when KPI APIs are unavailable, with explicit freshness warnings.
- FR-AMRO-031@v1: Provide role-based export controls and auditable user actions for refresh and snapshot operations.
- FR-AMRO-032@v1: Provide i18n-ready text contracts for all end-user labels in overview route surfaces.

### 11.5 Next-Generation AMRO Overview Non-Functional Requirements

- NFR-AMRO-008@v1 Performance: critical overview widgets render first meaningful payload in ≤ 1 second for cached responses.
- NFR-AMRO-009@v1 Availability: overview route operates in degraded fallback mode during upstream API disruption without blank-screen failure.
- NFR-AMRO-010@v1 Security: overview data access remains tenant and franchise scoped with no cross-tenant leakage.
- NFR-AMRO-011@v1 Accessibility: overview route supports keyboard navigation, semantic landmarks, and screen-reader compatible status signaling.
- NFR-AMRO-012@v1 Observability: overview interactions emit structured audit logs for refresh, export, and degraded-mode transitions.

### 11.6 Deployment and Maintenance Procedures

- DEP-AMRO-001@v1 Release Gate: deploy AMRO overview enhancements behind a feature flag and enable by tenant cohort.
- DEP-AMRO-002@v1 Verification: run unit, integration, and e2e dashboard suites before production promotion.
- DEP-AMRO-003@v1 Rollback: disable AMRO overview flag and redeploy previous UI artifact without schema rollback.
- DEP-AMRO-004@v1 Runtime Ops: monitor API error rates, refresh latency, and export job completion in observability dashboards.
- DEP-AMRO-005@v1 Maintenance: rotate API credentials per security policy and validate AMRO domain assignment checks quarterly.

## 12. Aircraft Form Enhancement Requirements Baseline

### 12.1 Objective and Scope

- Establish aircraft-screen-driven work package creation and status orchestration without breaking existing AMRO master data flows.
- Keep platform shell and AMRO navigation consistent while reducing click-path depth for planners and operations users.
- Align UX and status governance to SAP MRO, IBM Maximo for Aviation, and Ramco Aviation Suite practices.
- Preserve tenant and franchise data isolation for every read/write path in aircraft and work package surfaces.

### 12.2 Current-State Inventory and Gaps

Current implementation observations:

- Aircraft route `/dashboard/amro/settings/master-data/aircraft` renders a generic entity CRUD shell.
- Aircraft form currently captures registration, tail number, serial number, type/model, manufacturer, configuration code, maintenance program, and status.
- Work package creation currently exists in AMRO workspace hooks and API interfaces, but not as a first-class aircraft-screen action path.
- Work package list and task board are available in AMRO workspace and preview surfaces, yet aircraft-specific launch context is not unified in one interaction flow.

Key gaps:

- No direct “Create Work Package” CTA in aircraft record experience.
- No aircraft-context scheduling intelligence panel at point of creation.
- No integrated predictive risk strip on aircraft form.
- No aircraft-linked one-click navigation rail to work package pipeline, scheduling board, compliance gates, and task execution.
- No explicit aircraft-level KPI and live status dashboard on the master-data aircraft surface.

### 12.3 Benchmark Mapping

| Platform | Reference Pattern | Aircraft Form Enhancement Adoption |
| --- | --- | --- |
| SAP MRO | Planning-centric maintenance package creation with strong materials/schedule context | Adopt guided package creation with planning defaults and station window suggestions from aircraft context |
| IBM Maximo for Aviation | Risk-first monitoring and anomaly visibility with AI-assisted prioritization | Adopt aircraft health strip with risk score, confidence, anomaly reasons, and recommended actions |
| Ramco Aviation Suite | Aviation-native execution and integrated maintenance lifecycle orchestration | Adopt tightly coupled aircraft-to-work-package workflow with minimal navigation hops and lifecycle state visibility |

### 12.4 Target UX Wireframes

#### Wireframe A: Aircraft Detail + Operational Header

```text
+---------------------------------------------------------------------------------------------------+
| AMRO / Settings / Master Data / Aircraft / [Tail Number]                         [Refresh][New] |
+---------------------------------------------------------------------------------------------------+
| Aircraft Identity Sheet                                    | Aircraft Status & Risk             |
| Tail Number | Registration | Type | Model | Manufacturer   | Health: Amber  Risk: 0.72 High     |
| Program     | Station      | Operator | Config             | Predictive: Hydraulic leak trend    |
|                                                     [Create Work Package] [View Active Packages] |
+---------------------------------------------------------------------------------------------------+
| Navigation Rail: [Overview] [Work Packages] [Scheduling] [Compliance] [Task Execution] [Audit]  |
+---------------------------------------------------------------------------------------------------+
```

#### Wireframe B: Create Work Package From Aircraft

```text
+---------------------------------------------------------------------------------------------------+
| Create Work Package (Aircraft: N200AA)                                                            |
+---------------------------------------------------------------------------------------------------+
| Source Trigger: [Schedule Due] [Defect] [Campaign] [Predictive Alert]                            |
| Maintenance Type: [Line/Base/Hangar/Shop]   Priority: [Low/Medium/High/Critical]                |
| Planned Window: [Start DateTime] [End DateTime]  Station: [Select]                               |
| Scope Builder:                                                                                     |
|  - suggested scope items from maintenance program + due tasks + active anomalies                  |
|  - editable checklist with labor estimate and required skill tags                                 |
|                                                                                                    |
| Compliance Snapshot: AD/SB | MEL/CDL | Certifying Staff Availability                              |
|                                                                                                    |
| [Save Draft] [Create & Schedule] [Create & Open Work Package]                                     |
+---------------------------------------------------------------------------------------------------+
```

#### Wireframe C: Aircraft-Centric Live Status Dashboard

```text
+---------------------------------------------------------------------------------------------------+
| Aircraft Operations Snapshot                                                                        |
+---------------------------------------------------------------------------------------------------+
| KPI Cards: Open WP | In Progress | Deferred | Completed | RTS Blockers | SLA Risk                 |
| Timeline: Last 24h events + next 7-day maintenance windows                                         |
| Alerts: Predictive recommendations with confidence + rationale + related package links             |
| Quick Actions: [Replan] [Escalate] [Export] [Open Compliance Queue]                               |
+---------------------------------------------------------------------------------------------------+
```

### 12.5 User Journey Map

| Persona | Current Journey | Target Journey | Outcome |
| --- | --- | --- | --- |
| Planner | Navigate aircraft master data → copy aircraft id → open work package module → create package | Open aircraft record → click Create Work Package → prefilled aircraft context → create/schedule | Reduced context switching and faster package launch |
| Engineer | Open work package list separately to check aircraft context | Open aircraft page and view active packages + risk + compliance summary inline | Better situational awareness and fewer lookup steps |
| Inspector | Open compliance pages independently after package creation | Use aircraft-linked compliance gate panel before package submission | Earlier compliance detection and reduced rework |
| Operations Manager | Aggregate from multiple routes for status | Use aircraft-centric dashboard with KPI and trend cards | Faster decision cadence and better exception handling |

### 12.6 Functional Requirements

- FR-AMRO-033@v1: Provide an aircraft-screen primary action to create work packages with aircraft context pre-bound.
- FR-AMRO-034@v1: Support work package creation triggers from schedule due, defect, campaign, and predictive recommendations.
- FR-AMRO-035@v1: Prefill maintenance type, station, planned window, and priority using aircraft and planner defaults, with editable override.
- FR-AMRO-036@v1: Provide aircraft-level status dashboard with KPI cards, timeline, alert queue, and one-click drill-down actions.
- FR-AMRO-037@v1: Provide direct route transitions from aircraft screen to work packages, scheduling, compliance, task execution, and audit.
- FR-AMRO-038@v1: Surface predictive indicators with risk score, confidence score, rationale, and recommended scope items.
- FR-AMRO-039@v1: Enforce role-based action controls for create/schedule/export/escalate actions with auditable events.
- FR-AMRO-040@v1: Maintain backward-compatible CRUD behavior for aircraft master data and existing API contracts.

### 12.7 Non-Functional Requirements

- NFR-AMRO-013@v1 Performance: aircraft-screen work package draft creation interaction completes in ≤ 2 user clicks after opening record.
- NFR-AMRO-014@v1 Performance: aircraft status dashboard first meaningful payload renders in ≤ 1 second for cached responses.
- NFR-AMRO-015@v1 Security: all aircraft and work package operations remain tenant and franchise scoped with no cross-scope data leakage.
- NFR-AMRO-016@v1 Reliability: creation workflow supports graceful fallback when upstream predictive feeds are degraded.
- NFR-AMRO-017@v1 Accessibility: workflow is keyboard-complete and meets WCAG 2.1 AA for forms, status cards, and action controls.
- NFR-AMRO-018@v1 Observability: emit structured audit events for create, schedule, status transitions, exports, and escalations.

### 12.8 Technical Specification Baseline

Frontend surfaces:

- Extend aircraft route surface in AMRO master data with contextual work package launcher and status strip.
- Reuse existing AMRO shell and mdm-template classes to preserve platform visual consistency.
- Add aircraft-context navigation rail to AMRO operational modules with current permission checks.

API and integration contracts:

- Reuse existing `/api/v2/amro/work-packages` create-work-package interface for initial launch path.
- Preserve existing `/api/v2/amro/master-data/aircraft` contracts; enhancement remains additive.
- Include creation trigger metadata (`source`, `reference_id`, `triggered_at`) for traceability and analytics.

Data and security controls:

- Continue tenant/franchise scoping through existing AMRO access context and domain access enforcement.
- Keep auditable event creation for aircraft and work package lifecycle transitions in maintenance events/audit ledgers.
- Keep feature-flag strategy for staged rollout and fast rollback without schema-breaking migration.

### 12.9 Phased Implementation Plan

| Phase | Scope | Exit Criteria |
| --- | --- | --- |
| Phase 1: Discovery and UX Baseline | Implement aircraft screen CTA, wireframe-aligned layout shell, and route-level navigation rail | CTA visible to authorized users, no regression in aircraft CRUD, baseline UX tests pass |
| Phase 2: Creation Workflow Integration | Connect CTA to work package creation drawer/modal with aircraft prefill and trigger metadata | Create/schedule flow succeeds with tenant-franchise scoping and auditable events |
| Phase 3: Status Dashboard and Predictive Layer | Add KPI strip, timeline, predictive indicator panel, and quick actions | Dashboard renders with fallback behavior and role-aware controls |
| Phase 4: Optimization and Rollout | Add measured UX optimization, telemetry, and staged tenant rollout via feature flags | KPI goals met in pilot cohort and compatibility gates pass |

### 12.10 Success Criteria and KPI Framework

| KPI | Baseline | Target |
| --- | --- | --- |
| User adoption rate of aircraft-driven work package creation | New flow not available | ≥ 70% of planner-created packages originate from aircraft screen in pilot tenants |
| Task completion time for package creation | Current multi-screen path baseline | ≥ 35% reduction in median completion time |
| Workflow error rate (validation/rework at creation stage) | Current baseline from audit logs | ≥ 25% reduction in creation-stage errors |
| Navigation efficiency | Current click depth baseline | ≤ 3 clicks from aircraft screen to scheduled work package |
| Operational visibility | Fragmented status lookup | 100% pilot users see aircraft KPI/status dashboard on route load |

### 12.11 Traceability Addendum

- New functional requirements FR-AMRO-033 through FR-AMRO-040 trace to existing lifecycle baseline FR-AMRO-001 through FR-AMRO-006 and overview requirements FR-AMRO-026 through FR-AMRO-032.
- New non-functional requirements NFR-AMRO-013 through NFR-AMRO-018 extend NFR-AMRO-008 through NFR-AMRO-012 for aircraft-screen operational flow.
- Delivery remains additive and backward compatible with existing API and data model contracts.
