/**
 * Unified Work Package detail page following AMRO design system standards.
 * Uses AmroModuleSurface and consistent design patterns from Item Master Catalog.
 */
import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, DollarSign, Pencil, User, Wrench, MoreHorizontal, Copy, Printer, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AmroModuleSurface } from '@/features/module-amro/components/parts/AmroPartsUiStandards';
import { AmroCrudMessageBanner } from '@/features/module-amro/components/parts/AmroCrudPrimitives';
import {
  useWorkPackage,
  useTransitionWorkPackage,
  type WorkPackageStatus,
  type WorkPackageDetail,
} from './useWorkPackageState';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkPackageStatus, { label: string; badge: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  planning: { label: 'Planning', badge: 'outline' },
  approved: { label: 'Approved', badge: 'secondary' },
  scheduled: { label: 'Scheduled', badge: 'default' },
  in_progress: { label: 'In Progress', badge: 'default' },
  on_hold: { label: 'On Hold', badge: 'destructive' },
  completed: { label: 'Completed', badge: 'secondary' },
  closed: { label: 'Closed', badge: 'outline' },
  cancelled: { label: 'Cancelled', badge: 'destructive' },
};

const VALID_TRANSITIONS: Record<WorkPackageStatus, WorkPackageStatus[]> = {
  planning: ['approved', 'cancelled'],
  approved: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['on_hold', 'completed'],
  on_hold: ['scheduled', 'cancelled'],
  completed: ['closed'],
  closed: [],
  cancelled: [],
};

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WorkPackageStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      variant={config.badge}
      className="gap-1"
    >
      {config.label}
    </Badge>
  );
}

// ── Status Transition Buttons ────────────────────────────────────────────────

function StatusTransitionButtons({
  currentStatus,
  onTransition,
}: {
  currentStatus: WorkPackageStatus;
  onTransition: (status: WorkPackageStatus) => void;
}) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (allowed.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Transition to:</span>
      {allowed.map((target) => (
        <Button
          key={target}
          variant={target === 'cancelled' ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => onTransition(target)}
        >
          {target.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </Button>
      ))}
    </div>
  );
}

// ── Info Card ────────────────────────────────────────────────────────────────

