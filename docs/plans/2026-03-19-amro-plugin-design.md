# AMRO Plugin Module Design
## Logic Nexus-AI Aviation MRO Implementation

**Document ID:** DESIGN-AMRO-001
**Version:** 1.0.0
**Date:** 2026-03-19
**Status:** Approved for Implementation
**Target Timeline:** 13 weeks (Full Phase A)
**Lead Architect:** AI-Assisted Design Session

---

## Executive Summary

This document outlines the design for integrating an **AMRO (Asset Maintenance, Repair, and Overhaul) plugin module** into Logic Nexus-AI to target the aviation MRO market segment. The design balances rapid deployment with regulatory compliance, leveraging Nexus-AI's existing multi-tenant infrastructure while introducing purpose-built aviation domain models.

**Success Metrics:**
- Complete Phase A requirements from AMRO specification v1.1
- Achieve 99.99% availability with < 5-minute RTO/RPO
- Support 10,000 concurrent users at 5,000 TPS
- Enable certifiable maintenance workflows for regulated aviation operations
- Deliver within 13 weeks with 4.5 FTE

---

## 1. Architecture & Integration Approach

### 1.1 Architectural Model: Hybrid Domain Module

The AMRO plugin operates as a **loosely-coupled domain module** within Logic Nexus-AI, reusing the multi-tenant foundation while owning isolated workflows, services, and data layers.

**Integration Points:**

| Component | Reused from Nexus-AI | AMRO-Owned | Interaction |
|---|---|---|---|
| **Tenancy & Auth** | ✅ Tenant model, RBAC/ABAC | — | Inherited; scope AMRO contexts |
| **Multi-org support** | ✅ Tenant isolation, RLS | — | Inherited; apply to AMRO tables |
| **Event bus** | ✅ Kafka, MQTT choreography | — | AMRO publishes work-order events |
| **Mobile framework** | ✅ React Native/Flutter base | ✅ Task card UI, offline cache | Leverage existing; extend |
| **API gateway** | ✅ REST/GraphQL scaffold | ✅ AMRO-specific endpoints | Add SemVer-versioned routes |
| **Observability** | ✅ OpenTelemetry, Prometheus | ✅ Maintenance-critical flow traces | Extend tracing for audit flows |
| **Work order** | ⚠️ CRM work order exists | ✅ MRO-specific work package | Parallel models; adapters bridge |
| **Asset registry** | ✅ Logistics assets exist | ✅ Aircraft/component hierarchy | New; linked via asset_id |

### 1.2 Service Topology

```
┌──────────────────────────────────────────────────────────────┐
│                    Nexus-AI Core Platform                    │
│  (Tenancy, Auth, API Gateway, Event Bus, Observability)     │
└────────┬─────────────────────────────────┬──────────────────┘
         │                                 │
    ┌────▼────────────────────────┐  ┌────▼──────────────────┐
    │   AMRO Domain Microservice   │  │  CRM / Logistics Core │
    │ (Work Orders, Scheduling,    │  │  (Existing Features)  │
    │  Execution, Compliance)      │  │                       │
    │                              │  │                       │
    │ ┌──────────────────────────┐ │  │                       │
    │ │ Workflow Engine          │ │  │                       │
    │ │ (Orchestrate execution)  │ │  │                       │
    │ ├──────────────────────────┤ │  │                       │
    │ │ Scheduling Engine        │ │  │                       │
    │ │ (Constraints, dispatch)  │ │  │                       │
    │ ├──────────────────────────┤ │  │                       │
    │ │ Compliance Registry      │ │  │                       │
    │ │ (Policies, rules)        │ │  │                       │
    │ ├──────────────────────────┤ │  │                       │
    │ │ Mobile Sync Service      │ │  │                       │
    │ │ (Offline, conflict res)  │ │  │                       │
    │ └──────────────────────────┘ │  │                       │
    │                              │  │                       │
    └────┬───────────────────────┬──┘  └────┬──────────────────┘
         │                       │           │
         │ REST/GraphQL (SemVer) │           │
         │ Kafka Events          │           │ Async Adapters
         │ (work-order.*)        │           │
         │                       │           │
    ┌────▼───────────────────────▼──┐      │
    │  External Integrations         │◄─────┘
    │  (SAP, Maximo, AD/SB feeds)    │
    └────────────────────────────────┘
```

