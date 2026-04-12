# AMRO React Query Hooks Implementation Summary

**Date:** 2026-04-12  
**Status:** Phase 3 (React Query Hooks) - COMPLETE  
**Pattern:** Follows existing `useWorkPackageState.ts` conventions

---

## ✅ Completed React Query Hooks

### 1. Template Version Management (`useTemplateVersionState.ts`)

| Hook | Type | Purpose | Mutations |
|------|------|---------|-----------|
| `useListTemplateVersions` | Query | List versions for a template | - |
| `useTemplateVersion` | Query | Get single version details | - |
| `useCreateTemplateVersion` | Mutation | Create new version (draft) | ✓ |
| `useUpdateTemplateVersion` | Mutation | Update version (draft only) | ✓ |
| `useDeleteTemplateVersion` | Mutation | Delete version (draft only) | ✓ |
| `useSubmitTemplateVersion` | Mutation | Submit for review (draft → pending_review) | ✓ |
| `useReviewTemplateVersion` | Mutation | Approve/reject (pending_review → approved/draft) | ✓ |
| `useTemplateVersionActions` | Helper | Invalidate queries | ✓ |

**Features:**
- ✅ Automatic cache invalidation on mutations
- ✅ Optimistic updates support
- ✅ Type-safe with TypeScript
- ✅ Authentication handling
- ✅ Stale time configuration (30s)
- ✅ Retry logic (2 attempts)

---

### 2. Emergency Work Package Management (`useEmergencyWPState.ts`)

| Hook | Type | Purpose | Mutations |
|------|------|---------|-----------|
| `useListEmergencyWP` | Query | List emergency WPs | - |
| `useCreateEmergencyWP` | Mutation | Create emergency WP | ✓ |
| `useResolveEmergencyWP` | Mutation | Mark as resolved | ✓ |
| `useEmergencyWPActions` | Helper | Invalidate queries | ✓ |

**Features:**
- ✅ Filter by emergency type, urgency level, status
- ✅ Active/resolved status tracking
- ✅ Auto-prioritization support
- ✅ Real-time cache invalidation
- ✅ Stale time: 15s (faster for emergency data)

---

### 3. Non-Scheduled Task Management (`useNonScheduledTaskState.ts`)

| Hook | Type | Purpose | Mutations |
|------|------|---------|-----------|
| `useListNonScheduledTasks` | Query | List non-scheduled tasks | - |
| `useNonScheduledTask` | Query | Get single task details | - |
| `useCreateNonScheduledTask` | Mutation | Create task | ✓ |
| `useConvertNonScheduledTaskToWP` | Mutation | Convert to emergency WP | ✓ |
| `useNonScheduledTaskActions` | Helper | Invalidate queries | ✓ |

**Features:**
- ✅ Filter by aircraft, status, priority, task source
- ✅ Conversion to emergency WP with urgency mapping
- ✅ Task status tracking (reported → converted_to_wp)
- ✅ Required qualifications and materials support

---

### 4. Compliance Records Management (`useComplianceState.ts`)

| Hook | Type | Purpose | Mutations |
|------|------|---------|-----------|
| `useListComplianceRecords` | Query | List compliance records for WP | - |
| `useCreateComplianceRecord` | Mutation | Create compliance record | ✓ |
| `useCreateCertificate` | Mutation | Generate CRS | ✓ |
| `useComplianceActions` | Helper | Invalidate queries | ✓ |

**Features:**
- ✅ Filter by compliance type (AD/SB/inspection) and status
- ✅ Evidence attachment support
- ✅ Digital signature support
- ✅ Certificate number auto-generation
- ✅ License validation

---

## 📁 File Structure

```
src/features/module-amro/components/work-orders/
├── useWorkPackageState.ts              ✅ Existing (work packages)
├── useTemplateVersionState.ts          ✅ NEW (template versions)
├── useEmergencyWPState.ts              ✅ NEW (emergency WPs)
├── useNonScheduledTaskState.ts         ✅ NEW (non-scheduled tasks)
├── useComplianceState.ts               ✅ NEW (compliance records)
└── index.ts                            ✅ UPDATED (exports all hooks)
```

