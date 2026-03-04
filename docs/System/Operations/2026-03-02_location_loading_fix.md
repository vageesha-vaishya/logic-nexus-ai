# Location Loading Fix - 2026-03-02

## Issue Description
Users reported that the Origin and Destination fields were failing to load in the Unified Quote Composer. The fields would either show no results or fail to search.

## Root Cause Analysis
Upon investigation, the following issues were identified:
1.  **Data Access Violation**: The `LocationAutocomplete.tsx` and `LocationSelect.tsx` components were using the raw `supabase` client instead of the project-standard `scopedDb` from the `useCRM` hook.
2.  **RLS Compliance**: The raw client usage potentially bypassed or conflicted with Row Level Security (RLS) policies, especially as `ports_locations` was recently migrated to a global table structure.
3.  **Missing Context**: The components were not waiting for the user session to be fully initialized before attempting to query the database, leading to potential authentication failures.

## Implementation Details

### Component Updates
Two components were updated to enforce the `ScopedDataAccess` pattern:

1.  **`src/components/common/LocationAutocomplete.tsx`**
    *   Replaced `import { supabase } ...` with `const { scopedDb, user } = useCRM()`.
    *   Added a guard clause `if (!user) return` to ensure authenticated requests.
    *   Updated all queries to use `scopedDb.from('ports_locations', true)` where `true` explicitly marks the table as global, bypassing tenant scoping filters.
    *   Updated the `search_locations` RPC call to use `scopedDb.rpc()`.

2.  **`src/components/sales/composer/LocationSelect.tsx`**
    *   Replaced `import { supabase } ...` with `const { scopedDb } = useCRM()`.
    *   Updated queries to use `scopedDb.from('ports_locations', true)`.
    *   Ensured consistent error handling and data retrieval.

### Database / RPC
*   Verified that `ports_locations` has a global RLS policy (`Global read access for ports_locations`) allowing authenticated users to read all records.
*   Confirmed `search_locations` RPC is `SECURITY DEFINER` and accesses the global `ports_locations` table correctly.

## Verification
*   **Static Analysis**: Confirmed no raw `supabase` client usage remains in the affected components.
*   **Type Safety**: Verified `scopedDb` methods match the expected interface for `from()` with the global flag.
*   **Regression Check**: Ensured `LegManager` (which uses `LocationSelect`) and `FormZone` (which uses `LocationAutocomplete`) are covered by the fix.

## Future Recommendations
*   Audit other components for raw `supabase` client usage and migrate them to `scopedDb` to ensure consistent multi-tenancy enforcement.
*   Ensure all new database tables have appropriate RLS policies (Global vs Tenant-Scoped) and are accessed accordingly.
