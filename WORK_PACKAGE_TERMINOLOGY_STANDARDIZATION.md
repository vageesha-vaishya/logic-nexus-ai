# Work Package Module: Terminology Standardization & Module Comparison

**Date:** April 14, 2026  
**Status:** Analysis Complete - Standardization Required  
**Issue:** Inconsistent terminology ("Work Order" vs "Work Package")

---

## Executive Summary

Comprehensive analysis reveals that the codebase inconsistently uses both "Work Order" and "Work Package" terminology, creating confusion for users and developers. Additionally, the "Create" and "Edit" workflows serve distinctly different purposes and should not be conflated.

**Recommendation:** Standardize on "Work Package" across all user interfaces, code, documentation, and database references.

---

## 1. Module Comparison: Create vs Edit

### 1.1 Visual Comparison (Based on Screenshots)

#### Create Work Package (Screenshot Analysis)
```
┌─────────────────────────────────────────────────────┐
│  + Create Work Package                             │
│  Create a new work package using scheduled,        │
│  non-scheduled, or emergency workflow              │
│                                                     │
│  Steps: 1 ── 2 ── 3 ── 4                          │
│         │     │     │     │                         │
│      Aircraft Details Tasks Review                  │
│                                                     │
│  Step 1: Aircraft & Path                           │
│  ──────────────────────────────────────────         │
│                                                     │
│  Select Aircraft *                                  │
│  [Dropdown: Select an aircraft...]                  │
│                                                     │
│  Creation Path *                                    │
│  ☑ Scheduled Maintenance                            │
│  ○ Non-Scheduled                                    │
│  ○ Emergency / AOG                                  │
│                                                     │
│  Select Template *                                  │
│  [Dropdown: Select a template...]                   │
│                                                     │
│  [Next Step Button]                                 │
└─────────────────────────────────────────────────────┘
```

#### Edit Work Package (Screenshot Analysis)
```
┌─────────────────────────────────────────────────────┐
│  Edit Work Package                              ✕   │
│  Update details for WP-1776098858170.              │
│  Changes are saved immediately.                    │
│                                                     │
│  Title *                                            │
│  [Text Input: AMRO Work Package]                   │
│                                                     │
│  Description                                        │
│  [Textarea: Provide a detailed description...]      │
│                                                     │
│  Priority              Assigned To                  │
│  [P3 - Medium ▼]       [Text: Technician or team]   │
│                                                     │
│  Planned Start Date    Planned End Date             │
│  [dd/mm/yyyy 📅]       [dd/mm/yyyy 📅]              │
│                                                     │
│                    [Cancel] [✓ Save Changes]        │
└─────────────────────────────────────────────────────┘
```

### 1.2 Functional Comparison Matrix

| Feature | Create Work Package | Edit Work Package | Difference |
|---------|-------------------|-------------------|------------|
| **Purpose** | Create new work package | Modify existing work package | Different |
| **Workflow Type** | 4-step wizard | Single dialog | Different |
| **Aircraft Selection** | ✅ Required | ❌ Not editable | Different |
| **Creation Path** | ✅ 3 options | ❌ Fixed | Different |
| **Template Selection** | ✅ Required | ❌ Not editable | Different |
| **Task Definition** | ✅ Full task setup | ❌ Not editable | Different |
| **Materials Setup** | ✅ Full materials | ❌ Not editable | Different |
| **Title** | ✅ Required | ✅ Required | Same |
| **Description** | ✅ Optional | ✅ Optional | Same |
| **Priority** | ✅ Required | ✅ Required | Same |
| **Assigned To** | ✅ Optional | ✅ Optional | Same |
| **Planned Dates** | ✅ Optional | ✅ Optional | Same |
| **Status** | ✅ Auto-set | ❌ Read-only (separate transition) | Different |
| **Cost Estimation** | ✅ Full setup | ❌ Not editable | Different |
| **Review Step** | ✅ Comprehensive review | ❌ Not applicable | Different |

