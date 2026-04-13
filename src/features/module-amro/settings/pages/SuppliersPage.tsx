/**
 * Suppliers Page
 * 
 * Enterprise-grade unified layout for managing suppliers.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Complexity: Medium (additional contact and rating fields)
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

// ── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  supplier_code: string;
  name: string;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  rating: number | null;
  lead_time_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SupplierFormData {
  supplier_code: string;
  name: string;
  description: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  city: string;
  country: string;
  website: string;
  rating: number;
  lead_time_days: number;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: SupplierFormData = {
  supplier_code: '',
  name: '',
  description: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  city: '',
  country: '',
  website: '',
  rating: 3,
  lead_time_days: 7,
  is_active: true,
};

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchSuppliers(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ suppliers: Supplier[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { is_active: params.status === 'active' ? 'true' : 'false' } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/suppliers?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load suppliers: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    suppliers: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createSupplier(accessToken: string, tenantId: string, data: SupplierFormData): Promise<Supplier> {
  const response = await fetch('/api/v2/amro/master-data/suppliers', {
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

async function updateSupplier(accessToken: string, id: string, data: Partial<SupplierFormData>): Promise<Supplier> {
  const response = await fetch(`/api/v2/amro/master-data/suppliers/${id}`, {
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

async function deleteSupplier(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/suppliers/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SuppliersPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';

  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof SupplierFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Supplier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Suppliers ─────────────────────────────────────────────────────

  const loadSuppliers = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchSuppliers(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setSuppliers(result.suppliers);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingSupplier(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      supplier_code: supplier.supplier_code,
      name: supplier.name,
      description: supplier.description || '',
      contact_name: supplier.contact_name || '',
      contact_email: supplier.contact_email || '',
      contact_phone: supplier.contact_phone || '',
      address: supplier.address || '',
      city: supplier.city || '',
      country: supplier.country || '',
      website: supplier.website || '',
      rating: supplier.rating || 3,
      lead_time_days: supplier.lead_time_days || 7,
      is_active: supplier.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof SupplierFormData, string>> = {};

    if (!formData.supplier_code.trim()) errors.supplier_code = 'Supplier code is required';
    if (!formData.name.trim()) errors.name = 'Name is required';
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
      if (editingSupplier) {
        await updateSupplier(accessToken, editingSupplier.id, formData);
        toast.success('Supplier updated');
      } else {
        await createSupplier(accessToken, tenantId, formData);
        toast.success('Supplier created');
      }
      setFormOpen(false);
      loadSuppliers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save supplier');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (supplier: Supplier) => {
    setDeleteCandidate(supplier);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deleteSupplier(accessToken, deleteCandidate.id);
      toast.success('Supplier deleted');
      loadSuppliers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete supplier');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<Supplier>[] = [
    {
      key: 'supplier_code',
      label: 'Code',
      sortable: true,
      width: 'w-32',
      render: (row) => <Badge variant="outline" className="font-mono">{row.supplier_code}</Badge>,
    },
    {
      key: 'name',
      label: 'Supplier Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.city && <div className="text-xs text-muted-foreground">{row.city}, {row.country}</div>}
        </div>
      ),
    },
    {
      key: 'contact_name',
      label: 'Contact',
      sortable: true,
      render: (row) => row.contact_name || '-',
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (row) => row.rating ? (
        <div className="flex items-center gap-1">
          {'★'.repeat(Math.floor(row.rating))}
          {'☆'.repeat(5 - Math.floor(row.rating))}
          <span className="text-xs text-muted-foreground ml-1">({row.rating})</span>
        </div>
      ) : '-',
    },
    {
      key: 'lead_time_days',
      label: 'Lead Time',
      sortable: true,
      render: (row) => row.lead_time_days ? `${row.lead_time_days} days` : '-',
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
    placeholder: 'Search suppliers...',
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

  const getActions = (row: Supplier) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Suppliers"
      description="Manage aircraft parts and component suppliers"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Suppliers' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadSuppliers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Supplier
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Suppliers', value: total, icon: <Building2 className="h-4 w-4" /> },
        { label: 'Active', value: suppliers.filter(s => s.is_active).length, icon: <Building2 className="h-4 w-4" /> },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={suppliers}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No suppliers found"
        emptyDescription="Create your first supplier to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingSupplier ? 'Edit Supplier' : 'Create Supplier'}
        description={editingSupplier ? 'Update supplier details' : 'Add a new supplier to the system'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingSupplier ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Section title="Basic Information">
          <AmroUnifiedForm.Field label="Supplier Code" required error={formErrors.supplier_code}>
            <Input
              value={formData.supplier_code}
              onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value })}
              placeholder="e.g., SUP-001"
              disabled={!!editingSupplier}
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Name" required error={formErrors.name}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Boeing Supplier Corp"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Website" colSpan={2}>
            <Input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://www.supplier.com"
            />
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>

        <AmroUnifiedForm.Section title="Contact Information">
          <AmroUnifiedForm.Field label="Contact Name">
            <Input
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              placeholder="John Doe"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Email" error={formErrors.contact_email}>
            <Input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              placeholder="contact@supplier.com"
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
        </AmroUnifiedForm.Section>

        <AmroUnifiedForm.Section title="Address">
          <AmroUnifiedForm.Field label="Address" colSpan={2}>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Supplier Street"
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

        <AmroUnifiedForm.Section title="Performance Metrics">
          <AmroUnifiedForm.Field label="Rating (1-5)">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n} - {'★'.repeat(n)}{'☆'.repeat(5-n)}</option>
              ))}
            </select>
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Lead Time (days)">
            <Input
              type="number"
              min={1}
              value={formData.lead_time_days}
              onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 1 })}
              placeholder="7"
            />
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>

        <AmroUnifiedForm.Section title="Description" showSeparator={false}>
          <AmroUnifiedForm.Field label="Description" colSpan={3}>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the supplier..."
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
              <label htmlFor="is_active" className="text-sm">Active (available for procurement)</label>
            </div>
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>
      </AmroUnifiedForm>

      {/* Delete Confirmation */}
      <AmroUnifiedForm
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Confirm Deletion"
        description={`Are you sure you want to delete supplier "${deleteCandidate?.name}"?`}
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
            {deleteLoading ? 'Deleting...' : 'Delete Supplier'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
