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

## Database Table Creation Governance
- Require schema-and-code overlap analysis before any new table migration.
- Require written extension assessment for candidate existing tables.
- Require documented reason existing tables cannot be extended.
- Require database architecture team approval before merging new table migrations.
- Require migration files with `CREATE TABLE` to include `DB-VERIFICATION:` and `DB-ARCH-APPROVAL:` metadata lines.

## Backward Compatibility Governance
- Require every enhancement to preserve existing APIs, database schemas, UI flows, and third-party integrations.
- Require comprehensive regression testing before merge for modified modules and dependent integration paths.
- Require versioned API endpoints for unavoidable response-contract or behavior changes.
- Require additive database migrations with rollback-safe scripts for every schema change.
- Require feature flags for staged rollout of nontrivial behavior changes.
- Require deprecation documentation with migration paths for every superseded method or endpoint.
- Treat as breaking changes: removed/renamed API fields, destructive schema updates, incompatible UI workflow changes, or integration contract drift.
- Require architecture review board sign-off, customer communication plan, and deprecation timeline for approved breaking changes.