function InfoCard({ wp }: { wp: WorkPackageDetail }) {
  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Work Order Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Aircraft
            </div>
            <p className="mt-1 font-medium">{wp.aircraft_registration || 'Not assigned'}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wrench className="h-4 w-4" />
              Maintenance Type
            </div>
            <p className="mt-1 font-medium capitalize">{wp.maintenance_type.replace('_', ' ')}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              Assigned To
            </div>
            <p className="mt-1 font-medium">{wp.assigned_to || 'Unassigned'}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Planned Start
            </div>
            <p className="mt-1 font-medium">{formatDate(wp.planned_start_date)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Planned End
            </div>
            <p className="mt-1 font-medium">{formatDate(wp.planned_end_date)}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Source
            </div>
            <p className="mt-1 font-medium">{wp.source || 'Manual'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Cost Tracking Card ───────────────────────────────────────────────────────

function CostTrackingCard({ wp }: { wp: WorkPackageDetail }) {
  const estimatedCost = wp.estimated_cost || 0;
  const actualCost = wp.actual_cost || 0;
  const variance = estimatedCost > 0 ? ((actualCost - estimatedCost) / estimatedCost) * 100 : 0;
  const isOverBudget = variance > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Cost Tracking
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Estimated Cost</p>
            <p className="text-lg font-semibold">
              ${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Actual Cost</p>
            <p className={`text-lg font-semibold ${isOverBudget ? 'text-red-600' : ''}`}>
              ${actualCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Variance</p>
            <p className={`text-lg font-semibold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
              {variance > 0 ? '+' : ''}{variance.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Labor Hours</p>
            <p className="text-lg font-semibold">
              {wp.actual_labor_hours || 0} / {wp.estimated_labor_hours || 0}h
            </p>
          </div>
        </div>
        {estimatedCost > 0 && (
          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={`h-2 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min((actualCost / estimatedCost) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {((actualCost / estimatedCost) * 100).toFixed(0)}% of budget used
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab({ wp }: { wp: WorkPackageDetail }) {
  const tasks = wp.tasks || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tasks ({tasks.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No tasks defined for this work order.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Duration (hrs)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Assigned To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks
                .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
                .map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-sm">{task.task_number}</TableCell>
                    <TableCell className="font-medium max-w-[250px] truncate">{task.title}</TableCell>
                    <TableCell className="text-sm">{task.task_category || '—'}</TableCell>
                    <TableCell className="text-sm">{task.estimated_duration_hours || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={task.status === 'completed' ? 'secondary' : task.status === 'in_progress' ? 'default' : 'outline'}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${task.progress_percentage || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{task.progress_percentage || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{task.assigned_to || '—'}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Materials Tab ────────────────────────────────────────────────────────────

function MaterialsTab({ wp }: { wp: WorkPackageDetail }) {
  const materials = wp.materials || [];
  const totalMaterialCost = materials.reduce((sum, m) => sum + (m.total_cost || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Materials ({materials.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {materials.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No materials required.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part Number</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((mat) => (
                <TableRow key={mat.id}>
                  <TableCell className="font-mono text-sm">{mat.part_number}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{mat.description || '—'}</TableCell>
                  <TableCell className="text-sm capitalize">{mat.action}</TableCell>
                  <TableCell className="text-sm">{mat.quantity}</TableCell>
                  <TableCell className="text-sm">
                    {mat.unit_cost != null ? `$${mat.unit_cost.toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {mat.total_cost != null ? `$${mat.total_cost.toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm">{mat.supplier_name || '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        mat.status === 'received'
                          ? 'secondary'
                          : mat.status === 'on_order'
                            ? 'outline'
                            : 'destructive'
                      }
                    >
                      {mat.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab({ wp }: { wp: WorkPackageDetail }) {
  const events = wp.maintenance_events || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Maintenance Events ({events.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No maintenance events recorded.</p>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 rounded-lg border p-4">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{event.title}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.event_timestamp).toLocaleString()}
                    </span>
                  </div>
                  {event.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                  )}
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span>Performed by: {event.performed_by || '—'}</span>
                    <span>Approved by: {event.approved_by || '—'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function AmroWorkPackageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transitionDialog, setTransitionDialog] = useState<WorkPackageStatus | null>(null);

  const { data: wp, isLoading, isError } = useWorkPackage(id || null);
  const transitionMutation = useTransitionWorkPackage();

  const handleTransition = (targetStatus: WorkPackageStatus) => {
    if (!id) return;
    transitionMutation.mutate(
      { id, target_status: targetStatus },
      {
        onSuccess: () => setTransitionDialog(null),
        onError: (err) => {
          alert(`Transition failed: ${err.message}`);
        },
      },
    );
  };

  // Clone work package - navigate to create page with pre-filled data
  const handleClone = (workPackage: WorkPackageDetail) => {
    // Store work package data in sessionStorage for the create form to use
    sessionStorage.setItem('amro_wp_clone', JSON.stringify(workPackage));
    navigate('/dashboard/amro/work-packages?clone=true');
  };

  // Export work package as PDF (basic implementation using window.print)
  const handleExportPDF = (workPackage: WorkPackageDetail) => {
    // For now, trigger print dialog which allows saving as PDF
    // In production, integrate with a PDF generation library like jsPDF
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <AmroModuleSurface
          title="Loading..."
          subtitle="Please wait"
          moduleId="amro.work-package-detail"
          status="loading"
        >
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Loading work order details...</p>
          </div>
        </AmroModuleSurface>
      </div>
    );
  }

  if (isError || !wp) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <AmroModuleSurface
          title="Error"
          subtitle="Failed to load work order"
          moduleId="amro.work-package-detail"
          status="warning"
        >
          <AmroCrudMessageBanner message="Failed to load work order details. Please try again." tone="error" />
          <div className="flex items-center justify-center gap-4 py-8">
            <Button onClick={() => navigate('/dashboard/amro/work-packages')}>
              Back to Work Orders
            </Button>
          </div>
        </AmroModuleSurface>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Section */}
      <AmroModuleSurface
        title={wp.title}
        subtitle={`${wp.work_package_number || wp.work_order_number} • ${wp.aircraft_registration || 'No aircraft assigned'}`}
        moduleId="amro.work-package-detail"
        status="ready"
      >
        <div className="space-y-4">
          {/* Navigation and Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/amro/work-packages">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Work Orders
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <StatusBadge status={wp.status} />
              {wp.priority <= 2 && (
                <Badge variant="destructive">P{wp.priority} - {wp.priority === 1 ? 'Critical' : 'High'}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/amro/settings/master-data/work-packages')}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit (Settings)
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleClone(wp)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Clone Work Package
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.print()}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportPDF(wp)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Description */}
          {wp.description && (
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-sm text-muted-foreground">{wp.description}</p>
            </div>
          )}

          {/* Status Transitions */}
          <StatusTransitionButtons
            currentStatus={wp.status}
            onTransition={setTransitionDialog}
          />
        </div>
      </AmroModuleSurface>

      {/* Info + Cost Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard wp={wp} />
        <CostTrackingCard wp={wp} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks">
            Tasks ({wp.tasks?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="materials">
            Materials ({wp.materials?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="timeline">
            Timeline ({wp.maintenance_events?.length || 0})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-4">
          <TasksTab wp={wp} />
        </TabsContent>
        <TabsContent value="materials" className="mt-4">
          <MaterialsTab wp={wp} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineTab wp={wp} />
        </TabsContent>
      </Tabs>

      {/* Transition Confirmation Dialog */}
      <AlertDialog open={!!transitionDialog} onOpenChange={() => setTransitionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Transition to {transitionDialog?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will change the status of work order {wp.work_package_number || wp.work_order_number} from{' '}
              <strong>{wp.status.replace(/_/g, ' ')}</strong> to{' '}
              <strong>{transitionDialog?.replace(/_/g, ' ')}</strong>.
              {transitionDialog === 'completed' && ' All tasks must be completed before closing.'}
              {transitionDialog === 'cancelled' && ' This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => transitionDialog && handleTransition(transitionDialog)}
              className={transitionDialog === 'cancelled' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
