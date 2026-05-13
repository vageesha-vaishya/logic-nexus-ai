# Generic File Attachment System Design

## 1. Executive Decision

Yes, this platform should use **Supabase Storage** as the primary file binary store, with PostgreSQL tables for metadata, links, versioning, and audit events.

Why:
- Managed object storage is better suited than relational DB for large binaries.
- Signed URL support is native and efficient.
- Storage policies can enforce tenant-level access alongside table RLS.
- Lower database bloat and better long-term cost/performance profile.

## 2. Current-State Analysis (Codebase Findings)

Current implementation is fragmented:
- `vendor_documents` + `vendor-documents` bucket.
- `shipment_attachments` + `shipments` bucket.
- `commodity_documents` + `commodity-docs` bucket.
- `email-attachments` bucket for compose flow.

Observed issues:
- Different metadata tables and column conventions per module.
- Inconsistent RLS strictness (some permissive policies).
- Duplicate upload/download/delete logic in UI components.
- Limited centralized telemetry for usage, failures, and downloads.
- Virus scanning is currently simulated in some flows.

## 3. Trigger vs Application-Level Management

### Option A: Database Trigger-Heavy

Pros:
- Strong automatic audit consistency on row updates/deletes.
- Hard to bypass for metadata lifecycle event creation.
- Good for enforcing bookkeeping invariants close to data.

Cons:
- Triggers cannot manage object storage upload lifecycle directly.
- Debugging and observability are harder for complex multi-step workflows.
- Heavy trigger logic can impact write throughput.

### Option B: Application-Level Orchestration

Pros:
- Clear control of upload lifecycle (session create -> upload -> finalize).
- Better integration with scanning, retries, and user-facing progress.
- Easier to evolve and test with module/service abstractions.

Cons:
- Risk of inconsistent metadata if not guarded by RPC contracts.
- Logic duplication if not centralized into one reusable module.

### Recommended Hybrid

Use **application/RPC orchestration** for upload workflow and storage actions, with **minimal triggers** only for immutable audit append behavior when metadata changes.

This gives:
- Better scalability and maintainability.
- Reliable data integrity and event traceability.
- Clear API contracts for all forms.

## 4. Target Architecture

### Storage + Metadata Split

- Binary content: Supabase Storage bucket `app-attachments`.
- Metadata and relationships: normalized PostgreSQL tables.
- Access control: RLS on metadata + storage object policies.

### Canonical Tables

- `public.file_attachments` (master table).
- `public.attachment_links` (polymorphic junction).
- `public.attachment_versions` (version lineage).
- `public.attachment_events` (audit and monitoring stream).

### Required Master Columns (as requested)

In `public.file_attachments`:
- `attachment_id`
- `file_name`
- `file_type`
- `file_size`
- `file_path`
- `uploaded_by`
- `uploaded_date`
- `is_active`

Additional columns (recommended):
- `tenant_id`, `franchise_id`
- `storage_bucket`
- `is_public`, `public_url`
- `scan_status`
- `checksum_sha256`
- `retention_until`
- `metadata`
- `updated_at`

## 5. Reusable API Contract

Standardized backend APIs (implemented as SQL RPC):
- `file_attachment_create_upload_session(...)`
- `file_attachment_finalize_upload(...)`
- `file_attachment_list_for_entity(...)`
- `file_attachment_soft_delete(...)`
- `file_attachment_record_access(...)`

Recommended frontend reusable module API:
- `upload(file, entityType, entityId, options)`
- `list(entityType, entityId, options)`
- `download(attachmentId, disposition)`
- `delete(attachmentId, reason?)`
- `validate(file, policy)`

## 6. Security Design

### Validation

- Enforce allow-list MIME and extension policy per entity/form.
- Enforce max size (global + per-entity overrides).
- Enforce filename sanitization and path normalization.

### Access Control

- Tenant/franchise isolation via `tenant_id` + `franchise_id`.
- Platform admin override through existing `public.is_platform_admin(auth.uid())`.
- Storage path prefix includes tenant folder: `tenant_id/entity_type/entity_id/...`.

### Malware Scanning

Recommended flow:
1. Upload session created with status `pending`.
2. File uploaded to storage.
3. Async scanner (Edge Function or external worker) scans file.
4. Metadata updated to `clean`/`infected`.
5. Download only allowed for `clean` (policy + API guard).

## 7. Versioning + Audit

