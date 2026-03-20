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
