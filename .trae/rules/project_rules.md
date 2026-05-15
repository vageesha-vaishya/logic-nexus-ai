# Project Rules

## Normalized Rule Catalog

### CRM Module Header Rules
- **Rule ID:** `LNX-GOV-CRM-001`
- **Status:** `Active`
- **Owner:** `CRM Product Engineering Team`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `Leads, Accounts, Contacts, Opportunities, Activities, Quotes`

#### Purpose
- Preserve a uniform CRM header navigation and control experience.

#### Scope
- In scope: CRM module header controls, view-state persistence, and refresh behavior.
- Out of scope: non-CRM modules.

#### Requirements
- Use `CRMModuleHeaderNavigation` for Leads, Accounts, Contacts, Opportunities, Activities, and Quotes.
- Keep action order fixed: Pipeline, Card, Grid, List, New, Refresh, Import/Export, Theme.
- Keep lead module create label as `New Lead`.
- Use `useCRMModuleNavigationState` for module view and theme persistence.
- Use `Azure Sky` as the default theme fallback in CRM module state.
- Keep pipeline as the default view mode unless a module has a stronger product requirement.
- Keep view and theme persistence in browser storage and reuse on remount.
- Use `ScopedDataAccess` for all data refresh callbacks used by header controls.

### CRM Remediation Rules
- **Rule ID:** `LNX-GOV-CRM-002`
- **Status:** `Active`
- **Owner:** `CRM Remediation Squad`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `CRM lead and quote module remediation`

#### Purpose
- Remove header inconsistencies and enforce shared CRM interaction contracts.

#### Scope
- In scope: lead/quote header controls, analytics placement, map visualizer implementation.
- Out of scope: non-CRM feature modules.

#### Requirements
- Enforce one shared constant for CRM header control order and reuse it across all Lead/Quote module pages.
- Keep analytics outside the required fixed primary action order (secondary control, not interleaved with core sequence).
- Wrap Quotes import/export in the same module header/navigation shell pattern used by Leads import/export.
- Refactor QuoteMapVisualizer to tokenized utility classes, strict leg typing, and valid icon imports only.

### Platform Navigation and Pipeline Layout Rules
- **Rule ID:** `LNX-GOV-PLT-001`
- **Status:** `Active`
- **Owner:** `Platform Experience Engineering`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `CRM pipeline pages`

#### Purpose
- Keep pipeline routes aligned to the platform shell and analytics standards.

#### Scope
- In scope: CRM pipeline page layout, navigation shell, and analytics structure.
- Out of scope: non-pipeline route surfaces.

#### Requirements
- Use `DashboardLayout` as the required shell for every CRM pipeline page to inherit universal banner, breadcrumb, and default main sidebar behaviors.
- Disallow module-specific replacement side menus on pipeline pages; only extend navigation through existing platform menu configuration and module sub-routes.
- Standardize pipeline page structure as three sections: header controls, kanban workspace with detail panel, and bottom statistics summary.
- Require pipeline analytics view to include KPI cards, date-range filters, export actions, and permission-aware access checks.

### Base UI/UX Uniformity Rule
- **Rule ID:** `LNX-GOV-UX-001`
- **Status:** `Active`
- **Owner:** `Design System Governance Council`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `all new modules and enhancements`

#### Purpose
- Preserve a consistent platform look and feel across all enhancements.

#### Scope
- In scope: new modules and enhancements across all domains.
- Out of scope: none.

#### Requirements
- Require every new module to preserve the existing base UI/UX patterns to maintain a uniform platform look and feel.
- Implement new requirements as additive layers on top of the base module experience rather than replacing the base interface.
- Reuse existing layout shells, navigation structures, and established interaction patterns before introducing module-specific variants.
- Require validation evidence in pull requests that base UI/UX remains intact after enhancement delivery.

### Database Table Creation Governance
- **Rule ID:** `LNX-GOV-DB-001`
- **Status:** `Active`
- **Owner:** `Database Architecture Board`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `all database table creation and migration work`

