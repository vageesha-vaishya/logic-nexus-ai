# E2E Quotation Testing Framework

This directory contains the End-to-End (E2E) testing framework for the Quotation System, designed to verify the entire flow from quote creation to email delivery.

## Structure

- `helpers/`: Contains helper classes for interacting with Supabase, creating test data, and verifying results.
  - `SupabaseHelper.ts`: Manages Supabase client and authentication.
  - `QuoteFactory.ts`: Facilitates creation of quotes, items, versions, and options.
  - `PDFValidator.ts`: Validates generated PDF content (mocked/stubbed for now, can be expanded).
- `scenarios/`: Contains the actual test scenarios.
  - `quotation_system.test.ts`: Main test file implementing the requested scenarios.

## Scenarios

### 1. Default Rates (Quick Quote Flow)
- Creates a quote with default parameters.
- Adds standard container items.
- Generates a PDF version using the "Standard" layout.
- Verifies email delivery trigger.

### 2. Custom Data (Maersk Multi-Leg Flow)
- Creates a complex multi-leg quote (Road -> Ocean).
- Adds items with granular charges mimicking a Maersk Line invoice.
- Uses system-provided data for container sizes and types.
- Generates a PDF and verifies email delivery.

## Prerequisites

- Node.js (v20+ recommended)
- Supabase instance (local or remote) running.
- `.env` file with the following variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (Required for bypassing RLS/admin tasks in tests)

## Running Tests

To run the E2E tests:

```bash
npm run test:e2e
```

To run a specific test file:

```bash
npx vitest run tests/e2e/scenarios/quotation_system.test.ts --config vitest.config.e2e.ts
```

## CI/CD Integration

The tests are integrated into GitHub Actions via `.github/workflows/e2e-quotation.yml`. Ensure the necessary secrets are configured in your repository settings.
