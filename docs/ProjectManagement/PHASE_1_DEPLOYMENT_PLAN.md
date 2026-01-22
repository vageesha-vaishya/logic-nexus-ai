# Phase 1 Deployment Plan

## 1. Deployment Checklist

### System Components
- [ ] **Frontend Application**: React/Vite SPA (Build Artifacts)
- [ ] **Backend Database**: Supabase (PostgreSQL)
- [ ] **Edge Functions**: Supabase Edge Functions (if applicable)
- [ ] **Storage**: Supabase Storage Buckets

### Dependencies & Prerequisites
- [ ] Node.js v20+ installed
- [ ] NPM v10+ installed
- [ ] Supabase CLI installed and authenticated
- [ ] `git` installed
- [ ] Access to production Supabase project (Project Reference ID, Anon Key, Service Role Key)
- [ ] Access to deployment target (e.g., Vercel, Netlify, or Docker Registry)

### Configuration Parameters
- [ ] `VITE_SUPABASE_URL`: Production API URL
- [ ] `VITE_SUPABASE_ANON_KEY`: Production Anon Key
- [ ] `VITE_SENTRY_DSN`: Sentry DSN for error tracking
- [ ] `VITE_POSTHOG_KEY`: PostHog Key for analytics (optional)

### Environment-Specific Settings
- [ ] **Production**:
    - [ ] `NODE_ENV=production`
    - [ ] Strict Content Security Policy (CSP)
    - [ ] CORS allowed origins set to production domain
- [ ] **Staging**:
    - [ ] `NODE_ENV=staging`
    - [ ] CORS allowed origins set to staging domain

## 2. Deployment Timeline

| Phase | Time | Action | Owner | Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Preparation** | T-24h | Freeze code, run full regression suite | QA Lead | All tests pass |
| **Backup** | T-1h | Backup production database | DevOps | Backup verified |
| **Migration** | T-30m | Apply `segment_members` & `audit_logs` migrations | Backend | Schema updated |
| **Deploy** | T-0 | Deploy frontend build to production | DevOps | Site loads |
| **Smoke Test** | T+5m | Verify dashboard loads, login works | QA | Checklist pass |
| **Monitoring** | T+1h | Monitor error rates and latency | DevOps | <1% Error Rate |

### Rollback Procedures
1.  **Frontend**: Revert to previous Git tag/commit and redeploy.
    ```bash
    git checkout v0.9.0
    npm run build
    # deploy command
    ```
2.  **Database**:
    -   Since migrations (adding columns/tables) are generally forward-compatible, immediate rollback might not be needed unless data is corrupted.
    -   If needed, restore from T-1h backup using Supabase CLI or Dashboard.

## 3. Production Environment Preparation

### Infrastructure
-   **Hosting**: Static file hosting (Vercel/Netlify) or Docker Container (Nginx).
-   **Database**: Supabase "Pro" tier recommended for production SLA.

### Network & Security
-   **SSL/TLS**: Enforced by hosting provider (Vercel/Netlify automatically).
-   **RLS Policies**: STRICTLY enforced. Run `scripts/audit_rls.sh` (if available) or verify manually.
-   **Headers**:
    -   `X-Content-Type-Options: nosniff`
    -   `X-Frame-Options: DENY`

## 4. Success Criteria

### Functional Verification
-   [ ] Admin can log in and see "Recent Activities" (Override view).
-   [ ] Tenant User can log in and ONLY see their own data.
-   [ ] Dashboard KPIs load within 2 seconds.
-   [ ] Activity assignment works and reflects in the UI.

### Performance Benchmarks
-   **TTFB**: < 200ms
-   **LCP**: < 1.5s
-   **Dashboard Data Load**: < 800ms (Parallel Fetch)

### System Stability
-   **Error Rate**: < 0.1% of requests
-   **Uptime**: 99.9% during deployment window (Zero-downtime deployment preferred)

## 5. Documentation & Monitoring

-   **Version Control**: Tag release with `v1.0.0-phase1`.
-   **Change Log**: Update `CHANGELOG.md` with Phase 1 features.
-   **Monitoring**:
    -   Sentry for Javascript errors.
    -   Supabase Dashboard for Database health.
    -   UptimeRobot for site availability.
