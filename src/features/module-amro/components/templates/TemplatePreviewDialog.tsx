/**
 * Template Preview Dialog Component
 * 
 * Shows template details including:
 * - Template metadata (name, code, description, maintenance type, etc.)
 * - Version history with status badges
 * - Task list from latest version
 * - Materials and tooling requirements
 * - Compliance requirements
 */

import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Calendar, CheckCircle2, Clock, FileText, Package, Settings, Wrench } from 'lucide-react';

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
  // Ensure versions is always an array
  const safeVersions = Array.isArray(versions) ? versions : [];
  const latestVersion = useMemo(() => {
    if (!safeVersions.length) return null;
    return safeVersions.reduce((latest, v) => v.version_number > latest.version_number ? v : latest, safeVersions[0]);
  }, [safeVersions]);

  if (!template) return null;

  const statusConfig = STATUS_CONFIG[template.status] || { label: template.status, variant: 'outline' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{template.template_name}</DialogTitle>
              <DialogDescription className="font-mono text-xs mt-1">{template.template_code}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Maintenance Type</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">
                {MAINTENANCE_TYPE_LABELS[template.maintenance_type] || template.maintenance_type}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Aircraft Model</CardDescription>
            </CardHeader>
            <CardContent>
              {template.aircraft_model ? (
                <Badge variant="secondary">{template.aircraft_model}</Badge>
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
              <span className="text-lg font-mono font-bold">v{template.version}</span>
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
        </div>

        {template.description && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </div>
          </>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Tasks</div>
              <div className="text-lg font-bold">{template.tasks_count || 0}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Est. Hours</div>
              <div className="text-lg font-bold">{template.estimated_labor_hours?.toFixed(1) || '-'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Updated</div>
              <div className="text-sm font-medium">{new Date(template.updated_at).toLocaleDateString()}</div>
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
            {latestVersion && Array.isArray(latestVersion.tasks_json) && latestVersion.tasks_json.length > 0 ? (
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
                    {latestVersion.tasks_json.map((task: any, idx: number) => (
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
                  {Array.isArray(latestVersion?.materials_json) && latestVersion.materials_json.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Part Number</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {latestVersion.materials_json.map((mat: any, idx: number) => (
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
                  {Array.isArray(latestVersion?.tooling_json) && latestVersion.tooling_json.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tool Code</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {latestVersion.tooling_json.map((tool: any, idx: number) => (
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
                  {Array.isArray(latestVersion?.compliance_requirements_json) && latestVersion.compliance_requirements_json.length > 0 ? (
                    <div className="space-y-2">
                      {latestVersion.compliance_requirements_json.map((req: any, idx: number) => (
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
