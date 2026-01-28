# SOS-Nexus Master Implementation Plan

## 1. Executive Summary & Strategic Alignment

### 1.1 Strategic Vision
This document serves as the definitive blueprint for transforming **SOS Logistics Pro** (a vertical logistics monolith) into **SOS-Nexus** (a multi-tenant, domain-agnostic Enterprise PaaS). As outlined in the [Strategic Document](01_Strategic_Document.md), the goal is to decouple core business logic from domain-specific implementation, enabling rapid expansion into new verticals (Banking, Telecom) while maintaining the stability of the existing logistics business.

### 1.2 Alignment with Business Objectives
*   **Market Expansion:** The re-architecture enables the platform to host non-logistics tenants by Q3, unlocking revenue streams in FinTech and Telecom.
*   **Operational Efficiency:** Transitioning to a "Micro-kernel" architecture reduces code redundancy by a target of 75% [01_Strategic_Document.md].
*   **Financial Compliance:** The integration of a centralized **Taxation & Financials Module** ensures global compliance (VAT, GST, Sales Tax) and automated GL reconciliation.

---

## 2. Detailed Requirements Matrix

This matrix traces requirements from source documents to implementation tasks.

| ID | Category | Requirement Description | Source Document | Implementation Phase |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-CORE-001** | Architecture | Decouple Core Kernel from Domain Plugins (Logistics, Banking). | [01_Strategic_Document.md](01_Strategic_Document.md) | Phase 2 |
| **REQ-CORE-002** | Multi-Tenancy | Implement strict data isolation via RLS and Tenant ID injection. | [03_High_Level_Design.md](03_High_Level_Design.md) | Phase 1 |
| **REQ-DB-001** | Schema | Split `quote_items` into `core` (shared) and `extension` (domain-specific) tables. | [08_Impact_Analysis.md](08_Impact_Analysis.md) | Phase 0 |
| **REQ-DB-002** | Schema | Create `quote_items_view` to maintain backward compatibility for legacy queries. | [08_Impact_Analysis.md](08_Impact_Analysis.md) | Phase 0 |
| **REQ-TAX-001** | Taxation | Automated Nexus determination based on Origin/Destination. | [04_Taxation_User_Guide.md](04_Taxation_User_Guide.md) | Phase 2.5 |
| **REQ-TAX-002** | Taxation | Support for Tax Exemption Certificates (Upload & Validation). | [04_Taxation_User_Guide.md](04_Taxation_User_Guide.md) | Phase 2.5 |
| **REQ-TAX-003** | Taxation | Real-time tax calculation API (< 200ms latency). | [02_Gap_Analysis.md](02_Gap_Analysis.md) | Phase 2.5 |
| **REQ-FIN-001** | Billing | Pluggable billing engine supporting domain-specific invoice formats. | [02_Gap_Analysis.md](02_Gap_Analysis.md) | Phase 2.5 |
| **REQ-FIN-002** | GL Sync | Async posting of Journal Entries to General Ledger. | [04_Low_Level_Design.md](04_Low_Level_Design.md) | Phase 2.5 |
| **REQ-UI-001** | Frontend | Dynamic Form Renderer based on Tenant Configuration. | [08_Impact_Analysis.md](08_Impact_Analysis.md) | Phase 3 |
| **REQ-SEC-001** | Security | Domain-Scoped RLS (prevent Banking tenant from seeing Logistics data). | [08_Impact_Analysis.md](08_Impact_Analysis.md) | Phase 1 |

---

## 3. Architectural & Design Implementation

### 3.1 Micro-kernel Architecture
Based on [03_High_Level_Design.md](03_High_Level_Design.md), the system will use a **Strategy Pattern** for domain logic.
*   **Core Kernel:** Manages Authentication, Tenant Resolution, and Request Routing.
*   **Domain Plugins:** Implemented as distinct modules (initially shared libraries, evolving to microservices).
    *   `LogisticsPlugin`: Implements `IQuotationEngine` for freight logic.
    *   `BankingPlugin`: Implements `IQuotationEngine` for loan logic.

### 3.2 Database Schema Design
Based on [04_Low_Level_Design.md](04_Low_Level_Design.md) and [08_Impact_Analysis.md](08_Impact_Analysis.md):
*   **Table Inheritance Pattern:**
    *   **Core Table:** `public.quote_items` (ID, Amount, Description).
    *   **Extension Table:** `logistics.quote_items_extension` (Weight, Volume, CargoType).
*   **Views:** `public.quote_items_view` joins Core + Extension to mimic the legacy schema structure for the existing API.

### 3.3 API Contracts
*   **Tax Calculation:** `POST /api/v1/tax/calculate` (Stateless, RFC-compliant).
*   **Invoice Finalization:** `POST /api/v1/invoices/{id}/finalize` (Transactional, Idempotent).

---

## 4. Phased Implementation Roadmap

### Phase 0: Stabilization & Preparation (Weeks 1-2)
*Goal: Prepare for split without breaking "SOS Logistics Pro".*
*   **Task 0.1:** Create `quote_items_view` and `quote_legs_view` matching legacy schema [08_Impact_Analysis.md].
*   **Task 0.2:** Refactor `src/lib/supabase-client.ts` to query Views instead of Tables.
*   **Task 0.3:** Implement `make_schema_idempotent.cjs` for all 9 migration scripts.
*   **Task 0.4:** Verify full regression suite pass for Logistics flows.

### Phase 1: Foundation (Weeks 3-6)
*Goal: Multi-tenant Infrastructure.*
*   **Task 1.1:** Initialize Monorepo (Nx/Turborepo).
*   **Task 1.2:** Implement `tenants` table with `domain_type` enum.
*   **Task 1.3:** Implement RLS policies using `auth.uid()` and `tenant_id`.
*   **Task 1.4:** Set up CI/CD with automated linting and unit tests.

