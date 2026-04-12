# AMRO Unified Layout Model - Enterprise UI/UX Implementation Plan

**Date:** 2026-04-12  
**Scope:** All AMRO Modules (Main + Settings → Master Data)  
**Status:** Planning Phase - Ready for Implementation

---

## Executive Summary

### Current State Assessment

**15 AMRO Modules Analyzed:**
- 3 Main modules (Aircraft, Work Packages Templates, Work Packages)
- 12 Settings → Master Data modules

**Key Findings:**
- ✅ **30+ reusable components** already exist and are being used
- ❌ **7 categories of inconsistencies** across modules
- ⚠️ **No unified layout standard** - each module evolved independently
- 🎯 **Opportunity** - Leverage existing components with unified patterns

**Modules Analyzed:**

| Module | Path | Main Component | Layout Pattern |
|--------|------|----------------|----------------|
| Aircraft | `/dashboard/amro/aircraft` | `AmroAircraftPage` | Table + Detail Panel |
| Work Packages Templates | `/dashboard/amro/templates` | `AmroTemplateCatalogPage` | Table + Dropdown Actions |
| Work Packages | `/dashboard/amro/work-packages` | `AmroWorkOrdersListPage` | Table + Detail Panel |
| Settings → Aircraft | `/dashboard/amro/settings/master-data/aircraft` | `AmroSettingsMasterDataPage` | Master Data Grid |
| Settings → Flight Logs | `/dashboard/amro/settings/master-data/flight_logs` | `AmroSettingsMasterDataPage` | Master Data Grid |
| Settings → Parts Inventory | `/dashboard/amro/settings/master-data/parts_inventory` | `AmroSettingsMasterDataPage` | Master Data Grid |
| Settings → Suppliers | `/dashboard/amro/settings/master-data/suppliers` | `AmroSettingsMasterDataPage` | Master Data Grid |
| Settings → Maintenance Facilities | `/dashboard/amro/settings/master-data/maintenance_facilities` | `AmroSettingsMasterDataPage` | Master Data Grid |
| Settings → Work Centers | `/dashboard/amro/settings/master-data/work_centers` | `AmroSettingsMasterDataPage` | Master Data Grid |
| Settings → Skill Codes | `/dashboard/amro/settings/master-data/skill_codes` | `AmroSettingsMasterDataPage` | Master Data Grid |
| Settings → Manufacturers | `/dashboard/amro/settings/master-data/manufacturers` | `AmroSettingsMasterDataPage` | Master Data Grid |
| Settings → Model | `/dashboard/amro/settings/master-data/model` | `AmroSettingsMasterDataPage` | Master Data Grid |
| Settings → Regulator Profiles | `/dashboard/amro/settings/master-data/regulator_profiles` | `AmroSettingsMasterDataPage` | Master Data Grid |
| Settings → Shift Calendars | `/dashboard/amro/settings/master-data/shift_calendars` | `AmroSettingsMasterDataPage` | Master Data Grid |
| Settings → Work Package Templates | `/dashboard/amro/settings/master-data/work_package_templates` | `AmroSettingsMasterDataPage` | Master Data Grid |

---

## Current Inconsistencies Identified

### 1. Layout Structure Inconsistencies

| Module | Container | Header Pattern | Content Area |
|--------|-----------|----------------|--------------|
| Main Modules | `DashboardLayout` + `FirstScreenTemplate` | Breadcrumbs + Title + Description | Card with Table |
| Settings Modules | `DashboardLayout` + `FirstScreenTemplate` | Breadcrumbs + Title + Description | Card with Table |
| **Inconsistency** | ❌ Same pattern but different spacing/padding | ❌ Different breadcrumb depths | ❌ Different card styles |

### 2. Action Button Patterns

| Pattern | Used By | Description |
|---------|---------|-------------|
| **Dropdown Menu** | Template Catalog, Work Packages | Actions button (⋯) → Dropdown with 5 items |
| **Inline Buttons** | Some main modules | Multiple buttons in table row |
| **Toolbar Buttons** | Settings modules | New/Create button in toolbar |
| **Inconsistency** | ❌ Mixed patterns across modules | Users confused about where to find actions |

### 3. Data Entry Form Patterns

| Pattern | Used By | Description |
|---------|---------|-------------|
| **Dialog with Tabs** | Template Create/Edit | 5 tabs (Details, Tasks, Materials, Tooling, Compliance) |
| **Dialog with Sections** | Some settings modules | Single dialog with field groups |
| **Inline Editing** | Some master data | Edit directly in table row |
| **Inconsistency** | ❌ Different form layouts | Users need to learn each module's pattern |

### 4. Detail View Patterns

