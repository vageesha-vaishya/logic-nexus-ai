# Operational Runbooks

This document provides operational procedures for maintaining and troubleshooting the Logic Nexus AI platform components deployed in Phase 1.

## 1. Dashboard Troubleshooting

### Symptom: Dashboard widgets are spinning indefinitely (Loading state)
**Possible Causes:**
-   Network connectivity issues to Supabase.
-   A specific query in `useDashboardData` is hanging or failing silently (though error handling is in place).
-   RLS policies are blocking access.

**Diagnosis Steps:**
1.  Open Browser Developer Tools (F12) > Network Tab.
2.  Refresh the page.
3.  Look for failed requests to `rest/v1/leads` or `rest/v1/activities`.
4.  If requests return 401/403:
    -   Check if the user's session is valid.
    -   Verify `ScopedDataAccess` is correctly applying `tenant_id`.
5.  Check Console for "Dashboard fetch error" logs.

**Resolution:**
-   **Session Issue:** Log out and log back in.
-   **RLS Issue:** Verify the user's role in the `profiles` table matches the expected RLS policy.

### Symptom: "My Leads" shows empty but data exists in DB
**Possible Causes:**
-   The user is looking at the wrong scope (Tenant/Franchise).
-   The leads are not assigned to the user (`owner_id` mismatch).
-   `ScopedDataAccess` filter is too restrictive.

**Diagnosis Steps:**
1.  Check the `owner_id` of the missing lead in the database.
2.  Verify the current user's ID in the application context.
3.  If the user is an Admin, check if they are in "Override" mode.

## 2. Tenant Provisioning

### Procedure: Onboarding a New Tenant
Currently, tenant creation is a manual/semi-manual process via database scripts (to be automated in Phase 2).

**Steps:**
1.  **Create Tenant Record:**
    ```sql
    INSERT INTO tenants (name, subscription_tier) VALUES ('New Tenant Corp', 'enterprise');
    ```
2.  **Create Admin User:**
    -   Create user in Supabase Auth.
    -   Create profile in `public.profiles` linked to the new `tenant_id` with role `tenant_admin`.
3.  **Verify Access:**
    -   Log in as the new user.
    -   Verify that the Dashboard loads without errors.

## 3. Deployment & Rollback

### Deployment Checklist
1.  Run `npm run build` locally to ensure no build errors.
2.  Run `npm run lint` to check for code quality issues.
3.  Deploy to Vercel/Netlify (or current hosting provider).
4.  **Smoke Test:**
    -   Log in as Platform Admin.
    -   Log in as Tenant Admin.
    -   Check Dashboard stats load.

### Rollback Procedure
If a critical bug is found in the Dashboard (e.g., white screen of death):
1.  Revert the git commit to the previous stable tag.
    ```bash
    git revert HEAD
    git push origin main
    ```
2.  Trigger a new build.
3.  Notify users of a brief maintenance window if necessary.

## 4. Monitoring & Alerting (Planned)

**Current State:**
-   Client-side errors are logged to the console.
-   Supabase logs provide database-level error visibility.

**Future State (Phase 2):**
-   Integrate Sentry for frontend error tracking.
-   Set up Supabase database alerts for slow queries (>500ms).
