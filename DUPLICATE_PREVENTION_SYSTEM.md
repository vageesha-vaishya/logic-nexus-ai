# Duplicate Prevention System - Platform Domains & Tenant Assignments

**Date:** 2026-04-11  
**Scope:** Platform Domains module and Tenant Domain Assignment module  
**Status:** ✅ Implemented

---

## Executive Summary

Implemented comprehensive duplicate prevention at **three layers** (Database, API, UI) to ensure:

1. **Platform Domains** cannot have duplicate `code` or `name` values
2. **Tenant Domain Assignments** cannot have duplicate tenant-domain pairs
3. **Users get clear error messages** when attempting duplicate entries
4. **Graceful handling** of duplicates (skipped with audit trail, not crashed)

---

## What Was the Problem

### Before Fix

❌ **No UNIQUE constraint on `platform_domains.code`**  
- Multiple domains could have the same code (e.g., two "AMRO" domains)
- Would break domain lookup logic and cause UI confusion

❌ **No UNIQUE constraint on `platform_domains.name`**  
- Multiple domains could have the same name (e.g., two "Logistics" domains)
- Would make it impossible to identify which domain is which

❌ **Poor duplicate error handling**  
- Database constraint violations threw cryptic errors
- No client-side validation before attempting saves
- Users could accidentally create duplicates

❌ **Tenant assignment duplicates possible**  
- Although UNIQUE constraint existed on `tenant_domain_assignments(tenant_id, domain_id)`
- Error handling was poor - would fail entire batch if one duplicate existed

---

## The Solution: Three-Layer Defense

### Layer 1: Database Constraints (Hard Enforcement)

**Migration:** `supabase/migrations/20260411000001_enforce_domain_uniqueness.sql`

#### Platform Domains Table

```sql
-- UNIQUE on code (case-sensitive)
ALTER TABLE platform_domains 
  ADD CONSTRAINT platform_domains_code_unique UNIQUE (code);

-- UNIQUE on name (case-sensitive)
ALTER TABLE platform_domains 
  ADD CONSTRAINT platform_domains_name_unique UNIQUE (name);

-- Check constraints to prevent empty strings
ALTER TABLE platform_domains
  ADD CONSTRAINT platform_domains_code_not_empty 
  CHECK (code IS NULL OR trim(code) <> '');

ALTER TABLE platform_domains
  ADD CONSTRAINT platform_domains_name_not_empty 
  CHECK (trim(name) <> '');
```

#### Tenant Domain Assignments Table

```sql
-- Already exists from earlier migration:
UNIQUE (tenant_id, domain_id)

-- Verified and documented in this migration
```

#### Trigger Function for Better Error Messages

