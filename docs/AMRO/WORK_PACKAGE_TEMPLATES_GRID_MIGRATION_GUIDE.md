# Work Package Templates Enterprise Grid - Migration Guide

**Document ID:** WPT-GRID-MIGRATION-001  
**Version:** 1.0.0  
**Date:** April 14, 2026  
**Audience:** Developers, System Administrators  

---

## Executive Summary

This guide covers the migration from the legacy `AmroWorkPackageTemplatesPage` to the new Enterprise Grid implementation. The migration is designed to be **zero-downtime** with a **feature flag** for gradual rollout.

---

## 1. Migration Overview

### 1.1 Current State

```
Legacy Implementation:
├── AmroWorkPackageTemplatesPage.tsx (776 lines)
│   ├── Basic table with shadcn Table component
│   ├── Client-side pagination (20 per page)
│   ├── Single-column sorting
│   ├── Basic filters (search, dropdowns)
│   └── Dialog-based editing (context loss)
```

### 1.2 Target State

```
Enterprise Grid Implementation:
├── 12 Components (3,850+ lines)
│   ├── Virtual scrolling grid
│   ├── Server-side pagination
│   ├── Multi-column sorting
│   ├── Advanced filtering
│   ├── Inline editing (no context loss)
│   ├── Export (CSV, Excel, PDF)
│   ├── Column customization
│   ├── Mobile card view
│   ├── Real-time updates
│   └── Full accessibility
```

### 1.3 Migration Strategy

**Zero-Downtime Rollout** using feature flags:

```
Week 1: Feature flag for 10% of users
Week 2: Feature flag for 50% of users
Week 3: Feature flag for 100% of users
Week 4: Remove legacy code
```

---

## 2. Pre-Migration Checklist

### 2.1 Code Review

- [ ] All Phase 1-4 components implemented
- [ ] Unit tests passing (>85% coverage)
- [ ] ESLint compliance (0 errors)
- [ ] TypeScript strict mode (0 errors)
- [ ] Build successful

### 2.2 Backend Requirements

- [ ] API supports multi-column sort parameter
- [ ] API supports bulk delete endpoint
- [ ] API supports bulk status update endpoint
- [ ] API supports export endpoint
- [ ] API supports date range query parameters
- [ ] API supports number range query parameters
- [ ] WebSocket endpoint implemented (for real-time)
- [ ] SSE endpoint implemented (fallback)

### 2.3 Dependencies

```bash
# Install required dependencies
npm install @tanstack/react-virtual papaparse xlsx date-fns

# Install type definitions
npm install -D @types/papaparse @types/xlsx
```

### 2.4 Environment Variables

```bash
# Add to .env file
VITE_WS_URL=wss://api.yourdomain.com
VITE_ENABLE_REALTIME_UPDATES=true
VITE_ENABLE_TEMPLATE_GRID_V2=true
```

---

## 3. Integration Steps

### 3.1 Create Feature Flag

```typescript
// src/features/feature-flags/template-grid.ts
export const TEMPLATE_GRID_V2_FLAG = 'template_grid_v2';

export function useTemplateGridV2(): boolean {
  const { user } = useAuth();
  
  // Check user preferences or rollout percentage
  const rolloutPercentage = parseInt(
    import.meta.env.VITE_TEMPLATE_GRID_V2_ROLLOUT || '0',
    10
  );
  
  // Determine if user should see new grid
  const userId = user?.id || '';
  const hash = hashCode(userId);
  const percentage = Math.abs(hash) % 100;
  
  return percentage < rolloutPercentage;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}
```

### 3.2 Update Router

```typescript
// src/router/amro-routes.tsx
import { AmroWorkPackageTemplatesPage } from '@/features/module-amro/templates/AmroWorkPackageTemplatesPage';
import { AmroWorkPackageTemplatesPageV2 } from '@/features/module-amro/templates/AmroWorkPackageTemplatesPageV2';
import { useTemplateGridV2 } from '@/features/feature-flags/template-grid';

function WorkPackageTemplatesRoute() {
  const useV2 = useTemplateGridV2();
  
  return useV2 ? <AmroWorkPackageTemplatesPageV2 /> : <AmroWorkPackageTemplatesPage />;
}

// Route definition
{
  path: 'work-package-templates',
  element: <WorkPackageTemplatesRoute />,
}
```

### 3.3 Create V2 Page Component

