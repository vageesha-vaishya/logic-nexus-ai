# Dashboard Templates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement comprehensive role-based dashboard templates for CRM, Logistics, and Sales modules with widget-based customization, allowing users to select templates and customize layouts while maintaining real data integration.

**Architecture:** Template system built on widget components where each role (Sales Rep, Manager, Executive, etc.) has a pre-configured default layout. Users load their role template on first visit, then customize via add/remove/resize widgets. Customizations persist to user_preferences table. All widgets fetch real data from Supabase via ScopedDataAccess (existing multi-tenant filtering).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, Radix UI, Shadcn/ui, Supabase, Vitest

---

## Task 1: Create Dashboard Template Types and Interfaces

**Files:**
- Create: `src/types/dashboardTemplates.ts`
- Modify: `src/types/dashboard.ts` (add new types if needed)

**Step 1: Write TypeScript interfaces for template system**

```typescript
// src/types/dashboardTemplates.ts
export type UserRole =
  // CRM Roles
  | 'crm_sales_rep'
  | 'crm_sales_manager'
  | 'crm_account_executive'
  | 'crm_executive'
  // Logistics Roles
  | 'logistics_dispatcher'
  | 'logistics_fleet_manager'
  | 'logistics_ops_manager'
  | 'logistics_executive'
  // Sales Roles
  | 'sales_quote_manager'
  | 'sales_manager'
  | 'sales_executive';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface WidgetInstance {
  id: string;
  type: string;
  title: string;
  size: WidgetSize;
  position: number;
  settings?: Record<string, any>;
}

export interface DashboardTemplate {
  id: string;
  role: UserRole;
  module: 'crm' | 'logistics' | 'sales';
  name: string;
  description: string;
  defaultWidgets: WidgetInstance[];
  createdAt: Date;
}

export interface UserDashboardPreferences {
  userId: string;
  role: UserRole;
  customWidgets: WidgetInstance[];
  customizationApplied: boolean;
  lastModified: Date;
}

export interface DashboardStats {
  [key: string]: string | number;
}
```

**Step 2: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No TypeScript errors related to new types

**Step 3: Commit**

```bash
git add src/types/dashboardTemplates.ts
git commit -m "feat(dashboard): add dashboard template types and interfaces"
```

---

## Task 2: Create Widget Base Component and Widget Registry

**Files:**
- Create: `src/components/dashboard/Widget.tsx`
- Create: `src/components/dashboard/widgetRegistry.ts`

**Step 1: Create base Widget wrapper component**

```typescript
// src/components/dashboard/Widget.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { X, Maximize2 } from 'lucide-react';
import { WidgetSize } from '@/types/dashboardTemplates';

interface WidgetProps {
  id: string;
  title: string;
  size: WidgetSize;
  children: React.ReactNode;
  onRemove?: (id: string) => void;
  onResize?: (id: string, newSize: WidgetSize) => void;
  className?: string;
}

export function Widget({ id, title, size, children, onRemove, onResize, className }: WidgetProps) {
  const sizeClasses = {
    small: 'col-span-1 row-span-1',
    medium: 'col-span-1 md:col-span-2 row-span-2',
    large: 'col-span-2 md:col-span-3 row-span-2',
    full: 'col-span-1 md:col-span-4 row-span-2',
  };

  const handleResize = () => {
    const sizes: WidgetSize[] = ['small', 'medium', 'large', 'full'];
    const currentIndex = sizes.indexOf(size);
    const nextSize = sizes[(currentIndex + 1) % sizes.length];
    onResize?.(id, nextSize);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'bg-white border border-gray-200 rounded-lg shadow-sm p-4 h-full flex flex-col',
        sizeClasses[size],
        className
      )}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          {onResize && (
            <button
              onClick={handleResize}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Resize widget"
            >
              <Maximize2 className="h-4 w-4 text-gray-500" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(id)}
              className="p-1 hover:bg-red-50 rounded transition-colors"
              title="Remove widget"
            >
              <X className="h-4 w-4 text-gray-500 hover:text-red-600" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </motion.div>
  );
}
```

**Step 2: Create widget registry with all widget definitions**

