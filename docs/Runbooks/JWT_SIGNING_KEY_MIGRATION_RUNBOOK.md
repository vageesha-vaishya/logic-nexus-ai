# JWT Signing Key Migration Runbook

Date: 2026-03-06

## Incident
- Error observed: `401 Invalid JWT` after migration from legacy JWT secret to JWT signing keys.

## Root Cause Analysis
- Runtime code still contained hardcoded legacy JWT-like fallback keys.
- Some requests used inconsistent auth headers (`Authorization` without `apikey` in anonymous function calls).
- Edge auth middleware accepted only `SUPABASE_ANON_KEY`, while newer deployments may expose `SUPABASE_PUBLISHABLE_KEY`.

## Updated Runtime Locations
- `src/integrations/supabase/client.ts`
  - Removed hardcoded Supabase URL and hardcoded legacy JWT fallback.
  - Uses `VITE_SUPABASE_PUBLISHABLE_KEY` with `VITE_SUPABASE_ANON_KEY` fallback.
- `src/lib/supabase-functions.ts`
  - Removed all hardcoded JWT fallback strings.
  - Centralized key/url resolution via env vars.
  - Added structured JWT failure logging.
  - Added `apikey` + bearer in anonymous invocation path.
- `supabase/functions/_shared/auth.ts`
  - Accepts `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY`.
  - Added JWT diagnostics for server-side verification failures.
- `src/components/email/EmailInbox.tsx`
  - Removed hardcoded JWT fallback in classify-email retry logic.

## Environment Variables (Target State)
- Frontend:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - Optional fallback: `VITE_SUPABASE_ANON_KEY`
- Edge Functions:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY` and/or `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (admin/server-only use)

## Validation Checklist
1. Verify all frontend requests include valid bearer session token where required.
2. Verify anonymous/public function calls send `apikey` with publishable key.
3. Verify edge logs contain JWT diagnostics when failures happen.
4. Verify no runtime file contains hardcoded JWT-like fallback values.
5. Test auth flows:
   - Logged-in user invoking protected function.
   - Expired token auto-refresh flow.
   - Anonymous/public function invocation.

## Key Rotation Procedure
1. Generate a new signing key in Supabase.
2. Keep old key active until session/token TTL window has elapsed.
3. Rotate publishable key secret values in all environments.
4. Redeploy frontend and functions.
5. Validate canary endpoints and watch 401 rate for 30 minutes.
6. Deactivate old signing key after successful soak.

## Rollback Plan
1. If 401 rate spikes after deployment:
   - Re-deploy previous known-good frontend and function revisions.
   - Restore previous publishable key environment values.
2. If signing key rollout is root cause:
   - Re-enable prior active signing key in Supabase.
   - Keep newly introduced key inactive until verification completes.
3. Recovery validation:
   - Confirm protected function auth success.
   - Confirm PDF/quote generation endpoints return 2xx.
   - Confirm 401 error rate returns to baseline.

## Monitoring and Alerting
- Add/verify alerts:
  - Edge function 401 error-rate threshold.
  - "Invalid JWT" log pattern threshold.
  - Token refresh failure rate.
- Add dashboard splits by function name and tenant for faster blast-radius detection.
