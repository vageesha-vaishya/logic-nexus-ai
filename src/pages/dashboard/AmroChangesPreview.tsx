import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard, type ColumnType } from "@/components/kanban/KanbanBoard";
import type { KanbanItem } from "@/components/kanban/KanbanCard";
import { useCRM } from "@/hooks/useCRM";
import { useAuth } from "@/hooks/useAuth";
import { useDomain } from "@/contexts/DomainContext";
import { toast } from "sonner";
import { Activity, AlertCircle, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

type WorkOrderStatus =
  | "planning"
  | "approved"
  | "scheduled"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "closed"
  | "cancelled";

type TaskStatus =
  | "pending"
  | "not_started"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "rework_required"
  | "cancelled";

type WorkOrder = {
  id: string;
  work_order_number: string;
  title: string;
  description: string | null;
  maintenance_type: string;
  work_type: string;
  priority: number | null;
  status: WorkOrderStatus;
  aircraft_id: string;
  assigned_to: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  estimated_labor_hours: number | null;
  estimated_cost: number | null;
  actual_labor_hours: number | null;
  actual_cost: number | null;
  updated_at: string;
};

type AircraftRow = {
  id: string;
  registration: string;
  manufacturer: string;
  model: string;
};

type TaskRow = {
  id: string;
  task_number: string;
  title: string;
  status: TaskStatus;
  task_category: string;
  sequence_order: number | null;
  estimated_duration_hours: number | null;
  progress_percentage: number | null;
  assigned_to: string | null;
  updated_at: string;
};

type MaintenanceEventRow = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_timestamp: string;
  performed_by: string;
  task_id: string | null;
  data: Record<string, unknown> | null;
  regulatory_requirement: string | null;
  compliance_authority: string | null;
};

type AuditLogRow = {
  id: string;
  action: string;
  resource_type: string;
  user_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const WORK_PACKAGE_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  planning: "Planning",
  approved: "Approved",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  not_started: "Not Started",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  rework_required: "Rework",
  cancelled: "Cancelled",
};

const TASK_COLUMNS: ColumnType[] = [
  { id: "pending", title: TASK_STATUS_LABELS.pending },
  { id: "not_started", title: TASK_STATUS_LABELS.not_started },
  { id: "in_progress", title: TASK_STATUS_LABELS.in_progress },
  { id: "on_hold", title: TASK_STATUS_LABELS.on_hold },
  { id: "rework_required", title: TASK_STATUS_LABELS.rework_required },
  { id: "completed", title: TASK_STATUS_LABELS.completed },
  { id: "cancelled", title: TASK_STATUS_LABELS.cancelled },
];

