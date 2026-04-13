/**
 * Work Centers Page
 * 
 * Enterprise-grade unified layout for managing work centers.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Complexity: Low (simple CRUD entity)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, LayoutGrid } from 'lucide-react';
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

// ── Types ───────────────────────────────────────────────────────────────────

interface WorkCenter {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  code: string;
  name: string;
  description: string | null;
  location: string | null;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkCenterFormData {
  code: string;
  name: string;
  description: string;
  location: string;
  capacity: number;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: WorkCenterFormData = {
  code: '',
  name: '',
  description: '',
  location: '',
  capacity: 1,
  is_active: true,
};

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchWorkCenters(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ workCenters: WorkCenter[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { is_active: params.status === 'active' ? 'true' : 'false' } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/work_centers?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load work centers: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    workCenters: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createWorkCenter(accessToken: string, tenantId: string, data: WorkCenterFormData): Promise<WorkCenter> {
  const response = await fetch('/api/v2/amro/master-data/work_centers', {
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

async function updateWorkCenter(accessToken: string, id: string, data: Partial<WorkCenterFormData>): Promise<WorkCenter> {
  const response = await fetch(`/api/v2/amro/master-data/work_centers/${id}`, {
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

async function deleteWorkCenter(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/work_centers/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WorkCentersPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';

  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingWorkCenter, setEditingWorkCenter] = useState<WorkCenter | null>(null);
  const [formData, setFormData] = useState<WorkCenterFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof WorkCenterFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<WorkCenter | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Work Centers ─────────────────────────────────────────────────────

  const loadWorkCenters = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchWorkCenters(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setWorkCenters(result.workCenters);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load work centers');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadWorkCenters();
  }, [loadWorkCenters]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingWorkCenter(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (workCenter: WorkCenter) => {
    setEditingWorkCenter(workCenter);
    setFormData({
      code: workCenter.code,
      name: workCenter.name,
      description: workCenter.description || '',
      location: workCenter.location || '',
      capacity: workCenter.capacity || 1,
      is_active: workCenter.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof WorkCenterFormData, string>> = {};

    if (!formData.code.trim()) errors.code = 'Work center code is required';
    if (!formData.name.trim()) errors.name = 'Name is required';

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
      if (editingWorkCenter) {
        await updateWorkCenter(accessToken, editingWorkCenter.id, formData);
        toast.success('Work center updated');
      } else {
        await createWorkCenter(accessToken, tenantId, formData);
        toast.success('Work center created');
      }
      setFormOpen(false);
      loadWorkCenters();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save work center');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (workCenter: WorkCenter) => {
    setDeleteCandidate(workCenter);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deleteWorkCenter(accessToken, deleteCandidate.id);
      toast.success('Work center deleted');
      loadWorkCenters();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete work center');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<WorkCenter>[] = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      width: 'w-32',
      render: (row) => <Badge variant="outline" className="font-mono">{row.code}</Badge>,
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.location && <div className="text-xs text-muted-foreground">{row.location}</div>}
        </div>
      ),
    },
    {
      key: 'capacity',
      label: 'Capacity',
      sortable: true,
      render: (row) => row.capacity || '-',
    },
    {
      key: 'is_active',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <Badge variant={row.is_active ? 'default' : 'secondary'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const searchConfig: SearchConfig = {
    value: search,
    onChange: (value) => { setSearch(value); setPage(1); },
    placeholder: 'Search work centers...',
  };

  const filters: TableFilter[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
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

  const getActions = (row: WorkCenter) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Work Centers"
      description="Manage maintenance work centers and bays"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Work Centers' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadWorkCenters} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Work Center
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Work Centers', value: total, icon: <LayoutGrid className="h-4 w-4" /> },
        { label: 'Active', value: workCenters.filter(w => w.is_active).length, icon: <LayoutGrid className="h-4 w-4" /> },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={workCenters}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No work centers found"
        emptyDescription="Create your first work center to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingWorkCenter ? 'Edit Work Center' : 'Create Work Center'}
        description={editingWorkCenter ? 'Update work center details' : 'Add a new work center to the system'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingWorkCenter ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Section title="Basic Information">
          <AmroUnifiedForm.Field label="Work Center Code" required error={formErrors.code}>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., WC-001, BAY-A"
              disabled={!!editingWorkCenter}
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Name" required error={formErrors.name}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Main Assembly Bay"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Location">
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Hangar 1, Bay A"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Capacity">
            <Input
              type="number"
              min={1}
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
              placeholder="1"
            />
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>

        <AmroUnifiedForm.Section title="Description" showSeparator={false}>
          <AmroUnifiedForm.Field label="Description" colSpan={3}>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description of the work center..."
              rows={3}
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Status" colSpan={3}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="is_active" className="text-sm">Active (available for task assignments)</label>
            </div>
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>
      </AmroUnifiedForm>

      {/* Delete Confirmation */}
      <AmroUnifiedForm
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Confirm Deletion"
        description={`Are you sure you want to delete work center "${deleteCandidate?.code} - ${deleteCandidate?.name}"?`}
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
            {deleteLoading ? 'Deleting...' : 'Delete Work Center'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
