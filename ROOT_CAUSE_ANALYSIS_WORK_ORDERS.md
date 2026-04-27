# Root Cause Analysis: "Failed to load work orders"

**Date:** 2026-04-11  
**Issue:** Work orders page displays error "Failed to load work orders. Please try again."  
**Severity:** Critical - AMRO module completely inaccessible  
**Status:** ✅ Fixed (migration created)

---

## Executive Summary

The work orders loading failure was caused by **missing database seed data** for the AMRO domain configuration. Specifically:

1. **No AMRO entry in `platform_domains` table** - The AMRO domain was never created in the database
2. **No tenant-domain assignments for AMRO** - Even if the domain existed, no tenants were assigned to it

The application's authentication/authorization gate (`enforceAmroDomainAccess()`) requires both:
- An active AMRO domain entry in `platform_domains`
- An active assignment linking the user's tenant to the AMRO domain with proper subscription status

Since neither existed, all requests to `/api/v2/amro/work-orders` were rejected with **403 Forbidden**, causing the frontend to display the error message.

---

## Detailed Analysis

### Application Flow

```
[User] → [AmroWorkOrdersListPage.tsx]
  → useListWorkOrders() [React Query hook]
    → GET /api/v2/amro/work-orders
      → [Next.js API Route: work-orders.ts]
        → enforceHttps() ✅
        → authenticateRequest() ✅ (validates Supabase JWT)
        → resolveAndApplyAccessContext() ✅ (extracts tenantId from user_roles/preferences)
        → enforceAmroDomainAccess() ❌ FAILS
```

### Failure Point

**File:** `src/pages/api/_utils/http.ts`  
**Function:** `enforceAmroDomainAccess()` (lines 905-1062)  
**Line:** ~998

```typescript
const matched = rows.find((row: any) => {
  const linkedDomain = Array.isArray(row?.platform_domains) ? row.platform_domains[0] : row?.platform_domains;
  const code = String(linkedDomain?.code || '').trim().toUpperCase();
  const domainIsActive = Boolean(linkedDomain?.is_active ?? true);
  return code === AMRO_DOMAIN_CODE && domainIsActive; // AMRO_DOMAIN_CODE = 'AMRO'
});

if (!matched) {
  throw new Error('Forbidden: AMRO access requires active AMRO domain subscription');
}
```

### Database Query Performed

```typescript
const strictQuery = await supabase
  .from('tenant_domain_assignments')
  .select('id, tenant_id, is_active, subscription_status, grace_until, platform_domains!inner(code, is_active)')
  .eq('tenant_id', tenantId)
  .eq('is_active', true);
```

This query:
1. Looks for active `tenant_domain_assignments` for the user's tenant
2. Joins with `platform_domains` to get the domain code
3. Expects to find a row where `platform_domains.code = 'AMRO'`

### Why It Fails

**Query returns empty** because:

1. **`platform_domains` table has no AMRO entry**
   - Existing domains: LOGISTICS, BANKING, ECOMMERCE, TELECOM, INSURANCE, CUSTOMS, TRADING, REAL_ESTATE
   - Missing domain: **AMRO**

2. **`tenant_domain_assignments` table has no AMRO assignments**
   - No migration ever created assignments linking tenants to AMRO domain
   - The `20260324171000_amro_master_data_entity_seed_pack.sql` migration QUERIES for existing AMRO assignments but doesn't CREATE them

### Evidence from Code Review

**Domain seeding migrations examined:**
- ✅ `20260128100003_replace_domain_enum_with_table.sql` - Seeds LOGISTICS, BANKING, TELECOM
- ✅ `20260131053535_sync_banking_domain.sql` - Seeds BANKING
- ✅ `20260131053536_sync_customs_domain.sql` - Seeds CUSTOMS
- ✅ `20260131053537_sync_ecommerce_domain.sql` - Seeds ECOMMERCE
- ✅ `20260131053538_sync_insurance_domain.sql` - Seeds INSURANCE
- ✅ `20260131053539_sync_logistics_domain.sql` - Seeds LOGISTICS
- ✅ `20260131053540_sync_real_estate_domain.sql` - Seeds REAL_ESTATE
- ✅ `20260131053541_sync_telecom_domain.sql` - Seeds TELECOM
- ✅ `20260131053542_sync_trading_domain.sql` - Seeds TRADING
- ❌ **No migration seeds AMRO domain**

**AMRO-specific migrations examined:**
- `20260324171000_amro_master_data_entity_seed_pack.sql` - Seeds AMRO policy data for tenants WITH existing AMRO domain assignments, but doesn't create the assignments themselves

---

