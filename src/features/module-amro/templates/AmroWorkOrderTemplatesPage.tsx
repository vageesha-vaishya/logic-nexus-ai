/**
 * AMRO Work Package Template Management Page
 * 
 * Enterprise-grade template management with:
 * - Full CRUD operations for templates
 * - Version management with approval workflow
 * - Task selection with filtering/sorting
 * - Materials/BOM editor
 * - Tooling & Equipment editor
 * - Compliance Requirements editor
 * - Template cloning/duplication
 * - Template preview
 * - Bulk operations
 * - Audit trail
 * 
 * This is a STANDALONE module - does NOT modify Settings → Master Data module
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, Copy, Eye, FilePlus, Filter, MoreHorizontal, Package, 
  Plus, RefreshCw, Search, Settings, Trash2, Wrench 
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { TemplateCreateEditDialog } from './TemplateCreateEditDialog';
import { TemplateVersionManager } from './TemplateVersionManager';
import { TemplateCloneDialog } from './TemplateCloneDialog';
import { TemplatePreviewDialog } from './TemplatePreviewDialog';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WorkOrderTemplate {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  template_code: string;
  template_name: string;
  description: string | null;
  maintenance_type: string;
  model_id: string | null;
  aircraft_model: string | null;
  version: number;
  active: boolean;
  status: string;
  scope_items_count?: number;
  scope_json: Record<string, unknown>;
  tasks_json: any[];
  materials_json: any[];
  tooling_json: any[];
  compliance_requirements_json: any[];
  policy_snapshot_id: string | null;
  tasks_count: number;
  estimated_labor_hours: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface TaskTemplateOption {
  id: string;
  sequence: string;
  code_form_no: string;
  ata_code: string;
  reference_amp: string;
  description: string;
  category_code: string;
  estimated_man_hours: number;
  is_mandatory: boolean;
}

export interface AircraftModelOption {
  id: string;
  name: string;
  code: string;
}

type SortField = 'template_name' | 'template_code' | 'maintenance_type' | 'aircraft_model' | 'version' | 'tasks_count' | 'updated_at';
type SortDirection = 'asc' | 'desc';

// ── Constants ──────────────────────────────────────────────────────────────────

const MAINTENANCE_TYPES = [
  { value: 'line', label: 'Line Maintenance' },
  { value: 'base', label: 'Base Maintenance' },
  { value: 'component', label: 'Component Maintenance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'overhaul', label: 'Overhaul' },
  { value: 'repair', label: 'Repair' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'modification', label: 'Modification' },
] as const;

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  draft: { label: 'Draft', variant: 'secondary' },
  pending_review: { label: 'Pending Review', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  deprecated: { label: 'Deprecated', variant: 'destructive' },
  archived: { label: 'Archived', variant: 'secondary' },
};

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchTemplates(
  accessToken: string,
  params: { search?: string; maintenanceType?: string; status?: string; page?: number; pageSize?: number }
): Promise<{ templates: WorkOrderTemplate[]; total: number }> {
  const query = new URLSearchParams({
    ...(params.search ? { search: params.search } : {}),
    ...(params.maintenanceType && params.maintenanceType !== 'all' ? { maintenance_type: params.maintenanceType } : {}),
    ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
    page: String(params.page || 1),
    page_size: String(params.pageSize || 20),
  });

  const response = await fetch(`/api/v2/amro/master-data/work_order_templates?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) throw new Error(`Failed to load templates: ${response.status}`);

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];

  return {
    templates: (Array.isArray(records) ? records : []).map(normalizeTemplate),
    total: json.output?.total || json.count || records.length,
  };
}

function normalizeTemplate(r: any): WorkOrderTemplate {
  return {
    id: String(r.id || ''),
    tenant_id: String(r.tenant_id || ''),
    franchise_id: r.franchise_id || null,
    template_code: String(r.template_code || r.code || ''),
    template_name: String(r.template_name || r.name || 'Untitled'),
    description: r.description || null,
    maintenance_type: String(r.maintenance_type || 'line'),
    model_id: r.model_id || null,
    aircraft_model: r.aircraft_model || null,
    version: Number(r.version || 1),
    active: Boolean(r.active ?? true),
    status: String(r.status || 'active'),
    scope_json: r.scope_json || {},
    tasks_json: r.tasks_json || [],
    materials_json: r.materials_json || [],
    tooling_json: r.tooling_json || [],
    compliance_requirements_json: r.compliance_requirements_json || [],
    policy_snapshot_id: r.policy_snapshot_id || null,
    tasks_count: Number(r.tasks_count || r.task_count || (r.tasks_json?.length || 0)),
    estimated_labor_hours: r.estimated_labor_hours ? Number(r.estimated_labor_hours) : null,
    created_at: String(r.created_at || ''),
    updated_at: String(r.updated_at || ''),
    created_by: r.created_by || null,
    updated_by: r.updated_by || null,
  };
}

async function fetchAircraftModels(accessToken: string, tenantId?: string): Promise<AircraftModelOption[]> {
  const query = new URLSearchParams();
  if (tenantId) query.set('tenant_id', tenantId);
  
  const response = await fetch(`/api/v2/amro/work-order-templates/model-options?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return [];
  const json = await response.json();
  const records = json.data || json.output?.records || [];
  return (Array.isArray(records) ? records : []).map((r: any) => ({
    id: String(r.id || ''),
    name: String(r.name || ''),
    code: String(r.code || r.model_code || ''),
  }));
}

async function fetchTaskTemplates(
  accessToken: string,
  tenantId: string,
  aircraftModelId?: string
): Promise<TaskTemplateOption[]> {
  const query = new URLSearchParams({ tenant_id: tenantId });
  if (aircraftModelId) query.set('aircraft_model_id', aircraftModelId);

  const response = await fetch(`/api/v2/amro/work-order-templates/task-template-options?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return [];
  const json = await response.json();
  const records = json.data || json.output?.records || [];
  return (Array.isArray(records) ? records : []).map((r: any) => ({
    id: String(r.id || r.task_template_id || ''),
    sequence: String(r.sequence || r.tt_sequence || ''),
    code_form_no: String(r.code_form_no || r.code || ''),
    ata_code: String(r.ata_code || r.ata || ''),
    reference_amp: String(r.reference_amp || r.ref_amp || ''),
    description: String(r.description || r.desc || ''),
    category_code: String(r.category_code || r.category || ''),
    estimated_man_hours: Number(r.estimated_man_hours || r.est_hours || 0),
    is_mandatory: Boolean(r.is_mandatory ?? r.mandatory),
  }));
}

async function deleteTemplate(accessToken: string, id: string): Promise<void> {
  const response = await fetch(`/api/v2/amro/master-data/work_order_templates/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to delete template: ${response.status}`);
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AmroWorkOrderTemplatesPage() {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const accessToken = session?.access_token || '';
  const userId = user?.id || '';

  // State
  const [templates, setTemplates] = useState<WorkOrderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Sorting
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [createEditOpen, setCreateEditOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<WorkOrderTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WorkOrderTemplate | null>(null);
  const [versionManagerOpen, setVersionManagerOpen] = useState(false);
  const [versionTemplate, setVersionTemplate] = useState<WorkOrderTemplate | null>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneTemplate, setCloneTemplate] = useState<WorkOrderTemplate | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<WorkOrderTemplate | null>(null);

  // Aircraft models (cached)
  const [aircraftModels, setAircraftModels] = useState<AircraftModelOption[]>([]);
  
  // Tenant ID (from user session or first template)
  const [tenantId, setTenantId] = useState<string>('');

  // ── Load Templates ─────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchTemplates(accessToken, {
        search: search.trim() || undefined,
        maintenanceType,
        status,
        page,
        pageSize,
      });
      setTemplates(result.templates);
      setTotal(result.total);
      
      // Extract tenant ID from first template for API calls
      if (result.templates.length > 0 && !tenantId) {
        setTenantId(result.templates[0].tenant_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, maintenanceType, status, page, pageSize, tenantId]);

  // Load aircraft models
  const loadAircraftModels = useCallback(async () => {
    if (!accessToken) return;
    try {
      const models = await fetchAircraftModels(accessToken, tenantId);
      setAircraftModels(models);
    } catch {
      // Silently fail - not critical
    }
  }, [accessToken, tenantId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    loadAircraftModels();
  }, [loadAircraftModels]);

  // ── Sorting ────────────────────────────────────────────────────────────────

  const sortedTemplates = useMemo(() => {
    const sorted = [...templates];
    sorted.sort((a, b) => {
      let cmp = 0;
      const field = sortField;
      const aVal = a[field as keyof WorkOrderTemplate];
      const bVal = b[field as keyof WorkOrderTemplate];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else if (aVal == null && bVal != null) {
        cmp = -1;
      } else if (aVal != null && bVal == null) {
        cmp = 1;
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [templates, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedTemplates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedTemplates.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCreate = () => {
    setEditTemplate(null);
    setCreateEditOpen(true);
  };

  const handleEdit = (template: WorkOrderTemplate) => {
    setEditTemplate(template);
    setCreateEditOpen(true);
  };

  const handleDelete = (template: WorkOrderTemplate) => {
    setDeleteCandidate(template);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate || !accessToken) return;
    try {
      await deleteTemplate(accessToken, deleteCandidate.id);
      toast.success('Template deleted');
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template');
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  const handleClone = (template: WorkOrderTemplate) => {
    setCloneTemplate(template);
    setCloneDialogOpen(true);
  };

  const handleManageVersions = (template: WorkOrderTemplate) => {
    setVersionTemplate(template);
    setVersionManagerOpen(true);
  };

  const handlePreview = (template: WorkOrderTemplate) => {
    setPreviewTemplate(template);
  };

  const handleSaveSuccess = () => {
    loadTemplates();
  };

  const handleCloneSuccess = () => {
    loadTemplates();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getMaintenanceLabel = (type: string) => {
    return MAINTENANCE_TYPES.find(t => t.value === type)?.label || type;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Work Package Templates"
        description="Manage reusable maintenance templates for aircraft work packages"
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'AMRO', to: '/dashboard/amro' },
          { label: 'Templates' },
        ]}
        viewMode="list"
      >
        <div className="space-y-6">
          {/* Toolbar */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Template Library</CardTitle>
                  <CardDescription>
                    {total} template{total !== 1 ? 's' : ''} available
                    {selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                        Clear Selection
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={loadTemplates} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button size="sm" onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-1" />
                    New Template
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-9"
                  />
                </div>

                <Select value={maintenanceType} onValueChange={(v) => { setMaintenanceType(v); setPage(1); }}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-1" />
                    <SelectValue placeholder="Maintenance Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {MAINTENANCE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(search || maintenanceType !== 'all' || status !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSearch(''); setMaintenanceType('all'); setStatus('all'); setPage(1); }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              {/* Table */}
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <RefreshCw className="h-6 w-6 mr-2 animate-spin" />
                  Loading templates...
                </div>
              ) : error ? (
                <EmptyState
                  title="Failed to Load Templates"
                  description={error}
                  actionLabel="Retry"
                  onAction={loadTemplates}
                />
              ) : sortedTemplates.length === 0 ? (
                <EmptyState
                  title="No Templates Found"
                  description="Create your first template to get started"
                  actionLabel="Create Template"
                  onAction={handleCreate}
                />
              ) : (
                <>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedIds.size === sortedTemplates.length && sortedTemplates.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('template_name')}>
                            Template Name
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('maintenance_type')}>
                            Maintenance Type
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('aircraft_model')}>
                            Aircraft Model
                          </TableHead>
                          <TableHead className="text-center cursor-pointer" onClick={() => handleSort('version')}>
                            Version
                          </TableHead>
                          <TableHead className="text-center cursor-pointer" onClick={() => handleSort('tasks_count')}>
                            Tasks
                          </TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-center">Active</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedTemplates.map((template) => {
                          const statusCfg = STATUS_CONFIG[template.status] || { label: template.status, variant: 'outline' as const };
                          return (
                            <TableRow key={template.id} className="hover:bg-muted/50">
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(template.id)}
                                  onCheckedChange={() => toggleSelect(template.id)}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{template.template_name}</div>
                                  <div className="text-xs text-muted-foreground font-mono">{template.template_code}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{getMaintenanceLabel(template.maintenance_type)}</Badge>
                              </TableCell>
                              <TableCell>
                                {template.aircraft_model ? (
                                  <Badge variant="secondary">{template.aircraft_model}</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-sm">All Models</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center font-mono">{template.version}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Wrench className="h-3 w-3 text-muted-foreground" />
                                  <span>{template.tasks_count || 0}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {template.active ? (
                                  <Badge variant="default">Active</Badge>
                                ) : (
                                  <Badge variant="secondary">Inactive</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handlePreview(template)}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      Preview
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEdit(template)}>
                                      <BookOpen className="h-4 w-4 mr-2" />
                                      Edit Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleManageVersions(template)}>
                                      <Package className="h-4 w-4 mr-2" />
                                      Manage Versions
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleClone(template)}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Clone Template
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(template)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {total > pageSize && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} templates
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page === 1}
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">Page {page}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page * pageSize >= total}
                          onClick={() => setPage(p => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </FirstScreenTemplate>

      {/* Create/Edit Dialog */}
      <TemplateCreateEditDialog
        open={createEditOpen}
        onOpenChange={setCreateEditOpen}
        template={editTemplate}
        onSuccess={handleSaveSuccess}
        aircraftModels={aircraftModels}
        tenantId={tenantId}
      />

      {/* Version Manager */}
      {versionTemplate && (
        <TemplateVersionManager
          open={versionManagerOpen}
          onOpenChange={setVersionManagerOpen}
          template={versionTemplate}
          onSuccess={handleSaveSuccess}
        />
      )}

      {/* Clone Dialog */}
      {cloneTemplate && (
        <TemplateCloneDialog
          open={cloneDialogOpen}
          onOpenChange={setCloneDialogOpen}
          template={cloneTemplate}
          onSuccess={handleCloneSuccess}
          aircraftModels={aircraftModels}
        />
      )}

      {/* Preview Dialog */}
      {previewTemplate && (
        <TemplatePreviewDialog
          open={!!previewTemplate}
          onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}
          template={previewTemplate as any}
          versions={[]}
          loading={false}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteCandidate?.template_name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete Template</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
