# Analytics Integration Plan

## Current Implementation
We have integrated a real-time **Kanban Funnel** directly into the `LeadsPipeline` dashboard. This provides immediate visibility into:
1.  **Stage Distribution**: Visual bar chart showing the volume of leads at each stage.
2.  **Conversion Rates** (Implicit): By viewing the drop-off between columns.
3.  **WIP Limits**: (Planned) Visual indicators when a stage exceeds its capacity.

## Proposed Analytics Dashboard
To take analytics to the next level, we recommend a dedicated "Pipeline Analytics" view with the following charts:

### 1. Velocity Chart
- **Purpose**: Measure the average time it takes for a lead to move from "New" to "Won".
- **Metric**: Average days per stage.
- **Action**: Identify bottlenecks (e.g., "Proposals are stuck for 14 days on average").

### 2. Win/Loss Analysis
- **Purpose**: Understand why deals are lost.
- **Data Source**: "Lost Reason" field (to be added to `Lead` schema).
- **Visualization**: Pie chart of lost reasons (Price, Competitor, Timing, Feature Fit).

### 3. Cohort Analysis
- **Purpose**: Track lead quality over time.
- **Visualization**: Stacked bar chart of "Won" leads by "Source" (Marketing, Referral, Outbound) month-over-month.

## Technical Architecture for Analytics
1.  **Data Warehouse**: Continue using Supabase (PostgreSQL) as the source of truth.
2.  **Aggregation**: Create materialized views in Postgres for complex queries (e.g., `daily_lead_counts`, `stage_transition_logs`).
3.  **Visualization Library**: Use `Recharts` (already installed) for consistent, responsive charts.
4.  **Tracking**:
    - Implement a `lead_history` table to track every status change with a timestamp.
    - Trigger: Database trigger on `leads` table update.

## Implementation Steps
1.  Create `lead_history` table in Supabase.
2.  Add database trigger for history tracking.
3.  Create API endpoint (or Supabase Edge Function) to aggregate velocity metrics.
4.  Build `AnalyticsDashboard` component using Recharts.
