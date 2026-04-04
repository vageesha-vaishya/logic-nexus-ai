# UIM Forms Suite

This module delivers eight production-ready form components for the UIM hierarchy:

- `UimOverviewForm`
- `UimItemMasterForm`
- `UimStockLedgerForm`
- `UimReservationsForm`
- `UimIssueConsumeForm`
- `UimRestockForm`
- `UimLocationsForm`
- `UimAnalyticsForm`

## Directory Map

- Forms: `src/modules/uim/forms/`
- Validation: `src/modules/uim/validation/schemas.ts`
- API Adapters: `src/services/uim/`
- Stories: `src/modules/uim/forms/UimForms.stories.tsx`
- Tests: `src/modules/uim/forms/UimForms.test.tsx`

## Environment Variables

- `VITE_UIM_API_BASE_URL` (optional): overrides default `/api/v2/uim`
- `VITE_UIM_FORMS_ENABLED` (optional feature flag): set `true` to expose UIM forms in phased environments

## API Version Negotiation

All UIM form adapters automatically send backward-compatible version headers:

- `Accept-Version: v1`
- `X-API-Version: v1`

No consumer-level code changes are required when API contract remains v1-compatible.

## CI/Test Commands

- Lint:
  - `npx eslint src/modules/uim/forms/**/*.tsx src/modules/uim/validation/schemas.ts src/services/uim/*.ts`
- Unit tests:
  - `npx vitest run src/modules/uim/forms/UimForms.test.tsx`
- UIM quality gate:
  - `.github/workflows/uim-phase1-gate.yml`
- UIM security baseline:
  - `.github/workflows/uim-security-baseline.yml`

## Feature Flags

- Rollout strategy recommends enabling routes and submission actions behind `VITE_UIM_FORMS_ENABLED=true` in stage first.
- Keep analytics and restock advanced actions disabled behind service-side flags until backend endpoints are fully live.
