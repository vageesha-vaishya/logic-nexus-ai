# Project Rules

## CRM Module Header Rules
- Use `CRMModuleHeaderNavigation` for Leads, Accounts, Contacts, Opportunities, Activities, and Quotes.
- Keep action order fixed: Pipeline, Card, Grid, List, New, Refresh, Import/Export, Theme.
- Keep lead module create label as `New Lead`.
- Use `useCRMModuleNavigationState` for module view and theme persistence.
- Use `Azure Sky` as the default theme fallback in CRM module state.
- Keep pipeline as the default view mode unless a module has a stronger product requirement.
- Keep view and theme persistence in browser storage and reuse on remount.
- Use `ScopedDataAccess` for all data refresh callbacks used by header controls.

## CRM Remediation Rules
- Enforce one shared constant for CRM header control order and reuse it across all Lead/Quote module pages.
- Keep analytics outside the required fixed primary action order (secondary control, not interleaved with core sequence).
- Wrap Quotes import/export in the same module header/navigation shell pattern used by Leads import/export.
- Refactor QuoteMapVisualizer to tokenized utility classes, strict leg typing, and valid icon imports only.

## Platform Navigation and Pipeline Layout Rules
- Use `DashboardLayout` as the required shell for every CRM pipeline page to inherit universal banner, breadcrumb, and default main sidebar behaviors.
- Disallow module-specific replacement side menus on pipeline pages; only extend navigation through existing platform menu configuration and module sub-routes.
- Standardize pipeline page structure as three sections: header controls, kanban workspace with detail panel, and bottom statistics summary.
- Require pipeline analytics view to include KPI cards, date-range filters, export actions, and permission-aware access checks.

## Base UI/UX Uniformity Rule
- Require every new module to preserve the existing base UI/UX patterns to maintain a uniform platform look and feel.
- Implement new requirements as additive layers on top of the base module experience rather than replacing the base interface.
- Reuse existing layout shells, navigation structures, and established interaction patterns before introducing module-specific variants.
- Require validation evidence in pull requests that base UI/UX remains intact after enhancement delivery.

## Database Table Creation Governance
- Require schema-and-code overlap analysis before any new table migration.
- Require written extension assessment for candidate existing tables.
- Require documented reason existing tables cannot be extended.
- Require database architecture team approval before merging new table migrations.
- Require migration files with `CREATE TABLE` to include `DB-VERIFICATION:` and `DB-ARCH-APPROVAL:` metadata lines.
- Use JWT Signing Key and do not use Legacy JWT Secret 

## Backward Compatibility Governance
- Require every enhancement to preserve existing APIs, database schemas, UI flows, and third-party integrations.
- Require comprehensive regression testing before merge for modified modules and dependent integration paths.
- Require versioned API endpoints for unavoidable response-contract or behavior changes.
- Require additive database migrations with rollback-safe scripts for every schema change.
- Require feature flags for staged rollout of nontrivial behavior changes.
- Require deprecation documentation with migration paths for every superseded method or endpoint.
- Treat as breaking changes: removed/renamed API fields, destructive schema updates, incompatible UI workflow changes, or integration contract drift.
- Require architecture review board sign-off, customer communication plan, and deprecation timeline for approved breaking changes.

## SAAS/PAAS Hierarchy Architecture Compliance Rule
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

## MRO Artifact Governance
- Use `artifacts/mro/` as the single root directory for all MRO project outputs.
- Store crawler outputs under `artifacts/mro/crawler/` including JSON reports, summaries, screenshots, and storage states.
- Store analysis and benchmark documents under `artifacts/mro/analysis/`.
- Store exported inventories and derived datasets under `artifacts/mro/exports/`.
- Do not create new MRO artifact directories outside `artifacts/mro/` unless explicitly approved.

## AMRO Documentation Compliance Rule
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

## AMRO Database Component Documentation Enforcement Rule
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

## AMRO Domain Access Governance Rule
- Domain access is strictly limited to tenants who are explicitly assigned to the AMRO domain through the platform_domains and tenant_domain_assignments database tables, with active subscription status validated in real-time.

