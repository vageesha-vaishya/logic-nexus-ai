# Testing Strategy & Quality Assurance Plan

## 1. Overview
This document outlines the testing strategy for the upgraded Logic Nexus AI platform. Given the complexity of logistics operations (financials, customs compliance, multi-party workflows), a rigorous multi-layer testing approach is required.

## 2. Testing Layers

### 2.1 Unit Testing (Vitest)
*   Scope: functions, calculations, transformations, validators
*   Coverage:
    *   Volumetric Weight (Air 1:6000; Road 1:3000)
    *   Currency conversion and ROE locking
    *   AWB Mod-7 validation; container check digit
    *   Profit = Revenue − Cost; multi-currency totals

### 2.2 Integration Testing
*   Scope: module interactions (Shipment ↔ Financials ↔ Documents)
*   Scenarios:
    *   Job Costing: adding charges updates profit cache
    *   Consolidation: House ↔ Master linkage updates manifest
    *   Documents: PDF generation returns URL and persists metadata
    *   Tracking: webhook updates status/milestones

### 2.3 End-to-End (E2E) Testing (Playwright)
*   Scope: full journeys across roles and tenants
*   Critical Flows:
    1.  **Ocean Export Flow**:
        *   Login as Operator
        *   Booking → Container → Cargo → HBL
        *   Add charges; verify profit margin
    2.  **Air Import Flow**:
        *   Create MAWB; console HAWB
        *   Arrival Notice generation
    3.  **Finance Flow**:
        *   Approve Invoice; status updates to Billed
    4.  **Trucking Dispatch & POD**:
        *   Assign driver/vehicle; record POD with geotag

### 2.4 Performance Testing (k6 / Lighthouse)
*   Load: 1k virtual users; 10k requests/min sustained
*   Benchmarks:
    *   Shipment Save p95 < 500ms
    *   Document Gen p95 < 3s
    *   Search p95 < 200ms
*   Tenant isolation tests: noisy-neighbor scenarios with per-tenant rate limits

## 3. Test Data Strategy
*   Seeding: populate:
    *   Master Data (Ports, Currencies, Charge Codes).
    *   Dummy Tenants and Franchises.
*   Isolation: per-run tenant; cleanup via teardown; randomized seeds

## 4. Automation Pipeline (CI/CD)
*   Trigger: every PR; nightly full suite
*   Steps:
    1.  Lint & Type Check
    2.  Unit tests (100% passing required)
    3.  E2E smoke (critical flows)
    4.  k6 performance baseline; Lighthouse CI

## 5. User Acceptance Testing (UAT)
*   Process:
    *   Deploy to staging
    *   Franchise participants execute role-based scripts (Operator, Sales, Accounts)
    *   Capture findings; triage; fix; sign-off

## 6. Security Testing Protocols
- RLS verification tests: ensure cross-tenant access is blocked
- Field-level access tests: cost visibility restricted
- Webhook auth tests: HMAC signatures validated; replay protection
- Vulnerability scans: dependencies; edge functions; CSP and CORS checks