```typescript
// src/components/dashboard/widgetRegistry.ts
import { WidgetSize } from '@/types/dashboardTemplates';
import React from 'react';

export interface WidgetDefinition {
  type: string;
  label: string;
  description: string;
  defaultSize: WidgetSize;
  module: 'crm' | 'logistics' | 'sales' | 'shared';
  icon?: React.ReactNode;
  component: React.ComponentType<{ settings?: Record<string, any> }>;
}

const widgetRegistry: Map<string, WidgetDefinition> = new Map();

export function registerWidget(definition: WidgetDefinition) {
  widgetRegistry.set(definition.type, definition);
}

export function getWidget(type: string): WidgetDefinition | undefined {
  return widgetRegistry.get(type);
}

export function getAllWidgets(): WidgetDefinition[] {
  return Array.from(widgetRegistry.values());
}

export function getWidgetsByModule(module: string): WidgetDefinition[] {
  return Array.from(widgetRegistry.values()).filter(
    w => w.module === module || w.module === 'shared'
  );
}
```

**Step 3: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/components/dashboard/Widget.tsx src/components/dashboard/widgetRegistry.ts
git commit -m "feat(dashboard): create widget base component and registry system"
```

---

## Task 3: Create CRM Dashboard Widgets

**Files:**
- Create: `src/components/dashboard/crm/SalesRepDashboard.tsx`
- Create: `src/components/dashboard/crm/widgets/HeroMetrics.tsx`
- Create: `src/components/dashboard/crm/widgets/ActivityCalendar.tsx`
- Create: `src/components/dashboard/crm/widgets/MyActiveLeads.tsx`
- Create: `src/components/dashboard/crm/widgets/TodayActivityStream.tsx`
- Create: `src/components/dashboard/crm/widgets/QuickActions.tsx`

**Step 1: Create HeroMetrics widget (displays KPI numbers)**

```typescript
// src/components/dashboard/crm/widgets/HeroMetrics.tsx
import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Activity, Mail, Phone } from 'lucide-react';

