# SOS-Nexus Master Implementation Plan

## 1. Executive Summary & Strategic Alignment

### 1.1 Strategic Vision

This document serves as the definitive blueprint for transforming **SOS Logistics Pro** (a vertical logistics monolith) into **SOS-Nexus** (a multi-tenant, domain-agnostic Enterprise PaaS). As outlined in the [Strategic Document](01_Strategic_Document.md), the goal is to decouple core business logic from domain-specific implementation, enabling rapid expansion into new verticals (Banking, Telecom) while maintaining the stability of the existing logistics business.

### 1.2 Alignment with Business Objectives

* **Market Expansion:** The re-architecture enables the platform to host non-logistics tenants by Q3, unlocking revenue streams in FinTech and Telecom.
* **Operational Efficiency:** Transitioning to a "Micro-kernel" architecture reduces code redundancy by a target of 75% \[01\_Strategic\_Document.md].
* **Financial Compliance:** The integration of a centralized **Taxation & Financials Module** ensures global compliance (VAT, GST, Sales Tax) and automated GL reconciliation.

***

## 2. Detailed Requirements Matrix

This matrix traces requirements from source documents to implementation tasks.

| ID               | Category      | Requirement Description                                                            | Source Document                                           | Implementation Phase |
| :--------------- | :------------ | :--------------------------------------------------------------------------------- | :-------------------------------------------------------- | :------------------- |
| **REQ-CORE-001** | Architecture  | Decouple Core Kernel from Domain Plugins (Logistics, Banking).                     | [01\_Strategic\_Document.md](01_Strategic_Document.md)    | Phase 2              |
| **REQ-CORE-002** | Multi-Tenancy | Implement strict data isolation via RLS and Tenant ID injection.                   | [03\_High\_Level\_Design.md](03_High_Level_Design.md)     | Phase 1              |
| **REQ-DB-001**   | Schema        | Split `quote_items` into `core` (shared) and `extension` (domain-specific) tables. | [08\_Impact\_Analysis.md](08_Impact_Analysis.md)          | Phase 0              |
| **REQ-DB-002**   | Schema        | Create `quote_items_view` to maintain backward compatibility for legacy queries.   | [08\_Impact\_Analysis.md](08_Impact_Analysis.md)          | Phase 0              |
| **REQ-TAX-001**  | Taxation      | Automated Nexus determination based on Origin/Destination.                         | [04\_Taxation\_User\_Guide.md](04_Taxation_User_Guide.md) | Phase 2.5            |
| **REQ-TAX-002**  | Taxation      | Support for Tax Exemption Certificates (Upload & Validation).                      | [04\_Taxation\_User\_Guide.md](04_Taxation_User_Guide.md) | Phase 2.5            |
| **REQ-TAX-003**  | Taxation      | Real-time tax calculation API (< 200ms latency).                                   | [02\_Gap\_Analysis.md](02_Gap_Analysis.md)                | Phase 2.5            |
| **REQ-FIN-001**  | Billing       | Pluggable billing engine supporting domain-specific invoice formats.               | [02\_Gap\_Analysis.md](02_Gap_Analysis.md)                | Phase 2.5            |
| **REQ-FIN-002**  | GL Sync       | Async posting of Journal Entries to General Ledger.                                | [04\_Low\_Level\_Design.md](04_Low_Level_Design.md)       | Phase 2.5            |
| **REQ-UI-001**   | Frontend      | Dynamic Form Renderer based on Tenant Configuration.                               | [08\_Impact\_Analysis.md](08_Impact_Analysis.md)          | Phase 3              |
| **REQ-SEC-001**  | Security      | Domain-Scoped RLS (prevent Banking tenant from seeing Logistics data).             | [08\_Impact\_Analysis.md](08_Impact_Analysis.md)          | Phase 1              |

***

## 3. Architectural & Design Implementation

### 3.1 Micro-kernel Architecture

Based on [03\_High\_Level\_Design.md](03_High_Level_Design.md), the system will use a **Strategy Pattern** for domain logic.

* **Core Kernel:** Manages Authentication, Tenant Resolution, and Request Routing.
* **Domain Plugins:** Implemented as distinct modules (initially shared libraries, evolving to microservices).
  * `LogisticsPlugin`: Implements `IQuotationEngine` for freight logic.
  * `BankingPlugin`: Implements `IQuotationEngine` for loan logic.

### 3.2 Database Schema Design

Based on [04\_Low\_Level\_Design.md](04_Low_Level_Design.md) and [08\_Impact\_Analysis.md](08_Impact_Analysis.md):

* **Table Inheritance Pattern:**
  * **Core Table:** `public.quote_items` (ID, Amount, Description).
  * **Extension Table:** `logistics.quote_items_extension` (Weight, Volume, CargoType).
* **Views:** `public.quote_items_view` joins Core + Extension to mimic the legacy schema structure for the existing API.

### 3.3 API Contracts

* **Tax Calculation:** `POST /api/v1/tax/calculate` (Stateless, RFC-compliant).
* **Invoice Finalization:** `POST /api/v1/invoices/{id}/finalize` (Transactional, Idempotent).

***

## 4. Phased Implementation Roadmap

### Phase 0: Stabilization & Preparation (Weeks 1-2)

*Goal: Prepare for split without breaking "SOS Logistics Pro".*

* **Task 0.1:** Create `quote_items_view` and `quote_legs_view` matching legacy schema \[08\_Impact\_Analysis.md].
* **Task 0.2:** Refactor `src/lib/supabase-client.ts` to query Views instead of Tables.
* **Task 0.3:** Implement `make_schema_idempotent.cjs` for all 9 migration scripts.
* **Task 0.4:** Verify full regression suite pass for Logistics flows.

### Phase 1: Foundation (Weeks 3-6)

*Goal: Multi-tenant Infrastructure.*

* **Task 1.1:** \[DEFERRED] Initialize Monorepo (Nx/Turborepo). *Decision: Maintain Single Repo for Phase 2 velocity.*
* **Task 1.2:** \[COMPLETED (Enhanced)] Implement `tenants` and `platform_domains` tables. *Replaced rigid ENUM with dynamic `platform_domains` table.*
* **Task 1.3:** \[COMPLETED] Implement RLS policies using `auth.uid()` and `tenant_id`.
* **Task 1.4:** \[COMPLETED] Set up CI/CD with automated linting and unit tests.

### Phase 2: Core Module Development (Weeks 5-10)

*Goal: Domain-Agnostic Engines.*

* **Task 2.1:** \[COMPLETED] Define `IQuotationEngine` interface \[04\_Low\_Level\_Design.md].
* **Task 2.2:** \[COMPLETED] Implement `CoreQuoteService` that delegates to plugins.
* **Task 2.3:** \[COMPLETED] Create "Mock" adapters for Banking and Telecom.

### Phase 2.5: Taxation & Financials (Weeks 8-14)

*Goal: Financial Backbone \[09\_Phase2.5\_Technical\_Spec.md].*
*Status: IN PROGRESS*

* **Task 2.5.1:** \[COMPLETED] Implement `TaxJurisdiction`, `TaxRule`, and `TaxCode` tables.
* **Task 2.5.2:** \[IN PROGRESS] Build Nexus Determination Logic (Origin vs. Destination).
* **Task 2.5.3:** \[IN PROGRESS] Implement `TaxEngine.calculateTax()` with sub-200ms latency.
* **Task 2.5.4:** \[IN PROGRESS] Build Invoice Finalization Workflow (Draft -> Posted).
* **Task 2.5.5:** \[PENDING] Implement Async GL Poster (RabbitMQ/PgQueues).
* **Task 2.5.6:** \[PENDING] Create "Mock" ERP Connector for GL Sync.

### Phase 3: Plugin SDK & Logistics Migration (Weeks 11-16)

*Goal: Migrate Logistics to Plugin Architecture.*

* **Task 3.1:** Extract Logistics logic from `crm` components into `LogisticsPlugin`.
* **Task 3.2:** Implement Dynamic Form Renderer for `QuoteForm`.
* **Task 3.3:** Migrate data from `public.quote_items` to `logistics.quote_items_extension`.

### Phase 4: New Verticals (Weeks 17-22)

*Goal: Prove Agnostic Capability.*

* **Task 4.1:** Implement `BankingPlugin` (Loan Origination).
* **Task 4.2:** Implement `TelecomPlugin` (Subscription Billing).

***

## 5. Backward Compatibility & Enhancement Strategy

### 5.1 View-First Strategy

To ensure zero downtime and no breaking changes for the existing Logistics app:

* **Mechanism:** The application will **never** query the physical `quote_items` table directly. It will query `quote_items_view`.
* **Transition:**
  1. Rename `quote_items` -> `quote_items_legacy`.
  2. Create new `quote_items` (Core) and `quote_items_logistics` (Extension).
  3. Create `quote_items_view` that joins them.
  4. Run ETL to move data.
  5. Application continues running unaware of the split.

### 5.2 API Versioning

* **Legacy API:** `/rest/v1/...` (Supabase auto-generated) remains active for legacy clients.
* **New API:** `/api/v2/...` (Edge Functions) introduces the new domain-agnostic contracts.

***

## 6. Risk Mitigation & Impact Management

Derived from [08\_Impact\_Analysis.md](08_Impact_Analysis.md):

| Risk ID  | Risk Description                                             | Severity | Mitigation Strategy                                                                            |
| :------- | :----------------------------------------------------------- | :------- | :--------------------------------------------------------------------------------------------- |
| **R-01** | **Breaking Logistics UI** due to schema changes.             | Critical | **View-First Strategy:** Use database views to mask physical schema changes from the frontend. |
| **R-02** | **Tax Engine Latency** slowing down checkout.                | High     | **Async Calculation:** Debounce tax calls; use optimistic UI updates; cache rules in Redis.    |
| **R-03** | **Data Leakage** between tenants (Banking seeing Logistics). | Critical | **Domain-Scoped RLS:** Policies must check `tenant.domain_type` in addition to `tenant_id`.    |
| **R-04** | **Schema Drift** in dev vs. prod.                            | Medium   | **Idempotent Migrations:** Strict enforcement of `make_schema_idempotent.cjs` workflow.        |

***

## 7. Testing & Validation Strategy

### 7.1 Testing Layers

* **Unit Tests:** Jest/Vitest for `TaxEngine` logic (Mock dependencies). Coverage target: >90%.
* **Integration Tests:** Verify `LogisticsPlugin` correctly implements `IQuotationEngine`.
* **Regression Tests:** Run the **existing Logistics Pro Test Suite** against the new Phase 0 Views to ensure 100% pass rate.
* **Performance Tests:** k6 load testing for Tax Calculation API (Target: 1000 RPS < 200ms).

### 7.2 UAT

* **Logistics UAT:** Verify "Create Quote" -> "Invoice" flow remains unchanged.
* **Finance UAT:** Verify Tax Breakdown matches Avalara/Govt calculator results.

***

## 8. Deployment & Rollout Plan

### 8.1 Deployment Strategy

* **Blue/Green Deployment:**
  * **Blue:** Current Monolith (Direct Table Access).
  * **Green:** New Architecture (View Access).
* **Switchover:** DNS flip after Green passes health checks.

### 8.2 Rollout Phases

* **Week 27:** **Canary Release** (Internal Users only).
* **Week 28:** **Logistics Migration** (Existing tenants moved to new schema).
* **Week 30:** **Banking Beta** (First non-logistics tenant onboarding).

### 8.3 Rollback Plan

* **Database:** Point `quote_items_view` back to `quote_items_legacy` table if split fails.
* **Code:** Revert to previous Docker image tag.

***

## 9. Success Metrics & KPIs

### 9.1 Strategic KPIs \[01\_Strategic\_Document.md]

