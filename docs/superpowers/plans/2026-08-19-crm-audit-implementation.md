# CRM Audit Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build comprehensive CRM audit logging system with real-time dashboards, searchable history panels, and compliance-grade event tracking across all CRM entities.

**Architecture:** 
- Database layer: `crm_audit_logs` table with RLS and optimized indexes
- Service layer: `CRMAuditService` singleton for non-blocking event logging
- Frontend layer: `useCRMAuditTrail` hook with real-time subscriptions + `CRMAuditHistoryPanel` for entity details + `CRMAuditDashboard` for comprehensive audit view
- Integration: Audit hooks in backend CRM services (leads, contacts, opportunities, quotes)

**Tech Stack:** 
- Backend: Express.js, TypeScript, Supabase
- Frontend: React 18, TanStack Query, Supabase real-time subscriptions, shadcn/ui
- Database: PostgreSQL (Supabase)
- Testing: Vitest (unit), playwright (E2E)

## Global Constraints

- Non-blocking audit: Failures never block CRM operations
- Tenant-scoped: RLS enforces data isolation
- Type-safe: Full TypeScript throughout
- Follow existing patterns: Match AMRO/quotation audit implementations
- Performance: Dashboard loads in <2s for 10k+ logs
- No external dependencies: Use existing shadcn/ui, Supabase, TanStack Query

---

## Phase 1: Foundation (Days 1-2)

### File Structure

```
Backend (services/crm-api/):
- src/lib/crm-audit.ts (NEW) - CRMAuditService class
- src/services/audit/ (NEW)
  - leads.ts - Lead audit hooks
  - contacts.ts - Contact audit hooks  
  - opportunities.ts - Opportunity audit hooks
  - quotes.ts - Quote audit hooks

Database (supabase/):
- migrations/YYYYMMDD_create_crm_audit_logs.sql (NEW)

Tests:
- tests/unit/lib/crm-audit.test.ts (NEW)
- tests/unit/services/audit/leads.test.ts (NEW)
```

### Task 1: Create Database Migration

**Files:**
- Create: `supabase/migrations/<timestamp>_create_crm_audit_logs.sql`

**Interfaces:**
- Produces: `crm_audit_logs` table with proper schema, indexes, RLS

- [ ] **Step 1: Create migration file**

```bash
# Create file with current timestamp
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_create_crm_audit_logs.sql
```

- [ ] **Step 2: Write table creation SQL**

```sql
-- File: supabase/migrations/20260819000000_create_crm_audit_logs.sql

-- Create table
CREATE TABLE crm_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  user_id UUID,
  
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  
  related_entity_id UUID,
  related_entity_type VARCHAR(50),
  
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP DEFAULT NOW(),
  user_email TEXT,
  user_name TEXT,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_crm_audit_tenant_created 
  ON crm_audit_logs(tenant_id, created_at DESC);

CREATE INDEX idx_crm_audit_entity 
  ON crm_audit_logs(entity_type, entity_id, created_at DESC);

CREATE INDEX idx_crm_audit_user 
  ON crm_audit_logs(user_id, created_at DESC);

CREATE INDEX idx_crm_audit_action 
  ON crm_audit_logs(action, created_at DESC);

-- Enable RLS
ALTER TABLE crm_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users see only their tenant's logs
CREATE POLICY "Users can view their tenant's audit logs"
  ON crm_audit_logs FOR SELECT
  USING (
    tenant_id = (
      SELECT tenant_id FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert audit logs"
  ON crm_audit_logs FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON crm_audit_logs TO authenticated;
GRANT INSERT ON crm_audit_logs TO service_role;
```

- [ ] **Step 3: Apply migration**

```bash
npm run supabase:db:push
```

Expected: Migration succeeds, table created with indexes

- [ ] **Step 4: Verify in Supabase**

Check: `supabase/migrations/` directory contains the migration file

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): create crm_audit_logs table with RLS"
```

---

### Task 2: Create CRMAuditService Class

**Files:**
- Create: `src/lib/crm-audit.ts`

**Interfaces:**
- Consumes: Supabase client (via initialization)
- Produces: 
  ```typescript
  class CRMAuditService {
    static getInstance(): CRMAuditService
    initialize(supabase: SupabaseClient): void
    async logLeadCreated(leadId: string, values: Record<string, any>, tenantId: string): Promise<void>
    async logLeadUpdated(leadId: string, oldValues: Record<string, any>, newValues: Record<string, any>, tenantId: string): Promise<void>
    async logLeadDeleted(leadId: string, values: Record<string, any>, tenantId: string): Promise<void>
    private computeDiff(oldValues: Record<string, any>, newValues: Record<string, any>): { changed_fields: string[], old_values: Record<string, any>, new_values: Record<string, any> }
    private async addUserContext(entry: CRMAuditLogEntry): Promise<CRMAuditLogEntry>
  }
  ```

- [ ] **Step 1: Write test for CRMAuditService**

```typescript
// File: tests/unit/lib/crm-audit.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CRMAuditService } from '@/lib/crm-audit';
import { createClient } from '@supabase/supabase-js';

