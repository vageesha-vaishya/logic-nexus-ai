/**
 * Maintenance Facilities Page
 * 
 * Enterprise-grade unified layout for managing maintenance facilities.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Complexity: Medium (location, capacity, certifications fields)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Building2 } from 'lucide-react';
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

interface MaintenanceFacility {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  code: string;
  name: string;
  description: string | null;
  location: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  capacity: number | null;
  certifications: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MaintenanceFacilityFormData {
  code: string;
  name: string;
  description: string;
  location: string;
  address: string;
  city: string;
  country: string;
  capacity: number;
  certifications: string;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: MaintenanceFacilityFormData = {
  code: '',
  name: '',
  description: '',
  location: '',
  address: '',
  city: '',
  country: '',
  capacity: 1,
  certifications: '',
  is_active: true,
};

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchMaintenanceFacilities(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ facilities: MaintenanceFacility[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { is_active: params.status === 'active' ? 'true' : 'false' } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/maintenance_facilities?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load maintenance facilities: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    facilities: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createMaintenanceFacility(accessToken: string, tenantId: string, data: MaintenanceFacilityFormData): Promise<MaintenanceFacility> {
  const response = await fetch('/api/v2/amro/master-data/maintenance_facilities', {
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

async function updateMaintenanceFacility(accessToken: string, id: string, data: Partial<MaintenanceFacilityFormData>): Promise<MaintenanceFacility> {
  const response = await fetch(`/api/v2/amro/master-data/maintenance_facilities/${id}`, {
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

async function deleteMaintenanceFacility(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/maintenance_facilities/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ────────────────────────────────────────────────────────────────

export function MaintenanceFacilitiesPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';

  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [facilities, setFacilities] = useState<MaintenanceFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<MaintenanceFacility | null>(null);
  const [formData, setFormData] = useState<MaintenanceFacilityFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof MaintenanceFacilityFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<MaintenanceFacility | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Facilities ─────────────────────────────────────────────────────

  const loadFacilities = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchMaintenanceFacilities(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setFacilities(result.facilities);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load maintenance facilities');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingFacility(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (facility: MaintenanceFacility) => {
    setEditingFacility(facility);
    setFormData({
      code: facility.code,
      name: facility.name,
      description: facility.description || '',
      location: facility.location || '',
      address: facility.address || '',
      city: facility.city || '',
      country: facility.country || '',
      capacity: facility.capacity || 1,
      certifications: facility.certifications || '',
      is_active: facility.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof MaintenanceFacilityFormData, string>> = {};

    if (!formData.code.trim()) errors.code = 'Facility code is required';
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
      if (editingFacility) {
        await updateMaintenanceFacility(accessToken, editingFacility.id, formData);
        toast.success('Maintenance facility updated');
      } else {
        await createMaintenanceFacility(accessToken, tenantId, formData);
        toast.success('Maintenance facility created');
      }
      setFormOpen(false);
      loadFacilities();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save maintenance facility');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (facility: MaintenanceFacility) => {
    setDeleteCandidate(facility);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deleteMaintenanceFacility(accessToken, deleteCandidate.id);
      toast.success('Maintenance facility deleted');
      loadFacilities();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete maintenance facility');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<MaintenanceFacility>[] = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      width: 'w-32',
      render: (row) => <Badge variant="outline" className="font-mono">{row.code}</Badge>,
    },
    {
      key: 'name',
      label: 'Facility Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.city && <div className="text-xs text-muted-foreground">{row.city}, {row.country}</div>}
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      sortable: true,
      render: (row) => row.location || '-',
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
    placeholder: 'Search maintenance facilities...',
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

  const getActions = (row: MaintenanceFacility) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Maintenance Facilities"
      description="Manage aircraft maintenance facilities and hangars"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Maintenance Facilities' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadFacilities} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Facility
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Facilities', value: total, icon: <Building2 className="h-4 w-4" /> },
        { label: 'Active', value: facilities.filter(f => f.is_active).length, icon: <Building2 className="h-4 w-4" /> },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={facilities}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No maintenance facilities found"
        emptyDescription="Create your first maintenance facility to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingFacility ? 'Edit Maintenance Facility' : 'Create Maintenance Facility'}
        description={editingFacility ? 'Update facility details' : 'Add a new maintenance facility to the system'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingFacility ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Section title="Basic Information">
          <AmroUnifiedForm.Field label="Facility Code" required error={formErrors.code}>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., HANGAR-1, FAC-001"
              disabled={!!editingFacility}
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Facility Name" required error={formErrors.name}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Main Maintenance Hangar"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Location">
            <Input
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Terminal A, Bay 5"
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

        <AmroUnifiedForm.Section title="Address">
          <AmroUnifiedForm.Field label="Address" colSpan={2}>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Airport Road"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="City">
            <Input
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Seattle"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Country" colSpan={2}>
            <Input
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              placeholder="United States"
            />
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>

        <AmroUnifiedForm.Section title="Certifications" showSeparator={false}>
          <AmroUnifiedForm.Field label="Certifications" colSpan={3}>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.certifications}
              onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
              placeholder="FAA Part 145, EASA Part 145, etc."
              rows={3}
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Description" colSpan={3}>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description of the facility..."
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
              <label htmlFor="is_active" className="text-sm">Active (available for maintenance scheduling)</label>
            </div>
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>
      </AmroUnifiedForm>

      {/* Delete Confirmation */}
      <AmroUnifiedForm
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Confirm Deletion"
        description={`Are you sure you want to delete maintenance facility "${deleteCandidate?.code} - ${deleteCandidate?.name}"?`}
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
            {deleteLoading ? 'Deleting...' : 'Delete Facility'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
