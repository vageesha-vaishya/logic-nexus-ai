# E2E Testing Framework Documentation

## Overview

This document describes the End-to-End (E2E) testing framework for the SOS Nexus application. The framework is built using [Playwright](https://playwright.dev/) and is designed to validate the critical business flows of the enterprise platform.

## Key Features

- **Full Business Flow Coverage**: Validates the complete lifecycle from Opportunity creation -> Smart Quote generation -> Detailed Quote creation -> Booking confirmation.
- **Multi-Mode & Multi-Quote Support**: Tests handling of multiple transportation modes (Air, Ocean) and multiple quotes per opportunity.
- **Mocking & Isolation**: Uses network interception to mock external AI Advisor services, ensuring deterministic and fast tests without incurring LLM costs.
- **Enterprise Validation**: Includes checks for data integrity, status transitions, and correct UI feedback.
- **CI/CD Integration**: Automated execution via GitHub Actions on every push and pull request.

## Mocking Strategy

The framework uses Playwright's network interception (`page.route`) to mock backend dependencies, ensuring tests are fast, deterministic, and cost-effective.

### Key Mocks
- **Supabase REST API**: Intercepts calls to `**/rest/v1/*`.
  - **Quotes**: Mocks creation (POST), retrieval (GET), and updates (PATCH). Handles complex URL queries including `id=eq.UUID` and `or=(id.eq.UUID,...)` using strict UUID regex.
  - **Service Types & Services**: Mocks `service_types`, `services`, and `service_type_mappings` to populate dropdowns immediately without DB lookups.
  - **Ports/Locations**: Mocks `ports_locations` to provide stable origin/destination data.
- **AI Advisor**: Mocks `**/functions/v1/ai-advisor` to return pre-defined analysis and route suggestions, bypassing the actual LLM.

### Data Isolation
- **UUIDs**: Uses fixed UUIDs (e.g., `1111...`) for mocked resources within the test scope to ensure predictable ID matching.
- **Timestamps**: Uses `Date.now()` for user-visible strings (e.g., Opportunity Name) to avoid collisions in the UI list views if running against a real DB (though mocks handle most data).

## Test Structure

The main test file is located at `tests/e2e/end-to-end-flow.spec.ts`.

### Scenarios

1.  **Opportunity Creation**:
    - Creates a new Opportunity with a unique timestamp-based name.
    - Sets stage to "Qualification".
    - Verifies successful creation and redirection to the Opportunity Detail page.

2.  **Smart Quote Generation (Multi-Mode)**:
    - Navigates to "New Quote" from the Opportunity.
    - Mocks the AI Advisor response to return both "Ocean" and "Air" options.
    - Fills the quote form (Origin, Destination).
    - Creates the quote and verifies the "Smart Quote" options are present (mocked).
    - Approves the quote to prepare it for booking.

3.  **Multi-Quote Handling**:
    - Returns to the Opportunity.
    - Creates a second "Manual" quote.
    - Verifies that multiple quotes are linked to the same Opportunity.
    - Leaves the second quote in "Draft" status to test filtering logic.

4.  **Booking Conversion (Mapper)**:
    - Initiates the "Convert to Booking" flow from the approved Smart Quote.
    - Uses the **Quote Mapper** to select the quote.
    - Verifies that only "Approved" quotes are visible by default.
    - Filters by quote number/ID.
    - Completes the mapping and confirmation process.
    - Verifies the final Booking creation and linkage.

## Setup & Running Tests

### Prerequisites

- Node.js (LTS)
- Playwright Browsers: `npx playwright install`

### Running Locally

```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/end-to-end-flow.spec.ts

# Run in UI mode (interactive)
npx playwright test --ui
```

### Environment Variables

The tests use the following environment variables (with defaults provided in code):

- `E2E_ADMIN_EMAIL`: Admin user email for login.
- `E2E_ADMIN_PASSWORD`: Admin user password.
- `BASE_URL`: The base URL of the application (default: `http://localhost:3000`).

## CI/CD Pipeline

The framework is integrated with GitHub Actions via `.github/workflows/playwright.yml`.

- **Triggers**: Push to `main`/`master`, Pull Requests.
- **Artifacts**: Playwright HTML reports are uploaded as artifacts for debugging failures.
- **Timeout**: 60 minutes per run.

## Best Practices

- **Test IDs**: Use `data-testid` attributes for stable selectors (e.g., `data-testid="login-btn"`).
- **Mocking**: Mock external APIs (like AI/LLM endpoints) to avoid flakiness and costs.
- **Isolation**: Each test should generate its own unique data (e.g., `Date.now()` timestamps) to avoid collisions.
- **Clean Up**: While the current implementation creates new data, a robust enterprise suite should consider data cleanup or using a dedicated test database reset strategy.

## Future Roadmap

- **Performance Testing**: Integrate Playwright's performance analysis to benchmark critical user flows.
- **Visual Regression**: Add snapshot testing for key UI components (Quote Grid, Booking Mapper).
- **Role-Based Testing**: Expand coverage to include non-admin roles (e.g., Sales Rep, Operations Manager) to validate permission boundaries.
- **Disaster Recovery**: Simulate network failures and API errors to test error handling resilience.
