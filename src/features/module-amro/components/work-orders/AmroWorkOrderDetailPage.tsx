/**
 * Unified Work Package detail page following AMRO design system standards.
 * Uses AmroModuleSurface and consistent design patterns from Item Master Catalog.
 * 
 * ENTERPRISE-GRADE IMPLEMENTATION:
 * - Wrapped with DashboardLayout for proper navigation
 * - Inline edit functionality (no context loss)
 * - Responsive design across all breakpoints
 * - WCAG 2.1 AA accessibility compliance
 * - Comprehensive error handling
 * - Proper breadcrumb navigation
 */
import { useState, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, DollarSign, Pencil, User, Wrench, MoreHorizontal, Copy, Printer, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AmroModuleSurface } from '@/features/module-amro/components/parts/AmroPartsUiStandards';
import { AmroCrudMessageBanner } from '@/features/module-amro/components/parts/AmroCrudPrimitives';
import { ComplianceDocOcrPanel } from '@/features/module-amro/components/mpd/ComplianceDocOcrPanel';
import type { DocumentContext } from '@/features/module-amro/hooks/useComplianceDocOcr';
import { AmroStandardFormTemplate, type AmroTemplateFieldDefinition, type AmroTemplateSection } from '@/features/module-amro/components/templates/AmroStandardFormTemplate';
import {
  useWorkOrder,
  useUpdateWorkOrder,
  useTransitionWorkOrder,
  useWorkOrderActions,
  type WorkOrderStatus,
  type WorkOrderDetail,
} from './useWorkOrderState';

// ── Types ────────────────────────────────────────────────────────────────────────

interface EditFormData {
  title: string;
  description: string;
  priority: string;
  assigned_to: string;
  planned_start_date: string;
  planned_end_date: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkOrderStatus, { label: string; badge: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  planning: { label: 'Planning', badge: 'outline' },
  approved: { label: 'Approved', badge: 'secondary' },
  scheduled: { label: 'Scheduled', badge: 'default' },
  in_progress: { label: 'In Progress', badge: 'default' },
  on_hold: { label: 'On Hold', badge: 'destructive' },
  completed: { label: 'Completed', badge: 'secondary' },
  closed: { label: 'Closed', badge: 'outline' },
  cancelled: { label: 'Cancelled', badge: 'destructive' },
};

const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  planning: ['approved', 'cancelled'],
  approved: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['on_hold', 'completed'],
  on_hold: ['scheduled', 'cancelled'],
  completed: ['closed'],
  closed: [],
  cancelled: [],
};

