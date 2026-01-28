# SOS-Nexus Requirements Analysis & Specifications

## 1. Project Overview & Scope

### 1.1 Purpose
This document defines the comprehensive requirements for the **SOS-Nexus** transformation, derived from the [Implementation Plan](06_Implementation_Plan.md). The primary objective is to evolve the existing single-tenant **SOS Logistics Pro** application into a multi-tenant, domain-agnostic Enterprise PaaS capable of serving Logistics, Banking, and Telecom verticals.

### 1.2 Strategic Goals
*   **Code Reuse:** Achieve >75% shared code across domains (Micro-kernel architecture).
*   **Time-to-Market:** Enable new vertical launch in <6 weeks.
*   **Stability:** Zero regression for existing Logistics tenants during transition.

---

## 2. Functional Requirements

### 2.1 Core Platform & Multi-Tenancy (Phase 1)
*   **FR-CORE-001 (Tenant Identification):** The system MUST identify tenants via a unique `tenant_id` and classify them by `domain_type` (e.g., `LOGISTICS`, `BANKING`).
*   **FR-CORE-002 (Request Routing):** The API Gateway MUST route requests to the appropriate Domain Plugin based on the authenticated user's `tenant_id`.
*   **FR-CORE-003 (Data Isolation):** The system MUST enforce strict logical isolation using Row Level Security (RLS). Users from Tenant A must NEVER access data from Tenant B.
    *   *Constraint:* RLS policies must utilize `auth.uid()` and join against the `tenants` table.

### 2.2 Database Architecture (Phase 0)
*   **FR-DB-001 (Schema Decoupling):** The `quote_items` table MUST be split into:
    *   **Core Table:** `public.quote_items` (Common fields: ID, Amount, Description).
    *   **Extension Table:** `logistics.quote_items_extension` (Domain fields: Weight, Volume, CargoType).
*   **FR-DB-002 (Backward Compatibility):** The system MUST provide a `quote_items_view` that joins Core and Extension tables to present a unified schema identical to the legacy table.
    *   *Constraint:* Existing application code MUST query this View, not the tables directly.
*   **FR-DB-003 (Idempotency):** All database migration scripts MUST be idempotent (re-runnable without error).
    *   *Constraint:* Scripts must use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, or `DROP ... IF EXISTS` patterns.

### 2.3 Quotation Engine (Phase 2)
*   **FR-QUOTE-001 (Interface Definition):** The system MUST define a generic `IQuotationEngine` interface supporting:
    *   `calculateQuote(context: QuoteContext): QuoteResult`
    *   `validateRequirements(context: QuoteContext): ValidationResult`
*   **FR-QUOTE-002 (Plugin Strategy):** The system MUST implement the Strategy Pattern to inject the correct engine at runtime:
    *   `LogisticsPlugin`: Calculates freight rates based on weight/volume.
    *   `BankingPlugin`: Calculates interest rates based on credit score/principal.

### 2.4 Taxation & Financials (Phase 2.5)
*   **FR-TAX-001 (Nexus Determination):** The system MUST automatically determine tax nexus based on:
    *   **Origin Address:** Where the service/good originates.
    *   **Destination Address:** Where the service/good is consumed.
*   **FR-TAX-002 (Real-Time Calculation):** The Tax Engine MUST return calculated tax breakdowns within **200ms**.
*   **FR-TAX-003 (Invoice Finalization):** The system MUST support a transactional workflow to convert "Draft" invoices to "Posted" (immutable) status.
*   **FR-TAX-004 (GL Synchronization):** The system MUST asynchronously post finalized financial transactions to the General Ledger.

### 2.5 User Interface (Phase 3)
*   **FR-UI-001 (Dynamic Forms):** The frontend MUST render forms dynamically based on the tenant's configuration (JSON Schema).
    *   *Example:* Render "Weight" field for Logistics, "Interest Rate" field for Banking.

---

## 3. Non-Functional Requirements (NFRs)

### 3.1 Performance
*   **NFR-PERF-001:** Tax calculation API latency MUST be < 200ms (p95).
*   **NFR-PERF-002:** The system MUST support 1,000 requests per second (RPS) for the Quotation Engine.

### 3.2 Security
*   **NFR-SEC-001 (Domain Scoping):** RLS policies MUST prevent Cross-Domain access (e.g., a Banking tenant accessing Logistics extension tables).
*   **NFR-SEC-002 (Least Privilege):** Database roles MUST be restricted; application users cannot execute DDL commands.

### 3.3 Maintainability
*   **NFR-MAINT-001 (Monorepo):** The codebase MUST be organized as a Monorepo (Nx/Turborepo) to share libraries between Core and Plugins.
*   **NFR-MAINT-002 (Migration Safety):** All schema changes MUST be scriptable and verifiable via the `make_schema_idempotent.cjs` utility.

### 3.4 Reliability
*   **NFR-REL-001 (View Stability):** The `quote_items_view` MUST maintain the exact column signature of the legacy table to prevent frontend crashes.

---

## 4. Technical Constraints & Architecture

### 4.1 Technology Stack
*   **Backend:** Node.js / TypeScript (Edge Functions).
*   **Database:** PostgreSQL (Supabase) with RLS.
*   **Frontend:** React (Vite) with Dynamic Form rendering.
*   **Infrastructure:** Docker containers for local dev, Supabase Cloud for production.

### 4.2 Architectural Patterns
*   **Micro-kernel:** Core system provides minimal services (Auth, Routing); logic resides in Plugins.
*   **Extension Tables:** Use 1:1 relationships for domain data extension to keep the core schema clean.
*   **Async Processing:** Use Message Queues (pg-boss or similar) for GL posting and heavy calculations.

---

## 5. Acceptance Criteria

### 5.1 Phase 0: Stabilization
*   [ ] `quote_items_view` exists and returns data identical to the legacy table.
*   [ ] All 9 migration scripts run successfully on a fresh database without errors.
*   [ ] Existing Logistics UI creates quotes and invoices without any code changes.

### 5.2 Phase 1: Foundation
*   [ ] RLS prevents User A (Tenant X) from reading User B (Tenant Y) data.
*   [ ] `tenants` table is populated with at least one `LOGISTICS` tenant.

### 5.3 Phase 2: Core Engine
*   [ ] `IQuotationEngine` interface is defined in TypeScript.
*   [ ] Unit tests for `CoreQuoteService` pass with mocked plugins.

### 5.4 Phase 2.5: Taxation
*   [ ] Tax calculation returns correct rates for Cross-State (US) and Cross-Border (EU) scenarios.
*   [ ] GL Entries are created within 5 seconds of Invoice Finalization.

---

## 6. Risk Register (Derived from Impact Analysis)

| Risk | Impact | Mitigation Requirement |
| :--- | :--- | :--- |
| **Breaking Legacy UI** | Critical | **FR-DB-002:** Strict adherence to View-First strategy. |
| **Tax Latency** | High | **FR-TAX-002:** Performance budget of 200ms; implementation of caching. |
| **Data Leakage** | Critical | **FR-CORE-003:** Comprehensive RLS policy testing suite. |
