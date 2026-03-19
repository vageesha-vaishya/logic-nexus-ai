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

## MRO Artifact Governance
- Use `artifacts/mro/` as the single root directory for all MRO project outputs.
- Store crawler outputs under `artifacts/mro/crawler/` including JSON reports, summaries, screenshots, and storage states.
- Store analysis and benchmark documents under `artifacts/mro/analysis/`.
- Store exported inventories and derived datasets under `artifacts/mro/exports/`.
- Do not create new MRO artifact directories outside `artifacts/mro/` unless explicitly approved.
