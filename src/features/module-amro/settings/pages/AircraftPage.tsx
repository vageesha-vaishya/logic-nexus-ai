/**
 * Aircraft Page
 * 
 * Enterprise-grade unified layout for managing aircraft.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Complexity: High (many fields, relationships, tabs)
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

interface Aircraft {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  registration: string;
  model: string | null;
  manufacturer: string | null;
  serial_number: string | null;
  year_manufactured: number | null;
  status: string;
  location: string | null;
  total_flight_hours: number | null;
  total_cycles: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AircraftFormData {
  registration: string;
  model: string;
  manufacturer: string;
  serial_number: string;
  year_manufactured: number;
  status: string;
  location: string;
  total_flight_hours: number;
  total_cycles: number;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: AircraftFormData = {
  registration: '',
  model: '',
  manufacturer: '',
  serial_number: '',
  year_manufactured: new Date().getFullYear(),
  status: 'pending',
  location: '',
  total_flight_hours: 0,
  total_cycles: 0,
  is_active: true,
};

const AIRCRAFT_STATUSES = ['pending', 'active', 'maintenance', 'grounded', 'retired', 'storage'];

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchAircraft(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ aircraft: Aircraft[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/aircraft?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load aircraft: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    aircraft: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createAircraft(accessToken: string, tenantId: string, data: AircraftFormData): Promise<Aircraft> {
  const response = await fetch('/api/v2/amro/master-data/aircraft', {
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

async function updateAircraft(accessToken: string, id: string, data: Partial<AircraftFormData>): Promise<Aircraft> {
  const response = await fetch(`/api/v2/amro/master-data/aircraft/${id}`, {
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

async function deleteAircraft(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/aircraft/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ────────────────────────────────────────────────────────────────

export function AircraftPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';

  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingAircraft, setEditingAircraft] = useState<Aircraft | null>(null);
  const [formData, setFormData] = useState<AircraftFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AircraftFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<Aircraft | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Aircraft ─────────────────────────────────────────────────────

  const loadAircraft = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchAircraft(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setAircraft(result.aircraft);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load aircraft');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadAircraft();
  }, [loadAircraft]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingAircraft(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (ac: Aircraft) => {
    setEditingAircraft(ac);
    setFormData({
      registration: ac.registration,
      model: ac.model || '',
      manufacturer: ac.manufacturer || '',
      serial_number: ac.serial_number || '',
      year_manufactured: ac.year_manufactured || new Date().getFullYear(),
      status: ac.status,
      location: ac.location || '',
      total_flight_hours: ac.total_flight_hours || 0,
      total_cycles: ac.total_cycles || 0,
      is_active: ac.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof AircraftFormData, string>> = {};

    if (!formData.registration.trim()) errors.registration = 'Registration is required';
    if (!formData.model.trim()) errors.model = 'Model is required';

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
      if (editingAircraft) {
        await updateAircraft(accessToken, editingAircraft.id, formData);
        toast.success('Aircraft updated');
      } else {
        await createAircraft(accessToken, tenantId, formData);
        toast.success('Aircraft created');
      }
      setFormOpen(false);
      loadAircraft();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save aircraft');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (ac: Aircraft) => {
    setDeleteCandidate(ac);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deleteAircraft(accessToken, deleteCandidate.id);
      toast.success('Aircraft deleted');
      loadAircraft();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete aircraft');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<Aircraft>[] = [
    {
      key: 'registration',
      label: 'Registration',
      sortable: true,
      width: 'w-36',
      render: (row) => <Badge variant="outline" className="font-mono">{row.registration}</Badge>,
    },
    {
      key: 'model',
      label: 'Aircraft',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.model || '-'}</div>
          {row.manufacturer && <div className="text-xs text-muted-foreground">{row.manufacturer}</div>}
        </div>
      ),
    },
    {
      key: 'serial_number',
      label: 'Serial Number',
      sortable: true,
      render: (row) => row.serial_number || '-',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'default' : row.status === 'maintenance' ? 'outline' : 'secondary'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      sortable: true,
      render: (row) => row.location || '-',
    },
    {
      key: 'total_flight_hours',
      label: 'Flight Hours',
      sortable: true,
      render: (row) => row.total_flight_hours ? `${row.total_flight_hours.toLocaleString()} hrs` : '-',
    },
  ];

  const searchConfig: SearchConfig = {
    value: search,
    onChange: (value) => { setSearch(value); setPage(1); },
    placeholder: 'Search aircraft by registration, model...',
  };

  const filters: TableFilter[] = [
    {
      key: 'status',
      label: 'Status',
      options: AIRCRAFT_STATUSES.map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s })),
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

  const getActions = (row: Aircraft) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Aircraft"
      description="Manage aircraft fleet records and specifications"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Aircraft' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadAircraft} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Aircraft
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Aircraft', value: total, icon: <Plane className="h-4 w-4" /> },
        { label: 'Active', value: aircraft.filter(a => a.status === 'active').length, icon: <Plane className="h-4 w-4" /> },
        { label: 'In Maintenance', value: aircraft.filter(a => a.status === 'maintenance').length, icon: <Plane className="h-4 w-4" /> },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={aircraft}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No aircraft found"
        emptyDescription="Create your first aircraft to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingAircraft ? 'Edit Aircraft' : 'Create Aircraft'}
        description={editingAircraft ? 'Update aircraft details' : 'Add a new aircraft to the fleet'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingAircraft ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Tabs defaultValue="basic">
          <AmroUnifiedForm.Tab value="basic" label="Basic Info">
            <AmroUnifiedForm.Section title="Identification">
              <AmroUnifiedForm.Field label="Registration" required error={formErrors.registration}>
                <Input
                  value={formData.registration}
                  onChange={(e) => setFormData({ ...formData, registration: e.target.value.toUpperCase() })}
                  placeholder="e.g., VT-ABC, N12345"
                  disabled={!!editingAircraft}
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Model" required error={formErrors.model}>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g., Boeing 737-800, Airbus A320"
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Manufacturer">
                <Input
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="e.g., Boeing, Airbus"
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Serial Number">
                <Input
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  placeholder="e.g., 12345"
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Year Manufactured">
                <Input
                  type="number"
                  min={1950}
                  max={new Date().getFullYear() + 5}
                  value={formData.year_manufactured}
                  onChange={(e) => setFormData({ ...formData, year_manufactured: parseInt(e.target.value) || 0 })}
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Status">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {AIRCRAFT_STATUSES.map(status => (
                    <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                  ))}
                </select>
              </AmroUnifiedForm.Field>
            </AmroUnifiedForm.Section>
          </AmroUnifiedForm.Tab>

          <AmroUnifiedForm.Tab value="location" label="Location & Usage">
            <AmroUnifiedForm.Section title="Location">
              <AmroUnifiedForm.Field label="Current Location" colSpan={3}>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Hangar 1, Gate A5"
                />
              </AmroUnifiedForm.Field>
            </AmroUnifiedForm.Section>

            <AmroUnifiedForm.Section title="Usage Statistics">
              <AmroUnifiedForm.Field label="Total Flight Hours">
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={formData.total_flight_hours}
                  onChange={(e) => setFormData({ ...formData, total_flight_hours: parseFloat(e.target.value) || 0 })}
                />
              </AmroUnifiedForm.Field>

              <AmroUnifiedForm.Field label="Total Cycles">
                <Input
                  type="number"
                  min={0}
                  value={formData.total_cycles}
                  onChange={(e) => setFormData({ ...formData, total_cycles: parseInt(e.target.value) || 0 })}
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
        description={`Are you sure you want to delete aircraft "${deleteCandidate?.registration}"?`}
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
            {deleteLoading ? 'Deleting...' : 'Delete Aircraft'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