describe('CRMAuditService', () => {
  let auditService: CRMAuditService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null })
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null
        })
      }
    };

    auditService = CRMAuditService.getInstance();
    auditService.initialize(mockSupabase);
  });

  it('should log lead creation', async () => {
    const leadData = { name: 'Test Lead', email: 'lead@example.com' };
    
    await auditService.logLeadCreated('lead-123', leadData, 'tenant-123');

    expect(mockSupabase.from).toHaveBeenCalledWith('crm_audit_logs');
    expect(mockSupabase.from().insert).toHaveBeenCalled();
  });

  it('should compute diff on update', async () => {
    const oldValues = { name: 'Old Name', email: 'old@example.com' };
    const newValues = { name: 'New Name', email: 'old@example.com' };

    await auditService.logLeadUpdated('lead-123', oldValues, newValues, 'tenant-123');

    const call = mockSupabase.from().insert.mock.calls[0][0];
    expect(call[0].changed_fields).toContain('name');
    expect(call[0].changed_fields).not.toContain('email');
  });

  it('should handle errors gracefully', async () => {
    mockSupabase.from().insert.mockResolvedValueOnce({ 
      data: null, 
      error: new Error('Database error') 
    });

    // Should not throw
    await expect(
      auditService.logLeadCreated('lead-123', {}, 'tenant-123')
    ).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- tests/unit/lib/crm-audit.test.ts
```

Expected: FAIL - "Cannot find module '@/lib/crm-audit'"

- [ ] **Step 3: Implement CRMAuditService**

```typescript
// File: src/lib/crm-audit.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

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
  private static instance: CRMAuditService;
  private supabase: SupabaseClient | null = null;

  private constructor() {}

  static getInstance(): CRMAuditService {
    if (!CRMAuditService.instance) {
      CRMAuditService.instance = new CRMAuditService();
    }
    return CRMAuditService.instance;
  }

  initialize(supabase: SupabaseClient): void {
    this.supabase = supabase;
  }

  async logLeadCreated(
    leadId: string,
    values: Record<string, any>,
    tenantId: string,
    franchiseId?: string
  ): Promise<void> {
    await this.log({
      action: 'create',
      entity_type: 'lead',
      entity_id: leadId,
      new_values: values,
      changed_fields: Object.keys(values),
      tenant_id: tenantId,
      franchise_id: franchiseId
    });
  }

  async logLeadUpdated(
    leadId: string,
    oldValues: Record<string, any>,
    newValues: Record<string, any>,
    tenantId: string,
    franchiseId?: string
  ): Promise<void> {
    const { changed_fields, old_values, new_values } = this.computeDiff(oldValues, newValues);

    if (changed_fields.length === 0) return; // No changes

    await this.log({
      action: 'update',
      entity_type: 'lead',
      entity_id: leadId,
      old_values,
      new_values,
      changed_fields,
      tenant_id: tenantId,
      franchise_id: franchiseId
    });
  }

  async logLeadDeleted(
    leadId: string,
    values: Record<string, any>,
    tenantId: string,
    franchiseId?: string
  ): Promise<void> {
    await this.log({
      action: 'delete',
      entity_type: 'lead',
      entity_id: leadId,
      old_values: values,
      changed_fields: Object.keys(values),
      tenant_id: tenantId,
      franchise_id: franchiseId
    });
  }

  private computeDiff(
    oldValues: Record<string, any>,
    newValues: Record<string, any>
  ): { changed_fields: string[]; old_values: Record<string, any>; new_values: Record<string, any> } {
    const changed_fields: string[] = [];
    const old_values: Record<string, any> = {};
    const new_values_result: Record<string, any> = {};

    const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

    for (const key of allKeys) {
      if (oldValues[key] !== newValues[key]) {
        changed_fields.push(key);
        old_values[key] = oldValues[key];
        new_values_result[key] = newValues[key];
      }
    }

    return { changed_fields, old_values, new_values: new_values_result };
  }

  private async log(entry: CRMAuditLogEntry): Promise<void> {
    if (!this.supabase) {
      logger.warn('CRMAuditService not initialized');
      return;
    }

    try {
      const entryWithContext = await this.addUserContext(entry);

      const { error } = await this.supabase
        .from('crm_audit_logs')
        .insert([entryWithContext]);

      if (error) {
        logger.warn('Failed to log audit entry:', error);
        // TODO: Queue for retry
      }
    } catch (error) {
      logger.error('CRMAuditService error:', error);
      // Never throw - audit failures are non-blocking
    }
  }

  private async addUserContext(entry: CRMAuditLogEntry): Promise<Record<string, any>> {
    try {
      const { data: { user } } = await this.supabase!.auth.getUser();

      return {
        ...entry,
        user_id: user?.id,
        user_email: user?.email,
        user_name: user?.user_metadata?.full_name || user?.email,
        created_at: new Date().toISOString()
      };
    } catch (error) {
      logger.warn('Failed to get user context:', error);
      return {
        ...entry,
        created_at: new Date().toISOString()
      };
    }
  }
}

export const auditService = CRMAuditService.getInstance();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- tests/unit/lib/crm-audit.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/crm-audit.ts tests/unit/lib/crm-audit.test.ts
git commit -m "feat(audit): Create CRMAuditService with lead logging"
```

---

### Task 3: Add Audit Logging to Lead Operations (Backend)

**Files:**
- Modify: `services/crm-api/src/routes/leads.ts` (or wherever lead routes are)
- Create: `services/crm-api/src/services/audit/leads.ts`

**Interfaces:**
- Consumes: `CRMAuditService` class, existing lead service methods
- Produces: Lead operations that call audit service before returning

- [ ] **Step 1: Create audit service hooks for leads**

```typescript
// File: services/crm-api/src/services/audit/leads.ts

import { auditService } from '@/lib/crm-audit';
import { logger } from '@/lib/logger';

export async function auditLeadCreated(
  leadId: string,
  leadData: Record<string, any>,
  tenantId: string,
  franchiseId?: string
): Promise<void> {
  try {
    await auditService.logLeadCreated(leadId, leadData, tenantId, franchiseId);
  } catch (error) {
    logger.warn('Failed to audit lead creation:', error);
  }
}

export async function auditLeadUpdated(
  leadId: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  tenantId: string,
  franchiseId?: string
): Promise<void> {
  try {
    await auditService.logLeadUpdated(leadId, oldData, newData, tenantId, franchiseId);
  } catch (error) {
    logger.warn('Failed to audit lead update:', error);
  }
}

export async function auditLeadDeleted(
  leadId: string,
  leadData: Record<string, any>,
  tenantId: string,
  franchiseId?: string
): Promise<void> {
  try {
    await auditService.logLeadDeleted(leadId, leadData, tenantId, franchiseId);
  } catch (error) {
    logger.warn('Failed to audit lead deletion:', error);
  }
}
```

- [ ] **Step 2: Integrate audit into lead endpoints**

Modify the lead routes file (exact path varies by project):

```typescript
// Find your lead creation endpoint and modify it like this:
// Before: res.json(newLead)
// After: Call audit, then return

import { auditLeadCreated } from '@/services/audit/leads';

app.post('/leads', async (req, res) => {
  const { name, email, phone, tenant_id, franchise_id } = req.body;

  // Create lead in database (existing code)
  const newLead = await leadsService.create({
    name,
    email,
    phone,
    tenant_id,
    franchise_id
  });

  // Add audit logging
  await auditLeadCreated(
    newLead.id,
    { name, email, phone },
    tenant_id,
    franchise_id
  );

  res.json(newLead);
});

// Similar for update
app.put('/leads/:id', async (req, res) => {
  const leadId = req.params.id;
  const { name, email, phone, tenant_id, franchise_id } = req.body;

  // Get old data
  const oldLead = await leadsService.getById(leadId);

  // Update lead
  const updatedLead = await leadsService.update(leadId, {
    name,
    email,
    phone
  });

  // Add audit logging
  await auditLeadUpdated(
    leadId,
    { name: oldLead.name, email: oldLead.email, phone: oldLead.phone },
    { name, email, phone },
    tenant_id,
    franchise_id
  );

  res.json(updatedLead);
});

// Similar for delete
app.delete('/leads/:id', async (req, res) => {
  const leadId = req.params.id;
  const { tenant_id, franchise_id } = req.body;

  // Get data before deletion
  const lead = await leadsService.getById(leadId);

  // Delete lead
  await leadsService.delete(leadId);

  // Add audit logging
  await auditLeadDeleted(
    leadId,
    lead,
    tenant_id,
    franchise_id
  );

  res.json({ success: true });
});
```

- [ ] **Step 3: Test audit logging manually**

```bash
# Start dev server
npm run dev

# Make a POST request to create a lead
curl -X POST http://localhost:3011/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Lead",
    "email": "test@example.com",
    "tenant_id": "tenant-123"
  }'