const STATUS_BADGE_TONE: Record<string, string> = {
  planning: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  approved: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  scheduled: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
  in_progress: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  on_hold: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  completed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  closed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  cancelled: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  pending: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  not_started: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  rework_required: "bg-red-100 text-red-700 hover:bg-red-100",
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Deferred",
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function formatMoney(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatHours(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}h`;
}

function shortId(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 8);
}

export default function AmroChangesPreview() {
  const { scopedDb, context } = useCRM();
  const { isPlatformAdmin: isAuthenticatedPlatformAdmin, hasPermission, roles } = useAuth();
  const { availableDomains, isPlatformAdmin: isDomainPlatformAdmin, isLoading: loadingDomains } = useDomain();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [aircraftById, setAircraftById] = useState<Record<string, AircraftRow>>({});
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [events, setEvents] = useState<MaintenanceEventRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLogRow[]>([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | "all">("all");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  const selectedWorkOrder = useMemo(
    () => workOrders.find((item) => item.id === selectedWorkOrderId) ?? null,
    [workOrders, selectedWorkOrderId],
  );
  const hasAmroAccess = useMemo(
    () =>
      context.isPlatformAdmin ||
      isAuthenticatedPlatformAdmin() ||
      roles.some((role) => role.role === "platform_admin") ||
      hasPermission("*") ||
      isDomainPlatformAdmin ||
      availableDomains.some((domain) => String(domain.code || "").trim().toUpperCase() === "AMRO"),
    [availableDomains, context.isPlatformAdmin, hasPermission, isAuthenticatedPlatformAdmin, isDomainPlatformAdmin, roles],
  );

  const loadWorkOrders = useCallback(async () => {
    if (!hasAmroAccess) {
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    const { data, error } = await scopedDb
      .from("work_orders")
      .select(
        "id, work_order_number, work_order_number, title, description, maintenance_type, work_type, priority, status, aircraft_id, assigned_to, planned_start_date, planned_end_date, actual_start_date, actual_end_date, estimated_labor_hours, estimated_cost, actual_labor_hours, actual_cost, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("Failed to load work packages");
      setLoadingList(false);
      return;
    }

    const rows = (data ?? []) as WorkOrder[];
    setWorkOrders(rows);

    const aircraftIds = Array.from(new Set(rows.map((item) => item.aircraft_id).filter(Boolean)));
    if (aircraftIds.length > 0) {
      const { data: aircraftRows } = await scopedDb
        .from("aircraft")
        .select("id, registration, manufacturer, model")
        .in("id", aircraftIds);

      const mapping: Record<string, AircraftRow> = {};
      ((aircraftRows ?? []) as AircraftRow[]).forEach((row) => {
        mapping[row.id] = row;
      });
      setAircraftById(mapping);
    } else {
      setAircraftById({});
    }

    setSelectedWorkOrderId((current) => {
      if (current && rows.some((item) => item.id === current)) return current;
      return rows[0]?.id ?? null;
    });

    setLoadingList(false);
  }, [hasAmroAccess, scopedDb]);

  const loadWorkOrderDetail = useCallback(
    async (workOrderId: string) => {
      setLoadingDetail(true);
      const [taskResponse, eventResponse, auditResponse] = await Promise.all([
        scopedDb
          .from("tasks")
          .select(
            "id, task_number, title, status, task_category, sequence_order, estimated_duration_hours, progress_percentage, assigned_to, updated_at",
          )
          .eq("work_order_id", workOrderId)
          .order("sequence_order", { ascending: true })
          .order("updated_at", { ascending: false }),
        scopedDb
          .from("maintenance_events")
          .select(
            "id, event_type, title, description, event_timestamp, performed_by, task_id, data, regulatory_requirement, compliance_authority",
          )
          .eq("work_order_id", workOrderId)
          .order("event_timestamp", { ascending: false })
          .limit(80),
        scopedDb
          .from("audit_logs")
          .select("id, action, resource_type, user_id, details, created_at")
          .or("resource_type.eq.tasks,resource_type.eq.work_orders,resource_type.eq.maintenance_events")
          .order("created_at", { ascending: false })
          .limit(120),
      ]);

      if (taskResponse.error) {
        toast.error("Failed to load work package tasks");
        setTasks([]);
      } else {
        setTasks((taskResponse.data ?? []) as TaskRow[]);
      }

      if (eventResponse.error) {
        toast.error("Failed to load activity feed");
        setEvents([]);
      } else {
        setEvents((eventResponse.data ?? []) as MaintenanceEventRow[]);
      }

      if (auditResponse.error) {
        setAuditRows([]);
      } else {
        const records = ((auditResponse.data ?? []) as AuditLogRow[]).filter((row) =>
          JSON.stringify(row.details ?? {}).includes(workOrderId),
        );
        setAuditRows(records);
      }
      setLoadingDetail(false);
    },
    [scopedDb],
  );

  useEffect(() => {
    if (loadingDomains) return;
    if (!hasAmroAccess) {
      setLoadingList(false);
      setWorkOrders([]);
      setSelectedWorkOrderId(null);
      return;
    }
    loadWorkOrders();
  }, [hasAmroAccess, loadWorkOrders, loadingDomains]);

  useEffect(() => {
    if (!selectedWorkOrderId) {
      setTasks([]);
      setEvents([]);
      setAuditRows([]);
      return;
    }
    loadWorkOrderDetail(selectedWorkOrderId);
  }, [selectedWorkOrderId, loadWorkOrderDetail]);

  const filteredWorkOrders = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return workOrders.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!query) return true;
      const aircraft = aircraftById[item.aircraft_id];
      const searchable = [
        item.work_order_number || item.work_order_number,
        item.title,
        item.maintenance_type,
        item.work_type,
        aircraft?.registration,
        aircraft?.manufacturer,
        aircraft?.model,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [aircraftById, searchText, statusFilter, workOrders]);

  const taskBoardItems = useMemo<KanbanItem[]>(
    () =>
      tasks.map((task) => ({
        id: task.id,
        title: `${task.task_number} · ${task.title}`,
        subtitle: task.task_category,
        status: task.status,
        priority: task.status === "rework_required" ? "critical" : task.status === "in_progress" ? "high" : "medium",
        value: task.estimated_duration_hours ?? 0,
        currency: "h",
        updatedAt: task.updated_at,
        tags: task.progress_percentage !== null ? [`${task.progress_percentage}%`] : [],
      })),
    [tasks],
  );

  const onTaskMove = useCallback(
    async (activeId: string, _overId: string, newStatus: string) => {
      const nextStatus = newStatus as TaskStatus;
      const currentTask = tasks.find((task) => task.id === activeId);
      if (!currentTask || currentTask.status === nextStatus) return;

      const nowIso = new Date().toISOString();
      setSavingTask(true);

      setTasks((previous) =>
        previous.map((task) => (task.id === activeId ? { ...task, status: nextStatus, updated_at: nowIso } : task)),
      );

      const { error } = await scopedDb.from("tasks").update({ status: nextStatus }).eq("id", activeId);
      if (error) {
        toast.error("Task status update failed");
        await loadWorkOrderDetail(selectedWorkOrderId as string);
        setSavingTask(false);
        return;
      }

      if (selectedWorkOrderId && context.userId) {
        const eventPayload = {
          event_type: "task_status_changed",
          title: `Task ${currentTask.task_number} status updated`,
          description: `${TASK_STATUS_LABELS[currentTask.status]} → ${TASK_STATUS_LABELS[nextStatus]}`,
          performed_by: context.userId,
          work_order_id: selectedWorkOrderId,
          task_id: activeId,
          data: {
            from_status: currentTask.status,
            to_status: nextStatus,
          },
        };
        const { error: eventError, data: insertedEvent } = await scopedDb
          .from("maintenance_events")
          .insert(eventPayload)
          .select(
            "id, event_type, title, description, event_timestamp, performed_by, task_id, data, regulatory_requirement, compliance_authority",
          )
          .limit(1);

        if (!eventError && insertedEvent && insertedEvent.length > 0) {
          setEvents((previous) => [insertedEvent[0] as MaintenanceEventRow, ...previous]);
        }
      }

      setSavingTask(false);
      toast.success("Task status updated");
    },
    [context.userId, loadWorkOrderDetail, scopedDb, selectedWorkOrderId, tasks],
  );

  const workOrderStats = useMemo(() => {
    const openCount = workOrders.filter((item) => !["completed", "closed", "cancelled"].includes(item.status)).length;
    const inProgressCount = workOrders.filter((item) => item.status === "in_progress").length;
    const closedCount = workOrders.filter((item) => ["completed", "closed"].includes(item.status)).length;
    return {
      total: workOrders.length,
      open: openCount,
      inProgress: inProgressCount,
      closed: closedCount,
    };
  }, [workOrders]);

  const selectedTaskStats = useMemo(() => {
    if (tasks.length === 0) return { total: 0, completed: 0, blocked: 0 };
    const completed = tasks.filter((task) => task.status === "completed").length;
    const blocked = tasks.filter((task) => task.status === "on_hold" || task.status === "rework_required").length;
    return { total: tasks.length, completed, blocked };
  }, [tasks]);

  if (loadingDomains) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-[1200px] mx-auto">
          <Card className="border border-border/60">
            <CardContent className="py-10 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Validating AMRO subscription...</span>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!hasAmroAccess) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-[1200px] mx-auto">
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                AMRO Access Restricted
              </CardTitle>
              <CardDescription>
                This module is available only to tenants with an active AMRO domain assignment.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <Card className="border border-border/60">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl md:text-3xl">AMRO Work Packages</CardTitle>
                <CardDescription>
                  Tenant and franchise scoped execution console for work package planning, task flow, and auditable activity.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-[#714B67] text-white hover:bg-[#714B67]">Tenant Scope: {shortId(context.tenantId)}</Badge>
                <Badge variant="outline">Franchise Scope: {shortId(context.franchiseId)}</Badge>
                <Button variant="outline" onClick={loadWorkOrders} disabled={loadingList}>
                  {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-2">Refresh</span>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search work order, title, aircraft..."
              />
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as WorkOrderStatus | "all")}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(WORK_PACKAGE_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center rounded-md border px-3 text-sm text-muted-foreground">
                Selected Work Package: {selectedWorkOrder?.work_order_number || selectedWorkOrder?.work_order_number ?? "None"}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle>Work Package List</CardTitle>
              <CardDescription>
                {loadingList ? "Loading work packages..." : `${filteredWorkOrders.length} records`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-[720px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Work Order</TableHead>
                      <TableHead>Aircraft</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkOrders.map((item) => {
                      const aircraft = aircraftById[item.aircraft_id];
                      const isSelected = item.id === selectedWorkOrderId;
                      return (
                        <TableRow
                          key={item.id}
                          className={isSelected ? "bg-muted/50" : ""}
                          onClick={() => setSelectedWorkOrderId(item.id)}
                        >
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{item.work_order_number || item.work_order_number}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">{item.title}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div className="font-medium">{aircraft?.registration ?? shortId(item.aircraft_id)}</div>
                              <div className="text-muted-foreground">{aircraft ? `${aircraft.manufacturer} ${aircraft.model}` : "Unknown aircraft"}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_BADGE_TONE[item.status]}>{WORK_PACKAGE_STATUS_LABELS[item.status]}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!loadingList && filteredWorkOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No work packages match the current filter.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="xl:col-span-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{selectedWorkOrder ? `${selectedWorkOrder.work_order_number || selectedWorkOrder.work_order_number} · ${selectedWorkOrder.title}` : "Work Package Detail"}</span>
                  {savingTask ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                </CardTitle>
                <CardDescription>
                  Detail sheet with execution board and immutable activity context.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedWorkOrder ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
                    Select a work package to open detail view.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Maintenance Type</p>
                        <p className="font-medium">{selectedWorkOrder.maintenance_type}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Work Type</p>
                        <p className="font-medium">{selectedWorkOrder.work_type}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Priority</p>
                        <p className="font-medium">
                          {selectedWorkOrder.priority ? PRIORITY_LABELS[selectedWorkOrder.priority] ?? selectedWorkOrder.priority : "—"}
                        </p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge className={STATUS_BADGE_TONE[selectedWorkOrder.status]}>
                          {WORK_PACKAGE_STATUS_LABELS[selectedWorkOrder.status]}
                        </Badge>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Planned Start</p>
                        <p className="font-medium">{formatDateTime(selectedWorkOrder.planned_start_date)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Planned End</p>
                        <p className="font-medium">{formatDateTime(selectedWorkOrder.planned_end_date)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Estimated Labor</p>
                        <p className="font-medium">{formatHours(selectedWorkOrder.estimated_labor_hours)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Estimated Cost</p>
                        <p className="font-medium">{formatMoney(selectedWorkOrder.estimated_cost)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-12">
                      <div className="2xl:col-span-8 rounded-md border p-3 min-h-[520px]">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="font-semibold">Task Board</h3>
                          <Badge variant="outline">Tasks: {tasks.length}</Badge>
                        </div>
                        {loadingDetail ? (
                          <div className="flex h-[420px] items-center justify-center text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading task board...
                          </div>
                        ) : tasks.length === 0 ? (
                          <div className="flex h-[420px] items-center justify-center text-muted-foreground">
                            <AlertCircle className="mr-2 h-4 w-4" />
                            No tasks found for this work package.
                          </div>
                        ) : (
                          <KanbanBoard
                            columns={TASK_COLUMNS}
                            items={taskBoardItems}
                            onDragEnd={onTaskMove}
                            onItemClick={(taskId) => {
                              const task = tasks.find((item) => item.id === taskId);
                              if (!task) return;
                              toast.info(`${task.task_number}: ${task.title}`);
                            }}
                            scrollPersistenceKey={`amro-work-order-${selectedWorkOrder.id}`}
                            className="h-[460px]"
                          />
                        )}
                      </div>

                      <Card className="2xl:col-span-4">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Activity & Audit</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <Tabs defaultValue="activity">
                            <TabsList className="w-full">
                              <TabsTrigger value="activity" className="flex-1">
                                Activity
                              </TabsTrigger>
                              <TabsTrigger value="audit" className="flex-1">
                                Audit
                              </TabsTrigger>
                            </TabsList>
                            <TabsContent value="activity" className="mt-3 space-y-2 max-h-[430px] overflow-auto pr-1">
                              {events.length === 0 ? (
                                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                  No maintenance events recorded yet.
                                </div>
                              ) : (
                                events.map((event) => (
                                  <div key={event.id} className="rounded-md border p-3">
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                      <p className="text-sm font-medium">{event.title}</p>
                                      <Badge variant="outline">{event.event_type}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{event.description || "No description provided."}</p>
                                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                                      <Activity className="h-3.5 w-3.5" />
                                      <span>{formatDateTime(event.event_timestamp)}</span>
                                      <span>By {shortId(event.performed_by)}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </TabsContent>
                            <TabsContent value="audit" className="mt-3 space-y-2 max-h-[430px] overflow-auto pr-1">
                              {auditRows.length === 0 ? (
                                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                                  No scoped audit rows matched this work package yet.
                                </div>
                              ) : (
                                auditRows.map((row) => (
                                  <div key={row.id} className="rounded-md border p-3">
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                      <p className="text-sm font-medium">{row.action}</p>
                                      <Badge variant="outline">{row.resource_type}</Badge>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground line-clamp-3">
                                      {JSON.stringify(row.details ?? {})}
                                    </p>
                                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                      <span>{formatDateTime(row.created_at)}</span>
                                      <span>User {shortId(row.user_id)}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </TabsContent>
                          </Tabs>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Card className="md:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Work Packages</p>
              <p className="text-2xl font-semibold">{workOrderStats.total}</p>
            </CardContent>
          </Card>
          <Card className="md:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Open</p>
              <p className="text-2xl font-semibold">{workOrderStats.open}</p>
            </CardContent>
          </Card>
          <Card className="md:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">In Progress</p>
              <p className="text-2xl font-semibold">{workOrderStats.inProgress}</p>
            </CardContent>
          </Card>
          <Card className="md:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Closed</p>
              <p className="text-2xl font-semibold">{workOrderStats.closed}</p>
            </CardContent>
          </Card>
          <Card className="md:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Tasks Completed</p>
              <p className="text-2xl font-semibold">
                {selectedTaskStats.completed}/{selectedTaskStats.total}
              </p>
            </CardContent>
          </Card>
          <Card className="md:col-span-1">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Tasks Blocked</p>
              <p className="text-2xl font-semibold">{selectedTaskStats.blocked}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