---

## 🔧 Usage Examples

### Template Version Management

```typescript
import { 
  useListTemplateVersions, 
  useCreateTemplateVersion,
  useSubmitTemplateVersion,
  useReviewTemplateVersion 
} from '@/features/module-amro/components/work-orders';

// List versions
const { data, isLoading } = useListTemplateVersions({
  templateId: 'uuid',
  page: 1,
  pageSize: 20,
  status: 'draft',
});

// Create version
const createMutation = useCreateTemplateVersion();
await createMutation.mutateAsync({
  template_id: 'uuid',
  change_description: 'Updated AD compliance',
  change_reason: 'New FAA directive',
  scope_json: { ata_chapters: ['29', '32'] },
  tasks_json: [...],
});

// Submit for review
const submitMutation = useSubmitTemplateVersion();
await submitMutation.mutateAsync(versionId);

// Approve
const reviewMutation = useReviewTemplateVersion();
await reviewMutation.mutateAsync({
  id: versionId,
  action: 'approve',
  set_active: true,
});
```

### Emergency Work Package

```typescript
import { 
  useListEmergencyWP, 
  useCreateEmergencyWP 
} from '@/features/module-amro/components/work-orders';

// List active emergencies
const { data } = useListEmergencyWP({
  status: 'active',
  urgencyLevel: 'immediate',
});

// Create emergency WP
const createEmergency = useCreateEmergencyWP();
await createEmergency.mutateAsync({
  aircraft_id: 'uuid',
  emergency_type: 'aog',
  urgency_level: 'immediate',
  reason: 'Engine oil pressure low',
  estimated_ground_time_hours: 24,
  response_team: ['user1', 'user2'],
});
```

### Non-Scheduled Task to WP Conversion

```typescript
import { 
  useListNonScheduledTasks,
  useConvertNonScheduledTaskToWP 
} from '@/features/module-amro/components/work-orders';

// List pilot reports
const { data } = useListNonScheduledTasks({
  taskSource: 'pilot_report',
  status: 'reported',
});

// Convert to WP
const convertMutation = useConvertNonScheduledTaskToWP();
await convertMutation.mutateAsync({
  id: taskId,
  urgency_level: 'urgent',
  assign_to_technician: 'user_id',
});
```

### Compliance Records

```typescript
import { 
  useListComplianceRecords,
  useCreateComplianceRecord,
  useCreateCertificate 
} from '@/features/module-amro/components/work-orders';

// List compliance records
const { data } = useListComplianceRecords({
  workPackageId: 'uuid',
  complianceType: 'AD',
});

// Create compliance record
const createCompliance = useCreateComplianceRecord();
await createCompliance.mutateAsync({
  work_package_id: 'uuid',
  compliance_type: 'AD',
  compliance_reference: '2024-15-07',
  compliance_method: 'Inspected per AD requirements',
  evidence_attachments: [{ type: 'photo', url: '...' }],
  certified_by: 'user_id',
  license_number: 'B1-12345',
});

// Generate CRS
const createCert = useCreateCertificate();
await createCert.mutateAsync({
  work_package_id: 'uuid',
  certifying_staff_id: 'user_id',
  staff_license_number: 'B1-12345',
  staff_license_type: 'B1',
  staff_license_expiry: '2025-12-31',
  work_description: 'A-check completed',
  regulations_complied: ['EASA Part-145', 'FAA 14 CFR Part 145'],
});
```

---

## 🎯 Design Patterns

### Consistent Patterns Across All Hooks

1. **Authentication**
   - All hooks use `useAuthHeaders()` from `@/hooks/useAuth`
   - Automatically disabled if not authenticated
   - Returns Promise.reject if headers missing

2. **Query Keys**
   - Structured as `['amro', 'resource', 'action', ...params]`
   - Enables granular cache invalidation
   - Prevents cache collisions

