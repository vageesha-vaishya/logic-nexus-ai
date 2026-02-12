# Quotation Engine V2 - Deployment Guide

## Overview
The Quotation Engine V2 is deployed as a Supabase Edge Function named `generate-quote-pdf`. It handles PDF generation using a JSON-Schema driven rendering engine.

## Prerequisites
- Supabase CLI installed and authenticated.
- Docker running (for local testing/serving).
- Access to the production Supabase project (`gzhxgoigflftharcmdqj`).

## Configuration
The function relies on the following environment variables (set in Supabase Dashboard or `.env`):
- `SUPABASE_URL`: Automatically provided by Edge Runtime.
- `SUPABASE_ANON_KEY`: Automatically provided by Edge Runtime.
- `SUPABASE_SERVICE_ROLE_KEY`: Automatically provided by Edge Runtime.
- `E2E_BYPASS_KEY`: Optional, for E2E testing authentication bypass.

## Deployment Steps

### 1. Deploy the Function
Run the following command from the project root:

```bash
supabase functions deploy generate-quote-pdf --no-verify-jwt
```
*Note: `--no-verify-jwt` is used because the function handles its own auth checks or allows public invocation for specific cases (like E2E tests with bypass key), but typically it verifies the JWT internally via the Supabase client.*

### 2. Verify Deployment
Check the Supabase Dashboard > Edge Functions to ensure `generate-quote-pdf` is active and "Healthy".

### 3. Verification Script
Run the E2E verification script to confirm the deployed function is working correctly:

```bash
npx ts-node scripts/e2e_v2_engine_test.ts
```
Expected Output:
```
Starting V2 Engine E2E Test...
Using Quote: ...
Invoking generate-quote-pdf with engine_v2: true...
Function returned data type: object
PDF saved to .../e2e_v2_output.pdf
PDF Size: ... bytes
Test Passed!
```

## Rollback Procedure
If issues are detected:
1. Identify the previous stable deployment version in Supabase Dashboard.
2. Redeploy the previous version or revert the code locally and redeploy.

## Monitoring
- **Logs**: View logs in Supabase Dashboard > Edge Functions > generate-quote-pdf > Logs.
- **Errors**: Look for `[Error]` or `WARN` tags in the logs.
- **Trace**: The function emits `X-Trace-Logs` header in responses (if enabled) for debugging.

## Troubleshooting
- **"Invalid JWT"**: Ensure the client is sending a valid session token, or use `invokeAnonymous` if the function allows it.
- **Missing Data in PDF**: Check the logs for "Error fetching items" or "Error fetching charges". Ensure the `SafeContext` builder is correctly mapping the fields.
- **Rendering Artifacts**: If text overlaps, adjust the `DefaultTemplate` configuration (margins, column widths) in `engine/default_template.ts` and redeploy.
