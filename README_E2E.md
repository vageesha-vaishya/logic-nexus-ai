# End-to-End (E2E) Quotation Testing Framework

This framework provides a comprehensive validation suite for the Multi-Modal Freight Quotation System. It covers quote creation, charge calculation, PDF generation, and email delivery.

## Prerequisites

- Node.js (v16+)
- Supabase CLI / Local Environment or Remote Project
- `.env.local` configured with:
  - `VITE_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (Required for bypassing RLS/Auth in tests)
  - `RESEND_API_KEY` (Required for email delivery)

## Scenarios

### 1. Default Rates Scenario (Smart/AI Quote)
Validates the standard workflow using system defaults and AI-generated suggestions.
- **Script:** `scripts/e2e_default_rates_scenario.ts`
- **Command:** `npx tsx scripts/e2e_default_rates_scenario.ts`
- **Coverage:**
  - Quote Creation (Draft)
  - Default Charge Application
  - PDF Generation (Standard Layout)
  - Email Delivery

### 2. Comprehensive MGL Scenario (User Data)
Validates complex, multi-modal, multi-carrier quotes with specific business logic.
- **Script:** `scripts/e2e_mgl_maersk_scenario.ts`
- **Command:** `npx tsx scripts/e2e_mgl_maersk_scenario.ts`
- **Coverage:**
  - **Carriers:** Maersk, Evergreen, MSC (Rate comparison)
  - **Containers:** 20GP, 40GP, 40HC
  - **Routing:** 4-Leg Multi-Modal (Road -> Ocean -> Rail -> Road)
  - **Charges:** Granular breakdown (Freight, BAF, Handling, Customs, Delivery) mapped to specific legs.
  - **PDF:** MGL Granular Layout (Matrix view)
  - **Email:** Attachment verification

## Error Handling & Rollback

- **Email Retry:** The `send-email` Edge Function implements exponential backoff for transient errors (429, 5xx).
- **Auth Bypass:** Uses `X-E2E-Key` header to authenticate test requests without user interaction.
- **Rollback:** The scripts contain rollback logic (see `rollback()` function) to clean up data in case of critical failures during testing.

## Deployment & Production Readiness

1. **Environment Variables:** Ensure all keys are set in the production Supabase dashboard.
2. **Monitoring:** Check Supabase Function Logs (`generate-quote-pdf`, `send-email`) for execution details.
3. **CI/CD:** Integrate these scripts into your CI pipeline (e.g., GitHub Actions) to run before deployment.