```typescript
// src/features/module-amro/templates/AmroWorkPackageTemplatesPageV2.tsx
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AmroModuleSurface } from '@/features/module-amro/components/AmroModuleSurface';
import {
  WorkPackageTemplatesGrid,
  GridToolbar,
  TemplateCreateEditDialog,
  TemplatePreviewDialog,
  TemplateCloneDialog,
  TemplateVersionManager,
  ExportDialog,
  ColumnManager,
  AdvancedFilterPanel,
  BulkOperationsDialog,
  RowContextMenu,
  ConflictResolver,
} from './components';
import {
  useTemplateList,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useCloneTemplate,
  useBulkDeleteTemplates,
  useAircraftModels,
  useRealTimeUpdates,
} from './hooks';
import { useTemplateGridStore } from './store';

export function AmroWorkPackageTemplatesPageV2() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const accessToken = session?.access_token || '';
  
  // Grid state
  const {
    filters,
    sort,
    selectedIds,
    density,
    viewMode,
    columnVisibility,
    columnOrder,
    bulkOperation,
    contextMenu,
    resetState,
  } = useTemplateGridStore();
  
  // Dialog states
  const [createEditOpen, setCreateEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [versionManagerOpen, setVersionManagerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  
  // Selected templates
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [conflictData, setConflictData] = useState(null);
  
  // Data fetching
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useTemplateList(accessToken);
  
  // Aircraft models
  const { data: aircraftModels } = useAircraftModels(accessToken);
  
  // Real-time updates
  const {
    connectionStatus,
    reconnect: reconnectRealtime,
  } = useRealTimeUpdates({
    enabled: true,
    accessToken,
    tenantId: session?.user?.tenant_id,
  });
  
  // Mutations
  const createMutation = useCreateTemplate(accessToken);
  const updateMutation = useUpdateTemplate(accessToken);
  const deleteMutation = useDeleteTemplate(accessToken);
  const cloneMutation = useCloneTemplate(accessToken);
  const bulkDeleteMutation = useBulkDeleteTemplates(accessToken);
  
  // Handlers
  const handleNewTemplate = useCallback(() => {
    setCreateEditOpen(true);
  }, []);
  
  const handleEdit = useCallback((template) => {
    setSelectedTemplate(template);
    setCreateEditOpen(true);
  }, []);
  
  const handleDelete = useCallback((template) => {
    setSelectedTemplate(template);
    deleteMutation.mutate(template.id);
  }, [deleteMutation]);
  
  const handleClone = useCallback((template) => {
    setSelectedTemplate(template);
    setCloneOpen(true);
  }, []);
  
  const handlePreview = useCallback((template) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  }, []);
  
  const handleManageVersions = useCallback((template) => {
    setSelectedTemplate(template);
    setVersionManagerOpen(true);
  }, []);
  
  const handleBulkDelete = useCallback(() => {
    setBulkDialogOpen(true);
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  }, [selectedIds, bulkDeleteMutation]);
  
  const handleExport = useCallback(() => {
    setExportOpen(true);
  }, []);
  
  const handleContextMenu = useCallback((e, templateId) => {
    e.preventDefault();
    const template = data?.templates?.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
    }
  }, [data?.templates]);
  
  const handleSortChange = useCallback((field, direction, isMulti) => {
    // Sorting handled by store
  }, []);
  
  // Column definitions for ColumnManager
  const columnDefinitions = useMemo(() => [
    { id: 'select', label: 'Select' },
    { id: 'template_code', label: 'Template Code' },
    { id: 'template_name', label: 'Template Name' },
    { id: 'maintenance_type', label: 'Maintenance Type' },
    { id: 'aircraft_model', label: 'Aircraft Model' },
    { id: 'version', label: 'Version' },
    { id: 'status', label: 'Status' },
    { id: 'tasks_count', label: 'Tasks' },
    { id: 'description', label: 'Description' },
    { id: 'updated_at', label: 'Last Updated' },
    { id: 'created_at', label: 'Created' },
    { id: 'created_by', label: 'Created By' },
    { id: 'updated_by', label: 'Updated By' },
    { id: 'estimated_labor_hours', label: 'Est. Hours' },
    { id: 'actions', label: 'Actions' },
  ], []);
  
  return (
    <DashboardLayout>
      <AmroModuleSurface
        title="Work Package Templates"
        subtitle="Manage and track maintenance templates"
        breadcrumbs={[
          { label: 'AMRO', href: '/dashboard/amro' },
          { label: 'Templates', href: '/dashboard/amro/work-package-templates' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`} />
              <span className="text-xs text-muted-foreground">
                {connectionStatus === 'connected' ? 'Live' : 
                 connectionStatus === 'connecting' ? 'Connecting...' :
                 'Disconnected'}
              </span>
              {connectionStatus !== 'connected' && (
                <Button variant="ghost" size="sm" onClick={reconnectRealtime}>
                  Reconnect
                </Button>
              )}
            </div>
          </div>
        }
      >
        {/* Toolbar */}
        <GridToolbar
          onNewTemplate={handleNewTemplate}
          onBulkDelete={handleBulkDelete}
          onExport={handleExport}
          onRefresh={() => refetch()}
          isLoading={isLoading}
          aircraftModels={aircraftModels || []}
        />
        
        {/* Grid or Card View */}
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {data?.templates?.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedIds.has(template.id)}
                onToggleSelect={toggleSelection}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClone={handleClone}
                onPreview={handlePreview}
                onManageVersions={handleManageVersions}
              />
            ))}
          </div>
        ) : (
          <WorkPackageTemplatesGrid
            templates={data?.templates || []}
            totalCount={data?.total || 0}
            isLoading={isLoading}
            error={error}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onClone={handleClone}
            onPreview={handlePreview}
            onManageVersions={handleManageVersions}
            onRefresh={() => refetch()}
            onContextMenu={handleContextMenu}
            onSortChange={handleSortChange}
          />
        )}
        
        {/* Dialogs */}
        <TemplateCreateEditDialog
          open={createEditOpen}
          onOpenChange={setCreateEditOpen}
          template={selectedTemplate}
          onSubmit={handleCreateEditSubmit}
        />
        
        <TemplatePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          template={selectedTemplate}
        />
        
        <TemplateCloneDialog
          open={cloneOpen}
          onOpenChange={setCloneOpen}
          template={selectedTemplate}
          onSubmit={handleCloneSubmit}
        />
        
        <TemplateVersionManager
          open={versionManagerOpen}
          onOpenChange={setVersionManagerOpen}
          template={selectedTemplate}
        />
        
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          templates={data?.templates || []}
          selectedIds={selectedIds}
        />
        
        <ColumnManager
          open={columnManagerOpen}
          onOpenChange={setColumnManagerOpen}
          columns={columnDefinitions}
        />
        
        <AdvancedFilterPanel
          open={advancedFilterOpen}
          onOpenChange={setAdvancedFilterOpen}
          filters={filters}
          onFilterChange={setFilters}
          aircraftModels={aircraftModels}
        />
        
        <BulkOperationsDialog
          open={bulkDialogOpen}
          onOpenChange={setBulkDialogOpen}
          operation={bulkOperation}
          errors={bulkDeleteMutation.error ? [{ 
            id: 'unknown', 
            error: bulkDeleteMutation.error.message 
          }] : []}
          onRetry={handleBulkDelete}
          onClose={() => setBulkDialogOpen(false)}
        />
        
        <RowContextMenu
          template={selectedTemplate}
          x={contextMenu.x}
          y={contextMenu.y}
          open={!!contextMenu.rowId}
          onOpenChange={(open) => !open && setContextMenu(null)}
          onPreview={handlePreview}
          onEdit={handleEdit}
          onClone={handleClone}
          onDelete={handleDelete}
          onManageVersions={handleManageVersions}
        />
        
        <ConflictResolver
          open={conflictOpen}
          onOpenChange={setConflictOpen}
          templateName={conflictData?.templateName || ''}
          differences={conflictData?.differences || []}
          onKeepLocal={handleKeepLocal}
          onUseServer={handleUseServer}
          onReload={() => {
            refetch();
            setConflictOpen(false);
          }}
        />
      </AmroModuleSurface>
    </DashboardLayout>
  );
}
```

---

## 4. Rollout Plan

### 4.1 Week 1: Beta Testing (10%)

```bash
# Set environment variable
VITE_TEMPLATE_GRID_V2_ROLLOUT=10
```

**Actions**:
- Deploy to production with 10% rollout
- Monitor error rates
- Collect user feedback
- Fix critical issues

**Success Criteria**:
- Error rate < 1%
- User satisfaction > 4/5
- No critical bugs

### 4.2 Week 2: Expanded Testing (50%)

```bash
VITE_TEMPLATE_GRID_V2_ROLLOUT=50
```

**Actions**:
- Increase rollout to 50%
- Monitor performance metrics
- Address user feedback
- Optimize based on usage patterns

**Success Criteria**:
- Error rate < 0.5%
- Performance targets met
- User satisfaction > 4.5/5

### 4.3 Week 3: Full Rollout (100%)

```bash
VITE_TEMPLATE_GRID_V2_ROLLOUT=100
```

**Actions**:
- Roll out to 100% of users
- Monitor for 48 hours
- Collect final feedback
- Prepare legacy code removal

**Success Criteria**:
- Error rate < 0.1%
- All performance targets met
- Zero critical issues

### 4.4 Week 4: Cleanup

**Actions**:
- Remove legacy `AmroWorkPackageTemplatesPage.tsx`
- Remove feature flag code
- Remove environment variable
- Update documentation
- Archive legacy code in git tag

```bash
# Create git tag for legacy version
git tag legacy-template-grid-v1
git push origin legacy-template-grid-v1

