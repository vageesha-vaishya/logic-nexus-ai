# AMRO RBAC Menu-Permission Blueprint

## 1) Menu Items ↔ Permissions Relationship

### Current State (Observed)
- Menu visibility is driven from `APP_MENU` with optional `roles` and `permissions` in [navigation.ts](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/config/navigation.ts).
- Route access is separately enforced in `ProtectedRoute` usage in [App.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/App.tsx).
- Role-permission catalog is defined in [permissions.ts](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/config/permissions.ts) and editable via [RolesPermissions.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/pages/dashboard/RolesPermissions.tsx).
- API access checks exist but are not consistently generated from one canonical map.

### Gap
- Menu → permission mapping, route → permission mapping, and API endpoint → permission mapping are maintained in different places.
- This creates drift risk (menu hidden but API still accessible, or menu visible but route blocked).

### Target Mechanism (Canonical Mapping)
- Introduce one canonical table/config source:
  - `rbac_resources` (menu/route/api resource registry)
  - `rbac_resource_actions` (resource CRUD/action permissions)
  - `rbac_menu_binding` (menu item → required permission expression)
- Frontend navigation and backend middleware read the same logical mapping (materialized JSON or API endpoint).

### AMRO Menu Mapping (Baseline)
| Menu Item | Path | Current Permission | Proposed Resource | Proposed Read Permission |
|---|---|---|---|---|
| Overview | `/dashboard/amro/overview` | `view_amro_dashboard` | `amro.overview` | `amro.overview.read` |
| Aircraft | `/dashboard/amro/aircraft` | `edit_aircraft_records` | `amro.aircraft` | `amro.aircraft.read` |
| Work Package Templates | `/dashboard/amro/settings/work-order-templates` | `edit_aircraft_records` | `amro.work_order_templates` | `amro.work_order_templates.read` |
| Work Packages | `/dashboard/amro/work-orders` | `create_maintenance_request` | `amro.work_orders` | `amro.work_orders.read` |
| Task Execution | `/dashboard/amro/task-execution` | `create_maintenance_request` | `amro.task_execution` | `amro.task_execution.read` |
| Scheduling | `/dashboard/amro/scheduling` | `edit_aircraft_records` | `amro.scheduling` | `amro.scheduling.read` |
| Parts | `/dashboard/amro/parts` | `edit_aircraft_records` | `amro.parts` | `amro.parts.read` |
| Compliance | `/dashboard/amro/compliance` | `approve_work_orders` | `amro.compliance` | `amro.compliance.read` |
| Certification | `/dashboard/amro/certification` | `approve_work_orders` | `amro.certification` | `amro.certification.read` |
| Audit | `/dashboard/amro/audit` | `delete_flight_logs` | `amro.audit` | `amro.audit.read` |
| Integration | `/dashboard/amro/integration` | `edit_aircraft_records` | `amro.integration` | `amro.integration.read` |
| Intelligence | `/dashboard/amro/intelligence` | `view_amro_dashboard` | `amro.intelligence` | `amro.intelligence.read` |
| Settings | `/dashboard/amro/settings` | `edit_aircraft_records` | `amro.settings` | `amro.settings.read` |
| Workspace Documentation | `/dashboard/amro/workspace-documentation` | `view_amro_dashboard` | `amro.docs` | `amro.docs.read` |

---

## 2) Franchise User Access Strategy (UI + API)

### Scope Rules
- Platform Admin: global or override-scoped.
- Tenant Admin: all franchises within tenant by default; optional override to one franchise.
- Franchise Admin/User: only assigned franchise (+ tenant-shared records where applicable).

### UI Enforcement
- Menu rendered dynamically from resolved permission set + scope.
- If user lacks `*.read` permission for a resource, hide menu.
- If user has read but no mutate permissions, show page in read-only mode.

### API Enforcement
- All AMRO endpoints require:
  1. Authentication
  2. Scope resolution (tenant/franchise)
  3. Permission check per action
- Policy order:
  1. Explicit deny
  2. Explicit allow
  3. Role inherited default
  4. Fallback deny
- Add middleware contract:
  - `authorize(resource, action, scopeContext)`
  - Example: `authorize('amro.work_order_templates', 'update', { tenantId, franchiseId })`

---

## 3) Current Model Evaluation

### Evaluation Criteria
- Permission granularity
- Role hierarchy clarity
- Assignment flexibility (role + scoped overrides)
- Single source of truth for enforcement
- UI/API consistency
- Auditability and explainability