* **Code Reuse:** > 75% of Core Kernel code shared across domains.
* **Onboarding Speed:** < 6 weeks to launch a new vertical.
* **Revenue:** > 10% ARR from non-logistics verticals in Year 1.

### 9.2 Operational Metrics

* **System Uptime:** 99.9% SLA.
* **Tax Accuracy:** 100% reconciliation with GL.
* **Performance:** p95 latency < 200ms for Quote Calculation.

***

## 10. Enterprise Architecture Transformation Initiative (Formal Execution Baseline)

### 10.1 Current-State Audit (Measured and Verified)

#### A. Repository and Deployment Inventory

| Area | Current State | Evidence |
| :--- | :--- | :--- |
| Frontend runtime | React + Vite SPA with route-level lazy loading and centralized providers | `src/App.tsx` |
| Primary backend/data plane | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) | `supabase/config.toml`, `docker-compose.yml` |
| Edge/API units | 97 Supabase function entrypoints (`index.ts`) | `supabase/functions/**/index.ts` |
| Service units | `services/amro-api` (Express TypeScript), `services/timesfm-service` (FastAPI) | `services/*`, `docker-compose.yml` |
| Background processing | BullMQ + Redis worker for async email sequence execution | `worker/src/index.ts` |
| CI/CD units | 7 workflow pipelines including core CI, deploy, and AMRO CI | `.github/workflows/*.yml` |
| Workspace package roots | 10 `package.json` roots excluding `node_modules` | repository inventory command output |
| Dashboard surface | 146 dashboard page components in `src/pages/dashboard` | repository inventory command output |
| DB migration footprint | 616 SQL migration files in `supabase/migrations` | repository inventory command output |

#### B. Baseline Performance and Reliability

| Metric | Baseline (Current) | Source |
| :--- | :--- | :--- |
| Pricing calculation | ~500ms+ to ~200ms after optimization | `PERFORMANCE_REPORT.md` |
| Quick quote submit | ~1.5s+ sequential to ~800ms concurrent | `PERFORMANCE_REPORT.md` |
| Function latency target in live deployment playbooks | p95 500ms target, investigate above 600ms | `docs/AMRO_DEPLOYMENT_PROCEDURES.md` |
| Error rate target in deployment playbooks | 0.1% target, rollback threshold >0.2% | `docs/AMRO_DEPLOYMENT_PROCEDURES.md` |
| Throughput target in deployment playbooks | >5000 TPS target | `docs/AMRO_DEPLOYMENT_PROCEDURES.md` |

#### C. Security and Technical Debt Baseline

| Finding | Severity | Current Evidence |
| :--- | :--- | :--- |
| Dependency vulnerabilities in current lock graph | 1 critical, 9 high, 4 moderate | `npm audit --json` baseline |
| Critical package exposure includes `jspdf` | Critical | `npm audit --json` baseline |
| High-risk package exposures include router/build/archive toolchain and CLI dependencies | High | `npm audit --json` baseline |
| Broad JWT verification disablement across many edge functions | High | `supabase/config.toml` `[functions.*] verify_jwt = false` |
| Placeholder production deploy workflow | Medium | `.github/workflows/deploy.yml` |

### 10.2 Limitation and Refactor Opportunity Report

#### A. Architectural Constraints

| Constraint | Impact | Priority |
| :--- | :--- | :--- |
| Modular monolith runtime with in-process plugin registration | Limits independent scaling and blast-radius isolation | P0 |
| Shared backend data plane patterns across multiple domains | Increases coupling and migration friction | P0 |
| Partial service decomposition with mixed runtime standards | Operational complexity and governance drift | P1 |
| Security policy inconsistency across edge interfaces | Elevated unauthorized-access risk | P0 |
| Deployment automation not yet fully GitOps with progressive delivery controls | Slower release velocity and recovery confidence | P1 |

#### B. Refactor Candidate Prioritization

| Candidate | ROI | Risk | Strategic Value | Priority |
| :--- | :--- | :--- | :--- | :--- |
| Extract Authentication and Identity to dedicated core service | High | Medium | Enables zero-trust and policy centralization | P0 |
| Extract CRM as common shared service | High | Medium | Unblocks cross-domain customer model reuse | P0 |
| Externalize common platform services (logging, metering, notifications, scheduler) | High | Medium | Removes duplicated implementation burden | P0 |
| Event bus backbone and domain event normalization | High | Medium | Enables domain autonomy and saga orchestration | P1 |
| Plugin runtime with signed lifecycle hooks and policy gate | Medium | Medium | Accelerates ecosystem integrations | P1 |

### 10.3 Module Boundary Definition (DDD and Three-Tier Model)

#### A. Tier 1 – Core Infrastructure Modules

1. **Authentication and Identity Management Context**
   - Aggregates: `Identity`, `RoleBinding`, `PolicyAssignment`, `SessionCredential`
   - Domain Events: `IdentityProvisioned`, `RoleGranted`, `SessionRevoked`
   - Contracts:
     - REST: `/iam/v1/identities`, `/iam/v1/sessions`, `/iam/v1/policies/evaluate`
     - gRPC: `IdentityService`, `AuthorizationService`
2. **Security and Compliance Context**
   - Aggregates: `ComplianceProfile`, `AuditRecord`, `DataSubjectRequest`
   - Domain Events: `AuditRecorded`, `RetentionPolicyApplied`, `DSRCompleted`
3. **Data Access and Persistence Context**
   - Patterns: CQRS, CDC outbox, read/write split, event sourcing for selected bounded contexts
4. **Common Services Context**
   - Logging, metering, rate limiting, scheduler, notification, file gateway, shared CRM kernel interfaces
5. **Infrastructure and DevOps Context**
   - GitOps release orchestration, service mesh policy templates, IaC and progressive delivery controls

#### B. Tier 2 – Domain-Specific Modules

| Domain Context | Aggregate Roots | Core Domain Events |
| :--- | :--- | :--- |
| Order Management | `Order`, `OrderLine`, `FulfillmentPlan` | `OrderPlaced`, `OrderAllocated`, `OrderClosed` |
| Inventory | `InventoryItem`, `StockLedger`, `Reservation` | `StockAdjusted`, `ReservationCreated` |
| Billing and Finance | `Invoice`, `Payment`, `TaxAssessment` | `InvoiceIssued`, `PaymentSettled`, `TaxCalculated` |
| Supply Chain | `Shipment`, `Booking`, `CarrierAssignment` | `ShipmentBooked`, `MilestoneReached` |
| HR | `EmployeeProfile`, `PayrollCycle` | `EmployeeOnboarded`, `PayrollPosted` |
| Marketing | `Campaign`, `AudienceSegment` | `CampaignLaunched`, `AudienceUpdated` |
| Customer Support | `Case`, `SLAProfile` | `CaseOpened`, `CaseEscalated`, `CaseResolved` |
| Workflow and Rules | `WorkflowDefinition`, `RuleSet` | `WorkflowPublished`, `RuleEvaluated` |
| Analytics and AI/ML | `FeatureSet`, `ModelVersion` | `FeatureMaterialized`, `ModelPromoted` |

#### C. Tier 3 – Business Plugins and Integration Extensions

- SDK targets: TypeScript, Java, Go
- Lifecycle hooks: `install`, `activate`, `deactivate`, `uninstall`
- Integration contracts: Salesforce, SAP, Shopify, Workday, payment gateways, social login providers
- UI plugin boundaries: micro-frontend shell integration with CSP and iframe sandbox isolation
- Runtime controls: feature flags, A/B cohorts, near real-time feedback metrics

#### D. Contract and Versioning Governance

- OpenAPI 3.1 for REST, protobuf for gRPC, AsyncAPI for event contracts
- SemVer enforcement:
  - MAJOR for breaking response or behavior changes
  - MINOR for backward-compatible additions
  - PATCH for bug fixes and non-contract changes
- Consumer contract testing mandated with Pact or Spring Cloud Contract before promotion

### 10.4 Communication and Dependency Governance

1. Externalized configuration baseline aligned to twelve-factor principles
2. Policy-as-code controls for ingress, egress, identity, and secret use
3. Service SLO definitions with error budgets and escalation policy
4. Dependency gate:
   - Block releases on critical CVEs
   - Block releases on high CVEs lacking approved mitigation exception
5. ADR review board gate is mandatory for:
   - New bounded context creation
   - Contract-breaking API changes
   - Data topology changes
   - Security posture changes

### 10.5 Zero-Downtime Migration Roadmap with Exit Criteria

#### Phase 0 – Stabilize and Instrument
- Scope:
  - Standardize CI/CD quality gates
  - Add full observability instrumentation
  - Containerize remaining workloads
- Exit Criteria:
  - API test coverage >= 95%
  - Unit test pass >= 90%
  - Mutation score >= 70%
  - Zero critical CVE open
  - Rollback window <= 5 minutes

#### Phase 1 – Strangler Extraction for Core Services
- Scope:
  - Extract Authentication and Identity
  - Extract CRM shared service foundations
  - Extract common services (scheduler/logging/notification/rate limiting)
- Exit Criteria:
  - >=70% external traffic for extracted capabilities served by new services
  - No Sev-1 incidents over two release cycles

#### Phase 2 – Domain Decomposition and Event Choreography
- Scope:
  - Isolate domain-specific bounded contexts
  - Introduce event bus choreography and dual-write outbox buffers
  - Remove direct cross-domain DB dependency paths
- Exit Criteria:
  - >=80% domain interaction through contracts or events
  - Data consistency SLA >=99.95% for replicated read models

#### Phase 3 – Plugin Runtime and Legacy Decommission
- Scope:
  - Production plugin framework with signed package policy
  - Legacy integration migration and old-path decommission
- Exit Criteria:
  - 100% target integrations on plugin runtime
  - Legacy core decommission plan approved and executed

### 10.6 Performance and Scalability Requirements

| Requirement | Target |
| :--- | :--- |
| Read API latency | p95 <= 100ms |
| Write API latency | p95 <= 300ms |
| Throughput per module | 10k RPS sustained |
| Horizontal autoscaling | 1 to 100 replicas in <=60s |
| Performance regression gate | <=5% per release |
| Data retention and deletion | Automated GDPR right-to-be-forgotten workflows |

### 10.7 Security and Compliance Matrix

| Domain | Control Requirement |
| :--- | :--- |
| Network security | Zero-trust segmentation and mTLS service-to-service |
| Identity and access | OAuth 2.1, OIDC, SAML, MFA, RBAC + ABAC |
| Policy enforcement | OPA policy-as-code and signed policy bundles |
| Secrets | Vault-backed secrets and rotation <=30 days |
| Build integrity | SBOM generation and provenance on every build |
| AppSec | Continuous SAST and DAST in CI/CD |
| Assurance | Annual penetration testing with tracked remediation SLAs |
| Auditability | Immutable audit trail with retention controls and legal-hold support |

### 10.8 Monitoring and Quality Gates

1. Unified telemetry stack:
   - Metrics: Prometheus
   - Dashboards: Grafana
   - Logs: Loki
   - Traces: Tempo and Jaeger
2. Operational governance:
   - Alert fatigue budget with runbook-linked alert classes
   - On-call rotations and chaos game-day cadence
3. Definition of Done gate:
   - Coverage >=80%
   - Static-analysis gate: no unresolved high-severity issues
   - Dependency gate: no unresolved medium+ CVEs without exception
   - Performance regression <=5%

### 10.9 Documentation Package Deliverables

