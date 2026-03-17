# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

* Introduced centralized CRM design system foundation under `src/design-system` with JSON/SCSS tokens and atomic component exports.
* Added Storybook modernization for webpack 5 with accessibility, design embed, and Chromatic addons.
* Added atomic design hierarchy components and CSF 3 stories with play-function user flows.
* Added design-system PR quality gates for Jest coverage, axe audits, cross-browser smoke checks, and performance budget validation.
* Added semantic-release automation, migration guide generation, and npm provenance-ready package metadata for private scope publication.
* Added lead Description/Notes REST endpoints with tenant-scoped access, sanitization, and validation:
  * `GET /api/leads/:id/description-notes`
  * `PUT /api/leads/:id/description`
  * `PUT /api/leads/:id/notes`
* Added lead schema migration `20260316100000_leads_schema_description_notes.sql` with backward-compatible `IF NOT EXISTS` guards for:
  * structured address fields, `salesperson_id`, `sales_team`, `priority`, `tags`, `description`, and `notes`
  * lead priority, description length, and notes length constraints
  * indexes on `salesperson_id`, `priority`, and GIN index for `tags`

### Fixed

* Resolved Origin/Destination field loading failure in `UnifiedQuoteComposer` by:
  * Migrating `LocationAutocomplete` and `LocationSelect` to use `scopedDb` instead of raw Supabase client, ensuring compliance with `logic-nexus-ai` data access patterns.
  * Adding stable user session handling in `LocationAutocomplete` to prevent infinite re-renders and ensure correct RLS context.
  * Fixing `LocationAutocomplete` and `LocationSelect` unit tests to properly mock `scopedDb` and user session, and resolving `cmdk` scrollIntoView errors.
  * Explicitly marking `ports_locations` queries as global (`isGlobal: true`) to align with multi-tenancy architecture.
* Fixed lead detail account fetch degradation path by hardening account lookup handling and retaining page rendering when linked account details are unavailable.

### Changed

* Renamed the quotation option label from "Manual Entry" to "Manual Quote" across the quotation UI and documentation.

## \[2026-01-21]

### Changed

* Upgraded Supabase CLI to version `2.72.8` (installed as dev dependency).
  * Previously using `2.67.1`.
  * This update ensures compatibility with the latest Supabase features and bug fixes.
  * Verified functionality with `npx supabase --version` and `npx supabase help`.
  * Note: `npm install -g supabase@latest` was attempted but failed due to permissions; installed locally via `npm install -D supabase@latest` which is the recommended approach for project-specific tooling.