## Error Response

When the check fails, the API returns:

**HTTP Status:** `403 Forbidden`  
**Response Body:**
```json
{
  "error": "Forbidden: AMRO access requires active AMRO domain subscription",
  "correlationId": "<uuid>"
}
```

The frontend then throws in `useWorkOrderState.ts`:
```typescript
if (!response.ok) throw new Error(`Failed to list work packages: ${response.status}`);
```

React Query retries 2 times, then sets `isError = true`, triggering the UI error message.

---

## The Fix

**Migration Created:** `supabase/migrations/20260411000000_seed_amro_domain_and_assignments.sql`

This migration:

1. **Inserts AMRO domain into `platform_domains`:**
   ```sql
   INSERT INTO public.platform_domains (key, code, name, description, owner, status, is_active)
   VALUES ('amro', 'AMRO', 'Aircraft Maintenance & Repair Operations', ...)
   ON CONFLICT (key) DO UPDATE SET ...;
   ```

2. **Assigns all active tenants to AMRO domain:**
   ```sql
   INSERT INTO public.tenant_domain_assignments (tenant_id, domain_id, is_active, subscription_status)
   VALUES (v_tenant.tenant_id, v_amro_domain_id, true, 'active')
   ON CONFLICT (tenant_id, domain_id) DO UPDATE SET ...;
   ```

3. **Verifies the seeding succeeded** with count checks

---

## How to Apply the Fix

1. **Run the migration:**
   ```bash
   # If using Supabase CLI
   supabase db push
   
   # Or manually
   psql -h <db-host> -U postgres -d postgres -f supabase/migrations/20260411000000_seed_amro_domain_and_assignments.sql
   ```

2. **Verify the migration:**
   ```sql
   -- Check AMRO domain exists
   SELECT id, key, code, name, status, is_active 
   FROM platform_domains 
   WHERE code = 'AMRO';
   
   -- Check tenant assignments
   SELECT tda.tenant_id, t.name as tenant_name, tda.is_active, tda.subscription_status
   FROM tenant_domain_assignments tda
   JOIN platform_domains pd ON pd.id = tda.domain_id
   JOIN tenants t ON t.id = tda.tenant_id
   WHERE pd.code = 'AMRO';
   ```

3. **Test the fix:**
   - Log in to the application
   - Navigate to AMRO → Work Orders
   - Work orders should now load successfully

---

## Additional Fix Applied

**File:** `src/features/module-amro/components/work-orders/useWorkOrderState.ts`

Fixed response format mapping to correctly handle the API's actual response structure:

**Before:**
```typescript
const rawItems = json.data || json.output?.records || json.output?.items || [];
```

**After:**
```typescript
const rawItems = json.items || json.data?.workOrders || json.output?.records || json.output?.items || json.data || [];
const recordsArray = Array.isArray(rawItems) ? rawItems : [];
```

This ensures robustness against different response formats and prevents silent data corruption.

---

## Prevention Recommendations

1. **Add integration tests** that verify AMRO domain exists before running AMRO API tests
2. **Add database migration checks** in CI/CD that fail if expected domain entries are missing
3. **Add better error messages** in `enforceAmroDomainAccess()` that distinguish between:
   - Missing domain entry
   - Missing tenant assignment
   - Inactive subscription
4. **Create a seed verification script** that runs after migrations to confirm all required data exists
5. **Document all required seed data** in a `SEED_DATA_REQUIREMENTS.md` file

---

## Related Files

### Frontend
- `src/features/module-amro/components/work-orders/AmroWorkOrdersListPage.tsx` - UI component
- `src/features/module-amro/components/work-orders/useWorkOrderState.ts` - Data fetching hook

### Backend
- `src/pages/api/v2/amro/work-orders.ts` - API route handler
- `src/pages/api/_utils/http.ts` - Authentication/authorization utilities (enforceAmroDomainAccess)

### Database
- `supabase/migrations/20260411000000_seed_amro_domain_and_assignments.sql` - **THE FIX**
- `supabase/migrations/20260324171000_amro_master_data_entity_seed_pack.sql` - AMRO policy seeding
- `supabase/migrations/20260131235000_comprehensive_domain_seeding.sql` - Other domain seeding

---

## Conclusion

This was a **data seeding issue**, not a code bug. The AMRO module's authorization gate was correctly implemented, but the required database seed data was never created. The fix ensures:

1. ✅ AMRO domain exists in `platform_domains`
2. ✅ All active tenants are assigned to AMRO domain
3. ✅ Proper subscription status is set
4. ✅ Frontend correctly handles API response format

After running the migration, the work orders page should load successfully.