### 1.3 API Versioning & Backward Compatibility

- **REST endpoints:** `/api/amro/v1/work-orders`, `/api/amro/v1/tasks`, etc.
- **GraphQL:** Namespaced as `query { amro { workOrders { ... } } }`
- **Event topics:** `amro.work-order.created`, `amro.task.executed`, `amro.maintenance.closed`
- **SemVer contract:** Maintain compatibility for current + previous 2 versions (N, N-1, N-2)

---

## 2. Hybrid Schema Strategy & Data Model

### 2.1 Schema Architecture

**Operational Schema (shared Nexus-AI schema):**
Core MRO tables live alongside existing Nexus-AI tables, enabling tight queries and simple pilot rollout.

```sql
-- Aircraft & Component Registry
CREATE TABLE aircraft (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  tail_number VARCHAR UNIQUE NOT NULL,
  aircraft_model VARCHAR NOT NULL,
  owner_id UUID REFERENCES organizations(id),
  status VARCHAR CHECK (status IN ('active', 'maintenance', 'grounded', 'retired')),
  created_at TIMESTAMP, updated_at TIMESTAMP
);

CREATE TABLE components (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  aircraft_id UUID REFERENCES aircraft(id),
  part_number VARCHAR NOT NULL,
  serial_number VARCHAR UNIQUE NOT NULL,
  component_type VARCHAR (e.g., 'engine', 'avionics', 'hydraulic'),
  ata_chapter VARCHAR (e.g., '70' for hydraulic),
  llp_hours DECIMAL,            -- Life-limited part threshold
  llp_cycles DECIMAL,
  llp_calendar_days DECIMAL,
  current_hours DECIMAL,        -- Current usage tracking
  current_cycles DECIMAL,
  status VARCHAR CHECK (status IN ('serviceable', 'unserviceable', 'reserved')),
  installed_at TIMESTAMP,
  removed_at TIMESTAMP,
  created_at TIMESTAMP, updated_at TIMESTAMP
);

-- Work Orders & Maintenance Planning
CREATE TABLE work_packages (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  aircraft_id UUID REFERENCES aircraft(id),
  work_type VARCHAR CHECK (work_type IN ('corrective', 'preventive', 'regulatory')),
  source VARCHAR (e.g., 'defect_report', 'scheduled_check', 'AD', 'MEL'),
  source_id VARCHAR,            -- Defect ID, AD number, MEL code, etc.
  title VARCHAR NOT NULL,
  description TEXT,
  priority VARCHAR CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status VARCHAR CHECK (status IN ('open', 'planning', 'scheduled', 'in_execution', 'closed', 'deferred')),
  created_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  estimated_labor_hours DECIMAL,
  estimated_downtime_minutes INT,
  maintenance_type VARCHAR CHECK (maintenance_type IN ('line', 'base')), -- Regulatory segregation
  created_at TIMESTAMP, updated_at TIMESTAMP
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  work_package_id UUID REFERENCES work_packages(id),
  sequence INT,
  task_type VARCHAR (e.g., 'inspection', 'repair', 'component_replace'),
  description TEXT,
  procedure_reference VARCHAR,   -- S1000D, ATA Spec 100 reference
  steps JSONB,                   -- Structured step definitions
  assigned_technician_id UUID REFERENCES users(id),
  required_qualifications JSONB, -- {rating: 'A&P', scope: 'powerplant', currency_days: 24}
  status VARCHAR CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'deferred')),
  evidence_fields JSONB,         -- {'photos': true, 'inspection_checklist': true}
  created_at TIMESTAMP, updated_at TIMESTAMP
);

-- Execution & Evidence
CREATE TABLE maintenance_events (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  task_id UUID REFERENCES tasks(id),
  executed_by UUID REFERENCES users(id),
  execution_start TIMESTAMP,
  execution_end TIMESTAMP,
  event_type VARCHAR (e.g., 'task_start', 'evidence_captured', 'task_complete', 'sign_off'),
  evidence JSONB,               -- {photos: [...], checklist: {...}, notes: '...'}
  signed_at TIMESTAMP,
  signed_by UUID REFERENCES users(id),
  signature_method VARCHAR (e.g., 'digital', 'pin', 'biometric'),
  created_at TIMESTAMP
);

-- Staff Qualifications & Certifying Authority
CREATE TABLE staff_qualifications (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  technician_id UUID REFERENCES users(id),
  rating VARCHAR NOT NULL (e.g., 'A&P', 'Powerplant', 'Avionics'),
  scope VARCHAR NOT NULL,       -- Module/system scope
  issued_date DATE,
  expiration_date DATE,
  issuing_authority VARCHAR (e.g., 'FAA', 'EASA'),
  certification_number VARCHAR,
  can_certify_release BOOLEAN,  -- Can sign off on maintenance release
  can_defer BOOLEAN,            -- Can approve deferrals
  created_at TIMESTAMP, updated_at TIMESTAMP
);

-- Work Package Materials & Parts Planning
CREATE TABLE work_package_materials (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  work_package_id UUID REFERENCES work_packages(id),
  component_id UUID REFERENCES components(id),
  action VARCHAR CHECK (action IN ('install', 'remove', 'inspect', 'repair')),
  required_quantity INT,
  allocated_quantity INT,
  status VARCHAR CHECK (status IN ('pending', 'allocated', 'reserved', 'installed', 'deferred')),
  warehouse_location VARCHAR,   -- Location in inventory
  supplier_id UUID,             -- If on order
  supplier_eta TIMESTAMP,
  created_at TIMESTAMP, updated_at TIMESTAMP
);

CREATE INDEX idx_aircraft_tenant ON aircraft(tenant_id);
CREATE INDEX idx_work_packages_tenant_status ON work_packages(tenant_id, status);
CREATE INDEX idx_tasks_work_package ON tasks(work_package_id);
CREATE INDEX idx_components_aircraft ON components(aircraft_id);
CREATE INDEX idx_staff_qualifications_technician ON staff_qualifications(technician_id, expiration_date);
```