const PRIORITY_OPTIONS = [
  { value: '1', label: 'P1 - Critical' },
  { value: '2', label: 'P2 - High' },
  { value: '3', label: 'P3 - Medium' },
  { value: '4', label: 'P4 - Low' },
  { value: '5', label: 'P5 - Routine' },
];

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WorkOrderStatus }) {
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
  currentStatus: WorkOrderStatus;
  onTransition: (status: WorkOrderStatus) => void;
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

function InfoCard({ wp }: { wp: WorkOrderDetail }) {
  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Work Package Information</CardTitle>
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
            <p className="mt-1 font-medium">{wp.maintenance_type.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</p>
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

function CostTrackingCard({ wp }: { wp: WorkOrderDetail }) {
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

function TasksTab({ wp }: { wp: WorkOrderDetail }) {
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

function MaterialsTab({ wp }: { wp: WorkOrderDetail }) {
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

function TimelineTab({ wp }: { wp: WorkOrderDetail }) {
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

// ── Compliance Tab ───────────────────────────────────────────────────────────
// Hosts the LLM compliance-doc OCR panel. Maps work-package fields into the
// DocumentContext the panel needs. Persistence of the parsed output is a
// future slice — no evidence/attachment table is wired here yet, so the
// panel renders for review only (onAttach omitted hides the commit button).

function ComplianceTab({ wp }: { wp: WorkOrderDetail }) {
  const context: DocumentContext = useMemo(() => ({
    work_order_id: wp.id ?? null,
    work_order_package_number: wp.work_order_number ?? null,
    directive_id: null,
    aircraft_registration: wp.aircraft_registration ?? null,
    issuing_authority_hint: null,
    notes_from_uploader: null,
  }), [wp.id, wp.work_order_number, wp.aircraft_registration]);

  return <ComplianceDocOcrPanel context={context} />;
}

// ── Edit Dialog Component ──────────────────────────────────────────────────────────

function EditWorkOrderDialog({
  open,
  onOpenChange,
  workOrder,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder: WorkOrderDetail;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<EditFormData>({
    title: workOrder.title || '',
    description: workOrder.description || '',
    priority: String(workOrder.priority || 3),
    assigned_to: workOrder.assigned_to || '',
    planned_start_date: workOrder.planned_start_date || '',
    planned_end_date: workOrder.planned_end_date || '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof EditFormData, string>>>({});
  const updateMutation = useUpdateWorkOrder();

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof EditFormData, string>> = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (formData.title.length > 200) newErrors.title = 'Title must be less than 200 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    updateMutation.mutate(
      {
        id: workOrder.id,
        data: {
          title: formData.title,
          description: formData.description || null,
          priority: parseInt(formData.priority) as any,
          assigned_to: formData.assigned_to || null,
          planned_start_date: formData.planned_start_date || null,
          planned_end_date: formData.planned_end_date || null,
        },
      },
      {
        onSuccess: () => {
          toast.success('Work package updated successfully', {
            description: `${workOrder.work_order_number} has been updated.`,
          });
          onOpenChange(false);
          onSuccess();
        },
        onError: (error: any) => {
          toast.error('Failed to update work package', {
            description: error.message || 'Please try again.',
          });
        },
      },
    );
  };

  const setField = (field: keyof EditFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="edit-work-order-description">
        <DialogHeader>
          <DialogTitle>Edit Work Package</DialogTitle>
          <DialogDescription id="edit-work-order-description">
            Update details for {workOrder.work_order_number}. Changes are saved immediately.
          </DialogDescription>
        </DialogHeader>

        <AmroStandardFormTemplate
          moduleKey="amro.work-order.detail"
          title={`Edit ${workOrder.work_order_number}`}
          subtitle="Template-driven edit form aligned with AMRO advanced module standards."
          mode="edit"
          state={updateMutation.isPending ? 'loading' : 'ready'}
          values={formData}
          fields={[
            { key: 'title', label: 'Title', required: true, span: 2 },
            { key: 'description', label: 'Description', span: 2 },
            { key: 'priority', label: 'Priority' },
            { key: 'assigned_to', label: 'Assigned To' },
            { key: 'planned_start_date', label: 'Planned Start Date' },
            { key: 'planned_end_date', label: 'Planned End Date' },
          ] satisfies AmroTemplateFieldDefinition[]}
          sections={[
            { id: 'core', title: 'Core Details', fieldKeys: ['title', 'description', 'priority', 'assigned_to'] },
            { id: 'schedule', title: 'Scheduling', fieldKeys: ['planned_start_date', 'planned_end_date'] },
          ] satisfies AmroTemplateSection[]}
          validation={{
            level: Object.keys(errors).length > 0 ? 'error' : 'ok',
            messages: Object.values(errors).filter(Boolean) as string[],
          }}
          renderField={(field) => {
            if (field.key === 'title') {
              return (
                <div className="space-y-1.5">
                  <Label htmlFor="wp-title">Title <span className="text-destructive">*</span></Label>
                  <Input
                    id="wp-title"
                    value={formData.title}
                    onChange={(event) => setField('title', event.target.value)}
                    aria-invalid={!!errors.title}
                    aria-required="true"
                  />
                  {errors.title ? <p className="text-sm text-destructive" role="alert">{errors.title}</p> : null}
                </div>
              );
            }
            if (field.key === 'description') {
              return (
                <div className="space-y-1.5">
                  <Label htmlFor="wp-description">Description</Label>
                  <Textarea
                    id="wp-description"
                    value={formData.description}
                    onChange={(event) => setField('description', event.target.value)}
                    rows={4}
                  />
                </div>
              );
            }
            if (field.key === 'priority') {
              return (
                <div className="space-y-1.5">
                  <Label htmlFor="wp-priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => setField('priority', value)}>
                    <SelectTrigger id="wp-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }
            if (field.key === 'assigned_to') {
              return (
                <div className="space-y-1.5">
                  <Label htmlFor="wp-assigned-to">Assigned To</Label>
                  <Input id="wp-assigned-to" value={formData.assigned_to} onChange={(event) => setField('assigned_to', event.target.value)} />
                </div>
              );
            }
            if (field.key === 'planned_start_date') {
              return (
                <div className="space-y-1.5">
                  <Label htmlFor="wp-planned-start-date">Planned Start Date</Label>
                  <Input id="wp-planned-start-date" type="date" value={formData.planned_start_date} onChange={(event) => setField('planned_start_date', event.target.value)} />
                </div>
              );
            }
            if (field.key === 'planned_end_date') {
              return (
                <div className="space-y-1.5">
                  <Label htmlFor="wp-planned-end-date">Planned End Date</Label>
                  <Input id="wp-planned-end-date" type="date" value={formData.planned_end_date} onChange={(event) => setField('planned_end_date', event.target.value)} />
                </div>
              );
            }
            return null;
          }}
          primaryActions={[
            {
              id: 'save',
              label: updateMutation.isPending ? 'Saving...' : 'Save Changes',
              onClick: () => {
                void handleSave();
              },
              disabled: updateMutation.isPending,
            },
          ]}
          secondaryActions={[
            {
              id: 'cancel',
              label: 'Cancel',
              variant: 'outline',
              disabled: updateMutation.isPending,
              onClick: () => onOpenChange(false),
            },
          ]}
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function AmroWorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transitionDialog, setTransitionDialog] = useState<WorkOrderStatus | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: wp, isLoading, isError } = useWorkOrder(id || null);
  const transitionMutation = useTransitionWorkOrder();
  const { invalidate } = useWorkOrderActions();

  const handleTransition = (targetStatus: WorkOrderStatus) => {
    if (!id) return;
    transitionMutation.mutate(
      { id, target_status: targetStatus },
      {
        onSuccess: () => {
          setTransitionDialog(null);
          invalidate();
          toast.success(`Status updated to ${targetStatus.replace(/_/g, ' ')}`, {
            description: `Work package ${wp?.work_order_number} status has been updated.`,
          });
        },
        onError: (err: any) => {
          toast.error('Transition failed', {
            description: err.message || 'Please try again.',
          });
        },
      },
    );
  };

  const handleEditSuccess = useCallback(() => {
    invalidate();
  }, [invalidate]);

  // Clone work package - navigate to create page with pre-filled data
  const handleClone = (workOrder: WorkOrderDetail) => {
    // Store work package data in sessionStorage for the create form to use
    sessionStorage.setItem('amro_wp_clone', JSON.stringify(workOrder));
    navigate('/dashboard/amro/work-orders?clone=true');
  };

  // Export work package as PDF (basic implementation using window.print)
  const handleExportPDF = (workOrder: WorkOrderDetail) => {
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
          moduleId="amro.work-order-detail"
          status="loading"
        >
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Loading work package details...</p>
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
          subtitle="Failed to load work package"
          moduleId="amro.work-order-detail"
          status="warning"
        >
          <AmroCrudMessageBanner message="Failed to load work package details. Please try again." tone="error" />
          <div className="flex items-center justify-center gap-4 py-8">
            <Button onClick={() => navigate('/dashboard/amro/work-orders')}>
              Back to Work Packages
            </Button>
          </div>
        </AmroModuleSurface>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6" role="main" aria-labelledby="work-order-title">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-2 text-sm text-muted-foreground">
            <li>
              <Link 
                to="/dashboard" 
                className="hover:text-foreground transition-colors"
                aria-label="Go to Dashboard"
              >
                Dashboard
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link 
                to="/dashboard/amro/work-orders" 
                className="hover:text-foreground transition-colors"
                aria-label="Go to Work Packages"
              >
                Work Packages
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page">
              <span className="text-foreground font-medium">
                {wp?.work_order_number || 'Loading...'}
              </span>
            </li>
          </ol>
        </nav>

        {/* Header Section */}
        <AmroModuleSurface
          title={wp.title}
          subtitle={`${wp.work_order_number || wp.work_order_number} • ${wp.aircraft_registration || 'No aircraft assigned'}`}
          moduleId="amro.work-order-detail"
          status="ready"
          id="work-order-title"
        >
        <div className="space-y-4">
          {/* Navigation and Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/amro/work-orders">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Work Packages
                </Link>
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <StatusBadge status={wp.status} />
              {wp.priority <= 2 && (
                <Badge variant="destructive">P{wp.priority} - {wp.priority === 1 ? 'Critical' : 'High'}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setEditDialogOpen(true)}
                aria-label="Edit work package details"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
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
          <TabsTrigger value="compliance">
            Compliance
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
        <TabsContent value="compliance" className="mt-4">
          <ComplianceTab wp={wp} />
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
              This will change the status of work package {wp.work_order_number || wp.work_order_number} from{' '}
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

      {/* Inline Edit Dialog */}
      {wp && (
        <EditWorkOrderDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          workOrder={wp}
          onSuccess={handleEditSuccess}
        />
      )}
      </div>
    </DashboardLayout>
  );
}

export default AmroWorkOrderDetailPage;
