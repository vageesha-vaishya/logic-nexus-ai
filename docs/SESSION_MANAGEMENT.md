# Session Management & Expiration Handling

## Overview
This document outlines the session management strategy for the Logic Nexus AI application, specifically addressing session expiration issues in Supabase Edge Functions.

## The Problem
Previously, several components were manually injecting the `Authorization` header when calling Supabase Edge Functions:
```typescript
// ❌ BAD PRACTICE
supabase.functions.invoke('some-function', {
  headers: {
    Authorization: `Bearer ${session.access_token}`
  }
})
```
This approach bypasses the Supabase client's internal logic. If the `access_token` in the variable is stale (expired), the request fails with a `401 Unauthorized` error, even if the Supabase client has silently refreshed the session in the background.

## The Solution
We have centralized all Edge Function invocations through a utility wrapper `invokeFunction`.

### Key Features of `invokeFunction`
1. **Automatic Header Handling**: It lets the Supabase client attach the current, valid token automatically.
2. **401 Retry Logic**: If a request fails with `401 Unauthorized`:
   - It attempts to refresh the session using `supabase.auth.refreshSession()`.
   - If successful, it retries the original request with the new token.
   - If the refresh fails, it returns a clear "Session expired" error.

### Implementation
The utility is located at `src/lib/supabase-functions.ts`.

```typescript
import { invokeFunction } from "@/lib/supabase-functions";

// ✅ GOOD PRACTICE
const { data, error } = await invokeFunction("send-email", {
  body: { ... }
});
```

## Troubleshooting Session Issues

### Symptoms
- "Session expired" toast messages.
- 401 errors in the browser console network tab.
- Users being logged out unexpectedly.

### Diagnostic Steps
1. **Check Browser Console**: Look for `[Supabase Function] 401 Unauthorized...` logs.
2. **Verify Client Config**: Ensure `src/integrations/supabase/client.ts` has `autoRefreshToken: true`.
3. **Inspect LocalStorage**: Check if `sb-<project-id>-auth-token` exists and contains a valid JWT.
4. **Server Logs**: Check Supabase Dashboard > Edge Functions > Logs for the specific function.

### Common Fixes
1. **Replace Direct Calls**: Search for `supabase.functions.invoke` and replace with `invokeFunction`.
2. **Remove Manual Headers**: Ensure `headers: { Authorization: ... }` is NOT passed unless absolutely necessary (e.g. server-side context).
3. **Check Edge Function Auth**: Ensure the Edge Function verifies the user correctly using `req.headers.get('Authorization')` and `supabaseClient.auth.getUser()`.

## Verification
A unit test suite is available at `src/lib/__tests__/supabase-functions.test.ts` to verify the retry logic.

To run tests (if configured):
```bash
npm test src/lib/__tests__/supabase-functions.test.ts
```