**Compliance/Audit Layer (dedicated immutable namespace):**
Separate `mro_audit_*` schema for tamper-evident records.

```sql
-- Immutable Audit Records
CREATE TABLE mro_audit_records (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  record_type VARCHAR (e.g., 'work_package_signed', 'release_authorized', 'override_approved'),
  related_entity_id UUID,       -- work_package_id, task_id, etc.
  related_entity_type VARCHAR,
  actor_id UUID REFERENCES users(id),
  actor_role VARCHAR,
  action VARCHAR,
  context JSONB,               -- Full state snapshot
  signature BYTEA,             -- Cryptographic signature (future)
  previous_hash BYTEA,         -- Chain-of-custody hash (future)
  created_at TIMESTAMP NOT NULL,
  -- NO update_at or update columns (append-only)
  CONSTRAINT audit_immutable CHECK (created_at IS NOT NULL)
);

CREATE TABLE mro_audit_trails (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  event_type VARCHAR (e.g., 'access', 'modification', 'override', 'approval'),
  entity_type VARCHAR,
  entity_id UUID,
  user_id UUID,
  user_email VARCHAR,
  timestamp TIMESTAMP NOT NULL,
  action_description TEXT,
  regulatory_context JSONB,    -- {standard: 'FAA 14 CFR Part 121', reason: '...'}
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_mro_audit_records_entity ON mro_audit_records(related_entity_id, created_at DESC);
CREATE INDEX idx_mro_audit_trails_tenant_timestamp ON mro_audit_trails(tenant_id, created_at DESC);
```

### 2.2 Tenant Isolation & Row-Level Security

- All AMRO tables include `tenant_id` column
- Postgres RLS policies enforce tenant isolation:
  ```sql
  ALTER TABLE work_packages ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON work_packages
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
  ```
