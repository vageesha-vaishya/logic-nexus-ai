# CRM Audit Guide

## Overview
The CRM audit system tracks all changes to leads, contacts, opportunities, and quotes.

## Features
- Real-time audit logging (non-blocking)
- History panels on entity detail pages
- Comprehensive audit dashboard with filtering and export
- Tenant-scoped data with RLS

## How to Use

### View Entity History
Go to any lead/contact/opportunity detail page. The audit history panel on the right shows recent changes.

### Search All Changes
Navigate to `/crm/audit-dashboard` to search and filter all CRM changes.

### Export Audit Logs
On the dashboard, click "Export CSV" to download filtered results.

## For Developers

### Adding Audit Logging to New Operations
```typescript
import { auditService } from '@/lib/crm-audit';

// After creating an entity
await auditService.logLeadCreated(leadId, leadData, tenantId);

// After updating
await auditService.logLeadUpdated(leadId, oldData, newData, tenantId);
```

### Querying Audit Logs
Use the `useCRMAuditTrail` hook:
```typescript
const { data, loading } = useCRMAuditTrail({
  entityType: 'lead',
  entityId: 'lead-123'
});
```

## Architecture
- Backend: `CRMAuditService` (singleton)
- Frontend: `useCRMAuditTrail` hook + `CRMAuditHistoryPanel` component
- Database: `crm_audit_logs` table with RLS