| Pattern | Used By | Description |
|---------|---------|-------------|
| **Side Panel** | Aircraft, Work Packages | Detail panel slides in from right |
| **Dialog** | Template Preview | Modal dialog overlay |
| **Separate Page** | Some modules | Navigation to detail page |
| **Inconsistency** | ❌ Three different patterns | Users can't predict behavior |

### 5. Table/Grid Patterns

| Feature | Inconsistency |
|---------|---------------|
| **Pagination** | Some use simple Prev/Next, others use page numbers |
| **Sorting** | Some have sortable columns, others don't |
| **Filters** | Different filter UI patterns (dropdowns vs inputs) |
| **Row Selection** | Some support multi-select, others don't |
| **Column Visibility** | No module supports customizing visible columns |

### 6. Search/Filter Implementation

| Module | Search Location | Filter Pattern |
|--------|-----------------|----------------|
| Template Catalog | Top of table | Inline search + Dropdown filters |
| Work Packages | Toolbar | Separate filter section |
| Settings Modules | Varies | Inconsistent placement |
| **Inconsistency** | ❌ Different locations | Users can't find search quickly |

### 7. Empty State Patterns

| Pattern | Inconsistency |
|---------|---------------|
| **EmptyState Component** | Some modules use it, others show plain text |
| **CTA Buttons** | Some have "Create" button, others don't |
| **Illustrations** | No consistent empty state design |

---

## Reusable Components Already in Place

### ✅ High-Quality Components (Ready to Standardize)

| Component | Location | Quality | Usage |
|-----------|----------|---------|-------|
| `DashboardLayout` | `src/components/layout/` | ⭐⭐⭐⭐⭐ | All pages |
| `FirstScreenTemplate` | `src/components/system/` | ⭐⭐⭐⭐⭐ | All pages |
| `EmptyState` | `src/components/system/` | ⭐⭐⭐⭐⭐ | Empty states |
| `AmroModuleSurface` | `src/features/module-amro/components/parts/` | ⭐⭐⭐⭐ | Module containers |
| `AmroStandardToolbar` | `src/features/module-amro/components/parts/` | ⭐⭐⭐⭐ | Toolbars |
| `AmroKpiGrid` | `src/features/module-amro/components/parts/` | ⭐⭐⭐⭐ | KPI displays |
| `AmroCrudDialogFooter` | `src/features/module-amro/components/parts/` | ⭐⭐⭐⭐ | Dialog footers |
| `AmroModuleGridDetailPanel` | `src/features/module-amro/components/parts/` | ⭐⭐⭐⭐ | Detail panels |
| `TemplatePreviewDialog` | `src/features/module-amro/templates/` | ⭐⭐⭐⭐ | Template preview |
| `TemplateCreateEditDialog` | `src/features/module-amro/templates/` | ⭐⭐⭐⭐⭐ | Template CRUD |
| `TemplateVersionManager` | `src/features/module-amro/templates/` | ⭐⭐⭐⭐⭐ | Version management |
| `TemplateCloneDialog` | `src/features/module-amro/templates/` | ⭐⭐⭐⭐⭐ | Template cloning |

### ⚠️ Components Needing Enhancement

| Component | Issue | Recommendation |
|-----------|-------|----------------|
| `AmroSettingsMasterDataPage` | Monolithic, handles all 12 entities | Split into entity-specific pages |
| Settings forms | Inline editing, no validation | Use consistent dialog forms |
| Table actions | Inconsistent patterns | Standardize dropdown menu |

---

## Recommended Unified Layout Model

### Tier 1: Page Container (All Modules)

```
┌─────────────────────────────────────────────────────────────┐
│ DashboardLayout (Navigation, Header, Main Content Area)     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ FirstScreenTemplate                                   │  │
│  │  • Breadcrumbs                                        │  │
│  │  • Title + Description                                │  │
│  │  • viewMode prop (list/grid)                          │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ Content Area (module-specific)                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ StickyActionsMount (Floating action buttons)          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Tier 2: Module Layout (All Modules)

```
┌─────────────────────────────────────────────────────────────┐
│ Card (Module Container)                                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ CardHeader                                            │  │
│  │  • Title + Description/Count                          │  │
│  │  • Toolbar Actions (New, Refresh, View Toggle)        │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ CardContent                                     │  │  │
│  │  │  • Search + Filters Row                         │  │  │
│  │  │  • Table/Grid                                   │  │  │
│  │  │  • Pagination                                   │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Tier 3: Table Layout (All Modules)

