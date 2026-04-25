/**
 * Template Preview Dialog Component
 *
 * Shows template details including:
 * - Template metadata (name, code, description, maintenance type, etc.)
 * - Version history with status badges
 * - Task list from latest version
 * - Materials and tooling requirements
 * - Compliance requirements
 *
 * NOTE: Fetches fresh template data on open to ensure Aircraft Model and
 * other fields reflect the latest saved changes.
 */

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Activity, Calendar, CheckCircle2, Clock, FileText, Package, Settings, User, Wrench } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface TemplateRecord {
  id: string;
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
  tasks_count: number;
  estimated_labor_hours: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

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

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateRecord | null;
  versions: TemplateVersionRecord[];
  loading: boolean;
}

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

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  pending_review: { label: 'Pending Review', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  active: { label: 'Active', variant: 'default' },
  deprecated: { label: 'Deprecated', variant: 'destructive' },
  archived: { label: 'Archived', variant: 'secondary' },
};

export function TemplatePreviewDialog({
  open,
  onOpenChange,
  template,
  versions,
  loading,
}: TemplatePreviewDialogProps) {
  const { session } = useAuth();
  const accessToken = session?.access_token || '';

  // State for fresh template data fetched from API
  const [freshTemplate, setFreshTemplate] = useState<TemplateRecord | null>(null);
  const [freshLoading, setFreshLoading] = useState(false);

  // Fetch fresh template data when dialog opens to ensure Aircraft Model
  // and other fields reflect the latest saved changes
  useEffect(() => {
    if (!open || !template?.id || !accessToken) {
      setFreshTemplate(null);
      return;
    }

    let cancelled = false;
    setFreshLoading(true);

    const fetchFresh = async () => {
      try {
        const response = await fetch(`/api/v2/amro/master-data/work_order_templates/${template.id}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) return;

        const json = await response.json();
        const record = json.data || json.output?.record || json.output;

        if (!cancelled && record) {
          setFreshTemplate({
            id: record.id,
            template_code: record.template_code,
            template_name: record.template_name,
            description: record.description || null,
            maintenance_type: record.maintenance_type,
            model_id: record.model_id || null,
            aircraft_model: record.aircraft_model || null,
            version: record.version,
            active: record.active,
            status: record.status || 'draft',
            scope_items_count: record.scope_items_count || 0,
            tasks_count: record.tasks_count || 0,
            estimated_labor_hours: record.estimated_labor_hours || null,
            created_at: record.created_at,
            updated_at: record.updated_at,
            created_by: record.created_by || null,
            updated_by: record.updated_by || null,
          });
        }
      } catch {
        // Silently fail - fall back to prop data
      } finally {
        if (!cancelled) {
          setFreshLoading(false);
        }
      }
    };

    fetchFresh();
    return () => { cancelled = true; };
  }, [open, template?.id, accessToken]);

  // Use fresh template data if available, otherwise fall back to prop
  const displayTemplate = freshTemplate || template;

  // Ensure versions is always an array
  const safeVersions = Array.isArray(versions) ? versions : [];
  const latestVersion = useMemo(() => {
    if (!safeVersions.length) return null;
    return safeVersions.reduce((latest, v) => v.version_number > latest.version_number ? v : latest, safeVersions[0]);
  }, [safeVersions]);

  // Fallback to template data if no versions available
  const effectiveMaterials = latestVersion?.materials_json
    || (displayTemplate as any)?.materials_json
    || [];
  const effectiveTooling = latestVersion?.tooling_json
    || (displayTemplate as any)?.tooling_json
    || [];
  const effectiveCompliance = latestVersion?.compliance_requirements_json
    || (displayTemplate as any)?.compliance_requirements_json
    || [];
  const effectiveTasks = latestVersion?.tasks_json
    || (displayTemplate as any)?.tasks_json
    || [];

  if (!displayTemplate) return null;

  const statusConfig = STATUS_CONFIG[displayTemplate.status] || { label: displayTemplate.status, variant: 'outline' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">{displayTemplate.template_name}</DialogTitle>
                <DialogDescription className="font-mono text-xs mt-1">{displayTemplate.template_code}</DialogDescription>
              </div>
            </div>
            {(freshLoading || loading) && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3 animate-spin" />
                Loading fresh data...
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Metadata Grid - Enhanced with all available fields */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Maintenance Type</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">
                {MAINTENANCE_TYPE_LABELS[displayTemplate.maintenance_type] || displayTemplate.maintenance_type}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Aircraft Model</CardDescription>
            </CardHeader>
            <CardContent>
              {displayTemplate.aircraft_model ? (
                <Badge variant="secondary">{displayTemplate.aircraft_model}</Badge>
              ) : (
                <span className="text-sm text-muted-foreground">All Models</span>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Version</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-lg font-mono font-bold">v{displayTemplate.version}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Status</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={displayTemplate.active ? 'default' : 'secondary'}>
                {displayTemplate.active ? 'Yes' : 'No'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Audit Info - Integrated for visibility */}
        <div className="flex flex-wrap items-center gap-4 px-1 text-sm">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Created:</span>
            <span className="font-medium truncate max-w-[150px]">{displayTemplate.created_by || '-'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{displayTemplate.created_at ? new Date(displayTemplate.created_at).toLocaleDateString() : '-'}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Updated:</span>
            <span className="font-medium truncate max-w-[150px]">{displayTemplate.updated_by || '-'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{displayTemplate.updated_at ? new Date(displayTemplate.updated_at).toLocaleDateString() : '-'}</span>
          </div>
        </div>

        {displayTemplate.description && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{displayTemplate.description}</p>
            </div>
          </>
        )}

        {/* Enhanced Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Tasks</div>
              <div className="text-lg font-bold">{displayTemplate.tasks_count || 0}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Materials</div>
              <div className="text-lg font-bold">{effectiveMaterials.length || displayTemplate.scope_items_count || 0}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Tooling</div>
              <div className="text-lg font-bold">{effectiveTooling.length}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Compliance</div>
              <div className="text-lg font-bold">{effectiveCompliance.length}</div>
            </div>
          </div>
        </div>

        {/* Audit Info Section */}
        <Separator />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Created By</div>
              <div className="font-medium truncate">{displayTemplate.created_by || '-'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Updated By</div>
              <div className="font-medium truncate">{displayTemplate.updated_by || '-'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="font-medium">{displayTemplate.created_at ? new Date(displayTemplate.created_at).toLocaleDateString() : '-'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Last Updated</div>
              <div className="font-medium">{displayTemplate.updated_at ? new Date(displayTemplate.updated_at).toLocaleDateString() : '-'}</div>
            </div>
          </div>
        </div>

        {/* Tabs for detailed info */}
        <Tabs defaultValue="versions">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="versions">
              <FileText className="h-4 w-4 mr-1" />
              Versions
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <Wrench className="h-4 w-4 mr-1" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="requirements">
              <Settings className="h-4 w-4 mr-1" />
              Requirements
            </TabsTrigger>
          </TabsList>

          {/* Versions Tab */}
          <TabsContent value="versions">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading versions...</div>
            ) : safeVersions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No version history available</div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Change Description</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeVersions.map((v) => {
                      const vStatus = STATUS_CONFIG[v.status] || { label: v.status, variant: 'outline' as const };
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono font-bold">
                            {v.version_label || `v${v.version_number}`}
                          </TableCell>
                          <TableCell>
                            <Badge variant={vStatus.variant}>{vStatus.label}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {v.change_description || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(v.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            {Array.isArray(effectiveTasks) && effectiveTasks.length > 0 ? (
              <div className="border rounded-md max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Task Number</TableHead>
                      <TableHead>ATA Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Est. Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {effectiveTasks.map((task: any, idx: number) => (
                      <TableRow key={task.id || idx}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono">{task.task_number || task.code || task.number || '-'}</TableCell>
                        <TableCell className="font-mono">{task.ata_code || task.ata || '-'}</TableCell>
                        <TableCell>{task.description || task.desc || task.title || 'Untitled Task'}</TableCell>
                        <TableCell className="text-right font-mono">
                          {task.estimated_labor_hours || task.est_hours || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No tasks defined in this template</div>
            )}
          </TabsContent>

          {/* Requirements Tab */}
          <TabsContent value="requirements">
            <div className="space-y-4">
              {/* Materials */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-5 w-5" />
                    Materials / BOM
                  </CardTitle>
                  <CardDescription>
                    Required parts and materials
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {Array.isArray(effectiveMaterials) && effectiveMaterials.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part Number</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {effectiveMaterials.map((mat: any, idx: number) => (
                          <TableRow key={mat.id || idx}>
                            <TableCell className="font-mono">{mat.part_number || mat.part_no || '-'}</TableCell>
                            <TableCell>{mat.description || '-'}</TableCell>
                            <TableCell className="text-right font-mono">{mat.quantity || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">No materials specified</p>
                  )}
                </CardContent>
              </Card>

              {/* Tooling */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wrench className="h-5 w-5" />
                    Tooling & Equipment
                  </CardTitle>
                  <CardDescription>
                    Required tools and equipment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {Array.isArray(effectiveTooling) && effectiveTooling.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tool Code</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {effectiveTooling.map((tool: any, idx: number) => (
                          <TableRow key={tool.id || idx}>
                            <TableCell className="font-mono">{tool.tool_code || tool.code || '-'}</TableCell>
                            <TableCell>{tool.description || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">No tooling requirements specified</p>
                  )}
                </CardContent>
              </Card>

              {/* Compliance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="h-5 w-5" />
                    Compliance Requirements
                  </CardTitle>
                  <CardDescription>
                    Regulatory and compliance obligations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {Array.isArray(effectiveCompliance) && effectiveCompliance.length > 0 ? (
                    <div className="space-y-2">
                      {effectiveCompliance.map((req: any, idx: number) => (
                        <div key={req.id || idx} className="p-3 border rounded-md">
                          <div className="font-medium">{req.requirement_code || req.code || `Requirement ${idx + 1}`}</div>
                          <div className="text-sm text-muted-foreground">{req.description || '-'}</div>
                          {req.regulatory_authority && (
                            <Badge variant="outline" className="mt-1">{req.regulatory_authority}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No compliance requirements specified</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
