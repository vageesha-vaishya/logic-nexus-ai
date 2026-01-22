# Missing Permission Fix - Lead View

## Issue Description
Users were experiencing a "missing permission - Lead View" error when refreshing the Lead Detail page (`/dashboard/leads/:id`). This occurred because the application was determining that the user lacked the required `leads.view` permission, even though the user's role (e.g., `platform_admin` or `user`) should have granted it.

## Root Cause Analysis
The issue was traced to a race condition in the authentication and permission loading logic within `src/hooks/useAuth.tsx`.

1.  **Premature Loading State Reset**: The `applySession` function in `useAuth` is responsible for handling session updates (from `getSession` or `onAuthStateChange`).
2.  **Race Condition**: When the page refreshed:
    *   `loading` was initially `true`.
    *   `getSession` returned the session.
    *   `applySession` was called.
    *   Simultaneously, `onAuthStateChange` might trigger.
    *   In the original logic, if `applySession` encountered a condition where it thought data was already loaded or not needed, it might have set `loading` to `false` prematurely or failed to wait for the asynchronous `loadUserData` to complete before rendering the `ProtectedRoute`.
    *   The `ProtectedRoute` checks permissions immediately. If `loading` is `false` but `permissions` state hasn't been populated yet (because `loadUserData` is still fetching), the check fails (`permissions` is empty), resulting in a redirect to `/unauthorized`.

## Solution Implementation
The fix involved robustly managing the `loading` state in `src/hooks/useAuth.tsx` to ensure it remains `true` until user data (roles and permissions) is fully loaded.

### Key Changes
In `src/hooks/useAuth.tsx`, the `applySession` function was modified:

```typescript
const applySession = (currentSession: Session | null, source: string) => {
  setSession(currentSession);
  setUser(currentSession?.user ?? null);

  if (currentSession?.user) {
    // Check if we need to load data for this user
    if (lastLoadedUserId !== currentSession.user.id) {
      lastLoadedUserId = currentSession.user.id;
      
      // CRITICAL: Ensure loading is true before starting the async fetch
      setLoading(true);
      
      loadUserData(currentSession.user)
        .then(() => {
          // Success logging
        })
        .catch(err => {
          console.error('[Auth] Failed to load user data:', err);
        })
        .finally(() => {
          // Only set loading to false when the fetch is actually done
          setLoading(false);
        });
    } else {
      // If same user, do NOT touch the loading state. 
      // It might be currently loading (true) or already finished (false).
      // Touching it here could prematurely set it to false if a fetch is in progress.
      console.log(`[Auth] Skipping data load for ${currentSession.user.id} (already loaded/loading)`);
    }
  } else {
    // Handle logout / no session
    lastLoadedUserId = null;
    setProfile(null);
    setRoles([]);
    setPermissions([]);
    setLoading(false);
  }
};
```

### Verification
-   **Fresh Load**: `loading` starts true, `applySession` starts fetch, `loading` stays true until fetch completes. `ProtectedRoute` waits. Correct.
-   **Refresh**: Same as fresh load. Correct.
-   **Auth State Change (same user)**: `applySession` sees matching `lastLoadedUserId`, enters `else` block, does *not* change `loading`. Correct.

## Logging
Detailed logging was added to `useAuth.tsx` (prefixed with `[Auth]`) to trace the session application and data loading lifecycle, aiding in future debugging.
