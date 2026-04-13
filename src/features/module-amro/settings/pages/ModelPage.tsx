/**
 * Model Page
 * 
 * Enterprise-grade unified layout for managing aircraft models.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Complexity: Medium (manufacturer relationship, specifications)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Plane } from 'lucide-react';
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

interface Model {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  model_code: string;
  name: string;
  description: string | null;
  manufacturer: string | null;
  aircraft_type: string | null;
  engine_type: string | null;
  capacity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ModelFormData {
  model_code: string;
  name: string;
  description: string;
  manufacturer: string;
  aircraft_type: string;
  engine_type: string;
  capacity: number;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: ModelFormData = {
  model_code: '',
  name: '',
  description: '',
  manufacturer: '',
  aircraft_type: '',
  engine_type: '',
  capacity: 0,
  is_active: true,
};

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchModels(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ models: Model[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { is_active: params.status === 'active' ? 'true' : 'false' } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/model?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load models: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    models: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createModel(accessToken: string, tenantId: string, data: ModelFormData): Promise<Model> {
  const response = await fetch('/api/v2/amro/master-data/model', {
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

async function updateModel(accessToken: string, id: string, data: Partial<ModelFormData>): Promise<Model> {
  const response = await fetch(`/api/v2/amro/master-data/model/${id}`, {
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

async function deleteModel(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/model/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ────────────────────────────────────────────────────────────────

export function ModelPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';

  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [formData, setFormData] = useState<ModelFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ModelFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Model | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Models ─────────────────────────────────────────────────────────

  const loadModels = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchModels(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setModels(result.models);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingModel(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (model: Model) => {
    setEditingModel(model);
    setFormData({
      model_code: model.model_code,
      name: model.name,
      description: model.description || '',
      manufacturer: model.manufacturer || '',
      aircraft_type: model.aircraft_type || '',
      engine_type: model.engine_type || '',
      capacity: model.capacity || 0,
      is_active: model.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof ModelFormData, string>> = {};

    if (!formData.model_code.trim()) errors.model_code = 'Model code is required';
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
      if (editingModel) {
        await updateModel(accessToken, editingModel.id, formData);
        toast.success('Model updated');
      } else {
        await createModel(accessToken, tenantId, formData);
        toast.success('Model created');
      }
      setFormOpen(false);
      loadModels();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save model');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (model: Model) => {
    setDeleteCandidate(model);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deleteModel(accessToken, deleteCandidate.id);
      toast.success('Model deleted');
      loadModels();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete model');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<Model>[] = [
    {
      key: 'model_code',
      label: 'Code',
      sortable: true,
      width: 'w-32',
      render: (row) => <Badge variant="outline" className="font-mono">{row.model_code}</Badge>,
    },
    {
      key: 'name',
      label: 'Model Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.manufacturer && <div className="text-xs text-muted-foreground">{row.manufacturer}</div>}
        </div>
      ),
    },
    {
      key: 'aircraft_type',
      label: 'Type',
      sortable: true,
      render: (row) => row.aircraft_type || '-',
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
    placeholder: 'Search models...',
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

  const getActions = (row: Model) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Aircraft Models"
      description="Manage aircraft model definitions and specifications"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Models' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadModels} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Model
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Models', value: total, icon: <Plane className="h-4 w-4" /> },
        { label: 'Active', value: models.filter(m => m.is_active).length, icon: <Plane className="h-4 w-4" /> },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={models}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No aircraft models found"
        emptyDescription="Create your first aircraft model to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingModel ? 'Edit Model' : 'Create Model'}
        description={editingModel ? 'Update model details' : 'Add a new aircraft model to the system'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingModel ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Section title="Basic Information">
          <AmroUnifiedForm.Field label="Model Code" required error={formErrors.model_code}>
            <Input
              value={formData.model_code}
              onChange={(e) => setFormData({ ...formData, model_code: e.target.value })}
              placeholder="e.g., B737-800, A320neo"
              disabled={!!editingModel}
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Model Name" required error={formErrors.name}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Boeing 737-800"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Manufacturer">
            <Input
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              placeholder="e.g., Boeing, Airbus"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Aircraft Type">
            <Input
              value={formData.aircraft_type}
              onChange={(e) => setFormData({ ...formData, aircraft_type: e.target.value })}
              placeholder="e.g., Narrow-body, Wide-body"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Engine Type">
            <Input
              value={formData.engine_type}
              onChange={(e) => setFormData({ ...formData, engine_type: e.target.value })}
              placeholder="e.g., CFM56-7B, LEAP-1A"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Capacity (passengers)">
            <Input
              type="number"
              min={0}
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
              placeholder="180"
            />
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>

        <AmroUnifiedForm.Section title="Description" showSeparator={false}>
          <AmroUnifiedForm.Field label="Description" colSpan={3}>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description of the aircraft model..."
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
              <label htmlFor="is_active" className="text-sm">Active (available for aircraft assignment)</label>
            </div>
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>
      </AmroUnifiedForm>

      {/* Delete Confirmation */}
      <AmroUnifiedForm
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Confirm Deletion"
        description={`Are you sure you want to delete model "${deleteCandidate?.model_code} - ${deleteCandidate?.name}"?`}
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
            {deleteLoading ? 'Deleting...' : 'Delete Model'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