#### Purpose
- Enforce extension-first schema governance and architecture approval before new table creation.

#### Scope
- In scope: migrations introducing `CREATE TABLE`.
- Out of scope: non-schema changes.

#### Requirements
- Require schema-and-code overlap analysis before any new table migration.
- Require written extension assessment for candidate existing tables.
- Require documented reason existing tables cannot be extended.
- Require database architecture team approval before merging new table migrations.
- Require migration files with `CREATE TABLE` to include `DB-VERIFICATION:` and `DB-ARCH-APPROVAL:` metadata lines.
- Use JWT Signing Key and do not use Legacy JWT Secret.

### Domain Schema Isolation Governance
- **Rule ID:** `LNX-GOV-DB-002`
- **Status:** `Active`
- **Owner:** `Database Architecture Board`
- **Effective Date:** `2026-05-14`
- **Last Updated:** `2026-05-14`
- **Applies To:** `all Supabase PostgreSQL schema and object creation`

#### Purpose
- Enforce strict domain isolation boundaries and prevent cross-domain database coupling.

#### Scope
- In scope: every new business domain and all database objects created for that domain.
- Out of scope: `public` shared platform primitives (auth, tenancy, shared reference types) explicitly approved by the database architecture board.

#### Requirements
- Require every new business domain to receive its own dedicated PostgreSQL schema.
- Require all domain-specific database objects to be created inside that dedicated schema, including tables, functions, views, indexes, triggers, policies, and sequences.
- Disallow creation of domain-specific objects in `public` or in other domain schemas.
- Require migrations introducing a new domain schema to include an explicit schema creation step and a clearly defined ownership/grants strategy for that schema.

### Backward Compatibility Governance
- **Rule ID:** `LNX-GOV-COMPAT-001`
- **Status:** `Active`
- **Owner:** `Architecture Review Board`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `all enhancements affecting APIs, schema, UI, integrations`

#### Purpose
- Prevent disruptive changes and require safe rollout practices.

#### Scope
- In scope: enhancements and any contract-impacting changes.
- Out of scope: none.

#### Requirements
- Require every enhancement to preserve existing APIs, database schemas, UI flows, and third-party integrations.
- Require comprehensive regression testing before merge for modified modules and dependent integration paths.
- Require versioned API endpoints for unavoidable response-contract or behavior changes.
- Require additive database migrations with rollback-safe scripts for every schema change.
- Require feature flags for staged rollout of nontrivial behavior changes.
- Require deprecation documentation with migration paths for every superseded method or endpoint.
- Treat as breaking changes: removed/renamed API fields, destructive schema updates, incompatible UI workflow changes, or integration contract drift.
- Require architecture review board sign-off, customer communication plan, and deprecation timeline for approved breaking changes.

### SAAS/PAAS Hierarchy Architecture Compliance Rule
- **Rule ID:** `LNX-GOV-ARCH-001`
- **Status:** `Active`
- **Owner:** `Platform Architecture Board`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `all platform development activities`

#### Purpose
- Enforce platform-to-franchise hierarchy and isolation boundaries across all implementation work.

#### Scope
- In scope: new modules, enhancements, removals, and modifications across all domains.
- Out of scope: none.

#### Requirements
- Require strict adherence to the platform hierarchy `Platform -> Admin -> Multi-Tenant -> Multi-Franchisee` for all development activities across the logic-nexus-ai platform.
- Apply this rule to every new module creation, existing module enhancement, feature removal, and implementation modification across all business domains.
- Require each implementation to be designed, developed, and validated against all hierarchy tiers before merge approval.
- Require implementation records to document tier alignment for Platform, Admin, Multi-Tenant, and Multi-Franchisee responsibilities and behavior boundaries.
- Require explicit tenant and franchisee data isolation controls, including scoped access patterns and tenant/franchise-aware authorization boundaries.
- Require access control validation at each hierarchy level, including platform-level governance permissions, admin oversight permissions, tenant role permissions, and franchisee operational permissions.
- Require architecture review checkpoints before deployment for all hierarchy-impacting work, with approval evidence attached to delivery artifacts or pull requests.
- Require validation evidence for all releases to confirm:
  - tenant data segregation is enforced and verified;
  - franchisee-specific configurations are applied without cross-franchise leakage;
  - admin-level oversight capabilities remain intact and auditable;
  - platform-wide behavior remains consistent across modules and domains.