# Remove legacy files
rm src/features/module-amro/templates/AmroWorkPackageTemplatesPage.tsx
```

---

## 5. Rollback Plan

### 5.1 Immediate Rollback

If critical issues arise:

```bash
# Set rollout to 0%
VITE_TEMPLATE_GRID_V2_ROLLOUT=0
```

**Actions**:
1. All users immediately see legacy grid
2. No data loss (both versions use same API)
3. Investigate and fix issues
4. Resume rollout when ready

### 5.2 Partial Rollback

If issues affect specific user segments:

```bash
# Adjust rollout percentage
VITE_TEMPLATE_GRID_V2_ROLLOUT=25
```

**Actions**:
1. Reduce rollout percentage
2. Monitor affected users
3. Fix issues
4. Gradually increase again

---

## 6. Performance Monitoring

### 6.1 Key Metrics

| Metric | Target | Monitoring Tool |
|--------|--------|-----------------|
| Initial load time | < 2s | Lighthouse |
| Time to Interactive | < 3s | Web Vitals |
| Scroll FPS | > 55fps | DevTools |
| API response (p95) | < 500ms | Backend metrics |
| Error rate | < 0.1% | Sentry |
| User satisfaction | > 4.5/5 | Feedback survey |

### 6.2 Sentry Configuration

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_ENVIRONMENT,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

---

## 7. Data Migration

### 7.1 Database Changes

**No database migration required**. Both legacy and new implementations use the same API endpoints and database schema.

### 7.2 User Preferences

User preferences (column visibility, order, sizes, density, view mode) are stored in `localStorage` and will be preserved during migration.

```typescript
// localStorage keys
'template-grid-preferences' // Zustand persistence
```

---

## 8. Training Materials

### 8.1 User Training

- **User Guide**: `docs/AMRO/WORK_PACKAGE_TEMPLATES_GRID_USER_GUIDE.md`
- **Quick Reference**: 1-page cheat sheet (create separately)
- **Video Tutorial**: 5-minute walkthrough (create separately)

### 8.2 Developer Training

- **Design Specification**: `docs/AMRO/WORK_PACKAGE_TEMPLATES_GRID_SPECIFICATION.md`
- **Phase Completion Reports**: Phase 1-4 completion documents
- **Component Documentation**: JSDoc comments in all components

---

## 9. Support and Maintenance

### 9.1 Known Issues

Document any known issues in the issue tracker with the `template-grid-v2` label.

### 9.2 Bug Reports

Users should report bugs via:
1. In-app feedback button
2. Support ticket system
3. Email to support team

### 9.3 Feature Requests

Feature requests should be submitted via:
1. In-app feedback button
2. Product roadmap planning sessions

---

## 10. Post-Migration Checklist

### 10.1 Verification

- [ ] 100% of users on new grid
- [ ] Error rate < 0.1%
- [ ] Performance targets met
- [ ] User satisfaction > 4.5/5
- [ ] Legacy code removed
- [ ] Feature flag removed
- [ ] Documentation updated

### 10.2 Communication

- [ ] Announcement sent to all users
- [ ] Training sessions completed
- [ ] Support team briefed
- [ ] Documentation published

### 10.3 Monitoring

- [ ] Sentry alerts configured
- [ ] Performance dashboards created
- [ ] User feedback collection active
- [ ] Weekly review meetings scheduled

---

**Migration Completed By**: AMRO Engineering Team  
**Migration Date**: April 14, 2026  
**Target Completion**: May 14, 2026  

---

**END OF MIGRATION GUIDE**