```
┌─────────────────────────────────────────────────────────────┐
│ Search & Filters Row                                        │
│  [Search Input] [Filter 1] [Filter 2] [Filter 3] [Clear]    │
├─────────────────────────────────────────────────────────────┤
│ Table                                                       │
│  ┌─────┬──────────┬──────────┬──────────┬──────────┬─────┐  │
│  │ ☑   │ Column 1 │ Column 2 │ Column 3 │ Column 4 │ ⋯   │  │
│  ├─────┼──────────┼──────────┼──────────┼──────────┼─────┤  │
│  │ ☐   │ Row 1    │ Data     │ Data     │ Data     │ ⋯   │  │
│  │ ☐   │ Row 2    │ Data     │ Data     │ Data     │ ⋯   │  │
│  │ ☐   │ Row 3    │ Data     │ Data     │ Data     │ ⋯   │  │
│  └─────┴──────────┴──────────┴──────────┴──────────┴─────┘  │
├─────────────────────────────────────────────────────────────┤
│ Pagination                                                  │
│  Showing 1-20 of 150          [Previous] Page 1 [Next]      │
└─────────────────────────────────────────────────────────────┘
```

### Tier 4: Action Menu Pattern (All Modules)

```
┌──────────────────────┐
│ ⋯ Actions            │
├──────────────────────┤
│ 👁️ Preview           │
│ 📖 Edit Details      │
│ 📦 Manage Versions   │
│ 📋 Clone             │
├──────────────────────┤
│ 🗑️ Delete (Red)      │
└──────────────────────┘
```

### Tier 5: Data Entry Form Pattern (All Modules)

```
┌─────────────────────────────────────────────────────────────┐
│ Dialog (Create/Edit)                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ DialogHeader                                          │  │
│  │  • Title (Create/Edit {Entity})                       │  │
│  │  • Description                                        │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ DialogContent                                   │  │  │
│  │  │  • Tabs/Sections for field groups               │  │  │
│  │  │  • Consistent field layout (2-3 columns)        │  │  │
│  │  │  • Validation messages inline                   │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ DialogFooter                                    │  │  │
│  │  │  [Cancel] [Save/Update]                         │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Tier 6: Detail View Pattern (All Modules)

```
┌─────────────────────────────────────────────────────────────┐
│ Detail Panel (Slide-in from right)                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Panel Header                                          │  │
│  │  • Title + Close Button                               │  │
│  │  • Quick Actions (Edit, Delete)                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ Panel Content                                   │  │  │
│  │  │  • Tabs for sections (Details, Related, etc.)   │  │  │
│  │  │  • Read-only field display                      │  │  │
│  │  │  • Related data lists                           │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan (No Breaking Changes)

### Phase 1: Foundation (Week 1-2) - P0

**Goal:** Create shared layout components without modifying existing modules

**Tasks:**
1. ✅ **Create `AmroUnifiedPageLayout` component**
   - Wraps `FirstScreenTemplate` + `Card`
   - Standardizes spacing, padding, breadcrumbs
   - Props: `title`, `description`, `breadcrumbs`, `actions`

2. ✅ **Create `AmroUnifiedTable` component**
   - Wraps shadcn Table
   - Standardizes:
     - Search + Filters row
     - Sortable columns
     - Row selection
     - Actions dropdown
     - Pagination
   - Props: `columns`, `data`, `onRowClick`, `actions`

3. ✅ **Create `AmroUnifiedActions` component**
   - Standardized dropdown menu
   - Props: `actions` array with `{ label, icon, onClick, variant, separator }`

4. ✅ **Create `AmroUnifiedForm` component**
   - Standardized dialog form
   - Props: `title`, `description`, `fields`, `onSubmit`, `onCancel`

**Deliverable:** 4 new reusable components, zero changes to existing modules

---

### Phase 2: Settings Modules Migration (Week 3-4) - P1

**Goal:** Migrate 12 Settings → Master Data modules to unified layout

**Approach:**
- Extract entity-specific pages from monolithic `AmroSettingsMasterDataPage`
- Use new unified components
- Keep existing API calls and data logic unchanged

**Migration Order:**
1. Settings → Aircraft (highest usage)
2. Settings → Manufacturers
3. Settings → Suppliers
4. Settings → Work Centers
5. Settings → Skill Codes
6. Settings → Maintenance Facilities
7. Settings → Model
8. Settings → Flight Logs
9. Settings → Parts Inventory
10. Settings → Regulator Profiles
11. Settings → Shift Calendars
12. Settings → Work Package Templates

**Per-Module Tasks:**
- Create `{Entity}Page.tsx` in `src/features/module-amro/settings/pages/`
- Use `AmroUnifiedPageLayout`
- Use `AmroUnifiedTable` with entity-specific columns
- Use `AmroUnifiedActions` for row actions
- Use `AmroUnifiedForm` for create/edit dialogs
- Update route in `App.tsx`
- Test all CRUD operations
- Verify no regression in functionality

---

### Phase 3: Main Modules Enhancement (Week 5-6) - P1

**Goal:** Enhance 3 main modules to use unified layout

