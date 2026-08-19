# CRM Audit Features - Design Specification

**Date:** 2026-08-19  
**Scope:** Comprehensive CRM audit logging and tracking system  
**Timeline:** 7 days (Phases 1-4)

## 1. Overview

Implement comprehensive CRM audit features to track all changes to leads, contacts, opportunities, quotes, and interactions. Provides compliance-grade audit trails with real-time dashboards, searchable history, and export capabilities.

## 2. Architecture

### High-Level Flow
```
CRM Operations (leads, contacts, deals, quotes)
        ↓
   Audit Hooks (intercept changes)
        ↓
   CRMAuditService + Diff computation
        ↓
   crm_audit_logs table (Supabase)
        ↓
   UI Layer:
   ├── History panels (side panels on entity details)
   ├── CRM Audit Dashboard (dedicated page)
   └── Real-time subscriptions (live updates)
```

### Design Principles
- **Non-blocking:** Audit failures never block CRM operations
- **Real-time:** Live subscriptions for dashboard and history panels
- **Tenant-scoped:** RLS ensures users only see their tenant's data
- **Event-driven:** Every significant CRM action triggers an audit log entry
- **Diff-tracked:** Store old/new values for all field changes

## 3. Database Schema

### Primary Table: `crm_audit_logs`

```sql
CREATE TABLE crm_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  user_id UUID NOT NULL,
  
  -- Event metadata
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'move', 'approve', 'view', 'reject'
  entity_type VARCHAR(50) NOT NULL, -- 'lead', 'contact', 'opportunity', 'quote', 'interaction'
  entity_id UUID NOT NULL,
  
  -- Related entity (for relationships)
  related_entity_id UUID,
  related_entity_type VARCHAR(50),
  
  -- Change tracking
  old_values JSONB, -- previous state for update/delete
  new_values JSONB, -- current state for create/update
  changed_fields TEXT[], -- array of field names that changed
  
  -- Event-specific context
  metadata JSONB, -- {stage_from: 'Lead', stage_to: 'Qualified', interaction_type: 'call', etc.}
  
  -- Timestamps & source
  created_at TIMESTAMP DEFAULT NOW(),
  user_email TEXT, -- denormalized for quick reference
  user_name TEXT, -- denormalized for quick reference
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for query performance
CREATE INDEX idx_crm_audit_tenant_created ON crm_audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_crm_audit_entity ON crm_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_crm_audit_user ON crm_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_crm_audit_action ON crm_audit_logs(action, created_at DESC);

-- Row Level Security
ALTER TABLE crm_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's audit logs"
  ON crm_audit_logs FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM auth.jwt()->>'tenant_id')::uuid);
```

### Event Type Reference Table (optional, for UI)

```sql
CREATE TABLE crm_audit_event_types (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(100) UNIQUE NOT NULL,
  entity_type VARCHAR(50),
  description TEXT,
  color_badge VARCHAR(20) -- 'green', 'blue', 'red', 'orange', 'purple'
);

INSERT INTO crm_audit_event_types (event_name, entity_type, description, color_badge) VALUES
('lead_created', 'lead', 'New lead created', 'green'),
('lead_updated', 'lead', 'Lead information updated', 'blue'),
('lead_deleted', 'lead', 'Lead deleted', 'red'),
('contact_created', 'contact', 'New contact created', 'green'),
('contact_interaction', 'interaction', 'Call, email, or meeting logged', 'orange'),
('opportunity_moved', 'opportunity', 'Opportunity moved to different stage', 'orange'),
('quote_created', 'quote', 'New quote created', 'green'),
('quote_approved', 'quote', 'Quote approved by manager', 'purple'),
('data_corrected', 'lead', 'Data correction applied', 'blue');
```

## 4. Service Layer: CRMAuditService

### Location
`src/lib/crm-audit.ts`

### Interface