| Artifact | Owner | Gate |
| :--- | :--- | :--- |
| C4 architecture diagrams (context/container/component/code) | Enterprise Architecture | ADR approval |
| OpenAPI/protobuf/AsyncAPI contract packs | Domain Architecture | Contract review |
| SDKs (Java, Node, Python) | Platform Engineering | Compatibility test |
| PlantUML sequence diagrams for module interactions | Solution Architecture | Integration review |
| Development handbook (branching/security/coding standards) | Engineering Enablement | Architecture board |
| Full testing strategy (unit/integration/e2e/performance/security/DR) | QA + SRE | Quality council |
| Deployment runbooks (Helm, ArgoCD, canary analysis) | Platform SRE | Release governance |
| Gantt timeline, resource map, risk register, mitigations | PMO + Architecture | Steering committee |

### 10.10 CRM Core Service Specification (Tier 1 Common Service)

#### A. Sub-Modules

- Account
- Contact
- Lead
- Opportunity
- Activity
- Case
- Territory
- Quotation

#### B. Core Relationships

- One Account -> many Contacts
- One Contact -> many Leads
- One Lead -> many Opportunities
- One Opportunity -> many Activities and Quotations

#### C. Service Interfaces

- REST and gRPC contracts per entity set with versioned namespace `/crm/v1`
- GraphQL gateway for frontend composition
- Immutable domain events:
  - `LeadCreated`
  - `LeadQualified`
  - `OpportunityCreated`
  - `OpportunityWon`
  - `ActivityLogged`
  - `QuotationCreated`

#### D. Data Topology

- Dedicated PostgreSQL cluster for CRM transaction store
- Elastic read models for global search and relevance ranking
- Outbox and CDC pipeline for reliable event publication to Kafka/Pulsar

### 10.11 ADR Review Board and Sign-Off Workflow

No transformation deliverable may proceed to implementation without documented ADR sign-off by:

1. Enterprise Architecture Lead
2. Security Officer
3. Product Owner
4. Platform Engineering Representative
5. Domain Owner for impacted bounded contexts

Each ADR packet must include:
- Decision context
- Options evaluated
- Security and compliance impact
- Data migration and rollback strategy
- SLO and operational impact
- Final approval records and date

### 10.12 Week-by-Week Execution Board (Owners, Deliverables, Acceptance, Dependencies)

| Week | Workstream | Primary Owners | Deliverables | Acceptance Criteria | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Program Mobilization and Governance | Enterprise Architecture Lead, PMO, Security Officer | Program charter, RACI, ADR board calendar, risk register v1 | Steering committee approval, governance cadence fixed | Executive sponsor assignment |
| 2 | Baseline Audit Finalization | Platform Architect, SRE Lead, Data Architect | Inventory baseline pack, coupling map, vulnerability baseline, performance baseline snapshot | Baseline pack signed by Architecture + Security + Product | Week 1 governance pack |
| 3 | Architecture Decisions and Domain Map | Enterprise Architects, Domain Owners, Product Owners | ADR-001 tier model, ADR-002 bounded contexts, context map with ubiquitous language | ADR approvals complete, no open critical objections | Week 2 baseline pack |
| 4 | CI/CD and Quality Gate Hardening | Platform Engineering, QA Lead, Security Engineering | Pipeline gates for lint, typecheck, test, dependency scan, SBOM generation | Build fails on critical CVE, quality gates enforced in protected branches | Week 3 ADR approvals |
| 5 | Observability and SLO Foundation | SRE Lead, Platform Engineering, Domain Tech Leads | Prometheus/Grafana/Loki/Tempo dashboards, SLO/error-budget definitions, runbook index | Dashboards live, SLO alerts tested, runbook links validated | Week 4 pipeline hardening |
| 6 | Security Control Baseline | Security Officer, Security Engineering, Platform Team | mTLS rollout plan, OPA policy baseline, secrets-rotation workflow, CSP/WAF baseline controls | Zero-trust control checklist approved, 30-day rotation policy active | Weeks 4-5 platform controls |
| 7 | Auth Service Strangler Design | IAM Architect, Backend Lead, Security Engineering | IAM extraction design, OAuth/OIDC/SAML target contracts, migration playbook v1 | ADR approval for IAM split, compatibility test plan approved | Weeks 3 and 6 architecture/security approvals |
| 8 | CRM Shared Service Design | CRM Domain Lead, Data Architect, API Architect | CRM service boundaries, `/crm/v1` REST/gRPC contract drafts, domain-event schema drafts | Contract review sign-off, data ownership boundaries approved | Week 7 IAM boundary design |
| 9 | Common Services Extraction Design | Platform Services Lead, SRE Lead, Integration Architect | Logging/metering/notification/rate-limit service contracts, platform SDK baseline | Contract tests scaffolded, ownership matrix approved | Weeks 5 and 8 service contracts |
| 10 | Phase 1 Build Sprint A | IAM Team, CRM Team, Platform Team | IAM service MVP, CRM account/contact/lead APIs MVP, event outbox baseline | >=30% traffic canary-capable for IAM endpoints, contract tests passing | Weeks 7-9 design and CI gates |
| 11 | Phase 1 Build Sprint B | CRM Team, Platform Team, SRE Team | Opportunity/activity APIs, common scheduler/notification MVP, canary deployment scripts | Blue-green and canary validated in staging, rollback <=5 min proven | Week 10 MVP services |
| 12 | Phase 1 Exit Review and Go/No-Go | ADR Board, Product Owners, Security Officer, SRE Lead | Phase 1 exit report, risk burn-down, Phase 2 decomposition plan | Exit criteria met: API coverage >=95%, unit pass >=90%, zero critical CVE, rollback window <=5 min | Weeks 10-11 validation evidence |

#### A. Cross-Cutting Delivery Cadence

| Cadence | Owner | Output |
| :--- | :--- | :--- |
| Daily stand-up | PMO + Stream Leads | Blocker log and dependency updates |
| Twice-weekly architecture clinic | Enterprise Architecture Lead | ADR clarifications and decision queue closure |
| Weekly security checkpoint | Security Officer | Control drift report and mitigation actions |
| Weekly release readiness review | SRE Lead + QA Lead | Quality-gate, SLO, and rollback readiness status |
| Bi-weekly steering committee | Program Sponsor + PMO | Budget, scope, and risk decisions |

#### B. Immediate Day-0 Task Queue

1. Nominate named owners for every Week 1-4 deliverable.
2. Create ADR templates and repository location for decision evidence.
3. Publish baseline KPI dashboard links and ownership.
4. Lock branch protection to enforce quality and dependency gates.
5. Start IAM and CRM contract-first workshops with domain stakeholders.

### 10.13 Week 1 Implementation Kickoff (Execution Started)

#### A. Active Week 1 Owner Assignment Matrix

| Week 1 Deliverable | Accountable Owner | Supporting Owners | Start Gate | Done Criteria |
| :--- | :--- | :--- | :--- | :--- |
| Program charter v1 | PMO Lead | Enterprise Architecture Lead, Product Owner | Sponsor confirms transformation charter scope | Charter approved in steering committee |
| RACI matrix v1 | PMO Lead | Domain Owners, Platform Engineering Representative | All workstreams listed and role map drafted | RACI approved by Architecture + Product + Security |
| ADR board calendar | Enterprise Architecture Lead | PMO Lead, Security Officer | ADR workflow scope locked for Weeks 1-4 | Recurring ADR sessions published and accepted |
| Risk register v1 | Security Officer | SRE Lead, Platform Architect, PMO Lead | Baseline risks imported from Section 10.1 and 10.2 | Top risks prioritized with mitigation owners assigned |

#### B. Week 1 Delivery Backlog and Status

| ID | Task | Owner | Dependency | Status | Evidence Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W1-T1 | Confirm executive sponsor and steering quorum | PMO Lead | None | In Progress | Sponsor email + steering roster |
| W1-T2 | Finalize charter scope aligned to three-tier model | Enterprise Architecture Lead | W1-T1 | In Progress | Charter approval note |
| W1-T3 | Publish RACI for Weeks 1-4 workstreams | PMO Lead | W1-T2 | In Progress | Signed RACI table |
| W1-T4 | Schedule ADR board sessions and approval SLA | Enterprise Architecture Lead | W1-T2 | In Progress | Calendar invites + SLA note |
| W1-T5 | Open risk register with severity and owner mapping | Security Officer | W1-T2 | In Progress | Risk register with owner and due date |
| W1-T6 | Launch IAM contract-first workshop cadence | IAM Architect | W1-T4 | In Progress | Workshop agenda + attendance |
| W1-T7 | Launch CRM contract-first workshop cadence | CRM Domain Lead | W1-T4 | In Progress | Workshop agenda + attendance |

#### C. Week 1 Acceptance Checklist

- Steering committee approves charter and confirms governance cadence.
- RACI matrix covers all Week 1-4 deliverables with single accountable owner per item.
- ADR board calendar published with recurring slots and decision SLA.
- Risk register includes top ten risks with mitigation owner and target date.
- IAM and CRM workshop schedules are published with named facilitators.

#### D. Week 2 Readiness Dependencies from Week 1

| Week 2 Objective | Required Week 1 Evidence |
| :--- | :--- |
| Baseline audit sign-off package | Approved charter, RACI, and governance cadence |
| Coupling and vulnerability prioritization | Risk register with severity, owner, and mitigation path |
| Architecture and security formal review queue | ADR board schedule and acceptance SLA |

### 10.14 W1-T3 Final RACI Matrix (Weeks 1-4)

| Deliverable | Enterprise Architecture Lead | PMO Lead | Security Officer | Platform Engineering Representative | Product Owner | Domain Owners | SRE Lead | QA Lead | Data Architect |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Week 1 Program Charter | A | R | C | C | C | I | I | I | I |
| Week 1 RACI Matrix | C | A/R | C | C | C | C | I | I | I |
| Week 1 ADR Board Calendar | A/R | C | C | I | I | I | I | I | I |
| Week 1 Risk Register v1 | C | C | A/R | C | I | I | C | I | C |
| Week 2 Baseline Audit Pack | A | C | C | C | I | I | C | I | R |
| Week 2 Coupling and Constraint Report | A | I | C | C | I | C | C | I | R |
| Week 2 Vulnerability and Debt Baseline | C | I | A | C | I | I | C | I | C |
| Week 3 ADR-001 Tier Model | A/R | C | C | C | C | C | I | I | C |
| Week 3 ADR-002 Bounded Context Map | A | I | C | C | C | R | I | I | C |
| Week 4 CI/CD Quality Gates | C | I | C | A/R | I | I | C | R | I |
| Week 4 Dependency and SBOM Gate | I | I | A | R | I | I | C | C | I |

#### RACI Legend

- **R** = Responsible
- **A** = Accountable
- **C** = Consulted
- **I** = Informed

### 10.15 W1-T4 ADR Session and SLA Calendar Matrix

| ADR Session | Cadence | Chair | Required Participants | Scope | Decision SLA | Evidence Artifact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| ADR Board Core Session | Weekly (Mon) | Enterprise Architecture Lead | PMO Lead, Security Officer, Platform Engineering Representative, Product Owner | Tier architecture, bounded context changes, service extraction gates | 3 business days from session close | ADR decision record in approved repository path |
| Security and Compliance ADR Session | Weekly (Wed) | Security Officer | Enterprise Architecture Lead, SRE Lead, Platform Engineering Representative | mTLS, OPA, secrets policy, compliance controls | 2 business days for control acceptance or remediation action | Security review note linked to ADR |
| Data Topology ADR Session | Weekly (Thu) | Data Architect | Enterprise Architecture Lead, Domain Owners, Platform Engineering Representative | Data ownership, CDC/outbox, schema evolution policy | 3 business days | Data decision annex linked to ADR |
| Contract Governance Session | Twice weekly (Tue/Fri) | API Architect | Domain Owners, QA Lead, Platform Engineering Representative | OpenAPI/protobuf/AsyncAPI compatibility and SemVer governance | 2 business days for contract accept/reject | Contract review checklist and decision log |
| Exception and Escalation Session | Ad hoc (<24h trigger) | PMO Lead | Enterprise Architecture Lead, Security Officer, Product Owner | Risk escalation, timeline impact, conditional approvals | 1 business day | Escalation memo and action owner |

