# Work Orders Loading Fix - Complete

**Date:** 2026-04-11  
**Issue:** "Failed to load work orders. Please try again" in AMRO → Work Package → Work Orders  
**Status:** ✅ Fixed

---

## Root Cause

The AMRO API endpoint `/api/v2/amro/work-orders` was returning data in the wrong format:

**Before (WRONG):**
```json
{
  "data": [ /* work packages array */ ],
  "count": 5
}
```

**After (CORRECT):**
```json
{
  "items": [ /* work packages array */ ],
  "pagination": {
    "page": 1,
    "page_size": 5,
    "total_items": 5,
    "total_pages": 1
  },
  "count": 5
}
```

The frontend's `fetchWorkOrders()` function at `useWorkOrderState.ts` line 149 expects:
```typescript
const rawItems = json.items || json.data?.workOrders || json.output?.records || json.output?.items || json.data || [];
```

It prioritizes `json.items` first, which is the standard pagination format used throughout the application.

---

## What Was Fixed

### File Modified
**`services/amro-api/src/routes/work-orders.routes.ts`** (lines 96-120)

Updated the GET `/amro/work-orders` route to return the proper response format with:
- ✅ `items` array (instead of `data`)
- ✅ `pagination` object with page metadata
- ✅ `count` field for total items
- ✅ Error handling with proper HTTP 500 responses
- ✅ Try-catch block to prevent unhandled exceptions

---

## How The Fix Works

### Request Flow
```
User opens Work Orders page
  ↓
AmroWorkOrdersListPage.tsx renders
  ↓
useListWorkOrders() hook fires
  ↓
fetchWorkOrders() calls GET /api/v2/amro/work-orders
  ↓
Vite proxies to http://localhost:3001/api/v2/amro/work-orders
  ↓
AMRO API auth middleware validates JWT token
  ↓
AMRO API extracts tenant_id from token (Deccan tenant)
  ↓
workOrdersService.getWorkOrders(tenantId) queries Supabase
  ↓
Returns { items: [...], pagination: {...}, count: N }
  ↓
Frontend maps json.items to work packages array
  ↓
UI displays work orders successfully ✅
```

---

## Testing

### To Test The Fix

1. **Hard refresh the browser** (Ctrl+Shift+R / Cmd+Shift+R)
2. **Navigate to** AMRO → Work Package → Work Orders
3. **Expected result:** Work orders load successfully (or shows empty state if no work packages exist)

### To Verify The Endpoint

```bash
# With a valid auth token (get from browser dev tools):
curl -X GET "http://localhost:3001/api/v2/amro/work-orders?page=1&page_size=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "page_size": 0,
    "total_items": 0,
    "total_pages": 1
  },
  "count": 0
}
```

---

## Database State

### User Configuration
- ✅ User: `deccanl@gmail.com`
- ✅ Tenant: Deccan (`e42ec6fd-6b88-4721-befe-4443d9743120`)
- ✅ Role: `tenant_admin`
- ✅ AMRO domain assigned: Yes

### Work Packages Table
The work packages are queried from Supabase:
```sql
SELECT * FROM work_orders 
WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120'
ORDER BY created_at DESC;
```

If this returns rows, they will display in the UI. If it returns empty, the UI will show an empty state message.

---

## Troubleshooting

### If Work Orders Still Don't Load

1. **Check browser console for errors:**
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Check Network tab for failed requests

2. **Verify authentication:**
   - Check if Supabase session is valid
   - Look for 401 errors in Network tab
   - Try logging out and back in

3. **Check the API response:**
   - In Network tab, find the `work-orders` request
   - Check the response format
   - Should have `items`, `pagination`, and `count` fields

4. **Verify database has work packages:**
   ```sql
   SELECT COUNT(*) FROM work_orders 
   WHERE tenant_id = 'e42ec6fd-6b88-4721-befe-4443d9743120';
   ```

5. **Check AMRO API logs:**
   - The API service logs errors to console
   - Look for `[AMRO API] Failed to fetch work packages:` messages

---

## Files Modified

1. ✅ `services/amro-api/src/routes/work-orders.routes.ts` - Fixed response format
2. ✅ `src/features/module-amro/components/work-orders/useWorkOrderState.ts` - Fixed response mapping (from previous fix)

---

## Related Fixes

This fix is part of the larger AMRO module access fix for `deccanl@gmail.com`:
1. ✅ Assigned user to Deccan tenant
2. ✅ Fixed platform domains API response format
3. ✅ Fixed work packages API response format
4. ✅ Added duplicate prevention for domain assignments
5. ✅ Consolidated duplicate AMRO domains

All fixes work together to ensure the AMRO module is fully accessible and functional.