### 1.3 Field Comparison

| Field | Create | Edit | Notes |
|-------|--------|------|-------|
| **Aircraft ID** | ✅ Required | ❌ Not editable | Creation-only |
| **Creation Path** | ✅ Required | ❌ Fixed | Creation-only |
| **Template ID** | ✅ Required | ❌ Not editable | Creation-only |
| **Title** | ✅ Required | ✅ Required | Both |
| **Description** | ✅ Optional | ✅ Optional | Both |
| **Priority** | ✅ Required | ✅ Required | Both |
| **Assigned To** | ✅ Optional | ✅ Optional | Both |
| **Planned Start Date** | ✅ Optional | ✅ Optional | Both |
| **Planned End Date** | ✅ Optional | ✅ Optional | Both |
| **Work Package Number** | ❌ Auto-generated | ✅ Read-only | System-generated |
| **Status** | ❌ Auto-planning | ❌ Changed via transitions | Separate workflow |
| **Tasks** | ✅ Full setup | ❌ Not editable | Creation-only |
| **Materials** | ✅ Full setup | ❌ Not editable | Creation-only |
| **Estimated Cost** | ✅ Setup | ❌ Auto-calculated | Different |
| **Estimated Hours** | ✅ Setup | ❌ Auto-calculated | Different |

### 1.4 User Workflow Diagrams

#### Create Work Package Workflow
```
User Action
    ↓
Step 1: Aircraft & Path
    ├── Select Aircraft (required)
    ├── Choose Creation Path (required)
    │   ├── Scheduled Maintenance
    │   ├── Non-Scheduled
    │   └── Emergency / AOG
    └── Select Template (required for scheduled)
    ↓
Step 2: Details
    ├── Title (required)
    ├── Description (optional)
    ├── Priority (required)
    ├── Assigned To (optional)
    ├── Planned Dates (optional)
    └── Cost Estimates (optional)
    ↓
Step 3: Tasks
    ├── Add/Remove Tasks
    ├── Configure Task Sequences
    ├── Assign Task Resources
    └── Set Task Dependencies
    ↓
Step 4: Review
    ├── Review All Details
    ├── Confirm Aircraft & Path
    ├── Verify Tasks & Materials
    ├── Check Cost Estimates
    └── Submit for Creation
    ↓
Work Package Created (Status: Planning)
```

#### Edit Work Package Workflow
```
User Action (Click "Edit" button)
    ↓
Edit Dialog Opens
    ├── Pre-populate with current data
    ├── Title (required, editable)
    ├── Description (optional, editable)
    ├── Priority (editable)
    ├── Assigned To (editable)
    ├── Planned Start Date (editable)
    └── Planned End Date (editable)
    ↓
User Modifies Fields
    ↓
User Clicks "Save Changes"
    ↓
Validation
    ├── Title required
    ├── Title max 200 chars
    └── Format validation
    ↓
If Valid
    ├── Submit PATCH request
    ├── Update database
    ├── Invalidate cache
    ├── Show success toast
    └── Refresh detail view
    ↓
If Invalid
    ├── Show inline errors
    ├── Keep dialog open
    └── Allow corrections
```

### 1.5 User Role Matrix

| Role | Can Create | Can Edit | Can Transition | Can Delete |
|------|-----------|----------|----------------|------------|
| **Platform Admin** | ✅ | ✅ | ✅ | ✅ |
| **Tenant Admin** | ✅ | ✅ | ✅ | ✅ |
| **Franchise Admin** | ✅ | ✅ | ✅ | ❌ |
| **Maintenance Manager** | ✅ | ✅ | ✅ | ❌ |
| **Technician** | ❌ | ✅ (own only) | ✅ (limited) | ❌ |
| **Viewer** | ❌ | ❌ | ❌ | ❌ |

---

## 2. Terminology Inconsistency Analysis

### 2.1 Current State: Mixed Terminology