### MRO Artifact Governance
- **Rule ID:** `LNX-GOV-MRO-001`
- **Status:** `Active`
- **Owner:** `AMRO Program Management Office`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `all MRO project output artifacts`

#### Purpose
- Standardize MRO artifact storage to one governed directory tree.

#### Scope
- In scope: MRO crawler outputs, analysis docs, exports, and derived datasets.
- Out of scope: non-MRO artifacts.

#### Requirements
- Use `artifacts/mro/` as the single root directory for all MRO project outputs.
- Store crawler outputs under `artifacts/mro/crawler/` including JSON reports, summaries, screenshots, and storage states.
- Store analysis and benchmark documents under `artifacts/mro/analysis/`.
- Store exported inventories and derived datasets under `artifacts/mro/exports/`.
- Do not create new MRO artifact directories outside `artifacts/mro/` unless explicitly approved.

### AMRO Documentation Compliance Rule
- **Rule ID:** `LNX-GOV-AMRO-001`
- **Status:** `Active`
- **Owner:** `AMRO Domain Architecture Council`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `all AMRO code and schema changes`

#### Purpose
- Ensure every AMRO implementation is traceable to the mandatory AMRO documentation baseline.

#### Scope
- In scope: AMRO code creation, enhancement, modification, refactor, and database changes.
- Out of scope: non-AMRO changes.

#### Requirements
- Require all AMRO-related code creation, enhancement, modification, refactor, and database changes to cross-check AMRO documentation before implementation.
- Treat the following files as mandatory references for every AMRO change:
  - `AMRO_COMPREHENSIVE_DESIGN_SPECIFICATION.md`
  - `AMRO_IMPLEMENTATION_ROADMAP.md`
  - `AMRO_DEPLOYMENT_PROCEDURES.md`
  - `amro-plugin-requirements-spec-v1.0.md`
  - `2026-03-19-amro-plugin-implementation.md`
  - `2026-03-19-amro-plugin-implementation-reference.md`
  - `AMRO_DOCUMENTATION_INDEX.md`
  - `AMRO_PLATFORM_INTEGRATION_ARCHITECTURE.md`
  - `AMRO_QUICK_REFERENCE_GUIDE.md`
- Require every AMRO pull request to include a mandatory documentation reference section listing consulted AMRO documents and impacted requirement/design IDs.
- Require AMRO code review checklists to include explicit verification that the implementation was cross-checked against the full AMRO documentation set and that any deviations are documented.
- Require pre-commit enforcement for AMRO-related work to verify documentation compliance metadata is present in commit scope, including referenced AMRO docs and traceability IDs.
- Reject AMRO pull requests that do not include documentation references, review checklist confirmation, and pre-commit compliance evidence.

### AMRO Database Component Documentation Enforcement Rule
- **Rule ID:** `LNX-GOV-AMRO-002`
- **Status:** `Active`
- **Owner:** `AMRO Database Governance Council`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `AMRO schema and database-adjacent components`

#### Purpose
- Keep AMRO low-level design documentation complete, validated, and deployment-blocking when missing.

#### Scope
- In scope: AMRO database tables, SQL functions/triggers, edge functions, module objects, module APIs.
- Out of scope: unrelated module documentation.

#### Requirements
- Require immediate documentation updates in `docs/AMRO_LOW_LEVEL_DESIGN.md` under the `Plugins and Modules Documentation Contract` section for every new or changed:
  - database table;
  - SQL function or trigger function;
  - edge function;
  - module object;
  - module API.
- Require each documentation entry to include complete technical specifications:
  - table or component name with namespace prefix;
  - detailed purpose description;
  - exhaustive columns/fields with type and nullability;
  - primary key definitions;
  - foreign key relationships and cascade/delete rules;
  - unique constraints;
  - check constraints;
  - default values;
  - index definitions;
  - estimated row count (or request volume for APIs/functions);
  - security considerations.