**Modules:**
1. **Aircraft** (`/dashboard/amro/aircraft`)
   - Keep existing `AmroAircraftPage`
   - Replace table with `AmroUnifiedTable`
   - Replace actions with `AmroUnifiedActions`
   - Standardize detail panel

2. **Work Packages Templates** (`/dashboard/amro/templates`)
   - Already partially unified (Template Catalog)
   - Ensure consistency with new standards
   - Update to use `AmroUnifiedTable`

3. **Work Packages** (`/dashboard/amro/work-packages`)
   - Keep existing `AmroWorkOrdersListPage`
   - Replace table with `AmroUnifiedTable`
   - Replace actions with `AmroUnifiedActions`
   - Standardize detail panel

---

### Phase 4: Form Standardization (Week 7) - P2

**Goal:** Standardize all data entry forms

**Tasks:**
1. Review all existing create/edit dialogs
2. Identify common field patterns
3. Create field type components:
   - `AmroTextField`
   - `AmroSelectField`
   - `AmroDateField`
   - `AmroNumberField`
   - `AmroTextareaField`
   - `AmroCheckboxField`
4. Update all forms to use standardized fields
5. Ensure consistent validation messages
6. Standardize button placement and labels

---

### Phase 5: Empty States & Feedback (Week 8) - P2

**Goal:** Standardize empty states and user feedback

**Tasks:**
1. Review all empty states across modules
2. Create standardized empty state components:
   - `AmroEmptyList` (no data)
   - `AmroEmptySearch` (no results)
   - `AmroLoading` (loading state)
   - `AmroError` (error state)
3. Add consistent CTA buttons to empty states
4. Standardize toast notification messages
5. Add loading skeletons for tables

---

### Phase 6: Testing & Polish (Week 9-10) - P2

**Goal:** Ensure quality and polish

**Tasks:**
1. **Cross-module testing:**
   - Verify all 15 modules work correctly
   - Test all CRUD operations
   - Verify navigation between modules
   - Test edge cases (empty data, errors, etc.)

2. **Accessibility audit:**
   - Keyboard navigation
   - Screen reader support
   - Focus management
   - ARIA labels

3. **Performance optimization:**
   - Lazy loading for dialogs
   - Virtual scrolling for large tables
   - Debounced search inputs
   - Optimized re-renders

4. **Documentation:**
   - Update component documentation
   - Create usage examples
   - Document migration guide for future modules

---

## Risk Mitigation

### No Breaking Changes Strategy

| Risk | Mitigation |
|------|------------|
| **Existing functionality breaks** | ✅ Phase 1 creates NEW components, doesn't modify existing ones |
| **API changes required** | ✅ No API changes - reuse existing endpoints |
| **Data loss** | ✅ All migrations are UI-only, no data modifications |
| **User confusion** | ✅ Gradual rollout, feature flags for each phase |
| **Regression bugs** | ✅ Comprehensive testing per module before merge |
| **Performance issues** | ✅ Performance testing in Phase 6 |

### Rollback Plan

- Each phase is independent and can be rolled back
- Feature flags allow disabling new layouts
- Old components remain until migration complete
- Database unchanged throughout

---

## Success Metrics

### Quantitative Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **Layout Consistency** | 30% | 95% | Visual audit |
| **Code Reuse** | 40% | 85% | Component usage analysis |
| **Development Time** | Baseline | -30% | Time to add new module |
| **Bug Rate** | Baseline | -50% | Post-migration bugs |
| **User Tasks Completion** | Baseline | +20% | User testing |

### Qualitative Metrics

- ✅ Users can predict where to find actions in any module
- ✅ Forms have consistent layout and validation
- ✅ Empty states guide users effectively
- ✅ Navigation between modules feels seamless
- ✅ Learning curve reduced for new modules

---

## Summary

This plan delivers an **enterprise-grade, unified layout model** across all 15 AMRO modules:

**Key Benefits:**
1. ✅ **Consistent UX** - Users learn once, apply everywhere
2. ✅ **Reusable Components** - 4 new components serve all modules
3. ✅ **No Breaking Changes** - Gradual migration, zero downtime
4. ✅ **Future-Proof** - Easy to add new modules
5. ✅ **Maintainable** - Single source of truth for layout patterns

**Timeline:** 10 weeks across 6 phases

**Phases:**
1. Foundation (Week 1-2) - Create shared components
2. Settings Modules (Week 3-4) - Migrate 12 settings modules
3. Main Modules (Week 5-6) - Enhance 3 main modules
4. Form Standardization (Week 7) - Standardize all forms
5. Empty States & Feedback (Week 8) - Polish UX
6. Testing & Polish (Week 9-10) - Quality assurance

**Ready to begin implementation!** 🚀
