# Migration Guide: Leads Workspace to Leads Pipeline

This document outlines the migration of the Leads Workspace functionality to the new Leads Pipeline architecture.

## Overview

The migration unifies the Leads Workspace features into a robust, scalable `LeadsPipeline` component. The new implementation leverages real-time data from Supabase, optimized performance via memoization, and a modular component structure.

## Changes Implemented

### 1. Architecture
- **Data Access**: Switched from direct mock data/Supabase calls to `ScopedDataAccess` for secure, tenant-aware data fetching.
- **State Management**: Implemented `useState` and `useMemo` for efficient state handling and derived data calculation (stats, funnel, filtered lists).
- **Real-time Updates**: Integrated `useCRM` hook for real-time Supabase subscriptions (though currently polling via refresh is primary, the structure supports real-time).

### 2. Components
- **DashboardOverview**: Extracted to `LeadsPipelineComponents.tsx` for reusability. Displays key metrics (Total Leads, Won Deals, etc.).
- **ContactsSection**: Displays a list of contacts filtered by the current view.
- **TasksSection**: Integrated `TaskScheduler` for task management with optimistic updates for completion status.
- **KanbanBoard**: Retained the drag-and-drop functionality with optimistic UI updates and robust error handling.

### 3. Features Preserved
- **Drag-and-Drop**: Status updates via Kanban board.
- **Filtering**: Search by name/company and filter by stage.
- **View Toggling**: Switch between Board and Analytics views.
- **Task Management**: View and complete tasks related to leads.

## Migration Steps

1.  **Backup**: Ensure current `LeadsWorkspace.tsx` is preserved as a reference (done).
2.  **Implementation**: 
    -   Created `LeadsPipelineComponents.tsx` for shared sub-components.
    -   Updated `LeadsPipeline.tsx` to integrate these components and fetch real data.
3.  **Testing**:
    -   Unit tests added in `LeadsPipeline.test.tsx` covering rendering, filtering, status updates, and task completion.
    -   Verified fix for infinite loop issues in `useCRM`.

## Rollback Strategy

If critical issues are encountered:

1.  Revert the route configuration in `App.tsx` (or equivalent router config) to point back to `LeadsWorkspace`.
2.  Or, simply restore the previous version of `LeadsPipeline.tsx` from version control.

## Future Improvements

-   **Advanced Filtering**: Add more filter options (e.g., by Owner, Priority).
-   **Performance**: Implement virtualization for large lead lists if needed.
-   **Real-time Presence**: Show which users are viewing the board.

## Completed Features

-   **Create Task**: Implemented the "Add Task" dialog with `CreateTaskDialog` and backend integration via `ScopedDataAccess`.

## Quotation Delete Pipeline Migration (2026-03)

### Scope
- Replaces direct `DELETE FROM quotes` application flows with RPC-based transactional orchestration.
- Preserves backward compatibility by keeping `delete_quotes_cascade(uuid[])` callable with original signature.
- Adds extended reporting path through `delete_quotes_cascade_detailed(uuid[], text, boolean, boolean)`.

### What Changed
- `delete_quotes_cascade` now delegates to `delete_quotes_cascade_detailed` in atomic mode.
- UI delete flows use `QuotationDeleteService` and consume detailed per-quote results.
- Bulk and single delete paths enforce `quotes.delete` permission checks before executing.

### Action Required for Downstream Integrations
- If integration only calls `delete_quotes_cascade(uuid[])`: no change required.
- If integration needs per-quote outcomes, rollback metadata, or audit context:
  - switch to `delete_quotes_cascade_detailed(...)`
  - persist `summary` and `results` fields for operational monitoring
  - handle `atomic_rolled_back = true` as a no-op rollback event

### Compatibility Notes
- Existing API/UI routes remain valid.
- Quote states with protected references may be soft-deleted instead of hard-deleted unless `force_hard_delete = true`.
- Tenant isolation and role checks are enforced server-side for both legacy and detailed RPCs.
