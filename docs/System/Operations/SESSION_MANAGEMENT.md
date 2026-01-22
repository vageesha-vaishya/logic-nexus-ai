# Session Management & Expiration Handling

## Overview
This document outlines the session management strategy for the Logic Nexus AI application, specifically addressing session expiration issues in Supabase Edge Functions.

## The Problem
Previously, two issues contributed to session expiration errors:
1.  **Client-Side**: Manual injection of `Authorization` headers (e.g., `Authorization: Bearer ${session.access_token}`) caused stale tokens to be sent even after the Supabase client had refreshed the session in the background.
2.  **Server-Side**: Edge Functions were configured to use `SUPABASE_SERVICE_ROLE_KEY` exclusively, ignoring the user's context. This made RLS policies ineffective and created confusion when the Gateway blocked expired tokens but the function logic didn't align with the auth state.

## The Solution

### 1. Client-Side: `invokeFunction` Utility
We have centralized all Edge Function invocations through a utility wrapper `invokeFunction` located at `src/lib/supabase-functions.ts`.

**Key Features**:
*   **Automatic Header Handling**: It explicitly *removes* any manually passed `Authorization` headers to ensure the Supabase client attaches the current, valid token.
*   **401 Retry Logic**: If a request fails with `401 Unauthorized`, it attempts to refresh the session and retry the request once.

```typescript
import { invokeFunction } from "@/lib/supabase-functions";

// ✅ GOOD PRACTICE
const { data, error } = await invokeFunction("send-email", {
  body: { ... }
});
```

### 2. Server-Side: Auth-Aware Edge Functions
We updated Edge Functions (`sync-emails-v2`, `send-email`) to properly respect the `Authorization` header passed from the client.

**New Pattern**:
```typescript
export function getSupabaseClient(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Use Service Role Client ONLY if explicitly requested by a system process (e.g. Scheduler)
  if (authHeader?.includes(serviceKey)) {
    return createClient(url, serviceKey);
  }

  // Otherwise, use User Context (respects RLS)
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
}
```

## Troubleshooting Session Issues

### Symptoms
- "Session expired" toast messages.
- 401 errors in the browser console network tab.

### Diagnostic Steps
1.  **Check Browser Console**: Look for `[Supabase Function] 401 Unauthorized...` logs.
2.  **Verify Client Config**: Ensure `src/integrations/supabase/client.ts` has `autoRefreshToken: true`.
3.  **Inspect LocalStorage**: Check if `sb-<project-id>-auth-token` exists.

### Verification
Run the unit test suite to verify the retry logic:
```bash
npm test src/lib/__tests__/supabase-functions.test.ts
```
