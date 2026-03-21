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

## AMRO Domain Access Governance Rule
- Domain access is strictly limited to tenants who are explicitly assigned to the AMRO domain through the platform_domains and tenant_domain_assignments database tables, with active subscription status validated in real-time.

## Immediate Error Resolution Rule
- If any error occurs during testing, coding, or implementation of new requirements, it must be fixed immediately before starting any new requirement.