#### ADR Queue Triage Policy

| Priority Class | Criteria | Target Review Window | Escalation Trigger |
| :--- | :--- | :--- | :--- |
| P0 | Security, compliance, or production stability impact | <24 hours | Missed SLA or unresolved blocking risk |
| P1 | Scope, contract, or architecture change impacting active sprint | 2 business days | Dependent task blocked >1 day |
| P2 | Improvement proposals without immediate delivery impact | 5 business days | Queue age >7 business days |

### 10.16 W1-T5 Risk Register and Mitigation Matrix (Execution Baseline)

| Risk ID | Risk Statement | Category | Severity | Probability | Owner | Mitigation Plan | Trigger Signal | Contingency Action | Target Closure |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :--- | :--- |
| R-ARCH-001 | Service boundary ambiguity delays extraction | Architecture | High | Medium | Enterprise Architecture Lead | Freeze bounded context map in ADR-002 and enforce API-first boundaries | ADR queue churn >2 cycles on same domain | Escalate to ADR Core Session with final decision vote | Week 3 |
| R-SEC-001 | Inconsistent JWT and policy enforcement across edge interfaces | Security | Critical | Medium | Security Officer | Standardize auth gateway policy and verify control checklist per module | Unauthorized access findings in security review | Block release path and apply hotfix policy gates | Week 4 |
| R-DATA-001 | Shared-data coupling breaks phased migration | Data | High | High | Data Architect | Introduce ownership matrix, outbox/CDC policy, and anti-corruption layer | Cross-domain direct query discovered in review | Freeze affected migration and apply contract facade | Week 5 |
| R-OPS-001 | CI/CD gate drift permits non-compliant merges | Delivery | High | Medium | Platform Engineering Representative | Lock branch protections and required checks for lint, typecheck, tests, CVE, SBOM | Merge without required checks detected | Revert merge and enforce protection policy | Week 4 |
| R-SRE-001 | Observability gaps block SLO governance | Reliability | High | Medium | SRE Lead | Deploy mandatory telemetry baseline and dashboard ownership map | Missing p95/error budget signals for module | Block go/no-go and remediate observability gap | Week 5 |
| R-PROG-001 | Owner ambiguity slows steering decisions | Governance | Medium | Medium | PMO Lead | Single accountable owner per deliverable and escalation path in RACI | Deliverable aged >3 business days without decision | Escalate in bi-weekly steering committee | Week 2 |
| R-CRM-001 | CRM shared service scope creep impacts timeline | Domain | High | Medium | CRM Domain Lead | Lock `/crm/v1` scope to account/contact/lead/opportunity/activity for Phase 1 | New entity requests added mid-sprint | Push additions to controlled backlog after ADR review | Week 8 |
| R-IAM-001 | IAM contract incompatibility with legacy auth clients | Integration | High | Medium | IAM Architect | Define compatibility matrix and canary contract tests | Contract tests fail for legacy token flow | Activate compatibility adapter and phased fallback | Week 8 |
| R-COMP-001 | Compliance evidence gaps delay approvals | Compliance | Medium | Medium | Security Officer | Tie every ADR to evidence artifact and approval checklist | Missing approval artifacts at release gate | Pause release and execute evidence completion sprint | Week 6 |
| R-PERF-001 | Decomposed services miss p95 latency objectives | Performance | High | Medium | Platform Architect | Performance test budget in CI and early load profile per extracted service | Regression >5% or p95 breach in staging | Route traffic back to stable path and tune service | Week 10 |

#### Risk Scoring and Escalation Thresholds

| Score Rule | Definition | Mandatory Action |
| :--- | :--- | :--- |
| Critical | High severity + High impact to security/compliance/reliability | Escalate within 24 hours to ADR Board Core Session |
| High | High severity or repeated trigger signals | Weekly steering checkpoint and owner remediation plan |
| Medium | Localized impact with controlled blast radius | Track in weekly PMO review until closure |

### 10.17 W1-T6 and W1-T7 Contract-First Workshop Execution Kits

#### A. IAM Contract-First Workshop Plan (W1-T6)

| Session | Facilitator | Participants | Objective | Inputs | Outputs | Acceptance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| IAM-WS-1 Discovery | IAM Architect | Security Officer, Platform Engineering, Product Owner, API Architect | Align OAuth 2.1/OIDC/SAML scope and legacy constraints | Current auth flow inventory, policy gaps | IAM scope statement, contract boundary notes | Scope approved by Security + Architecture |
| IAM-WS-2 Contract Draft | API Architect | IAM Architect, QA Lead, Domain Owners | Draft `/iam/v1` REST and gRPC contracts with SemVer policy | IAM scope statement, consumer requirements | OpenAPI/protobuf draft set, versioning rules | Contract review passes with no blocking defects |
| IAM-WS-3 Compatibility and Test Gate | QA Lead | IAM Architect, Platform Engineering, SRE Lead | Define canary contract tests and backward compatibility checks | Draft contracts, legacy client behavior map | Contract test matrix, canary entry criteria | Test matrix signed by QA + SRE + IAM owner |

#### B. CRM Contract-First Workshop Plan (W1-T7)

| Session | Facilitator | Participants | Objective | Inputs | Outputs | Acceptance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CRM-WS-1 Domain Scope Lock | CRM Domain Lead | Product Owner, Enterprise Architecture, Data Architect, API Architect | Lock Phase 1 CRM entity scope and ownership | CRM module inventory, relationship model | Approved entity scope for `/crm/v1` | Scope approved by Product + Architecture |
| CRM-WS-2 Contract and Event Draft | API Architect | CRM Domain Lead, QA Lead, Integration Architect | Draft REST/gRPC and event contracts for Lead/Opportunity lifecycle | Scope lock output, event bus standards | OpenAPI/protobuf/AsyncAPI draft pack | Contract review complete with no P0 gaps |
| CRM-WS-3 Read Model and Search Topology | Data Architect | CRM Domain Lead, SRE Lead, Platform Engineering | Define PostgreSQL ownership, CDC/outbox flow, Elastic read model pattern | Contract drafts, data ownership rules | Data topology decision annex and CDC checklist | Data topology approved in ADR data session |

#### C. Workshop Operating SLA

| KPI | Target | Owner |
| :--- | :--- | :--- |
| Workshop attendance | 100% of required participants | PMO Lead |
| Draft turnaround | <=2 business days after each workshop | Facilitator |
| Decision closure | <=3 business days through ADR queue | Enterprise Architecture Lead |
| Open action carryover | <=5 unresolved actions per workshop stream | PMO Lead |

### 10.18 Week 2 Baseline Audit Execution Pack (Artifacts, Owners, Evidence, Sign-Off)

#### A. Week 2 Artifact Checklist and Ownership

| Artifact ID | Artifact | Primary Owner | Supporting Owners | Source Scope | Completion Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W2-A1 | System inventory baseline pack | Platform Architect | PMO Lead, Domain Owners | Services, routes, jobs, infra assets, integrations | Inventory accepted in architecture review |
| W2-A2 | Module coupling and dependency map | Enterprise Architecture Lead | Platform Engineering Representative, Data Architect | Runtime calls, shared libraries, direct data dependencies | Coupling heatmap and priority list approved |
| W2-A3 | Security vulnerability baseline | Security Officer | SRE Lead, Platform Engineering Representative | Auth flows, secrets handling, policy coverage, CVE posture | Top findings prioritized with remediation owner |
| W2-A4 | Performance baseline snapshot | SRE Lead | Platform Architect, QA Lead | p95 latency, throughput, error rate, saturation | Baseline metrics published with trend anchor |
| W2-A5 | Data ownership and tenancy boundary map | Data Architect | Enterprise Architecture Lead, Security Officer | tenant/franchise isolation, shared schema dependencies | Ownership matrix ratified for extraction planning |
| W2-A6 | Integration contract inventory | API Architect | Domain Owners, QA Lead | REST, gRPC, async contracts and consumers | Version and compatibility matrix approved |
| W2-A7 | Risk refresh addendum for Week 2 findings | Security Officer | PMO Lead, Enterprise Architecture Lead | New risks discovered in audit | Risk register updated with owners and dates |

#### B. Evidence Register (Links and Validation Artifacts)

| Artifact ID | Evidence Link | Evidence Type | Validation Owner | Validation Method |
| :--- | :--- | :--- | :--- | :--- |
| W2-A1 | `Doc/Strategy/06_Implementation_Plan.md#week-2-baseline-audit-execution-pack-artifacts-owners-evidence-sign-off` | Governance source of truth | PMO Lead | Cross-check against active service and module list |
| W2-A2 | `Doc/Strategy/02_Gap_Analysis.md` | Coupling and gap evidence | Enterprise Architecture Lead | Validate dependency criticality and extraction blockers |
| W2-A3 | `.github/workflows/ci.yml` | Security and quality gate evidence | Security Officer | Verify required checks and policy controls |
| W2-A4 | `supabase/config.toml` | Platform baseline configuration evidence | SRE Lead | Confirm performance-affecting runtime configuration |
| W2-A5 | `src/hooks/useCRM.tsx` | Tenancy and scoped access evidence | Data Architect | Validate `ScopedDataAccess` and context boundary controls |
| W2-A6 | `src/App.tsx` | Integration surface evidence | API Architect | Validate route surface and entry point ownership |
| W2-A7 | `Doc/Strategy/06_Implementation_Plan.md#1016-w1-t5-risk-register-and-mitigation-matrix-execution-baseline` | Risk continuity evidence | Security Officer | Reconcile new findings to existing risk IDs |

#### C. Week 2 Sign-Off Gate Matrix

| Gate | Required Artifacts | Approval Roles | Gate Rule | Exit Condition |
| :--- | :--- | :--- | :--- | :--- |
| G2-1 Architecture Baseline Gate | W2-A1, W2-A2, W2-A5 | Enterprise Architecture Lead, Platform Architect | No unresolved critical boundary conflicts | Architecture baseline approved |
| G2-2 Security Baseline Gate | W2-A3, W2-A7 | Security Officer, SRE Lead | No unowned critical findings | Security baseline approved |
| G2-3 Performance Baseline Gate | W2-A4 | SRE Lead, QA Lead | Baseline metrics captured and comparable | Performance baseline approved |
| G2-4 Contract and Integration Gate | W2-A6 | API Architect, Domain Owners | All contracts mapped with owner and version path | Integration baseline approved |
| G2-5 Steering Consolidation Gate | W2-A1 to W2-A7 | PMO Lead, Product Owner, Enterprise Architecture Lead | All prior gates approved and evidence linked | Week 2 closed and Week 3 authorized |

#### D. Week 2 Execution Cadence

| Day | Focus | Owner | Required Output |
| :--- | :--- | :--- | :--- |
| Monday | Inventory + data boundary review | Platform Architect | W2-A1 draft + W2-A5 draft |
| Tuesday | Coupling/dependency mapping | Enterprise Architecture Lead | W2-A2 draft |
| Wednesday | Security baseline and risk refresh | Security Officer | W2-A3 draft + W2-A7 update |
| Thursday | Performance baseline capture | SRE Lead | W2-A4 draft |
| Friday | Contract inventory and steering sign-off | API Architect / PMO Lead | W2-A6 + Gate package for G2-5 |

### 10.19 Week 3 ADR Execution Packet (ADR-001/002, Acceptance, Approval Workflow)

#### A. ADR-001 Template: Tier Model and Service Extraction Policy

