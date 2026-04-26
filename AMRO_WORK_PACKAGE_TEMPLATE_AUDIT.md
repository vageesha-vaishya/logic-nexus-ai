# Work Package Templates Module - Comprehensive Audit Report

**Date:** 2026-04-12
**Auditor:** AMRO Architecture Team
**Scope:** All backend, frontend, database, and integration code for Work Package Templates

---

## 1. Executive Summary

### Key Findings

The AMRO Work Package Templates module is a **functional but incomplete** template management system. It provides basic CRUD operations, task-template linking, and aircraft model scoping, but lacks the enterprise-grade features required for aviation MRO operations. The system has a solid multi-tenant foundation and reasonable API design, but the UI is overly complex, the data model is flat (no versioning), and critical aviation compliance workflows are absent.

### Top 5 Recommendations (Immediate Impact)

1. **P0 - Template Versioning Implementation**: The schema exists (`amro_work_order_template_versions`, renamed from `amro_work_package_template_versions`) but has zero API or UI. This is the single most critical gap.
2. **P0 - Approval Workflow**: No draft/review/approve lifecycle exists. Templates go directly from creation to "active" with no governance.
3. **P1 - Template Catalog/Browser UI**: Templates are only editable via a modal dialog. There is no browse/search/catalog view.
4. **P1 - Material/BOM/Tooling Support**: Template content is limited to task IDs. No materials, tooling, or equipment requirements can be defined.
5. **P2 - Template Preview & Diff**: No way to preview a template's full content or compare versions before approving changes.

### Current Maturity Score: 3/10 (vs. Enterprise MRO Standards)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Data Model | 4/10 | Good base schema; missing version, BOM, tooling, compliance fields on main table |
| API Layer | 5/10 | CRUD exists with OpenAPI docs; no version/approval/compliance endpoints |
| UI/UX | 2/10 | Single modal dialog; no catalog, no preview, no version management |
| Compliance | 1/10 | No approval workflow, no audit trail, no regulatory mapping |
| Integration | 4/10 | Template-to-WP linking exists but is shallow; no auto-population |
| Testing | 3/10 | Route tests exist; no integration or E2E tests for template workflows |

---

## 2. Current State Analysis

### 2.1 Database Schema

#### Existing Tables