- Require formal review workflow before merge:
  - mandatory peer review by a senior developer;
  - mandatory database architect approval for schema-impacting changes;
  - mandatory documentation completeness checklist verification;
  - mandatory pre-deployment validation execution and evidence attachment.
- Require automated compliance validation for every deployment:
  - run `npm run amro:db-docs:validate` to compare actual schema in `supabase/migrations` against the LLD authoritative database section;
  - run `npm run amro:db-docs:report` to generate deployment compliance reports in `artifacts/mro/analysis/`;
  - block deployment when undocumented or partially documented components are detected.
- Enforce non-compliance penalties:
  - immediate deployment block for any undocumented component;
  - PR rejection for missing technical specification fields;
  - mandatory remediation PR within one business day;
  - escalation to architecture review board after repeated violations in the same quarter.
- Require quarterly audit process:
  - perform one formal AMRO schema-vs-documentation audit per quarter;
  - archive audit evidence and gap remediation status in `artifacts/mro/analysis/`;
  - track open documentation gaps until closure with owner and due date.
- Require use of standard templates defined in LLD `Plugins and Modules Documentation Contract` for all database components and module interfaces to keep formatting consistent and machine-validated.

### AMRO Domain Access Governance Rule
- **Rule ID:** `LNX-GOV-AMRO-003`
- **Status:** `Active`
- **Owner:** `Platform Security and IAM Team`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `AMRO domain access control`

#### Purpose
- Restrict AMRO domain access to valid tenant-domain assignments with active subscriptions.

#### Scope
- In scope: domain eligibility checks for AMRO.
- Out of scope: non-AMRO domain access checks.

#### Requirements
- Domain access is strictly limited to tenants who are explicitly assigned to the AMRO domain through the platform_domains and tenant_domain_assignments database tables, with active subscription status validated in real-time.

### Immediate Error Resolution Rule
- **Rule ID:** `LNX-GOV-QUALITY-001`
- **Status:** `Active`
- **Owner:** `Engineering Excellence and QA Team`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `all testing/coding/implementation activity`

#### Purpose
- Prevent defect accumulation by enforcing immediate remediation before new scope.

#### Scope
- In scope: any error during testing, coding, or implementation.
- Out of scope: none.

#### Requirements
- If any error occurs during testing, coding, or implementation of new requirements, it must be fixed immediately before starting any new requirement.

### CRUD Operations Standardization Rule
- **Rule ID:** `LNX-GOV-CRUD-001`
- **Status:** `Active`
- **Owner:** `Platform Engineering Standards Council`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `all CRUD implementations across platform modules`

#### Purpose
- Establish a unified, reusable architecture for all Create, Read, Update, and Delete operations across the entire platform to ensure consistency, reduce code duplication, and maintain high code quality standards.

#### Scope
- In scope: CRUD components, services, interfaces, theming, testing, documentation, and governance.
- Out of scope: none.

#### Requirements
- Generic Component Architecture:
  - Design and implement modular, framework-agnostic CRUD components that encapsulate all common functionality including state management, input validation, error handling, loading states, and user feedback mechanisms.
  - Ensure components are configurable through props/configuration objects to accommodate module-specific business logic without modifying core component code.
  - Implement proper separation of concerns with clear boundaries between presentation, business logic, and data access layers.
- Centralized Component Library:
  - Create a dedicated repository/directory structure for all reusable CRUD components including but not limited to: dynamic forms, data tables/lists, action buttons, confirmation dialogs, search/filter interfaces, and data export functionality.
  - Establish mandatory reference patterns - all modules must import and use components from this centralized library rather than creating local versions.
  - Implement semantic versioning for the component library with backward compatibility guarantees.
