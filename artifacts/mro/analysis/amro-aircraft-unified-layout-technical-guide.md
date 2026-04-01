# AMRO Aircraft Unified Layout Technical Guide

## 1) Scope

This guide documents the unified layout implementation for AMRO Aircraft modules:

- Aircraft List
- Templates
- Engine
- Components
- Documents
- AD/SB
- Maintenance Planning

The implementation standardizes interaction patterns, filtering controls, navigation, RBAC-aware actions, and operational feedback surfaces while preserving tenant/franchise isolation and existing API contracts.

## 2) Architecture

### 2.1 Unified UI Component

Primary reusable component:

- `src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftUnifiedLayout.tsx`

Responsibilities:

- Shared module navigation rail (single source of module switching UX)
- Shared search + status + locale control strip
- Shared action bar through `AircraftActionPalette`
- Shared load/error messaging container
- Reusable row filtering helper (`filterUnifiedModuleRows`) for module tables

### 2.2 Integration Surface

Page integration:

- `src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx`

Key integration points:

- Unified module state (`aircraftUnifiedSearch`, `aircraftUnifiedStatusFilter`, `aircraftUnifiedLocale`)
- Dynamic module key resolution from route segment
- Module-specific subtitle + action palette projection
- Memoized filtering pipelines for templates/documents/AD-SB rows

## 3) UX Standards Applied

- Consistent title/subtitle structure across all aircraft sub-modules
- Shared navigation hierarchy and module switch behavior
- Unified filtering affordances and visual treatment
- Shared action affordances with role-aware visibility/disabled behavior
- Consistent error and loading presentation patterns
- Responsive grid layout compatible with desktop and tablet widths

## 4) Security and Data Integrity

- Existing scoped APIs and `scope` envelope are preserved
- RBAC checks continue through `hasPermission` and action-level permissions
- Create/update/delete flows keep existing server-side validation and response checks
- Existing tenancy safeguards remain unchanged (tenant/franchise context retained end-to-end)

## 5) Performance Design

- Filtering uses memoized selectors (`useMemo`) to avoid unnecessary recomputation
- Shared filter helper avoids repeated ad hoc filter implementations
- Existing page-level lazy fetch behavior remains unchanged
- No additional backend round trips are introduced by layout controls

## 6) Error Handling and Validation

- Unified layout shows inline module errors via alert container
- Existing form validation retained for template create/update dialogs
- Existing toast and API failure propagation remain active

## 7) Localization Readiness

- Unified locale selector is available in the shared control strip
- Labels and copy are centralized at shared layout boundaries for staged i18n rollout
- Existing module copy continues to work as-is until translation dictionaries are expanded

## 8) Testing Strategy

### 8.1 Unit Tests

- `src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftUnifiedLayout.test.tsx`
  - Verifies control rendering and navigation callback behavior
  - Verifies row filtering helper logic (query + status)

### 8.2 End-to-End Tests

- `tests/e2e/amro-overview-dashboard.spec.ts`
  - Adds unified aircraft module rail traversal test for:
    - list
    - templates
    - engine
    - components
    - documents
    - ad/sb
    - maintenance planning

## 9) User Training Material

### 9.1 Target Audience

- AMRO planners
- Reliability engineers
- QA/compliance users
- Line/base maintenance coordinators

### 9.2 Quick Start Workflow

1. Open Aircraft module (`/dashboard/amro/aircraft/list`)
2. Use the top module rail to switch workspaces
3. Apply search and status filters from the shared control strip
4. Use module action palette for role-authorized operations
5. Review errors in the inline alert block before retrying operations

### 9.3 Role-Based Usage Notes

- Users without edit/approve permissions will see action restrictions
- Delete and sensitive actions are gated by approval-level permissions
- Template management actions require maintenance edit/create grants

### 9.4 Operations Handoff Checklist

- Confirm module route and active workspace badge
- Confirm filters are cleared before broad reviews
- Confirm export operations align with current filter state
- Confirm action authorization based on user role profile

## 10) Maintenance Plan

### 10.1 Release Checklist (Every Change)

- Run component unit tests for unified layout
- Run AMRO settings page tests
- Run lint and typecheck
- Run targeted e2e smoke for aircraft module rail

### 10.2 Backlog Priorities

1. Bind locale selector to full i18n dictionary namespaces
2. Extend unified filtering to deeper engine/components drill-down panels
3. Add virtualization where table cardinality exceeds operational threshold
4. Add telemetry events for module switching and filter usage

### 10.3 Ownership

- UI ownership: AMRO frontend module maintainers
- Data contract ownership: AMRO master-data API owners
- RBAC ownership: platform permissions owners
- Regression ownership: QA automation maintainers