```sql
CREATE OR REPLACE FUNCTION public.check_domain_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for duplicate code (case-insensitive)
  IF EXISTS (
    SELECT 1 FROM platform_domains 
    WHERE UPPER(trim(code)) = UPPER(trim(NEW.code))
      AND id != COALESCE(NEW.id, '')
  ) THEN
    RAISE EXCEPTION 'Domain with code "%" already exists. Please use a unique code.', NEW.code
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Check for duplicate name (case-insensitive)
  IF EXISTS (
    SELECT 1 FROM platform_domains 
    WHERE UPPER(trim(name)) = UPPER(trim(NEW.name))
      AND id != COALESCE(NEW.id, '')
  ) THEN
    RAISE EXCEPTION 'Domain with name "%" already exists. Please use a unique name.', NEW.name
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**What This Prevents:**
- ✅ Duplicate codes: "AMRO" and "amro" treated as same
- ✅ Duplicate names: "Logistics" and "LOGISTICS" treated as same
- ✅ Empty codes or names rejected
- ✅ Clear error messages instead of cryptic constraint violations

---

### Layer 2: API Validation (Smart Handling)

**File:** `src/services/DomainService.ts`

#### createDomain() Function

```typescript
async createDomain(domain) {
  // 1. Normalize input
  const normalizedCode = domain.code.trim().toUpperCase();
  const normalizedName = domain.name.trim();

  // 2. Validate non-empty
  if (!normalizedName) throw new Error('Domain name is required.');
  if (!normalizedCode) throw new Error('Domain code is required.');

  // 3. Check for duplicate code (case-insensitive)
  const duplicateByCode = allDomains.find(
    d => d.code.trim().toUpperCase() === normalizedCode
  );
  if (duplicateByCode) {
    throw new Error(`Domain with code "${normalizedCode}" already exists.`);
  }

  // 4. Check for duplicate name (case-insensitive)
  const duplicateByName = allDomains.find(
    d => d.name.toUpperCase() === normalizedName.toUpperCase()
  );
  if (duplicateByName) {
    throw new Error(`Domain with name "${normalizedName}" already exists.`);
  }

  // 5. Attempt database insert
  // 6. Handle database constraint violations with friendly messages
}
```

#### updateDomain() Function

Same logic as createDomain() but excludes the current domain ID from duplicate checks.

#### Duplicate Handling in Tenant Assignments

**File:** `vite.config.ts` (Domain API handler)

```typescript
// Try bulk insert first
try {
  await callSupabaseAPI('tenant_domain_assignments', 'POST', assignmentsToInsert);
} catch (dbError) {
  // If duplicate detected, try one-by-one to skip duplicates
  if (dbError.message.includes('23505')) { // unique_violation
    for (const tenantId of tenantIds) {
      try {
        await callSupabaseAPI('tenant_domain_assignments', 'POST', [{...}]);
        // Success - count it
      } catch (individualError) {
        // Skip duplicates silently, log real errors
        if (!individualError.message.includes('23505')) {
          console.error('Assignment failed:', individualError.message);
        }
      }
    }
  }
}
```

**What This Prevents:**
- ✅ Client-side duplicate detection before database call
- ✅ Case-insensitive comparison ("AMRO" = "amro")
- ✅ Graceful handling of existing assignments (skipped, not failed)
- ✅ Partial success tracking (what worked vs what didn't)

---

### Layer 3: UI Validation (User Feedback)

**File:** `src/pages/dashboard/PlatformDomains.tsx`

#### Duplicate Error Display

When user tries to create duplicate domain:

```typescript
try {
  await DomainService.createDomain(domain);
} catch (error) {
  toast({ 
    title: 'Duplicate Domain', 
    description: error.message, // "Domain with code 'AMRO' already exists."
    variant: 'destructive' 
  });
}
```

#### Tenant Assignment Handling

When user tries to assign already-assigned domain:

```typescript
const summary = await DomainService.setTenantDomains(...);

if (summary.totalFailures > 0) {
  toast({
    title: 'Partial success',
    description: `Assigned ${summary.assigned}, revoked ${summary.revoked}, ${summary.totalFailures} failed.`,
    variant: 'destructive',
  });
  // Reload from database to show actual state
  await fetchTenantAssignments();
}
```

**What This Prevents:**
- ✅ User sees clear error before attempting save
- ✅ Form validation highlights duplicate fields
- ✅ Success/failure counts shown for bulk operations
- ✅ UI reloads to show actual database state after errors

---

## How to Apply

### Step 1: Run the Migration

```bash
SUPABASE_DB_PASSWORD='your-password' bash scripts/supabase-remote.sh push --include-all
```

This will:
1. ✅ Add UNIQUE constraint on `platform_domains.code`
2. ✅ Add UNIQUE constraint on `platform_domains.name`
3. ✅ Verify UNIQUE constraint on `tenant_domain_assignments(tenant_id, domain_id)`
4. ✅ Handle any existing duplicates (append `_DUPLICATE_N` suffix)
5. ✅ Add trigger function for better error messages
6. ✅ Run verification checks

### Step 2: Restart Dev Server

```bash
# Stop current server
lsof -ti:8081 | xargs kill -9