- Shared Service Layer:
  - Develop a comprehensive service abstraction layer that standardizes all API interactions including request/response formatting, authentication handling, retry logic, caching strategies, and error propagation.
  - Implement consistent data transformation pipelines for mapping between API responses and application data models.
  - Create standardized error handling with user-friendly error messages, logging, and monitoring integration.
- Standardized Interfaces and Models:
  - Define TypeScript interfaces or equivalent type definitions for all CRUD operations including request/response payloads, component props, and state structures.
  - Establish naming conventions, data format standards, and validation schemas that must be followed across all modules.
  - Create base classes or higher-order components that enforce these interface implementations.
- Theming and Styling System:
  - Implement a comprehensive theming solution using CSS variables, theme providers, or equivalent technology that ensures visual consistency while allowing per-module customization.
  - Define standard UI patterns for CRUD operations including form layouts, button placements, color schemes for different operation types, and responsive behavior.
  - Create a theme customization API that modules can use to override specific styling aspects without breaking overall consistency.
- Testing Requirements:
  - Write comprehensive unit tests for every shared component achieving minimum 90% code coverage as measured by industry-standard tools.
  - Implement integration tests for complete CRUD workflows including edge cases, error scenarios, and performance benchmarks.
  - Establish automated testing pipelines that run on every commit to prevent regressions.
- Documentation Standards:
  - Create detailed documentation for each reusable component including interactive examples, complete prop definitions with types and default values, integration code samples, and best practices.
  - Maintain a living style guide that showcases all available components with their variations and use cases.
  - Provide migration guides for upgrading between versions of the component library.
- Strict Reuse Policy Enforcement:
  - Implement a zero-tolerance policy for code duplication in CRUD functionality.
  - Before creating any new component, form, list, or management interface:
    - Conduct a thorough audit of existing Business Objects, Data Objects, Form Objects, and UI components across the entire platform.
    - Demonstrate that no existing functionality can be extended or configured to meet the new requirements.
    - Document the decision-making process including what was evaluated and why reuse was not possible.
    - If similar functionality exists in multiple places, refactor to use a single shared implementation.
- Quality Gates:
  - All new CRUD implementations must pass architectural review ensuring compliance with reuse policy.
  - Code reviews must include verification that existing components were evaluated before approving new implementations.
  - Regular audits will be conducted to identify and consolidate duplicate CRUD functionality.
  - Violations of the reuse policy will require immediate refactoring to use shared components.
- Success Metrics:
  - Reduce CRUD-related code duplication by 80% within 6 months.
  - Achieve 100% consistency in user experience across all CRUD interfaces.
  - Decrease development time for new CRUD features by 60%.
  - Maintain zero breaking changes in shared components across minor version updates.

### Mandatory Rules-First Development Workflow
- **Rule ID:** `LNX-GOV-WORKFLOW-001`
- **Status:** `Active`
- **Owner:** `Engineering Governance Council`
- **Effective Date:** `2026-03-26`
- **Last Updated:** `2026-03-26`
- **Applies To:** `all development, enhancement, and remediation activities`

#### Purpose
- Enforce a rules-first development process where `project_rules.md` is consulted before any code change.
- Keep governance controls adaptive by continuously analyzing the codebase and proposing validated new rules.

#### Scope
- In scope: local development workflow, pre-commit validation, rule analysis, dynamic proposal generation, and rule synchronization.
- Out of scope: emergency production hotfixes explicitly approved by the Architecture Review Board.

#### Requirements
- Require every developer and automation flow to run `npm run rules:consult` before starting code changes.
- Require rule compliance checks to pass through `npm run rules:enforce` before local dev orchestration and before commit validation.
- Require recurring codebase analysis via `npm run rules:analyze` to detect anti-patterns, recurring inconsistencies, and established best practices.
- Require dynamic rule proposal generation via `npm run rules:propose` using evidence thresholds and explicit relevance/actionability/alignment validation.
- Require synchronized rule evolution through `npm run rules:sync` so validated proposals are reflected in this file under the auto-generated proposal section.
- Require development environments to install pre-commit enforcement using `npm run rules:hook:install` to block commits that skip mandatory consultation.
- Require governance review of generated proposals before promoting any auto-generated rule into the normalized active catalog.

