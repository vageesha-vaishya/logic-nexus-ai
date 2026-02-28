# JWT Migration Status Report & Verification

## Executive Summary

The persistent failure in the `save-quotation-version` Edge Function has been successfully resolved. The root cause was identified as a conflict between the Supabase Edge Runtime's default JWT verification and the new Custom JWKS authentication architecture.

By disabling the runtime's pre-verification for this function, we allow the application's internal `requireAuth` middleware to correctly validate tokens against the new identity provider configuration.

## Verification Results

### 1. `save-quotation-version` Function
- **Status:** ✅ Operational
- **Test Script:** `scripts/test_edge_function_save.ts`
- **Result:**
  ```
  Invoking save-quotation-version...
  Success! Response: {
    id: '...',
    quote_id: '7ba8b2d8-c028-4c75-8a80-9d34666e9c31',
    major: 1,
    minor: 2,
    change_reason: 'Automated Regression Test',
    ...
  }
  --- Test Passed ---
  ```
- **Configuration Change:**
  Updated `supabase/config.toml` to bypass runtime verification:
  ```toml
  [functions.save-quotation-version]
  verify_jwt = false
  ```

### 2. Environment Security
- **Legacy Secrets:** Confirmed removal of `SUPABASE_JWT_SECRET` from `.env` and Supabase Project Secrets.
- **New Keys:** Validated presence of `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` which are sufficient for the new architecture.

## Technical Details

### The Issue
The Supabase Edge Runtime attempts to verify the JWT in the `Authorization` header *before* the function code executes. It uses the project's internal secret for this. Since we migrated to a Custom JWKS (using an external or custom signing key), the runtime's check fails with `401 Unauthorized` because it cannot verify the signature using the old secret.

### The Fix
Disabling `verify_jwt` in `config.toml` skips this gatekeeper check. The function then executes, and our custom `requireAuth` middleware (in `_shared/auth.ts`) manually validates the token by calling `supabaseClient.auth.getUser()`, which correctly interfaces with the GoTrue Auth server that knows about the new JWKS keys.

## Recommendations & Next Steps

**CRITICAL:** This fix currently applies **only** to `save-quotation-version`. All other Edge Functions that use `requireAuth` and are invoked with a user token will likely fail with the same 401 error until updated.

### Affected Functions
The following functions use `requireAuth` and likely require the `verify_jwt = false` configuration:

- `restore-quotation-version`
- `win-probability`
- `sync-hts-data`
- `sync-emails`
- `sync-emails-v2`
- `sync-cn-hs-data`
- `sync-all-mailboxes`
- `suggest-transport-mode`
- `subscription-plans`
- `smart-reply`
- `send-whatsapp`
- `send-web`
- `send-email`
- `search-emails`
- `salesforce-sync-opportunity`
- `route-optimization`
- `risk-scoring`
- `revenue-forecasting`
- `remote-import`
- `rate-engine`
- `push-migrations-to-target`
- `process-sequences`
- `process-scheduled-emails`
- `process-lead-assignments`
- `process-franchise-import`
- `process-email-retention`
- `predict-eta`
- `portal-chatbot`
- `plan-event-webhook`
- `nexus-copilot`
- `moderate-message`
- `metrics-quotation`
- `margin-optimizer`
- `list-edge-functions`
- `lead-scoring`
- `lead-event-webhook`
- `ingest-web`
- `ingest-telegram`
- `ingest-linkedin`
- `ingest-email`
- `get-service-label`
- `get-opportunity-label`
- `get-opportunity-full`
- `get-contact-label`
- `get-account-label`
- `generate-quote-pdf`
- `forecast-demand`
- `fleet-utilization`
- `extract-invoice-items`
- `extract-bol-fields`
- `export-data`
- `execute-sql-external`
- `exchange-oauth-token`
- `escalate-message`
- `ensemble-demand`
- `email-stats`
- `email-scan`
- `domains-verify`
- `domains-register`
- `delete-user`
- `create-user`
- `container-demand`
- `classify-email`
- `check-expiring-documents`
- `categorize-document`
- `carrier-scoring`
- `calculate-lead-score`
- `autonomous-email`
- `anomaly-detection`
- `analyze-email-threat`
- `analyze-cargo-damage`
- `ai-message-assistant`
- `ai-agent`
- `ai-advisor`
- `admin-reset-password`
- `route-email`
- `cleanup-logs`
- `anomaly-detector`
- `alert-notifier`

### Action Plan
1.  **Bulk Update:** Add `[functions.<name>] verify_jwt = false` for all above functions in `supabase/config.toml`.
2.  **Deploy:** Redeploy all affected functions.
3.  **Verify:** Run a broader regression test suite.

For now, the critical path (Quotation Saving) is unblocked.