### Assessment
- **Granularity:** Partial. AMRO uses coarse permissions (`edit_aircraft_records`, etc.), insufficient for CRUD per entity.
- **Hierarchy:** Present (platform/tenant/franchise/user) and mostly clear.
- **Assignment flexibility:** Moderate. Dynamic role tables exist (`auth_roles`, `auth_role_permissions`) but runtime still partly hardcoded.
- **Single source of truth:** Weak. Navigation, route guards, and API checks are distributed.
- **UI/API consistency:** Inconsistent risk due to duplicated mappings.
- **Auditability:** Some support exists; needs explicit permission decision logs.

### Verdict
- Current model is functional but not sufficient for enterprise-grade AMRO governance.

---

## 4) CRUD-Level Permission Design (Target)

### Naming Convention
- `<domain>.<resource>.<action>`
- AMRO examples:
  - `amro.aircraft.read|create|update|delete`
  - `amro.work_order_templates.read|create|update|delete`
  - `amro.work_order_templates.publish`
  - `amro.work_orders.assign`
  - `amro.compliance.approve`

### Minimum Resource Set
- `amro.overview`
- `amro.aircraft`
- `amro.work_order_templates`
- `amro.work_orders`
- `amro.task_execution`
- `amro.scheduling`
- `amro.parts`
- `amro.compliance`
- `amro.certification`
- `amro.audit`
- `amro.integration`
- `amro.intelligence`
- `amro.settings`
- `amro.docs`

---

## 5) Screen Wireframes (Text Mockups)

### A) Permission Assignment Interface (Hierarchical Menu + Permission Matrix)
```text
+----------------------------------------------------------------------------------+
| Role: Franchise Admin          Scope: Franchise-ABC          [Save] [Reset]    |
+----------------------------------------------------------------------------------+
| [ ] AMRO                                                                   All  |
|   [x] Overview                [x] Read  [ ] Create [ ] Update [ ] Delete        |
|   [x] Aircraft                [x] Read  [ ] Create [x] Update [ ] Delete        |
|   [x] Work Package Templates  [x] Read  [x] Create [x] Update [ ] Delete        |
|   [x] Work Packages           [x] Read  [x] Create [x] Update [ ] Delete        |
|   [ ] Compliance              [ ] Read  [ ] Approve                             |
|   [ ] Certification           [ ] Read  [ ] Approve                             |
|----------------------------------------------------------------------------------|
| [Validation] Segregation rules: "approve" cannot be combined with "own-create" |
+----------------------------------------------------------------------------------+
```

### B) Role Management Screen (Multi-select + Drag Priority)
```text
+----------------------------------------------------------------------------------+
| Roles                               | Role Details                              |
| [Search...]                         | Name: Tenant Admin (L1)                  |
| - Platform Admin                    | Scopes: Tenant, Franchise                |
| - Tenant Admin                      | Inherits: Franchise Admin, User          |
| - Franchise Admin                   | [Permissions Multi-select]               |
| - User                              | [Drag to reorder inheritance precedence] |
| [Create Role] [Clone Role]          | [Save Role] [Deactivate]                 |
+----------------------------------------------------------------------------------+
```

### C) User-Role Assignment (Search + Bulk Assign)
```text
+----------------------------------------------------------------------------------+
| User Assignment                                                                 |
| Filters: [Tenant] [Franchise] [Role] [Search user...]                          |
|----------------------------------------------------------------------------------|
| [ ] user1@...  [Current: Franchise Admin] [Assign Role ▼] [Scope ▼]            |
| [ ] user2@...  [Current: User]            [Assign Role ▼] [Scope ▼]            |
| [ ] user3@...  [Current: User]            [Assign Role ▼] [Scope ▼]            |
|----------------------------------------------------------------------------------|
| [Select All] [Bulk Assign Role] [Bulk Remove] [Export CSV]                     |
+----------------------------------------------------------------------------------+
```

---

## 6) Technical Implementation Requirements

