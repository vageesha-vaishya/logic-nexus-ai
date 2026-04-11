/**
 * Work Orders list page that reuses the existing AircraftWorkPackageCreateDialog
 * for creating actual work packages (not templates).
 */
import { useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  ListFilter,
  MoreHorizontal,
  PauseCircle,
  Plus,
  Search,
  Settings,
  Wrench,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useListWorkPackages,
  useDeleteWorkPackage,
  useWorkPackageActions,
  type WorkPackageListItem,
  type WorkPackageStatus,
  type MaintenanceType,
  type WorkPackagePriority,
} from './useWorkPackageState';
import { AircraftWorkPackageCreateDialog } from '@/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftWorkPackageCreateDialog';
import type {
  AircraftWorkPackageTab,
  AircraftWorkPackageFormValues,
  WorkPackageCreateAction,
} from '@/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftWorkPackageCreateDialog';
import { toast } from 'sonner';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkPackageStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  planning: { label: 'Planning', variant: 'outline', icon: Settings },
  approved: { label: 'Approved', variant: 'secondary', icon: CheckCircle2 },
  scheduled: { label: 'Scheduled', variant: 'default', icon: Calendar },
  in_progress: { label: 'In Progress', variant: 'default', icon: Wrench },
  on_hold: { label: 'On Hold', variant: 'destructive', icon: PauseCircle },
  completed: { label: 'Completed', variant: 'secondary', icon: CheckCircle2 },
  closed: { label: 'Closed', variant: 'outline', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: AlertCircle },
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

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WorkPackageStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: WorkPackagePriority }) {
  const config = PRIORITY_CONFIG[priority];
  return <span className={`font-medium ${config.color}`}>{config.label}</span>;
}

// ── Filters ──────────────────────────────────────────────────────────────────

interface WorkOrderFilters {
  status: WorkPackageStatus | 'all';
  priority: WorkPackagePriority | 'all';
  maintenanceType: MaintenanceType | 'all';
  search: string;
}