# Check Supabase: Select from crm_audit_logs
# Should see one entry with action='create', entity_type='lead'
```

- [ ] **Step 4: Commit**

```bash
git add services/crm-api/src/services/audit/leads.ts
git add services/crm-api/src/routes/leads.ts  # or wherever you modified it
git commit -m "feat(audit): Add audit logging to lead operations"
```

---

### Task 4: Initialize CRMAuditService in App Startup

**Files:**
- Modify: `src/main.tsx` or app initialization file

**Interfaces:**
- Consumes: `CRMAuditService`, existing Supabase client
- Produces: Initialized audit service available globally

- [ ] **Step 1: Initialize in app startup**

```typescript
// File: src/main.tsx (or wherever your app initializes)

import { auditService } from '@/lib/crm-audit';
import { supabaseClient } from '@/integrations/supabase/client';

// After Supabase client is ready
auditService.initialize(supabaseClient);

console.log('CRMAuditService initialized');
```

- [ ] **Step 2: Verify initialization**

Add a console log, run dev server, check browser console for initialization message

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat(audit): Initialize CRMAuditService on app startup"
```

---

## Phase 1 Checkpoint

**Validate:**
- [ ] `crm_audit_logs` table exists in Supabase with proper schema
- [ ] `CRMAuditService` is created and tested
- [ ] Lead operations (create/update/delete) are hooked for audit logging
- [ ] Manual test: Create a lead, verify entry in `crm_audit_logs`
- [ ] All commits pushed

**Next Phase:** Move to Phase 2 once checkpoint passes.

---

## Phase 2: History UI (Days 3-4)

### File Structure

```
Frontend (src/):
- hooks/useCRMAuditTrail.ts (NEW) - Fetch + real-time subscription
- components/crm/audit/ (NEW)
  - CRMAuditHistoryPanel.tsx - Reusable history panel
  - CRMAuditEventBadge.tsx - Action type badge component
  - CRMAuditDiff.tsx - Diff viewer component
```

### Task 5: Create useCRMAuditTrail Hook

**Files:**
- Create: `src/hooks/useCRMAuditTrail.ts`

**Interfaces:**
- Consumes: Supabase client, TanStack Query
- Produces: 
  ```typescript
  interface CRMAuditTrailOptions {
    entityType?: string;
    entityId?: string;
    limit?: number;
  }
  
  function useCRMAuditTrail(options: CRMAuditTrailOptions): {
    data: AuditLog[];
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
  }
  ```

- [ ] **Step 1: Write test**

```typescript
// File: tests/unit/hooks/useCRMAuditTrail.test.ts

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCRMAuditTrail } from '@/hooks/useCRMAuditTrail';

describe('useCRMAuditTrail', () => {
  it('should fetch audit logs for an entity', async () => {
    const { result } = renderHook(() => 
      useCRMAuditTrail({ entityType: 'lead', entityId: 'lead-123' })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    const { result } = renderHook(() => 
      useCRMAuditTrail({ entityType: 'lead', entityId: 'invalid-id' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should either have error or empty data
    expect(result.current.error || result.current.data.length === 0).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to fail**

```bash
npm run test -- tests/unit/hooks/useCRMAuditTrail.test.ts
```

Expected: FAIL - hook not found

- [ ] **Step 3: Implement hook**

```typescript
// File: src/hooks/useCRMAuditTrail.ts

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_email: string;
  user_name: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_fields: string[] | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface CRMAuditTrailOptions {
  entityType?: string;
  entityId?: string;
  limit?: number;
}