### A) Database Schema (Proposed)
```sql
create table if not exists public.rbac_resources (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,                 -- amro.work_order_templates
  domain text not null,                     -- amro
  display_name text not null,
  parent_key text null references public.rbac_resources(key),
  is_menu_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rbac_resource_actions (
  id uuid primary key default gen_random_uuid(),
  resource_key text not null references public.rbac_resources(key) on delete cascade,
  action text not null,                     -- read/create/update/delete/approve/assign/publish
  permission_key text unique not null,      -- amro.work_order_templates.update
  created_at timestamptz not null default now(),
  unique(resource_key, action)
);

create table if not exists public.rbac_menu_binding (
  id uuid primary key default gen_random_uuid(),
  menu_path text not null unique,           -- /dashboard/amro/settings/work-order-templates
  resource_key text not null references public.rbac_resources(key),
  read_permission_key text not null,        -- amro.work_order_templates.read
  feature_flag text null,
  created_at timestamptz not null default now()
);

create table if not exists public.rbac_role_permission_assignments (
  id uuid primary key default gen_random_uuid(),
  role_id text not null references public.auth_roles(id) on delete cascade,
  permission_key text not null references public.rbac_resource_actions(permission_key) on delete cascade,
  effect text not null check (effect in ('allow','deny')),
  scope_level text not null check (scope_level in ('global','tenant','franchise')),
  tenant_id uuid null,
  franchise_id uuid null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  unique(role_id, permission_key, scope_level, coalesce(tenant_id,'00000000-0000-0000-0000-000000000000'::uuid), coalesce(franchise_id,'00000000-0000-0000-0000-000000000000'::uuid))
);
```

### B) API Endpoint Specs (Proposed)
- `GET /api/v2/rbac/menu-map`
  - returns menu tree filtered by user effective permissions/scope.
- `GET /api/v2/rbac/permissions?domain=amro`
  - returns resource-action catalog.
- `GET /api/v2/rbac/roles/:roleId/assignments`
  - returns allow/deny assignments with scope.
- `PUT /api/v2/rbac/roles/:roleId/assignments`
  - upserts assignment set with validation.
- `POST /api/v2/rbac/check`
  - payload `{ resource, action, tenantId, franchiseId }`
  - response `{ allowed, reason, matchedRule }`

### C) Frontend Components
- `useResolvedMenu()` hook for dynamic menu rendering.
- `PermissionMatrixTree` for hierarchical checkboxes.
- `RoleAssignmentBulkTable` for user-role bulk operations.
- `GuardedAction` component for per-button action checks (`create`, `update`, `delete`, etc.).

---

## 7) Testing Requirements

### Unit Tests
- Permission resolver precedence:
  - deny > allow > inherited role > default deny
- Scope matching:
  - tenant admin sees all tenant franchises
  - franchise admin restricted to franchise
- Menu rendering rules:
  - hidden without read permission
  - read-only mode without mutate permission

### Integration Tests
- Role assignment update propagates to:
  - menu visibility
  - route access
  - API authorization decisions
- Scoped permissions for same role across two franchises.

### E2E Tests
- Workflow A: Franchise Admin logs in, sees only permitted AMRO menus, blocked from unauthorized APIs.
- Workflow B: Tenant Admin with tenant-wide scope sees all franchise resources.
- Workflow C: Permission revoked in UI reflects immediately in navigation and action buttons.

---

## 8) Deliverables, Roadmap, and Migration Plan

### Deliverables
- Updated schema DDL and migration scripts
- API contract document (OpenAPI snippets)
- UI mockups/wireframes (above)
- RBAC decision flow and conflict policy
- Test plan + automated test suites

### Implementation Roadmap
- **Phase 1 (Week 1):** Canonical RBAC schema + seed AMRO resources/actions.
- **Phase 2 (Week 2):** Backend `authorize()` middleware + permission-check endpoints.
- **Phase 3 (Week 3):** Frontend dynamic menu + guarded actions + assignment UI.
- **Phase 4 (Week 4):** Regression hardening, E2E coverage, migration cutover.

### Migration Plan
1. Introduce new RBAC tables in parallel (no break).
2. Backfill:
   - map existing `auth_permissions` AMRO keys to new CRUD keys.
   - generate default assignments for `platform_admin`, `tenant_admin`, `franchise_admin`, `user`.
3. Dual-read period:
   - authorization checks read both old and new (feature-flagged).
4. Switch primary enforcement to new resolver.
5. Deprecate old coarse AMRO keys after parity validation.
6. Rollback strategy:
   - toggle feature flag back to legacy checks
   - retain old permission records until post-cutover verification complete.

---

## Implementation Acceptance Criteria
- Every AMRO menu item has an explicit `resource_key` and `read permission`.
- Every AMRO mutating API endpoint enforces a resource-action permission.
- Tenant admin behavior is tenant-wide unless override is explicitly narrowed.
- No route/menu/API permission drift (validated by CI contract test).
- Full audit log for role-permission assignment changes and permission decisions.
