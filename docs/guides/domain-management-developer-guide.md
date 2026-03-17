# Domain Management Developer Guide

## Core Schema

- `domain_tenant`: tenant-domain assignment state.
- `domain_audit_log`: immutable assignment and revocation activity stream.
- `quotation_domain`: quote-to-domain mapping for isolation.

## API Surface

- `src/pages/api/v1/domain-assignments.ts` provides:
  - `GET` for audit history,
  - `POST` for bulk assignment,
  - `DELETE` for bulk revocation.
- Service orchestration is in `src/services/domain/DomainAssignmentService.ts`.

## Quotation Isolation Flow

- `DomainQuotationIsolationService` resolves allowed quote IDs per domain.
- `QuotationManager` applies domain quote filtering before search and pagination.
- Plugin lifecycle hooks are invoked through `PluginRegistry.getPluginByDomain`.

## Testing

- Unit tests:
  - `DomainAssignmentService.test.ts`
  - `DomainQuotationIsolationService.test.ts`
- API tests:
  - `domain-assignments.test.ts`

## Operational Notes

- Domain schema migration file includes `DB-VERIFICATION` and `DB-ARCH-APPROVAL` metadata.
- OpenAPI definition is in `docs/api/domain-management-api.yaml`.
- Redis-backed queue infrastructure already exists and can be reused for asynchronous domain jobs.
- System Settings authorization uses `ProtectedRoute` with `requiredRole="platform_admin"` and denial state messaging.
- Menu access is filtered with `RoleGuard` using `roles: ['platform_admin']` on the System Settings navigation entry.
- Data-layer enforcement is in `ScopedDataAccess.getSystemSetting` and `ScopedDataAccess.setSystemSetting`, which return a 403-style error for non-platform admins.