export function useCRMAuditTrail(options: CRMAuditTrailOptions) {
  const { entityType, entityId, limit = 50 } = options;
  const [liveData, setLiveData] = useState<AuditLog[]>([]);

  // Fetch historical data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['crm-audit-trail', entityType, entityId, limit],
    queryFn: async () => {
      if (!entityType || !entityId) return [];

      try {
        let query = supabaseClient
          .from('crm_audit_logs')
          .select('*')
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .order('created_at', { ascending: false })
          .limit(limit);

        const { data, error } = await query;

        if (error) {
          logger.error('Failed to fetch audit trail:', error);
          return [];
        }

        return data as AuditLog[];
      } catch (err) {
        logger.error('Error fetching audit trail:', err);
        return [];
      }
    },
    enabled: !!entityType && !!entityId
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!entityType || !entityId) return;

    const channel = supabaseClient
      .channel(`crm_audit_${entityType}_${entityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_audit_logs',
          filter: `entity_id=eq.${entityId}`
        },
        (payload) => {
          const newEntry = payload.new as AuditLog;
          setLiveData(prev => [newEntry, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [entityType, entityId]);

  return {
    data: [...liveData, ...(data || [])],
    loading: isLoading,
    error: error as Error | null,
    refetch
  };
}
```

- [ ] **Step 4: Run test to pass**

```bash
npm run test -- tests/unit/hooks/useCRMAuditTrail.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCRMAuditTrail.ts tests/unit/hooks/useCRMAuditTrail.test.ts
git commit -m "feat(audit): Create useCRMAuditTrail hook with real-time subscription"
```

---

### Task 6: Create CRMAuditEventBadge Component

**Files:**
- Create: `src/components/crm/audit/CRMAuditEventBadge.tsx`

**Interfaces:**
- Consumes: Badge component from shadcn/ui
- Produces: Colored badge component for audit actions

- [ ] **Step 1: Implement badge component**

```typescript
// File: src/components/crm/audit/CRMAuditEventBadge.tsx

import { Badge } from '@/components/ui/badge';

interface CRMAuditEventBadgeProps {
  action: string;
  size?: 'sm' | 'md' | 'lg';
}

const ACTION_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  create: { bg: 'bg-green-100', text: 'text-green-800', label: 'Created' },
  update: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Updated' },
  delete: { bg: 'bg-red-100', text: 'text-red-800', label: 'Deleted' },
  move: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Moved' },
  approve: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Approved' },
  reject: { bg: 'bg-pink-100', text: 'text-pink-800', label: 'Rejected' },
  view: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Viewed' }
};

export function CRMAuditEventBadge({ action, size = 'md' }: CRMAuditEventBadgeProps) {
  const config = ACTION_COLORS[action.toLowerCase()] || ACTION_COLORS.update;

  const sizeClass = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1'
  }[size];

  return (
    <Badge className={`${config.bg} ${config.text} ${sizeClass}`}>
      {config.label}
    </Badge>
  );
}
```

- [ ] **Step 2: Test in Storybook or manual test**

```typescript
// Quick visual test - add to a component
import { CRMAuditEventBadge } from '@/components/crm/audit/CRMAuditEventBadge';

export function BadgeTest() {
  return (
    <div className="space-x-2">
      <CRMAuditEventBadge action="create" />
      <CRMAuditEventBadge action="update" />
      <CRMAuditEventBadge action="delete" />
      <CRMAuditEventBadge action="move" />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/audit/CRMAuditEventBadge.tsx
git commit -m "feat(audit): Create CRMAuditEventBadge component"
```

---

### Task 7: Create CRMAuditDiff Component

**Files:**
- Create: `src/components/crm/audit/CRMAuditDiff.tsx`

**Interfaces:**
- Consumes: Badge, Card components
- Produces: Visual diff display component

- [ ] **Step 1: Implement diff component**

```typescript
// File: src/components/crm/audit/CRMAuditDiff.tsx

import { ArrowRight } from 'lucide-react';

interface CRMAuditDiffProps {
  changedFields?: string[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export function CRMAuditDiff({ changedFields = [], oldValues = {}, newValues = {} }: CRMAuditDiffProps) {
  if (changedFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 mt-3">
      {changedFields.map((field) => (
        <div key={field} className="text-sm grid grid-cols-[1fr,auto,1fr] gap-2 items-center p-2 bg-muted/30 rounded">
          <div className="font-mono text-xs text-muted-foreground truncate">{field}</div>
          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <div className="flex flex-col gap-1">
            {oldValues[field] !== undefined && (
              <div className="line-through text-xs text-muted-foreground opacity-70 truncate">
                {formatValue(oldValues[field])}
              </div>
            )}
            <div className="font-medium text-green-600 dark:text-green-400 truncate">
              {formatValue(newValues[field])}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/crm/audit/CRMAuditDiff.tsx
git commit -m "feat(audit): Create CRMAuditDiff component for change visualization"
```

---

### Task 8: Create CRMAuditHistoryPanel Component

**Files:**
- Create: `src/components/crm/audit/CRMAuditHistoryPanel.tsx`

**Interfaces:**
- Consumes: `useCRMAuditTrail`, `CRMAuditEventBadge`, `CRMAuditDiff`, Card components
- Produces: Reusable history panel component

- [ ] **Step 1: Write test**

```typescript
// File: tests/unit/components/CRMAuditHistoryPanel.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CRMAuditHistoryPanel } from '@/components/crm/audit/CRMAuditHistoryPanel';

vi.mock('@/hooks/useCRMAuditTrail', () => ({
  useCRMAuditTrail: () => ({
    data: [
      {
        id: '1',
        action: 'create',
        entity_type: 'lead',
        entity_id: 'lead-123',
        user_email: 'user@example.com',
        user_name: 'Test User',
        changed_fields: ['name', 'email'],
        created_at: '2026-08-19T10:00:00Z'
      }
    ],
    loading: false,
    error: null,
    refetch: vi.fn()
  })
}));

describe('CRMAuditHistoryPanel', () => {
  it('should display audit history', async () => {
    render(
      <CRMAuditHistoryPanel
        entityType="lead"
        entityId="lead-123"
        tenantId="tenant-123"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/created/i)).toBeInTheDocument();
      expect(screen.getByText(/test user/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Implement panel component**

```typescript
// File: src/components/crm/audit/CRMAuditHistoryPanel.tsx

import { useState } from 'react';
import { useCRMAuditTrail } from '@/hooks/useCRMAuditTrail';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CRMAuditEventBadge } from './CRMAuditEventBadge';
import { CRMAuditDiff } from './CRMAuditDiff';
import { format } from 'date-fns';
import { History, ChevronDown } from 'lucide-react';

interface CRMAuditHistoryPanelProps {
  entityType: 'lead' | 'contact' | 'opportunity' | 'quote';
  entityId: string;
  tenantId: string;
  maxItems?: number;
}