---

## Project Rules Template Structure

Use the structure below when adding new rules so this file stays consistent and easy to review.

## 1) Metadata
- **Rule ID:** `LNX-GOV-<DOMAIN>-###`
- **Status:** `Active | Draft | Deprecated`
- **Owner:** `<team-or-role>`
- **Effective Date:** `YYYY-MM-DD`
- **Last Updated:** `YYYY-MM-DD`
- **Applies To:** `<modules/routes/services>`
- **Related Docs:** `<absolute or repo-relative paths>`

## 2) Purpose
- Define the business or technical intent in 1-3 bullets.
- State what risk this rule prevents.

## 3) Scope
- Include exactly where the rule applies.
- Include explicit exclusions.
- Specify tenant/franchise scope expectations where relevant.

## 4) Non-Negotiable Requirements
- List mandatory controls as short, testable bullets.
- Prefer “Require …” phrasing.
- Keep each requirement atomic and implementation-ready.

## 5) Implementation Standards
- **Architecture:** expected shell/layout/service pattern.
- **Data Access:** required scoped access pattern.
- **API Contract:** additive/backward-compatible behavior requirements.
- **UI/UX:** mandatory interaction and consistency constraints.
- **Security:** authz/authn and isolation constraints.

## 6) Validation and Quality Gates
- Required tests to run before merge.
- Required lint/typecheck/build gates.
- Regression coverage requirements.
- Required approval roles for merge.

## 7) Evidence Required in PR
- Checklist of evidence artifacts:
  - screenshots or recordings;
  - test output;
  - impacted routes/files list;
  - migration/rollback notes when applicable.

## 8) Rollout and Backward Compatibility
- Feature-flag expectation and rollout sequencing.
- Rollback requirements.
- Compatibility requirements for APIs, schemas, and workflows.

## 9) Enforcement and Escalation
- What blocks merge/deployment.
- Remediation SLA for violations.
- Escalation path after repeated violations.

## 10) Rule Change Procedure
- How to propose updates to this rule.
- Required reviewers.
- Required impact analysis and migration note updates.

## Rule Entry Template (Copy/Paste)

### <Rule Title>
- **Rule ID:** `LNX-GOV-<DOMAIN>-###`
- **Status:** `Active`
- **Owner:** `<team-or-role>`
- **Effective Date:** `YYYY-MM-DD`
- **Last Updated:** `YYYY-MM-DD`
- **Applies To:** `<modules/routes/services>`
- **Related Docs:** `<paths>`

#### Purpose
- <intent-1>
- <intent-2>

#### Scope
- In scope: <items>
- Out of scope: <items>

#### Requirements
- Require <control-1>.
- Require <control-2>.
- Require <control-3>.

#### Implementation Standards
- Architecture: <pattern>
- Data Access: <pattern>
- API: <compatibility rule>
- UI/UX: <consistency rule>
- Security: <auth/isolation rule>

#### Validation Gates
- Run: `<lint-command>`
- Run: `<typecheck-command>`
- Run: `<test-command>`
- Require: `<approval-role>`

#### PR Evidence
- <evidence-1>
- <evidence-2>
- <evidence-3>

#### Rollout and Compatibility
- Feature flag: `<flag-name>`
- Rollback: `<procedure>`
- Compatibility: `<constraints>`

#### Enforcement
- Merge blocked when: <condition>
- Remediation SLA: <duration>
- Escalation: <path>

---

<!-- DYNAMIC-RULES:START -->
## Dynamic Rule Proposals (Auto-Generated)
Last Generated: 2026-03-26T04:11:10.466Z

<!-- RULE-PROPOSALS:START -->

