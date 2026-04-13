/**
 * Manufacturers Page
 * 
 * Enterprise-grade unified layout for managing manufacturers.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Migration from: AmroSettingsMasterDataPage (entity: 'manufacturers')
 * Benefits:
 * - Consistent layout with all AMRO modules
 * - Standardized table with search, filters, sorting, pagination
 * - Unified action patterns
 * - Standardized data entry forms
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Building2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import {
  AmroUnifiedPageLayout,
  AmroUnifiedTable,
  AmroUnifiedActions,
  AmroUnifiedForm,
  AmroActions,
} from '@/features/module-amro/components/unified';
import type { Column, PaginationConfig, SearchConfig, TableFilter } from '@/features/module-amro/components/unified';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Manufacturer {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  manufacturer_code: string;
  name: string;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  country: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ManufacturerFormData {
  manufacturer_code: string;
  name: string;
  description: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  country: string;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: ManufacturerFormData = {
  manufacturer_code: '',
  name: '',
  description: '',
  contact_email: '',
  contact_phone: '',
  website: '',
  country: '',
  is_active: true,
};

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchManufacturers(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ manufacturers: Manufacturer[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { is_active: params.status === 'active' ? 'true' : 'false' } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/manufacturers?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load manufacturers: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    manufacturers: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createManufacturer(
  accessToken: string,
  tenantId: string,
  data: ManufacturerFormData
): Promise<Manufacturer> {
  const response = await fetch('/api/v2/amro/master-data/manufacturers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      ...data,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `Create failed: ${response.status}`);
  }

  const json = await response.json();
  return json.data || json.output;
}

async function updateManufacturer(
  accessToken: string,
  id: string,
  data: Partial<ManufacturerFormData>
): Promise<Manufacturer> {
  const response = await fetch(`/api/v2/amro/master-data/manufacturers/${id}`, {
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

async function deleteManufacturer(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/manufacturers/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ManufacturersPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';
  const userId = user?.id || '';

  // Get tenant ID from user roles
  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null);
  const [formData, setFormData] = useState<ManufacturerFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ManufacturerFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Manufacturer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Manufacturers ─────────────────────────────────────────────────────

  const loadManufacturers = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchManufacturers(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setManufacturers(result.manufacturers);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load manufacturers');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadManufacturers();
  }, [loadManufacturers]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingManufacturer(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (manufacturer: Manufacturer) => {
    setEditingManufacturer(manufacturer);
    setFormData({
      manufacturer_code: manufacturer.manufacturer_code,
      name: manufacturer.name,
      description: manufacturer.description || '',
      contact_email: manufacturer.contact_email || '',
      contact_phone: manufacturer.contact_phone || '',
      website: manufacturer.website || '',
      country: manufacturer.country || '',
      is_active: manufacturer.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof ManufacturerFormData, string>> = {};

    if (!formData.manufacturer_code.trim()) {
      errors.manufacturer_code = 'Manufacturer code is required';
    }
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      errors.contact_email = 'Invalid email format';
    }

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
      if (editingManufacturer) {
        await updateManufacturer(accessToken, editingManufacturer.id, formData);
        toast.success('Manufacturer updated');
      } else {
        await createManufacturer(accessToken, tenantId, formData);
        toast.success('Manufacturer created');
      }
      setFormOpen(false);
      loadManufacturers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save manufacturer');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (manufacturer: Manufacturer) => {
    setDeleteCandidate(manufacturer);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deleteManufacturer(accessToken, deleteCandidate.id);
      toast.success('Manufacturer deleted');
      loadManufacturers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete manufacturer');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<Manufacturer>[] = [
    {
      key: 'manufacturer_code',
      label: 'Code',
      sortable: true,
      width: 'w-32',
      render: (row) => (
        <Badge variant="outline" className="font-mono">
          {row.manufacturer_code}
        </Badge>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.description && (
            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
              {row.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'contact_email',
      label: 'Email',
      sortable: true,
      render: (row) => row.contact_email || '-',
    },
    {
      key: 'country',
      label: 'Country',
      sortable: true,
      render: (row) => row.country || '-',
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
    onChange: (value) => {
      setSearch(value);
      setPage(1);
    },
    placeholder: 'Search manufacturers...',
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
      onChange: (value) => {
        setStatusFilter(value);
        setPage(1);
      },
    },
  ];

  const paginationConfig: PaginationConfig = {
    page,
    pageSize,
    total,
    onPageChange: setPage,
    pageSizeOptions: [10, 20, 50, 100],
  };

  const getActions = (row: Manufacturer) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Manufacturers"
      description="Manage aircraft parts and component manufacturers"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Manufacturers' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadManufacturers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Manufacturer
          </Button>
        </>
      }
      kpiMetrics={[
        {
          label: 'Total Manufacturers',
          value: total,
          icon: <Building2 className="h-4 w-4" />,
        },
        {
          label: 'Active',
          value: manufacturers.filter(m => m.is_active).length,
          icon: <Building2 className="h-4 w-4" />,
        },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={manufacturers}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No manufacturers found"
        emptyDescription="Create your first manufacturer to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingManufacturer ? 'Edit Manufacturer' : 'Create Manufacturer'}
        description={editingManufacturer ? 'Update manufacturer details' : 'Add a new manufacturer to the system'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingManufacturer ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Section title="Basic Information">
          <AmroUnifiedForm.Field
            label="Manufacturer Code"
            required
            error={formErrors.manufacturer_code}
          >
            <Input
              value={formData.manufacturer_code}
              onChange={(e) => setFormData({ ...formData, manufacturer_code: e.target.value })}
              placeholder="e.g., BOEING, AIRBUS"
              disabled={!!editingManufacturer}
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Name" required error={formErrors.name}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Boeing Commercial Airplanes"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Country" colSpan={1}>
            <Input
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              placeholder="e.g., United States"
            />
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>

        <AmroUnifiedForm.Section title="Contact Information">
          <AmroUnifiedForm.Field
            label="Email"
            error={formErrors.contact_email}
          >
            <Input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              placeholder="contact@manufacturer.com"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Phone">
            <Input
              type="tel"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              placeholder="+1 234 567 8900"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Website" colSpan={2}>
            <Input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://www.manufacturer.com"
            />
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>

        <AmroUnifiedForm.Section title="Description" showSeparator={false}>
          <AmroUnifiedForm.Field label="Description" colSpan={3}>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the manufacturer..."
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
              <label htmlFor="is_active" className="text-sm">
                Active (available for selection in work packages)
              </label>
            </div>
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>
      </AmroUnifiedForm>

      {/* Delete Confirmation */}
      <AmroUnifiedForm
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Confirm Deletion"
        description={`Are you sure you want to delete "${deleteCandidate?.name}"? This action cannot be undone.`}
        onSubmit={confirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeleteCandidate(null);
        }}
        loading={deleteLoading}
        submitLabel="Delete"
        cancelLabel="Cancel"
        showFooter={false}
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
            {deleteLoading ? 'Deleting...' : 'Delete Manufacturer'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