| Template Field | Required Content |
| :--- | :--- |
| ADR ID | ADR-001 |
| Title | Three-tier target model and extraction governance policy |
| Status | Proposed / Accepted / Superseded |
| Owners | Enterprise Architecture Lead (A), PMO Lead (R), Security Officer (C) |
| Context | Week 2 baseline findings, coupling map, security and performance baselines |
| Decision | Adopt Tier 1 Core Infrastructure, Tier 2 Domain Services, Tier 3 Plugin Extensions with contract-first service boundaries |
| Decision Drivers | Isolation strength, migration risk, backward compatibility, release safety |
| Options Considered | Keep monolith, partial module split, full tier extraction with phased strangler pattern |
| Consequences | Clear extraction sequence, increased short-term governance overhead, improved long-term resilience |
| Security and Tenancy Controls | Mandatory tenant/franchise isolation checks, policy enforcement at gateway and service layers |
| Rollout Plan | Phase extraction by domain with canary release and rollback-safe controls |
| Required Evidence | Week 2 artifact pack approval IDs, coupling heatmap, security baseline summary |
| Approval Record | Chair, approvers, decision date, SLA compliance flag |

#### B. ADR-002 Template: Bounded Context and Data Ownership Map

| Template Field | Required Content |
| :--- | :--- |
| ADR ID | ADR-002 |
| Title | Bounded context map and data ownership model |
| Status | Proposed / Accepted / Superseded |
| Owners | Enterprise Architecture Lead (A), Data Architect (R), Domain Owners (C) |
| Context | Current schema coupling, cross-domain dependencies, domain service extraction plan |
| Decision | Assign explicit ownership per bounded context and disallow direct cross-context data writes |
| Context Boundaries | IAM, CRM, Logistics, Finance, Plugin Runtime as separate bounded contexts |
| Data Ownership Rules | Single writer per aggregate, CDC/outbox for cross-context propagation, read models for query joins |
| Integration Rules | OpenAPI/protobuf contracts, AsyncAPI events, SemVer compatibility policy |
| Consequences | Reduced coupling and clearer ownership with additional integration orchestration |
| Required Evidence | Ownership matrix, CDC checklist, contract inventory and consumer map |
| Approval Record | Chair, approvers, decision date, SLA compliance flag |

#### C. Week 3 ADR Acceptance Checklist

| Checklist Item | ADR-001 | ADR-002 | Validation Owner |
| :--- | :---: | :---: | :--- |
| Problem statement is clear and traceable to Week 2 evidence | Yes | Yes | PMO Lead |
| Multi-tenant and franchise isolation controls are explicitly defined | Yes | Yes | Security Officer |
| Backward compatibility and migration constraints are documented | Yes | Yes | Enterprise Architecture Lead |
| Service/API contract implications are enumerated | Yes | Yes | API Architect |
| Data ownership and cross-context access policy are explicit | N/A | Yes | Data Architect |
| Rollout, canary, and rollback paths are included | Yes | Yes | SRE Lead |
| Risks, mitigations, and escalation triggers are linked to risk register | Yes | Yes | Security Officer |
| Approval signatures captured within ADR SLA window | Yes | Yes | PMO Lead |

#### D. Week 3 ADR Approval Workflow Table

| Step | Activity | Owner | Inputs | SLA | Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W3-1 | Draft ADR-001 and ADR-002 from Week 2 baseline evidence | Enterprise Architecture Lead | W2-A1 to W2-A7 artifact pack | 2 business days | Draft ADR packet |
| W3-2 | Run architecture and security pre-review | Security Officer | Draft ADR packet, risk register, baseline findings | 1 business day | Review comments and required edits |
| W3-3 | Conduct ADR Board Core Session decision meeting | Enterprise Architecture Lead | Updated ADR packet and decision options | Same-day decision session | Provisional approve/reject decision |
| W3-4 | Record decisions, owners, and action items | PMO Lead | ADR decision outcomes and follow-up actions | 1 business day | Finalized ADR records with action log |
| W3-5 | Validate SLA compliance and publish governance evidence | PMO Lead | Decision timestamps and approval roster | 1 business day | SLA compliance note and published evidence |

#### E. Week 3 Delivery Tracking Snapshot

| ID | Task | Owner | Dependency | Status | Evidence Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W3-T1 | Publish ADR-001 final decision record | Enterprise Architecture Lead | G2-5 | In Progress | Signed ADR-001 |
| W3-T2 | Publish ADR-002 final decision record | Data Architect | G2-5 | In Progress | Signed ADR-002 |
| W3-T3 | Complete ADR acceptance checklist validation | PMO Lead | W3-T1, W3-T2 | Not Started | Checklist with owner sign-off |
| W3-T4 | Close approval workflow evidence and SLA report | PMO Lead | W3-T3 | Not Started | SLA compliance report |

### 10.20 Week 4 CI/CD Quality Gate Implementation Pack

#### A. Quality Gate Policy Table

| Gate ID | Policy Objective | Scope | Accountable Owner | Enforcement Point | Pass Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| QG-01 | Preserve code quality and architecture safety | App, services, shared packages | Platform Engineering Representative | Pull request required checks | Lint, typecheck, tests all pass |
| QG-02 | Enforce security and compliance controls | Build artifacts and dependency graph | Security Officer | CI security stage | No unresolved critical vulnerabilities |
| QG-03 | Protect backward compatibility contracts | API and event contracts | API Architect | Contract validation stage | No breaking change without versioned path |
| QG-04 | Verify deployment reliability and rollback readiness | Release candidate and runtime config | SRE Lead | Pre-deploy and deploy gates | Canary and rollback checks pass |
| QG-05 | Preserve tenant and franchise isolation | Data access and policy layers | Data Architect | Integration and policy tests | Isolation tests pass for tenant/franchise scope |

#### B. Required CI/CD Checks Matrix

| Check ID | Required Check | Stage | Owner | Tooling/Source | Failure Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| CK-01 | Lint validation | PR | Platform Engineering Representative | `npm run lint` | Block merge until resolved |
| CK-02 | Type safety validation | PR | Platform Engineering Representative | `npm run typecheck` | Block merge until resolved |
| CK-03 | Unit and integration tests | PR | QA Lead | Test pipeline in CI workflow | Block merge and open defect |
| CK-04 | Contract compatibility check | PR | API Architect | OpenAPI/protobuf/AsyncAPI diff validation | Reject release candidate and require version strategy |
| CK-05 | Dependency vulnerability scan | Build | Security Officer | CI security scanner and lockfile scan | Block release for critical/high unresolved findings |
| CK-06 | SBOM generation and verification | Build | Security Officer | SBOM export and policy verification | Block release when SBOM missing or policy fails |
| CK-07 | Tenant/franchise isolation tests | PR | Data Architect | Scoped data access and policy test suite | Block merge until isolation passes |
| CK-08 | Migration safety and rollback test | Pre-deploy | SRE Lead | Migration dry-run + rollback simulation | Block deploy and escalate to release board |
| CK-09 | Canary health and SLO gate | Deploy | SRE Lead | Canary metrics, p95/error budget checks | Auto-halt rollout and rollback |

#### C. Release-Block Conditions

| Block Condition ID | Condition | Severity | Escalation Owner | Resolution Requirement |
| :--- | :--- | :--- | :--- | :--- |
| RB-01 | Any required quality check fails | High | Platform Engineering Representative | Re-run checks with successful result |
| RB-02 | Critical or high security finding unresolved | Critical | Security Officer | Fix or approved compensating control before release |
| RB-03 | Breaking API/event contract without approved version strategy | Critical | API Architect | Add versioned path and migration notes |
| RB-04 | Tenant/franchise isolation regression detected | Critical | Data Architect | Restore policy compliance and verify isolation test pass |
| RB-05 | Canary breach on p95 latency or error budget | High | SRE Lead | Stabilize service and pass canary gate before rollout |
| RB-06 | Rollback path not validated for release candidate | High | SRE Lead | Complete rollback simulation and evidence update |
| RB-07 | Missing ADR or governance evidence for architecture-affecting change | Medium | PMO Lead | Attach approved ADR and workflow evidence |

#### D. Quality Gate Evidence Matrix

| Evidence ID | Evidence Artifact | Owner | Storage Location | Verification Method | Sign-Off Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| EV-01 | CI run logs for lint/typecheck/tests | Platform Engineering Representative | CI pipeline run history | Confirm green required checks | PMO Lead |
| EV-02 | Security scan report and remediation status | Security Officer | CI security artifacts | Validate zero unresolved critical/high findings | Security Officer |
| EV-03 | Contract compatibility report | API Architect | Contract governance artifacts | Verify no breaking diff without approved versioning | Enterprise Architecture Lead |
| EV-04 | SBOM package and policy compliance output | Security Officer | Build artifacts repository | Validate SBOM present and policy-compliant | Security Officer |
| EV-05 | Isolation test report across tenant/franchise scopes | Data Architect | Test artifacts and policy logs | Validate pass across all scope permutations | Data Architect |
| EV-06 | Canary metrics snapshot and rollback rehearsal result | SRE Lead | Observability dashboard export and release notes | Confirm SLO adherence and rollback readiness | SRE Lead |
| EV-07 | Week 4 gate approval memo | PMO Lead | Governance evidence pack | Verify all evidence IDs attached and approved | Product Owner |

#### E. Week 4 Delivery Tracking Snapshot

| ID | Task | Owner | Dependency | Status | Evidence Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W4-T1 | Activate required quality checks in CI pipeline | Platform Engineering Representative | W3-T4 | In Progress | CI required-check policy update |
| W4-T2 | Enforce contract and SBOM release gates | API Architect / Security Officer | W4-T1 | In Progress | Contract check report + SBOM policy output |
| W4-T3 | Validate release-block conditions via dry run | SRE Lead | W4-T1, W4-T2 | Not Started | Release dry-run record |
| W4-T4 | Publish Week 4 quality gate sign-off pack | PMO Lead | W4-T3 | Not Started | Signed quality gate evidence matrix |

### 10.21 Week 5 Service Extraction and Migration Readiness Pack

#### A. Extraction Candidate and Boundary Matrix

| Candidate ID | Target Service | Tier | Initial Scope | Boundary Rules | Owner | Exit Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EX-01 | IAM Core Service | Tier 1 | Auth policy, token validation, role mapping | No direct access to CRM domain tables | IAM Architect | `/iam/v1` contract + compatibility tests pass |
| EX-02 | CRM Core Service | Tier 2 | Accounts, Contacts, Leads, Opportunities, Activities | Single writer on CRM aggregates, event-based integration only | CRM Domain Lead | `/crm/v1` contract and read/write ownership accepted |
| EX-03 | Plugin Runtime Adapter | Tier 3 | Plugin registration, activation, domain guard rails | Plugin code isolated from core schema writes | Platform Engineering Representative | Plugin lifecycle tests and policy checks pass |

#### B. Data Migration and Dual-Run Strategy

| Stream | Current Data Path | Target Path | Migration Pattern | Validation Check | Rollback Path |
| :--- | :--- | :--- | :--- | :--- | :--- |
| IAM identity events | Monolith auth handlers | IAM service event flow | Strangler + dual-write buffer | Token and claim parity checks | Switch traffic to legacy auth handlers |
| CRM transactional writes | Monolith CRM modules | CRM service write API | Contract-first cutover with shadow writes | Aggregate parity and idempotency validation | Disable CRM write routing and restore monolith write path |
| Plugin execution events | Mixed runtime hooks | Plugin runtime adapter queue | Adapter introduction with staged routing | Event delivery success and policy conformance | Route events back to existing runtime hooks |

#### C. Week 5 Cutover Gate Conditions

