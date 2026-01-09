# Testing (Removed)

Automated testing has been removed from this codebase (unit/integration/E2E, related configs, and CI workflows). This file preserves what existed previously so it can be restored later.

## Previously Present (Removed)

- Unit/integration tests (Vitest + Testing Library) under `src/**/*.test.{ts,tsx}` and `src/**/__tests__/*`
- E2E tests (Playwright) under `tests/e2e/*.spec.ts`
- Playwright configuration: `playwright.config.ts`
- Vitest configuration: `vite.config.ts` `test` block and `/// <reference types="vitest" />`
- Vitest setup: `test/setup.ts`
- CI workflows: `.github/workflows/playwright.yml`
- Lighthouse CI workflow/config: `.github/workflows/lighthouse.yml`, `.lighthouserc.json`, `lighthouse-*.json`
- Local test env file: `.env.local_test`
- Playwright output: `playwright-report/`

## Where Testing Was Previously Configured

- `package.json` scripts: `test`, `test:*`, `ci:test`, `test:e2e*`, `test:storybook`
- `package.json` devDependencies: `vitest`, `@playwright/test`, `@testing-library/*`, `jsdom`, `@lhci/cli`, `@storybook/test*`
- `vite.config.ts` had a `test` section configuring jsdom + setup file + include globs
- `.storybook/main.ts` previously enabled `@storybook/addon-interactions`
- `src/components/system/FormStepper.stories.tsx` previously used `@storybook/test` `play` function

## Restoration Notes (Manual)

To restore automated testing, re-add the tooling and configs that were removed:

1. Re-add scripts and devDependencies in `package.json` (Vitest/Playwright/Testing Library/etc.)
2. Restore `vite.config.ts` `test` config and `/// <reference types="vitest" />`
3. Restore `playwright.config.ts` and `tests/e2e/`
4. Restore `test/setup.ts` (and any helpers/fixtures)
5. Restore `.github/workflows/playwright.yml` (and optionally Lighthouse CI configs)

## Status

This project currently has no automated tests configured or runnable via `npm run test`.