### Direct Supabase client usage in app code
- **Generated Rule ID:** `LNX-GOV-AUTO-001`
- **Source Finding:** `DIRECT_SUPABASE_CLIENT_USAGE`
- **Proposed Requirement:** Require all data operations in app modules to use scoped access wrappers such as scopedDb instead of direct supabase.from calls.
- **Evidence Count:** 83
- **Validation:** relevant=yes, actionable=yes, aligned=yes
- **Suggested Enforcement Command:** `npm run rules:enforce`
- **Evidence Files:**
- `src/components/assignment/AssignmentHistory.tsx` (1)
- `src/components/crm/UnifiedPartnerForm.tsx` (1)
- `src/components/email/ComplianceSettings.tsx` (1)
- `src/components/email/EmailClient.tsx` (1)
- `src/components/email/EmailComposeDialog.tsx` (2)
- `src/components/logistics/ShipmentContainerManager.tsx` (2)
- `src/components/rates/RateSheetsTab.tsx` (3)
- `src/components/sales/quote-form/CatalogSaveDialog.tsx` (1)

### Console statements in runtime source files
- **Generated Rule ID:** `LNX-GOV-AUTO-002`
- **Source Finding:** `CONSOLE_STATEMENTS`
- **Proposed Requirement:** Require runtime source modules to avoid console logging and use approved structured logging utilities.
- **Evidence Count:** 754
- **Validation:** relevant=yes, actionable=yes, aligned=yes
- **Suggested Enforcement Command:** `npm run lint`
- **Evidence Files:**
- `src/components/GlobalErrorBoundary.tsx` (1)
- `src/components/admin/FranchiseForm.tsx` (1)
- `src/components/admin/ImportFranchiseModal.tsx` (2)
- `src/components/admin/TenantForm.tsx` (4)
- `src/components/admin/UserForm.tsx` (6)
- `src/components/assignment/AssignmentAnalytics.tsx` (1)
- `src/components/assignment/AssignmentHistory.tsx` (1)
- `src/components/assignment/AssignmentQueue.tsx` (3)

### Pipeline pages missing DashboardLayout
- **Generated Rule ID:** `LNX-GOV-AUTO-003`
- **Source Finding:** `PIPELINE_LAYOUT_DRIFT`
- **Proposed Requirement:** Require every pipeline route component to render within DashboardLayout to preserve platform shell consistency.
- **Evidence Count:** 13
- **Validation:** relevant=yes, actionable=yes, aligned=yes
- **Suggested Enforcement Command:** `npm run rules:analyze`
- **Evidence Files:**
- `src/components/analytics/PipelineAnalytics.tsx` (1)
- `src/components/crm/LeadsPipelineComponents.tsx` (1)
- `src/components/dashboard/crm/widgets/PipelineByStage.tsx` (1)
- `src/components/dashboard/crm/widgets/PipelineOverview.tsx` (1)
- `src/components/dashboard/crm/widgets/TeamPipeline.tsx` (1)
- `src/components/dashboard/sales/widgets/PipelineView.tsx` (1)
- `src/components/dashboard/sales/widgets/SalesPipelineWaterfall.tsx` (1)
- `src/components/debug/pipeline/PipelineContext.tsx` (1)

### Scoped data access usage
- **Generated Rule ID:** `LNX-GOV-AUTO-004`
- **Source Finding:** `SCOPED_DB_USAGE`
- **Proposed Requirement:** Require new data-access implementations to follow existing scopedDb data isolation patterns for tenant and franchise safety.
- **Evidence Count:** 219
- **Validation:** relevant=yes, actionable=yes, aligned=yes
- **Suggested Enforcement Command:** `npm run rules:enforce`
- **Evidence Files:**
- `src/components/admin/FranchiseForm.tsx` (1)
- `src/components/admin/ImportFranchiseModal.tsx` (1)
- `src/components/aes-hts-code-manager.tsx` (2)
- `src/components/assignment/AssignmentHistory.tsx` (1)
- `src/components/assignment/AssignmentRuleForm.tsx` (1)
- `src/components/assignment/AssignmentRules.tsx` (1)
- `src/components/assignment/TerritoryGeographyManager.tsx` (4)
- `src/components/assignment/TerritoryManagement.tsx` (2)

<!-- RULE-PROPOSALS:END -->
<!-- DYNAMIC-RULES:END -->
