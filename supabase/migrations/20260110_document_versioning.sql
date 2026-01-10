-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path TEXT NOT NULL UNIQUE,
    current_version TEXT NOT NULL DEFAULT '1.0.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create document_versions table
CREATE TABLE IF NOT EXISTS public.document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    content TEXT NOT NULL,
    diff_summary JSONB,
    change_type TEXT CHECK (change_type IN ('major', 'minor', 'patch')),
    change_notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, version)
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.documents;
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.document_versions;
DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON public.documents;
DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON public.document_versions;

-- Create policies (assuming authenticated users can read/write for now, or refine based on RBAC)
-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to authenticated users" ON public.documents
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to authenticated users" ON public.document_versions
    FOR SELECT TO authenticated USING (true);

-- Allow insert/update access to authenticated users (refine later if needed)
CREATE POLICY "Allow insert/update access to authenticated users" ON public.documents
    FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow insert/update access to authenticated users" ON public.document_versions
    FOR ALL TO authenticated USING (true);

-- Seed the initial document
DO $$
DECLARE
    doc_id UUID;
BEGIN
    INSERT INTO public.documents (path, current_version)
    VALUES ('docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md', '1.0.0')
    ON CONFLICT (path) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO doc_id;

    INSERT INTO public.document_versions (document_id, version, content, change_type, change_notes)
    VALUES (
        doc_id,
        '1.0.0',
        E'# SOS Logistics Pro: Competitive Analysis & Strategic Roadmap\n\n## 1. Executive Summary\nThis document provides a comprehensive analysis of the "SOS Logistics Pro" platform against top-tier CRM competitors (Salesforce, HubSpot, Microsoft Dynamics 365, Zoho CRM, Oracle CX). It identifies critical gaps in the current implementation, particularly regarding the **multi-tiered architecture (Super Admin/Tenant/Franchisee)**, **Dashboard flexibility**, and **Transfer Center** capabilities.\n\nThe analysis is translated into a concrete **Implementation Playbook** to elevate the platform to enterprise standards.\n\n---\n\n## 2. Competitive Analysis Framework\n\n### 2.1 Dashboard Implementation Comparison\n\n| Feature | Salesforce Lightning | HubSpot CRM | Zoho CRM | **SOS Logistics Pro (Current)** | **Gap / Opportunity** |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n| **Widget Architecture** | Drag-and-drop Component Library | Configurable "Cards" | Widget Gallery | Hardcoded React Components | **Critical**: Move to a `grid-layout` based widget system. |\n| **Data Scope** | Hierarchy-based (Manager/Rep) | Team/Personal toggles | Role-based Views | Personal-only (`owner_id = me`) | **High**: Add "Team View" and "Tenant View" leveraging `ScopedDataAccess`. |\n| **Real-time Updates** | Streaming API / Push Topics | Auto-refresh (15s/30s) | WebSocket Notifications | Page Load / Manual Refresh | **Medium**: Implement Supabase Realtime subscriptions. |\n| **KPI Visualization** | Advanced Charting (Tableau integration) | Built-in Reports Builder | Analytics Canvas | Basic Lists (No Charts) | **High**: Integrate `recharts` for KPI cards (Revenue, Pipeline Velocity). |\n| **User Personalization**| Saved Filters, Pinned Views | Drag-and-drop Layouts | Custom Homepages | None | **High**: Persist user layout preferences in `user_preferences` table. |\n\n### 2.2 Enterprise Capability Assessment\n\n#### Role-Based Access Control (RBAC) & Scoping\n*   **Industry Standard**: Granular permissions (Create/Read/Update/Delete) per object, with "View All Data" and "Modify All Data" overrides for Admins. Hierarchy-based sharing rules.\n*   **SOS Current State**:\n    *   Strong 3-tier model (Platform/Tenant/Franchise).\n    *   `ScopedDataAccess` class enforces boundaries well.\n    *   **Gap**: `TransferService` bypasses `ScopedDataAccess`, relying solely on DB-level RLS. This creates a risk where application-level "Admin Override" logic (recently fixed in `AdminScopeSwitcher`) might not apply to Transfers.\n    *   **Gap**: No UI for creating custom roles/permissions (hardcoded checks).\n\n#### Transfer Center Functionality\n*   **Industry Standard**: "Territory Management" or "Lead Assignment Rules" (Salesforce). Automated rules based on criteria.\n*   **SOS Current State**: Manual `TransferService` with "Pending/Approved" workflow.\n*   **Gap**: Lack of automated routing rules. Lack of "Bulk Transfer" capabilities for franchise onboarding/offboarding.\n\n#### Performance & Scalability\n*   **Industry Standard**: Server-side caching, edge functions, localized CDNs.\n*   **SOS Current State**: Client-side fetching (React Query). Sequential fetching in `Dashboards.tsx` (waterfall request pattern).\n*   **Recommendation**: Implement parallel data fetching (`Promise.all`) and Supabase Edge Functions for aggregated KPI calculations.\n\n---\n\n## 3. SOS-Specific Recommendations\n\n### 3.1 UI/UX Enhancements (Dashboard)\n*   **Component Library**: Upgrade `Dashboards.tsx` to use a **Grid Layout System** (e.g., `react-grid-layout` or `dnd-kit` sortable strategies).\n*   **Widget Catalog**: Create a registry of available widgets:\n    *   `KPICard`: Single metric with trend (e.g., "Active Shipments +12%").\n    *   `PipelineChart`: Funnel chart for Leads/Opportunities.\n    *   `ActivityFeed`: List of recent actions (already exists, needs genericizing).\n    *   `TransferRequestQueue`: Specific for the Transfer Center integration.\n\n### 3.2 Workflow Optimizations\n*   **Transfer Center**: Integrate "Admin Override" into the Transfer workflow. A Platform Admin using "Switch Scope" to view a specific Franchise should see *that Franchise\'s* transfer requests, not their own.\n*   **Navigation**: Context-aware sidebar. When "Scoped" to a Franchise, the sidebar should only show modules active for that franchise tier.\n\n---\n\n## 4. Implementation Playbook\n\n### Phase 1: Core Dashboard Rebuild (Quick Wins - Sprints 1-2)\n*   [ ] **Refactor `Dashboards.tsx`**: Replace hardcoded lists with a generic `WidgetContainer`.\n*   [ ] **Implement KPI Cards**: Create reusable `StatsCard` components using `recharts` for visual trends.\n*   [ ] **Parallel Data Fetching**: Optimize `useDashboardData` hook to fetch Leads, Activities, and KPIs in parallel.\n*   [ ] **Localization Audit**: Wrap all hardcoded dashboard strings in `t()` calls using `react-i18next`.\n\n### Phase 2: Enterprise Feature Rollout (Medium Term - Q1-Q2)\n*   [ ] **Dynamic Transfer Center**: Update `TransferService` to accept `DataAccessContext` and respect "Admin Override" scopes.\n*   [ ] **Widget Persistence**: Create a database table `user_dashboard_layouts` to save widget positions and configurations per user.\n*   [ ] **Team Views**: Add a dropdown to the Dashboard to switch between "My View", "Team View" (Manager), and "Franchise View" (Admin).\n\n### Phase 3: Advanced Analytics (Strategic - 6+ Months)\n*   [ ] **Supabase Realtime**: Enable live updates for the "Transfer Request Queue" widget.\n*   [ ] **Custom Report Builder**: Allow users to define their own charts/filters and pin them to the dashboard.\n*   [ ] **AI Insights**: Integrate "Next Best Action" suggestions based on Activity patterns.\n\n---\n\n## 5. Technical Evaluation Matrix (SOS vs. Market)\n\n| Criteria | SOS Logistics Pro | Market Leaders | Score (1-5) | Action |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n| **Multi-Tenancy** | Native (Tenant/Franchise columns) | Often custom/bolted-on | **5/5** | Maintain advantage. |\n| **Dashboarding** | Static Lists | Dynamic/Drag-and-Drop | **2/5** | **Priority Upgrade needed.** |\n| **API/Integration** | Supabase REST/GraphQL | Mature Ecosystems | **4/5** | Strong foundation, needs docs. |\n| **Mobile Support** | Responsive Web | Native Apps | **3/5** | Improve responsive grid. |\n| **Localization** | Library Installed, Partial Usage | Full Multi-currency/lingual | **3/5** | Complete the implementation. |\n\n## 6. Detailed Migration Strategy (Legacy -> Supabase)\n*(Addressed in separate `MIGRATION_ANALYSIS.md`)*',
        'major',
        'Initial version'
    ) ON CONFLICT DO NOTHING;
END $$;
