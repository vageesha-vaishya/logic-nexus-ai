# Domain Management Administrator Guide

## Role and Access

- Ensure users who manage assignments have either `platform_admin` or `platform_domain_admin`.
- Ensure permission grants include `domains.assign`, `domains.revoke`, and `domains.audit.view`.
- System Settings at `/dashboard/settings` is restricted to `platform_admin` users only.
- Non-platform users are blocked on direct navigation and see: `Access denied - Platform admin privileges required`.

## Assign a Domain to Tenants

- Call `POST /api/v1/domain-assignments`.
- Provide `domainId`, `tenantIds`, and optional `batchId`.
- Review response counters: `assigned`, `reactivated`, and `skipped`.

## Revoke a Domain from Tenants

- Call `DELETE /api/v1/domain-assignments`.
- Use the same payload shape as assignment requests.
- Review response counters: `revoked` and `skipped`.

## Audit Review

- Call `GET /api/v1/domain-assignments` with optional `tenant_id`, `domain_id`, `batch_id`, and `limit`.
- Validate each operation through `domain_audit_log`.

## Quotation Isolation Validation

- Open Quotation Manager and switch domains from the domain selector.
- Confirm the domain badge in the header changes with selected domain.
- Confirm quote lists only show records mapped in `quotation_domain`.