3. **Mutations**
   - All mutations auto-invalidate relevant queries
   - Support TypeScript types for inputs/outputs
   - Standardized error handling

4. **Stale Time**
   - Emergency data: 15s (more real-time)
   - Template versions: 30s (stable data)
   - Compliance records: 30s (stable data)

5. **Retry Logic**
   - All queries retry 2 times on failure
   - Exponential backoff (React Query default)

---

## 📊 Type Safety

All hooks are fully typed with TypeScript:

```typescript
// Status enums
export type TemplateVersionStatus = 'draft' | 'pending_review' | 'approved' | 'active' | 'deprecated' | 'archived';
export type EmergencyType = 'aog' | 'unscheduled_removal' | 'flight_delay_risk' | 'safety_issue' | 'technical_fault';
export type UrgencyLevel = 'immediate' | 'urgent' | 'priority' | 'routine';
export type TaskSource = 'pilot_report' | 'mechanic_report' | 'inspection_finding' | ...;
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical' | 'aog';
export type ComplianceType = 'AD' | 'SB' | 'inspection' | 'certification' | 'routine';

// Response interfaces
export interface TemplateVersionListResponse { records: TemplateVersion[]; total: number; page: number; page_size: number; }
export interface EmergencyWPListResponse { records: EmergencyWorkPackage[]; total: number; page: number; page_size: number; active_count: number; }
export interface NonScheduledTaskListResponse { records: NonScheduledTask[]; total: number; page: number; page_size: number; }
export interface ComplianceRecordListResponse { work_package_id: string; records: ComplianceRecord[]; total: number; }
```

---

## 🚀 Next Steps

### Ready to Build UI Components

With the hooks in place, you can now build:

1. **Template Version Manager** (`AmroTemplateVersionManager.tsx`)
   - Uses: `useListTemplateVersions`, `useCreateTemplateVersion`, `useSubmitTemplateVersion`, `useReviewTemplateVersion`
   - Features: Version list, create form, approval workflow

2. **Emergency Quick-Access Panel** (`AmroEmergencyQuickAccessPanel.tsx`)
   - Uses: `useListEmergencyWP`, `useCreateEmergencyWP`
   - Features: One-click AOG declaration, active emergencies dashboard

3. **Non-Scheduled Task Registry** (`AmroNonScheduledTaskPanel.tsx`)
   - Uses: `useListNonScheduledTasks`, `useCreateNonScheduledTask`, `useConvertNonScheduledTaskToWP`
   - Features: Task creation, conversion to WP, status tracking

4. **Compliance Dashboard** (`AmroComplianceDashboard.tsx`)
   - Uses: `useListComplianceRecords`, `useCreateComplianceRecord`, `useCreateCertificate`
   - Features: AD/SB tracking, CRS generation, evidence management

---

## 🧪 Testing Recommendations

### Unit Tests for Hooks

```typescript
// useTemplateVersionState.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useListTemplateVersions } from './useTemplateVersionState';

describe('useListTemplateVersions', () => {
  it('fetches template versions', async () => {
    const { result } = renderHook(() => 
      useListTemplateVersions({ templateId: 'test-id' })
    );
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.records).toBeDefined();
  });
});
```

### Integration Tests

Test complete workflows:
1. Create template version → Submit → Approve → Activate
2. Create non-scheduled task → Convert to emergency WP
3. Create compliance record → Generate CRS

---

## 📝 Migration Checklist

- ✅ Database schema applied
- ✅ API endpoints implemented (10 endpoints)
- ✅ React Query hooks created (20 hooks)
- ⏳ UI components (4 components)
- ⏳ Unit tests (>90% coverage)
- ⏳ Integration tests (8 workflows)
- ⏳ E2E tests (5 user scenarios)

---

**Implementation Date:** 2026-04-12  
**Developer:** AMRO Development Team  
**Pattern Reference:** `useWorkPackageState.ts`  
**Status:** Ready for UI component development  
**Next:** Build priority UI components following AMRO design system