function FiltersBar({
  filters,
  onFilterChange,
}: {
  filters: WorkOrderFilters;
  onFilterChange: (filters: Partial<WorkOrderFilters>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filters:</span>
      </div>

      <Select
        value={filters.status}
        onValueChange={(v) => onFilterChange({ status: v as WorkPackageStatus | 'all' })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(filters.priority)}
        onValueChange={(v) => onFilterChange({ priority: v === 'all' ? 'all' : Number(v) as WorkPackagePriority })}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priority</SelectItem>
          <SelectItem value="1">P1 - Critical</SelectItem>
          <SelectItem value="2">P2 - High</SelectItem>
          <SelectItem value="3">P3 - Medium</SelectItem>
          <SelectItem value="4">P4 - Low</SelectItem>
          <SelectItem value="5">P5 - Routine</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.maintenanceType}
        onValueChange={(v) => onFilterChange({ maintenanceType: v as MaintenanceType | 'all' })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Maintenance Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {Object.entries(MAINTENANCE_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Row Actions ──────────────────────────────────────────────────────────────

function WorkPackageRowActions({
  workPackage,
  onDelete,
  onView,
}: {
  workPackage: WorkPackageListItem;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}) {
  const canDelete = ['planning', 'cancelled'].includes(workPackage.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(workPackage.id)}>
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem disabled>Edit (via Settings)</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canDelete}
          onClick={() => onDelete(workPackage.id)}
          className="text-destructive"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function AmroWorkOrdersListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<WorkOrderFilters>({
    status: 'all',
    priority: 'all',
    maintenanceType: 'all',
    search: '',
  });

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createTab, setCreateTab] = useState<AircraftWorkPackageTab>('new-wp');
  const [createForm, setCreateForm] = useState<AircraftWorkPackageFormValues>({
    source: 'schedule_due',
    maintenanceType: 'line',
    priority: 'medium',
    status: 'planning',
    validationState: '',
    plannedStart: '',
    plannedEnd: '',
    station: '',
    workPackageNumber: '',
    topic: '',
    ttafHours: '',
    openingDate: '',
    revisionNumber: '',
    revisionDate: '',
    transmissionDate: '',
    maintenanceReleaseDate: '',
    workReportNumber: '',
    expectedReceptionDate: '',
    workReceptionDate: '',
    comments: '',
    selectedTaskNumber: '',
    selectedTaskAtaCode: '',
    selectedTaskSerialNumber: '',
    selectedTaskPartNumber: '',
    selectedTaskDescription: '',
    scopeItemsText: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const { invalidate } = useWorkPackageActions();
  const deleteMutation = useDeleteWorkPackage();

  const { data, isLoading, isError } = useListWorkPackages({
    page,
    pageSize,
    status: filters.status === 'all' ? undefined : filters.status,
    priority: filters.priority === 'all' ? undefined : filters.priority,
    maintenanceType: filters.maintenanceType === 'all' ? undefined : filters.maintenanceType,
    search: filters.search || undefined,
  });

  const handleFilterChange = useCallback((partial: Partial<WorkOrderFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setPage(1);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if (window.confirm('Are you sure you want to delete this work order?')) {
        deleteMutation.mutate(id, {
          onSuccess: () => invalidate(),
        });
      }
    },
    [deleteMutation, invalidate],
  );

  const handleView = useCallback(
    (id: string) => {
      navigate(`/dashboard/amro/work-packages/${id}`);
    },
    [navigate],
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleFilterChange({ search });
    },
    [search, handleFilterChange],
  );

  const setCreateField = useCallback((key: keyof AircraftWorkPackageFormValues, value: string) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
    setCreateErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleCreateSubmit = useCallback(
    async (action: WorkPackageCreateAction) => {
      const errors: Record<string, string> = {};
      if (!createForm.topic) errors.topic = 'Topic is required';
      if (!createForm.plannedStart) errors.plannedStart = 'Planned start date is required';
      if (!createForm.station) errors.station = 'Station is required';
      if (Object.keys(errors).length > 0) {
        setCreateErrors(errors);
        return;
      }

      setCreateSubmitting(true);
      try {
        const priorityMap: Record<string, string> = { critical: 'critical', high: 'high', medium: 'medium', low: 'low' };
        const payload = {
          interface: 'create-work-package',
          aircraft_id: 'aircraft-primary',
          title: createForm.topic,
          maintenance_type: createForm.maintenanceType,
          station: createForm.station,
          priority: priorityMap[createForm.priority] || 'medium',
          planned_window: createForm.plannedStart && createForm.plannedEnd
            ? `${createForm.plannedStart}|${createForm.plannedEnd}`
            : `${createForm.plannedStart}|`,
          scope_items: createForm.scopeItemsText
            ? createForm.scopeItemsText.split('\n').map((s) => s.trim()).filter(Boolean)
            : [],
          source: createForm.source,
          comments: createForm.comments || undefined,
        };

        const response = await fetch(`/api/v2/amro/work-packages?interface=create-work-package`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Failed to create work order: ${response.status} — ${text}`);
        }

        const data = await response.json();
        toast.success(`Work order ${data.output.work_package_id || 'created'} successfully`);
        setCreateOpen(false);
        invalidate();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create work order');
      } finally {
        setCreateSubmitting(false);
      }
    },
    [createForm, invalidate],
  );

  const records = data?.records || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Quick stats
  const stats = useMemo(() => {
    if (!records.length) return null;
    return {
      inProgress: records.filter((r) => r.status === 'in_progress').length,
      scheduled: records.filter((r) => r.status === 'scheduled').length,
      onHold: records.filter((r) => r.status === 'on_hold').length,
      overdue: records.filter(
        (r) => r.planned_end_date && new Date(r.planned_end_date) < new Date() && r.status !== 'completed' && r.status !== 'closed'
      ).length,
    };
  }, [records]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Work Orders</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track aircraft maintenance work orders
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Work Order
        </Button>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">In Progress</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{stats.inProgress}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Scheduled</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{stats.scheduled}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <PauseCircle className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium">On Hold</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{stats.onHold}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium">Overdue</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{stats.overdue}</p>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex flex-col gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search work orders..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            <ListFilter className="mr-2 h-4 w-4" />
            Search
          </Button>
        </form>

        <FiltersBar filters={filters} onFilterChange={handleFilterChange} />
      </div>

      {/* Data Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Work Order #</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Aircraft</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Planned Start</TableHead>
              <TableHead>Planned End</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Loading work orders...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-destructive">
                  Failed to load work orders. Please try again.
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No work orders found.{' '}
                  <span className="text-primary underline cursor-pointer" onClick={() => setCreateOpen(true)}>
                    Create one
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              records.map((wp) => (
                <TableRow key={wp.id}>
                  <TableCell className="font-mono text-sm">
                    <span
                      className="text-primary underline cursor-pointer"
                      onClick={() => handleView(wp.id)}
                    >
                      {wp.work_order_number}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {wp.title}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {wp.aircraft_registration || '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={wp.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={wp.priority} />
                  </TableCell>
                  <TableCell className="text-sm">
                    {MAINTENANCE_LABELS[wp.maintenance_type] || wp.maintenance_type}
                  </TableCell>
                  <TableCell className="text-sm">
                    {wp.planned_start_date
                      ? new Date(wp.planned_start_date).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {wp.planned_end_date ? (
                      <span
                        className={
                          new Date(wp.planned_end_date) < new Date() &&
                          wp.status !== 'completed' &&
                          wp.status !== 'closed'
                            ? 'text-red-600 font-medium'
                            : ''
                        }
                      >
                        {new Date(wp.planned_end_date).toLocaleDateString()}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <WorkPackageRowActions
                      workPackage={wp}
                      onDelete={handleDelete}
                      onView={handleView}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} work
            orders
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Work Order Dialog (reuses existing AircraftWorkPackageCreateDialog) */}
      <AircraftWorkPackageCreateDialog
        aircraftWorkPackageDialogOpen={createOpen}
        setAircraftWorkPackageDialogOpen={setCreateOpen}
        aircraftWorkPackageActiveTab={createTab}
        setAircraftWorkPackageActiveTab={setCreateTab}
        aircraftWorkPackageValues={createForm}
        aircraftWorkPackageErrors={createErrors}
        setAircraftWorkPackageField={setCreateField}
        selectedWorkPackageTemplateId=""
        handleAircraftWorkPackageTemplateSelect={() => {}}
        workPackageTemplateRegistryLoading={false}
        workPackageTemplateRegistry={[]}
        workPackageTemplateRegistryError=""
        selectedWorkPackageTemplate={null}
        aircraftWorkPackagePagedTasks={[]}
        aircraftWorkPackageSelectedTaskIds={[]}
        handleAircraftWorkPackageTaskSelection={() => {}}
        setAircraftWorkPackageSelectedTaskIds={() => {}}
        aircraftWorkPackageTaskSort="taskNumber"
        setAircraftWorkPackageTaskSort={() => {}}
        setAircraftWorkPackageTaskSortDirection={() => {}}
        aircraftWorkPackageTaskPage={1}
        setAircraftWorkPackageTaskPage={() => {}}
        aircraftWorkPackageTaskTotalPages={1}
        loadWorkPackageTemplateRegistry={() => {}}
        aircraftSelectedExistingWorkPackageId=""
        setAircraftSelectedExistingWorkPackageId={() => {}}
        aircraftExistingWorkPackagesError=""
        aircraftExistingWorkPackagesLoading={false}
        aircraftExistingWorkPackageList={[]}
        handleApplyExistingWorkPackageSelection={() => {}}
        aircraftTaskGridFilteredRows={[]}
        aircraftWorkPackageSubmitting={createSubmitting}
        handleAircraftWorkPackageSubmit={handleCreateSubmit}
        canCreateWorkPackageFromTemplate={false}
        associatedTemplateTasks={[]}
        associatedTemplateTasksLoading={false}
        associatedTemplateTasksError=""
      />
    </div>
  );
}