- RLS applies to all AMRO tables (aircraft, components, work_packages, tasks, staff_qualifications, audit records)

---

## 3. Phase A MVP: Complete Scope & Phased Delivery

### 3.1 Full Phase A Feature Set (13 Weeks)

**Tier 1: Core Workflows (Weeks 1-8)**

| Requirement | Description | Week | Owner |
|---|---|---|---|
| **FR-AMRO-001** | Create work orders from defects, checks, regulatory sources | 3-4 | Backend |
| **FR-AMRO-002** | Plan labor, materials, downtime; link to staff qualifications | 4-5 | Backend |
| **FR-AMRO-003** | Schedule work packages with bay/slot constraints, shift availability | 6-8 | Backend (Optimization) |
| **FR-AMRO-004** | Execute digital task cards with step-by-step guidance, e-signatures, evidence | 4-6 | Mobile + Backend |
| **FR-AMRO-005** | Enforce closure gate: parts reconciliation, deferred-item checks, release readiness | 5-6 | Backend |
| **FR-AMRO-011** | Support encrypted offline execution cache (30 days) with signed local events | 5-8 | Mobile + Backend |
| **FR-AMRO-012** | Resolve offline conflicts deterministically using certifying authority hierarchy + timestamps | 7-8 | Backend |
| **FR-AMRO-018** | Enforce certifying staff privilege checks (rating, scope, currency) | 4-5 | Backend |
| **FR-AMRO-019** | Maintain serialized component traceability (install/remove, LLP, time-controlled parts) | 3-4 | Backend |
| **FR-AMRO-020** | Separate line and base maintenance templates and quality gates | 5-6 | Backend |
| **FR-AMRO-026** | Persist immutable maintenance records with append-only audit chain | 3-4 | Backend |

**Tier 2: Regulatory & Compliance (Weeks 6-10)**

| Requirement | Description | Week | Owner |
|---|---|---|---|
| **FR-AMRO-016** | Support AD/SB ingestion, applicability evaluation, compliance closure evidence | 6-8 | Backend |
| **FR-AMRO-017** | Apply MEL/CDL dispatch constraints and controlled deferral rules | 7-9 | Backend |
| **NFR-AMRO-004** | Enforce OWASP Top-10, SOC-2 Type II controls, AES-256 encryption | 1-13 | Security |
| **NFR-AMRO-005** | Implement RBAC + ABAC authorization (contextual aviation operations) | 2-5 | Backend |
| **NFR-AMRO-006** | Implement OpenTelemetry tracing, 60-day retention, anomaly alerts | 3-13 | DevOps |
| **NFR-AMRO-007** | Provide jurisdiction-aware compliance controls (FAA/EASA/ICAO contexts) | 8-10 | Backend |
| **NFR-AMRO-008** | Enforce dual-control for safety-critical override actions | 5-7 | Backend |
| **NFR-AMRO-009** | Maintain immutable audit record retention for 10 years + replay capability | 3-13 | Backend + DevOps |

**Tier 3: Performance, Scale, & Integration (Weeks 7-13)**

| Requirement | Description | Week | Owner |
|---|---|---|---|
| **NFR-AMRO-001** | Support 10,000 concurrent users, 5,000 TPS, p99 latency ≤ 1s | 7-12 | DevOps/SRE |
| **NFR-AMRO-002** | Autoscale from 10 to 500 nodes within 3 minutes | 9-12 | DevOps/SRE |
| **NFR-AMRO-003** | Ensure 99.99% availability, RPO ≤ 1 min, RTO ≤ 5 min | 8-12 | DevOps/SRE |
| **IR-AMRO-001** | Version REST/GraphQL APIs with SemVer, maintain N, N-1, N-2 compatibility | 3-13 | Backend |
| **IR-AMRO-002** | Use Kafka/MQTT choreography with idempotent consumers | 2-5 | Backend |
| **IR-AMRO-003** | Provide adapter pattern for SAP PM, IBM Maximo, Oracle EAM | 10-13 | Integration Architect |
| **IR-AMRO-004** | Support ATA Spec 100 legacy / iSpec 2200 import/export mappings | 10-13 | Integration |

