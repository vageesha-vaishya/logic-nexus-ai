/**
 * Parts Inventory Page
 * 
 * Enterprise-grade unified layout for managing parts inventory.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Complexity: High (stock levels, reorder points, supplier relationships)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Package } from 'lucide-react';
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

interface Part {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  part_number: string;
  name: string;
  description: string | null;
  category: string | null;
  stock_quantity: number;
  reorder_point: number;
  unit_cost: number | null;
  supplier: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PartFormData {
  part_number: string;
  name: string;
  description: string;
  category: string;
  stock_quantity: number;
  reorder_point: number;
  unit_cost: number;
  supplier: string;
  location: string;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: PartFormData = {
  part_number: '',
  name: '',
  description: '',
  category: '',
  stock_quantity: 0,
  reorder_point: 10,
  unit_cost: 0,
  supplier: '',
  location: '',
  is_active: true,
};

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchParts(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ parts: Part[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { is_active: params.status === 'active' ? 'true' : 'false' } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/parts_inventory?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load parts: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    parts: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createPart(accessToken: string, tenantId: string, data: PartFormData): Promise<Part> {
  const response = await fetch('/api/v2/amro/master-data/parts_inventory', {
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

async function updatePart(accessToken: string, id: string, data: Partial<PartFormData>): Promise<Part> {
  const response = await fetch(`/api/v2/amro/master-data/parts_inventory/${id}`, {
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

async function deletePart(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/parts_inventory/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ────────────────────────────────────────────────────────────────

export function PartsInventoryPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';

  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [formData, setFormData] = useState<PartFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof PartFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Part | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Parts ─────────────────────────────────────────────────────────

  const loadParts = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchParts(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setParts(result.parts);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load parts');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadParts();
  }, [loadParts]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingPart(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (part: Part) => {
    setEditingPart(part);
    setFormData({
      part_number: part.part_number,
      name: part.name,
      description: part.description || '',
      category: part.category || '',
      stock_quantity: part.stock_quantity,
      reorder_point: part.reorder_point,
      unit_cost: part.unit_cost || 0,
      supplier: part.supplier || '',
      location: part.location || '',
      is_active: part.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof PartFormData, string>> = {};

    if (!formData.part_number.trim()) errors.part_number = 'Part number is required';
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
      if (editingPart) {
        await updatePart(accessToken, editingPart.id, formData);
        toast.success('Part updated');
      } else {
        await createPart(accessToken, tenantId, formData);
        toast.success('Part created');
      }
      setFormOpen(false);
      loadParts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save part');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (part: Part) => {
    setDeleteCandidate(part);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deletePart(accessToken, deleteCandidate.id);
      toast.success('Part deleted');
      loadParts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete part');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<Part>[] = [
    {
      key: 'part_number',
      label: 'Part Number',
      sortable: true,
      width: 'w-36',
      render: (row) => <Badge variant="outline" className="font-mono">{row.part_number}</Badge>,
    },
    {
      key: 'name',
      label: 'Part Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.category && <div className="text-xs text-muted-foreground">{row.category}</div>}
        </div>
      ),
    },
    {
      key: 'stock_quantity',
      label: 'Stock',
      sortable: true,
      render: (row) => {
        const isLow = row.stock_quantity <= row.reorder_point;
        return (
          <Badge variant={isLow ? 'destructive' : 'default'}>
            {row.stock_quantity} {isLow && '(Low)'}
          </Badge>
        );
      },
    },
    {
      key: 'reorder_point',
      label: 'Reorder Point',
      sortable: true,
      render: (row) => row.reorder_point || '-',
    },
    {
      key: 'unit_cost',
      label: 'Unit Cost',
      sortable: true,
      render: (row) => row.unit_cost ? `$${row.unit_cost.toFixed(2)}` : '-',
    },
    {
      key: 'location',
      label: 'Location',
      sortable: true,
      render: (row) => row.location || '-',
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
    placeholder: 'Search parts by number, name...',
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

  const getActions = (row: Part) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Parts Inventory"
      description="Manage aircraft parts and components inventory"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Parts Inventory' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadParts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Part
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Parts', value: total, icon: <Package className="h-4 w-4" /> },
        { label: 'Low Stock', value: parts.filter(p => p.stock_quantity <= p.reorder_point).length, icon: <Package className="h-4 w-4" /> },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={parts}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No parts found"
        emptyDescription="Create your first part to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingPart ? 'Edit Part' : 'Create Part'}
        description={editingPart ? 'Update part details' : 'Add a new part to the inventory'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingPart ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Tabs defaultValue="basic">
          <AmroUnifiedForm.Tab value="basic" label="Basic Info">
            <AmroUnifiedForm.Section title="Part Information">
              <AmroUnifiedForm.Field label="Part Number" required error={formErrors.part_number}>
                <Input
                  value={formData.part_number}
                  onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                  placeholder="e.g., PN-12345, PN-737-800-001"
                  disabled={!!editingPart}
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Part Name" required error={formErrors.name}>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Landing Gear Assembly"
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Category">
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Landing Gear, Avionics"
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Description" colSpan={3}>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description of the part..."
                  rows={3}
                />
              </AmroUnifiedForm.Field>
            </AmroUnifiedForm.Section>
          </AmroUnifiedForm.Tab>

          <AmroUnifiedForm.Tab value="inventory" label="Inventory">
            <AmroUnifiedForm.Section title="Stock Management">
              <AmroUnifiedForm.Field label="Stock Quantity">
                <Input
                  type="number"
                  min={0}
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Reorder Point">
                <Input
                  type="number"
                  min={0}
                  value={formData.reorder_point}
                  onChange={(e) => setFormData({ ...formData, reorder_point: parseInt(e.target.value) || 0 })}
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Unit Cost ($)">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: parseFloat(e.target.value) || 0 })}
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Storage Location">
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Warehouse A, Shelf B-12"
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Supplier">
                <Input
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="e.g., Boeing Parts Supplier"
                />
              </AmroUnifiedForm.Field>
            </AmroUnifiedForm.Section>
          </AmroUnifiedForm.Tab>

          <AmroUnifiedForm.Tab value="status" label="Status">
            <AmroUnifiedForm.Section title="Status" showSeparator={false}>
              <AmroUnifiedForm.Field label="Active Status" colSpan={3}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="is_active" className="text-sm">Active (available for work package assignment)</label>
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
        description={`Are you sure you want to delete part "${deleteCandidate?.part_number} - ${deleteCandidate?.name}"?`}
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
            {deleteLoading ? 'Deleting...' : 'Delete Part'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
