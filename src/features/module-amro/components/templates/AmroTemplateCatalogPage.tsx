/**
 * AMRO Work Package Template Catalog Page
 * 
 * Enterprise-grade template browser with:
 * - Search and filtering (by maintenance type, aircraft model, status)
 * - Sortable columns
 * - Template preview
 * - Creation workflow integration
 * - Version management
 * - Bulk operations
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Eye, Filter, Plus, RefreshCw, Search, SortAsc, SortDesc, Wrench, MoreHorizontal, Package, Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { useAuth } from '@/hooks/useAuth';
import { TemplatePreviewDialog } from './TemplatePreviewDialog';
import { TemplateCreateEditDialog } from '@/features/module-amro/templates/TemplateCreateEditDialog';
import { TemplateVersionManager } from '@/features/module-amro/templates/TemplateVersionManager';
import { TemplateCloneDialog } from '@/features/module-amro/templates/TemplateCloneDialog';
import type { WorkOrderTemplate } from '@/features/module-amro/templates/AmroWorkOrderTemplatesPage';
import { logger } from "@/lib/logger";

// Use the shared WorkOrderTemplate type from the templates module
type TemplateRecord = WorkOrderTemplate;

interface TemplateVersionRecord {
  id: string;
  template_id: string;
  version_number: number;
  version_label: string | null;
  status: string;
  change_description: string;
  tasks_json: any[];
  materials_json: any[];
  tooling_json: any[];
  compliance_requirements_json: any[];
  estimated_labor_hours: number | null;
  aircraft_models: string[] | null;
  created_at: string;
  updated_at: string;
}

type SortField = 'template_name' | 'maintenance_type' | 'aircraft_model' | 'version' | 'updated_at' | 'tasks_count';
type SortDirection = 'asc' | 'desc';

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  line: 'Line Maintenance',
  base: 'Base Maintenance',
  component: 'Component Maintenance',
  inspection: 'Inspection',
  overhaul: 'Overhaul',
  repair: 'Repair',
  upgrade: 'Upgrade',
  modification: 'Modification',
};

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  pending_review: 'outline',
  approved: 'default',
  active: 'default',
  deprecated: 'destructive',
  archived: 'secondary',
};

// ── API Functions ────────────────────────────────────────────────────────────────

async function fetchTemplates(
  accessToken: string,
  params: { search?: string; maintenanceType?: string; status?: string; page?: number; pageSize?: number }
): Promise<{ templates: TemplateRecord[]; total: number }> {
  const query = new URLSearchParams({
    ...(params.search ? { search: params.search } : {}),
    ...(params.maintenanceType && params.maintenanceType !== 'all' ? { maintenance_type: params.maintenanceType } : {}),
    ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
    page: String(params.page || 1),
    page_size: String(params.pageSize || 50),
  });

  const response = await fetch(`/api/v2/amro/master-data/work_order_templates?${query.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load templates: ${response.status}`);
  }

  const json = await response.json();
  const records = json.data || json.output?.records || json.output?.data || [];
  
  return {
    templates: (Array.isArray(records) ? records : []).map((r: any) => ({
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
      tasks_count: Number(r.tasks_count || r.task_count || (Array.isArray(r.tasks_json) ? r.tasks_json.length : 0)),
      estimated_labor_hours: r.estimated_labor_hours ? Number(r.estimated_labor_hours) : null,
      created_at: String(r.created_at || ''),
      updated_at: String(r.updated_at || ''),
      created_by: r.created_by || null,
      updated_by: r.updated_by || null,
    })),
    total: json.output?.total || json.count || (Array.isArray(records) ? records.length : 0),
  };
}

async function fetchTemplateVersions(
  accessToken: string,
  templateId: string,
  tenantId?: string
): Promise<TemplateVersionRecord[]> {
  const query = new URLSearchParams({
    template_id: templateId,
    page: '1',
    page_size: '10',
  });
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  
  // Pass tenant ID as fallback for Express API
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  const response = await fetch(`/api/v2/amro/work-order-template-versions?${query.toString()}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    // Log the actual error for debugging
    const errorText = await response.text();
    logger.error('[TemplateVersions] API error:', response.status, errorText);
    throw new Error(`Failed to load template versions: ${response.status}`);
  }

  const json = await response.json();
  return json.output?.records || json.output?.versions || json.output?.data || [];
}

// ── Component ────────────────────────────────────────────────────────────────────

export function AmroTemplateCatalogPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const accessToken = session?.access_token || '';

  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
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

  // Template preview
  const [previewTemplate, setPreviewTemplate] = useState<TemplateRecord | null>(null);
  const [previewVersions, setPreviewVersions] = useState<TemplateVersionRecord[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Create/Edit dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<TemplateRecord | null>(null);
  const [aircraftModels, setAircraftModels] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [tenantId, setTenantId] = useState('');

  // ── Load Templates ──────────────────────────────────────────────────────────────

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
      
      // Extract tenant ID for API calls
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

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Load aircraft models when tenantId is available
  useEffect(() => {
    if (!tenantId || !accessToken) return;
    const load = async () => {
      try {
        const response = await fetch(`/api/v2/amro/work-order-templates/model-options?tenant_id=${tenantId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response.ok) {
          const json = await response.json();
          const records = json.data || json.output?.records || [];
          setAircraftModels(
            (Array.isArray(records) ? records : []).map((r: any) => ({
              id: String(r.id || ''),
              name: String(r.name || ''),
              code: String(r.code || r.model_code || ''),
            }))
          );
        }
      } catch {
        // Silently fail
      }
    };
    load();
  }, [tenantId, accessToken]);

  // ── Sort ────────────────────────────────────────────────────────────────────────

  const sortedTemplates = useMemo(() => {
    const sorted = [...templates];
    sorted.sort((a, b) => {
      let cmp = 0;
      const field = sortField;
      const aVal = a[field];
      const bVal = b[field];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <SortAsc className="h-4 w-4 ml-1" /> : <SortDesc className="h-4 w-4 ml-1" />;
  };

  // ── Preview ────────────────────────────────────────────────────────────────────

  const handlePreview = async (template: TemplateRecord) => {
    setPreviewTemplate(template);
    setPreviewVersions([]);
    setPreviewLoading(true);

    try {
      const effectiveTenantId = tenantId || template.tenant_id || '';
      const versions = await fetchTemplateVersions(accessToken, template.id, effectiveTenantId);
      setPreviewVersions(versions);
    } catch (err: any) {
      logger.error('[Preview] Error loading versions:', err);
      toast.error(`Failed to load template versions: ${err.message || 'Unknown error'}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────────

  const handleEdit = (template: TemplateRecord) => {
    setEditTemplate(template);
    setCreateOpen(true);
  };

  const handleSaveSuccess = () => {
    loadTemplates();
    setEditTemplate(null);
  };

  // ── Version Management ───────────────────────────────────────────────────────

  const [versionManagerOpen, setVersionManagerOpen] = useState(false);
  const [versionTemplate, setVersionTemplate] = useState<TemplateRecord | null>(null);

  const handleManageVersions = (template: TemplateRecord) => {
    setVersionTemplate(template);
    setVersionManagerOpen(true);
  };

  // ── Clone ───────────────────────────────────────────────────────────────────

  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneTemplate, setCloneTemplate] = useState<TemplateRecord | null>(null);

  const handleClone = (template: TemplateRecord) => {
    setCloneTemplate(template);
    setCloneDialogOpen(true);
  };

  const handleCloneSuccess = () => {
    loadTemplates();
    toast.success('Template cloned successfully');
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<TemplateRecord | null>(null);

  const handleDelete = (template: TemplateRecord) => {
    setDeleteCandidate(template);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate || !accessToken) return;
    try {
      const response = await fetch(`/api/v2/amro/master-data/work_order_templates/${deleteCandidate.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
      toast.success('Template deleted');
      loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template');
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteCandidate(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <FirstScreenTemplate
        title="Work Package Templates"
        description="Browse, search, and manage maintenance templates for work package creation"
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'AMRO', to: '/dashboard/amro' },
          { label: 'Settings', to: '/dashboard/amro/settings' },
          { label: 'Template Catalog' },
        ]}
        viewMode="list"
      >
        <div className="space-y-6">
          {/* Toolbar */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Template Catalog</CardTitle>
                  <CardDescription>
                    {total} template{total !== 1 ? 's' : ''} available
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={loadTemplates} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    New Template
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="pl-9"
                  />
                </div>

                {/* Maintenance Type Filter */}
                <Select value={maintenanceType} onValueChange={(v) => { setMaintenanceType(v); setPage(1); }}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-1" />
                    <SelectValue placeholder="Maintenance Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(MAINTENANCE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending_review">Pending Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="deprecated">Deprecated</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
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
                  onAction={() => navigate('/dashboard/amro/settings/work-order-templates/new')}
                />
              ) : (
                <>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('template_name')}>
                            <span className="flex items-center">Template Name <SortIcon field="template_name" /></span>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('maintenance_type')}>
                            <span className="flex items-center">Type <SortIcon field="maintenance_type" /></span>
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('aircraft_model')}>
                            <span className="flex items-center">Aircraft Model <SortIcon field="aircraft_model" /></span>
                          </TableHead>
                          <TableHead className="cursor-pointer text-center" onClick={() => handleSort('version')}>
                            <span className="flex items-center justify-center">Version <SortIcon field="version" /></span>
                          </TableHead>
                          <TableHead className="cursor-pointer text-center" onClick={() => handleSort('tasks_count')}>
                            <span className="flex items-center justify-center">Tasks <SortIcon field="tasks_count" /></span>
                          </TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('updated_at')}>
                            <span className="flex items-center">Last Updated <SortIcon field="updated_at" /></span>
                          </TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedTemplates.map((template) => (
                          <TableRow key={template.id} className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-medium">
                              <div>
                                <div>{template.template_name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{template.template_code}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {MAINTENANCE_TYPE_LABELS[template.maintenance_type] || template.maintenance_type}
                              </Badge>
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
                              <Badge variant={STATUS_COLORS[template.status || ''] || 'outline'}>
                                {(template.status || 'unknown').replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(template.updated_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
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
                        ))}
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

      {/* Template Preview Dialog */}
      <TemplatePreviewDialog
        open={!!previewTemplate}
        onOpenChange={(open) => { if (!open) { setPreviewTemplate(null); setPreviewVersions([]); } }}
        template={previewTemplate as any}
        versions={previewVersions}
        loading={previewLoading}
      />

      {/* Create/Edit Template Dialog */}
      <TemplateCreateEditDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditTemplate(null);
        }}
        template={editTemplate}
        onSuccess={handleSaveSuccess}
        aircraftModels={aircraftModels}
        tenantId={tenantId}
      />

      {/* Version Manager Dialog */}
      {versionTemplate && (
        <TemplateVersionManager
          open={versionManagerOpen}
          onOpenChange={setVersionManagerOpen}
          template={versionTemplate}
          onSuccess={() => {
            loadTemplates();
            setVersionTemplate(null);
          }}
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

      {/* Delete Confirmation Dialog */}
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
