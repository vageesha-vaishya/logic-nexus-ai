# Phase 2 Implementation Roadmap

## Overview
Building on the foundation established in Phase 1, Phase 2 focuses on "Advanced Analytics & Customization." This phase will introduce user-configurable dashboards, deeper analytical insights, and automated workflow triggers.

## Objectives
1.  **User-Configurable Layouts:** Allow users to drag, drop, and resize dashboard widgets.
2.  **Advanced Reporting:** Implement aggregate reports for franchisees and platform admins.
3.  **Workflow Automation:** Trigger actions based on KPI thresholds.
4.  **Enhanced Performance:** Implement server-side caching for heavy analytical queries.

## Milestones

### Milestone 2.1: Drag-and-Drop Dashboard (Weeks 1-2)
-   **Task:** Integrate `react-grid-layout`.
-   **Implementation:**
    -   Wrap `WidgetContainer` components in grid items.
    -   Persist user layout preferences to `user_settings` table.
    -   Create a "Edit Dashboard" mode in the UI.
-   **Deliverable:** Users can rearrange their dashboard widgets.

### Milestone 2.2: Advanced Analytics Engine (Weeks 3-4)
-   **Task:** Create dedicated analytics endpoints/views.
-   **Implementation:**
    -   Create Supabase Database Views for complex aggregations (e.g., `view_monthly_revenue_by_franchise`).
    -   Implement a generic `AnalyticsService` in the frontend to query these views via `ScopedDataAccess`.
    -   Add date range pickers to the dashboard.
-   **Deliverable:** Revenue and Shipment volume charts with date filtering.

### Milestone 2.3: Automated Alerts (Weeks 5-6)
-   **Task:** Implement threshold-based alerting.
-   **Implementation:**
    -   Create `alerts` table.
    -   Implement a background job (Supabase Edge Function) to check KPI thresholds.
    -   Show alerts in the dashboard and send email notifications.
-   **Deliverable:** Users receive alerts when "Pending Emails" exceeds a threshold.

### Milestone 2.4: Performance Optimization (Week 7)
-   **Task:** Implement caching.
-   **Implementation:**
    -   Use React Query for frontend caching and invalidation strategies.
    -   Optimize database indices for analytical queries.
-   **Deliverable:** Dashboard load time under 200ms for p95.

## Technical Dependencies
-   **Library:** `react-grid-layout` (New dependency)
-   **Library:** `tanstack/react-query` (Already recommended, deeper integration needed)
-   **Infrastructure:** Supabase Edge Functions for background jobs.

## Risk Assessment
-   **Complexity:** Dynamic grid layouts can be complex to make responsive on mobile.
    -   *Mitigation:* Disable drag-and-drop on mobile; use a stacked layout.
-   **Performance:** Aggregating data across large tables can be slow.
    -   *Mitigation:* Use materialized views for historical data.

## Success Metrics
-   50% of active users customize their dashboard.
-   Average dashboard load time < 500ms.
-   Zero cross-tenant data leaks in analytical reports.