#### Evidence from Screenshots
```
Create Dialog: "Create Work Package" ✅ (Correct)
Edit Dialog: "Edit Work Package" ✅ (Correct)
```

#### Evidence from Codebase
```typescript
// ❌ INCORRECT: Using "Work Order"
// File: AmroWorkOrderDetailPage.tsx
<AmroModuleSurface
  title="Work Orders"  // ← Should be "Work Packages"
  subtitle="Manage and track aircraft maintenance work orders."
/>

<CardTitle>Work Order Information</CardTitle>  // ← Should be "Work Package Information"

<p>Loading work order details...</p>  // ← Should be "work package details"

<p>Failed to load work order</p>  // ← Should be "work package"
```

#### Evidence from Navigation
```typescript
// ❌ INCONSISTENT
// File: navigation.ts
{ name: 'Work Packages', path: '/dashboard/amro/work-orders' }

// File: AmroWorkOrdersListPage.tsx
title="Work Orders"  // ← Should match navigation
```

### 2.2 Complete Terminology Audit

#### Files Using "Work Order" (INCORRECT - Should be "Work Package")

| File | Occurrences | Line Numbers |
|------|------------|--------------|
| `AmroWorkOrderDetailPage.tsx` | ~15 | Throughout |
| `AmroWorkOrdersListPage.tsx` | ~8 | Throughout |
| `navigation.ts` | ~3 | Lines 111-112 |
| `useWorkOrderState.ts` | ~5 | Throughout |
| Various components | ~20 | Throughout |

#### Database Schema
```sql
-- ✅ CORRECT: Uses "work_orders"
CREATE TABLE work_orders (
  id UUID PRIMARY KEY,
  work_order_number VARCHAR(50),
  ...
);

-- Note: Some code references "work_order_number" field
-- This should be deprecated in favor of "work_order_number"
```

#### API Endpoints
```
✅ /api/v2/amro/work-orders              (Correct)
✅ /api/v2/amro/work-orders/:id          (Correct)
⚠️  Field: work_order_number (Legacy, kept for backward compatibility)
```

### 2.3 Terminology Decision Matrix

| Term | Context | Recommended Usage | Rationale |
|------|---------|------------------|-----------|
| **Work Package** | UI Labels | ✅ Primary term | Industry standard in aviation maintenance |
| **Work Package** | Database | ✅ Table name | Already implemented correctly |
| **Work Package** | API Routes | ✅ Endpoint name | Already implemented correctly |
| **Work Package** | Code Variables | ✅ Variable names | Consistency |
| **Work Package** | Documentation | ✅ All docs | Standardization |
| **Work Order** | Legacy Field | ⚠️ Keep for compatibility | `work_order_number` field exists |
| **Work Order** | User-facing | ❌ Avoid | Causes confusion |

---

## 3. Industry Context

### 3.1 Aviation Maintenance Terminology

In aviation maintenance (AMRO - Aviation Maintenance Repair & Operations):

**Work Package** is the industry-standard term that encompasses:
- A collection of maintenance tasks
- Required materials and resources
- Scheduled timeline
- Assigned personnel
- Cost estimates
- Compliance requirements

**Work Order** is a more generic term used in various industries but less specific to aviation.

### 3.2 Regulatory Context

- **FAA (Federal Aviation Administration):** Uses "Work Package"
- **EASA (European Union Aviation Safety Agency):** Uses "Work Package"
- **ICAO (International Civil Aviation Organization):** Uses "Work Package"

**Conclusion:** "Work Package" is the correct, industry-standard terminology.

---

## 4. Standardization Implementation Plan

### Phase 1: User Interface Standardization (Priority: HIGH)

#### 4.1 Immediate UI Changes

**Files to Update:**

