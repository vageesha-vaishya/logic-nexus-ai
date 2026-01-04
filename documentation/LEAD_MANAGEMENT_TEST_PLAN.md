# Lead Management and Activities Module - Test Plan

**Version:** 1.0
**Date:** 2026-01-04
**Status:** Draft

## 1. Scope

This test plan covers the end-to-end validation of the Lead Management and Activities module within the SOS Logistics Pro application. The scope includes functional workflows, integration points, and multi-tenant security requirements.

### 1.1 In-Scope Features
*   **Lead Lifecycle Management**:
    *   Lead Creation (Manual Entry, API/Webhook).
    *   Lead Assignment (Manual, Automated Rules).
    *   Lead Tracking (Status updates, Kanban board movement).
    *   Lead Qualification and Scoring (Behavioral, Demographic, Logistics-specific).
    *   Lead Conversion (To Account/Contact/Opportunity).
*   **Activities Management**:
    *   Activity Creation (Calls, Emails, Meetings, Notes).
    *   Activity Timeline (Chronological view of history).
    *   Automated Activity Logging (System events).
    *   Task Management (Reminders, Follow-ups).
*   **Integration Points**:
    *   **CRM**: Account and Contact creation during conversion.
    *   **Sales**: Opportunity generation and value transfer.
    *   **Security**: Role-based access control (RBAC) and Row Level Security (RLS).

### 1.2 Out-of-Scope
*   Third-party email server configuration (mocked for testing).
*   Legacy data migration verification (covered in separate plan).

## 2. Testing Approach

We will employ a multi-layered testing strategy to ensure robustness and scalability.

### 2.1 Testing Levels
1.  **Unit Testing (Jest)**:
    *   Validate utility functions (e.g., scoring algorithms, date formatting).
    *   Test isolated UI components (e.g., `LeadScoringCard`, `ActivityComposer`).
2.  **Integration Testing**:
    *   Verify interaction between components (e.g., `LeadConversionDialog` calling `supabase.rpc`).
    *   Validate API responses and error handling.
3.  **End-to-End (E2E) Testing (Playwright)**:
    *   Simulate real user journeys across the full stack.
    *   Validate critical business flows in a browser environment.
4.  **User Acceptance Testing (UAT)**:
    *   Franchisee-specific workflow validation by business stakeholders.

### 2.2 SAAS & Multi-Tenancy Strategy
*   **Tenant Isolation**: Every test case must verify that data is strictly scoped to the `tenant_id`.
*   **Franchisee Rules**: Verify that `franchise_id` scoping works within a tenant hierarchy.
*   **Role Validation**: Test as Admin, Manager, and Sales Rep to ensure permission enforcement.

## 3. Test Environment Requirements

### 3.1 Environments
*   **Local/Dev**: Developers' local machines with mocked Supabase services.
*   **Staging**: A production-mirror environment with:
    *   Separate Supabase project.
    *   Seeded test data for multiple tenants (Tenant A, Tenant B).
    *   configured CI/CD pipelines.
*   **Performance**: Scaled environment for load testing (optional for initial phase).

### 3.2 Test Data
*   **Tenants**: Minimum 2 active tenants to verify isolation.
*   **Users**: Admin, Manager, Standard User for each tenant.
*   **Leads**: Mix of fresh leads, qualified leads, and converted leads.
*   **Activities**: Large dataset of history to test timeline pagination/performance.

## 4. Test Case Design Guidelines

### 4.1 Prioritization
*   **P0 (Critical)**: Blockers. Lead Creation, Conversion, Security Breaches.
*   **P1 (High)**: Core Functionality. Activity Logging, Scoring Updates, Assignment.
*   **P2 (Medium)**: UX Improvements. Sorting, Filtering, Search.
*   **P3 (Low)**: Cosmetic issues.

### 4.2 Sample Test Scenarios

#### Functional - Lead Management
| ID | Scenario | Preconditions | Expected Result | Priority |
|----|----------|---------------|-----------------|----------|
| TC-LM-001 | Create new lead manually | User logged in | Lead appears in list and dashboard | P0 |
| TC-LM-002 | Convert Lead to Opportunity | Lead Status = Qualified | Account, Contact, Opp created; Lead status = Converted | P0 |
| TC-LM-003 | View Lead Details | Lead exists | Score card, Details, and Timeline visible | P1 |

#### Functional - Activities
| ID | Scenario | Preconditions | Expected Result | Priority |
|----|----------|---------------|-----------------|----------|
| TC-ACT-001 | Add Call Log | Lead Detail Open | Activity appears in Timeline immediately | P1 |
| TC-ACT-002 | Automated Score Update | Lead exists | Action triggers score recalculation | P1 |

#### Security & Multi-Tenancy
| ID | Scenario | Preconditions | Expected Result | Priority |
|----|----------|---------------|-----------------|----------|
| TC-SEC-001 | Cross-tenant Access | User A (Tenant 1) | Cannot access User B (Tenant 2) Lead ID | P0 |
| TC-SEC-002 | Franchisee Isolation | Franchise User | Cannot see leads from sibling franchise | P0 |

## 5. Execution Plan

### 5.1 Test Cycles
1.  **Smoke Testing**: Automated suite running on every PR. Covers P0 flows.
2.  **Regression Testing**: Full E2E suite running nightly on Staging.
3.  **Cross-Browser**: Weekly run on Chromium, Firefox, WebKit.

### 5.2 Compatibility
*   **Browsers**: Chrome (latest), Firefox (latest), Safari (latest).
*   **Devices**: Desktop (1920x1080), Tablet (iPad Air), Mobile (iPhone 14 - responsive check).

## 6. Deliverables

*   **Test Plan Document**: This file.
*   **Automated Test Suite**: Playwright scripts in `tests/e2e/`.
*   **Execution Reports**: HTML reports generated by Playwright (available in GitHub Actions artifacts).
*   **Defect Log**: GitHub Issues tagged with `bug` and `module:leads`.
*   **Coverage Report**: Code coverage metrics (target >80%).

## 7. Start Testing (Phased Approach)

### Phase 1: Smoke Testing (Current Status: In Progress)
*   [x] Validate Environment Setup (Playwright + Supabase mocks).
*   [x] TC-LM-001: Lead List Loading.
*   [ ] TC-LM-003: Lead Detail View (Fixing visibility issues).

### Phase 2: Functional Testing
*   [ ] Implement Activity Creation tests.
*   [ ] Implement Lead Conversion tests (Mocking RPC calls).
*   [ ] Verify Lead Scoring logic via UI indicators.

### Phase 3: Integration & Security
*   [ ] Multi-tenant data isolation verification.
*   [ ] Role-based access checks (View vs Edit permissions).

## 8. Quality Gates

*   **Entry Criteria**: Code deployed to Staging, Smoke tests pass.
*   **Exit Criteria**:
    *   100% execution of P0/P1 test cases.
    *   Pass rate > 95%.
    *   No critical (P0) open defects.
    *   Code coverage > 80%.

---
**Note**: This document is version-controlled. Updates must be reviewed via Pull Request.