```typescript
export interface CRMAuditLogEntry {
  action: string;
  entity_type: string;
  entity_id: string;
  related_entity_id?: string;
  related_entity_type?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  changed_fields?: string[];
  metadata?: Record<string, any>;
  tenant_id: string;
  franchise_id?: string;
}

export class CRMAuditService {
  static getInstance(): CRMAuditService;
  initialize(supabase: SupabaseClient): void;
  
  // Lead operations
  async logLeadCreated(leadId: string, values: Record<string, any>, tenantId: string): Promise<void>;
  async logLeadUpdated(leadId: string, oldValues: Record<string, any>, newValues: Record<string, any>, tenantId: string): Promise<void>;
  async logLeadDeleted(leadId: string, values: Record<string, any>, tenantId: string): Promise<void>;
  
  // Contact operations
  async logContactCreated(contactId: string, leadId: string, values: Record<string, any>, tenantId: string): Promise<void>;
  async logContactUpdated(contactId: string, oldValues: Record<string, any>, newValues: Record<string, any>, tenantId: string): Promise<void>;
  async logContactInteraction(contactId: string, type: 'call' | 'email' | 'meeting', details: Record<string, any>, tenantId: string): Promise<void>;
  
  // Opportunity operations
  async logOpportunityCreated(opportunityId: string, leadId: string, values: Record<string, any>, tenantId: string): Promise<void>;
  async logPipelineMove(opportunityId: string, fromStage: string, toStage: string, tenantId: string): Promise<void>;
  async logOpportunityUpdated(opportunityId: string, oldValues: Record<string, any>, newValues: Record<string, any>, tenantId: string): Promise<void>;
  
  // Quote operations
  async logQuoteCreated(quoteId: string, opportunityId: string, values: Record<string, any>, tenantId: string): Promise<void>;
  async logQuoteUpdated(quoteId: string, oldValues: Record<string, any>, newValues: Record<string, any>, tenantId: string): Promise<void>;
  async logQuoteApproved(quoteId: string, tenantId: string): Promise<void>;
  async logQuoteRejected(quoteId: string, reason: string, tenantId: string): Promise<void>;
  
  // Data corrections
  async logDataCorrection(entityType: string, entityId: string, changes: Record<string, any>, reason: string, tenantId: string): Promise<void>;
  
  // Internal: Compute diffs
  private computeDiff(oldValues: Record<string, any>, newValues: Record<string, any>): { changed_fields: string[], old_values: Record<string, any>, new_values: Record<string, any> };
  
  // Internal: Add user context
  private async addUserContext(entry: CRMAuditLogEntry): Promise<CRMAuditLogEntry>;
}
```

### Error Handling
- All methods are non-blocking: if logging fails, it logs warning but doesn't throw
- Failed logs queued for retry (background task)
- Errors caught and logged via `logger.warn()` or `logger.error()`

## 5. Frontend Components

### 5.1 CRMAuditHistoryPanel

**Location:** `src/components/crm/audit/CRMAuditHistoryPanel.tsx`

**Props:**
```typescript
interface CRMAuditHistoryPanelProps {
  entityType: 'lead' | 'contact' | 'opportunity' | 'quote';
  entityId: string;
  tenantId: string;
  maxItems?: number; // default 10
}
```

**Features:**
- Display last N audit entries for an entity
- Real-time subscription to new entries
- Color-coded action badges
- User avatar + email
- Timestamp
- Expandable diff view (old → new values)
- Click user name to filter by that user's activity

### 5.2 CRMAuditDashboard

**Location:** `src/pages/crm/CRMAuditDashboard.tsx`

**Features:**
- Timeline view of all CRM events
- Filters:
  - Date range picker
  - Entity type dropdown (lead, contact, opportunity, quote, interaction)
  - Action type (create, update, delete, move, approve)
  - User selector (autocomplete)
  - Search box (entity name/id)
- Sorting: By date (default), by action type, by user
- Columns: Timestamp, User, Action, Entity, Changes, Metadata
- Export to CSV (filtered results)
- Live feed (toggle to show real-time updates)
- Statistics panel (events by type, top active users)

### 5.3 useCRMAuditTrail Hook

**Location:** `src/hooks/useCRMAuditTrail.ts`

**Functionality:**
```typescript
interface CRMAuditTrailOptions {
  entityType?: string;
  entityId?: string;
  limit?: number;
  orderBy?: 'created_at' | 'action';
}

function useCRMAuditTrail(options: CRMAuditTrailOptions) {
  // Returns: { data, loading, error, refetch }
  // Automatically subscribes to real-time changes
}
```

### 5.4 CRMAuditEventBadge

**Location:** `src/components/crm/audit/CRMAuditEventBadge.tsx`

**Props:**
```typescript
interface CRMAuditEventBadgeProps {
  action: string;
  size?: 'sm' | 'md' | 'lg';
}
```

**Color mapping:**
- `create` → green
- `update` → blue
- `delete` → red
- `move` → orange
- `approve` → purple
- `reject` → pink
- `view` → gray

## 6. Integration Points

### 6.1 Lead Service (Backend)

**File:** `services/crm-api/src/leads.ts`

Hook into:
- `POST /leads` → call `CRMAuditService.logLeadCreated()`
- `PUT /leads/:id` → call `CRMAuditService.logLeadUpdated()`
- `DELETE /leads/:id` → call `CRMAuditService.logLeadDeleted()`

### 6.2 Contact Service (Backend)

**File:** `services/crm-api/src/contacts.ts`

Hook into:
- `POST /contacts` → call `CRMAuditService.logContactCreated()`
- `PUT /contacts/:id` → call `CRMAuditService.logContactUpdated()`
- `POST /contacts/:id/interactions` → call `CRMAuditService.logContactInteraction()`

### 6.3 Opportunity/Pipeline Service (Backend)