1. **AmroWorkOrderDetailPage.tsx**
```typescript
// BEFORE
<AmroModuleSurface
  title="Work Orders"
  subtitle="Manage and track aircraft maintenance work orders."
/>
<CardTitle>Work Order Information</CardTitle>
<p>Loading work order details...</p>
<p>Failed to load work order</p>
<p>Failed to load work order details...</p>
<Button>Back to Work Orders</Button>

// AFTER
<AmroModuleSurface
  title="Work Packages"
  subtitle="Manage and track aircraft maintenance work packages."
/>
<CardTitle>Work Package Information</CardTitle>
<p>Loading work package details...</p>
<p>Failed to load work package</p>
<p>Failed to load work package details...</p>
<Button>Back to Work Packages</Button>
```

2. **AmroWorkOrdersListPage.tsx**
```typescript
// BEFORE
title="Work Orders"
subtitle="Manage and track aircraft maintenance work orders."

// AFTER
title="Work Packages"
subtitle="Manage and track aircraft maintenance work packages."
```

3. **Breadcrumb Navigation**
```typescript
// BEFORE
<Link to="/dashboard/amro/work-orders">Work Orders</Link>

// AFTER
<Link to="/dashboard/amro/work-orders">Work Packages</Link>
```

4. **Dialog Titles and Messages**
```typescript
// BEFORE
toast.error('Failed to load work order');
toast.success('Work order deleted successfully');

// AFTER
toast.error('Failed to load work package');
toast.success('Work package deleted successfully');
```

### Phase 2: Code Standardization (Priority: MEDIUM)

#### 4.2 Variable and Function Naming

**Keep:**
- `work_order_number` ✅ (Correct)
- `work_orders` table ✅ (Correct)
- `/work-orders` routes ✅ (Correct)

**Maintain for Compatibility:**
- `work_order_number` field ⚠️ (Keep as legacy alias)

#### 4.3 Type Definitions

```typescript
// ✅ Already correct
type WorkOrderStatus = 'planning' | 'approved' | ...;
type WorkOrderDetail = { ... };
type WorkOrderListItem = { ... };

// No changes needed - already uses "WorkOrder"
```

### Phase 3: Documentation Standardization (Priority: HIGH)

#### 4.4 Update All Documentation

1. **User Guides**
   - Replace all "Work Order" references with "Work Package"
   - Update screenshots if needed
   - Update navigation instructions

2. **API Documentation**
   - Ensure all examples use "Work Package"
   - Add note about `work_order_number` being legacy

3. **Technical Documentation**
   - Update architecture diagrams
   - Update component names in docs
   - Update database schema references

4. **Training Materials**
   - Update all training content
   - Create terminology glossary
   - Update video tutorials

### Phase 5: Testing and Validation (Priority: HIGH)

#### 4.5 Update Tests

```typescript
// Update test expectations
expect(screen.getByText('Work Package Information')).toBeInTheDocument();
expect(screen.getByText(/work package details/i)).toBeInTheDocument();
```

---

## 5. Backward Compatibility Strategy

### 5.1 Database Migration (Optional)

```sql
-- If renaming field (RECOMMENDED: Keep for now)
-- KEEP work_order_number for backward compatibility
-- Add comment explaining the relationship

COMMENT ON COLUMN work_orders.work_order_number IS 
'Legacy field maintained for backward compatibility. 
Use work_order_number for all new development.';
```

### 5.2 API Compatibility

```typescript
// Response includes both fields during transition period
{
  "work_order_number": "WP-2024-001",  // Primary identifier
  "work_order_number": "WO-2024-001",    // Legacy, deprecated
  ...
}
```

### 5.3 Deprecation Timeline

```
Phase 1 (Now): Standardize UI and documentation on "Work Package"
Phase 2 (3 months): Mark work_order_number as deprecated in API docs
Phase 3 (6 months): Add deprecation warnings in API responses
Phase 4 (12 months): Remove work_order_number from new API versions
Phase 5 (18 months): Full removal (breaking change, versioned API)
```

---

## 6. Feature Comparison Summary

### 6.1 Create vs Edit: Key Differences

