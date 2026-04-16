# AMRO Module Visibility Issue: `<mailto:deccanl@gmail.com>`

## Root Cause Analysis

The user `deccanl@gmail.com` cannot see the AMRO module option because **one or more access gates are blocking it**.

### How AMRO Module Visibility Works

The AMRO module has a **multi-layer security gate** system:

#### Gate 1: Domain Assignment (SIDEBAR VISIBILITY)
**File:** `src/components/navigation/CommandCenterNav.tsx` (line 166-172)

```typescript
const hasAmroDomain = isPlatformAdmin
    || isAuthPlatformAdmin()
    || hasRole('platform_admin')
    || availableDomains.some((domain) => String(domain.code || '').trim().toUpperCase() === 'AMRO');
```

**What this checks:**
- Is the user a platform admin? (show AMRO)
- OR does the user's tenant have an active AMRO domain assignment? (show AMRO)

If `hasAmroDomain` is **false**, the AMRO module is **completely hidden** from the sidebar.

#### Gate 2: Per-Item Permissions (MENU ITEM VISIBILITY)
**File:** `src/config/navigation.ts` (lines 107-122)

Each AMRO sub-menu item requires specific permissions:

| Menu Item | Required Permission |
|-----------|-------------------|
| Overview | `view_amro_dashboard` |
| Aircraft | `edit_aircraft_records` |
| Work Packages Templates | `edit_aircraft_records` |
| Work Packages | `create_maintenance_request` |
| Task Execution | `create_maintenance_request` |
| Scheduling | `edit_aircraft_records` |
| Parts | `edit_aircraft_records` |
| Compliance | `approve_work_orders` |
| Certification | `approve_work_orders` |
| Audit | `delete_flight_logs` |
| Integration | `edit_aircraft_records` |
| Intelligence | `view_amro_dashboard` |
| Settings | `edit_aircraft_records` |
| Workspace Documentation | `view_amro_dashboard` |

#### Gate 3: Workspace Access (PAGE ACCESS)
**File:** `src/features/module-amro/hooks/useAmroWorkspaceState.ts` (lines 590-623)

```typescript
const hasAmroAccess = hasAmroPermissionScope && hasAmroDomainAssignment && isAmroDomainActive;
```

This requires:
1. `hasAmroPermissionScope` - User has admin role OR broad permissions like `dashboards.view`
2. `hasAmroDomainAssignment` - Tenant has AMRO domain assigned
3. `isAmroDomainActive` - AMRO is the currently selected domain

#### Gate 4: Route Protection
**File:** `src/App.tsx` (lines 878-911)

All AMRO routes have `requiredDomainCode="AMRO"`, which blocks access if the user's tenant doesn't have AMRO domain assigned.

---

## Why `<mailto:deccanl@gmail.com>` is Blocked

### Most Likely Cause: Missing AMRO Domain Assignment

The user's tenant does **NOT** have an active AMRO domain assignment in the `tenant_domain_assignments` table.

**To verify this, run the diagnostic query:**

```bash
# Copy the SQL file content and run it in Supabase SQL Editor
cat scripts/diagnose_amro_access_deccanl.sql
```

Or manually check:

```sql
-- Find user's tenant
SELECT p.id, p.email, p.tenant_id
FROM profiles p
WHERE p.email = 'deccanl@gmail.com';

-- Check for AMRO domain assignment (replace <tenant_id> with result from above)
SELECT tda.*, pd.code as domain_code
FROM tenant_domain_assignments tda
JOIN platform_domains pd ON pd.id = tda.domain_id
WHERE tda.tenant_id = '<tenant_id>'
  AND tda.is_active = true;
```

**If this returns no rows, that's the problem!**

---

## How to Fix

### Step 1: Apply the AMRO Domain Seeding Migration