export function CRMAuditHistoryPanel({
  entityType,
  entityId,
  tenantId,
  maxItems = 10
}: CRMAuditHistoryPanelProps) {
  const { data, loading } = useCRMAuditTrail({
    entityType,
    entityId,
    limit: maxItems
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Activity History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 pr-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading history...</div>
          ) : data.length === 0 ? (
            <div className="text-sm text-muted-foreground">No activity yet</div>
          ) : (
            <div className="space-y-3">
              {data.slice(0, maxItems).map((entry) => (
                <div
                  key={entry.id}
                  className="border-l-2 border-muted pl-3 pb-3 cursor-pointer hover:border-primary transition-colors"
                  onClick={() =>
                    setExpandedId(expandedId === entry.id ? null : entry.id)
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <CRMAuditEventBadge action={entry.action} size="sm" />
                      <div className="text-xs text-muted-foreground truncate">
                        {entry.user_name || entry.user_email}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.created_at), 'MMM d, HH:mm')}
                    </div>
                    {entry.changed_fields && entry.changed_fields.length > 0 && (
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          expandedId === entry.id ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </div>

                  {expandedId === entry.id && (
                    <CRMAuditDiff
                      changedFields={entry.changed_fields || []}
                      oldValues={entry.old_values || {}}
                      newValues={entry.new_values || {}}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/audit/CRMAuditHistoryPanel.tsx tests/unit/components/CRMAuditHistoryPanel.test.tsx
git commit -m "feat(audit): Create CRMAuditHistoryPanel component with real-time updates"
```

---

### Task 9: Integrate History Panel into Lead Detail Page

**Files:**
- Modify: Lead detail page (likely `src/pages/crm/LeadDetailPage.tsx` or similar)

**Interfaces:**
- Consumes: `CRMAuditHistoryPanel` component, existing lead detail context
- Produces: Lead detail page with history panel

- [ ] **Step 1: Add history panel to lead page**

```typescript
// File: src/pages/crm/LeadDetailPage.tsx (or wherever it exists)

import { CRMAuditHistoryPanel } from '@/components/crm/audit/CRMAuditHistoryPanel';

export function LeadDetailPage() {
  const { leadId, tenantId } = useParams();

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Existing lead info */}
      <div className="col-span-2">
        {/* Lead form, details, etc. */}
      </div>

      {/* Add history panel on the right */}
      <div className="col-span-1">
        <CRMAuditHistoryPanel
          entityType="lead"
          entityId={leadId!}
          tenantId={tenantId!}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Test in browser**

```bash
npm run dev
# Navigate to a lead detail page
# Verify history panel appears and shows recent changes
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/crm/LeadDetailPage.tsx  # adjust path as needed
git commit -m "feat(audit): Add history panel to lead detail page"
```

---

## Phase 2 Checkpoint

**Validate:**
- [ ] `useCRMAuditTrail` hook fetches and subscribes to real-time updates
- [ ] `CRMAuditHistoryPanel` appears on lead detail page
- [ ] Real-time: Edit a lead, verify new entry appears in history without refresh
- [ ] Diffs display correctly (old → new values)
- [ ] All tests pass

**Next Phase:** Move to Phase 3 once checkpoint passes.

---

## Phase 3: Dashboard & Advanced Features (Days 5-6)

### File Structure

```
Frontend (src/):
- pages/crm/CRMAuditDashboard.tsx (NEW) - Main dashboard page
- components/crm/audit/
  - CRMAuditFilters.tsx (NEW) - Filtering UI
  - CRMAuditTable.tsx (NEW) - Audit log table
  - CRMAuditStatistics.tsx (NEW) - Stats panel
  - CRMAuditExport.tsx (NEW) - Export functionality

Routes (src/App.tsx or router config):
- Add route: /crm/audit-dashboard

Backend (services/crm-api/):
- Modify: src/services/audit/ - Add hooks for contacts, opportunities, quotes
```

### Task 10: Create CRMAuditDashboard Page

**Files:**
- Create: `src/pages/crm/CRMAuditDashboard.tsx`

**Interfaces:**
- Consumes: `useCRMAuditTrail`, filtering hooks, table components
- Produces: Full-screen audit dashboard page

- [ ] **Step 1: Create dashboard page**

```typescript
// File: src/pages/crm/CRMAuditDashboard.tsx

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { CRMAuditTable } from '@/components/crm/audit/CRMAuditTable';
import { CRMAuditStatistics } from '@/components/crm/audit/CRMAuditStatistics';
import { CRMAuditExport } from '@/components/crm/audit/CRMAuditExport';
import { useCRMAuditTrail } from '@/hooks/useCRMAuditTrail';
import { useAuth } from '@/hooks/useAuth';
import { History, RefreshCw } from 'lucide-react';

const ENTITY_TYPES = ['lead', 'contact', 'opportunity', 'quote', 'interaction'];
const ACTIONS = ['create', 'update', 'delete', 'move', 'approve', 'reject'];

export function CRMAuditDashboard() {
  const { user } = useAuth();
  const [entityType, setEntityType] = useState<string>('');
  const [action, setAction] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isLive, setIsLive] = useState(false);

  const { data, loading, refetch } = useCRMAuditTrail({
    limit: 500
  });

  // Filter data client-side
  const filteredData = data.filter((entry) => {
    if (entityType && entry.entity_type !== entityType) return false;
    if (action && entry.action !== action) return false;
    if (userId && entry.user_id !== userId) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        entry.entity_id.toLowerCase().includes(query) ||
        entry.user_email.toLowerCase().includes(query) ||
        entry.user_name?.toLowerCase().includes(query)
      );
    }
    if (dateFrom) {
      const entryDate = new Date(entry.created_at);
      if (entryDate < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const entryDate = new Date(entry.created_at);
      if (entryDate > new Date(dateTo)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6" />
          <h1 className="text-3xl font-bold">CRM Audit Dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isLive ? 'default' : 'outline'}
            onClick={() => setIsLive(!isLive)}
          >
            {isLive ? 'Live' : 'Paused'}
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Entity Type</label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Action</label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Date From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Date To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Search</label>
            <Input
              placeholder="Search by entity ID, email, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <CRMAuditStatistics data={filteredData} />

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Audit Events ({filteredData.length} of {data.length})
          </CardTitle>
          <CRMAuditExport data={filteredData} />
        </CardHeader>
        <CardContent>
          <CRMAuditTable data={filteredData} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create CRMAuditTable component**

```typescript
// File: src/components/crm/audit/CRMAuditTable.tsx

import { format } from 'date-fns';
import { CRMAuditEventBadge } from './CRMAuditEventBadge';
import { CRMAuditDiff } from './CRMAuditDiff';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface CRMAuditTableProps {
  data: any[];
  loading: boolean;
}

export function CRMAuditTable({ data, loading }: CRMAuditTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Loading...</div>;
  }

  if (data.length === 0) {
    return <div className="text-center py-4 text-muted-foreground">No audit logs found</div>;
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted border-b">
          <tr>
            <th className="text-left p-3 font-medium">Time</th>
            <th className="text-left p-3 font-medium">User</th>
            <th className="text-left p-3 font-medium">Action</th>
            <th className="text-left p-3 font-medium">Entity</th>
            <th className="text-left p-3 font-medium">Changed Fields</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr
              key={entry.id}
              className="border-b hover:bg-muted/50 cursor-pointer"
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            >
              <td className="p-3 text-xs">
                {format(new Date(entry.created_at), 'MMM d, HH:mm:ss')}
              </td>
              <td className="p-3 text-xs">{entry.user_name || entry.user_email}</td>
              <td className="p-3">
                <CRMAuditEventBadge action={entry.action} size="sm" />
              </td>
              <td className="p-3 text-xs font-mono">
                {entry.entity_type}:{entry.entity_id.slice(0, 8)}...
              </td>
              <td className="p-3 text-xs text-muted-foreground">
                {entry.changed_fields?.length || 0} fields
              </td>
            </tr>
          ))}
          {/* Expanded row */}
          {expandedId && (
            <tr className="border-b bg-muted/30">
              <td colSpan={5} className="p-4">
                {data.find((e) => e.id === expandedId) && (
                  <CRMAuditDiff
                    changedFields={data.find((e) => e.id === expandedId).changed_fields || []}
                    oldValues={data.find((e) => e.id === expandedId).old_values || {}}
                    newValues={data.find((e) => e.id === expandedId).new_values || {}}
                  />
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create CRMAuditStatistics component**

```typescript
// File: src/components/crm/audit/CRMAuditStatistics.tsx

import { Card, CardContent } from '@/components/ui/card';
import { ActivitySquare, Users, Zap } from 'lucide-react';

interface CRMAuditStatisticsProps {
  data: any[];
}

export function CRMAuditStatistics({ data }: CRMAuditStatisticsProps) {
  const uniqueUsers = new Set(data.map((e) => e.user_id)).size;
  const uniqueEntities = new Set(data.map((e) => e.entity_id)).size;
  const actionCounts = data.reduce(
    (acc, e) => {
      acc[e.action] = (acc[e.action] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Events</p>
              <p className="text-2xl font-bold">{data.length}</p>
            </div>
            <ActivitySquare className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Users</p>
              <p className="text-2xl font-bold">{uniqueUsers}</p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Most Common</p>
              <p className="text-2xl font-bold capitalize">{topAction?.[0] || '-'}</p>
              <p className="text-xs text-muted-foreground">{topAction?.[1] || 0} events</p>
            </div>
            <Zap className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Create CRMAuditExport component**

```typescript
// File: src/components/crm/audit/CRMAuditExport.tsx

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface CRMAuditExportProps {
  data: any[];
}

export function CRMAuditExport({ data }: CRMAuditExportProps) {
  const handleExport = () => {
    const csv = [
      ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Changed Fields'].join(','),
      ...data.map((entry) =>
        [
          entry.created_at,
          entry.user_email,
          entry.action,
          entry.entity_type,
          entry.entity_id,
          (entry.changed_fields || []).join(';')
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={data.length === 0}>
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  );
}
```

- [ ] **Step 5: Add route to App.tsx**

```typescript
// File: src/App.tsx (router configuration)

// Add to your routes
{
  path: '/crm/audit-dashboard',
  element: <CRMAuditDashboard />,
  meta: { requiresAuth: true }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/crm/CRMAuditDashboard.tsx
git add src/components/crm/audit/CRMAuditTable.tsx
git add src/components/crm/audit/CRMAuditStatistics.tsx
git add src/components/crm/audit/CRMAuditExport.tsx
git add src/App.tsx
git commit -m "feat(audit): Create comprehensive CRM audit dashboard"
```

---

### Task 11: Add Audit Logging for Contacts, Opportunities, and Quotes

**Files:**
- Create: `services/crm-api/src/services/audit/contacts.ts`
- Create: `services/crm-api/src/services/audit/opportunities.ts`
- Create: `services/crm-api/src/services/audit/quotes.ts`
- Modify: Route handlers for each entity type

**Interfaces:**
- Consumes: `CRMAuditService`, existing service methods
- Produces: Audit hooks for all entity types

- [ ] **Step 1: Create contacts audit service**

```typescript
// File: services/crm-api/src/services/audit/contacts.ts

import { auditService } from '@/lib/crm-audit';
import { logger } from '@/lib/logger';

export async function auditContactCreated(
  contactId: string,
  leadId: string,
  contactData: Record<string, any>,
  tenantId: string,
  franchiseId?: string
): Promise<void> {
  try {
    await auditService.logContactCreated(contactId, leadId, contactData, tenantId, franchiseId);
  } catch (error) {
    logger.warn('Failed to audit contact creation:', error);
  }
}

export async function auditContactUpdated(
  contactId: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  tenantId: string,
  franchiseId?: string
): Promise<void> {
  try {
    await auditService.logContactUpdated(contactId, oldData, newData, tenantId, franchiseId);
  } catch (error) {
    logger.warn('Failed to audit contact update:', error);
  }
}

export async function auditContactInteraction(
  contactId: string,
  type: 'call' | 'email' | 'meeting',
  details: Record<string, any>,
  tenantId: string,
  franchiseId?: string
): Promise<void> {
  try {
    await auditService.logContactInteraction(contactId, type, details, tenantId, franchiseId);
  } catch (error) {
    logger.warn('Failed to audit contact interaction:', error);
  }
}
```

- [ ] **Step 2: Create opportunities audit service**

```typescript
// File: services/crm-api/src/services/audit/opportunities.ts

import { auditService } from '@/lib/crm-audit';
import { logger } from '@/lib/logger';

export async function auditOpportunityCreated(
  opportunityId: string,
  leadId: string,
  oppData: Record<string, any>,
  tenantId: string,
  franchiseId?: string
): Promise<void> {
  try {
    await auditService.logOpportunityCreated(opportunityId, leadId, oppData, tenantId, franchiseId);
  } catch (error) {
    logger.warn('Failed to audit opportunity creation:', error);
  }
}

export async function auditPipelineMove(
  opportunityId: string,
  fromStage: string,
  toStage: string,
  tenantId: string,
  franchiseId?: string
): Promise<void> {
  try {
    await auditService.logPipelineMove(opportunityId, fromStage, toStage, tenantId, franchiseId);
  } catch (error) {
    logger.warn('Failed to audit pipeline move:', error);
  }
}
```

- [ ] **Step 3: Create quotes audit service**

```typescript
// File: services/crm-api/src/services/audit/quotes.ts

import { auditService } from '@/lib/crm-audit';
import { logger } from '@/lib/logger';

export async function auditQuoteCreated(
  quoteId: string,
  opportunityId: string,
  quoteData: Record<string, any>,
  tenantId: string,
  franchiseId?: string
): Promise<void> {
  try {
    await auditService.logQuoteCreated(quoteId, opportunityId, quoteData, tenantId, franchiseId);
  } catch (error) {
    logger.warn('Failed to audit quote creation:', error);
  }
}

export async function auditQuoteApproved(
  quoteId: string,
  tenantId: string,
  franchiseId?: string
): Promise<void> {
  try {
    await auditService.logQuoteApproved(quoteId, tenantId, franchiseId);
  } catch (error) {
    logger.warn('Failed to audit quote approval:', error);
  }
}
```

- [ ] **Step 4: Integrate into route handlers**

```typescript
// For each entity type, add audit logging to routes (similar to Task 3)
// Contacts: POST /contacts, PUT /contacts/:id
// Opportunities: POST /opportunities, PUT /opportunities/:id/stage
// Quotes: POST /quotes, PUT /quotes/:id/approve
```

- [ ] **Step 5: Add to CRMAuditService**

```typescript
// File: src/lib/crm-audit.ts - Add these methods to CRMAuditService

async logContactCreated(contactId: string, leadId: string, values: Record<string, any>, tenantId: string, franchiseId?: string): Promise<void> {
  await this.log({
    action: 'create',
    entity_type: 'contact',
    entity_id: contactId,
    related_entity_id: leadId,
    related_entity_type: 'lead',
    new_values: values,
    changed_fields: Object.keys(values),
    tenant_id: tenantId,
    franchise_id: franchiseId
  });
}

async logContactUpdated(contactId: string, oldValues: Record<string, any>, newValues: Record<string, any>, tenantId: string, franchiseId?: string): Promise<void> {
  const { changed_fields, old_values, new_values } = this.computeDiff(oldValues, newValues);
  if (changed_fields.length === 0) return;
  await this.log({
    action: 'update',
    entity_type: 'contact',
    entity_id: contactId,
    old_values,
    new_values,
    changed_fields,
    tenant_id: tenantId,
    franchise_id: franchiseId
  });
}

async logContactInteraction(contactId: string, type: 'call' | 'email' | 'meeting', details: Record<string, any>, tenantId: string, franchiseId?: string): Promise<void> {
  await this.log({
    action: 'interaction',
    entity_type: 'interaction',
    entity_id: `${contactId}-${Date.now()}`,
    related_entity_id: contactId,
    related_entity_type: 'contact',
    new_values: details,
    metadata: { interaction_type: type },
    tenant_id: tenantId,
    franchise_id: franchiseId
  });
}

async logOpportunityCreated(opportunityId: string, leadId: string, values: Record<string, any>, tenantId: string, franchiseId?: string): Promise<void> {
  await this.log({
    action: 'create',
    entity_type: 'opportunity',
    entity_id: opportunityId,
    related_entity_id: leadId,
    related_entity_type: 'lead',
    new_values: values,
    changed_fields: Object.keys(values),
    tenant_id: tenantId,
    franchise_id: franchiseId
  });
}

async logPipelineMove(opportunityId: string, fromStage: string, toStage: string, tenantId: string, franchiseId?: string): Promise<void> {
  await this.log({
    action: 'move',
    entity_type: 'opportunity',
    entity_id: opportunityId,
    metadata: { stage_from: fromStage, stage_to: toStage },
    tenant_id: tenantId,
    franchise_id: franchiseId
  });
}

async logQuoteCreated(quoteId: string, opportunityId: string, values: Record<string, any>, tenantId: string, franchiseId?: string): Promise<void> {
  await this.log({
    action: 'create',
    entity_type: 'quote',
    entity_id: quoteId,
    related_entity_id: opportunityId,
    related_entity_type: 'opportunity',
    new_values: values,
    changed_fields: Object.keys(values),
    tenant_id: tenantId,
    franchise_id: franchiseId
  });
}

async logQuoteApproved(quoteId: string, tenantId: string, franchiseId?: string): Promise<void> {
  await this.log({
    action: 'approve',
    entity_type: 'quote',
    entity_id: quoteId,
    tenant_id: tenantId,
    franchise_id: franchiseId
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add services/crm-api/src/services/audit/
git add src/lib/crm-audit.ts
git commit -m "feat(audit): Add audit logging for contacts, opportunities, and quotes"
```

---

## Phase 3 Checkpoint

**Validate:**
- [ ] Dashboard page loads and displays audit logs
- [ ] Filters work (entity type, action, date range, search)
- [ ] Export to CSV works
- [ ] Statistics panel shows correct counts
- [ ] All entity types log correctly (contacts, opportunities, quotes)
- [ ] Real-time dashboard updates as new events occur

---

## Phase 4: Polish & Testing (Day 7)

### Task 12: Add Error Handling & Retry Logic

**Files:**
- Modify: `src/lib/crm-audit.ts`

**Implementation:**
- Queue failed logs for retry
- Implement background retry job
- Store in IndexedDB if Supabase unavailable

- [ ] **Step 1: Add retry queue**

```typescript
// File: src/lib/crm-audit.ts - Add retry logic

interface RetryEntry {
  entry: CRMAuditLogEntry;
  attempts: number;
  nextRetry: number;
}

class CRMAuditService {
  private retryQueue: RetryEntry[] = [];
  private isRetrying = false;

  private async log(entry: CRMAuditLogEntry): Promise<void> {
    // ... existing code ...
    
    if (error) {
      logger.warn('Failed to log audit entry, queuing for retry:', error);
      this.retryQueue.push({
        entry: entryWithContext,
        attempts: 0,
        nextRetry: Date.now() + 5000 // Retry in 5 seconds
      });
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.isRetrying) return;
    
    const now = Date.now();
    const nextEntry = this.retryQueue.find((e) => e.nextRetry <= now);
    
    if (!nextEntry) {
      // Schedule next check
      setTimeout(() => this.scheduleRetry(), 5000);
      return;
    }

    this.isRetrying = true;
    this.retryEntry(nextEntry)
      .then(() => {
        this.isRetrying = false;
        this.scheduleRetry();
      })
      .catch(() => {
        this.isRetrying = false;
        setTimeout(() => this.scheduleRetry(), 5000);
      });
  }

  private async retryEntry(retryEntry: RetryEntry): Promise<void> {
    if (retryEntry.attempts >= 3) {
      logger.error('Audit log retry failed after 3 attempts, dropping:', retryEntry.entry);
      this.retryQueue = this.retryQueue.filter((e) => e !== retryEntry);
      return;
    }

    try {
      const { error } = await this.supabase!
        .from('crm_audit_logs')
        .insert([retryEntry.entry]);

      if (!error) {
        this.retryQueue = this.retryQueue.filter((e) => e !== retryEntry);
        logger.info('Audit log retry succeeded');
      } else {
        retryEntry.attempts++;
        retryEntry.nextRetry = Date.now() + (5000 * Math.pow(2, retryEntry.attempts));
      }
    } catch (err) {
      retryEntry.attempts++;
      retryEntry.nextRetry = Date.now() + (5000 * Math.pow(2, retryEntry.attempts));
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/crm-audit.ts
git commit -m "feat(audit): Add retry logic for failed audit logs"
```

---

### Task 13: Performance Testing & Optimization

**Files:**
- No changes needed, but validate performance

**Steps:**
- [ ] Test dashboard with 10k+ logs
- [ ] Verify loads in <2 seconds
- [ ] Check memory usage
- [ ] Optimize indexes if needed

**Test:**
```bash
# Create 10k test logs
# Load dashboard
# Measure load time in browser DevTools
# Should be <2s
```

- [ ] **Commit note**

```bash
git commit -m "perf(audit): Validate dashboard performance with 10k+ logs" --allow-empty
```

---

### Task 14: Integration & E2E Testing

**Files:**
- Create: `tests/e2e/crm-audit.spec.ts`

**Test Coverage:**
- Create lead → verify audit log created
- Update lead → verify diff captured
- Dashboard filters work
- Real-time updates

- [ ] **Step 1: Write E2E test**

```typescript
// File: tests/e2e/crm-audit.spec.ts

import { test, expect } from '@playwright/test';

test('CRM audit flow', async ({ page }) => {
  // Login
  await page.goto('/');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('button:has-text("Sign In")');
  
  // Create a lead
  await page.goto('/crm/leads/new');
  await page.fill('[name=name]', 'Test Lead');
  await page.fill('[name=email]', 'lead@example.com');
  await page.click('button:has-text("Create")');
  
  // Navigate to lead detail
  await page.goto('/crm/leads/lead-123');
  
  // Verify history panel shows creation
  await expect(page.locator('text=Activity History')).toBeVisible();
  await expect(page.locator('text=Created')).toBeVisible();
  
  // Navigate to audit dashboard
  await page.goto('/crm/audit-dashboard');
  
  // Verify lead appears in dashboard
  await expect(page.locator('text=lead@example.com')).toBeVisible();
  
  // Filter by action
  await page.selectOption('[name=action]', 'create');
  await expect(page.locator('text=led@example.com')).toBeVisible();
  
  // Export
  await page.click('button:has-text("Export CSV")');
});
```

- [ ] **Step 2: Run E2E tests**

```bash
npm run test:playwright
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/crm-audit.spec.ts
git commit -m "test(audit): Add E2E tests for CRM audit flow"
```

---

### Task 15: Documentation

**Files:**
- Create: `docs/audit/CRM_AUDIT_GUIDE.md`

- [ ] **Step 1: Write documentation**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/audit/CRM_AUDIT_GUIDE.md
git commit -m "docs(audit): Add CRM audit system documentation"
```

---

### Task 16: Final Testing & QA Checklist

- [ ] **Verify all requirements met:**
  - [ ] All CRM operations audited (leads, contacts, opportunities, quotes, interactions)
  - [ ] History panels on entity detail pages
  - [ ] Dashboard with filters, search, export
  - [ ] Real-time updates working
  - [ ] RLS enforces tenant isolation
  - [ ] Audit failures don't block operations
  - [ ] Dashboard loads in <2 seconds
  - [ ] All tests passing
  - [ ] Documentation complete

- [ ] **Manual testing:**
  - [ ] Create/update/delete lead, verify in history and dashboard
  - [ ] Filter dashboard by multiple criteria
  - [ ] Export CSV and verify data
  - [ ] Check real-time update on dashboard
  - [ ] Verify only tenant's data visible (RLS)

- [ ] **Final commit**

```bash
git commit -m "feat(audit): Comprehensive CRM audit system complete" --allow-empty
```

---

## Summary

**Files Created:** 15+  
**Files Modified:** 10+  
**Tests Added:** 8+  
**Commits:** 15+  
**Total Scope:** Comprehensive CRM audit tracking with dashboards, real-time updates, and compliance-grade audit trails.

---

## Rollback Plan

If any phase fails:
1. Phase 1 failure: Drop `crm_audit_logs` table, revert CRMAuditService
2. Phase 2 failure: Remove UI components, keep backend logging
3. Phase 3 failure: Keep history panels, skip dashboard
4. Phase 4 failure: Complete audit system functional, just needs polish

All changes are backwards-compatible and non-blocking.
