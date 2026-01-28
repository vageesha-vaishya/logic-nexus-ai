# Comprehensive Testing Strategy

## 1. Unit Testing Strategy
*   **Objective:** Verify individual components in isolation.
*   **Target Coverage:** >90% line and branch coverage for Core Interfaces and Domain Plugins.
*   **Tools:** Jest (for TypeScript/Node), Vitest (for fast execution).
*   **Key Practice:** Use Mock objects for external dependencies (e.g., Database, Carrier APIs) to test business logic purely.
*   **Deliverable:** `npm run test:unit` must pass before any commit.

## 2. Integration Testing
*   **Objective:** Verify interaction between Core Kernel and Plugins.
*   **Scope:**
    *   **Plugin Loading:** Ensure correct adapter is loaded for a given Tenant ID.
    *   **Configuration Injection:** Verify that `tenant-config.yaml` values are correctly accessible within the plugin.
    *   **Data Persistence:** Verify that generic Core entities correctly store domain-specific JSONB data.
*   **Tools:** Supertest (API testing), Testcontainers (for ephemeral DB).

## 3. System Testing
*   **Objective:** Validate complete business flows in a staging environment.
*   **Scenarios:**
    *   **Data Isolation:** Create Tenant A (Logistics) and Tenant B (Banking). Ensure Tenant A cannot query Tenant B's quotes.
    *   **Cross-Domain Workflows:** Verify a Logistics quote -> Fulfillment flow works independently of a Banking loan -> Disbursement flow.
*   **Environment:** Staging environment mirroring Production (same DB, Redis configuration).

## 4. End-to-End (E2E) Testing
*   **Objective:** Simulate real user journeys via the UI.
*   **Tools:** Cypress or Playwright.
*   **Critical Paths:**
    *   Login as Logistics Admin -> Configure Rules -> Logout.
    *   Login as Logistics User -> Create Quote -> Verify Output.
    *   Login as Banking User -> Create Loan Application -> Verify Output.
*   **Automation:** Run nightly on the latest build.

## 5. Performance & Load Testing
*   **Objective:** Validate SLAs (Sub-second response, 10k concurrent users).
*   **Tools:** k6 or Apache JMeter.
*   **Scenarios:**
    *   **Spike Testing:** Simulate sudden traffic surge (e.g., Black Friday for Logistics).
    *   **Soak Testing:** Run constant load for 24 hours to detect memory leaks.
    *   **Multi-Tenant Load:** Simulate 50 active tenants simultaneously to ensure fair resource scheduling.

## 6. Security Testing
*   **Objective:** Identify vulnerabilities and ensure isolation.
*   **Tools:** OWASP ZAP, SonarQube (Static Analysis).
*   **Activities:**
    *   **Penetration Testing:** Attempt to bypass Tenant ID checks in API headers.
    *   **Dependency Scanning:** Check for vulnerabilities in third-party libraries (`npm audit`).
    *   **SQL Injection:** Verify that dynamic query building for domain fields is safe.

## 7. Migration & Regression Testing (Legacy Support)
*   **Objective:** Ensure the transformation to PaaS does not break the existing "Logistics Pro" application.
*   **Scope:**
    *   **Data Integrity:** Verify 100% row match between `quote_items` (table) and `quote_items_view` (view) during Phase 0.
    *   **Legacy API Compatibility:** Run the existing "Logistics Pro" Postman collection against the new architecture to ensure 0% failure rate.
    *   **UI Visual Regression:** Use Percy/Storybook to detect unintended layout shifts in the legacy React components due to refactoring.