## Immediate Error Resolution Rule
- If any error occurs during testing, coding, or implementation of new requirements, it must be fixed immediately before starting any new requirement.

## CRUD Operations Standardization Rule

**Purpose:** Establish a unified, reusable architecture for all Create, Read, Update, and Delete operations across the entire platform to ensure consistency, reduce code duplication, and maintain high code quality standards.

**Implementation Requirements:**

1. **Generic Component Architecture**
   - Design and implement modular, framework-agnostic CRUD components that encapsulate all common functionality including state management, input validation, error handling, loading states, and user feedback mechanisms.
   - Ensure components are configurable through props/configuration objects to accommodate module-specific business logic without modifying core component code.
   - Implement proper separation of concerns with clear boundaries between presentation, business logic, and data access layers.

2. **Centralized Component Library**
   - Create a dedicated repository/directory structure for all reusable CRUD components including but not limited to: dynamic forms, data tables/lists, action buttons, confirmation dialogs, search/filter interfaces, and data export functionality.
   - Establish mandatory reference patterns - all modules must import and use components from this centralized library rather than creating local versions.
   - Implement semantic versioning for the component library with backward compatibility guarantees.

3. **Shared Service Layer**
   - Develop a comprehensive service abstraction layer that standardizes all API interactions including request/response formatting, authentication handling, retry logic, caching strategies, and error propagation.
   - Implement consistent data transformation pipelines for mapping between API responses and application data models.
   - Create standardized error handling with user-friendly error messages, logging, and monitoring integration.

4. **Standardized Interfaces and Models**
   - Define TypeScript interfaces or equivalent type definitions for all CRUD operations including request/response payloads, component props, and state structures.
   - Establish naming conventions, data format standards, and validation schemas that must be followed across all modules.
   - Create base classes or higher-order components that enforce these interface implementations.

5. **Theming and Styling System**
   - Implement a comprehensive theming solution using CSS variables, theme providers, or equivalent technology that ensures visual consistency while allowing per-module customization.
   - Define standard UI patterns for CRUD operations including form layouts, button placements, color schemes for different operation types, and responsive behavior.
   - Create a theme customization API that modules can use to override specific styling aspects without breaking overall consistency.

6. **Testing Requirements**
   - Write comprehensive unit tests for every shared component achieving minimum 90% code coverage as measured by industry-standard tools.
   - Implement integration tests for complete CRUD workflows including edge cases, error scenarios, and performance benchmarks.
   - Establish automated testing pipelines that run on every commit to prevent regressions.

7. **Documentation Standards**
   - Create detailed documentation for each reusable component including interactive examples, complete prop definitions with types and default values, integration code samples, and best practices.
   - Maintain a living style guide that showcases all available components with their variations and use cases.
   - Provide migration guides for upgrading between versions of the component library.

**Strict Reuse Policy Enforcement:**

Implement a zero-tolerance policy for code duplication in CRUD functionality. Before creating any new component, form, list, or management interface:

1. Conduct a thorough audit of existing Business Objects, Data Objects, Form Objects, and UI components across the entire platform.
2. Demonstrate that no existing functionality can be extended or configured to meet the new requirements.
3. Document the decision-making process including what was evaluated and why reuse was not possible.
4. If similar functionality exists in multiple places, refactor to use a single shared implementation.

**Quality Gates:**
- All new CRUD implementations must pass architectural review ensuring compliance with reuse policy.
- Code reviews must include verification that existing components were evaluated before approving new implementations.
- Regular audits will be conducted to identify and consolidate duplicate CRUD functionality.
- Violations of the reuse policy will require immediate refactoring to use shared components.

**Success Metrics:**
- Reduce CRUD-related code duplication by 80% within 6 months.
- Achieve 100% consistency in user experience across all CRUD interfaces.
- Decrease development time for new CRUD features by 60%.
- Maintain zero breaking changes in shared components across minor version updates.
