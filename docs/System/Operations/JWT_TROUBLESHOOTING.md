# JWT & Authentication Troubleshooting Guide

## Overview
This document outlines common JWT (JSON Web Token) errors encountered during user creation and authentication flows, specifically within the Supabase Edge Function environment, and provides automated and manual resolution steps.

## Common JWT Errors

### 1. `401 Unauthorized` / `Invalid JWT`
**Symptoms:**
- User creation fails with "Invalid JWT" or "401 Unauthorized".
- Edge Function logs show auth errors.

**Root Causes:**
- **Missing Service Role Key:** The `create-user` Edge Function requires `SUPABASE_SERVICE_ROLE_KEY` to be set in the environment secrets. If missing, it cannot authenticate with the Supabase Admin API.
- **Expired User Token:** The client calling the function has an expired access token.
- **Invalid Signature:** The token was signed with a different secret than what the server expects.

### 2. `JWT expired`
**Symptoms:**
- "Session expired" toasts in the UI.
- API calls fail after a period of inactivity.

**Root Causes:**
- The access token (short-lived, usually 1 hour) has expired and the client failed to refresh it using the refresh token.

## Automated Solutions Implemented

### 1. Configuration Validation (`create-user`)
The `create-user` Edge Function now performs a strict startup check:
- Verifies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present.
- Returns a 500 `CONFIG_ERROR` with a clear message if missing, preventing ambiguous auth failures later.

### 2. Client-Side Retry Logic (`invokeFunction`)
The `src/lib/supabase-functions.ts` utility automatically handles 401 errors:
1.  Catches `401`, `Invalid JWT`, or `jwt expired` errors.
2.  Triggers `supabase.auth.refreshSession()`.
3.  Retries the original request with the fresh token.
4.  Logs a warning if the retry fails.

### 3. Diagnostic Script
A script is available to verify the Service Role Key configuration locally:
```bash
node scripts/test-create-user-auth.js
```

## Manual Troubleshooting Steps

If errors persist:

1.  **Verify Secrets**:
    Run `npx supabase secrets list` to ensure `SUPABASE_SERVICE_ROLE_KEY` is set.
    If missing, set it:
    ```bash
    npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
    ```

2.  **Check Client Clock**:
    Ensure the client machine's clock is synced. Significant drift can cause immediate token expiration.

3.  **Inspect Token Claims**:
    Decode the failing JWT (e.g., using jwt.io) and check:
    - `exp`: Expiration timestamp.
    - `role`: Should be `authenticated` (for users) or `service_role` (for admin tasks).
    - `iss`: Issuer URL (should match your Supabase URL).

## Environment Variables
Required for `create-user` function:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (Critical for `auth.admin` operations)
