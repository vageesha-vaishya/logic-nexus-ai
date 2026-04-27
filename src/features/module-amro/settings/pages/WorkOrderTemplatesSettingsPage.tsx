/**
 * Work Package Templates Page (Settings → Master Data)
 * 
 * Enterprise-grade unified layout for managing work package templates in settings.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Complexity: High (template versioning, task relationships, approval workflow)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import {
  AmroUnifiedPageLayout,
  AmroUnifiedTable,
  AmroUnifiedForm,
  AmroActions,
} from '@/features/module-amro/components/unified';
import type { Column, PaginationConfig, SearchConfig, TableFilter } from '@/features/module-amro/components/unified';

// ── Types ─────────────────────────────────────────────────────────────────

interface WorkOrderTemplate {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  template_code: string;
  template_name: string;
  description: string | null;
  maintenance_type: string;
  version: number;
  status: string;
  task_count: number;
  estimated_hours: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkOrderTemplateFormData {
  template_code: string;
  template_name: string;
  description: string;
  maintenance_type: string;
  version: number;
  status: string;
  estimated_hours: number;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: WorkOrderTemplateFormData = {
  template_code: '',
  template_name: '',
  description: '',
  maintenance_type: 'line',
  version: 1,
  status: 'draft',
  estimated_hours: 0,
  is_active: true,
};

const MAINTENANCE_TYPES = ['line', 'base', 'component', 'inspection', 'overhaul', 'repair', 'upgrade', 'modification'];
const TEMPLATE_STATUSES = ['draft', 'pending_review', 'approved', 'active', 'deprecated', 'archived'];

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchTemplates(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ templates: WorkOrderTemplate[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/work_order_templates?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load templates: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    templates: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createTemplate(accessToken: string, tenantId: string, data: WorkOrderTemplateFormData): Promise<WorkOrderTemplate> {
  const response = await fetch('/api/v2/amro/master-data/work_order_templates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ tenant_id: tenantId, ...data }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `Create failed: ${response.status}`);
  }

  const json = await response.json();
  return json.data || json.output;
}

async function updateTemplate(accessToken: string, id: string, data: Partial<WorkOrderTemplateFormData>): Promise<WorkOrderTemplate> {
  const response = await fetch(`/api/v2/amro/master-data/work_order_templates/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `Update failed: ${response.status}`);
  }

  const json = await response.json();
  return json.data || json.output;
}

async function deleteTemplate(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/work_order_templates/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ───────────────────────────────────────────────────────────────

export function WorkOrderTemplatesSettingsPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';

  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [templates, setTemplates] = useState<WorkOrderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkOrderTemplate | null>(null);
  const [formData, setFormData] = useState<WorkOrderTemplateFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof WorkOrderTemplateFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<WorkOrderTemplate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Templates ─────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchTemplates(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setTemplates(result.templates);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingTemplate(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (template: WorkOrderTemplate) => {
    setEditingTemplate(template);
    setFormData({
      template_code: template.template_code,
      template_name: template.template_name,
      description: template.description || '',
      maintenance_type: template.maintenance_type,
      version: template.version,
      status: template.status,
      estimated_hours: template.estimated_hours || 0,
      is_active: template.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof WorkOrderTemplateFormData, string>> = {};

    if (!formData.template_code.trim()) errors.template_code = 'Template code is required';
    if (!formData.template_name.trim()) errors.template_name = 'Template name is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors before saving');
      return;
    }

    setFormLoading(true);
    try {
      if (editingTemplate) {
        await updateTemplate(accessToken, editingTemplate.id, formData);
        toast.success('Template updated');
      } else {
        await createTemplate(accessToken, tenantId, formData);
        toast.success('Template created');
      }
      setFormOpen(false);
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (template: WorkOrderTemplate) => {
    setDeleteCandidate(template);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deleteTemplate(accessToken, deleteCandidate.id);
      toast.success('Template deleted');
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<WorkOrderTemplate>[] = [
    {
      key: 'template_code',
      label: 'Code',
      sortable: true,
      width: 'w-36',
      render: (row) => <Badge variant="outline" className="font-mono">{row.template_code}</Badge>,
    },
    {
      key: 'template_name',
      label: 'Template Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.template_name}</div>
          {row.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'maintenance_type',
      label: 'Type',
      sortable: true,
      render: (row) => <Badge variant="outline">{row.maintenance_type}</Badge>,
    },
    {
      key: 'version',
      label: 'Version',
      sortable: true,
      render: (row) => <Badge>v{row.version}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'default' : row.status === 'draft' ? 'secondary' : 'outline'}>
          {row.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'task_count',
      label: 'Tasks',
      sortable: true,
      render: (row) => row.task_count || '-',
    },
    {
      key: 'estimated_hours',
      label: 'Est. Hours',
      sortable: true,
      render: (row) => row.estimated_hours ? `${row.estimated_hours} hrs` : '-',
    },
    {
      key: 'is_active',
      label: 'Active',
      sortable: true,
      render: (row) => (
        <Badge variant={row.is_active ? 'default' : 'secondary'}>
          {row.is_active ? 'Yes' : 'No'}
        </Badge>
      ),
    },
  ];

  const searchConfig: SearchConfig = {
    value: search,
    onChange: (value) => { setSearch(value); setPage(1); },
    placeholder: 'Search templates...',
  };

  const filters: TableFilter[] = [
    {
      key: 'status',
      label: 'Status',
      options: TEMPLATE_STATUSES.map(s => ({ label: s.replace('_', ' ').charAt(0).toUpperCase() + s.slice(1), value: s })),
      value: statusFilter,
      onChange: (value) => { setStatusFilter(value); setPage(1); },
    },
  ];

  const paginationConfig: PaginationConfig = {
    page,
    pageSize,
    total,
    onPageChange: setPage,
    pageSizeOptions: [10, 20, 50, 100],
  };

  const getActions = (row: WorkOrderTemplate) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Work Package Templates"
      description="Manage work package templates and versioning"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Work Package Templates' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadTemplates} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Template
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Templates', value: total, icon: <FileText className="h-4 w-4" /> },
        { label: 'Active', value: templates.filter(t => t.status === 'active').length, icon: <FileText className="h-4 w-4" /> },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={templates}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No templates found"
        emptyDescription="Create your first work package template to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingTemplate ? 'Edit Template' : 'Create Template'}
        description={editingTemplate ? 'Update template details' : 'Add a new work package template'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingTemplate ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Tabs defaultValue="basic">
          <AmroUnifiedForm.Tab value="basic" label="Basic Info">
            <AmroUnifiedForm.Section title="Template Details">
              <AmroUnifiedForm.Field label="Template Code" required error={formErrors.template_code}>
                <Input
                  value={formData.template_code}
                  onChange={(e) => setFormData({ ...formData, template_code: e.target.value })}
                  placeholder="e.g., ACHK-737-001"
                  disabled={!!editingTemplate}
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Template Name" required error={formErrors.template_name}>
                <Input
                  value={formData.template_name}
                  onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                  placeholder="e.g., Boeing 737 A-Check"
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Maintenance Type">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.maintenance_type}
                  onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
                >
                  {MAINTENANCE_TYPES.map(type => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Version">
                <Input
                  type="number"
                  min={1}
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: parseInt(e.target.value) || 1 })}
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Estimated Hours">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={formData.estimated_hours}
                  onChange={(e) => setFormData({ ...formData, estimated_hours: parseFloat(e.target.value) || 0 })}
                />
              </AmroUnifiedForm.Field>
            </AmroUnifiedForm.Section>
          </AmroUnifiedForm.Tab>

          <AmroUnifiedForm.Tab value="status" label="Status">
            <AmroUnifiedForm.Section title="Template Status">
              <AmroUnifiedForm.Field label="Approval Status">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {TEMPLATE_STATUSES.map(status => (
                    <option key={status} value={status}>{status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1)}</option>
                  ))}
                </select>
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Active Status" colSpan={3}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="is_active" className="text-sm">Active (available for work package creation)</label>
                </div>
              </AmroUnifiedForm.Field>
            </AmroUnifiedForm.Section>
          </AmroUnifiedForm.Tab>

          <AmroUnifiedForm.Tab value="description" label="Description">
            <AmroUnifiedForm.Section title="Description" showSeparator={false}>
              <AmroUnifiedForm.Field label="Description" colSpan={3}>
                <textarea
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description of the template, scope, and requirements..."
                  rows={6}
                />
              </AmroUnifiedForm.Field>
            </AmroUnifiedForm.Section>
          </AmroUnifiedForm.Tab>
        </AmroUnifiedForm.Tabs>
      </AmroUnifiedForm>

      {/* Delete Confirmation */}
      <AmroUnifiedForm
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Confirm Deletion"
        description={`Are you sure you want to delete template "${deleteCandidate?.template_code} - ${deleteCandidate?.template_name}"?`}
        onSubmit={confirmDelete}
        onCancel={() => { setDeleteConfirmOpen(false); setDeleteCandidate(null); }}
        loading={deleteLoading}
        submitLabel="Delete"
        cancelLabel="Cancel"
        showFooter={false}
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
            {deleteLoading ? 'Deleting...' : 'Delete Template'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
