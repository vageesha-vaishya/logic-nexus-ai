# Platform System Config Audit Report

## Scope

Audit target: determine whether `public.platform_system_config` is required, or whether existing schema and code paths can satisfy the same requirements.

Verification performed across:
- `supabase/migrations/*.sql`
- configuration-related data access code in `src/lib`, `src/hooks`, `src/components`, and `src/pages`
- current debug-header security migration and runtime RPC consumers

## Candidate Tables and Assessment

| Table | Purpose | Current Structure | Existing Usage | Can Fulfill Platform System Config Requirements |
|---|---|---|---|---|
| `public.system_settings` | Tenant/global key-value configuration | `id`, `tenant_id`, `setting_key`, `setting_value` (JSONB), `created_at`, `updated_at`, unique `(tenant_id, setting_key)` | `ScopedDataAccess.getSystemSetting/setSystemSetting`; used in Leads and Settings modules | **Yes**. Extended with `updated_by` and global unique index on `setting_key` where `tenant_id IS NULL`; now supports global platform config and audit attribution |
| `public.app_feature_flags` | Global boolean feature toggles | `flag_key`, `is_enabled`, `description`, `updated_at` | `useFeatureFlags`/`useAppFeatureFlag` across dashboard and quote modules | **Partial only**. Useful for boolean gate propagation, but insufficient as primary config store because it cannot hold arbitrary JSON configuration state |
| `public.user_preferences` | User-level personalization and scope preferences | user-scoped records with fields like `theme`, `language`, `admin_override_enabled` and per-user metadata | `useCRM`, `useDashboardCustomization`, API scope resolution | **No**. Scope is per-user, not platform-wide configuration |
| `public.dashboard_preferences` | User dashboard widget layout | `user_id`, optional scope ids, `widgets`, `updated_at` | `useDashboardPreferences`, dashboard service | **No**. Domain-specific UI state only |
| `public.domain_config` | Domain/environment metadata config | `domain_id`, `environment`, `config` JSONB | Domain registry/metadata flows | **No** for platform system controls. Bound to domain/environment semantics, not general runtime platform settings |
| `public.quotation_configuration` | Tenant-level quotation defaults and smart-mode settings | tenant-scoped single-row configuration per tenant | `QuotationConfigurationService` | **No** for global platform controls. Purpose-specific to quotation module |
| `public.platform_system_config` | Proposed platform-wide config table for debug-header controls | `setting_key`, `setting_value`, `updated_at`, `updated_by` | Used only by debug security RPC migration path | **Not required**. Requirements are fully satisfied by extending `public.system_settings` |

## Code Interaction Findings

- Debug security runtime uses RPCs:
  - `get_platform_debug_button_enabled`
  - `set_platform_debug_button_enabled`
  - `validate_debug_access_attempt`
- UI integration:
  - admin setting card toggles debug header control through RPC
  - dashboard validates access attempt through RPC before opening debug panel
- Existing configuration access abstraction already exists through `ScopedDataAccess` and `system_settings`; no new table abstraction was needed.

## Structural Gaps Identified and Closed

To make `system_settings` fully equivalent to the planned `platform_system_config` behavior:

1. Added `updated_by` column to `public.system_settings`.
2. Added unique global key constraint via partial unique index:
   - unique `setting_key` for rows where `tenant_id IS NULL`.
3. Migrated any existing rows from `public.platform_system_config` into `public.system_settings`.
4. Updated debug-header RPCs to read/write global `system_settings` rows.
5. Removed obsolete `public.platform_system_config` table path.

## Final Decision

`public.platform_system_config` is not justified. Existing schema can be reasonably extended, and has now been extended, to satisfy the same requirements with less duplication and better consistency.

## Governance Rule (Mandatory)

For any future migration that creates a new table:

1. Perform schema-and-code overlap analysis against existing tables.
2. Document candidate extension paths and rejection rationale.
3. Provide database architecture team approval.
4. Include migration metadata lines:
   - `-- DB-VERIFICATION: <path-or-reference>`
   - `-- DB-ARCH-APPROVAL: <approval-reference>`
5. Block merge/deploy when metadata is missing for migrations adding `CREATE TABLE`.

This rule is enforced through:
- platform development guidelines in `.trae/rules/project_rules.md`
- code review checklist in `docs/Support/Templates/trae-ai-request-checklist.md`
- CI governance gate in `.github/workflows/ci.yml`