| Gate ID | Gate Rule | Required Evidence | Approval Roles | Block Condition |
| :--- | :--- | :--- | :--- | :--- |
| G5-1 | Contracts are production-ready and backward compatible | ADR-001/002 approvals + contract validation report | Enterprise Architecture Lead, API Architect | Breaking contract without version strategy |
| G5-2 | Tenant/franchise isolation is verified in extracted paths | Isolation test report for service boundaries | Data Architect, Security Officer | Cross-tenant or cross-franchise access detected |
| G5-3 | Dual-run parity meets acceptance threshold | Read/write parity report and discrepancy log | CRM Domain Lead, IAM Architect | Parity drift unresolved at cutover checkpoint |
| G5-4 | Observability and rollback readiness are proven | Canary dashboard, rollback rehearsal evidence | SRE Lead, PMO Lead | Missing rollback evidence or SLO breach |

#### D. Week 5 Evidence and Sign-Off Matrix

| Evidence ID | Artifact | Owner | Verification Method | Sign-Off |
| :--- | :--- | :--- | :--- | :--- |
| W5-E1 | Service boundary conformance report | Enterprise Architecture Lead | Verify boundary policy against ADR decisions | Product Owner |
| W5-E2 | Dual-run parity and discrepancy report | CRM Domain Lead | Validate parity thresholds and exception handling | Enterprise Architecture Lead |
| W5-E3 | IAM compatibility test report | IAM Architect | Confirm legacy client and token flow compatibility | Security Officer |
| W5-E4 | Isolation and policy enforcement report | Data Architect | Validate tenant/franchise scope enforcement | Security Officer |
| W5-E5 | Cutover and rollback rehearsal memo | SRE Lead | Confirm recovery point and traffic revert readiness | PMO Lead |

#### E. Week 5 Delivery Tracking Snapshot

| ID | Task | Owner | Dependency | Status | Evidence Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W5-T1 | Finalize extraction boundary acceptance for IAM and CRM | Enterprise Architecture Lead | W4-T4 | In Progress | Service boundary conformance report |
| W5-T2 | Execute dual-run validation for CRM and IAM flows | CRM Domain Lead / IAM Architect | W5-T1 | In Progress | Dual-run parity report |
| W5-T3 | Complete tenant/franchise isolation validation in extracted paths | Data Architect | W5-T1 | Not Started | Isolation enforcement report |
| W5-T4 | Publish Week 5 cutover readiness and rollback sign-off | SRE Lead / PMO Lead | W5-T2, W5-T3 | Not Started | Cutover and rollback memo |

### 10.22 Week 6 Observability and Reliability Implementation Pack

#### A. SLO and Error Budget Policy Table

| SLO ID | Service Scope | SLI | Target | Error Budget Window | Owner | Alert Threshold |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| SLO-01 | IAM Core Service | Auth success rate | >=99.95% | 30 days | IAM Architect | Burn rate >2x for 1 hour |
| SLO-02 | CRM Core Service APIs | API availability | >=99.90% | 30 days | CRM Domain Lead | Burn rate >2x for 1 hour |
| SLO-03 | CRM Core Service latency | p95 response time | <=350ms | 30 days | SRE Lead | p95 >350ms for 15 minutes |
| SLO-04 | Event delivery pipeline | End-to-end delivery success | >=99.90% | 30 days | Platform Engineering Representative | Delivery failure >0.10% for 30 minutes |
| SLO-05 | Tenant isolation enforcement | Policy pass rate | 100% | 30 days | Data Architect | Any failed isolation check |

#### B. Observability Instrumentation Matrix

| Instrument ID | Domain | Signal Type | Required Tags | Source | Owner | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OBS-01 | IAM auth flows | Metrics + traces | tenant_id, franchise_id, environment, service | IAM middleware and gateway | IAM Architect | Auth latency and failure traces visible in dashboards |
| OBS-02 | CRM API commands | Metrics + logs | tenant_id, franchise_id, module, endpoint, status_code | CRM service handlers | CRM Domain Lead | Endpoint latency, error rate, and volume monitored |
| OBS-03 | Event bus integrations | Metrics + traces | topic, producer_service, consumer_service, message_type | Event producer/consumer adapters | Platform Engineering Representative | Delivery lag and retries measurable |
| OBS-04 | Database and isolation checks | Metrics + audit logs | tenant_id, franchise_id, query_scope, policy_result | Scoped data access and policy hooks | Data Architect | Isolation violations trigger immediate alerts |
| OBS-05 | Deployment health | Metrics + events | release_id, environment, canary_step, rollback_flag | CI/CD deploy jobs and runtime probes | SRE Lead | Canary progression and rollback states observable |

#### C. Alert Routing and Incident Workflow

| Incident Class | Trigger | Primary On-Call | Secondary On-Call | Escalation SLA | Required Response |
| :--- | :--- | :--- | :--- | :--- | :--- |
| P0 | Isolation breach, auth outage, critical security failure | Security Officer | SRE Lead | 15 minutes | Contain impact, isolate affected path, start incident bridge |
| P1 | SLO breach or sustained error-budget burn | SRE Lead | Service Owner | 30 minutes | Mitigate service degradation and publish incident update |
| P2 | Partial degradation with no customer-wide outage | Service Owner | Platform Engineering Representative | 2 hours | Implement fix plan and monitor recovery trend |

#### D. Reliability Evidence and Review Matrix

| Evidence ID | Artifact | Owner | Verification Method | Review Cadence | Sign-Off Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W6-E1 | Service SLO dashboard export | SRE Lead | Validate SLO targets and burn-rate overlays | Weekly | Enterprise Architecture Lead |
| W6-E2 | Alert routing and escalation drill report | Security Officer | Confirm alert reaches primary and secondary on-call | Bi-weekly | PMO Lead |
| W6-E3 | Incident postmortem template and sample run | SRE Lead | Validate root cause and corrective action traceability | Per incident | Product Owner |
| W6-E4 | Tenant/franchise isolation observability proof | Data Architect | Verify tagged isolation events and policy outcomes | Weekly | Security Officer |
| W6-E5 | Reliability readiness sign-off memo | PMO Lead | Confirm all Week 6 evidence is complete | End of week | Steering Committee |

#### E. Week 6 Delivery Tracking Snapshot

| ID | Task | Owner | Dependency | Status | Evidence Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W6-T1 | Publish SLO and error-budget policy for extracted services | SRE Lead | W5-T4 | In Progress | SLO dashboard export |
| W6-T2 | Enable observability instrumentation with tenant/franchise tags | Platform Engineering Representative | W6-T1 | In Progress | Instrumentation validation report |
| W6-T3 | Execute alert routing and incident escalation drill | Security Officer | W6-T2 | Not Started | Escalation drill report |
| W6-T4 | Close Week 6 reliability readiness sign-off | PMO Lead | W6-T3 | Not Started | Reliability readiness sign-off memo |

### 10.23 Week 7 Security and Compliance Hardening Pack

#### A. Security Control Hardening Matrix

| Control ID | Control Domain | Objective | Owner | Enforcement Layer | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| SEC-01 | Identity and access | Enforce OAuth2.1/OIDC token policy with strict claim validation | IAM Architect | API gateway + IAM service | Token policy conformance tests |
| SEC-02 | Tenant and franchise isolation | Block cross-tenant/franchise data access in service boundaries | Data Architect | Scoped data access + policy engine | Isolation regression suite |
| SEC-03 | Secrets management | Rotate keys and restrict runtime secret exposure | Security Officer | CI/CD secrets + runtime config | Secret rotation report and access audit |
| SEC-04 | Transport security | Enforce mTLS and secure service-to-service communication | Platform Engineering Representative | Service mesh / gateway policies | mTLS policy compliance scan |
| SEC-05 | Runtime protection | Apply WAF/rate-limit/bot protection for external interfaces | Security Officer | Edge ingress controls | Traffic policy and abuse simulation report |

#### B. Compliance Evidence and Audit Readiness Matrix

| Compliance ID | Requirement Area | Required Evidence | Collection Owner | Review Cadence | Approval Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| CMP-01 | Access governance | Role map, permission matrix, admin access logs | Security Officer | Weekly | Enterprise Architecture Lead |
| CMP-02 | Data protection | Tenant/franchise isolation test outputs and policy logs | Data Architect | Weekly | Security Officer |
| CMP-03 | Change governance | ADR approvals, release approvals, gate sign-off artifacts | PMO Lead | Weekly | Product Owner |
| CMP-04 | Vulnerability management | Vulnerability scan history and remediation SLA report | Security Officer | Weekly | Security Officer |
| CMP-05 | Incident governance | Incident response logs and postmortem actions | SRE Lead | Per incident | Steering Committee |

#### C. Security Test and Validation Suite

| Test ID | Test Scenario | Owner | Entry Criteria | Exit Criteria | Block Condition |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ST-01 | Privilege escalation attempt against IAM/CRM APIs | Security Officer | Week 6 observability baseline active | No escalation path exploitable | Any unauthorized admin path detected |
| ST-02 | Cross-tenant and cross-franchise access attempts | Data Architect | Isolation policies enabled in extracted services | All isolation checks pass | Data leakage across scope boundaries |
| ST-03 | Token replay and expired token handling | IAM Architect | Token policy updates deployed | Replay blocked and expired tokens rejected | Token replay succeeds |
| ST-04 | mTLS and certificate policy enforcement check | Platform Engineering Representative | Gateway and mesh policies active | All service links pass mTLS verification | Any plaintext service-to-service path |
| ST-05 | Dependency and runtime vulnerability retest | Security Officer | CI security scans configured | No unresolved critical findings | Critical vulnerability remains unresolved |

#### D. Compliance Gate and Escalation Rules

| Gate ID | Rule | Required Evidence | Escalation Owner | SLA | Release Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| G7-1 | All security controls SEC-01 to SEC-05 must pass verification | Security hardening matrix + validation outputs | Security Officer | 1 business day | Block release if any control fails |
| G7-2 | Compliance evidence CMP-01 to CMP-05 must be current | Compliance evidence pack | PMO Lead | 1 business day | Block governance sign-off if incomplete |
| G7-3 | Security test suite ST-01 to ST-05 must pass | Security test results and defect closure notes | Security Officer | 24 hours | Block release for unresolved critical issues |
| G7-4 | Incident response and rollback runbook must be approved | Incident drill record + rollback readiness memo | SRE Lead | 1 business day | No production cutover allowed |

#### E. Week 7 Delivery Tracking Snapshot

| ID | Task | Owner | Dependency | Status | Evidence Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W7-T1 | Complete security control hardening across IAM/CRM/extraction paths | Security Officer | W6-T4 | In Progress | Security control verification report |
| W7-T2 | Execute compliance evidence refresh and audit traceability pack | PMO Lead | W7-T1 | In Progress | Compliance evidence matrix |
| W7-T3 | Run security validation suite and close critical defects | Security Officer / Data Architect | W7-T1 | Not Started | Security test results with defect closure |
| W7-T4 | Publish Week 7 security and compliance gate sign-off | PMO Lead / Security Officer | W7-T2, W7-T3 | Not Started | Signed security and compliance gate memo |

### 10.24 Week 8 Consumer Migration and Backward Compatibility Pack

#### A. Consumer Migration Wave Plan

| Wave ID | Consumer Segment | Current Contract | Target Contract | Migration Owner | Rollout Strategy | Success Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| MW-01 | Internal web modules | Legacy monolith endpoints | `/iam/v1`, `/crm/v1` | Platform Engineering Representative | Feature-flag routing with progressive enablement | >=95% internal traffic on new contracts |
| MW-02 | Tenant integrations | Legacy REST contracts | Versioned REST contracts with compatibility adapters | API Architect | Tenant-by-tenant migration with canary validation | No tenant-critical incident during migration |
| MW-03 | Franchisee operations workflows | Mixed module calls | CRM scoped APIs with strict tenancy controls | CRM Domain Lead | Franchise cohort rollout by geography/business unit | No cross-franchise leakage and workflow parity met |
| MW-04 | Plugin consumers | Direct runtime hooks | Plugin adapter contracts and event APIs | Platform Engineering Representative | Adapter-first onboarding with dual-path fallback | Plugin execution parity >=99% with stable retries |