### Versioning

- New binary revision creates a new `file_attachments` row.
- `attachment_versions` maps old/new lineage with `version_no`.
- Links can point to latest active version while keeping history.

### Audit

- `attachment_events` is append-only for lifecycle and access telemetry.
- Event types include upload, fail, scan, linked, downloaded, deleted, restored.

## 8. Performance and Scalability

### Storage and Delivery

- Prefer private buckets + signed URLs for controlled access.
- Put CDN in front for high-read workloads (short signed URL TTL).
- Optional image/document derivative generation for previews.

### Database

- Index high-frequency predicates:
  - `tenant_id`
  - `(entity_type, entity_id)`
  - `uploaded_date`
  - `is_active`
  - `scan_status`
- Keep events append-only and partition later if volume grows.

### Upload Optimization

- Chunked/resumable uploads for large files (future enhancement).
- Client-side compression for images where acceptable.
- Asynchronous scanning and non-blocking post-processing.

## 9. UX Consistency Standards

All forms should share one attachment component behavior:
- Multiple file support.
- Standard drag/drop + file picker.
- Uniform progress states (queued/uploading/scanning/ready/failed).
- Uniform error messages and retry actions.
- Consistent preview/download/delete controls.

## 10. Migration Strategy for Existing Forms

Phased adoption:
1. Keep existing form tables running.
2. Backfill metadata into new canonical tables.
3. Switch forms to generic APIs.
4. Deprecate old module-specific attachment writes.

Initial migration targets:
- `shipment_attachments`
- `commodity_documents`
- `vendor_documents`

## 11. Testing Strategy

### Unit Tests

- File validation service:
  - MIME allow-list.
  - max-size enforcement.
  - filename sanitization.
- API service:
  - upload session request payload.
  - finalize and delete error handling.

### Integration Tests

- End-to-end upload flow:
  - create session -> storage upload -> finalize -> list.
- Tenant isolation checks:
  - cross-tenant access denied.
- Delete flow:
  - soft delete metadata + link deactivation + event append.

### Security Tests

- Verify signed URL generation denied for inactive or infected files.
- Verify storage policy rejects path with mismatched tenant prefix.

## 12. Operational Monitoring

Track:
- upload success/failure rates by tenant and module.
- scanning SLA and scan backlog.
- download counts and hot files.
- storage growth by tenant.
- orphaned storage objects vs metadata drift.

Recommended alerts:
- upload failure rate > threshold.
- scan pending backlog beyond SLA.
- abrupt storage growth anomalies.

## 13. Deliverables Added in This Change Set

- Generic schema + APIs migration:
  - `supabase/migrations/20260422133000_generic_file_attachment_platform_module.sql`
- Existing-forms migration helper:
  - `supabase/migrations/20260422134000_migrate_existing_form_attachments_to_generic_module.sql`
- Reusable TypeScript module skeleton:
  - `src/modules/shared/file-attachments/types.ts`
  - `src/modules/shared/file-attachments/api.ts`
  - `src/modules/shared/file-attachments/index.ts`

## 14. Mobile App Compatibility (Required)

The generic attachment module is designed to work for web and mobile clients using the same backend contracts.

### Mobile-Compatible Upload Strategy

- Keep the same RPC flow:
  - `file_attachment_create_upload_session`
  - upload binary to Supabase Storage (`bucket + path`)
  - `file_attachment_finalize_upload`
- Do not require browser-only `File` APIs in service contracts.
- Accept binary inputs from mobile SDK layers:
  - `Blob`
  - `ArrayBuffer`
  - `Uint8Array`

### React Native Guidance

- Pick file via `expo-document-picker` or `react-native-document-picker`.
- Convert URI to binary (`fetch(uri).arrayBuffer()` in Expo, or native bridge helpers).
- Call shared attachment service APIs and upload bytes.
- Use signed URLs from storage for secure download and preview.

### Flutter Guidance

- Use `file_picker` to obtain bytes.
- Upload bytes to Supabase Storage path returned by upload session.
- Finalize upload through RPC and track access through RPC.

### Mobile UX and Resilience Requirements

- Queue uploads when offline and auto-retry on reconnect.
- Support cancellable uploads and resumable uploads for large files (phase-2).
- Keep uniform status badges: `pending`, `uploading`, `scanning`, `ready`, `failed`.
- Enforce same MIME and size validation rules client-side and server-side.
