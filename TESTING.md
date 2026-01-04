# End-to-End Testing Framework

This project uses [Playwright](https://playwright.dev/) for end-to-end (E2E) testing. The framework is designed to cover critical user journeys, automate UI/API validations, and generate detailed reports.

## Features

- **Critical Flow Coverage**: Tests for Lead Management, including Dashboard and Detail views.
- **Mocking**: Supabase API responses are mocked to ensure consistent and isolated testing without hitting the real database.
- **Visual Evidence**: Screenshots and videos are automatically captured for failed tests.
- **CI/CD Integration**: Automated testing workflow via GitHub Actions.
- **Cross-Browser Testing**: Configured for Chromium, Firefox, and WebKit.

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run tests with UI Mode (Recommended for debugging)
```bash
npx playwright test --ui
```

### Run specific test file
```bash
npx playwright test tests/e2e/leads.spec.ts
```

### View Report
```bash
npx playwright show-report
```

## Test Structure

- `tests/e2e/`: Contains test specification files.
  - `leads.spec.ts`: Validates Lead Management workflows (Dashboard, Detail, Scoring).
- `playwright.config.ts`: Global configuration for Playwright.
- `.github/workflows/playwright.yml`: CI/CD pipeline configuration.

## Writing New Tests

1. Create a new `.spec.ts` file in `tests/e2e/`.
2. Use the `test` and `expect` fixtures from `@playwright/test`.
3. Mock necessary API calls using `page.route` to simulate backend responses.
4. Use `getByText`, `getByRole`, etc., to interact with the UI.

## CI/CD Pipeline

The project includes a GitHub Actions workflow (`playwright.yml`) that:
1. Triggers on push/pull_request to `main` or `develop` branches.
2. Installs dependencies and Playwright browsers.
3. Runs the test suite.
4. Uploads the test report (including screenshots/videos of failures) as an artifact.
