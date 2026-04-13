/**
 * Skill Codes Page
 * 
 * Enterprise-grade unified layout for managing skill codes.
 * Uses AmroUnifiedPageLayout, AmroUnifiedTable, AmroUnifiedActions, AmroUnifiedForm.
 * 
 * Complexity: Low (simple CRUD entity)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Award } from 'lucide-react';
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

interface SkillCode {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  level: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SkillCodeFormData {
  code: string;
  name: string;
  description: string;
  category: string;
  level: string;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: SkillCodeFormData = {
  code: '',
  name: '',
  description: '',
  category: '',
  level: 'basic',
  is_active: true,
};

const SKILL_LEVELS = ['basic', 'intermediate', 'advanced', 'expert', 'master'];
const SKILL_CATEGORIES = ['mechanical', 'electrical', 'avionics', 'structural', 'inspection', 'general'];

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchSkillCodes(
  accessToken: string,
  tenantId: string,
  params: { search?: string; status?: string; page: number; pageSize: number }
): Promise<{ skillCodes: SkillCode[]; total: number }> {
  const query = new URLSearchParams({
    tenant_id: tenantId,
    page: String(params.page),
    page_size: String(params.pageSize),
    ...(params.search ? { search: params.search } : {}),
    ...(params.status && params.status !== 'all' ? { is_active: params.status === 'active' ? 'true' : 'false' } : {}),
  });

  const response = await fetch(`/api/v2/amro/master-data/skill_codes?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Failed to load skill codes: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    skillCodes: Array.isArray(records) ? records : [],
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function createSkillCode(accessToken: string, tenantId: string, data: SkillCodeFormData): Promise<SkillCode> {
  const response = await fetch('/api/v2/amro/master-data/skill_codes', {
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

async function updateSkillCode(accessToken: string, id: string, data: Partial<SkillCodeFormData>): Promise<SkillCode> {
  const response = await fetch(`/api/v2/amro/master-data/skill_codes/${id}`, {
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

async function deleteSkillCode(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/skill_codes/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SkillCodesPage() {
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';

  const tenantId = useMemo(() => {
    const roles = (user as any)?.roles || [];
    return roles[0]?.tenant_id || '';
  }, [user]);

  // State
  const [skillCodes, setSkillCodes] = useState<SkillCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingSkillCode, setEditingSkillCode] = useState<SkillCode | null>(null);
  const [formData, setFormData] = useState<SkillCodeFormData>(DEFAULT_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof SkillCodeFormData, string>>>({});

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<SkillCode | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load Skill Codes ─────────────────────────────────────────────────────

  const loadSkillCodes = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);

    try {
      const result = await fetchSkillCodes(accessToken, tenantId, {
        search: search.trim() || undefined,
        status: statusFilter,
        page,
        pageSize,
      });
      setSkillCodes(result.skillCodes);
      setTotal(result.total);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load skill codes');
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId, search, statusFilter, page, pageSize]);

  useEffect(() => {
    loadSkillCodes();
  }, [loadSkillCodes]);

  // ── Form Handlers ──────────────────────────────────────────────────────────

  const openCreateForm = () => {
    setEditingSkillCode(null);
    setFormData(DEFAULT_FORM_DATA);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (skillCode: SkillCode) => {
    setEditingSkillCode(skillCode);
    setFormData({
      code: skillCode.code,
      name: skillCode.name,
      description: skillCode.description || '',
      category: skillCode.category || '',
      level: skillCode.level || 'basic',
      is_active: skillCode.is_active,
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof SkillCodeFormData, string>> = {};

    if (!formData.code.trim()) errors.code = 'Skill code is required';
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
      if (editingSkillCode) {
        await updateSkillCode(accessToken, editingSkillCode.id, formData);
        toast.success('Skill code updated');
      } else {
        await createSkillCode(accessToken, tenantId, formData);
        toast.success('Skill code created');
      }
      setFormOpen(false);
      loadSkillCodes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save skill code');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Handlers ────────────────────────────────────────────────────────

  const handleDelete = (skillCode: SkillCode) => {
    setDeleteCandidate(skillCode);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleteLoading(true);
    try {
      await deleteSkillCode(accessToken, deleteCandidate.id);
      toast.success('Skill code deleted');
      loadSkillCodes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete skill code');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Table Configuration ────────────────────────────────────────────────────

  const columns: Column<SkillCode>[] = [
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
          {row.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (row) => row.category ? <Badge variant="secondary">{row.category}</Badge> : '-',
    },
    {
      key: 'level',
      label: 'Level',
      sortable: true,
      render: (row) => row.level ? (
        <Badge variant={row.level === 'expert' || row.level === 'master' ? 'default' : 'outline'}>
          {row.level}
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
    placeholder: 'Search skill codes...',
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

  const getActions = (row: SkillCode) => AmroActions.crud({
    onEdit: () => openEditForm(row),
    onDelete: () => handleDelete(row),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AmroUnifiedPageLayout
      title="Skill Codes"
      description="Manage technician skill codes and certifications"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Settings', to: '/dashboard/amro/settings' },
        { label: 'Master Data' },
        { label: 'Skill Codes' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={loadSkillCodes} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-1" />
            New Skill Code
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Skill Codes', value: total, icon: <Award className="h-4 w-4" /> },
        { label: 'Active', value: skillCodes.filter(s => s.is_active).length, icon: <Award className="h-4 w-4" /> },
      ]}
    >
      <AmroUnifiedTable
        columns={columns}
        data={skillCodes}
        loading={loading}
        search={searchConfig}
        filters={filters}
        pagination={paginationConfig}
        actions={getActions}
        emptyMessage="No skill codes found"
        emptyDescription="Create your first skill code to get started"
      />

      {/* Create/Edit Form */}
      <AmroUnifiedForm
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingSkillCode ? 'Edit Skill Code' : 'Create Skill Code'}
        description={editingSkillCode ? 'Update skill code details' : 'Add a new skill code to the system'}
        onSubmit={handleSubmit}
        onCancel={() => setFormOpen(false)}
        loading={formLoading}
        submitLabel={editingSkillCode ? 'Update' : 'Create'}
      >
        <AmroUnifiedForm.Section title="Basic Information">
          <AmroUnifiedForm.Field label="Skill Code" required error={formErrors.code}>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="e.g., MEC-A, ELE-B"
              disabled={!!editingSkillCode}
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Name" required error={formErrors.name}>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Mechanical Assembly"
            />
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Category">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="">Select category...</option>
              {SKILL_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </AmroUnifiedForm.Field>

          <AmroUnifiedForm.Field label="Level">
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value })}
            >
              {SKILL_LEVELS.map(level => (
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
              placeholder="Description of the skill..."
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
              <label htmlFor="is_active" className="text-sm">Active (available for assignment to technicians)</label>
            </div>
          </AmroUnifiedForm.Field>
        </AmroUnifiedForm.Section>
      </AmroUnifiedForm>

      {/* Delete Confirmation */}
      <AmroUnifiedForm
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Confirm Deletion"
        description={`Are you sure you want to delete skill code "${deleteCandidate?.code} - ${deleteCandidate?.name}"?`}
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
            {deleteLoading ? 'Deleting...' : 'Delete Skill Code'}
          </Button>
        </div>
      </AmroUnifiedForm>
    </AmroUnifiedPageLayout>
  );
}
