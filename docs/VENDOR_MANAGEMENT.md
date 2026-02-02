# Vendor Management Module Documentation

## Overview
The Vendor Management Module provides comprehensive capabilities for managing vendor relationships, contracts, and documents. Key features include folder-based organization, storage quota management, file versioning, and compliance audit logging.

## Features

### 1. Document Management
- **Folder Organization**: Documents and contracts can be organized into folders (e.g., "Contracts", "Compliance", "Financials").
- **Drag-and-Drop Upload**: Supports drag-and-drop file uploads with progress indicators.
- **Storage Quotas**: 
  - Each vendor is allocated a 1GB storage quota.
  - Quota usage is tracked and displayed in the Vendor Detail view.
  - Uploads are blocked if the quota is exceeded.
- **Virus Scanning**: Simulated virus scanning for uploaded documents with status tracking (Pending -> Clean/Infected).

### 2. Contract Management
- **Versioning**: Contracts support version control. New uploads create new version records (`vendor_contract_versions`).
- **Metadata**: Tracks start/end dates, values, currency, and status.
- **Renewal Tracking**: Automated alerts for expiring contracts (30-day warning).

### 3. Compliance & Audit
- **Audit Logging**: 
  - Application-level logging for sensitive actions (Upload, Delete, Create Contract) via `system_logs`.
  - Database-level triggers for row changes.
- **Data Retention**: 
  - `expiry_date` tracking for documents.
  - Expiration alerts in the UI.

## Architecture

### Database Schema
- **`vendors`**: Core vendor record.
- **`vendor_folders`**: Folder structure (Vendor <-> Folders).
- **`vendor_documents`**: General documents with `folder_id` and `virus_scan_status`.
- **`vendor_contracts`**: Contract metadata.
- **`vendor_contract_versions`**: File versions for contracts.

### Security
- **Row Level Security (RLS)**:
  - Vendors can only be accessed by authorized roles.
  - Folders and documents inherit vendor permissions.
- **Storage Security**:
  - Signed URLs for secure file access (1-hour expiration).
  - Path-based isolation (`vendor_id/folder_id/filename`).

## Testing
- **Unit Tests**:
  - `VendorDetail.test.tsx`: Verifies UI rendering and interaction.
  - `VendorDocumentDialog.test.tsx`: Verifies form validation and submission logic.
- **Integration**:
  - Validated with Supabase local environment.

## API Usage

### Upload Document
```typescript
const { data, error } = await supabase.storage
  .from('vendor-documents')
  .upload(`${vendorId}/${fileName}`, file);
```

### Check Quota
```typescript
const isAvailable = await supabase.rpc('check_vendor_storage_quota', {
  p_vendor_id: vendorId,
  p_new_bytes: fileSize
});
```