#### B. Compatibility and Versioning Control Matrix

| Control ID | Policy | Owner | Enforcement | Verification | Release Block |
| :--- | :--- | :--- | :--- | :--- | :--- |
| COMP-01 | No breaking API/event change without versioned path | API Architect | Contract governance gate | OpenAPI/protobuf/AsyncAPI diff checks | Yes |
| COMP-02 | Additive-only schema migration for active contracts | Data Architect | Migration review gate | Migration script review and rollback test | Yes |
| COMP-03 | Deprecation requires migration path and timeline | PMO Lead | Governance approval gate | Deprecation notice and consumer acknowledgement log | Yes |
| COMP-04 | Legacy fallback path required during migration window | SRE Lead | Deploy and canary gates | Fallback rehearsal and rollback simulation | Yes |
| COMP-05 | Tenant/franchise behavior parity required pre-cutover | CRM Domain Lead | UAT gate | Tenant/franchise parity validation report | Yes |

#### C. Deprecation and Communication Matrix

| Notice ID | Deprecated Interface | Replacement Interface | Audience | Notice Owner | Timeline | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| DEP-01 | Legacy IAM auth endpoints | `/iam/v1` auth and token contracts | Internal platform teams and tenant admins | IAM Architect | 2 release cycles | Published deprecation bulletin + migration guide |
| DEP-02 | Legacy CRM account/contact/lead endpoints | `/crm/v1` entity contracts | CRM consumers and integration partners | CRM Domain Lead | 2 release cycles | Consumer readiness acknowledgements |
| DEP-03 | Direct plugin runtime hooks | Plugin adapter contract APIs | Plugin developers and partner teams | Platform Engineering Representative | 1 release cycle | Adapter onboarding checklist and sign-offs |

#### D. Migration Evidence and Sign-Off Matrix

| Evidence ID | Artifact | Owner | Verification Method | Sign-Off Role |
| :--- | :--- | :--- | :--- | :--- |
| W8-E1 | Consumer inventory and migration wave mapping | PMO Lead | Verify all active consumers mapped to MW-01..MW-04 | Enterprise Architecture Lead |
| W8-E2 | Contract compatibility and version report | API Architect | Validate no unversioned breaking changes | Security Officer |
| W8-E3 | Tenant/franchise parity UAT report | CRM Domain Lead | Confirm no behavior regression across scope tiers | Product Owner |
| W8-E4 | Fallback/rollback rehearsal report | SRE Lead | Confirm fallback activation and recovery targets | PMO Lead |
| W8-E5 | Deprecation communication evidence pack | PMO Lead | Confirm notice delivery and acknowledgement coverage | Steering Committee |

#### E. Week 8 Delivery Tracking Snapshot

| ID | Task | Owner | Dependency | Status | Evidence Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W8-T1 | Publish consumer migration wave map and owner assignments | PMO Lead | W7-T4 | In Progress | Migration wave mapping report |
| W8-T2 | Complete compatibility and versioning gate validation | API Architect | W8-T1 | In Progress | Contract compatibility report |
| W8-T3 | Execute tenant/franchise parity UAT and fallback rehearsal | CRM Domain Lead / SRE Lead | W8-T2 | Not Started | UAT parity report + fallback rehearsal report |
| W8-T4 | Publish Week 8 migration readiness and deprecation sign-off | PMO Lead | W8-T3 | Not Started | Signed migration readiness memo |

### 10.25 Week 9 Production Cutover and Hypercare Pack

#### A. Cutover Stage and Ownership Matrix

| Stage ID | Cutover Stage | Scope | Primary Owner | Secondary Owner | Entry Criteria | Exit Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CO-01 | Final pre-cutover readiness review | IAM, CRM, plugin and integration landscape | PMO Lead | Enterprise Architecture Lead | Week 8 sign-off completed | Go/no-go decision recorded |
| CO-02 | Controlled production traffic shift | Internal modules, tenant APIs, plugin adapters | SRE Lead | Platform Engineering Representative | Rollback path validated and monitoring green | >=90% target traffic on new services |
| CO-03 | Full contract and routing switch | Legacy routes retired from primary path | API Architect | CRM Domain Lead | CO-02 stable for 24h | 100% production path on versioned services |
| CO-04 | Post-switch stabilization | Service health and tenant/franchise parity | SRE Lead | Security Officer | CO-03 completed | No P0/P1 incident for 48h |

#### B. Go/No-Go Decision Gate Matrix

| Gate ID | Decision Rule | Required Evidence | Accountable Owner | Decision Window | Release Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| G9-1 | SLO and burn-rate status must be within limits | Week 6 dashboard export + alert status | SRE Lead | T-24h | No-go if active SLO breach |
| G9-2 | Security and compliance gates must be fully closed | Week 7 gate memo + security test evidence | Security Officer | T-24h | No-go if unresolved critical control gap |
| G9-3 | Consumer migration readiness must be accepted | Week 8 readiness memo + deprecation acknowledgements | PMO Lead | T-24h | No-go if major consumer unready |
| G9-4 | Rollback and fallback activation must pass rehearsal | Rollback rehearsal report and RTO/RPO validation | SRE Lead | T-12h | No-go if rollback objectives missed |
| G9-5 | Tier isolation checks must pass in production-like run | Tenant/franchise isolation validation report | Data Architect | T-12h | No-go if any cross-scope leakage detected |

#### C. Hypercare Operational Coverage Matrix

| Hypercare ID | Coverage Area | SLA Target | Owner | Monitoring Signal | Escalation Path |
| :--- | :--- | :--- | :--- | :--- | :--- |
| HC-01 | IAM authentication and authorization | MTTR <=30 minutes | IAM Architect | Auth success rate, token failure, latency | Security Officer -> Steering Committee |
| HC-02 | CRM command/query reliability | MTTR <=45 minutes | CRM Domain Lead | API error rate, p95 latency, throughput | SRE Lead -> Product Owner |
| HC-03 | Tenant/franchise isolation integrity | Immediate containment | Data Architect | Isolation audit events and policy failures | Security Officer -> Enterprise Architecture Lead |
| HC-04 | Integration and event delivery stability | MTTR <=60 minutes | Platform Engineering Representative | Event lag, dead-letter volume, retry rates | SRE Lead -> PMO Lead |
| HC-05 | Customer-impacting incident communication | Update every 30 minutes | PMO Lead | Incident bridge updates and status timeline | PMO Lead -> Steering Committee |

#### D. Cutover Evidence and Closure Matrix

| Evidence ID | Artifact | Owner | Verification Method | Closure Role |
| :--- | :--- | :--- | :--- | :--- |
| W9-E1 | Go/no-go decision record and approvals | PMO Lead | Validate signatures for G9-1..G9-5 | Steering Committee |
| W9-E2 | Traffic-shift observability report | SRE Lead | Confirm staged shift met error and latency thresholds | Enterprise Architecture Lead |
| W9-E3 | Production isolation assurance report | Data Architect | Confirm no tenant/franchise leakage during cutover | Security Officer |
| W9-E4 | Hypercare incident summary and action tracker | PMO Lead | Validate incident handling and closure actions | Product Owner |
| W9-E5 | Final cutover completion and legacy deactivation memo | API Architect | Verify legacy path retirement with rollback archive | Steering Committee |

#### E. Week 9 Delivery Tracking Snapshot

| ID | Task | Owner | Dependency | Status | Evidence Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W9-T1 | Conduct go/no-go review and publish cutover decision | PMO Lead | W8-T4 | In Progress | Go/no-go approval record |
| W9-T2 | Execute staged production traffic shift with guardrails | SRE Lead | W9-T1 | In Progress | Traffic-shift observability report |
| W9-T3 | Run hypercare coverage and close critical incidents | SRE Lead / PMO Lead | W9-T2 | Not Started | Hypercare incident summary |
| W9-T4 | Publish Week 9 production cutover closure memo | PMO Lead | W9-T3 | Not Started | Signed cutover closure memo |

### 10.26 Week 10 Optimization and Governance Closure Pack

#### A. Post-Cutover Optimization Matrix

| Optimization ID | Optimization Area | Objective | Owner | Baseline Input | Target Outcome | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OPT-01 | API latency and throughput tuning | Reduce p95 latency for IAM/CRM critical routes | SRE Lead | Week 9 hypercare metrics | >=15% p95 latency improvement | Performance regression and load test reports |
| OPT-02 | Query and data-scope efficiency | Improve ScopedDataAccess query efficiency and reduce retries | Data Architect | Query profile and isolation logs | >=20% reduction in slow scoped queries | Query benchmark and isolation safety checks |
| OPT-03 | Event and integration resilience | Reduce retry storms and dead-letter queue volume | Platform Engineering Representative | Week 9 event lag and retry telemetry | >=30% reduction in DLQ volume | Event replay and resilience validation report |
| OPT-04 | Cost and capacity optimization | Align service autoscaling and runtime footprint | Platform Engineering Representative | Runtime utilization and spend baseline | <=10% cost reduction without SLO regression | Capacity and cost optimization report |
| OPT-05 | Tenant/franchise UX reliability | Stabilize user-facing workflows after migration | CRM Domain Lead | Tenant/franchise support tickets and UAT findings | <=2% critical workflow failure rate | Tenant/franchise workflow parity validation |

#### B. Governance Closure and Compliance Continuity Matrix

| Closure ID | Governance Requirement | Evidence Artifact | Owner | Cadence After Closure | Approval Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| GOV-01 | ADR and architecture decision continuity | Final ADR register with disposition and follow-up actions | Enterprise Architecture Lead | Monthly | Steering Committee |
| GOV-02 | Security and compliance continuity | Security and compliance control continuity plan | Security Officer | Monthly | Security Officer |
| GOV-03 | Backward compatibility continuity | Versioning/deprecation calendar and consumer support plan | API Architect | Per release | Product Owner |
| GOV-04 | Multi-tenant isolation continuity | Tenant/franchise isolation audit schedule and checkpoints | Data Architect | Weekly | Enterprise Architecture Lead |
| GOV-05 | Incident and reliability governance continuity | Post-cutover reliability governance charter | SRE Lead | Weekly | PMO Lead |

#### C. KPI and Business Outcome Validation Matrix

| KPI ID | Business KPI | Baseline | Target | Owner | Validation Window | Block Condition |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| KPI-01 | Quote-to-shipment conversion | Week 8 baseline | >=5% improvement | Product Owner | 30 days | No measurable conversion improvement |
| KPI-02 | Tenant onboarding cycle time | Pre-extraction baseline | >=20% reduction | Platform Engineering Representative | 30 days | Onboarding time regression persists |
| KPI-03 | Critical incident volume | Week 9 baseline | <=50% reduction | SRE Lead | 30 days | Critical incidents remain above baseline |
| KPI-04 | Franchise workflow completion success | Week 8 parity baseline | >=98% completion success | CRM Domain Lead | 30 days | Workflow completion below threshold |
| KPI-05 | Compliance evidence freshness | Week 7 and 8 evidence set | 100% within cadence | PMO Lead | 30 days | Any overdue compliance evidence |

#### D. Final Program Sign-Off Matrix

