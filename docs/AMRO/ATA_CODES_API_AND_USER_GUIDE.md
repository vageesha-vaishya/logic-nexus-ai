# ATA Codes Management API and User Guide

## Purpose
This guide explains how to manage hierarchical ATA codes in AMRO Master Data and how to use the REST endpoints exposed at `/api/ata-codes`.

## Hierarchy Model
- `ata_codes` stores parent-child relationships using `parent_id`.
- Root rows have `parent_id = null` and default `level = 1`.
- Child rows inherit context from their parent:
  - `level = parent.level + 1`
  - `parent_code_ref = parent.code`
- Circular ancestry is rejected during update.

## UI Usage
- Open `AMRO Settings -> Master Data -> ATA`.
- Use the list view to review `code`, `description`, `level`, `chapter_code`, `parent_code_ref`, and `is_active`.
- Use the context action `Add Child ATA` on a row to prefill parent fields for child creation.
- Use `New ATA` to create root-level records.
- Use `Delete` to soft-delete (`is_active = false`) after dependency confirmation.

## Validation Rules
- `code` is required and cannot exceed 20 chars.
- `chapter_code` must be exactly 2 chars.
- `(tenant_id, code)` must be unique.
- `franchise_id` must exist in `franchises` when provided.
- `parent_id` must belong to the same tenant scope and cannot create circular hierarchy.

## API Endpoints
The endpoints below map to the AMRO master-data implementation for `ata_codes`.

### GET `/api/ata-codes`
List ATA codes with search, pagination, and sorting.

Supported query parameters:
- `page` (default `1`)
- `page_size` (default `25`, max `200`)
- `search` or `q`
- `sort_by` (`code`, `description`, etc.)
- `sort_dir` (`asc` or `desc`)

### GET `/api/ata-codes/{id}`
Get one ATA code by id.

### POST `/api/ata-codes`
Create ATA code.

Example body:
```json
{
  "code": "27-10",
  "description": "Flight Controls - Primary",
  "chapter_code": "27",
  "parent_id": null,
  "franchise_id": "00000000-0000-0000-0000-000000000000",
  "is_active": true
}
```

### PUT `/api/ata-codes/{id}`
Update ATA code. `PUT` is normalized to patch semantics for compatibility.

### DELETE `/api/ata-codes/{id}`
Soft delete ATA code by setting `is_active = false`.

## Security and Audit
- All operations are tenant-scoped (`tenant_id` enforced server-side).
- Domain and permission checks follow AMRO API standards.
- Create, update, delete, and bulk imports emit audit records through maintenance event logging.

## Performance Notes
- API responses support pagination and server-side sorting.
- ATA list responses use short-lived in-memory caching for repeated queries.
