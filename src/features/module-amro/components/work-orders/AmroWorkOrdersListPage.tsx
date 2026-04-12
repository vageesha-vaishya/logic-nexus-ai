/**
 * Unified Work Orders list page following AMRO design system standards.
 * Uses AmroModuleSurface, AmroStandardToolbar, AmroKpiGrid, and AmroModuleGridDetailPanel
 * to match the Item Master Catalog pattern.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Eye, Filter, Pencil, PauseCircle, Plus, RefreshCw, Settings, Trash2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AmroKpiGrid, AmroModuleSurface, AmroStandardToolbar } from '@/features/module-amro/components/parts/AmroPartsUiStandards';
import { AmroCrudMessageBanner, AmroCrudDialogFooter } from '@/features/module-amro/components/parts/AmroCrudPrimitives';
import { AmroModuleGridDetailPanel } from '@/features/module-amro/components/parts/AmroModuleGridDetailPanel';
import {
  useListWorkPackages,
  useDeleteWorkPackage,
  useWorkPackageActions,
  type WorkPackageListItem,
  type WorkPackageStatus,
  type WorkPackagePriority,
  type MaintenanceType,
} from './useWorkPackageState';
import { AmroWorkPackageCreateWizard } from './AmroWorkPackageCreateWizard';

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

const PRIORITY_CONFIG: Record<WorkPackagePriority, { label: string; color: string }> = {
  1: { label: 'P1 - Critical', color: 'text-red-600' },
  2: { label: 'P2 - High', color: 'text-orange-600' },
  3: { label: 'P3 - Medium', color: 'text-yellow-600' },
  4: { label: 'P4 - Low', color: 'text-blue-600' },
  5: { label: 'P5 - Routine', color: 'text-slate-600' },
};

const MAINTENANCE_LABELS: Record<MaintenanceType, string> = {
  line: 'Line',
  base: 'Base',
  component: 'Component',
  inspection: 'Inspection',
  overhaul: 'Overhaul',
  repair: 'Repair',
  upgrade: 'Upgrade',
  modification: 'Modification',
};

const DEFAULT_FORM = {
  title: '',
  description: '',
  maintenance_type: 'line' as MaintenanceType,
  priority: '3' as string,
  planned_start_date: '',
  planned_end_date: '',
  assigned_to: '',
  notes: '',
  aircraft_id: '',
};

function cloneFormValue(record?: WorkPackageListItem | null) {
  if (!record) return { ...DEFAULT_FORM };
  return {
    id: record.id,
    title: record.title || '',
    description: '',
    maintenance_type: record.maintenance_type || 'line',
    priority: String(record.priority || 3),
    planned_start_date: record.planned_start_date || '',
    planned_end_date: record.planned_end_date || '',
    assigned_to: record.assigned_to || '',
    notes: '',
    aircraft_id: record.aircraft_id || '',
  };
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AmroWorkOrdersListPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<WorkPackageListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [maintenanceFilter, setMaintenanceFilter] = useState('all');
  const [refreshTick, setRefreshTick] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState(DEFAULT_FORM);
  const [deleteCandidate, setDeleteCandidate] = useState<WorkPackageListItem | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  const { invalidate } = useWorkPackageActions();
  const deleteMutation = useDeleteWorkPackage();

  const { data, isLoading, isError } = useListWorkPackages({
    page: 1,
    pageSize: 50,
    status: statusFilter === 'all' ? undefined : statusFilter as WorkPackageStatus,
    priority: priorityFilter === 'all' ? undefined : Number(priorityFilter) as WorkPackagePriority,
    maintenanceType: maintenanceFilter === 'all' ? undefined : maintenanceFilter as MaintenanceType,
    search: search || undefined,
  });

  useEffect(() => {
    if (data?.records) {
      setRecords(data.records);
      setSelectedRecordId((current) => current || data.records[0]?.id || null);
    }
    if (isError) {
      setError('Failed to load work orders');
    } else {
      setError(null);
    }
    setLoading(isLoading);
  }, [data, isError, isLoading, refreshTick]);

  const openCreateDialog = useCallback(() => {
    setWizardOpen(true);
  }, []);

  const openEditDialog = useCallback((id: string) => {
    setEditingId(id);
    setFormValue(cloneFormValue(records.find((r) => r.id === id)));
    setActiveTab('details');
    setDialogOpen(true);
  }, [records]);

  const setField = useCallback(<K extends keyof typeof formValue>(field: K, value: (typeof formValue)[K]) => {
    setFormValue((previous) => ({ ...previous, [field]: value }));
  }, []);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Work order deleted successfully');
        invalidate();
        setRefreshTick((v) => v + 1);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to delete work order');
      },
    });
  }, [deleteMutation, invalidate]);

  const handleView = useCallback((id: string) => {
    navigate(`/dashboard/amro/work-packages/${id}`);
  }, [navigate]);

  const stats = useMemo(() => {
    const activeRecords = records.filter((r) => !['completed', 'closed', 'cancelled'].includes(r.status));
    const inProgress = records.filter((r) => r.status === 'in_progress').length;
    const scheduled = records.filter((r) => r.status === 'scheduled').length;
    const onHold = records.filter((r) => r.status === 'on_hold').length;
    const overdue = records.filter(
      (r) => r.planned_end_date && new Date(r.planned_end_date) < new Date() && !['completed', 'closed', 'cancelled'].includes(r.status)
    ).length;

    return {
      total: records.length,
      active: activeRecords.length,
      inProgress,
      scheduled,
      onHold,
      overdue,
    };
  }, [records]);

  return (
    <div className="mt-4 space-y-3">
      <AmroModuleSurface
        title="Work Orders"
        subtitle="Manage and track aircraft maintenance work orders."
        moduleId="amro.work-orders"
        status={error ? 'warning' : loading ? 'loading' : 'ready'}
      >
        <AmroStandardToolbar
          searchValue={search}
          onSearchChange={setSearch}
          placeholder="Search work orders..."
          leftActions={(
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="1">P1 - Critical</SelectItem>
                  <SelectItem value="2">P2 - High</SelectItem>
                  <SelectItem value="3">P3 - Medium</SelectItem>
                  <SelectItem value="4">P4 - Low</SelectItem>
                  <SelectItem value="5">P5 - Routine</SelectItem>
                </SelectContent>
              </Select>
              <Select value={maintenanceFilter} onValueChange={setMaintenanceFilter}>
                <SelectTrigger className="h-8 w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(MAINTENANCE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" size="sm" className="h-8" onClick={() => setRefreshTick((v) => v + 1)}>
                Apply Filters
              </Button>
            </>
          )}
          rightActions={(
            <>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setRefreshTick((v) => v + 1)}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Refresh
              </Button>
              <Button type="button" size="sm" className="h-8" onClick={openCreateDialog}>
                <Plus className="mr-1 h-4 w-4" />
                New Work Order
              </Button>
            </>
          )}
        />

        <AmroKpiGrid
          items={[
            { label: 'Total Work Orders', value: String(stats.total) },
            { label: 'Active', value: String(stats.active), tone: stats.active > 0 ? 'success' : 'default' },
            { label: 'In Progress', value: String(stats.inProgress), tone: stats.inProgress > 0 ? 'warning' : 'default' },
            { label: 'Overdue', value: String(stats.overdue), tone: stats.overdue > 0 ? 'critical' : 'default' },
          ]}
        />

        <AmroCrudMessageBanner message={error} tone="error" />

        <AmroModuleGridDetailPanel
          rows={records}
          loading={loading}
          emptyMessage="No work orders found."
          selectedId={selectedRecordId}
          onSelect={setSelectedRecordId}
          detailTitle="Work Order Detail"
          columns={[
            { key: 'workOrderNumber', label: 'Work Order #', render: (record) => (
              <span
                className="cursor-pointer text-primary underline"
                onClick={(e) => { e.stopPropagation(); handleView(record.id); }}
              >
                {record.work_package_number || record.work_order_number || '—'}
              </span>
            )},
            { key: 'title', label: 'Title', render: (record) => record.title || '—' },
            { key: 'status', label: 'Status', render: (record) => {
              const config = STATUS_CONFIG[record.status];
              return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.badge === 'destructive' ? 'border-red-500 text-red-600' : config.badge === 'secondary' ? 'border-green-500 text-green-600' : config.badge === 'outline' ? 'border-border text-muted-foreground' : 'border-blue-500 text-blue-600'}`}>{config.label}</span>;
            }},
            { key: 'priority', label: 'Priority', render: (record) => (
              <span className={`font-medium ${PRIORITY_CONFIG[record.priority].color}`}>
                {PRIORITY_CONFIG[record.priority].label}
              </span>
            )},
            { key: 'maintenanceType', label: 'Type', render: (record) => MAINTENANCE_LABELS[record.maintenance_type] || record.maintenance_type },
            { key: 'plannedStart', label: 'Planned Start', render: (record) => record.planned_start_date ? new Date(record.planned_start_date).toLocaleDateString() : '—' },
          ]}
          renderDetail={(record) => (
            !record ? <p className="text-xs text-muted-foreground">Select a work order to inspect details.</p> : (
              <div className="space-y-2 text-xs">
                <p><span className="font-semibold">Work Order #:</span> {record.work_package_number || record.work_order_number || '—'}</p>
                <p><span className="font-semibold">Title:</span> {record.title || '—'}</p>
                <p><span className="font-semibold">Aircraft:</span> {record.aircraft_registration || '—'}</p>
                <p><span className="font-semibold">Status:</span> {STATUS_CONFIG[record.status].label}</p>
                <p><span className="font-semibold">Priority:</span> {PRIORITY_CONFIG[record.priority].label}</p>
                <p><span className="font-semibold">Type:</span> {MAINTENANCE_LABELS[record.maintenance_type] || record.maintenance_type}</p>
                <p><span className="font-semibold">Planned Start:</span> {record.planned_start_date ? new Date(record.planned_start_date).toLocaleDateString() : '—'}</p>
                <p><span className="font-semibold">Planned End:</span> {record.planned_end_date ? new Date(record.planned_end_date).toLocaleDateString() : '—'}</p>
                {record.assigned_to && <p><span className="font-semibold">Assigned To:</span> {record.assigned_to}</p>}
                <div className="pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label="View work order"
                            onClick={() => handleView(record.id)}
                            disabled={dialogLoading}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View Details</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label="Edit work order"
                            onClick={() => openEditDialog(record.id)}
                            disabled={dialogLoading}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit (via Settings)</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label="Delete work order"
                            onClick={() => setDeleteCandidate(record)}
                            disabled={dialogLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            )
          )}
        />
      </AmroModuleSurface>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete work order {deleteCandidate?.work_package_number || deleteCandidate?.work_order_number}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCandidate && handleDelete(deleteCandidate.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Work Package Wizard */}
      <AmroWorkPackageCreateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={() => {
          setRefreshTick((v) => v + 1);
        }}
      />

      {/* Edit Work Order Dialog (edit mode only) */}
      <Dialog open={dialogOpen && editingId !== null} onOpenChange={(open) => { if (!dialogLoading && editingId) setDialogOpen(open); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Work Order</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="space-y-3 pt-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={formValue.title} onChange={(event) => setField('title', event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea rows={3} value={formValue.description} onChange={(event) => setField('description', event.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Maintenance Type</Label>
                  <Select value={formValue.maintenance_type} onValueChange={(value) => setField('maintenance_type', value as MaintenanceType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MAINTENANCE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Priority</Label>
                  <Select value={formValue.priority} onValueChange={(value) => setField('priority', value)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">P1 - Critical</SelectItem>
                      <SelectItem value="2">P2 - High</SelectItem>
                      <SelectItem value="3">P3 - Medium</SelectItem>
                      <SelectItem value="4">P4 - Low</SelectItem>
                      <SelectItem value="5">P5 - Routine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Assigned To</Label>
                  <Input value={formValue.assigned_to} onChange={(event) => setField('assigned_to', event.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scheduling" className="space-y-3 pt-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Planned Start Date</Label>
                  <Input type="date" value={formValue.planned_start_date} onChange={(event) => setField('planned_start_date', event.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Planned End Date</Label>
                  <Input type="date" value={formValue.planned_end_date} onChange={(event) => setField('planned_end_date', event.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea rows={4} value={formValue.notes} onChange={(event) => setField('notes', event.target.value)} />
              </div>
            </TabsContent>
          </Tabs>

          <AmroCrudDialogFooter
            onCancel={() => setDialogOpen(false)}
            onSave={() => {
              toast.info('Edit via Settings module');
              setDialogOpen(false);
            }}
            loading={dialogLoading}
            saveLabel="Update"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