**`work_package_templates`** (main table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Auto-generated |
| `tenant_id` | UUID | Multi-tenant isolation |
| `franchise_id` | UUID FK | Nullable, franchise scoping |
| `template_code` | TEXT | Unique code (e.g., "WP-LINE-001") |
| `template_name` | TEXT | Human-readable name |
| `version` | INTEGER | **Flat version number, no version history** |
| `active` | BOOLEAN | Simple on/off toggle |
| `maintenance_type` | TEXT | Enum: line, base, component, inspection, overhaul, repair, upgrade, modification |
| `model_id` | UUID FK | References `assembly_models` |
| `aircraft_model` | TEXT | Legacy text token (redundant with model_id) |
| `scope_json` | JSONB | Scope definition array |
| `tasks_json` | JSONB | **Denormalized task snapshot** |
| `policy_snapshot_id` | UUID FK | Policy reference |
| `created_by` | UUID FK | User who created |
| `updated_by` | UUID FK | User who last updated |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Indexes:** `idx_work_package_templates_model_id`, plus unique constraints on tenant/template_code/version.

**`work_package_template_task_templates`** (relationship/junction table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `tenant_id` | UUID | |
| `franchise_id` | UUID | Nullable |
| `work_package_template_id` | UUID FK | |
| `model_id` | UUID FK | References `assembly_models` |
| `task_template_id` | UUID FK | References `task_templates` |
| `created_by` | UUID | Audit |
| `updated_by` | UUID | Audit |
| `deleted_at` | TIMESTAMPTZ | Soft delete |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Unique Constraint:** `uq_work_package_template_task_templates_scope` on `(tenant_id, COALESCE(franchise_id), model_id, task_template_id)`

**Row Level Security:** Both tables have RLS policies for platform admin and tenant/franchise scoping.

#### Schema Created but Unused

**`amro_work_order_template_versions`** (migration `20260412100000`, renamed by `20260425181000`)
- Has version_number, status (draft/pending_review/approved/active/deprecated/archived), approval workflow columns, materials_json, tooling_json, compliance_requirements_json, effective dates, aircraft/engine model arrays.
- **Status:** Schema exists but has ZERO API routes, ZERO UI, ZERO React Query hooks.

**`amro_work_order_template_categories`** (migration `20260412100000`, renamed by `20260425162000`)
- Has category_code, category_type, typical duration/intervals.
- **Status:** Schema exists but unused.

### 2.2 Backend/API Layer

#### API Endpoints (Express Routes)

**File:** `/Users/vims/Downloads/Development Projects/Trae/SOS Logistics Pro/logic-nexus-ai/services/amro-api/src/routes/work-package-template.routes.ts` (1281 lines)

| Method | Path | Function | Status |
|--------|------|----------|--------|
| POST | `/work-package-templates` | Create template + relationships | Implemented |
| GET | `/work-package-templates` | List all templates with tasks | Implemented |
| GET | `/work-package-templates/:id` | Get single template with tasks | Implemented |
| PUT | `/work-package-templates/:id` | Update template + reset relationships | Implemented |
| DELETE | `/work-package-templates/:id` | Delete template (cascades) | Implemented |
| POST | `/work-package-templates/:id/task-templates` | Add task-template relationships | Implemented |
| GET | `/work-package-templates/model-options` | List aircraft models for dropdown | Implemented |
| GET | `/work-package-templates/task-template-options` | List task templates by aircraft model | Implemented |

**API Gateway (Next.js):**
- `/Users/vims/Downloads/Development Projects/Trae/SOS Logistics Pro/logic-nexus-ai/src/pages/api/v2/amro/work-package-templates.ts` - Thin proxy to master-data entity handler
- `/Users/vims/Downloads/Development Projects/Trae/SOS Logistics Pro/logic-nexus-ai/src/pages/api/v2/amro/work-package-templates/task-template-options.ts` - Dedicated handler
- `/Users/vims/Downloads/Development Projects/Trae/SOS Logistics Pro/logic-nexus-ai/src/pages/api/v2/amro/work-package-templates/model-options.ts` - Dedicated handler

**Master Data Entity Handler:**
- `/Users/vims/Downloads/Development Projects/Trae/SOS Logistics Pro/logic-nexus-ai/src/pages/api/v2/amro/master-data/[entity].ts` (1842 lines)
- Generic CRUD with WPT-specific special handling at lines 1538, 1552, 1618, 1720
- Entity config in `shared.ts` at line 293-313

#### API Quality Assessment

**Strengths:**
- OpenAPI 3.1 documentation annotations present (JSDoc-based)
- Tenant/franchise scoping enforced at API level
- Task template validation (UUID check, existence check, assembly model cross-check)
- Manual rollback logic on relationship insert failure (line 286-306 of routes file)
- Idempotency support via `amro_request_idempotency` table (migration `20260403143000`)
- Deterministic direct-update path (comment at line 1149: "Always use deterministic direct update path")

**Weaknesses:**
- **No atomic transactions**: Template and relationship inserts are separate Supabase calls, not wrapped in a database transaction. The manual rollback is fragile.
- **No RPC usage**: The atomic PostgreSQL function `amro_create_work_package_template_atomic` (migration `20260403143000`) is defined but never called from the routes. The routes use manual multi-step inserts instead.
- **Dual code paths**: Express routes (`services/amro-api/`) and Next.js API routes (`src/pages/api/`) both handle WPT operations, with potential inconsistency.
- **No version endpoints**: GET/POST/PUT for template versions do not exist despite schema being ready.
- **No approval endpoints**: Submit/approve/reject endpoints do not exist.
- **No category endpoints**: Template categories CRUD does not exist.
- **Response format inconsistency**: Some endpoints return `{ data, count }`, others return `{ data, work_package_template_id, relationship_count }`, others return `{ data, added_task_template_ids }`.

### 2.3 Frontend UI Components

#### Component Inventory

| File | Component | Lines | Purpose |
|------|-----------|-------|---------|
| `WorkPackageTemplateCreateSection.tsx` | `WorkPackageTemplateCreateSection` | 1307 | Core template create/edit form with task table |
| `AmroWorkPackageTemplateAdapter.tsx` | `AmroWorkPackageTemplateAdapter` | 858 | Adapter wrapping CreateSection for StandardFormTemplate |
| `AmroStandardFormTemplate.tsx` | `AmroStandardFormTemplate` | 311 | Generic form template shell |
| `useWorkPackageTemplates.ts` | `useWorkPackageTemplateOptions` | 74 | React Query hook for template dropdown |
| `useTemplateVersionState.ts` | `useListTemplateVersions`, etc. | ~200 | React Query hooks for template versions (references endpoints that **do not exist**) |
| `AmroWorkPackageTemplateAdapter.stories.tsx` | Storybook stories | ~300 | Visual regression testing |
| `AmroWorkPackageTemplatesEnterprise.stories.tsx` | Enterprise story variants | 358 | Desktop, tablet, high-contrast, RTL, offline, approval workflow stories |
| `WorkPackageTemplateCreateSection.test.tsx` | Unit tests | ~150 | Basic rendering and interaction tests |

#### Form Structure

The template creation form has these sections:

1. **Work Package Details** (core fields):
   - Template Code (required)
   - Template Name (required)
   - Version (required, numeric)
   - Aircraft Model (required, UUID dropdown)
   - Maintenance Type (required, 8 options)
   - Active (checkbox)
   - Policy Snapshot ID (optional text)

2. **Selected Tasks** (data table with filtering):
   - Sortable columns: Task ID, Code Form No, ATA Code, Reference AMP, Description, Category Code, Estimated Man Hours, Is Mandatory
   - Per-column text filters
   - Checkbox selection (individual + select all)
   - Selection state synchronized with `tasks_json` and `selected_task_template_ids`

3. **Scope Definition** (legacy block):
   - Threshold percentage
   - Planning horizon days
   - Policy snapshot label

#### UI Architecture Issues

- **1307-line monolithic component**: `WorkPackageTemplateCreateSection.tsx` is too large, handling data loading, filtering, sorting, selection, form state, tenant/franchise scoping, hydration, and rendering in a single file.
- **Adapter pattern with dual rendering**: `AmroWorkPackageTemplateAdapter.tsx` (858 lines) wraps `WorkPackageTemplateCreateSection` to integrate with `AmroStandardFormTemplate`, creating two rendering paths that must be kept in sync.
- **Feature flag fragmentation**: `embeddedInStandardTemplate` and `hideCoreDetailsSection` props create conditional rendering paths that are hard to test.
- **Raw `<select>` elements**: The aircraft model dropdown uses native `<select>` instead of the shadcn `Select` component used for maintenance type (line ~700+ of CreateSection).

### 2.4 Integration Points

#### Template Selection in Create Work Package Wizard

**File:** `/Users/vims/Downloads/Development Projects/Trae/SOS Logistics Pro/logic-nexus-ai/src/features/module-amro/components/work-orders/AmroWorkPackageCreateWizard.tsx`

- Uses `useWorkPackageTemplateOptions()` hook to fetch templates
- Templates are displayed in a simple dropdown (Select component)
- Only shows templates with status "active" or "approved"
- **Gap**: No template preview - user selects blindly
- **Gap**: No filtering by aircraft model in the wizard
- **Gap**: Template version selection uses colon-delimited format (`templateId:versionNumber`) but the backend has no version API

#### Template-to-Work-Package Mapping

- Templates store `tasks_json` as a JSON array of `{task_template_id}` objects
- When creating a work package, tasks are NOT auto-populated from the template
- The relationship table `work_package_template_task_templates` stores the definitive links
- **Drift risk**: `tasks_json` on the main table can diverge from the relationship table (evidenced by repair scripts at `scripts/sql/repair_amro_wpt_task_drift.sql`)

#### Template Versioning Workflow

- Schema defines: `draft` -> `pending_review` -> `approved` -> `active` -> `deprecated` -> `archived`
- **Current implementation**: NO versioning workflow exists. The `version` field on the main table is a plain integer with no associated change records.
- `useTemplateVersionState.ts` defines hooks like `useListTemplateVersions()` that reference API endpoints that do not exist.

---

## 3. Feature Gap Matrix

### 3.1 Template Lifecycle Management

| Feature | Status | Gap Severity | Enterprise Standard |
|---------|--------|-------------|---------------------|
| Version control (draft/review/approve/active/deprecated) | Schema only, zero API/UI | P0 Critical | AMOS: Full change control with digital signatures |
| Change tracking (what changed between versions) | Not implemented | P0 Critical | TRAX: Detailed change logs with before/after |
| Approval workflow with role-based permissions | Not implemented | P0 Critical | Swiss-AS: Multi-level approval with role enforcement |
| Effectivity dates (effective_from/effective_until) | Schema only | P1 High | IBS: Calendar-based effectivity control |
| Aircraft model applicability (per-version) | Schema only | P1 High | All: Multi-model template applicability |
| Audit trail (immutable) | Schema only (`amro_work_package_audit_log`) | P0 Critical | All: Cryptographic integrity required |
| Soft delete / deprecation | Schema only | P1 High | AMOS: Deprecation with grace period |

### 3.2 Template Content Structure

| Feature | Status | Gap Severity | Enterprise Standard |
|---------|--------|-------------|---------------------|
| Task definitions with AMP reference codes | Partial (task_template_id only) | P1 High | MPD/MRB reference required |
| Bill of Materials (BOM) | Not implemented (schema: `materials_json`) | P0 Critical | SAP: Full BOM with part numbers, quantities |
| Tooling and equipment requirements | Not implemented (schema: `tooling_json`) | P1 High | AMOS: Required tools per task |
| Compliance/regulatory requirements | Not implemented (schema: `compliance_requirements_json`) | P0 Critical | All: AD/SB mapping mandatory |
| Estimated labor hours | Partial (from task_templates only) | P2 Medium | TRAX: Per-task labor estimates |
| Skill/qualification requirements | Not implemented | P1 High | IFS: Technician qualification matching |
| Safety precautions and warnings | Not implemented | P1 High | All: Safety-critical flagging |
| Task sequencing/order | Partial (display order only) | P1 High | TRAX: Dependency graph with critical path |

### 3.3 Template Reusability & Composition

| Feature | Status | Gap Severity | Enterprise Standard |
|---------|--------|-------------|---------------------|
| Template libraries and categories | Schema only (`amro_work_order_template_categories`) | P1 High | TRAX: 500+ predefined check templates |
| Template cloning/duplication | Not implemented | P1 High | All: Clone with modification tracking |
| Template inheritance/variants by aircraft model | Not implemented | P2 Medium | AMOS: Base template + model-specific overrides |
| Sub-templates and nested structures | Not implemented | P2 Medium | SAP: Composite templates |
| Cross-template task sharing | Not implemented | P3 Low | Maintenix: Common task pools |

### 3.4 Integration & Automation

| Feature | Status | Gap Severity | Enterprise Standard |
|---------|--------|-------------|---------------------|
| Template-to-work-package mapping | Partial (shallow, manual) | P1 High | AMOS: Auto-population of all content |
| Auto-population of tasks, materials, tooling | Not implemented | P0 Critical | All: One-click template application |
| Scheduling integration (intervals, due dates) | Not implemented | P1 High | Ramco: Flight hour/cycle/calendar triggers |
| Regulatory compliance mapping (FAA/EASA/CAAC) | Not implemented | P0 Critical | All: Compliance tracking per template |
| Template usage analytics | Not implemented | P2 Medium | TRAX: Usage metrics and effectiveness |
| Template health monitoring | Not implemented | P2 Medium | AMOS: Template compliance rate tracking |

---

## 4. UI/UX Audit Findings

### 4.1 Current UI Components Analysis

#### `WorkPackageTemplateCreateSection.tsx` (1307 lines)

**Issues Found:**

1. **Cognitive Overload** (Severity: High)
   - Single modal contains 7+ form fields, a sortable/filterable task table with 9 columns, and scope definition
   - No progressive disclosure or wizard-style step-through
   - Users must understand tenant, franchise, model, task relationships simultaneously

2. **No Template Catalog** (Severity: Critical)
   - Templates are only accessible via a "Create/Edit" modal opened from a tab
   - No browse/search/filter view for existing templates
   - No template details preview before opening edit

3. **Poor Loading States** (Severity: Medium)
   - Aircraft model dropdown shows only "Loading aircraft models..." text
   - Task template table has no skeleton loading state
   - No optimistic updates on save

4. **Inadequate Error Messages** (Severity: High)
   - Generic error: "Failed to load task templates (status 400)" - no root cause
   - No field-level error guidance (e.g., "Template Code must be unique")
   - Model resolution failures show: "Aircraft Model could not be resolved for this template." without explanation

5. **Missing Template Preview** (Severity: Critical)
   - No way to view a template's full content without entering edit mode
   - No read-only preview mode
   - No PDF export for review/approval

6. **No Bulk Operations** (Severity: Medium)
   - Cannot bulk-import templates
   - Cannot bulk-activate/deactivate
   - Cannot bulk-assign to aircraft models

7. **Redundant Data Entry** (Severity: High)
   - `model_id` (UUID) and `aircraft_model` (text) are both stored, causing confusion
   - `tasks_json` and `work_package_template_task_templates` relationship table duplicate data
   - Known drift issue requiring repair scripts

8. **Keyboard Navigation** (Severity: Medium)
   - No keyboard shortcuts for common actions (Save: Ctrl+S, New: Ctrl+N)
   - Tab order not optimized for data entry workflow
   - Task table selection requires mouse (no spacebar toggle)

### 4.2 Enterprise UI Patterns Missing

| Pattern | Priority | Impact |
|---------|----------|--------|
| Template catalog with card/grid view | P0 | Users cannot discover or compare templates |
| Visual version diff viewer | P0 | Approvers cannot see what changed |
| Template dependency graph | P1 | Cannot visualize task relationships |
| Drag-and-drop task reordering | P1 | Manual reordering via checkboxes is inefficient |
| Rich text editing for descriptions | P2 | Plain text limits task description quality |
| Attachment support (PDFs, manuals) | P1 | Cannot attach AMM, IPC, or TSM references |
| Real-time collaboration indicators | P3 | Low priority for MRO context |
| Template health dashboard | P2 | No visibility into template usage/effectiveness |

### 4.3 Accessibility Assessment

- **WCAG 2.1 AA compliance**: Partially met
  - Form labels present for all fields
  - `aria-invalid` attributes used for validation errors
  - Sort buttons have `aria-label`
  - **Gap**: No visible focus indicators on task table rows
  - **Gap**: Color-only status indication (no text/icon for selected/mandatory)
  - **Gap**: Task table header row does not have `scope="col"` attributes

---

## 5. End-to-End Scenario Maps

### 5.1 Template Author Journey (Current State)

```
1. Navigate to AMRO Settings > Master Data > Work Package Templates tab
2. Click "Create Template" button
3. Modal opens with empty form
4. Select tenant (if platform admin) -> franchise -> aircraft model
5. Enter template code, name, version, maintenance type
6. Task table loads based on selected aircraft model
7. Filter tasks by ATA code, description, etc.
8. Check boxes to select tasks for template
9. Optionally set scope definition values
10. Click Save
11. Template appears in list (if list exists)
```

**Pain Points:**
- Steps 4-6 require understanding of multi-tenant data model
- No undo/redo during task selection
- No "save as draft" - template is immediately active
- No way to verify template completeness before save
- After save, no feedback on how many tasks were linked

### 5.1 Template Author Journey (Enterprise Target)

```
1. Navigate to AMRO > Templates > Template Catalog
2. Browse/filter templates by type, model, status
3. Click "Create Template" or "Clone Template"
4. Wizard Step 1: Basic Info (code, name, category, applicable models)
5. Wizard Step 2: Task Selection (filter, select, order tasks)
6. Wizard Step 3: Materials & Tooling (BOM, required equipment)
7. Wizard Step 4: Compliance Requirements (AD/SB mapping, safety flags)
8. Wizard Step 5: Review & Submit (full preview, change summary)
9. Submit for review (status: draft -> pending_review)
10. Reviewer receives notification
11. Reviewer opens diff view, adds comments
12. Author addresses feedback, resubmits
13. Approver approves (status: approved -> active)
14. Template available in work package creation wizard
```

### 5.2 Template Consumer Journey (Mechanic/Planner)

**Current State:**
```
1. Open Create Work Package wizard
2. Select "Scheduled Maintenance" path
3. Select template from dropdown (name only, no preview)
4. Fill in aircraft, dates, station
5. Tasks are NOT auto-populated from template
6. Manual task entry required
7. Save work package
```

**Critical Gap:** Step 5-6 defeats the purpose of templates. The wizard selects a template but does not auto-populate tasks.

### 5.3 Template Administrator Journey

**Current State:** Non-existent. No approval workflow, no review interface, no usage analytics.

**Target State:**
```
1. Dashboard shows pending templates for review
2. Open template diff view (changes from previous version)
3. Review task changes, BOM changes, compliance updates
4. Approve with comments or reject with reasons
5. Monitor template usage metrics
6. Deprecate outdated templates with effective end date
7. Audit compliance: verify all active templates have current regulatory mapping
```

### 5.4 Regulatory Compliance Journey

**Current State:** Non-existent.

**Target State:**
```
1. Link template to AMP (Approved Maintenance Program) references
2. Map tasks to AD/SB requirements
3. Set compliance intervals and deadlines
4. Track compliance status per active work package
5. Generate audit reports for regulatory inspections
6. Certificate of Release to Service (CRS) generation
```

---

## 6. Enhancement Roadmap

### Phase 1: Foundation Fixes (Weeks 1-2) -- P0

| ID | Enhancement | Effort | Impact | Dependencies |
|----|-------------|--------|--------|-------------|
| 1.1 | Implement template version CRUD API endpoints | M | Critical | Schema exists |
| 1.2 | Implement approval workflow API (submit/approve/reject) | M | Critical | 1.1 |
| 1.3 | Fix template-to-WP auto-population in wizard | S | Critical | None |
| 1.4 | Create template catalog/browse page | M | High | None |
| 1.5 | Add template preview (read-only) dialog | S | High | 1.4 |
| 1.6 | Remove redundant `aircraft_model` text field, migrate to `model_id` only | S | Medium | None |

### Phase 2: Content Enrichment (Weeks 3-4) -- P0/P1

| ID | Enhancement | Effort | Impact | Dependencies |
|----|-------------|--------|--------|-------------|
| 2.1 | Materials/BOM management UI and API | L | Critical | 1.1 |
| 2.2 | Tooling/equipment requirements support | M | High | 1.1 |
| 2.3 | Compliance requirements per template | M | Critical | 1.2 |
| 2.4 | Task drag-and-drop reordering | M | High | None |
| 2.5 | Task dependency graph | L | High | 2.4 |
| 2.6 | Template cloning/duplication | S | High | 1.1 |

### Phase 3: Governance & Compliance (Weeks 5-6) -- P0/P1

| ID | Enhancement | Effort | Impact | Dependencies |
|----|-------------|--------|--------|-------------|
| 3.1 | Approval workflow UI (reviewer dashboard) | L | Critical | 1.2 |
| 3.2 | Version diff viewer | L | High | 1.1, 3.1 |
| 3.3 | AD/SB compliance directive linking | M | Critical | 2.3 |
| 3.4 | Digital signature capture for CRS | M | Critical | 3.3 |
| 3.5 | Template usage analytics dashboard | M | Medium | None |
| 3.6 | Attachment support (PDFs, manuals) | S | High | None |

### Phase 4: Advanced Features (Weeks 7-8) -- P1/P2

| ID | Enhancement | Effort | Impact | Dependencies |
|----|-------------|--------|--------|-------------|
| 4.1 | Template categories and classification UI | M | Medium | Schema exists |
| 4.2 | Template inheritance/variants | XL | Medium | 1.1 |
| 4.3 | Bulk template operations | M | Medium | 1.4 |
| 4.4 | Template health monitoring | M | Medium | 3.5 |
| 4.5 | Export template as PDF for review | S | Medium | 3.6 |
| 4.6 | Keyboard shortcuts and accessibility improvements | S | High | None |

### Priority Definitions

- **P0 (Critical)**: Blocks enterprise MRO operations; compliance risk; must ship first
- **P1 (High)**: Significant user experience improvement; expected by MRO users
- **P2 (Medium)**: Nice-to-have; improves efficiency but not blocking
- **P3 (Low)**: Polish; deferred until core functionality is solid

### Effort Definitions

- **S (Small)**: 1-3 days for one developer
- **M (Medium)**: 3-7 days for one developer
- **L (Large)**: 1-2 weeks for one developer or 3-5 days for two
- **XL (Extra Large)**: 2+ weeks; requires design and architecture decisions

---

## 7. Technical Recommendations

### 7.1 Architecture Improvements

**A. Eliminate Dual Code Paths**
- **Issue:** Express routes (`services/amro-api/src/routes/work-package-template.routes.ts`) and Next.js routes (`src/pages/api/v2/amro/work-package-templates/`) both serve WPT requests with different implementations.
- **Recommendation:** Consolidate to a single API layer. Either fully migrate to the Express microservice or fully adopt Next.js API routes. The Express routes have better validation logic; the Next.js routes have better integration with the master-data entity handler.

**B. Use Atomic Database Operations**
- **Issue:** Template creation uses separate Supabase calls for the template row and relationship rows, with manual rollback logic.
- **Recommendation:** Use the existing `amro_create_work_package_template_atomic` PostgreSQL function. It is already defined in migration `20260403143000` but never called. Similarly, create `amro_update_work_package_template_atomic` and `amro_delete_work_package_template_atomic` functions.

**C. Resolve `tasks_json` vs. Relationship Table Drift**
- **Issue:** Two sources of truth for template-task relationships. The `tasks_json` column on `work_package_templates` and the `work_package_template_task_templates` junction table can diverge.
- **Recommendation:** Make the junction table the single source of truth. Deprecate `tasks_json` by computing it from the relationship table via a database trigger or view. Run the existing repair script (`scripts/sql/repair_amro_wpt_task_drift.sql`) to fix existing drift.

**D. Remove Redundant `aircraft_model` Column**
- **Issue:** Both `model_id` (UUID) and `aircraft_model` (text) store the same information.
- **Recommendation:** Migrate all references to use `model_id` via foreign key join to `assembly_models`. Remove the `aircraft_model` column after data migration.

**E. Standardize API Response Formats**
- **Issue:** Different endpoints return different shapes (`{ data, count }`, `{ data, work_package_template_id, relationship_count }`, `{ data, added_task_template_ids }`).
- **Recommendation:** Adopt a consistent envelope: `{ data, meta: { count, templateId, relationshipCount } }`.

### 7.2 Testing Strategy

**Current Test Coverage:**
- Route tests: `services/amro-api/tests/work-package-template.routes.test.ts` (3 test suites, ~8 test cases)
- Component tests: `WorkPackageTemplateCreateSection.test.tsx` (~3 test cases)
- Storybook stories: 10+ stories covering various states
- **Missing:** Integration tests for full create-edit-delete workflow, E2E tests, API contract tests

**Recommended:**
- Add integration tests for the atomic create/update flow
- Add E2E tests for template creation wizard flow
- Add contract tests for API request/response shapes
- Target 80%+ coverage on route handlers and component logic

### 7.3 Documentation

**Current State:**
- OpenAPI annotations on Express routes (JSDoc `@openapi` blocks)
- No standalone API documentation for WPT endpoints
- No runbook for template authoring workflow
- No troubleshooting guide for common errors

**Recommended:**
- Generate OpenAPI spec from JSDoc annotations
- Create template authoring runbook
- Document the multi-tenant/franchise scoping rules
- Add troubleshooting guide for drift resolution

### 7.4 Technical Debt Inventory

| Debt Item | Location | Severity | Fix Effort |
|-----------|----------|----------|------------|
| Manual rollback instead of database transaction | `work-package-template.routes.ts` lines 286-306 | High | S |
| Atomic RPC function defined but never called | Migration `20260403143000` | High | S |
| `tasks_json` drift from relationship table | `work_package_templates.tasks_json` | High | S |
| Dual `model_id` and `aircraft_model` columns | `work_package_templates` table | Medium | S |
| Inconsistent API response formats | All WPT endpoints | Medium | S |
| 1307-line monolithic component | `WorkPackageTemplateCreateSection.tsx` | Medium | M |
| Dual rendering paths (adapter + direct) | `AmroWorkPackageTemplateAdapter.tsx` | Medium | M |
| Native `<select>` mixed with shadcn `Select` | `WorkPackageTemplateCreateSection.tsx` ~line 700 | Low | S |
| Feature flag conditionals create untestable paths | `embeddedInStandardTemplate` prop | Low | S |
| React Query hooks reference non-existent endpoints | `useTemplateVersionState.ts` | High | M |

---

## 8. Quick Wins (1-2 Days, High Impact)

### QW1: Fix Template Auto-Population in Create Wizard
- **File:** `AmroWorkPackageCreateWizard.tsx`
- **Change:** When a template is selected, fetch its tasks from `work_package_template_task_templates` and auto-populate the work package task list.
- **Impact:** Unlocks the primary value proposition of templates.
- **Effort:** 1-2 days

### QW2: Add Template Catalog Page
- **File:** New component in `src/features/module-amro/settings/pages/amro-settings-master-data/`
- **Change:** Create a browse/search page listing all templates with code, name, model, maintenance type, active status, and task count.
- **Impact:** Users can discover and audit existing templates.
- **Effort:** 1-2 days

### QW3: Improve Error Messages
- **Files:** `WorkPackageTemplateCreateSection.tsx`, `work-package-template.routes.ts`
- **Change:** Replace generic "Failed to load" messages with actionable guidance. Add field-level validation messages.
- **Impact:** Reduces support requests and user frustration.
- **Effort:** 0.5 days

### QW4: Add Template Preview Dialog
- **File:** New component + modify `WorkPackageTemplateCreateSection.tsx`
- **Change:** Add a "Preview" button that opens a read-only view of the template with all tasks, scope, and metadata.
- **Impact:** Enables review before approval workflow.
- **Effort:** 1 day

### QW5: Run Drift Repair Script
- **File:** `scripts/sql/repair_amro_wpt_task_drift.sql`
- **Change:** Execute the repair script in production to synchronize `tasks_json` with the relationship table.
- **Impact:** Eliminates data integrity risk.
- **Effort:** 0.5 days (plus testing)

### QW6: Implement Template Version API Endpoints
- **File:** New routes in `services/amro-api/src/routes/work-package-template.routes.ts`
- **Change:** Implement GET/POST/PUT for `amro_work_order_template_versions` table. These are simple CRUD endpoints backed by an existing schema.
- **Impact:** Enables all future versioning features.
- **Effort:** 2 days

### QW7: Add Keyboard Shortcuts
- **File:** `WorkPackageTemplateCreateSection.tsx`
- **Change:** Add Ctrl+S for save, Ctrl+N for new template, Escape to close modal, Space to toggle task selection in table.
- **Impact:** Significantly improves power user productivity.
- **Effort:** 0.5 days

---

## Appendix A: File Inventory

### Backend/API

| File | Lines | Purpose |
|------|-------|---------|
| `services/amro-api/src/routes/work-package-template.routes.ts` | 1281 | Express API routes (CRUD, model-options, task-template-options) |
| `services/amro-api/tests/work-package-template.routes.test.ts` | ~200 | Route unit tests |
| `src/pages/api/v2/amro/work-package-templates.ts` | 10 | Next.js proxy to master-data handler |
| `src/pages/api/v2/amro/work-package-templates/model-options.ts` | ~50 | Aircraft model options endpoint |
| `src/pages/api/v2/amro/work-package-templates/task-template-options.ts` | ~140 | Task template options by model |
| `src/pages/api/v2/amro/master-data/[entity].ts` | 1842 | Generic CRUD with WPT special handling |
| `src/pages/api/v2/amro/master-data/shared.ts` | 1034 | Entity configuration including WPT |

### Frontend

| File | Lines | Purpose |
|------|-------|---------|
| `src/features/module-amro/settings/pages/amro-settings-master-data/components/WorkPackageTemplateCreateSection.tsx` | 1307 | Core template form with task table |
| `src/features/module-amro/settings/pages/amro-settings-master-data/components/WorkPackageTemplateCreateSection.test.tsx` | ~150 | Component tests |
| `src/features/module-amro/components/templates/AmroWorkPackageTemplateAdapter.tsx` | 858 | Adapter for StandardFormTemplate |
| `src/features/module-amro/components/templates/AmroWorkPackageTemplateAdapter.stories.tsx` | ~300 | Storybook stories |
| `src/features/module-amro/components/templates/AmroWorkPackageTemplatesEnterprise.stories.tsx` | 358 | Enterprise story variants |
| `src/features/module-amro/components/templates/AmroStandardFormTemplate.tsx` | 311 | Generic form template shell |
| `src/features/module-amro/components/work-orders/useWorkPackageTemplates.ts` | 74 | React Query hook for template dropdown |
| `src/features/module-amro/components/work-orders/useTemplateVersionState.ts` | ~200 | React Query hooks (referencing non-existent endpoints) |

### Database

| File | Purpose |
|------|---------|
| `supabase/migrations/20260331123000_amro_create_work_package_template_task_temlates.sql` | Junction table creation |
| `supabase/migrations/20260401110000_amro_fix_work_package_template_task_templates.sql` | Junction table fix |
| `supabase/migrations/20260403143000_amro_wpt_atomic_create.sql` | Atomic create function + idempotency table |
| `supabase/migrations/20260403203000_amro_wpt_atomic_update.sql` | Atomic update function |
| `supabase/migrations/20260404234500_amro_wpt_relations_add_audit_columns.sql` | Audit columns on junction table |
| `supabase/migrations/20260405003000_amro_wpt_add_model_id.sql` | model_id FK on main table |
| `supabase/migrations/20260412100000_amro_work_package_enhanced_schema.sql` | Enterprise schema (versions, categories, compliance, etc.) |
| `scripts/sql/repair_amro_wpt_task_drift.sql` | Drift repair script |
| `scripts/sql/validate_amro_wpt_task_drift.sql` | Drift validation script |

### Documentation

| File | Purpose |
|------|---------|
| `AMRO_WORK_PACKAGE_ENHANCEMENT_STRATEGY.md` | Comprehensive enhancement blueprint |
| `AMRO_WORK_PACKAGE_ENHANCEMENT_SUMMARY.md` | Executive summary of enhancements |
| `AMRO_WORK_PACKAGE_IMPLEMENTATION_ROADMAP.md` | Step-by-step implementation guide |
| `WIZARD_TEMPLATE_AIRCRAFT_FIX.md` | Documentation of recent wizard fix |
| `MRO_WORK_PACKAGE_PLATFORMS_ANALYSIS.md` | Industry benchmark analysis |

---

## Appendix B: Database Column Reference

### `work_package_templates` - Complete Column List

```
id                  UUID            PRIMARY KEY
tenant_id           UUID            NOT NULL, FK -> tenants
franchise_id        UUID            NULL, FK -> franchises
template_code       TEXT            NOT NULL
template_name       TEXT            NOT NULL
version             INTEGER         NOT NULL DEFAULT 1
active              BOOLEAN         NOT NULL DEFAULT true
maintenance_type    TEXT            NOT NULL
model_id            UUID            FK -> assembly_models (added 20260405)
aircraft_model      TEXT            NULL (legacy, redundant)
scope_json          JSONB           NOT NULL DEFAULT '[]'
tasks_json          JSONB           NOT NULL DEFAULT '[]'
policy_snapshot_id  UUID            NULL
created_by          UUID            FK -> auth.users
updated_by          UUID            FK -> auth.users
created_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ     NOT NULL DEFAULT now()
```

### `work_package_template_task_templates` - Complete Column List

```
id                          UUID            PRIMARY KEY
tenant_id                   UUID            NOT NULL
franchise_id                UUID            NULL
work_package_template_id    UUID            NOT NULL, FK -> work_package_templates
model_id                    UUID            NOT NULL, FK -> assembly_models
task_template_id            UUID            NOT NULL, FK -> task_templates
created_by                  UUID            NULL (audit)
updated_by                  UUID            NULL (audit)
deleted_at                  TIMESTAMPTZ     NULL (soft delete)
created_at                  TIMESTAMPTZ     NOT NULL DEFAULT now()
updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT now()
```

---

**End of Audit Report**

**Document Version:** 1.0
**Created:** 2026-04-12
**Review Status:** Ready for stakeholder review
**Next Action:** Prioritize Quick Wins (Section 8) for immediate implementation