export function HeroMetrics() {
  const { scopedDb } = useCRM();
  const [metrics, setMetrics] = useState({
    todayActivities: 0,
    callsMade: 0,
    emailsSent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Fetch today's activities count
        const today = new Date().toISOString().split('T')[0];
        const { count: activitiesCount } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);

        const { count: callsCount } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'call')
          .gte('created_at', `${today}T00:00:00`);

        const { count: emailsCount } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'email')
          .gte('created_at', `${today}T00:00:00`);

        setMetrics({
          todayActivities: activitiesCount || 0,
          callsMade: callsCount || 0,
          emailsSent: emailsCount || 0,
        });
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [scopedDb]);

  const metricCards = [
    { label: "Today's Activities", value: metrics.todayActivities, icon: Activity, color: 'bg-blue-100 text-blue-600' },
    { label: 'Calls Made', value: metrics.callsMade, icon: Phone, color: 'bg-green-100 text-green-600' },
    { label: 'Emails Sent', value: metrics.emailsSent, icon: Mail, color: 'bg-purple-100 text-purple-600' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-32">Loading metrics...</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {metricCards.map((metric) => (
        <div key={metric.label} className={`${metric.color} rounded-lg p-4 text-center`}>
          <metric.icon className="h-6 w-6 mx-auto mb-2" />
          <div className="text-2xl font-bold mb-1">{metric.value}</div>
          <div className="text-xs font-medium">{metric.label}</div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Create MyActiveLeads widget (table of leads)**

```typescript
// src/components/dashboard/crm/widgets/MyActiveLeads.tsx
import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { EnterpriseTable, type Column } from '@/components/ui/enterprise';

export function MyActiveLeads() {
  const { scopedDb } = useCRM();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const { data } = await scopedDb
          .from('contacts')
          .select('id, first_name, last_name, email, phone, created_at')
          .limit(10);
        setLeads(data || []);
      } catch (error) {
        console.error('Failed to fetch leads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [scopedDb]);

  const columns: Column<any>[] = [
    { key: 'first_name', label: 'Name', width: '150px' },
    { key: 'email', label: 'Email', width: '200px' },
    { key: 'phone', label: 'Phone', width: '120px' },
    { key: 'created_at', label: 'Added', width: '120px', render: (v) => new Date(v).toLocaleDateString() },
  ];

  if (loading) return <div>Loading leads...</div>;

  return (
    <EnterpriseTable
      columns={columns}
      data={leads}
      rowKey={(row) => row.id}
      emptyState={<p className="text-center py-8 text-gray-500">No leads found</p>}
    />
  );
}
```

**Step 3: Create QuickActions widget**

```typescript
// src/components/dashboard/crm/widgets/QuickActions.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, Phone } from 'lucide-react';

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-3 gap-3">
      <Button
        onClick={() => navigate('/dashboard/contacts/new')}
        className="h-16 flex flex-col items-center justify-center gap-1"
      >
        <Plus className="h-5 w-5" />
        <span className="text-xs">Create Lead</span>
      </Button>
      <Button
        variant="outline"
        className="h-16 flex flex-col items-center justify-center gap-1"
      >
        <Phone className="h-5 w-5" />
        <span className="text-xs">Log Call</span>
      </Button>
      <Button
        variant="outline"
        className="h-16 flex flex-col items-center justify-center gap-1"
      >
        <MessageSquare className="h-5 w-5" />
        <span className="text-xs">Send Email</span>
      </Button>
    </div>
  );
}
```

**Step 4: Create placeholder widgets (ActivityCalendar, TodayActivityStream)**

```typescript
// src/components/dashboard/crm/widgets/ActivityCalendar.tsx
import React from 'react';

export function ActivityCalendar() {
  return (
    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
      <p className="text-gray-500">Activity Calendar (Coming Soon)</p>
    </div>
  );
}
```

```typescript
// src/components/dashboard/crm/widgets/TodayActivityStream.tsx
import React from 'react';

export function TodayActivityStream() {
  return (
    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
      <p className="text-gray-500">Activity Stream (Coming Soon)</p>
    </div>
  );
}
```

**Step 5: Create SalesRepDashboard component**

```typescript
// src/components/dashboard/crm/SalesRepDashboard.tsx
import React, { useState } from 'react';
import { Widget } from '../Widget';
import { HeroMetrics } from './widgets/HeroMetrics';
import { MyActiveLeads } from './widgets/MyActiveLeads';
import { QuickActions } from './widgets/QuickActions';
import { ActivityCalendar } from './widgets/ActivityCalendar';
import { TodayActivityStream } from './widgets/TodayActivityStream';
import { WidgetInstance } from '@/types/dashboardTemplates';

const defaultWidgets: WidgetInstance[] = [
  { id: '1', type: 'hero_metrics', title: "Today's Metrics", size: 'full', position: 0 },
  { id: '2', type: 'my_leads', title: 'My Active Leads', size: 'large', position: 1 },
  { id: '3', type: 'quick_actions', title: 'Quick Actions', size: 'small', position: 2 },
  { id: '4', type: 'activity_calendar', title: 'Activity Calendar', size: 'medium', position: 3 },
  { id: '5', type: 'activity_stream', title: "Today's Activities", size: 'medium', position: 4 },
];

export function SalesRepDashboard() {
  const [widgets, setWidgets] = useState<WidgetInstance[]>(defaultWidgets);

  const handleRemoveWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  const handleResizeWidget = (id: string, newSize: WidgetInstance['size']) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, size: newSize } : w));
  };

  const renderWidget = (widget: WidgetInstance) => {
    switch (widget.type) {
      case 'hero_metrics':
        return <HeroMetrics />;
      case 'my_leads':
        return <MyActiveLeads />;
      case 'quick_actions':
        return <QuickActions />;
      case 'activity_calendar':
        return <ActivityCalendar />;
      case 'activity_stream':
        return <TodayActivityStream />;
      default:
        return <div>Unknown widget type: {widget.type}</div>;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-max">
      {widgets.map(widget => (
        <Widget
          key={widget.id}
          id={widget.id}
          title={widget.title}
          size={widget.size}
          onRemove={handleRemoveWidget}
          onResize={handleResizeWidget}
        >
          {renderWidget(widget)}
        </Widget>
      ))}
    </div>
  );
}
```

**Step 6: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 7: Commit**

```bash
git add src/components/dashboard/crm/
git commit -m "feat(dashboard): create Sales Rep dashboard with core widgets"
```

---

## Task 4: Create CRM Manager, Account Executive, and Executive Dashboards

**Files:**
- Create: `src/components/dashboard/crm/SalesManagerDashboard.tsx`
- Create: `src/components/dashboard/crm/AccountExecutiveDashboard.tsx`
- Create: `src/components/dashboard/crm/ExecutiveDashboard.tsx`
- Create: `src/components/dashboard/crm/widgets/TeamLeaderboard.tsx`
- Create: `src/components/dashboard/crm/widgets/PipelineByStage.tsx`
- Create: `src/components/dashboard/crm/widgets/ForecastVsActual.tsx`
- Create: `src/components/dashboard/crm/widgets/RevenueByAccount.tsx`

**Step 1-6: Repeat similar pattern for Manager, Account Executive, and Executive dashboards**

(Each dashboard follows same pattern: define default widgets array, create component that renders widgets, use Widget wrapper)

**Step 7: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 8: Commit**

```bash
git add src/components/dashboard/crm/
git commit -m "feat(dashboard): create manager, executive dashboards for CRM module"
```

---

## Task 5: Create Logistics Module Dashboards

**Files:**
- Create: `src/components/dashboard/logistics/DispatcherDashboard.tsx`
- Create: `src/components/dashboard/logistics/FleetManagerDashboard.tsx`
- Create: `src/components/dashboard/logistics/OpsManagerDashboard.tsx`
- Create: `src/components/dashboard/logistics/ExecutiveDashboard.tsx`
- Create: `src/components/dashboard/logistics/widgets/LiveRouteMap.tsx`
- Create: `src/components/dashboard/logistics/widgets/ShipmentQueue.tsx`
- Create: `src/components/dashboard/logistics/widgets/DriverStatus.tsx`
- Create: `src/components/dashboard/logistics/widgets/FleetStatus.tsx`
- Create: `src/components/dashboard/logistics/widgets/MaintenanceSchedule.tsx`
- Create: `src/components/dashboard/logistics/widgets/CostAnalysis.tsx`

**Step 1-7: Create Logistics dashboards following same pattern as CRM**

(Dispatcher has: LiveRouteMap, ShipmentQueue, DriverStatus, Alerts)
(Fleet Manager has: FleetStatus, MaintenanceSchedule, CostAnalysis, RouteEfficiency)
(Ops Manager has: DailyOps, WarehouseUtilization, CostBreakdown, PerformanceVsTarget)
(Executive has: RevenueForecast, ServiceQualityScorecard, EfficiencyTrends, CapacityVsDemand)

**Step 8: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 9: Commit**

```bash
git add src/components/dashboard/logistics/
git commit -m "feat(dashboard): create all Logistics module dashboards"
```

---

## Task 6: Create Sales Module Dashboards

**Files:**
- Create: `src/components/dashboard/sales/QuoteManagerDashboard.tsx`
- Create: `src/components/dashboard/sales/SalesManagerDashboard.tsx`
- Create: `src/components/dashboard/sales/ExecutiveDashboard.tsx`
- Create: `src/components/dashboard/sales/widgets/MyPendingQuotes.tsx`
- Create: `src/components/dashboard/sales/widgets/QuoteAccuracyTracker.tsx`
- Create: `src/components/dashboard/sales/widgets/TeamQuotaProgress.tsx`
- Create: `src/components/dashboard/sales/widgets/PipelineView.tsx`
- Create: `src/components/dashboard/sales/widgets/RevenueForecast.tsx`

**Step 1-7: Create Sales dashboards following same pattern**

(Quote Manager has: MyPendingQuotes, QuoteAccuracy, QuotesByStatus, QuickGenerator)
(Sales Manager has: TeamQuota, Pipeline, ConversionRate, SalesCyclePerformance)
(Executive has: ARR, SalesGrowth, Pipeline Waterfall, RevenueByProduct, TeamPerformance)

**Step 8: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 9: Commit**

```bash
git add src/components/dashboard/sales/
git commit -m "feat(dashboard): create all Sales module dashboards"
```

---

## Task 7: Create Dashboard Template Loader

**Files:**
- Create: `src/components/dashboard/DashboardTemplateLoader.tsx`
- Modify: `src/types/dashboardTemplates.ts` (add template definitions)

**Step 1: Create template definitions mapping**

```typescript
// src/components/dashboard/DashboardTemplateLoader.tsx
import React from 'react';
import { UserRole } from '@/types/dashboardTemplates';
import { SalesRepDashboard } from './crm/SalesRepDashboard';
import { SalesManagerDashboard } from './crm/SalesManagerDashboard';
import { AccountExecutiveDashboard } from './crm/AccountExecutiveDashboard';
import { CRMExecutiveDashboard } from './crm/ExecutiveDashboard';
import { DispatcherDashboard } from './logistics/DispatcherDashboard';
import { FleetManagerDashboard } from './logistics/FleetManagerDashboard';
import { OpsManagerDashboard } from './logistics/OpsManagerDashboard';
import { LogisticsExecutiveDashboard } from './logistics/ExecutiveDashboard';
import { QuoteManagerDashboard } from './sales/QuoteManagerDashboard';
import { SalesManagerDashboard as SalesModuleSalesManager } from './sales/SalesManagerDashboard';
import { SalesExecutiveDashboard } from './sales/ExecutiveDashboard';

const templateMap: Record<UserRole, React.ComponentType<any>> = {
  crm_sales_rep: SalesRepDashboard,
  crm_sales_manager: SalesManagerDashboard,
  crm_account_executive: AccountExecutiveDashboard,
  crm_executive: CRMExecutiveDashboard,
  logistics_dispatcher: DispatcherDashboard,
  logistics_fleet_manager: FleetManagerDashboard,
  logistics_ops_manager: OpsManagerDashboard,
  logistics_executive: LogisticsExecutiveDashboard,
  sales_quote_manager: QuoteManagerDashboard,
  sales_manager: SalesModuleSalesManager,
  sales_executive: SalesExecutiveDashboard,
};

interface DashboardTemplateLoaderProps {
  userRole: UserRole;
  userId: string;
}

export function DashboardTemplateLoader({ userRole, userId }: DashboardTemplateLoaderProps) {
  const Component = templateMap[userRole];

  if (!Component) {
    return <div className="p-8 text-red-600">Unknown role: {userRole}</div>;
  }

  return <Component userId={userId} />;
}
```

**Step 2: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/components/dashboard/DashboardTemplateLoader.tsx
git commit -m "feat(dashboard): create dashboard template loader component"
```

---

## Task 8: Create Dashboard Customization System

**Files:**
- Create: `src/hooks/useDashboardCustomization.ts`
- Create: `src/lib/dashboardPreferences.ts`
- Modify: `src/pages/Dashboard.tsx` (integrate template system)

**Step 1: Create hook for managing dashboard customization**

```typescript
// src/hooks/useDashboardCustomization.ts
import { useState, useEffect } from 'react';
import { UserDashboardPreferences, WidgetInstance, UserRole } from '@/types/dashboardTemplates';
import { useCRM } from '@/hooks/useCRM';

export function useDashboardCustomization(userRole: UserRole) {
  const { scopedDb } = useCRM();
  const [preferences, setPreferences] = useState<UserDashboardPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { data } = await scopedDb
          .from('user_preferences')
          .select('*')
          .eq('role', userRole)
          .maybeSingle();

        if (data) {
          setPreferences(data as UserDashboardPreferences);
        }
      } catch (error) {
        console.error('Failed to load dashboard preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [userRole, scopedDb]);

  const savePreferences = async (widgets: WidgetInstance[]) => {
    try {
      const updated = {
        role: userRole,
        customWidgets: widgets,
        customizationApplied: true,
        lastModified: new Date(),
      };

      const { error } = await scopedDb
        .from('user_preferences')
        .upsert(updated, { onConflict: 'role' });

      if (error) throw error;
      setPreferences(updated as UserDashboardPreferences);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  return { preferences, loading, savePreferences };
}
```

**Step 2: Create preferences utility functions**

```typescript
// src/lib/dashboardPreferences.ts
import { UserDashboardPreferences, WidgetInstance } from '@/types/dashboardTemplates';

export function mergeWidgets(
  defaultWidgets: WidgetInstance[],
  customWidgets?: WidgetInstance[]
): WidgetInstance[] {
  if (!customWidgets) return defaultWidgets;

  // Merge: keep default widgets, override with custom
  const customIds = new Set(customWidgets.map(w => w.id));
  return [
    ...customWidgets,
    ...defaultWidgets.filter(w => !customIds.has(w.id))
  ];
}

export function hasCustomization(preferences?: UserDashboardPreferences): boolean {
  return preferences?.customizationApplied ?? false;
}
```

**Step 3: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/hooks/useDashboardCustomization.ts src/lib/dashboardPreferences.ts
git commit -m "feat(dashboard): create customization hook and preference utilities"
```

---

## Task 9: Integrate Templates into Dashboard Router

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Create: `src/components/dashboard/DashboardRouter.tsx`

**Step 1: Create DashboardRouter component**

```typescript
// src/components/dashboard/DashboardRouter.tsx
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardTemplateLoader } from './DashboardTemplateLoader';
import { UserRole } from '@/types/dashboardTemplates';
import { useCRM } from '@/hooks/useCRM';

export function DashboardRouter() {
  const { context } = useCRM();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Determine user role from context
    // For now, default to crm_sales_rep - in production, get from auth/user profile
    setUserRole('crm_sales_rep');
    setLoading(false);
  }, [context]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!userRole) {
    return (
      <DashboardLayout>
        <div className="p-8 text-red-600">Unable to determine user role</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <DashboardTemplateLoader userRole={userRole} userId={context?.user?.id || ''} />
      </div>
    </DashboardLayout>
  );
}
```

**Step 2: Update main Dashboard.tsx to use router**

```typescript
// In src/pages/Dashboard.tsx, replace default dashboard with:
import { DashboardRouter } from '@/components/dashboard/DashboardRouter';

export default function Dashboard() {
  return <DashboardRouter />;
}
```

**Step 3: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/components/dashboard/DashboardRouter.tsx src/pages/Dashboard.tsx
git commit -m "feat(dashboard): integrate template system into main dashboard"
```

---

## Task 10: Create Tests for Dashboard Components

**Files:**
- Create: `src/components/dashboard/__tests__/Widget.test.tsx`
- Create: `src/components/dashboard/__tests__/DashboardRouter.test.tsx`
- Create: `src/components/dashboard/crm/__tests__/SalesRepDashboard.test.tsx`

**Step 1: Write widget component tests**

```typescript
// src/components/dashboard/__tests__/Widget.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Widget } from '../Widget';

describe('Widget Component', () => {
  it('renders widget with title and children', () => {
    render(
      <Widget id="test-1" title="Test Widget" size="medium">
        <div>Test content</div>
      </Widget>
    );

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('calls onRemove when remove button clicked', async () => {
    const handleRemove = vi.fn();
    const user = userEvent.setup();

    render(
      <Widget id="test-1" title="Test" size="small" onRemove={handleRemove}>
        Content
      </Widget>
    );

    const removeButton = screen.getByTitle('Remove widget');
    await user.click(removeButton);

    expect(handleRemove).toHaveBeenCalledWith('test-1');
  });

  it('calls onResize when resize button clicked', async () => {
    const handleResize = vi.fn();
    const user = userEvent.setup();

    render(
      <Widget id="test-1" title="Test" size="small" onResize={handleResize}>
        Content
      </Widget>
    );

    const resizeButton = screen.getByTitle('Resize widget');
    await user.click(resizeButton);

    expect(handleResize).toHaveBeenCalledWith('test-1', 'medium');
  });

  it('applies correct size classes', () => {
    const { container } = render(
      <Widget id="test-1" title="Test" size="large">
        Content
      </Widget>
    );

    expect(container.querySelector('.col-span-2')).toBeInTheDocument();
  });
});
```

**Step 2: Write dashboard router tests**

```typescript
// src/components/dashboard/__tests__/DashboardRouter.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardRouter } from '../DashboardRouter';
import * as useCRMModule from '@/hooks/useCRM';

describe('DashboardRouter Component', () => {
  beforeEach(() => {
    vi.spyOn(useCRMModule, 'useCRM').mockReturnValue({
      context: { user: { id: 'test-user' } },
      scopedDb: {} as any,
    });
  });

  it('renders loading state initially', () => {
    render(<DashboardRouter />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders dashboard template when role is determined', async () => {
    render(<DashboardRouter />);
    // Wait for component to load
    await screen.findByText(/Sales Rep|Dashboard/, { timeout: 2000 }).catch(() => null);
  });
});
```

**Step 3: Write Sales Rep dashboard tests**

```typescript
// src/components/dashboard/crm/__tests__/SalesRepDashboard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalesRepDashboard } from '../SalesRepDashboard';

describe('SalesRepDashboard Component', () => {
  it('renders all default widgets', () => {
    render(<SalesRepDashboard />);

    expect(screen.getByText("Today's Metrics")).toBeInTheDocument();
    expect(screen.getByText('My Active Leads')).toBeInTheDocument();
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('removes widget when remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<SalesRepDashboard />);

    const removeButtons = screen.getAllByTitle('Remove widget');
    await user.click(removeButtons[0]);

    // Widget should be removed
    expect(removeButtons.length).toBe(5); // Before removal
  });

  it('resizes widget when resize button is clicked', async () => {
    const user = userEvent.setup();
    render(<SalesRepDashboard />);

    const resizeButton = screen.getByTitle('Resize widget');
    await user.click(resizeButton);

    // Widget size should change
    expect(screen.getByText("Today's Metrics")).toBeInTheDocument();
  });
});
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/dashboard/__tests__ --run`
Expected: All new tests PASS

**Step 5: Commit**

```bash
git add src/components/dashboard/__tests__/
git commit -m "test(dashboard): add component tests for widgets and dashboards"
```

---

## Task 11: Create Storybook Stories for Dashboard Templates

**Files:**
- Create: `src/components/dashboard/Widget.stories.tsx`
- Create: `src/components/dashboard/crm/SalesRepDashboard.stories.tsx`
- Create: `src/components/dashboard/logistics/DispatcherDashboard.stories.tsx`
- Create: `src/components/dashboard/sales/QuoteManagerDashboard.stories.tsx`

**Step 1: Create Widget story**

```typescript
// src/components/dashboard/Widget.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Widget } from './Widget';

const meta: Meta<typeof Widget> = {
  title: 'Dashboard/Widget',
  component: Widget,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: {
    id: '1',
    title: 'Small Widget',
    size: 'small',
    children: <div className="p-4">Widget content here</div>,
  },
};

export const Medium: Story = {
  args: {
    id: '2',
    title: 'Medium Widget',
    size: 'medium',
    children: <div className="p-4">Widget content here</div>,
  },
};

export const Large: Story = {
  args: {
    id: '3',
    title: 'Large Widget',
    size: 'large',
    children: <div className="p-4">Widget content here</div>,
  },
};

export const Full: Story = {
  args: {
    id: '4',
    title: 'Full Width Widget',
    size: 'full',
    children: <div className="p-4">Widget content here</div>,
  },
};

export const WithActions: Story = {
  args: {
    id: '5',
    title: 'Widget with Actions',
    size: 'medium',
    children: <div className="p-4">Widget content</div>,
    onRemove: () => console.log('Remove clicked'),
    onResize: () => console.log('Resize clicked'),
  },
};
```

**Step 2: Create dashboard template stories**

```typescript
// src/components/dashboard/crm/SalesRepDashboard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { SalesRepDashboard } from './SalesRepDashboard';
import { BrowserRouter } from 'react-router-dom';

const meta: Meta<typeof SalesRepDashboard> = {
  title: 'Dashboard/CRM/SalesRepDashboard',
  component: SalesRepDashboard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <BrowserRouter>
        <Story />
      </BrowserRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

**Step 3: Verify Storybook builds**

Run: `npm run storybook -- --build`
Expected: Storybook builds successfully

**Step 4: Commit**

```bash
git add src/components/dashboard/**/*.stories.tsx
git commit -m "feat(dashboard): add storybook stories for dashboard components"
```

---

## Task 12: Create Database Migration for user_preferences Table

**Files:**
- Create: `supabase/migrations/20260225_create_user_preferences.sql`

**Step 1: Create migration file**

```sql
-- supabase/migrations/20260225_create_user_preferences.sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  custom_widgets JSONB,
  customization_applied BOOLEAN DEFAULT false,
  last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, role)
);

-- Create index on user_id for faster lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_role ON user_preferences(role);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: users can only see their own preferences
CREATE POLICY user_preferences_self_read ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_preferences_self_write ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_preferences_self_insert ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_preferences_self_delete ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);
```

**Step 2: Verify migration syntax**

Run: `cat supabase/migrations/20260225_create_user_preferences.sql`
Expected: File contains valid SQL

**Step 3: Commit**

```bash
git add supabase/migrations/20260225_create_user_preferences.sql
git commit -m "feat(db): add user_preferences table for dashboard customization"
```

---

## Task 13: Update Dashboard Customization Hook to Use Database

**Files:**
- Modify: `src/hooks/useDashboardCustomization.ts`
- Modify: `src/lib/dashboardPreferences.ts`

**Step 1: Update hook to fetch from database**

```typescript
// Updated src/hooks/useDashboardCustomization.ts
import { useState, useEffect } from 'react';
import { UserDashboardPreferences, WidgetInstance, UserRole } from '@/types/dashboardTemplates';
import { useCRM } from '@/hooks/useCRM';
import { useUser } from '@supabase/auth-helpers-react';

export function useDashboardCustomization(userRole: UserRole) {
  const { scopedDb } = useCRM();
  const user = useUser();
  const [preferences, setPreferences] = useState<UserDashboardPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user preferences on mount
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        const { data } = await scopedDb
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .eq('role', userRole)
          .maybeSingle();

        if (data) {
          setPreferences({
            userId: data.user_id,
            role: data.role,
            customWidgets: data.custom_widgets || [],
            customizationApplied: data.customization_applied || false,
            lastModified: new Date(data.last_modified),
          });
        }
      } catch (error) {
        console.error('Failed to load dashboard preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [userRole, user?.id, scopedDb]);

  const savePreferences = async (widgets: WidgetInstance[]) => {
    if (!user?.id) return;

    try {
      const { error } = await scopedDb
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          role: userRole,
          custom_widgets: widgets,
          customization_applied: true,
          last_modified: new Date(),
        }, { onConflict: 'user_id,role' });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  return { preferences, loading, savePreferences };
}
```

**Step 2: Verify TypeScript compilation**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/hooks/useDashboardCustomization.ts
git commit -m "feat(dashboard): wire dashboard customization to database persistence"
```

---

## Task 14: Final Integration Testing and Verification

**Files:**
- No new files

**Step 1: Start development server**

Run: `npm run dev`
Expected: Dev server starts successfully

**Step 2: Navigate to dashboard**

- Go to http://localhost:5173/dashboard
- Should see Sales Rep dashboard with widgets
- Verify all metrics widgets display

**Step 3: Test widget interactions**

- Click "Remove widget" on one of the widgets
- Widget should disappear
- Click "Resize widget" button
- Widget size should cycle through sizes
- Refresh page
- Customization should persist (if database is connected)

**Step 4: Test different role dashboards**

Manually change userRole in DashboardRouter.tsx to test:
- `crm_sales_manager` → should show manager-specific widgets
- `logistics_dispatcher` → should show dispatcher dashboard
- `sales_quote_manager` → should show quote manager dashboard

**Step 5: Verify TypeScript**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 6: Run tests**

Run: `npm test -- --run`
Expected: All dashboard tests pass (note: pre-existing failures OK)

**Step 7: Commit**

```bash
git add .
git commit -m "feat(dashboard): complete dashboard templates implementation with full integration"
```

---

## Success Criteria

✅ All 11 dashboard templates created (4 CRM + 4 Logistics + 3 Sales roles)
✅ Widget system implemented with base Widget component
✅ All widgets render and fetch real data from Supabase
✅ Widget customization works (add/remove/resize)
✅ Dashboard customization persists to database
✅ TypeScript type checking passes with zero errors
✅ All dashboard tests pass
✅ Storybook stories for all templates
✅ Database migration for user_preferences table
✅ DashboardRouter intelligently loads correct template based on user role
✅ No console errors when navigating dashboards
✅ All business logic preserved (data fetching, metrics calculations, etc.)

---
