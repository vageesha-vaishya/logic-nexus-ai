# E2E Quotation Testing Framework

This directory includes the Playwright-based quotation automation framework with Page Object Model architecture, data-driven testing, multi-browser CI execution, and runtime diagnostics.

## Directory Structure

- `quotation/config/environments.ts`: Environment profile resolver (`dev`, `staging`, `production`) and runtime toggles.
- `quotation/fixtures/quotation.fixture.ts`: Shared fixtures, API mock setup, page-object wiring, and failure DOM attachments.
- `quotation/pom/*`: Reusable page objects (`AuthPage`, `QuotationComposerPage`, `QuotationListPage`, `BasePage`).
- `quotation/utils/*`: Runtime monitor, mock API router, JSON/CSV loaders.
- `quotation/data/*`: Data-driven scenario inputs for validation and boundary testing.
- `quotation/quotation-comprehensive.spec.ts`: End-to-end suite covering validations, UX, CRUD, resiliency, visuals, and concurrency.

## Execution Commands

```bash
npm run test:playwright
```

```bash
npm run test:playwright:quotation
```

```bash
npm run test:playwright:quotation:headed
```

## Environment Configuration

The framework uses these environment variables:

- `PLAYWRIGHT_ENV`: `dev`, `staging`, or `production`.
- `PLAYWRIGHT_BASE_URL` or `BASE_URL`: App URL (defaults to `http://localhost:4173`).
- `PLAYWRIGHT_USE_MOCK_API`: Enables deterministic mocked REST/auth API responses.
- `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`: Login credentials for non-mock flows.
- `PLAYWRIGHT_REUSE_EXISTING_SERVER`: Set to `true` when a local dev server is already running.

## CI Integration

Quotation end-to-end execution is integrated in:

- `.github/workflows/e2e-quotation.yml` for quotation-focused matrix runs.
- `.github/workflows/playwright.yml` for broader Playwright project coverage.

Both workflows shard test execution, upload `playwright-report/` and `test-results/` artifacts, and retain results for trend comparisons across runs.
