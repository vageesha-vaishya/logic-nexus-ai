/**
 * Regulator Profiles Page
 * 
 * Enterprise-grade unified layout for managing regulator profiles.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Complexity: Medium (authority, compliance requirements)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Shield } from 'lucide-react';
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

interface RegulatorProfile {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  code: string;
  name: string;
  description: string | null;
  authority: string | null;
  jurisdiction: string | null;
  compliance_level: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RegulatorProfileFormData {
  code: string;
  name: string;
  description: string;
  authority: string;
  jurisdiction: string;
  compliance_level: string;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: RegulatorProfileFormData = {
  code: '',
  name: '',
  description: '',
  authority: '',
  jurisdiction: '',
  compliance_level: 'standard',
  is_active: true,
};

const COMPLIANCE_LEVELS = ['standard', 'enhanced', 'strict', 'custom'];

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchRegulatorProfiles(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ profiles: RegulatorProfile[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { is_active: params.status === 'active' ? 'true' : 'false' } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/regulator_profiles?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load regulator profiles: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    profiles: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createRegulatorProfile(accessToken: string, tenantId: string, data: RegulatorProfileFormData): Promise<RegulatorProfile> {
  const response = await fetch('/api/v2/amro/master-data/regulator_profiles', {
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

async function updateRegulatorProfile(accessToken: string, id: string, data: Partial<RegulatorProfileFormData>): Promise<RegulatorProfile> {
  const response = await fetch(`/api/v2/amro/master-data/regulator_profiles/${id}`, {
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

async function deleteRegulatorProfile(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/regulator_profiles/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ────────────────────────────────────────────────────────────────

export function RegulatorProfilesPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';

  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [profiles, setProfiles] = useState<RegulatorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<RegulatorProfile | null>(null);
  const [formData, setFormData] = useState<RegulatorProfileFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RegulatorProfileFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<RegulatorProfile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Profiles ─────────────────────────────────────────────────────

  const loadProfiles = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchRegulatorProfiles(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setProfiles(result.profiles);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load regulator profiles');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingProfile(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (profile: RegulatorProfile) => {
    setEditingProfile(profile);
    setFormData({
      code: profile.code,
      name: profile.name,
      description: profile.description || '',
      authority: profile.authority || '',
      jurisdiction: profile.jurisdiction || '',
      compliance_level: profile.compliance_level || 'standard',
      is_active: profile.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof RegulatorProfileFormData, string>> = {};

    if (!formData.code.trim()) errors.code = 'Profile code is required';
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
      if (editingProfile) {
        await updateRegulatorProfile(accessToken, editingProfile.id, formData);
        toast.success('Regulator profile updated');
      } else {
        await createRegulatorProfile(accessToken, tenantId, formData);
        toast.success('Regulator profile created');
      }
      setFormOpen(false);
      loadProfiles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save regulator profile');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (profile: RegulatorProfile) => {
    setDeleteCandidate(profile);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deleteRegulatorProfile(accessToken, deleteCandidate.id);
      toast.success('Regulator profile deleted');
      loadProfiles();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete regulator profile');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<RegulatorProfile>[] = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      width: 'w-32',
      render: (row) => <Badge variant="outline" className="font-mono">{row.code}</Badge>,
    },
    {
      key: 'name',
      label: 'Profile Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.authority && <div className="text-xs text-muted-foreground">{row.authority}</div>}
        </div>
      ),
    },
    {
      key: 'jurisdiction',
      label: 'Jurisdiction',
      sortable: true,
      render: (row) => row.jurisdiction || '-',
    },
    {
      key: 'compliance_level',
      label: 'Compliance Level',
      sortable: true,
      render: (row) => row.compliance_level ? (
        <Badge variant={row.compliance_level === 'strict' ? 'destructive' : row.compliance_level === 'enhanced' ? 'default' : 'outline'}>
          {row.compliance_level}
        </Badge>
      ) : '-',
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
    placeholder: 'Search regulator profiles...',
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

  const getActions = (row: RegulatorProfile) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Regulator Profiles"
      description="Manage regulatory compliance profiles and standards"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Regulator Profiles' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadProfiles} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Profile
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Profiles', value: total, icon: <Shield className="h-4 w-4" /> },
        { label: 'Active', value: profiles.filter(p => p.is_active).length, icon: <Shield className="h-4 w-4" /> },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={profiles}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No regulator profiles found"
        emptyDescription="Create your first regulator profile to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingProfile ? 'Edit Regulator Profile' : 'Create Regulator Profile'}
        description={editingProfile ? 'Update regulator profile details' : 'Add a new regulator profile to the system'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingProfile ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Section title="Basic Information">
          <AmroUnifiedForm.Field label="Profile Code" required error={formErrors.code}>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., FAA-145, EASA-P145"
              disabled={!!editingProfile}
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Profile Name" required error={formErrors.name}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., FAA Part 145 Certification"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Regulatory Authority">
            <Input
              value={formData.authority}
              onChange={(e) => setFormData({ ...formData, authority: e.target.value })}
              placeholder="e.g., FAA, EASA, CAAC"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Jurisdiction">
            <Input
              value={formData.jurisdiction}
              onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
              placeholder="e.g., United States, European Union"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Compliance Level">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.compliance_level}
              onChange={(e) => setFormData({ ...formData, compliance_level: e.target.value })}
            >
              {COMPLIANCE_LEVELS.map(level => (
                <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
              ))}
            </select>
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>

        <AmroUnifiedForm.Section title="Description" showSeparator={false}>
          <AmroUnifiedForm.Field label="Description" colSpan={3}>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description of the regulator profile..."
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
              <label htmlFor="is_active" className="text-sm">Active (available for compliance tracking)</label>
            </div>
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>
      </AmroUnifiedForm>

      {/* Delete Confirmation */}
      <AmroUnifiedForm
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Confirm Deletion"
        description={`Are you sure you want to delete regulator profile "${deleteCandidate?.code} - ${deleteCandidate?.name}"?`}
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
            {deleteLoading ? 'Deleting...' : 'Delete Profile'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