| Sign-Off ID | Sign-Off Scope | Required Inputs | Accountable Owner | Approver | Release Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| FS-01 | Technical closure sign-off | OPT-01..OPT-05 verification and KPI status | SRE Lead | Enterprise Architecture Lead | Blocks final closure if incomplete |
| FS-02 | Security and compliance closure sign-off | GOV-02, GOV-04 continuity artifacts and latest audits | Security Officer | Steering Committee | Blocks closure if unresolved control risks |
| FS-03 | Product and customer readiness closure sign-off | KPI-01, KPI-04 outcomes and customer impact summary | Product Owner | PMO Lead | Blocks closure if customer risk remains high |
| FS-04 | Program governance closure sign-off | GOV-01..GOV-05 evidence and closure report | PMO Lead | Steering Committee | Required for final program completion |

#### E. Week 10 Delivery Tracking Snapshot

| ID | Task | Owner | Dependency | Status | Evidence Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W10-T1 | Publish post-cutover optimization backlog and target baselines | SRE Lead / Data Architect | W9-T4 | In Progress | Optimization baseline report |
| W10-T2 | Execute governance continuity handoff and compliance calendar | PMO Lead / Security Officer | W10-T1 | In Progress | Governance continuity artifact set |
| W10-T3 | Validate KPI outcomes and finalize closure evidence | Product Owner / PMO Lead | W10-T2 | Not Started | KPI validation pack and closure report |
| W10-T4 | Publish Week 10 final program sign-off memo | PMO Lead | W10-T3 | Not Started | Signed final program closure memo |

### 10.27 Week 11 Operations Transition and Continuous Improvement Pack

#### A. Operations Transition Ownership Matrix

| Transition ID | Operations Area | Transition Objective | Primary Owner | Secondary Owner | Handover Input | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| OPS-01 | Platform operations command model | Move from project war-room to steady-state operations cadence | PMO Lead | SRE Lead | Week 10 closure memo | Weekly operational cadence accepted |
| OPS-02 | IAM and security run operations | Establish BAU security operations for auth and policy controls | Security Officer | IAM Architect | Security continuity artifacts | Security SLA adherence for 4 consecutive weeks |
| OPS-03 | CRM and franchise workflow operations | Institutionalize tenant/franchise workflow support playbooks | CRM Domain Lead | Product Owner | KPI validation pack | >=98% workflow completion maintained |
| OPS-04 | Data isolation and compliance operations | Operationalize recurring isolation audit execution | Data Architect | Security Officer | Isolation audit schedule | Zero critical isolation control gaps open |
| OPS-05 | Integration and plugin runtime operations | Transition adapter/integration support to BAU ownership | Platform Engineering Representative | API Architect | Integration resilience reports | No unresolved P1 integration defects |

#### B. Continuous Improvement Backlog Governance Matrix

| CI ID | Improvement Category | Intake Source | Prioritization Owner | SLA | Delivery Cadence | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| CI-01 | Reliability enhancements | Hypercare incidents and SLO burn reports | SRE Lead | Triage within 3 business days | Bi-weekly | Reliability improvement backlog board |
| CI-02 | Security/compliance enhancements | Audit findings and control gap reviews | Security Officer | Triage within 2 business days | Bi-weekly | Security improvement register |
| CI-03 | Tenant/franchise UX enhancements | Support tickets and UAT feedback | CRM Domain Lead | Triage within 5 business days | Sprint cadence | UX improvement plan with acceptance tests |
| CI-04 | Integration and contract optimizations | Consumer feedback and compatibility telemetry | API Architect | Triage within 5 business days | Sprint cadence | Contract optimization backlog |
| CI-05 | Cost and capacity efficiencies | Runtime spend and utilization telemetry | Platform Engineering Representative | Triage within 5 business days | Monthly | Capacity optimization report |

#### C. Operations KPI Sustainment Matrix

| Sustainment KPI ID | KPI | Target | Owner | Review Cadence | Escalation Trigger |
| :--- | :--- | :--- | :--- | :--- | :--- |
| SKPI-01 | SLO compliance for IAM/CRM/event services | >=99.9% composite compliance | SRE Lead | Weekly | Any 7-day breach of target |
| SKPI-02 | Tenant/franchise isolation pass rate | 100% pass rate | Data Architect | Weekly | Any failed isolation check |
| SKPI-03 | Security control and compliance freshness | 100% on-time evidence refresh | Security Officer | Weekly | Any overdue compliance artifact |
| SKPI-04 | Customer-impacting critical incident rate | <=50% of Week 9 baseline | PMO Lead | Monthly | Upward trend for 2 consecutive weeks |
| SKPI-05 | Consumer compatibility defect rate | <=1% migration-related defects | API Architect | Weekly | Defect rate above threshold |

#### D. BAU Governance Gate Matrix

| Gate ID | BAU Rule | Required Evidence | Accountable Owner | Escalation Owner | Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| G11-1 | Operations transition checklist must be fully accepted | OPS-01..OPS-05 handover confirmations | PMO Lead | Steering Committee | Blocks program transition to BAU |
| G11-2 | Continuous improvement backlog must be active and governed | CI-01..CI-05 prioritized backlog snapshots | SRE Lead | Enterprise Architecture Lead | Blocks closure if backlog governance absent |
| G11-3 | Sustainment KPIs must be in target for stabilization window | SKPI-01..SKPI-05 weekly reports | PMO Lead | Product Owner | Escalates to stabilization extension |
| G11-4 | Tenant/franchise isolation and security controls must remain green | Isolation audit report + security status summary | Security Officer | Steering Committee | Immediate escalation and corrective action required |

#### E. Week 11 Delivery Tracking Snapshot

| ID | Task | Owner | Dependency | Status | Evidence Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| W11-T1 | Complete operations ownership handover and BAU checklist | PMO Lead | W10-T4 | In Progress | Handover acceptance checklist |
| W11-T2 | Activate continuous improvement governance backlog | SRE Lead / Security Officer | W11-T1 | In Progress | Backlog governance register |
| W11-T3 | Validate sustainment KPI window and publish stabilization summary | PMO Lead / Product Owner | W11-T2 | Not Started | KPI sustainment summary |
| W11-T4 | Publish Week 11 BAU transition completion memo | PMO Lead | W11-T3 | Not Started | Signed BAU transition memo |

This document outlines a high-level Enterprise Architecture Transformation designed to move a legacy monolith into a modern, resilient microservices ecosystem. It is structured to serve as a master blueprint for architects, developers, and stakeholders.

🏛️ Phase 1: The Three-Tier Architecture
The new system is organized into three distinct layers to ensure separation of concerns and scalability.
Tier 1: Core Infrastructure Modules
Foundation services shared across the entire enterprise.
	•	Identity: OAuth 2.1, OIDC, SAML, MFA, RBAC, and ABAC.
	•	Security: Secrets vault, WAF, encryption-at-rest/transit, and GDPR adapters.
	•	Data Persistence: Polyglot ORM, CQRS, Event Sourcing, and Change Data Capture (CDC).
	•	Common Services: Logging, rate-limiting, notifications, and CRM as a shared service.
	•	DevOps: Container orchestration, Service Mesh, GitOps, and Canary pipelines.
Tier 2: Domain-Specific Modules
The "Brain" of the business, exposing REST and gRPC contracts.
	•	Vertical Domains: Order Management, Inventory, Billing, Supply Chain, and HR.
	•	Horizontal Domains: Workflow engines, Rules engines, and AI/ML Feature Stores.
	•	Data Sovereignty: Each domain owns its data store and publishes events to Kafka/Pulsar.
Tier 3: Business Plugins & Integration
Extensibility layer for third-party and custom logic.
	•	SDKs: TypeScript, Java, and Go with lifecycle hooks.
	•	Connectors: Salesforce, SAP, Shopify, and Payment Gateways.
	•	Frontend: Micro-frontend shell with iframe sandboxing and CSP.
	•	Feature Management: A/B testing framework with real-time segmentation.

🛠️ Execution Roadmap & Deliverables
The transition is executed through a 10-step systematic process.
1. Audit & Opportunity Assessment
	•	Current-State: Inventory all repos, dependencies, and performance p95 baselines.
	•	Gap Analysis: Quantify tight coupling, single points of failure, and tech debt.
2. Domain-Driven Design (DDD)
	•	Define Bounded Contexts, Aggregate Roots, and Ubiquitous Language.
	•	Publish OpenAPI 3.1 and Protobuf contracts using SemVer.
3. Zero-Downtime Migration (Strangler-Fig)
Phase
Focus
Exit Criteria
Phase 0
Stabilize CI/CD & Observability
Unit Test ≥ 90%
Phase 1
Extract Auth & Common Services
Zero Critical CVEs
Phase 2
Decompose Domains & Event Bus
API Coverage ≥ 95%
Phase 3
Roll out Plugins & Decommission Legacy
Rollback window ≤ 5 min

📈 Quality & Performance Gates
To ensure the new architecture remains "resilient," the following metrics are enforced:
	•	Latency: Read APIs ≤ 100ms; Write APIs ≤ 300ms (at 10k RPS).
	•	Scalability: Horizontal Pod Autoscaling (HPA) from 1 to 100 replicas within 60s.
	•	Security: Zero-trust mTLS, OPA policy-as-code, and 30-day secret rotation.
	•	Observability: Full stack traces via Prometheus, Grafana, Loki, and Tempo.

📇 CRM Core Service Specification
The CRM module acts as a critical shared service with the following sub-modules:
	•	Entities: Account, Contact, Lead, Opportunity, Activity, Case, Territory, Quotation.
	•	Relationship Logic: 1 Account → Many Contacts → Many Leads → Many Opportunities.
	•	Stack: PostgreSQL cluster for persistence, Elasticsearch for read-model replication, and a GraphQL Gateway for frontend consumption.

📜 Governance & Documentation
Every deliverable must be documented using the C4 Model and validated through a formal Architecture Decision Record (ADR) review board.
Final Note: No implementation begins without sign-off from Enterprise Architects, Security Officers, and Product Owners.

### Addendum: Logic Nexus-AI Mandatory Controls

#### 1) Platform Hierarchy and Access Boundaries

- Enforce the operating hierarchy `Platform -> Admin -> Multi-Tenant -> Multi-Franchisee` across all modules.
- Validate permissions at each layer with auditable controls for platform, admin, tenant, and franchise roles.
- Block release if hierarchy-scoped authorization checks are missing for new or modified flows.

#### 2) Tenant and Franchise Data Isolation

- Require `tenant_id` and `franchise_id` scoping for all domain services and persistence paths.
- Enforce Row Level Security policies and isolation tests for read/write paths before cutover.
- Use `ScopedDataAccess` for all database access paths and prohibit unscoped direct data calls.

#### 3) Backward Compatibility and Contract Safety

- Require versioned API/event contracts for any behavior or response change.
- Permit only additive schema migrations with rollback-safe scripts during migration windows.
- Require fallback compatibility paths and consumer deprecation timelines before legacy endpoint retirement.

#### 4) Security and Key Management Controls

- Use JWT Signing Key for token validation and signing workflows; do not use Legacy JWT Secret.
- Enforce mTLS for service-to-service traffic and rotate secrets on a fixed compliance cadence.
- Require unresolved critical vulnerabilities to block release gates.

#### 5) CI/CD and Evidence Governance

- Keep release gates tied to security, isolation, observability, and rollback-readiness evidence.
- Require objective artifacts for approval decisions: gate reports, test outputs, runbooks, and sign-off memos.
- Enforce architecture, security, and product approval checkpoints before production transitions.

#### 6) Operations Continuity Minimums

- Maintain weekly sustainment reviews for SLOs, isolation pass rate, compliance freshness, and incident trends.
- Keep a governed continuous-improvement backlog with triage SLAs and assigned owners.
- Treat repeated KPI degradation as a stabilization failure and trigger corrective governance actions.
