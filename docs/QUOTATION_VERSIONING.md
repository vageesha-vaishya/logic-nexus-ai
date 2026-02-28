# Quotation Versioning System

## Overview
The Quotation Versioning System provides robust tracking, management, and auditing of quotation changes. It supports Draft, Minor, and Major versioning strategies with full history retention.

## Database Schema

### `quotation_versions`
Stores the snapshot metadata for each version.
- **id**: UUID (Primary Key)
- **quote_id**: UUID (Foreign Key to `quotes`)
- **version_number**: Integer (Sequential, e.g., 1, 2, 3...)
- **major**: Integer
- **minor**: Integer
- **status**: Enum (`draft`, `active`, `archived`, `deleted`)
- **is_active**: Boolean (Only one active version per quote)
- **metadata**: JSONB (Stores the full snapshot of data if needed, or specific diffs)

### `quotation_version_audit_logs`
Tracks all lifecycle events for compliance.
- **action**: `CREATED`, `UPDATED`, `STATUS_CHANGE`, `DELETED`
- **performed_by**: User UUID
- **details**: JSONB context

## Service Architecture

### `QuotationVersionService`
The core business logic layer located in `src/services/quotation/QuotationVersionService.ts`.

#### Key Methods
- `saveVersion(quoteId, tenantId, data, type, userId, reason)`: Creates a new immutable version.
- `getVersion(quoteId, versionId?)`: Retrieves a specific or latest active version.
- `listVersions(quoteId, page, limit)`: Paginated history.
- `deleteVersion(versionId, userId)`: Soft-delete with audit log.
- `purgeVersions(retentionDays)`: Automated cleanup of old archived versions.

## API Reference

### GET `/api/v1/quotations/[id]/versions`
List all versions for a quote.
- **Query Params**: `page`, `limit`
- **Response**: `{ data: QuotationVersion[], count: number }`

### POST `/api/v1/quotations/[id]/versions`
Create a new version.
- **Body**:
  ```json
  {
    "data": { ...full_quote_payload... },
    "type": "minor" | "major" | "draft",
    "reason": "Updated pricing"
  }
  ```

### DELETE `/api/v1/quotations/[id]/versions`
Soft delete a specific version.
- **Body**: `{ "versionId": "uuid" }`

## Testing
- Unit tests: `src/services/quotation/__tests__/QuotationVersionService.test.ts`
- Integration tests: `src/tests/integration/api/quotation_versions.test.ts`