### 3.2 Timeline Roadmap

```
Week 1-2:   M0 - Foundation
├─ Schema setup (hybrid operational + audit)
├─ API scaffolding, CI/CD pipeline
├─ Event bus and mobile framework
└─ Exit Criteria: Core data model validated, pipelines working

Week 3-6:   M1a - Core Workflows
├─ Work order CRUD + status flow
├─ Planning engine (labor + materials)
├─ Task execution with e-signatures
├─ Component traceability
├─ Offline sync foundation
└─ Exit Criteria: End-to-end workflow functional

Week 6-8:   M1b - Compliance & Scheduling
├─ Certifying staff matrix enforcement
├─ Immutable audit records
├─ Constrained scheduling engine
├─ AD/SB workflow
├─ MEL/CDL dispatch rules
└─ Exit Criteria: Regulatory controls tested, scheduling optimized

Week 7-10:  M2 - Performance & Resilience
├─ Load testing (10K users, 5K TPS)
├─ Autoscaling setup
├─ Disaster recovery setup
├─ Offline conflict resolution
├─ Observability + alerting
└─ Exit Criteria: 99.99% HA achieved, DR RTO < 5 min

Week 10-12: M3 - Integration & Hardening
├─ SAP/Maximo/Oracle adapters
├─ Compliance-as-code policy framework
├─ Mobile optimization
├─ Security audit
└─ Exit Criteria: APIs stable, external integrations tested

Week 12-13: Testing & Release Prep
├─ Full regression suite
├─ Aviation scenario tests
├─ Compliance validation
├─ Operations runbooks
└─ Exit Criteria: 90%+ tests pass, zero critical failures, ready for early customers
```

### 3.3 Competitive Differentiation

**vs. AMOS:**
- ✅ Modern UX + mobile-first (AMOS legacy)
- ✅ Logistics integration (AMOS EAM-focused)
- ⚠️ Compliance depth comparable

**vs. Maintenix:**
- ✅ Cloud-native from day 1 (Maintenix heavy)
- ✅ Mobile offline execution (Maintenix connectivity-dependent)
- ✅ Parts visibility + ETA (Maintenix planning-focused)

**vs. Ramco:**
- ✅ Logistics integration (Ramco flight-focused)
- ✅ Compliance-as-code (Ramco hardcoded)
- ⚠️ Mobile execution comparable

**Nexus-AI Unique:**
- ✅ **Integrated supply chain** — Work order triggers parts reservation, shows supplier ETA, suggests alternatives
- ✅ **Offline-first mobile** — Full task execution offline; deterministic conflict resolution on sync
- ✅ **Compliance-as-code** — Rules in JSON/YAML; audit teams update without engineer help
- ✅ **Event-driven integration** — ERP, legacy systems, external feeds all consume/produce events

---

## 4. Risk Assessment & Mitigation

### 4.1 Critical Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| **Offline conflict resolution complexity** | Medium | High | Prototype week 1-2; use Lamport clocks + event timestamps; if too complex, defer full offline to Phase B (ship online-first) |
| **Scheduling optimization performance** | Medium | High | Use CPLEX or OR-Tools library; test with 1000+ aircraft; have greedy fallback if optimization too slow |
| **AD/SB feed integration delays** | Medium | Medium | Mock FAA feed in week 5; real feed optional for pilot (Phase B hardening) |
| **Performance bottleneck under load** | Medium | High | Load test weekly starting week 7; have caching strategy (Redis, CDN) ready |
| **Regulatory approval timeline** | Low | Critical | Start compliance documentation week 1; engage legal/compliance early (week 4) |
| **Resource unavailability** | Low | High | Keep 10% schedule buffer; cross-train team members |

### 4.2 Contingency Actions

**If any critical gap slips (by week 10):**
1. Defer **FR-AMRO-028 (AR-assisted procedures)** to Phase B
2. Defer **advanced analytics** to Phase B
3. Reduce **MEL/CDL complexity** to basic constraint checks (full logic in Phase B)
4. Ship **constrained scheduling as greedy heuristic** (full optimization in Phase B)