**File:** `services/crm-api/src/opportunities.ts`

Hook into:
- `POST /opportunities` → call `CRMAuditService.logOpportunityCreated()`
- `PUT /opportunities/:id/stage` → call `CRMAuditService.logPipelineMove()`
- `PUT /opportunities/:id` → call `CRMAuditService.logOpportunityUpdated()`

### 6.4 Quote Service (Backend)

**File:** `services/crm-api/src/quotes.ts`

Hook into:
- `POST /quotes` → call `CRMAuditService.logQuoteCreated()`
- `PUT /quotes/:id` → call `CRMAuditService.logQuoteUpdated()`
- `PUT /quotes/:id/approve` → call `CRMAuditService.logQuoteApproved()`

### 6.5 Frontend Integration

Add history panels to:
- Lead detail page: `src/pages/crm/LeadDetailPage.tsx`
- Contact detail page: `src/pages/crm/ContactDetailPage.tsx`
- Opportunity detail page: `src/pages/crm/OpportunityDetailPage.tsx`
- Quote detail page: `src/pages/crm/QuoteDetailPage.tsx`

Add route to CRM module:
- `GET /crm/audit` → `CRMAuditDashboard`

## 7. Real-Time Updates

### Subscription Pattern

```typescript
const channel = supabase
  .channel(`crm_audit_${entityType}_${entityId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'crm_audit_logs',
    filter: `entity_id=eq.${entityId}`
  }, (payload) => {
    // Append new entry to history
    setHistory(prev => [payload.new, ...prev])
  })
  .subscribe();
```

For dashboard (all tenant events):
```typescript
const channel = supabase
  .channel(`crm_audit_tenant_${tenantId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'crm_audit_logs',
    filter: `tenant_id=eq.${tenantId}`
  }, (payload) => {
    // Prepend to live feed
    setLiveFeed(prev => [payload.new, ...prev])
  })
  .subscribe();
```

## 8. Implementation Phases

### Phase 1: Foundation (Days 1-2)
- [ ] Create `crm_audit_logs` table with RLS
- [ ] Create `CRMAuditService` class
- [ ] Add audit logging to lead operations (create/update/delete)
- [ ] Test: Verify logs are written to database

### Phase 2: History UI (Days 3-4)
- [ ] Build `useCRMAuditTrail` hook
- [ ] Build `CRMAuditHistoryPanel` component
- [ ] Build `CRMAuditEventBadge` component
- [ ] Add history panels to lead/contact/opportunity detail pages
- [ ] Test: Verify real-time subscription works

### Phase 3: Dashboard & Advanced (Days 5-6)
- [ ] Build `CRMAuditDashboard` page with filters and search
- [ ] Add export to CSV functionality
- [ ] Add statistics panel
- [ ] Add audit logging for contacts, opportunities, quotes
- [ ] Test: Verify all entity types log correctly

### Phase 4: Polish & Testing (Day 7)
- [ ] Integration testing (end-to-end audit flow)
- [ ] Performance testing (query optimization)
- [ ] Real-time subscription testing
- [ ] Error handling & retry logic
- [ ] Documentation

## 9. Error Handling & Safety

### Non-Blocking Audit
- All audit service calls wrapped in try-catch
- Errors logged via `logger.warn()` or `logger.error()`
- Never throw or reject in audit operations
- CRM operations continue even if audit fails

### Retry Logic
- Failed audit logs stored in retry queue
- Background job checks queue every 5 minutes
- Retry up to 3 times before logging as failed

### Fallback for Supabase Downtime
- If Supabase unreachable, store audit entries in-memory (IndexedDB)
- Sync to database when connection restored
- Alert user that audit may be delayed

## 10. Testing Strategy

### Unit Tests
- CRMAuditService methods (diff computation, entry creation)
- Hook logic (fetch, subscribe, unsubscribe)

### Integration Tests
- Lead create → audit log created
- Lead update with field changes → old/new values captured
- Real-time subscription receives new entries
- RLS policy enforces tenant isolation

### E2E Tests
- Full audit flow: create lead → verify in history panel → verify in dashboard
- Filter and search functionality
- Export to CSV

## 11. Success Criteria

- ✅ All CRM operations are audited (leads, contacts, opportunities, quotes, interactions)
- ✅ History panels appear on entity detail pages with real-time updates
- ✅ Dashboard shows all events with filtering, search, and export
- ✅ RLS enforces tenant data isolation
- ✅ Audit failures never block CRM operations
- ✅ Performance: Dashboard loads within 2 seconds for 10k+ log entries

## 12. Future Enhancements

- Analytics dashboard (audit trends, anomaly detection)
- Audit log retention policies (archive old logs)
- Webhook notifications on critical changes
- Machine learning: Detect unusual patterns
- Bulk operations audit (batch imports)
