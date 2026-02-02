# Vendor Document & Contract Upload API

## Overview
This document outlines the API and architecture for the Vendor Document Management system, including file uploads, versioning, folder organization, and security features.

## Architecture
- **Storage:** Supabase Storage (Bucket: `vendor-documents`)
- **Database:** PostgreSQL (Tables: `vendor_documents`, `vendor_contracts`, `vendor_contract_versions`, `vendor_folders`)
- **Security:** RLS Policies, Signed URLs for access, Virus Scanning (Mocked/Placeholder)
- **Frontend:** React + Supabase Client

## Endpoints (RPC / Storage)

### 1. Upload File
Files are uploaded directly to Supabase Storage using the standard Supabase Client SDK.
**Path Pattern:** `{vendor_id}/{file_name}`

**Client Code:**
```typescript
const { data, error } = await supabase.storage
  .from('vendor-documents')
  .upload(`${vendorId}/${file.name}`, file);
```

### 2. Create Document Metadata
After successful upload, metadata must be inserted into `vendor_documents`.

**Table:** `vendor_documents`
**Payload:**
```json
{
  "vendor_id": "uuid",
  "type": "insurance",
  "name": "Liability Insurance 2026",
  "file_path": "vendor_id/file_name.pdf",
  "file_size": 1048576,
  "mime_type": "application/pdf",
  "folder_id": "uuid (optional)",
  "tags": ["insurance", "2026"],
  "expiry_date": "2026-12-31"
}
```

### 3. Contract Versioning
Contracts support versioning. When updating a contract, a new version is created in `vendor_contract_versions`.

**Table:** `vendor_contract_versions`
**Payload:**
```json
{
  "contract_id": "uuid",
  "version_number": 2,
  "file_path": "vendor_id/contracts/v2_contract.pdf",
  "file_name": "contract_v2.pdf",
  "file_size": 2048576,
  "mime_type": "application/pdf",
  "uploaded_by": "user_uuid"
}
```

### 4. Folder Management
Folders allow organizing documents within a vendor.

**Table:** `vendor_folders`
**Payload (Create):**
```json
{
  "vendor_id": "uuid",
  "name": "Legal Documents",
  "parent_id": "uuid (optional)",
  "permissions": {"read": ["*"], "write": ["admin"]}
}
```

### 5. Quota Management
Storage usage is tracked in `vendor_storage_usage`.
**Limit:** 1GB per vendor.

**Check Usage (RPC):**
```sql
SELECT * FROM public.check_vendor_storage_quota(vendor_uuid, file_size_bytes);
```
Returns `true` if upload is allowed, `false` otherwise.

## Security Features

### Virus Scanning
- **Status:** Pending, Clean, Infected, Skipped.
- **Mechanism:** Files are initially marked as `pending`. An asynchronous process (currently mocked via trigger) scans the file and updates the status.
- **UI:** Infected files are flagged and download is restricted (future implementation).

### Expiration Alerts
- **Logic:** Contracts and Documents expiring within 30 days trigger an alert in the UI.
- **Field:** `expiry_date` (Documents), `end_date` (Contracts).

### Access Control
- **RLS:**
  - `vendor_documents`: Visible to Vendor Owner & Tenant Admins.
  - `vendor_contract_versions`: Visible to Vendor Owner & Tenant Admins.
  - `vendor_folders`: Visible to Vendor Owner & Tenant Admins.

## Testing
- **Unit Tests:** `src/pages/dashboard/vendors/__tests__/VendorDetail.test.tsx`
- **Integration Tests:** `scripts/verify_vendor_storage_features.ts`