### Phase 2: Core Module Development (Weeks 5-10)
*Goal: Domain-Agnostic Engines.*
*   **Task 2.1:** Define `IQuotationEngine` interface [04_Low_Level_Design.md].
*   **Task 2.2:** Implement `CoreQuoteService` that delegates to plugins.
*   **Task 2.3:** Create "Mock" adapters for Banking and Telecom.

### Phase 2.5: Taxation & Financials (Weeks 8-14)
*Goal: Financial Backbone [04_Taxation_User_Guide.md].*
*   **Task 2.5.1:** Implement `TaxJurisdiction` and `TaxRule` tables.
*   **Task 2.5.2:** Build Nexus Determination Logic (Origin vs. Destination).
*   **Task 2.5.3:** Implement `TaxEngine.calculateTax()` with sub-200ms latency.
*   **Task 2.5.4:** Build Invoice Finalization Workflow (Draft -> Posted).
*   **Task 2.5.5:** Implement Async GL Poster (RabbitMQ/PgQueues).

### Phase 3: Plugin SDK & Logistics Migration (Weeks 11-16)
*Goal: Migrate Logistics to Plugin Architecture.*
*   **Task 3.1:** Extract Logistics logic from `crm` components into `LogisticsPlugin`.
*   **Task 3.2:** Implement Dynamic Form Renderer for `QuoteForm`.
*   **Task 3.3:** Migrate data from `public.quote_items` to `logistics.quote_items_extension`.

### Phase 4: New Verticals (Weeks 17-22)
*Goal: Prove Agnostic Capability.*
*   **Task 4.1:** Implement `BankingPlugin` (Loan Origination).
*   **Task 4.2:** Implement `TelecomPlugin` (Subscription Billing).

---

## 5. Backward Compatibility & Enhancement Strategy

### 5.1 View-First Strategy
To ensure zero downtime and no breaking changes for the existing Logistics app:
*   **Mechanism:** The application will **never** query the physical `quote_items` table directly. It will query `quote_items_view`.
*   **Transition:**
    1.  Rename `quote_items` -> `quote_items_legacy`.
    2.  Create new `quote_items` (Core) and `quote_items_logistics` (Extension).
    3.  Create `quote_items_view` that joins them.
    4.  Run ETL to move data.
    5.  Application continues running unaware of the split.

### 5.2 API Versioning
*   **Legacy API:** `/rest/v1/...` (Supabase auto-generated) remains active for legacy clients.
*   **New API:** `/api/v2/...` (Edge Functions) introduces the new domain-agnostic contracts.

---

## 6. Risk Mitigation & Impact Management

Derived from [08_Impact_Analysis.md](08_Impact_Analysis.md):

| Risk ID | Risk Description | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **R-01** | **Breaking Logistics UI** due to schema changes. | Critical | **View-First Strategy:** Use database views to mask physical schema changes from the frontend. |
| **R-02** | **Tax Engine Latency** slowing down checkout. | High | **Async Calculation:** Debounce tax calls; use optimistic UI updates; cache rules in Redis. |
| **R-03** | **Data Leakage** between tenants (Banking seeing Logistics). | Critical | **Domain-Scoped RLS:** Policies must check `tenant.domain_type` in addition to `tenant_id`. |
| **R-04** | **Schema Drift** in dev vs. prod. | Medium | **Idempotent Migrations:** Strict enforcement of `make_schema_idempotent.cjs` workflow. |

---

## 7. Testing & Validation Strategy

### 7.1 Testing Layers
*   **Unit Tests:** Jest/Vitest for `TaxEngine` logic (Mock dependencies). Coverage target: >90%.
*   **Integration Tests:** Verify `LogisticsPlugin` correctly implements `IQuotationEngine`.
*   **Regression Tests:** Run the **existing Logistics Pro Test Suite** against the new Phase 0 Views to ensure 100% pass rate.
*   **Performance Tests:** k6 load testing for Tax Calculation API (Target: 1000 RPS < 200ms).

### 7.2 UAT
*   **Logistics UAT:** Verify "Create Quote" -> "Invoice" flow remains unchanged.
*   **Finance UAT:** Verify Tax Breakdown matches Avalara/Govt calculator results.

---

## 8. Deployment & Rollout Plan

### 8.1 Deployment Strategy
*   **Blue/Green Deployment:**
    *   **Blue:** Current Monolith (Direct Table Access).
    *   **Green:** New Architecture (View Access).
*   **Switchover:** DNS flip after Green passes health checks.

### 8.2 Rollout Phases
*   **Week 27:** **Canary Release** (Internal Users only).
*   **Week 28:** **Logistics Migration** (Existing tenants moved to new schema).
*   **Week 30:** **Banking Beta** (First non-logistics tenant onboarding).

### 8.3 Rollback Plan
*   **Database:** Point `quote_items_view` back to `quote_items_legacy` table if split fails.
*   **Code:** Revert to previous Docker image tag.

---

## 9. Success Metrics & KPIs

### 9.1 Strategic KPIs [01_Strategic_Document.md]
*   **Code Reuse:** > 75% of Core Kernel code shared across domains.
*   **Onboarding Speed:** < 6 weeks to launch a new vertical.
*   **Revenue:** > 10% ARR from non-logistics verticals in Year 1.

### 9.2 Operational Metrics
*   **System Uptime:** 99.9% SLA.
*   **Tax Accuracy:** 100% reconciliation with GL.
*   **Performance:** p95 latency < 200ms for Quote Calculation.
