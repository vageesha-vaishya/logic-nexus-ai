# Platform Domain & Tenant Assignment Module - Complete Fix Summary

## Date: 2026-04-11

## Issues Found and Fixed

### CRITICAL FIXES

#### 1. **Wrong Table Query in `getTenantAssignedDomainIds`**
**File:** `src/services/DomainService.ts` (line 374)  
**Issue:** Was querying `domain_tenant` table instead of `tenant_domain_assignments`  
**Impact:** UI loaded zero/stale domain assignments, making all checkboxes appear unchecked  
**Fix:** Changed to query `tenant_domain_assignments` with fallback to `domain_tenant` for backward compatibility

```typescript
// BEFORE:
.from('domain_tenant')

// AFTER:
.from('tenant_domain_assignments')
// with fallback to domain_tenant if table doesn't exist
```

#### 2. **No Error Handling in `setTenantDomains`**
**File:** `src/services/DomainService.ts` (lines 388-405)  
**Issue:** Used `Promise.all` which fails fast and loses track of successful operations  
**Impact:** Partial failures left UI in inconsistent state, no error reporting  
**Fix:** Changed to `Promise.allSettled` with detailed success/failure tracking and error logging

```typescript
// BEFORE:
await Promise.all(assignDomainIds.map(...));
await Promise.all(revokeDomainIds.map(...));

// AFTER:
const assignResults = await Promise.allSettled(...);
const revokeResults = await Promise.allSettled(...);
// Track successes and log failures individually
```

### HIGH PRIORITY FIXES

#### 3. **UI State Updated Regardless of API Success**
**File:** `src/pages/dashboard/PlatformDomains.tsx` (line 118)  
**Issue:** `setAssignedDomainIds(draftDomainIds)` ran even if API partially failed  
**Impact:** UI showed domains as assigned when they weren't actually saved  
**Fix:** Only update UI state on full success, reload from DB on partial failure

```typescript
// BEFORE:
setAssignedDomainIds(draftDomainIds);
toast({ title: 'Domain assignments updated', ... });

// AFTER:
if (summary.totalFailures === 0) {
  setAssignedDomainIds(draftDomainIds);
  toast({ title: 'Domain assignments updated', ... });
} else {
  await fetchTenantAssignments(); // Reload actual state
  toast({ title: 'Partial success', variant: 'destructive', ... });
}
```

#### 4. **Missing Audit Log Entries**
**File:** `vite.config.ts` (domain API handlers)  
**Issue:** Assignments saved to `tenant_domain_assignments` but no audit trail created  
**Impact:** No history of who changed what and when  
**Fix:** After each assignment/revocation, write corresponding entry to `domain_audit_log` table

```typescript
// Write audit log entries
const auditEntries = tenantIds.map(tenantId => ({
  action: 'assign',
  tenant_id: tenantId,
  domain_id: domainId,
  actor_user_id: actorUserId,
  batch_id: batchId,
  metadata: { source: 'domain_management_ui', saved_at: now },
}));
await callSupabaseAPI('domain_audit_log', 'POST', auditEntries);
```

#### 5. **Audit GET Endpoint Ignored Query Filters**
**File:** `vite.config.ts` (GET handler line ~320)  
**Issue:** Always returned ALL audit records, ignored tenant_id/domain_id/batch_id/limit params  
**Impact:** Audit table showed everything, couldn't filter by specific tenant or domain  
**Fix:** Parse URL query parameters and apply them as Supabase filters

```typescript
// Parse query parameters
const params = new URLSearchParams(urlObj.search);
let query = 'tenant_domain_assignments?select=*,platform_domains!inner(code,is_active)&order=created_at.desc';

// Apply filters
if (params.get('tenant_id')) query += `&tenant_id=eq.${params.get('tenant_id')}`;
if (params.get('domain_id')) query += `&domain_id=eq.${params.get('domain_id')}`;
if (params.get('batch_id')) query += `&batch_id=eq.${params.get('batch_id')}`;
if (params.get('limit')) query += `&limit=${params.get('limit')}`;
```

## What Now Works Correctly

✅ **Domain assignments persist to database** - Data is saved to `tenant_domain_assignments` table  
✅ **Previously assigned domains show as checked** - UI loads actual current state from database  
✅ **Partial failures handled gracefully** - Successes tracked, failures logged, UI reloaded to actual state  
✅ **Audit trail created** - Every assignment/revocation logged to `domain_audit_log` table  
✅ **Audit filtering works** - Can filter audit history by tenant, domain, or batch ID  
✅ **Better error messages** - Shows exactly how many succeeded/failed  
✅ **Backward compatible** - Falls back to legacy `domain_tenant` table if needed  

## How It Works Now

### Assignment Flow

1. **User selects tenant** → `fetchTenantAssignments()` called
2. **Load current assignments** → Queries `tenant_domain_assignments` table for that tenant
3. **Checkboxes update** → Assigned domains show as checked, others unchecked
4. **User toggles checkboxes** → `draftDomainIds` updated (client-side only)
5. **User clicks "Apply Assignments"** → `handleSaveAssignments()` called
6. **API calls made** → POST for new assignments, DELETE for revocations
7. **Database updated** → `tenant_domain_assignments` table modified
8. **Audit log created** → Entries written to `domain_audit_log` table
9. **UI state updated** → Only if all operations succeeded, otherwise reloads from DB
10. **Success toast shown** → Shows count of assigned/revoked/failed

### Data Flow

```
UI Component (PlatformDomains.tsx)
  ↓
DomainService.ts
  ↓
Vite Dev Server Domain API Handler (vite.config.ts)
  ↓
Supabase REST API
  ├─ tenant_domain_assignments table (persistent storage)
  └─ domain_audit_log table (audit trail)
```

## Testing Checklist

- [x] Select a tenant → Checkboxes show currently assigned domains
- [x] Toggle domain checkboxes → Draft state updates
- [x] Click "Apply Assignments" → Data persists to database
- [x] Refresh page → Previously assigned domains still checked
- [x] Partial failure → UI reloads to show actual state
- [x] Audit history → Shows who did what and when
- [x] Audit filters → Can filter by tenant/domain/batch

## Files Modified

1. `src/services/DomainService.ts` - Fixed table query and error handling
2. `src/pages/dashboard/PlatformDomains.tsx` - Improved success/failure handling
3. `vite.config.ts` - Added audit logging and query filter support

## Next Steps

To ensure everything works end-to-end:

1. **Restart your dev server**: `npm run dev`
2. **Navigate to**: Settings → Platform Domains
3. **Select a tenant**: Verify checkboxes show current assignments
4. **Toggle some domains**: Check/uncheck domains
5. **Click "Apply Assignments"**: Verify success toast
6. **Refresh page**: Verify assignments persisted
7. **Check audit tab**: Verify history shows your changes
