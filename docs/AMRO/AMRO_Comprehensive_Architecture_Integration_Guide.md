# AMRO Comprehensive Architecture & Integration Guide
## Enterprise-Grade Multi-Tenant Aircraft Maintenance Platform

**Document Version:** 2.0 (Enhanced)
**Classification:** Technical Architecture | Internal Use
**Date:** March 26, 2026
**Status:** Architecture Review & Planning Phase
**Audience:** Technical Leads, Architects, Database Engineers, Frontend Developers

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Architecture Compatibility & Integration](#section-2-architecture-compatibility--integration)
3. [Comprehensive Gap Analysis Framework](#section-3-comprehensive-gap-analysis)
4. [Functional & Workflow Gap Analysis](#section-4-functional--workflow-gap-analysis)
5. [Implementation Architecture & Patterns](#section-5-implementation-architecture--patterns)
6. [Component Reuse Strategy](#section-6-component-reuse-strategy)
7. [Migration & Rollout Plan](#section-7-migration--rollout-plan)
8. [Compliance & Audit Readiness](#section-8-compliance--audit-readiness)
9. [Appendices](#section-9-appendices)

---

## EXECUTIVE SUMMARY

This document builds upon the foundational AMRO Technical Architecture Design by providing **explicit integration mappings** between ATA/MSG-3 standards and the existing **logic-nexus-ai** platform architecture.

### Key Objectives

| Objective | Status | Benefit |
|-----------|--------|---------|
| **Zero Breaking Changes** | ✓ Design | Extend existing API/DB patterns; no rewrites required |
| **Component Reuse** | ✓ Design | Leverage 200+ shadcn/ui components; existing auth/multi-tenancy |
| **Enterprise Compliance** | ✓ Design | FAA/EASA audit-ready with existing RLS + audit logging |
| **Scalability** | ✓ Design | Extend Supabase PostgreSQL; inherit rate limiting & caching |
| **Developer Velocity** | ✓ Design | Consistent patterns reduce ramp-up time by ~40% |

### Platform Baseline (Current State)

| Component | Status | Utilization for AMRO |
|-----------|--------|----------------------|
| **Frontend Framework** | React 18 + TypeScript | Reuse entirely; add AMRO feature modules |
| **UI Component Library** | shadcn/ui + Radix UI | 150+ components available for AMRO UX |
| **Styling** | TailwindCSS + CSS variables | Consistent theme; add AMRO-specific utilities |
| **State Management** | React Query + Context | Extend for aircraft/task/work package queries |
| **Backend DB** | Supabase PostgreSQL | Add 20+ AMRO tables; inherit RLS policies |
| **Auth & Multi-Tenancy** | JWT + Row-Level Security | Reuse existing tenant/franchise isolation |
| **API Gateway** | Vite + Node.js middleware | Add /api/v2/amro/* routes using proven patterns |
| **Deployment** | GitHub Actions + Docker | Extend pipelines for AMRO schema migrations |

### Project Scope & Constraints

**Scope:**
- Multi-tenant AMRO system supporting unlimited tenant/franchise combinations
- ATA iSpec 2200 compliant documentation; MSG-3 maintenance logic
- Support top-tier MRO features: applicability engine, master→fleet propagation, WCF rules
- Mobile-ready UI using responsive TailwindCSS components
- Real-time work package tracking and compliance reporting
- Zero-downtime deployment capability

**Constraints:**
- 40-page maximum document length (structured sections with appendices)
- No core logic-nexus-ai refactoring; only extension
- 18-month implementation timeline (phased rollout)
- Maintain backward compatibility with existing quotation/CRM modules

---

## SECTION 2: ARCHITECTURE COMPATIBILITY & INTEGRATION

### 2.1 API Layer Integration

**Current Architecture:** logic-nexus-ai uses middleware-chain pattern for all API requests.

**Chain Order** (applied to ALL requests):
```
Request → CORS → Preflight → BuildContext (correlation ID) → enforceHttps
→ enforceRateLimit (100 req/min, 40 mutations/min) → authenticateRequest (JWT)
→ resolveAndApplyAccessContext (tenant/franchise scope) → enforceAnyPermission
→ Business Logic → sendErrorResponse → Client
```

**AMRO Integration Strategy:**

**Step 1: Route Organization**

```typescript
// AMRO routes: /api/v2/amro/*
src/pages/api/v2/amro/
├── aircraft/
│   ├── index.ts              # List aircraft (multi-tenant filtered)
│   ├── [id]/index.ts         # Get aircraft detail
│   ├── [id]/maintenance-status.ts   # Calculate next due
│   └── [id]/mpd-auto-populate.ts    # Master→Fleet propagation
├── maintenance-tasks/
│   ├── index.ts              # List tasks (applicability-filtered)
│   ├── [id]/index.ts         # Task definition detail
│   └── [id]/applicability-check.ts  # Check if task applies to aircraft
├── work-orders/
│   ├── index.ts              # Work package CRUD
│   ├── [id]/execute.ts       # Begin execution
│   ├── [id]/complete.ts      # Close work package
│   └── [id]/sign-off.ts      # Digital signature
├── task-intervals/
│   └── [id]/next-due.ts      # Calculate next due with WCF logic
└── compliance/
    ├── audit-report.ts       # FAA/EASA compliance export
    └── compliance-status.ts   # Regulatory status dashboard
```

**Step 2: Endpoint Pattern**

Each AMRO endpoint inherits the middleware chain. Example:

```typescript
// src/pages/api/v2/amro/aircraft/[id]/maintenance-status.ts

import { withApiMiddleware } from '@/pages/api/_utils/middleware';
import { sendErrorResponse, sendSuccessResponse } from '@/pages/api/_utils/http';
import { AircraftMaintenanceService } from '@/services/amro/AircraftMaintenanceService';

async function handler(req, res) {
  const { id } = req.query;
  const { tenantId, franchiseId } = req.context;  // From resolveAndApplyAccessContext

  try {
    // Service encapsulates business logic and applies scope
    const service = new AircraftMaintenanceService(tenantId, franchiseId);
    const status = await service.calculateNextDue(id);

    return sendSuccessResponse(res, { data: status });
  } catch (error) {
    return sendErrorResponse(res, error, 500);
  }
}

export default withApiMiddleware(handler, {
  methods: ['GET'],
  permissions: ['amro.aircraft.view'],  // Defined in src/config/permissions.ts
});
```

**Step 3: Request/Response Standardization**

All AMRO API responses follow existing pattern:

```typescript
// Success Response
{
  "success": true,
  "data": { /* payload */ },
  "correlationId": "uuid",
  "timestamp": "2026-03-26T10:30:00Z"
}

// Error Response
{
  "success": false,
  "error": "Aircraft not found in accessible tenant",
  "code": "AIRCRAFT_NOT_FOUND",
  "correlationId": "uuid",
  "details": { /* debug info, only if allowed */ }
}
```

**Step 4: Rate Limiting & Caching**

AMRO routes inherit existing rate limiting:
- **Query limits**: 100 requests/minute (shared with all API)
- **Mutation limits**: 40 requests/minute (shared with all API)
- **Cache headers**: Apply 300-second cache to read-heavy AMRO queries (e.g., `/maintenance-tasks`)
- **Cache invalidation**: Via React Query on mutations (automatic)

**Recommendation:** For future optimization, implement dedicated AMRO rate limits (e.g., 50 mutations/min for work package submission).

### 2.2 Multi-Tenancy Integration

**Current Model:**

```
Tenants (top-level)
  ├── Tenant Admin (role)
  │   └── Can manage franchises within tenant
  ├── Franchises (sub-unit)
  │   ├── Franchise Admin (role)
  │   │   └── Can manage users within franchise
  │   └── Regular Users (role)
  │       └── Can execute work within franchise
  └── Platform Admin (global role, overrideable per tenant)
      └── Can access any tenant/franchise with override enabled
```

**AMRO Tenant Isolation Requirements:**

All AMRO tables MUST include:

```sql
-- Required columns on EVERY AMRO table
tenant_id UUID NOT NULL REFERENCES tenants(id),
franchise_id UUID REFERENCES franchises(id),  -- Optional if tenant-wide

-- Add to existing RLS policy or create new
CREATE POLICY amro_tenant_isolation ON [table_name]
  USING (
    tenant_id = current_setting('app.tenant_id')::uuid
    AND (
      franchise_id IS NULL
      OR franchise_id = current_setting('app.franchise_id')::uuid
    )
  );

ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
```

**Scope Resolution Workflow (for AMRO):**

```typescript
// In src/lib/db/access.ts - Extend existing ScopedDataAccess class

class ScopedDataAccess {
  // Existing method (works for all modules)
  static withScope<T>(query: SupabaseQuery<T>, scope: DataAccessContext): Query<T> {
    return query
      .eq('tenant_id', scope.tenantId)
      .eq('franchise_id', scope.franchiseId || null);  // Allows master MPD (franchise_id=NULL)
  }

  // NEW: AMRO-specific scope (allows master MPD access)
  static withAmroScope<T>(query: SupabaseQuery<T>, scope: DataAccessContext): Query<T> {
    return query
      .eq('tenant_id', scope.tenantId)
      .or(`franchise_id.eq.${scope.franchiseId},franchise_id.is.null`);  // Accept master MPD
  }
}
```

**Master MPD Access Pattern:**

```typescript
// Master MPD tables (franchise_id = NULL) are accessible to all tenants for reading
// But each tenant has their own copy of applicability rules

// Example: Fetch master MPD tasks applicable to fleet aircraft
const masterTasks = await supabase
  .from('maintenance_tasks')
  .select('*')
  .is('franchise_id', null)  // Master MPD
  .eq('tenant_id', tenantId);  // Still scoped by tenant (admin uploads per tenant)

// But organization hierarchy:
// Platform Admin → Tenant-wide Master MPD → Franchise-specific Fleet MPD
```

**Implementation Checklist:**

- [ ] Add `tenant_id` + `franchise_id` to all AMRO tables (migrations)
- [ ] Enable RLS policies (with amro_tenant_isolation policy)
- [ ] Extend ScopedDataAccess.withAmroScope() for master MPD filtering
- [ ] Update API endpoints to use withAmroScope() when loading tasks
- [ ] Add scope validation in AMRO services (defensive check)

### 2.3 Database Schema Integration

**Current Supabase Setup:**
- PostgreSQL 14+ with extensions: uuid-ossp, pgcrypto, pg_trgm
- 200+ existing tables for quotation, CRM, finance modules
- Migrations directory: `supabase/migrations/`
- Type generation: `supabase types` auto-generates TypeScript interfaces

**AMRO Schema Additions:**

**New Tables (20 tables total):**

```sql
-- 1. ATA Code Hierarchy (recursive)
CREATE TABLE amro.ata_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  code VARCHAR(20) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES amro.ata_codes(id),
  level SMALLINT,
  chapter_code VARCHAR(2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(tenant_id, code),
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- 2. Maintenance Tasks (Master MPD)
CREATE TABLE amro.maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  franchise_id UUID,  -- NULL for master, populated for fleet
  task_code VARCHAR(50) NOT NULL,
  ata_code_id UUID NOT NULL REFERENCES amro.ata_codes(id),
  description TEXT NOT NULL,
  skill_type VARCHAR(50) NOT NULL,  -- AIRFRAME, ENGINE, AVIONICS, HYDRAULIC
  estd_man_hours DECIMAL(8,2) NOT NULL,
  version_number INT DEFAULT 1,
  superseded_by_id UUID REFERENCES amro.maintenance_tasks(id),
  effective_date DATE NOT NULL,
  obsolete_date DATE,
  applicability_rules JSONB DEFAULT '{}',
  source_type VARCHAR(50),  -- MPD, AD, SB, MRB
  source_ref VARCHAR(100),
  revision_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(tenant_id, franchise_id, task_code, version_number),
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  FOREIGN KEY (franchise_id) REFERENCES public.franchises(id)
);

-- 3. Task Intervals (polymorphic)
CREATE TABLE amro.task_intervals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES amro.maintenance_tasks(id) ON DELETE CASCADE,
  interval_type VARCHAR(50) NOT NULL,  -- FLIGHT_HOURS, CALENDAR_MONTHS, LANDINGS, CYCLES
  interval_value INT NOT NULL,
  grace_period_type VARCHAR(20),  -- PERCENT, DAYS
  grace_period_value INT,
  effective_from_interval INT DEFAULT 0,
  repeat_count INT,
  depends_on_interval_id UUID REFERENCES amro.task_intervals(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- 4. Aircraft (existing; extend with AMRO columns)
-- ALTER TABLE aircraft ADD COLUMN current_flight_hours DECIMAL(10,1) DEFAULT 0;
-- ALTER TABLE aircraft ADD COLUMN current_landings INT DEFAULT 0;
-- ALTER TABLE aircraft ADD COLUMN maintenance_program VARCHAR(50);  -- A-Check, C-Check, etc.

-- 5. Aircraft-Task Link (realizes maintenance schedule)
CREATE TABLE amro.aircraft_maintenance_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  franchise_id UUID NOT NULL,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id),
  task_id UUID NOT NULL REFERENCES amro.maintenance_tasks(id),
  task_activated_date DATE NOT NULL,
  primary_interval_id UUID REFERENCES amro.task_intervals(id),
  primary_interval_type VARCHAR(50),
  primary_interval_value INT,
  last_completed_date DATE,
  last_completed_flight_hours DECIMAL(10,1),
  last_completed_landings INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(tenant_id, aircraft_id, task_id),
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  FOREIGN KEY (franchise_id) REFERENCES public.franchises(id)
);

-- 6. Work Packages (container for multiple tasks)
CREATE TABLE amro.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  franchise_id UUID NOT NULL,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id),
  wp_number VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'planning',  -- planning, approved, scheduled, in_progress, on_hold, completed, closed
  check_type VARCHAR(50),  -- A-Check, Annual, C-Check
  planned_start_date DATE,
  actual_start_date DATE,
  estimated_completion_date DATE,
  actual_completion_date DATE,
  estimated_man_hours DECIMAL(10,2),
  actual_man_hours DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.auth.users(id),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(tenant_id, wp_number),
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  FOREIGN KEY (franchise_id) REFERENCES public.franchises(id)
);

-- 7. Work Package Tasks (line items)
CREATE TABLE amro.work_order_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES amro.work_orders(id) ON DELETE CASCADE,
  aircraft_maintenance_task_id UUID NOT NULL REFERENCES amro.aircraft_maintenance_tasks(id),
  status VARCHAR(50) DEFAULT 'not_started',  -- not_started, in_progress, completed, rework_required
  assigned_to UUID REFERENCES public.auth.users(id),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  man_hours_actual DECIMAL(8,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Service Bulletins (SB tracking for applicability)
CREATE TABLE amro.service_bulletins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  franchise_id UUID NOT NULL,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id),
  sb_number VARCHAR(50) NOT NULL,
  description TEXT,
  embodied_date DATE,
  effective_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  FOREIGN KEY (franchise_id) REFERENCES public.franchises(id)
);

-- 9-20. Additional tables: Modifications, Certifications, Skill Types, Maintenance Checks, etc.
-- (See Appendix A for complete schema)
```

**Migration Files:**

Create new migration files in `supabase/migrations/`:

```bash
20260401_amro_schema_phase1.sql       # ATA codes, tasks, intervals, aircraft-task link
20260405_amro_schema_phase2.sql       # Work packages, SBs, certifications
20260410_amro_rls_policies.sql        # Row-level security policies
20260415_amro_stored_procedures.sql   # PostgreSQL functions for applicability checks
```

**Type Generation:**

After migrations, regenerate TypeScript types:

```bash
npm run supabase:types:gen
# Generates src/integrations/supabase/types.ts with full AMRO table types
```

### 2.4 UI Component Integration

**Component Reuse Strategy:**

| Component Type | Existing Library | Reuse for AMRO | Example |
|---|---|---|---|
| **Buttons** | shadcn/ui Button | ✓ 100% | ActionButton, DeleteButton, SubmitButton |
| **Forms** | React Hook Form + shadcn/ui | ✓ 100% | MaintenanceTaskForm, WorkOrderForm |
| **Tables** | TanStack React Table | ✓ 100% | AircraftListTable, TaskListTable (with applicability filter) |
| **Selects** | shadcn/ui Select + Combobox | ✓ 100% | AircraftSelect, TaskSelect with search |
| **Dialogs** | shadcn/ui Dialog | ✓ 100% | ConfirmStartWorkOrder, SignOffDialog |
| **Tabs** | shadcn/ui Tabs | ✓ 100% | MaintenanceTaskDetails (applicability, intervals, history) |
| **Alerts** | shadcn/ui Alert + Sonner Toast | ✓ 100% | WorkOrderStatusAlert, ComplianceWarning |
| **Charts** | Recharts + TailwindCSS | ✓ New | MaintenanceMetricsDashboard, ComplianceTimeline |
| **Date Pickers** | React Day Picker + shadcn/ui | ✓ 100% | WorkOrderDateRangeSelect |
| **Modals** | shadcn/ui Dialog | ✓ 100% | MasterMpdImportModal, ApplicabilityRuleEditor |

**Component File Organization:**

```typescript
src/components/
├── amro/
│   ├── aircraft/
│   │   ├── AircraftListTable.tsx           # Reuse TanStack patterns
│   │   ├── AircraftDetailCard.tsx          # shadcn/ui Card
│   │   ├── AircraftMaintenanceStatusWidget.tsx  # Next due + WCF indicator
│   │   └── AircraftSelect.tsx              # Searchable select with applicability filter
│   ├── maintenance-tasks/
│   │   ├── MaintenanceTaskList.tsx         # List with applicability filter
│   │   ├── TaskApplicabilityViewer.tsx     # JSON viewer for applicability rules
│   │   └── TaskDetailsTabs.tsx             # Tabs: intervals, history, versions
│   ├── work-orders/
│   │   ├── WorkOrderForm.tsx             # React Hook Form + shadcn/ui
│   │   ├── WorkOrderStatusBadge.tsx      # Status indicator (GREEN/YELLOW/RED)
│   │   ├── WorkOrderExecutor.tsx         # Task list + sign-off flow
│   │   └── WorkOrderSignOffDialog.tsx    # Digital signature modal
│   ├── compliance/
│   │   ├── ComplianceDashboard.tsx         # Maintenance status + alerts
│   │   ├── AuditReportExporter.tsx         # Generate FAA/EASA exports
│   │   └── ComplianceTimelineChart.tsx     # Recharts timeline
│   └── shared/
│       ├── ApplicabilityRuleEditor.tsx     # JSON editor for complex rules
│       ├── NextDueIndicator.tsx            # Displays remaining hours/days + WCF
│       └── MaintenanceAlertBanner.tsx      # RED/YELLOW/GREEN status banner
```

**Component Pattern (Example: `AircraftMaintenanceStatusWidget.tsx`):**

```typescript
import { useCRM } from '@/hooks/useCRM';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface Props {
  aircraftId: string;
  className?: string;
}

export function AircraftMaintenanceStatusWidget({ aircraftId, className }: Props) {
  const { tenantId, franchiseId } = useCRM();

  const { data: status, isLoading } = useQuery({
    queryKey: ['aircraft-maintenance-status', aircraftId],
    queryFn: () =>
      fetch(`/api/v2/amro/aircraft/${aircraftId}/maintenance-status?tenantId=${tenantId}`)
        .then(r => r.json())
        .then(r => r.data),
    staleTime: 5 * 60 * 1000,  // 5-minute cache
  });

  if (isLoading) return <div className="animate-pulse">Loading...</div>;
  if (!status) return null;

  const statusColor = status.due_status === 'RED' ? 'destructive'
                    : status.due_status === 'YELLOW' ? 'warning'
                    : 'default';

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Maintenance Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Next Due:</span>
            <Badge variant={statusColor}>
              {status.which_comes_first === 'HOURS'
                ? `${status.remaining_hours}h`
                : `${status.remaining_days}d`}
            </Badge>
          </div>
          <div className="text-xs text-gray-500">
            {status.remaining_hours && `${status.remaining_hours} flight hours`}
            {status.remaining_days && ` / ${status.remaining_days} days`}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Styling Convention:**

```typescript
// Use TailwindCSS utility classes exclusively
// Component structure: compose from shadcn/ui + custom utilities

// GOOD
<div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
  <span className="text-sm font-medium text-gray-700">Status</span>
  <Badge variant="default">Active</Badge>
</div>

// AVOID
<div style={{ display: 'flex', padding: '16px' }}>  // ❌ Inline styles
const StyledDiv = styled.div``;  // ❌ Styled components
<div className={css.container}>  // ❌ CSS modules
```

### 2.5 Service Layer Integration

**Current Pattern** (from logic-nexus-ai):

```
API Route (/api/v2/amro/*)
  → Service Class (business logic, scope validation)
    → Repository/ScopedDataAccess (database)
      → Supabase Client (RLS enforcement)
```

**AMRO Services (new):**

```typescript
// src/services/amro/

// 1. ATA Code Service
export class AtaCodeService {
  private supabase: SupabaseClient;
  private scope: DataAccessContext;

  constructor(tenantId: string, franchiseId?: string) {
    this.scope = { tenantId, franchiseId };
  }

  async getHierarchy(parentCode?: string) {
    // Recursive fetch with scope
    return ScopedDataAccess.withScope(
      supabase.from('amro.ata_codes').select('*').eq('parent_id', parentCode),
      this.scope
    );
  }

  async rollupManHours(ataCodes: string[]) {
    // Aggregate man-hours by ATA chapter
  }
}

// 2. Maintenance Task Service
export class MaintenanceTaskService {
  async getMasterTasks() {
    // Fetch master MPD (franchise_id = NULL)
    // Allows master MPD visibility across fleet
  }

  async getFleetTasks(franchiseId: string) {
    // Fetch franchise-specific tasks (fleet MPD)
  }

  async checkApplicability(taskId: string, aircraftId: string) {
    // Call PostgreSQL is_task_applicable function
    // Return boolean + match details for UI
  }

  async autoPopulateMpdForAircraft(aircraftId: string) {
    // Apply master MPD to new aircraft
    // For each task: check applicability → create aircraft_maintenance_task if applicable
  }
}

// 3. Aircraft Maintenance Service
export class AircraftMaintenanceService {
  async calculateNextDue(aircraftId: string) {
    // Call PostgreSQL calculate_next_due function
    // Return: next due date/hours, remaining time, WCF indicator, status color
  }

  async updateFlightHours(aircraftId: string, hours: number) {
    // Increment current_flight_hours
    // Trigger recalculation for affected tasks
  }
}

// 4. Work Package Service
export class WorkOrderService {
  async create(payload: CreateWorkOrderPayload) {
    // Auto-select tasks for check type
    // Estimate man-hours from task definitions
    // Create work package + line items
  }

  async executeTask(workOrderTaskId: string, payload: ExecutePayload) {
    // Update task status, man-hours actual
    // Validate skill/certification of assigned technician
  }

  async signOff(workOrderId: string, signature: DigitalSignature) {
    // Validate all tasks completed
    // Record digital signature + timestamp
    // Transition work package to 'closed'
    // Update aircraft last_completed_date/hours
    // Log to audit trail
  }
}
```

**Scope Validation Pattern:**

```typescript
// Every service method MUST validate scope before database operations

async createWorkOrder(payload: CreateWorkOrderPayload): Promise<WorkOrder> {
  // Defensive check: ensure aircraft belongs to accessible scope
  const aircraft = await ScopedDataAccess.withScope(
    supabase.from('aircraft').select('id, tenant_id, franchise_id'),
    this.scope
  ).eq('id', payload.aircraftId).single();

  if (!aircraft) {
    throw new ForbiddenError('Aircraft not found in accessible scope');
  }

  // Proceed with creation
  return supabase.from('work_orders').insert({
    ...payload,
    tenant_id: this.scope.tenantId,
    franchise_id: this.scope.franchiseId,  // Inherit from aircraft
  });
}
```

### 2.6 React Query Integration

**Cache Strategy for AMRO:**

```typescript
// src/features/module-amro/hooks/queryKeys.ts

export const amroKeys = {
  all: () => ['amro'],

  // ATA Codes
  ataCodes: () => [...amroKeys.all(), 'ata-codes'],
  ataHierarchy: (parentId?: string) => [...amroKeys.ataCodes(), 'hierarchy', parentId],

  // Maintenance Tasks
  tasks: () => [...amroKeys.all(), 'tasks'],
  masterTasks: () => [...amroKeys.tasks(), 'master'],
  fleetTasks: (franchiseId: string) => [...amroKeys.tasks(), 'fleet', franchiseId],
  taskDetail: (id: string) => [...amroKeys.tasks(), 'detail', id],

  // Aircraft
  aircraft: () => [...amroKeys.all(), 'aircraft'],
  aircraftList: () => [...amroKeys.aircraft(), 'list'],
  aircraftDetail: (id: string) => [...amroKeys.aircraft(), 'detail', id],
  aircraftStatus: (id: string) => [...amroKeys.aircraft(), 'status', id],

  // Work Packages
  workOrders: () => [...amroKeys.all(), 'work-orders'],
  workOrderList: () => [...amroKeys.workOrders(), 'list'],
  workOrderDetail: (id: string) => [...amroKeys.workOrders(), 'detail', id],
};

// Cache configuration
export const AMRO_CACHE_CONFIG = {
  staleTime: 5 * 60 * 1000,      // 5 minutes
  gcTime: 10 * 60 * 1000,         // 10 minutes (formerly cacheTime)
  // Immediate invalidation for mutations
  mutationFn: () => { /* ... */ },
  onSuccess: (data, variables, context) => {
    queryClient.invalidateQueries({ queryKey: amroKeys.all() });
  },
};
```

**Hook Pattern:**

```typescript
// src/features/module-amro/hooks/useAircraftMaintenanceStatus.ts

export function useAircraftMaintenanceStatus(aircraftId: string) {
  const { tenantId } = useCRM();

  return useQuery({
    queryKey: amroKeys.aircraftStatus(aircraftId),
    queryFn: async () => {
      const res = await fetch(
        `/api/v2/amro/aircraft/${aircraftId}/maintenance-status?tenantId=${tenantId}`
      );
      if (!res.ok) throw new Error('Failed to fetch aircraft status');
      return res.json().then(r => r.data);
    },
    ...AMRO_CACHE_CONFIG,
    // Stale immediate re-fetch on visibility
    staleTime: 1 * 60 * 1000,  // 1 minute
    refetchOnWindowFocus: true,
  });
}

// Usage in component
export function AircraftMaintenancePanel({ aircraftId }: Props) {
  const { data: status, isLoading, error } = useAircraftMaintenanceStatus(aircraftId);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert error={error} />;

  return (
    <MaintenanceStatusWidget status={status} />
  );
}
```

---

## SECTION 3: COMPREHENSIVE GAP ANALYSIS

### 3.1 Competitive Analysis Framework

**Benchmark Systems** (Top 5 International MRO Platforms):

| System | Deployment | User Base | Specialization | Maturity |
|--------|-----------|-----------|---|---|
| **SAP Aviation** | Cloud/On-Prem | 200+ airlines | Enterprise mega-carrier | Mature (20+ yrs) |
| **AMOS** | Cloud | 100+ operators | General/rotary-wing | Mature (15+ yrs) |
| **Trax** | Cloud | 50+ operators | Regional/commercial | Mature (12+ yrs) |
| **Ramco** | Cloud/On-Prem | 150+ organizations | Cross-industry (aviation, marine, rail) | Mature (25+ yrs) |
| **IFS** | Cloud | 100+ enterprises | Cross-industry ERP | Mature (30+ yrs) |

**Feature Evaluation Matrix:**

| Feature Category | SAP | AMOS | Trax | Ramco | IFS | Logic Pro (Current) | Gap Severity |
|---|---|---|---|---|---|---|---|
| **Multi-tenancy** | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ (partial) | P1 |
| **ATA iSpec 2200 Compliance** | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✗ | P0 |
| **MSG-3 Logic** | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✗ | P0 |
| **Master→Fleet MPD** | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ | ✗ | P0 |
| **Applicability Engine** | ✓ ✓ | ✓ ✓ | ✓ | ✓ ✓ | ✓ | ✗ | P0 |
| **Work Package Management** | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✗ (partial) | P0 |
| **Digital Signature/Sign-Off** | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ | ✓ | ✗ | P1 |
| **Compliance Reporting (FAA/EASA)** | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ | ✓ | ✗ | P1 |
| **Mobile Field Execution** | ✓ | ✓ ✓ | ✓ ✓ | ✓ | ✗ | ✗ | P1 |
| **Predictive Analytics** | ✓ (premium) | ✗ | ✗ | ✓ | ✓ | ✗ | P2 |
| **Vendor Integration (ERP/Supply)** | ✓ ✓ | ✓ | ✓ | ✓ ✓ | ✓ ✓ | ✓ (quotation) | P2 |
| **Time & Materials Tracking** | ✓ ✓ | ✓ ✓ | ✓ ✓ | ✓ | ✓ | ✓ (quotation) | P2 |

**Legend:** ✓✓ = Excellent, ✓ = Good, ✗ = Not implemented, P0-P3 = Priority

### 3.2 Technical Architecture Gaps

#### Gap Category 1: Data Model Completeness

**Current State (logic-nexus-ai):**
- Quotation module: ~20 tables for pricing/quoting workflow
- CRM module: ~15 tables for lead/customer management
- Finance module: ~10 tables for invoicing
- Aircraft table exists but minimal AMRO-specific columns

**Gap Analysis:**

| Data Entity | Status | Impact | Effort | Notes |
|---|---|---|---|---|
| ATA Code Hierarchy | Missing | **HIGH** | 2 PD | Need recursive table for aviation compliance |
| Maintenance Task Library | Partial | **HIGH** | 5 PD | Existing: none; Need: 3000+ task templates per MPD |
| Task Intervals | Missing | **HIGH** | 3 PD | Critical for "whichever comes first" logic |
| Aircraft-Task Linking | Missing | **HIGH** | 2 PD | Realize maintenance schedule per aircraft/serial |
| Work Package Structure | Partial | **MEDIUM** | 4 PD | Exists in quotation; needs AMRO-specific extension |
| Service Bulletins Tracking | Missing | **MEDIUM** | 2 PD | SB embodiment affects task applicability |
| Maintenance Checks (A/C/Annual) | Missing | **MEDIUM** | 2 PD | Check grouping of multiple tasks |
| Digital Signatures | Missing | **MEDIUM** | 3 PD | Sign-off audit trail for compliance |
| Skill Certifications | Missing | **LOW** | 1 PD | Link technicians to specific certifications |
| Compliance Audit Log | Partial | **HIGH** | 2 PD | Extend existing audit_logs for AMRO specifics |

**Effort Estimate:** ~24 person-days for complete AMRO data model

**Recommendation:** Phase 1 (P0 items) = 14 PD, Phase 2 (P1 items) = 10 PD

#### Gap Category 2: API Endpoints

**Current Endpoints (Existing):**
- `GET/POST /api/v1/franchises` - Franchise CRUD
- `GET/POST /api/v1/quotations` - Quotation CRUD
- Limited to quotation/CRM domains

**Missing AMRO Endpoints (14 endpoints):**

```typescript
// ATA Codes
GET  /api/v2/amro/ata-codes            # List with hierarchy
POST /api/v2/amro/ata-codes            # Create new code
GET  /api/v2/amro/ata-codes/:id        # Get with subtree

// Maintenance Tasks
GET  /api/v2/amro/maintenance-tasks    # Filter by applicability
POST /api/v2/amro/maintenance-tasks/import  # Bulk import master MPD
GET  /api/v2/amro/maintenance-tasks/:id     # Task detail + history
POST /api/v2/amro/maintenance-tasks/:id/applicability-check # Check if applies to aircraft

// Aircraft
GET  /api/v2/amro/aircraft/:id/maintenance-status    # Calculate next due + WCF
POST /api/v2/amro/aircraft/:id/mpd-auto-populate    # Apply master MPD
PUT  /api/v2/amro/aircraft/:id/flight-update        # Increment flight hours

// Work Packages
GET  /api/v2/amro/work-orders        # List for franchise
POST /api/v2/amro/work-orders        # Create with auto-select tasks
GET  /api/v2/amro/work-orders/:id    # Work package detail
POST /api/v2/amro/work-orders/:id/execute  # Start execution
POST /api/v2/amro/work-orders/:id/sign-off # Digital signature + close

// Compliance
GET  /api/v2/amro/compliance/audit-report     # Export FAA/EASA format
GET  /api/v2/amro/compliance/status-dashboard # Compliance metrics
```

**Implementation Effort:** ~10 person-days

#### Gap Category 3: Business Logic Functions

**Current PostgreSQL Functions (quotation module):**
- `calculate_quote_total()` - Sum pricing
- `apply_discount()` - Apply to line items

**Missing Functions (Critical):**

```postgresql
-- Function 1: Check task applicability (see Section 1)
CREATE OR REPLACE FUNCTION is_task_applicable(
  p_task_id UUID, p_aircraft_id UUID, p_tenant_id UUID
) RETURNS BOOLEAN;

-- Function 2: Calculate next due (see Section 1)
CREATE OR REPLACE FUNCTION calculate_next_due(
  p_aircraft_task_id UUID,
  p_current_flight_hours DECIMAL,
  p_current_calendar_date DATE
) RETURNS TABLE(...);

-- Function 3: Apply master MPD to aircraft (new aircraft onboarding)
CREATE OR REPLACE FUNCTION apply_master_mpd_to_aircraft(
  p_aircraft_id UUID,
  p_tenant_id UUID,
  p_franchise_id UUID
) RETURNS SETOF aircraft_maintenance_tasks;

-- Function 4: Auto-populate work package tasks (check type → tasks)
CREATE OR REPLACE FUNCTION auto_populate_work_order_tasks(
  p_work_order_id UUID,
  p_check_type VARCHAR
) RETURNS SETOF work_order_tasks;
```

**Implementation Effort:** ~8 person-days for testing + optimization

#### Gap Category 4: Frontend Views & Pages

**Current AMRO UI (minimal):**
- `AmroSettingsPage.tsx` - Master data configuration
- `AmroHubVerticalPage.tsx` - Dashboard placeholder
- ~5 components

**Missing Views (10 critical pages):**

| Page | Purpose | Components Needed | Effort |
|---|---|---|---|
| Aircraft List + Status | Show fleet + next due | Table, status widget, filter | 2 PD |
| Maintenance Task Library | Browse/search/import tasks | Task list, applicability viewer | 3 PD |
| Work Package Builder | Create + plan work | Form, task selector, date picker | 3 PD |
| Work Package Execution | Field technician interface | Task list, sign-off, timer | 3 PD |
| Maintenance Scheduler | Plan checks/packages | Calendar, conflict detection | 3 PD |
| Compliance Dashboard | Regulatory status + alerts | Charts, metric cards | 2 PD |
| Historical Reports | 5-year audit trail export | Report builder, PDF export | 2 PD |
| SB Management | Track embodied bulletins | SB list, status tracker | 1 PD |

**Total Effort:** ~19 person-days

#### Gap Category 5: Mobile & Offline Capability

**Current Status:**
- logic-nexus-ai is responsive (TailwindCSS)
- No offline capability
- No PWA (Progressive Web App) support

**AMRO Mobile Requirements:**
- Field technicians need work-offline (Wi-Fi unreliable on tarmac)
- Offline forms with sync on reconnect
- QR code scanner for aircraft/parts identification

**Gap:**

| Capability | Status | Impact | Effort |
|---|---|---|---|
| Responsive Design | ✓ (TailwindCSS) | LOW | 0 PD (inherent) |
| PWA Support | ✗ | MEDIUM | 5 PD |
| Offline Sync | ✗ | HIGH | 10 PD |
| QR/Barcode Scanner | ✗ | MEDIUM | 3 PD |
| Field Sign-Off UI | ✗ | HIGH | 4 PD |

**Recommendation:** Prioritize offline sync for Phase 2; PWA and QR scanning for Phase 3

#### Gap Category 6: Security & Compliance

**Current Security Features (logic-nexus-ai):**
- JWT authentication ✓
- Row-Level Security (RLS) ✓
- Audit logging ✓
- Rate limiting ✓
- Emergency user blocking ✓

**AMRO-Specific Security Gaps:**

| Requirement | Status | Impact | Standard |
|---|---|---|---|
| Role-Based Access Control (RBAC) | ✓ Partial | MEDIUM | EASA Part-66 Appendix 1 |
| Technician Skill/Certification Validation | ✗ | HIGH | FAA AC 65-16A |
| Digital Signature Legal Compliance | ✗ | HIGH | FDA 21 CFR Part 11 |
| Encrypted Work Package Transport | ✗ | MEDIUM | HIPAA-aligned practices |
| Immutable Audit Trail | ✓ (audit_logs) | MEDIUM | EASA CS-23 Amendment 1 |
| Data Retention Policy (7 years) | ✗ | HIGH | ICAO Annex 8 |
| Encryption at Rest | ✓ (Supabase) | LOW | ✓ Built-in |

**Implementation Effort:** ~12 person-days for Phase 1 (digital signature + certification validation)

#### Gap Category 7: Integration Capabilities

**Current Integrations (logic-nexus-ai):**
- Third-party parts supplier APIs (quotation)
- Email delivery pipeline (Sendgrid)
- Document storage (AWS S3)

**AMRO Integration Gaps:**

| System | Status | Use Case | Effort |
|---|---|---|---|
| ERP (SAP/NetSuite) | ✗ | Parts inventory sync, purchase orders | 8 PD |
| Supply Chain (API21/OpenText) | ✗ | Parts availability, lead times | 5 PD |
| Regulatory Database (FAA/EASA) | ✗ | Airworthiness directives sync | 3 PD |
| IoT Sensors (Aircraft Telemetry) | ✗ | Auto-populate flight hours/landings | 6 PD |
| Calendar Systems (Outlook/Google) | ✗ | Schedule sync for work packages | 2 PD |
| Email/Document Management | ✓ (Sendgrid) | Work package notifications | 0 PD |

**Recommendation:** Phase 1 = No external integrations; Phase 2+ prioritize ERP and regulatory DB

### 3.3 Missing Workflow Capabilities

**Current Workflows (Existing System):**
1. Quotation creation → approval → execution
2. CRM lead management → qualification → closure

**Missing AMRO Workflows (6 critical):**

#### Workflow 1: Master MPD Import & Versioning

```
Workflow: Upload Master MPD
Input: CSV/Excel with 3000+ tasks
Output: versioned task library + audit trail

Steps:
1. [NOT IMPLEMENTED] Validate CSV format against ATA iSpec 2200
2. [NOT IMPLEMENTED] Check for duplicate task codes
3. [NOT IMPLEMENTED] Parse applicability rules from structured columns
4. [NOT IMPLEMENTED] Create task versions (version_number auto-increment)
5. [NOT IMPLEMENTED] Insert into amro.maintenance_tasks (franchise_id = NULL)
6. [NOT IMPLEMENTED] Log import job to audit_logs
7. [PARTIAL] Notify admins of completion

Status: 50% (notification only)
Effort: 5 PD
Priority: P0
```

#### Workflow 2: Aircraft Onboarding + Auto-Populate

```
Workflow: Add Aircraft to Fleet
Input: Aircraft model, serial number, engine type
Output: Automated maintenance schedule populated

Steps:
1. [PARTIAL] Create aircraft record
2. [NOT IMPLEMENTED] Fetch applicable tasks from master MPD
3. [NOT IMPLEMENTED] For each task: call is_task_applicable()
4. [NOT IMPLEMENTED] If TRUE: create aircraft_maintenance_task with activation date
5. [NOT IMPLEMENTED] Set initial next_due based on task intervals
6. [NOT IMPLEMENTED] Generate work package schedule
7. [PARTIAL] Send confirmation email

Status: 30% (aircraft creation only)
Effort: 6 PD
Priority: P0
```

#### Workflow 3: Work Package Creation + Planning

```
Workflow: Create Maintenance Check (e.g., A-Check)
Input: Aircraft + check type + date range
Output: Work package with task list + resource planning

Steps:
1. [NOT IMPLEMENTED] Validate aircraft maintenance status
2. [NOT IMPLEMENTED] Fetch tasks for check type from maintenance_checks table
3. [NOT IMPLEMENTED] Auto-populate work_order_tasks
4. [NOT IMPLEMENTED] Estimate man-hours + required skills
5. [NOT IMPLEMENTED] Check technician skill certification
6. [NOT IMPLEMENTED] Assign tasks to available technicians
7. [NOT IMPLEMENTED] Reserve parts (integrate with inventory)
8. [NOT IMPLEMENTED] Schedule work package timeline
9. [PARTIAL] Generate work order printout

Status: 10% (work order printing only)
Effort: 10 PD
Priority: P0
```

#### Workflow 4: Field Execution + Sign-Off

```
Workflow: Execute Work Package on Hangar Floor
Input: Assigned work package + technician credentials
Output: Completed package with digital signature

Steps:
1. [NOT IMPLEMENTED] Load work package on field device
2. [NOT IMPLEMENTED] Display pre-flight checklist
3. [NOT IMPLEMENTED] Record actual man-hours per task
4. [NOT IMPLEMENTED] Capture technician skill verification
5. [NOT IMPLEMENTED] Digital signature (PIN, biometric, certificate)
6. [NOT IMPLEMENTED] Update aircraft flight hours/landings
7. [NOT IMPLEMENTED] Trigger next due recalculation
8. [NOT IMPLEMENTED] Generate compliance certificate
9. [PARTIAL] Email notification of completion

Status: 10% (email notification only)
Effort: 12 PD
Priority: P0
```

#### Workflow 5: Compliance Reporting

```
Workflow: Generate FAA/EASA Compliance Report
Input: Date range + aircraft + regulatory body
Output: Audit trail export + compliance certificate

Steps:
1. [NOT IMPLEMENTED] Filter audit_logs by date/aircraft
2. [NOT IMPLEMENTED] Format per FAA Form 337 (Major Alterations)
3. [NOT IMPLEMENTED] Format per EASA Form 1 (Airworthiness Certificate)
4. [NOT IMPLEMENTED] Include technician certifications
5. [NOT IMPLEMENTED] Digital signature from maintenance director
6. [NOT IMPLEMENTED] Generate PDF with QR code
7. [NOT IMPLEMENTED] Archive to immutable storage
8. [PARTIAL] Email to authorized users

Status: 10% (email only)
Effort: 8 PD
Priority: P1
```

#### Workflow 6: Predictive Maintenance Alerting

```
Workflow: Maintenance Scheduling Assistant
Input: Fleet aircraft + current flight hours
Output: Proactive work package recommendations

Steps:
1. [NOT IMPLEMENTED] Batch calculate next_due for all fleet aircraft
2. [NOT IMPLEMENTED] Identify tasks due within 14 days
3. [NOT IMPLEMENTED] Group into optimal check packages (by skill type, location)
4. [NOT IMPLEMENTED] Estimate impact on fleet availability
5. [NOT IMPLEMENTED] Recommend scheduling to minimize downtime
6. [NOT IMPLEMENTED] Send proactive alerts to maintenance planner
7. [NOT IMPLEMENTED] Generate procurement recommendations (parts/labor)

Status: 0%
Effort: 8 PD
Priority: P2
```

**Total Workflow Effort:** ~49 person-days (Phase 1 = 42 PD, Phase 2+ = 7 PD)

---

## SECTION 4: FUNCTIONAL & WORKFLOW GAP ANALYSIS

### 4.1 Work Order & Task Management

**Current Capability:**
- Work order concept exists in quotation module
- No task-level tracking
- No skill-based assignment

**Required for AMRO:**

```
Requirement: Create detailed work order with task breakdown
Current: Quotation → line items (pricing focus)
Needed: Work package → maintenance tasks → technician assignments → execution tracking

Example:
Work Package WP-2026-00142 (A-Check for N123AB)
├── Task 21-10-00-050 (Inspect compressor) - 2.5 hours - AIRFRAME - John Smith
├── Task 21-20-00-060 (Replace filters) - 1.0 hour - AIRFRAME - John Smith
├── Task 22-00-00-070 (Hydraulic system test) - 3.0 hours - HYDRAULIC - Jane Doe
├── Task 25-00-00-080 (Electrical inspection) - 2.0 hours - AVIONICS - John Smith
└── Sign-off & Compliance Certificate
```

**Gap Analysis:**

| Feature | Current | Required | Effort |
|---|---|---|---|
| Task breakdown by skill type | ✗ | ✓ | 2 PD |
| Technician assignment | ✗ | ✓ | 2 PD |
| Skill certification validation | ✗ | ✓ | 3 PD |
| Time tracking per task | ✗ | ✓ | 2 PD |
| Task-level sign-off | ✗ | ✓ | 3 PD |
| Work package closure validation | ✗ | ✓ | 1 PD |

**Phase 1 Implementation:** 13 PD

### 4.2 Scheduling & Planning

**Current Capability:**
- No dedicated scheduling module
- Manual date selection in forms

**Required for AMRO:**

```
Workflow:
1. Planner views fleet aircraft + next due dates
2. System recommends check packages (group by availability window, skill availability)
3. Planner drags work packages onto calendar
4. System checks for technician/tool/parts availability
5. Generate work schedule with Gantt chart
```

**Scheduling Features Needed:**

| Feature | Priority | Effort | Notes |
|---|---|---|---|
| Aircraft availability calendar | P1 | 3 PD | Show grounded, maintenance, active status |
| Task grouping optimizer | P1 | 4 PD | Group tasks by technician + check type |
| Technician capacity planning | P1 | 3 PD | Prevent over-allocation |
| Parts lead-time integration | P2 | 3 PD | Check inventory; auto-order if needed |
| Conflict detection | P1 | 2 PD | Alert on scheduling conflicts |
| Gantt chart visualization | P2 | 4 PD | Recharts for timeline display |

**Phase 1 Implementation:** 12 PD (P1 items)

### 4.3 Resource Management (Technicians & Certifications)

**Current Capability:**
- Users table exists (generic)
- No skill/certification tracking
- No capacity planning

**Required for AMRO:**

```sql
-- New tables needed
CREATE TABLE technician_skills (
  technician_id UUID,
  skill_type VARCHAR,  -- AIRFRAME, ENGINE, AVIONICS, HYDRAULIC
  certification_level VARCHAR,  -- BASIC, ADVANCED, EXPERT
  valid_from DATE,
  expires_date DATE,
  issuing_authority VARCHAR  -- e.g., "FAA", "EASA"
);

CREATE TABLE technician_availability (
  technician_id UUID,
  available_hours INT,  -- per week
  current_workload INT,
  available_after_date DATE  -- next available slot
);
```

**Feature Matrix:**

| Feature | Priority | Effort |
|---|---|---|
| Technician skill registry | P1 | 2 PD |
| Certification expiration tracking | P1 | 2 PD |
| Task → skill type matching | P1 | 2 PD |
| Capacity utilization dashboard | P2 | 3 PD |
| Technician cross-training workflow | P3 | 3 PD |
| Certification renewal alerts | P2 | 2 PD |

**Phase 1 Implementation:** 6 PD

### 4.4 Parts & Materials Management

**Current Capability:**
- Quotation module has part supplier integration
- No inventory tracking

**Required for AMRO:**

```
Integration Point: Work package → required parts → inventory check → purchase order

Steps:
1. Get task definition → fetch BOM (bill of materials)
2. Check inventory against BOM
3. If shortage: auto-generate purchase order to vendor
4. Track arrival & allocation to work package
5. On task completion: update inventory consumed
```

**Feature Matrix:**

| Feature | Priority | Effort | Integration |
|---|---|---|---|
| BOM per task definition | P1 | 2 PD | New amro.task_bom table |
| Inventory check integration | P1 | 3 PD | Query existing inventory API |
| Purchase order generation | P2 | 4 PD | Call quotation service |
| Materials received tracking | P2 | 2 PD | New status field |
| Material consumption recording | P1 | 2 PD | Update on task completion |

**Phase 1 Implementation:** 7 PD (P1 items)

### 4.5 Compliance & Regulatory Reporting

**Current Capability:**
- Audit logging exists (generic)
- No FAA/EASA format exports

**Required for AMRO:**

```
Output Formats:
1. FAA Form 337 (Major Repairs & Alterations)
2. EASA Form 1 (Airworthiness Certificate details)
3. ICAO Annex 8 compliance checklist
4. Maintenance history in iSpec 2200 format

Required Data:
- 7-year maintenance history (immutable)
- Technician certifications at time of work
- Parts used (with part numbers, serial numbers)
- Service bulletins embodied
- Airworthiness directive compliance
- Digital signatures (director + technicians)
```

**Feature Matrix:**

| Feature | Priority | Effort |
|---|---|---|
| 7-year audit retention policy | P1 | 1 PD |
| FAA/EASA export templates | P1 | 4 PD |
| Regulatory compliance dashboard | P1 | 3 PD |
| Digital signature integration | P1 | 4 PD |
| Immutable archive (WORM) | P2 | 3 PD |
| Compliance certification generation | P1 | 2 PD |

**Phase 1 Implementation:** 14 PD

### 4.6 Mobile & Field Operations

**Current Capability:**
- Responsive UI (TailwindCSS)
- No offline support
- No QR/barcode scanning

**Required for AMRO:**

```
Field technician uses tablet in hangar:
1. Load work package (offline-capable)
2. Scan aircraft QR code (confirms aircraft ID)
3. View task list with step-by-step instructions
4. Check part requirements (alert if unavailable)
5. Record work performed (time, observations)
6. Provide digital signature/PIN
7. Sync when WiFi available
```

**Feature Matrix:**

| Feature | Priority | Effort | Dependencies |
|---|---|---|---|
| Offline-capable forms | P1 | 5 PD | Service worker + local DB |
| QR/barcode scanning | P1 | 3 PD | React-QR library + camera access |
| Work timer (elapsed hours) | P1 | 2 PD | LocalStorage + sync |
| Digital signature (PIN/touchscreen) | P1 | 3 PD | Canvas signing library |
| Offline sync on reconnect | P1 | 5 PD | Service worker + conflict resolution |
| PWA support (installable) | P2 | 3 PD | Manifest + service worker |

**Phase 1 Implementation:** 15 PD (offline forms, QR, signing)

---

## SECTION 5: IMPLEMENTATION ARCHITECTURE & PATTERNS

### 5.1 Phased Rollout Strategy (18 months)

**Phase 0 (Months 1-2): Groundwork**
- Database schema migration
- PostgreSQL functions
- API endpoints skeleton
- Component library setup

**Phase 1 (Months 3-6): Core AMRO**
- ✓ ATA hierarchy + master MPD import
- ✓ Aircraft onboarding + auto-populate
- ✓ Work package creation + basic execution
- ✓ Maintenance scheduling
- ✓ Field technician UI (mobile-ready)
- ✓ Basic compliance reporting

**Phase 2 (Months 7-12): Enterprise Features**
- ✓ Advanced scheduling (Gantt, conflict detection)
- ✓ Technician skill management
- ✓ Parts/inventory integration
- ✓ Offline capability + sync
- ✓ Digital signature enhancements
- ✓ Regulatory database integration

**Phase 3 (Months 13-18): Optimization + Integrations**
- ✓ Predictive analytics
- ✓ ERP integration (SAP/NetSuite)
- ✓ Supplier portal
- ✓ Customer portal
- ✓ Mobile app native versions
- ✓ Performance optimization

### 5.2 Component Reuse Roadmap

**Immediate Reuse (Phase 0-1):**

```typescript
// Authentication & Multi-Tenancy (100% reuse)
import { useCRM } from '@/hooks/useCRM';
import { DataAccessContext } from '@/lib/db/access';

// Form Components (90% reuse)
import { Button, Dialog, Form, Select, TextField } from '@/components/ui';
import { useForm } from 'react-hook-form';

// Data Fetching (100% reuse)
import { useQuery, useMutation } from '@tanstack/react-query';

// Styling (100% reuse)
// TailwindCSS utility classes + CSS variables

// Example: Create AMRO work package form
export function CreateWorkOrderForm() {
  const { tenantId, franchiseId } = useCRM();
  const form = useForm<CreateWorkOrderPayload>();
  const { mutate } = useMutation({
    mutationFn: (payload) =>
      fetch(`/api/v2/amro/work-orders`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'x-tenant-id': tenantId }
      }).then(r => r.json()),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => mutate(data))}>
        <FormField
          control={form.control}
          name="aircraftId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aircraft</FormLabel>
              <Select {...field}>
                {/* Aircraft options filtered to franchiseId */}
              </Select>
            </FormItem>
          )}
        />
        <Button type="submit">Create Work Package</Button>
      </form>
    </Form>
  );
}
```

**Phase-Specific New Components:**

```typescript
// Phase 0-1: Basic AMRO components
src/components/amro/
├── AircraftStatusWidget          # Reuse Card + Badge
├── MaintenanceTaskList           # Reuse Table + Filter
├── WorkOrderForm               # Reuse Form + Select
├── WorkOrderExecutor           # Reuse Dialog + Progress
└── ComplianceStatusBanner        # Reuse Alert

// Phase 2: Advanced components
├── SchedulingCalendar            # New: Calendar component (Recharts)
├── GanttChart                    # New: Timeline visualization
├── TechnicianCapacityPlanner     # New: Capacity heatmap
└── OfflineWorkOrderForm        # Extend with service worker
```

### 5.3 Database Migration Strategy

**Current Approach** (use existing Supabase migration pattern):

```bash
# Step 1: Create migration file
touch supabase/migrations/20260401_amro_schema_phase1.sql

# Step 2: Define schema + RLS
-- See Appendix A for complete schema

# Step 3: Test locally
npm run supabase:db:reset
npm run supabase:db:push

# Step 4: Generate types
npm run supabase:types:gen

# Step 5: Commit & deploy
git add supabase/migrations/
git commit -m "feat(amro): add phase 1 schema with RLS policies"
```

**Zero-Downtime Deployment:**

1. Deploy new code (API endpoints) without new table references
2. Run migration in background (PostgreSQL non-blocking)
3. Backfill data if needed
4. Activate new endpoints (feature flag)
5. Monitor for issues; rollback capability maintained

### 5.4 Testing Strategy

**Test Coverage Goals:**

```typescript
// Unit tests (fast, 100 ms per file)
src/services/amro/__tests__/
├── AircraftMaintenanceService.test.ts
├── MaintenanceTaskService.test.ts
└── WorkOrderService.test.ts

// Integration tests (medium, 5 sec per file)
src/tests/integration/amro/
├── aircraft-mpd-auto-populate.test.ts
├── applicability-check.test.ts
└── work-order-execution.test.ts

// E2E tests (slow, 30 sec per flow)
tests/e2e/amro/
├── amro-end-to-end.spec.ts  (Playwright)
├── aircraft-onboarding.spec.ts
├── work-order-flow.spec.ts
└── compliance-reporting.spec.ts

// Performance tests
src/tests/performance/
├── applicability-engine.perf.ts  (1000+ tasks, <500ms)
├── next-due-calculation.perf.ts  (100 aircraft, <1s)
└── mpd-auto-populate.perf.ts     (500-task MPD, <5s)
```

**Example Test** (vitest + React Testing Library):

```typescript
// src/services/amro/__tests__/AircraftMaintenanceService.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { AircraftMaintenanceService } from '../AircraftMaintenanceService';
import { mockSupabaseClient } from '@/tests/__mocks__/supabase';

describe('AircraftMaintenanceService', () => {
  let service: AircraftMaintenanceService;

  beforeEach(() => {
    service = new AircraftMaintenanceService(
      'tenant-uuid',
      'franchise-uuid'
    );
  });

  it('should calculate next due with WCF rule', async () => {
    const status = await service.calculateNextDue('aircraft-uuid');

    expect(status).toHaveProperty('which_comes_first'); // 'HOURS' or 'CALENDAR'
    expect(status.due_status).toMatch(/RED|YELLOW|GREEN/);
    expect(status.remaining_hours).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });

  it('should prevent access to different tenant aircraft', async () => {
    // Simulate scope violation
    const otherTenantAircraft = 'other-aircraft-uuid';

    await expect(
      service.calculateNextDue(otherTenantAircraft)
    ).rejects.toThrow('Aircraft not found in accessible scope');
  });
});
```

---

## SECTION 6: COMPONENT REUSE STRATEGY

### 6.1 Component Inventory & Mapping

**Existing shadcn/ui Components (200+):**

```typescript
// Common patterns already in logic-nexus-ai

// Layout & Structure
<Card>                   # Container with shadow/border
<Dialog>                 # Modal for forms
<Tabs>                   # Tabbed interface
<Accordion>              # Collapsible sections

// Form Controls
<Button>                 # Clickable action
<Input>                  # Text field
<Select>                 # Dropdown selection
<Checkbox>               # Toggle option
<RadioGroup>             # Single-choice group
<Textarea>               # Multi-line text
<DatePicker>             # Date selection

// Display
<Table>                  # Data grid
<Badge>                  # Status tag
<Alert>                  # Warning/error box
<Progress>               # Progress bar
<Skeleton>               # Loading placeholder

// Navigation
<Breadcrumb>             # Path indicator
<NavigationMenu>         # Top nav
<Sidebar>                # Side navigation
```

**AMRO Mapping to Existing Components:**

| AMRO Feature | Existing Component | Reuse % | Enhancement Needed |
|---|---|---|---|
| Aircraft list | Table + Badge | 95% | Add status color coding |
| Maintenance task list | Table + Filter | 90% | Add applicability icon |
| Work package form | Form + Select + DatePicker | 100% | None |
| Work package execution | Dialog + Progress + Textarea | 95% | Add timer widget |
| Digital signature | Canvas-based (custom) | 0% | Build new |
| Compliance dashboard | Card + Chart (Recharts) | 85% | Add compliance metrics |
| Mobile sign-off | Touch-optimized Dialog | 80% | Increase button size |

**Estimated New Component Development:**
- ~5 new specialized components (digital signature, timer, offline indicator)
- ~20 AMRO-specific wrapper components (leverage 95% existing code)
- Total effort: 8 PD for custom components

### 6.2 API Endpoint Reuse Patterns

**Existing Endpoint Pattern (Proven):**

```typescript
// src/pages/api/v1/franchises.ts - Reference pattern
1. Middleware chain (auth, scope, permissions)
2. Service class (business logic, scope validation)
3. ScopedDataAccess (database + RLS enforcement)
4. Error handling + response formatting

// Reuse for AMRO:
src/pages/api/v2/amro/aircraft/[id]/maintenance-status.ts
1. ✓ Use same middleware chain
2. ✓ Use AircraftMaintenanceService (new service, same pattern)
3. ✓ Use ScopedDataAccess.withAmroScope (extended method, same class)
4. ✓ Use same error formatting + response pattern
```

**Lines of Code Reusable:**
- Middleware orchestration: 100% reuse
- Error handling: 100% reuse
- Response formatting: 100% reuse
- Scope injection: 95% reuse (slight variation for master MPD)
- Rate limiting: 100% reuse

**Estimated Code Savings:** ~40% fewer lines of code due to pattern reuse

---

## SECTION 7: MIGRATION & ROLLOUT PLAN

### 7.1 Data Migration Strategy

**For Existing Tenants (Add AMRO Capability):**

```sql
-- Phase 0: Schema additions (non-breaking)
ALTER TABLE aircraft ADD COLUMN current_flight_hours DECIMAL DEFAULT 0;
ALTER TABLE aircraft ADD COLUMN maintenance_program VARCHAR DEFAULT 'UNKNOWN';

-- Phase 1: Create AMRO tables (parallel to existing data)
CREATE TABLE amro.ata_codes (...);
CREATE TABLE amro.maintenance_tasks (...);
-- RLS policies prevent accidental data leakage

-- Phase 2: Backfill master MPD (per tenant)
-- Admin uploads master MPD for their tenant scope

-- Phase 3: Auto-populate aircraft (per aircraft)
-- Trigger: aircraft record → calculate applicable tasks → create aircraft_maintenance_tasks

-- Migration is data-additive (no deletions/overwrites)
-- Rollback: DROP new tables; ALTER TABLE aircraft DROP COLUMN (if needed)
```

**For New Customers (Greenfield AMRO):**

```
1. Create tenant record
2. Assign franchise(s)
3. Run full AMRO schema migration
4. Upload master MPD
5. Add aircraft
6. System auto-populates maintenance schedule
7. Ready for work package creation
```

### 7.2 Blue-Green Deployment

**Current Environment:** logic-nexus-ai (production)
**Strategy:** Minimize downtime via parallel deployment

```
Timeline:
T+0:00  - Code deployment: new API endpoints + services
         (no database changes, so no migration needed)
T+0:05  - Run database migration in background
         (PostgreSQL non-blocking DDL)
T+0:15  - Run RLS policy creation
T+0:20  - Run backfill of existing aircraft (if needed)
         (INSERT aircraft_maintenance_tasks from master MPD)
T+0:30  - Health check: test new endpoints
T+0:35  - Enable AMRO feature for beta tenants (feature flag)
T+1:00  - Monitor error rates / performance
T+2:00  - Rollout to all tenants (if clean)

Rollback (if issues):
T-exit: Revert code deployment
T-exit+2: Drop new tables (if critical data issue)
         ALTER TABLE aircraft DROP COLUMN (if needed)
         No data loss (all original records preserved)
```

### 7.3 Feature Flags & Gradual Rollout

**Environment Variables for Phase Control:**

```bash
# .env.production
VITE_AMRO_ENABLED=true                    # Enable AMRO module globally
VITE_AMRO_PHASE=1                         # 1 (core), 2 (advanced), 3 (integrations)
VITE_AMRO_BETA_TENANTS=["tenant-uuid-1", "tenant-uuid-2"]  # Early access list
VITE_AMRO_FEATURE_MPD_IMPORT=true         # Enable master MPD import UI
VITE_AMRO_FEATURE_OFFLINE=false           # Disable offline until Phase 2
VITE_AMRO_FEATURE_SCHEDULING=false        # Disable advanced scheduling until Phase 2
```

**Runtime Feature Gate:**

```typescript
// src/config/featureFlags.ts
export function isAmroPhase(minimumPhase: number): boolean {
  const phase = parseInt(import.meta.env.VITE_AMRO_PHASE || '0');
  return phase >= minimumPhase;
}

// Usage
if (isAmroPhase(1)) {
  // Show basic AMRO UI
}

if (isAmroPhase(2)) {
  // Show advanced scheduling features
}

// For beta testing
const isBetaTenant = BETA_TENANTS.includes(currentTenantId);
if (isBetaTenant && isAmroPhase(1)) {
  // Show AMRO to beta tenants in Phase 1
}
```

---

## SECTION 8: COMPLIANCE & AUDIT READINESS

### 8.1 Standards Alignment

**ATA iSpec 2200 Compliance Checklist:**

| Section | Requirement | Status | Implementation |
|---|---|---|---|
| 5.1.1 | Hierarchical task structure | ✓ Design | ata_codes (recursive) + mtoss_code (7-segment) |
| 5.1.2 | Task applicability rules | ✓ Design | applicability_rules (JSONB) + is_task_applicable() |
| 5.2.1 | Interval tracking (hours/months) | ✓ Design | task_intervals (polymorphic) + calculate_next_due() |
| 5.3.1 | Service bulletin dependencies | ✓ Design | service_bulletins table + SB dependency in applicability |
| 5.4.1 | Modification embodiment tracking | ✓ Design | modifications table + dependency tracking |
| 6.1.1 | Maintenance task versioning | ✓ Design | version_number + superseded_by_id |
| 6.2.1 | Man-hour estimation | ✓ Design | estd_man_hours + skill_type columns |
| 6.3.1 | Technical documentation linking | ✓ Design | task.description + source_ref (SB/AD/MPD) |

**MSG-3 Maintenance Logic Compliance:**

| Concept | Status | Implementation |
|---|---|---|
| Failure-driven maintenance | ✓ Design | "Inspection" tasks trigger component removal |
| Condition-monitored maintenance | ✓ Design | applicability_rules allow sensor-based triggers |
| Preventive time-related maintenance | ✓ Design | FLIGHT_HOURS + CALENDAR_MONTHS intervals |
| Hard-time replacement | ✓ Design | task_intervals with mandatory replacement at interval |
| On-condition maintenance | ✓ Design | Task only applies if SB embodied or mod installed |

**FAA/EASA Regulatory Alignment:**

| Standard | Document | Alignment |
|---|---|---|
| FAA | Part 43 (Maintenance Records) | ✓ audit_logs + digital signatures |
| FAA | Form 337 (Major Repairs) | ✓ Export template in compliance module |
| EASA | Part-66 (Certifications) | ✓ technician_skills table + expiration tracking |
| EASA | Part-M (Continuing Airworthiness) | ✓ 7-year audit trail + compliance reporting |
| ICAO | Annex 8 (Airworthiness) | ✓ Maintenance history export |

### 8.2 Security & Data Protection

**Data Classification:**

| Data Type | Classification | Protection |
|---|---|---|
| Aircraft location/tail number | **SENSITIVE** | Multi-tenancy RLS + encryption at rest |
| Technician certification | **SENSITIVE** | RLS + access audit trail |
| Maintenance history | **CONFIDENTIAL** | 7-year retention + immutable audit log |
| Service bulletins (public) | **INTERNAL** | RLS (tenant-scoped) |
| SB embodiment status | **CONFIDENTIAL** | RLS + audit trail for changes |

**Encryption Requirements:**

| Layer | Requirement | Status | Implementation |
|---|---|---|---|
| **In Transit (TLS)** | HTTPS only; TLS 1.2+ | ✓ Enforced | enforceHttps middleware |
| **At Rest** | Supabase default (AES-256) | ✓ Built-in | Database encryption |
| **Application Layer** | PII field encryption | ✗ Phase 2 | PostgreSQL pgcrypto (optional) |
| **Field-Level** | Sensitive columns | ✗ Phase 2 | Selective encryption for SB details |

**Access Control:**

```typescript
// RBAC for AMRO (new permissions)
const AMRO_PERMISSIONS = {
  'amro.aircraft.view': true,          // View aircraft + next due
  'amro.aircraft.create': false,       // Add aircraft (admin only)
  'amro.maintenance_tasks.view': true, // View master/fleet MPD
  'amro.maintenance_tasks.import': false,  // Import master MPD (admin only)
  'amro.work_orders.create': true,   // Create work packages
  'amro.work_orders.execute': true,  // Execute tasks (technician)
  'amro.work_orders.sign_off': false,  // Complete with signature (lead tech only)
  'amro.compliance.view': true,        // View compliance dashboard
  'amro.compliance.export': false,     // Export reports (director only)
};
```

### 8.3 Audit & Accountability

**Audit Trail for AMRO:**

```sql
-- Existing audit_logs table, extended for AMRO
INSERT INTO audit_logs (
  user_id, action, resource_type, resource_id,
  tenant_id, franchise_id,
  old_values, new_values,
  created_at, ip_address, correlation_id
) VALUES (...)

-- Example: Work package sign-off audit
{
  "user_id": "tech-uuid",
  "action": "work_order_signed_off",
  "resource_type": "work_order",
  "resource_id": "wp-uuid",
  "tenant_id": "tenant-uuid",
  "franchise_id": "franchise-uuid",
  "old_values": { "status": "in_progress" },
  "new_values": { "status": "closed", "signed_off_at": "2026-03-26T14:30:00Z" },
  "details": {
    "signature_method": "digital",
    "certificate_thumbprint": "abc123...",
    "technician_certification": "valid",
    "work_hours": 12.5
  }
}
```

**Compliance Reporting:**

```typescript
// Generate audit reports
export async function generateComplianceReport(params: {
  tenantId: string;
  aircraftId: string;
  dateRange: [Date, Date];
  regulatoryBody: 'FAA' | 'EASA';
}): Promise<ComplianceReport> {
  // 1. Query audit_logs filtered by date range + aircraft
  // 2. Fetch technician certifications at time of work
  // 3. Verify all tasks have valid sign-offs
  // 4. Check SB/AD compliance status
  // 5. Format per regulatory standard
  // 6. Generate PDF with digital signature from maintenance director
  // 7. Archive to immutable storage (WORM - write-once, read-many)
  // 8. Return report object + downloadable link
}
```

---

## SECTION 9: APPENDICES

### APPENDIX A: Complete AMRO Database Schema

[Full SQL for all 20 tables with indexes, constraints, and RLS policies - 15 pages]

*Reference:* See `/docs/AMRO_Technical_Architecture_Design.md` Section 2 for complete schema

### APPENDIX B: API Endpoint Specifications

**All AMRO Endpoints (14 total)**

```
GET  /api/v2/amro/ata-codes
  - Query: parent_id (optional), tenant_id (required)
  - Response: List[AtaCode] with hierarchy
  - Cache: 5 min

POST /api/v2/amro/maintenance-tasks/import
  - Body: CSV/Excel file + master MPD designation
  - Response: { jobId, estimatedRecords, progress }
  - Rate limit: 1 per hour per tenant

GET  /api/v2/amro/aircraft/:id/maintenance-status
  - Query: tenantId (required)
  - Response: { next_due_hours, next_due_date, remaining_X, due_status, which_comes_first }
  - Cache: 1 min (stale threshold)

GET  /api/v2/amro/maintenance-tasks/:id/applicability-check?aircraftId=...
  - Query: aircraftId, tenantId
  - Response: { applicable: boolean, reasons: [strings] }
  - Cache: 10 min

POST /api/v2/amro/work-orders
  - Body: { aircraftId, checkType, plannedStartDate, ... }
  - Response: { workOrderId, taskCount, estimatedManHours, ... }
  - Permission: amro.work_orders.create

... (remaining endpoints specified in detail)
```

### APPENDIX C: Component Library Storybook

**New AMRO Components (with Storybook stories)**

```
Components:
├── AircraftStatusWidget.stories.tsx
├── MaintenanceTaskList.stories.tsx
├── WorkOrderForm.stories.tsx
├── WorkOrderExecutor.stories.tsx
├── ComplianceDashboard.stories.tsx
└── DigitalSignaturePad.stories.tsx

Run: npm run storybook (port 6006)
```

### APPENDIX D: Testing Guide

**Test Execution Strategy**

```bash
# Unit tests (fast feedback)
npm run test:amro:unit

# Integration tests (database, services)
npm run test:amro:integration

# E2E tests (full workflows)
npm run test:e2e tests/e2e/amro/

# Coverage report
npm run test:amro:coverage

# Performance benchmarks
npm run test:performance src/tests/performance/amro/
```

### APPENDIX E: Compliance Checklist

**Pre-Launch Verification (Phase 1)**

- [ ] All AMRO tables have `tenant_id` + RLS policies
- [ ] Applicability engine passes 100+ test cases (serial ranges, engine types, SBs)
- [ ] Next-due calculation matches ATA MSG-3 logic
- [ ] Work package execution with sign-off tested in Playwright
- [ ] Audit trail captures all mutations
- [ ] FAA/EASA export generates valid PDF
- [ ] Multi-tenancy isolation tested (cross-tenant queries blocked)
- [ ] Rate limiting prevents abuse
- [ ] Error handling doesn't leak sensitive data
- [ ] Performance benchmarks met (next-due <500ms, MPD import <5s)

### APPENDIX F: Reference Documentation

**Useful Links & Standards:**

1. ATA iSpec 2200 - Available through ATA
2. MSG-3 Maintenance Logic - IATA document
3. FAA AC 65-16A - Technician certification guide
4. EASA Part-M - Continuing Airworthiness
5. Supabase RLS Documentation: https://supabase.com/docs/guides/auth/row-level-security
6. PostgreSQL JSONB Guide: https://www.postgresql.org/docs/current/datatype-json.html
7. React Query Documentation: https://tanstack.com/query/latest

---

## CONCLUSION

This enhanced architecture guide provides a complete integration roadmap for implementing enterprise-grade AMRO functionality within the existing logic-nexus-ai platform. By adhering to established patterns for multi-tenancy, API design, and component architecture, we can achieve:

✅ **40% faster development** through component reuse
✅ **Zero breaking changes** to existing quotation/CRM modules
✅ **Enterprise compliance** with FAA/EASA standards
✅ **Scalable multi-tenancy** for unlimited customer growth
✅ **Production-ready architecture** by month 6

**Next Steps:**
1. Architecture review & approval (Week 1)
2. Database schema finalization & migration setup (Week 2-3)
3. Phase 1 implementation kickoff (Week 4)
4. Beta testing with pilot tenants (Month 4-5)
5. Production rollout (Month 6)

---

**Document Prepared By:** Technical Architecture Team
**Classification:** Internal Use | Technical Review
**Last Updated:** March 26, 2026
**Version:** 2.0 (Enhanced with Integration Mappings)