---

## 5. Success Criteria & Acceptance

### 5.1 Pilot Exit Criteria (Week 13)

**Functional:**
- ✅ Technician can create, plan, execute, and close a maintenance work order end-to-end
- ✅ Task execution with e-signature and evidence capture works on mobile (online and offline)
- ✅ Component traceability shows install/remove history and LLP status
- ✅ Certifying staff checks enforce role/scope correctly
- ✅ Audit trail captures all sign-offs and overrides
- ✅ Scheduling algorithm produces bay/slot assignments without conflicts

**Compliance:**
- ✅ Immutable records pass tamper-evident test (no updates possible)
- ✅ Offline sync resolves conflicts without data loss or duplicate side effects
- ✅ AD/SB workflows capture applicability and compliance evidence
- ✅ MEL/CDL rules enforce dispatch constraints (with auditable deferrals)

**Performance:**
- ✅ p99 latency ≤ 1s under 10K concurrent users, 5K TPS
- ✅ Autoscaling from 10 to 500 nodes completes in < 3 minutes
- ✅ 99.99% uptime SLO met during 4-week pilot run
- ✅ DR failover completes in < 5 minutes (automated)

**Quality:**
- ✅ ≥ 90% test pass rate (unit + integration + compliance scenarios)
- ✅ Zero critical security findings (OWASP Top-10 validated)
- ✅ Zero critical compliance failures (audit trail, role enforcement validated)

**Integration:**
- ✅ REST/GraphQL APIs versioned and backward-compatible
- ✅ Kafka event stream producing work-order events with deduplication
- ✅ SAP/Maximo adapter stub in place (full implementation Phase B)

---

## 6. Resource Plan

### 6.1 Team Structure (13 weeks)

**Backend Team (2 engineers + 1 architect):**
- Week 1-2: Schema design, API scaffolding, event setup
- Week 3-8: Core workflows (work order, planning, execution, offline sync)
- Week 6-10: Regulatory workflows (AD/SB, MEL/CDL, scheduling)
- Week 10-13: Integration, hardening, testing

**Mobile Team (1 engineer):**
- Week 1-2: Mobile framework setup, offline storage design
- Week 3-8: Task card UI, e-signature integration, evidence capture
- Week 5-9: Offline sync, conflict resolution
- Week 10-13: Mobile optimization, responsive design

**DevOps/SRE Team (1 SRE + 1 QA):**
- Week 1-2: CI/CD pipeline, test scaffolding
- Week 3-8: Infrastructure setup, monitoring, alerting
- Week 7-12: Load testing, autoscaling, DR runbooks
- Week 10-13: Security audit, compliance verification

**Blended Cost Estimate:**
- 4.5 FTE × 40 hrs/week × 13 weeks × $150/hr blended = **~$351K all-in**

---

## 7. Next Steps

1. **Approval & Stakeholder Sign-Off** — This design requires approval from:
   - Engineering Lead (architecture + integration)
   - Product Owner (scope + timeline)
   - Compliance Officer (regulatory coverage)
   - Operations Lead (infrastructure + support)

2. **Detailed Implementation Plan** — Create sprint-level breakdown with:
   - API contract definitions
   - Data migration strategy
   - Testing matrix (unit + integration + compliance scenarios)
   - Feature flag rollout plan

3. **Repository & Tooling Setup** — Prepare:
   - Git branch/worktree for AMRO development
   - CI/CD pipeline for AMRO services
   - Test environment setup (staging with realistic data)

4. **Kick-Off & Team Mobilization** — Schedule:
   - Architecture review (Week 0)
   - Team onboarding (Week 1)
   - Sprint planning (Week 1-2)

---

## Document Control

| Version | Date | Author | Status |
|---|---|---|---|
| 1.0.0 | 2026-03-19 | AI-Assisted Brainstorm | Approved for Implementation |

**Sign-Off:**
- [ ] Engineering Lead
- [ ] Product Owner
- [ ] Compliance Officer
- [ ] Operations Lead