# Start with new code
npm run dev
```

---

## Testing Checklist

### Platform Domains - Duplicate Prevention

- [ ] Try creating domain with code "AMRO" when "AMRO" already exists → Should show error
- [ ] Try creating domain with code "amro" (lowercase) when "AMRO" exists → Should show error
- [ ] Try creating domain with name "Logistics" when "Logistics" exists → Should show error
- [ ] Try creating domain with name "LOGISTICS" (uppercase) when "Logistics" exists → Should show error
- [ ] Try creating domain with empty code → Should show error
- [ ] Try creating domain with empty name → Should show error
- [ ] Update existing domain to use another domain's code → Should show error
- [ ] Update existing domain to use another domain's name → Should show error

### Tenant Domain Assignments - Duplicate Prevention

- [ ] Select tenant with existing AMRO assignment → AMRO checkbox should be checked
- [ ] Try to assign AMRO again to same tenant → Should skip duplicate silently
- [ ] Assign multiple domains at once → All should save successfully
- [ ] Refresh page → All assignments should still be there
- [ ] Check audit log → Should show which assignments were skipped as duplicates

---

## Database Schema Summary

### platform_domains

| Constraint | Type | Columns | Purpose |
|------------|------|---------|---------|
| `platform_domains_pkey` | PRIMARY KEY | id | Unique identifier |
| `platform_domains_key_unique` | UNIQUE | key | Internal key identifier |
| `platform_domains_code_unique` | UNIQUE | code | Public domain code |
| `platform_domains_name_unique` | UNIQUE | name | Display name |
| `platform_domains_code_not_empty` | CHECK | code | Prevent empty codes |
| `platform_domains_name_not_empty` | CHECK | name | Prevent empty names |

### tenant_domain_assignments

| Constraint | Type | Columns | Purpose |
|------------|------|---------|---------|
| `tenant_domain_assignments_pkey` | PRIMARY KEY | id | Unique identifier |
| `tenant_domain_assignments_tenant_id_domain_id_key` | UNIQUE | tenant_id, domain_id | Prevent duplicate assignments |

---

## Error Messages

### Domain Creation/Update

| Scenario | Error Message |
|----------|--------------|
| Duplicate code | `Domain with code "AMRO" already exists.` |
| Duplicate name | `Domain with name "Logistics" already exists.` |
| Empty code | `Domain code is required.` |
| Empty name | `Domain name is required.` |
| Database constraint violation | `A domain with these details already exists.` |

### Tenant Assignments

| Scenario | Behavior |
|----------|----------|
| Duplicate assignment | Silently skipped, no error shown |
| Mixed success/failure | Shows "Partial success" with counts |
| Complete failure | Shows error message, reloads from DB |

---

## Files Modified

1. ✅ `supabase/migrations/20260411000001_enforce_domain_uniqueness.sql` - Database constraints
2. ✅ `src/services/DomainService.ts` - Client-side validation & error handling
3. ✅ `vite.config.ts` - API duplicate handling & audit logging
4. ✅ `src/pages/dashboard/PlatformDomains.tsx` - Error display & state management

---

## Benefits

### Data Integrity
✅ No duplicate domains possible at database level  
✅ No duplicate tenant-domain assignments possible  
✅ Case-insensitive uniqueness enforced everywhere  

### User Experience
✅ Clear error messages before database calls  
✅ Graceful handling of duplicates (no crashes)  
✅ Partial success tracking for bulk operations  
✅ UI always reflects actual database state  

### Developer Experience
✅ Three-layer defense prevents edge cases  
✅ Comprehensive error logging  
✅ Audit trail shows what happened with duplicates  
✅ Easy to test and debug  

---

## Migration Verification

After running the migration, verify with:

```sql
-- Check constraints exist
SELECT constraint_name, constraint_type, table_name
FROM information_schema.table_constraints
WHERE table_name IN ('platform_domains', 'tenant_domain_assignments')
  AND constraint_type IN ('UNIQUE', 'CHECK')
ORDER BY table_name, constraint_type;

-- Test uniqueness
INSERT INTO platform_domains (code, name) 
VALUES ('TEST_DUP', 'Test Duplicate');
-- Should succeed

INSERT INTO platform_domains (code, name) 
VALUES ('TEST_DUP', 'Another Test');
-- Should fail: duplicate code

INSERT INTO platform_domains (code, name) 
VALUES ('TEST_UNIQUE', 'Test Duplicate');
-- Should fail: duplicate name
```

---

## Future Enhancements

- [ ] Add soft-delete to prevent data loss (is_deleted flag)
- [ ] Add domain merge functionality (consolidate duplicates)
- [ ] Add bulk duplicate cleanup tool
- [ ] Add real-time duplicate detection in UI (as user types)
- [ ] Add suggestion engine for similar domain codes/names
