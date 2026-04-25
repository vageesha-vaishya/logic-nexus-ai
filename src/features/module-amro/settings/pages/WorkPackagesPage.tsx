/**
 * Work Packages Page (Settings → Master Data)
 * 
 * Enterprise-grade unified layout for managing work packages in settings.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Complexity: High (template relationships, aircraft assignments, task execution)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, CheckSquare } from 'lucide-react';
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

// ── Types ──────────────────────────────────────────────────────────────────

interface WorkPackage {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  work_package_number: string;
  title: string;
  description: string | null;
  aircraft_id: string | null;
  aircraft_registration: string | null;
  template_id: string | null;
  status: string;
  priority: number;
  planned_start_date: string | null;
  planned_end_date: string | null;
  assigned_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WorkPackageFormData {
  work_package_number: string;
  title: string;
  description: string;
  aircraft_id: string;
  template_id: string;
  status: string;
  priority: number;
  planned_start_date: string;
  planned_end_date: string;
  assigned_to: string;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: WorkPackageFormData = {
  work_package_number: '',
  title: '',
  description: '',
  aircraft_id: '',
  template_id: '',
  status: 'planning',
  priority: 3,
  planned_start_date: '',
  planned_end_date: '',
  assigned_to: '',
  is_active: true,
};

const WORK_PACKAGE_STATUSES = ['planning', 'scheduled', 'in_progress', 'completed', 'cancelled'];
const PRIORITY_LABELS: Record<number, string> = { 1: 'P1 - Critical', 2: 'P2 - High', 3: 'P3 - Medium', 4: 'P4 - Low', 5: 'P5 - Routine' };

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchWorkPackages(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ workPackages: WorkPackage[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/work_orders?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load work packages: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    workPackages: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createWorkPackage(accessToken: string, tenantId: string, data: WorkPackageFormData): Promise<WorkPackage> {
  const response = await fetch('/api/v2/amro/master-data/work_orders', {
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

async function updateWorkPackage(accessToken: string, id: string, data: Partial<WorkPackageFormData>): Promise<WorkPackage> {
  const response = await fetch(`/api/v2/amro/master-data/work_orders/${id}`, {
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

async function deleteWorkPackage(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/work_orders/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ────────────────────────────────────────────────────────────────

export function WorkPackagesPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';

  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingWorkPackage, setEditingWorkPackage] = useState<WorkPackage | null>(null);
  const [formData, setFormData] = useState<WorkPackageFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof WorkPackageFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<WorkPackage | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Work Packages ─────────────────────────────────────────────────

  const loadWorkPackages = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchWorkPackages(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setWorkPackages(result.workPackages);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load work packages');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadWorkPackages();
  }, [loadWorkPackages]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingWorkPackage(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (wp: WorkPackage) => {
    setEditingWorkPackage(wp);
    setFormData({
      work_package_number: wp.work_package_number,
      title: wp.title,
      description: wp.description || '',
      aircraft_id: wp.aircraft_id || '',
      template_id: wp.template_id || '',
      status: wp.status,
      priority: wp.priority,
      planned_start_date: wp.planned_start_date || '',
      planned_end_date: wp.planned_end_date || '',
      assigned_to: wp.assigned_to || '',
      is_active: wp.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof WorkPackageFormData, string>> = {};

    if (!formData.work_package_number.trim()) errors.work_package_number = 'Work package number is required';
    if (!formData.title.trim()) errors.title = 'Title is required';

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
      if (editingWorkPackage) {
        await updateWorkPackage(accessToken, editingWorkPackage.id, formData);
        toast.success('Work package updated');
      } else {
        await createWorkPackage(accessToken, tenantId, formData);
        toast.success('Work package created');
      }
      setFormOpen(false);
      loadWorkPackages();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save work package');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (wp: WorkPackage) => {
    setDeleteCandidate(wp);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deleteWorkPackage(accessToken, deleteCandidate.id);
      toast.success('Work package deleted');
      loadWorkPackages();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete work package');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<WorkPackage>[] = [
    {
      key: 'work_package_number',
      label: 'WP Number',
      sortable: true,
      width: 'w-36',
      render: (row) => <Badge variant="outline" className="font-mono">{row.work_package_number}</Badge>,
    },
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.title}</div>
          {row.aircraft_registration && <div className="text-xs text-muted-foreground">{row.aircraft_registration}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <Badge variant={row.status === 'completed' ? 'default' : row.status === 'in_progress' ? 'outline' : 'secondary'}>
          {row.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      render: (row) => (
        <Badge variant={row.priority <= 2 ? 'destructive' : row.priority <= 3 ? 'default' : 'outline'}>
          {PRIORITY_LABELS[row.priority] || `P${row.priority}`}
        </Badge>
      ),
    },
    {
      key: 'planned_start_date',
      label: 'Planned Start',
      sortable: true,
      render: (row) => row.planned_start_date ? new Date(row.planned_start_date).toLocaleDateString() : '-',
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
    placeholder: 'Search work packages...',
  };

  const filters: TableFilter[] = [
    {
      key: 'status',
      label: 'Status',
      options: WORK_PACKAGE_STATUSES.map(s => ({ label: s.replace('_', ' ').charAt(0).toUpperCase() + s.slice(1), value: s })),
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

  const getActions = (row: WorkPackage) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Work Packages"
      description="Manage work package definitions and templates"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Work Packages' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadWorkPackages} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Work Package
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Work Packages', value: total, icon: <CheckSquare className="h-4 w-4" /> },
        { label: 'In Progress', value: workPackages.filter(wp => wp.status === 'in_progress').length, icon: <CheckSquare className="h-4 w-4" /> },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={workPackages}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No work packages found"
        emptyDescription="Create your first work package to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingWorkPackage ? 'Edit Work Package' : 'Create Work Package'}
        description={editingWorkPackage ? 'Update work package details' : 'Add a new work package'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingWorkPackage ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Tabs defaultValue="basic">
          <AmroUnifiedForm.Tab value="basic" label="Basic Info">
            <AmroUnifiedForm.Section title="Work Package Details">
              <AmroUnifiedForm.Field label="WP Number" required error={formErrors.work_package_number}>
                <Input
                  value={formData.work_package_number}
                  onChange={(e) => setFormData({ ...formData, work_package_number: e.target.value })}
                  placeholder="e.g., WP-2024-001"
                  disabled={!!editingWorkPackage}
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Title" required error={formErrors.title}>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., A-Check Maintenance"
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Description" colSpan={3}>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description of the work package..."
                  rows={3}
                />
              </AmroUnifiedForm.Field>
            </AmroUnifiedForm.Section>
          </AmroUnifiedForm.Tab>

          <AmroUnifiedForm.Tab value="assignment" label="Assignment">
            <AmroUnifiedForm.Section title="Aircraft & Template">
              <AmroUnifiedForm.Field label="Aircraft ID">
                <Input
                  value={formData.aircraft_id}
                  onChange={(e) => setFormData({ ...formData, aircraft_id: e.target.value })}
                  placeholder="Aircraft ID or Registration"
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Template ID">
                <Input
                  value={formData.template_id}
                  onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
                  placeholder="Template ID"
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Assigned To">
                <Input
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  placeholder="Technician or Team"
                />
              </AmroUnifiedForm.Field>
            </AmroUnifiedForm.Section>

            <AmroUnifiedForm.Section title="Schedule">
              <AmroUnifiedForm.Field label="Planned Start Date">
                <Input
                  type="date"
                  value={formData.planned_start_date}
                  onChange={(e) => setFormData({ ...formData, planned_start_date: e.target.value })}
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Planned End Date">
                <Input
                  type="date"
                  value={formData.planned_end_date}
                  onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
                />
              </AmroUnifiedForm.Field>
            </AmroUnifiedForm.Section>
          </AmroUnifiedForm.Tab>

          <AmroUnifiedForm.Tab value="status" label="Status & Priority">
            <AmroUnifiedForm.Section title="Status">
              <AmroUnifiedForm.Field label="Work Package Status">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {WORK_PACKAGE_STATUSES.map(status => (
                    <option key={status} value={status}>{status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1)}</option>
                  ))}
                </select>
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Priority">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
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
                  <label htmlFor="is_active" className="text-sm">Active (available for task execution)</label>
                </div>
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
        description={`Are you sure you want to delete work package "${deleteCandidate?.work_package_number}"?`}
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
            {deleteLoading ? 'Deleting...' : 'Delete Work Package'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