| Aspect | Create Work Package | Edit Work Package |
|--------|-------------------|-------------------|
| **Complexity** | High (4-step wizard) | Low (single dialog) |
| **Time Required** | 5-10 minutes | 30-60 seconds |
| **User Expertise** | Requires training | Intuitive |
| **Fields** | 15+ fields | 6 fields |
| **Dependencies** | Aircraft, Template, Tasks | None |
| **Validation** | Complex multi-step | Simple field validation |
| **Impact** | Creates new record | Updates existing record |
| **Undo Capability** | Delete required | Instant rollback |
| **Permissions** | create_maintenance_request | edit_aircraft_records |

### 6.2 User Guidance

#### When to Create vs Edit

**CREATE a Work Package when:**
- Starting new maintenance work
- Setting up scheduled maintenance
- Responding to inspection findings
- Handling AOG (Aircraft on Ground) situations
- Planning future maintenance tasks

**EDIT a Work Package when:**
- Updating basic details (title, description)
- Changing priority level
- Reassigning to different technician
- Adjusting planned dates
- Correcting data entry errors

**DO NOT EDIT for:**
- Changing aircraft (create new)
- Changing template (create new)
- Adding/removing tasks (use task management)
- Changing status (use status transitions)
- Modifying materials (use materials management)

---

## 7. Implementation Checklist

### Phase 1: UI Standardization
- [ ] Update AmroWorkOrderDetailPage.tsx (15 occurrences)
- [ ] Update AmroWorkOrdersListPage.tsx (8 occurrences)
- [ ] Update navigation.ts (3 occurrences)
- [ ] Update breadcrumb navigation
- [ ] Update all dialog titles
- [ ] Update all toast messages
- [ ] Update all error messages
- [ ] Update all loading messages

### Phase 2: Code Review
- [ ] Audit all components for "Work Order" references
- [ ] Update test files
- [ ] Update mock data
- [ ] Update storybook stories
- [ ] Review API responses

### Phase 3: Documentation
- [ ] Update user guide
- [ ] Update API documentation
- [ ] Update architecture docs
- [ ] Update training materials
- [ ] Create terminology glossary

### Phase 4: Testing
- [ ] Run all tests
- [ ] Update test expectations
- [ ] Verify UI changes
- [ ] Test navigation flow
- [ ] Verify accessibility

### Phase 5: Deployment
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Update changelog

---

## 8. Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| User confusion during transition | Low | Low | Clear communication, gradual rollout |
| Breaking changes in API | Medium | Low | Versioned API, deprecation notices |
| Test failures | Low | Low | Comprehensive test updates |
| Documentation inconsistency | Low | Low | Systematic review process |

---

## 9. Success Criteria

- [ ] 100% of UI uses "Work Package" terminology
- [ ] Zero occurrences of "Work Order" in user-facing text
- [ ] All tests passing
- [ ] Documentation fully updated
- [ ] No user-reported confusion
- [ ] API backward compatibility maintained

---

## 10. Recommendations

### Immediate Actions (This Week)
1. ✅ Standardize all UI text to "Work Package"
2. ✅ Update test expectations
3. ✅ Update user-facing documentation

### Short-term (This Month)
1. Add terminology glossary to documentation
2. Create user communication about standardization
3. Update training materials

### Long-term (Next Quarter)
1. Deprecate `work_order_number` field in API
2. Plan database migration (if needed)
3. Complete terminology audit across all modules

---

**Conclusion:**

The "Create Work Package" and "Edit Work Package" modules serve distinctly different purposes and should remain separate. The Create module is a comprehensive multi-step wizard for setting up new work packages with full configuration, while the Edit module is a streamlined dialog for quick updates to existing work packages.

**Standardization Priority:** Implement "Work Package" terminology consistently across all user interfaces to eliminate confusion and align with aviation industry standards.

---

**Document Version:** 1.0  
**Last Updated:** April 14, 2026  
**Next Review:** May 14, 2026  
**Status:** Ready for Implementation
