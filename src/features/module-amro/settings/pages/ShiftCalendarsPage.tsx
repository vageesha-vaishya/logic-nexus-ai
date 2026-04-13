/**
 * Shift Calendars Page
 * 
 * Enterprise-grade unified layout for managing shift calendars.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Complexity: Low (simple CRUD entity with date fields)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Calendar } from 'lucide-react';
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

interface ShiftCalendar {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  shift_pattern: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ShiftCalendarFormData {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  shift_pattern: string;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: ShiftCalendarFormData = {
  name: '',
  description: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  shift_pattern: '24/7',
  is_active: true,
};

const SHIFT_PATTERNS = ['24/7', '12-hour', '8-hour', 'Custom'];

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchShiftCalendars(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ shiftCalendars: ShiftCalendar[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { is_active: params.status === 'active' ? 'true' : 'false' } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/shift_calendars?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load shift calendars: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    shiftCalendars: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createShiftCalendar(accessToken: string, tenantId: string, data: ShiftCalendarFormData): Promise<ShiftCalendar> {
  const response = await fetch('/api/v2/amro/master-data/shift_calendars', {
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

async function updateShiftCalendar(accessToken: string, id: string, data: Partial<ShiftCalendarFormData>): Promise<ShiftCalendar> {
  const response = await fetch(`/api/v2/amro/master-data/shift_calendars/${id}`, {
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

async function deleteShiftCalendar(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/shift_calendars/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ShiftCalendarsPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';

  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [shiftCalendars, setShiftCalendars] = useState<ShiftCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingShiftCalendar, setEditingShiftCalendar] = useState<ShiftCalendar | null>(null);
  const [formData, setFormData] = useState<ShiftCalendarFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ShiftCalendarFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<ShiftCalendar | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Shift Calendars ─────────────────────────────────────────────────────

  const loadShiftCalendars = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchShiftCalendars(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setShiftCalendars(result.shiftCalendars);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load shift calendars');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadShiftCalendars();
  }, [loadShiftCalendars]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingShiftCalendar(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (shiftCalendar: ShiftCalendar) => {
    setEditingShiftCalendar(shiftCalendar);
    setFormData({
      name: shiftCalendar.name,
      description: shiftCalendar.description || '',
      start_date: shiftCalendar.start_date,
      end_date: shiftCalendar.end_date,
      shift_pattern: shiftCalendar.shift_pattern,
      is_active: shiftCalendar.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof ShiftCalendarFormData, string>> = {};

    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.start_date) errors.start_date = 'Start date is required';
    if (formData.end_date && formData.start_date && formData.end_date < formData.start_date) {
      errors.end_date = 'End date must be after start date';
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
      if (editingShiftCalendar) {
        await updateShiftCalendar(accessToken, editingShiftCalendar.id, formData);
        toast.success('Shift calendar updated');
      } else {
        await createShiftCalendar(accessToken, tenantId, formData);
        toast.success('Shift calendar created');
      }
      setFormOpen(false);
      loadShiftCalendars();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save shift calendar');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (shiftCalendar: ShiftCalendar) => {
    setDeleteCandidate(shiftCalendar);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deleteShiftCalendar(accessToken, deleteCandidate.id);
      toast.success('Shift calendar deleted');
      loadShiftCalendars();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete shift calendar');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<ShiftCalendar>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'start_date',
      label: 'Start Date',
      sortable: true,
      render: (row) => new Date(row.start_date).toLocaleDateString(),
    },
    {
      key: 'end_date',
      label: 'End Date',
      sortable: true,
      render: (row) => row.end_date ? new Date(row.end_date).toLocaleDateString() : '-',
    },
    {
      key: 'shift_pattern',
      label: 'Pattern',
      sortable: true,
      render: (row) => <Badge variant="outline">{row.shift_pattern}</Badge>,
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
    placeholder: 'Search shift calendars...',
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

  const getActions = (row: ShiftCalendar) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Shift Calendars"
      description="Manage shift patterns and work schedules"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Shift Calendars' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadShiftCalendars} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Shift Calendar
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Calendars', value: total, icon: <Calendar className="h-4 w-4" /> },
        { label: 'Active', value: shiftCalendars.filter(s => s.is_active).length, icon: <Calendar className="h-4 w-4" /> },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={shiftCalendars}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No shift calendars found"
        emptyDescription="Create your first shift calendar to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingShiftCalendar ? 'Edit Shift Calendar' : 'Create Shift Calendar'}
        description={editingShiftCalendar ? 'Update shift calendar details' : 'Add a new shift calendar to the system'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingShiftCalendar ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Section title="Basic Information">
          <AmroUnifiedForm.Field label="Name" required error={formErrors.name}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., 2024 Q1 Maintenance Shifts"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Shift Pattern">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.shift_pattern}
              onChange={(e) => setFormData({ ...formData, shift_pattern: e.target.value })}
            >
              {SHIFT_PATTERNS.map(pattern => (
                <option key={pattern} value={pattern}>{pattern}</option>
              ))}
            </select>
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>

        <AmroUnifiedForm.Section title="Schedule">
          <AmroUnifiedForm.Field label="Start Date" required error={formErrors.start_date}>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="End Date" error={formErrors.end_date}>
            <Input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>

        <AmroUnifiedForm.Section title="Description" showSeparator={false}>
          <AmroUnifiedForm.Field label="Description" colSpan={3}>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description of the shift calendar..."
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
              <label htmlFor="is_active" className="text-sm">Active (available for scheduling)</label>
            </div>
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>
      </AmroUnifiedForm>

      {/* Delete Confirmation */}
      <AmroUnifiedForm
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Confirm Deletion"
        description={`Are you sure you want to delete shift calendar "${deleteCandidate?.name}"?`}
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
            {deleteLoading ? 'Deleting...' : 'Delete Shift Calendar'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