This will automatically assign AMRO domain to ALL active tenants (including `<mailto:deccanl@gmail.com>`'s tenant):

```bash
SUPABASE_DB_PASSWORD='your-db-password' bash scripts/supabase-remote.sh push --include-all
```

This migration (`20260411000000_seed_amro_domain_and_assignments.sql`) does:
1. ✅ Adds missing `subscription_status` and `grace_until` columns
2. ✅ Creates AMRO domain in `platform_domains`
3. ✅ Assigns AMRO domain to all active tenants

### Step 2: Manually Assign AMRO to Specific Tenant (Alternative)

If you only want to assign AMRO to `<mailto:deccanl@gmail.com>`'s tenant:

```sql
-- Find the tenant ID
SELECT p.tenant_id
FROM profiles p
WHERE p.email = 'deccanl@gmail.com';

-- Assign AMRO domain (replace <tenant_id> with the result)
INSERT INTO tenant_domain_assignments (tenant_id, domain_id, is_active, subscription_status)
VALUES (
  '<tenant_id>',
  (SELECT id FROM platform_domains WHERE code = 'AMRO'),
  true,
  'active'
)
ON CONFLICT (tenant_id, domain_id) 
DO UPDATE SET is_active = true, subscription_status = 'active', updated_at = NOW();
```

### Step 3: Verify User's Role and Permissions

Check what role the user has:

```sql
SELECT ur.role, ur.tenant_id, ur.franchise_id
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE au.email = 'deccanl@gmail.com';
```

**Role-based AMRO permissions:**

| Role | AMRO Access Level |
|------|------------------|
| `platform_admin` | Full access to all AMRO items |
| `tenant_admin` | Full access to all AMRO items |
| `franchise_admin` | Full access to all AMRO items |
| `user` | Only Overview & Workspace Documentation (has `view_amro_dashboard` only) |

**If the user has `user` role**, they will only see:
- ✅ Overview
- ✅ Workspace Documentation

**To see ALL AMRO items**, the user needs one of:
- `tenant_admin` role
- `franchise_admin` role
- `platform_admin` role
- OR custom permissions added via `user_custom_permissions` table

### Step 4: Grant Full AMRO Access (Optional)

If the user should see ALL AMRO menu items, grant them `tenant_admin` role:

```sql
-- Update user's role (replace <user_id> with actual ID)
UPDATE user_roles
SET role = 'tenant_admin'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'deccanl@gmail.com'
);
```

OR add custom permissions to grant all AMRO permissions:

```sql
-- Add all AMRO permissions for the user
INSERT INTO user_custom_permissions (user_id, permission, tenant_id)
SELECT 
  au.id,
  perm.permission,
  ur.tenant_id
FROM auth.users au
JOIN user_roles ur ON ur.user_id = au.id
CROSS JOIN (
  VALUES 
    ('view_amro_dashboard'),
    ('edit_aircraft_records'),
    ('create_maintenance_request'),
    ('approve_work_orders'),
    ('delete_flight_logs')
) AS perm(permission)
WHERE au.email = 'deccanl@gmail.com'
ON CONFLICT DO NOTHING;
```

### Step 5: Have the User Refresh

After making database changes:
1. **Hard refresh the browser** (Ctrl+Shift+R or Cmd+Shift+R)
2. Or **log out and log back in**
3. The DomainContext will reload `availableDomains` and AMRO should appear

---

## Quick Diagnostic Checklist

Run through these checks in order:

```sql
-- 1. Does the user exist and have a tenant?
SELECT p.email, p.tenant_id, t.name as tenant_name
FROM profiles p
LEFT JOIN tenants t ON t.id = p.tenant_id
WHERE p.email = 'deccanl@gmail.com';
-- ❌ If no rows: User doesn't exist in profiles
-- ❌ If tenant_id is NULL: User has no tenant assigned

-- 2. Does AMRO domain exist?
SELECT id, code, name, is_active 
FROM platform_domains 
WHERE code = 'AMRO';
-- ❌ If no rows: Run the migration

-- 3. Does the tenant have AMRO domain assigned?
SELECT tda.is_active, tda.subscription_status
FROM tenant_domain_assignments tda
JOIN profiles p ON p.tenant_id = tda.tenant_id
JOIN platform_domains pd ON pd.id = tda.domain_id
WHERE p.email = 'deccanl@gmail.com'
  AND pd.code = 'AMRO'
  AND tda.is_active = true;
-- ❌ If no rows: This is the problem! Assign AMRO domain to tenant

-- 4. What role does the user have?
SELECT ur.role
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE au.email = 'deccanl@gmail.com';
-- If 'user': Only sees Overview & Workspace Documentation
-- If 'tenant_admin' or 'platform_admin': Should see all items

-- 5. Does the user have AMRO permissions?
SELECT ucp.permission
FROM user_custom_permissions ucp
JOIN auth.users au ON au.id = ucp.user_id
WHERE au.email = 'deccanl@gmail.com'
  AND ucp.permission IN (
    'view_amro_dashboard',
    'edit_aircraft_records',
    'create_maintenance_request',
    'approve_work_orders',
    'delete_flight_logs'
  );
-- Check which AMRO permissions are granted
```

---

## Debug via Browser Console

Have `<mailto:deccanl@gmail.com>` open browser console (F12) and look for:

```javascript
// These logs will appear:
[DomainService] authorized domains loaded: {count: X, isPlatformAdmin: false}
// If count doesn't include AMRO, domain assignment is missing
```

Or manually check in console:

```javascript
// Check available domains
fetch('/api/v1/platform-domains')
  .then(r => r.json())
  .then(d => console.log('Domains:', d.data))
  .then(d => console.log('Has AMRO:', d.data.some(dom => dom.code === 'AMRO')));
```

---

## Summary of Required Fixes

| Issue | Fix |
|-------|-----|
| AMRO domain doesn't exist in `platform_domains` | Run migration: `supabase db push --include-all` |
| Tenant has no AMRO domain assignment | Run migration OR manually insert assignment |
| User has `user` role (limited permissions) | Upgrade to `tenant_admin` OR add custom permissions |
| `subscription_status` column missing | Run migration (adds it automatically) |
| Frontend caching issue | Hard refresh browser (Ctrl+Shift+R) |

---

## Files Involved

- `src/components/navigation/CommandCenterNav.tsx` - Sidebar AMRO visibility gate
- `src/contexts/DomainContext.tsx` - Loads available domains
- `src/services/DomainService.ts` - API calls for domain data
- `src/features/module-amro/hooks/useAmroWorkspaceState.ts` - AMRO access check hook
- `src/config/navigation.ts` - AMRO menu items with permissions
- `src/config/permissions.ts` - Role-to-permission mappings
- `src/components/auth/ProtectedRoute.tsx` - Route-level protection
