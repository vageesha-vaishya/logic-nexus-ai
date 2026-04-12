/**
 * AMRO Non-Scheduled Task Registry Component
 * 
 * Features:
 * - Task creation form (pilot reports, mechanic reports, etc.)
 * - Multi-filter search (aircraft, status, priority, source)
 * - Conversion to emergency work packages
 * - Status tracking (reported → under_review → approved → converted_to_wp)
 * - Required qualifications and materials tracking
 * 
 * Design System:
 * - Uses AmroModuleSurface for container
 * - Uses AmroStandardToolbar for search/filter/actions
 * - Uses AmroKpiGrid for task metrics
 * - Uses AmroModuleGridDetailPanel for split-view
 */

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Convert, Eye, Filter, Plus, RefreshCw, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AmroKpiGrid, AmroModuleSurface, AmroStandardToolbar } from '../parts/AmroPartsUiStandards';
import { AmroCrudDialogFooter, AmroCrudMessageBanner } from '../parts/AmroCrudPrimitives';
import { AmroModuleGridDetailPanel } from '../parts/AmroModuleGridDetailPanel';
import {
  useListNonScheduledTasks,
  useCreateNonScheduledTask,
  useConvertNonScheduledTaskToWP,
  type NonScheduledTask,
  type TaskSource,
  type TaskPriority,
  type TaskStatus,
} from './useNonScheduledTaskState';

const SOURCE_CONFIG: Record<TaskSource, { label: string; icon: any }> = {
  pilot_report: { label: 'Pilot Report', icon: Wrench },
  mechanic_report: { label: 'Mechanic Report', icon: Wrench },
  inspection_finding: { label: 'Inspection Finding', icon: Eye },
  reliability_program: { label: 'Reliability Program', icon: RefreshCw },
  manufacturer_advisory: { label: 'Manufacturer Advisory', icon: Clock },
  incident_investigation: { label: 'Incident Investigation', icon: Filter },
  quality_audit: { label: 'Quality Audit', icon: CheckCircle2 },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-blue-600', bg: 'bg-blue-100' },
  medium: { label: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  high: { label: 'High', color: 'text-orange-600', bg: 'bg-orange-100' },
  critical: { label: 'Critical', color: 'text-red-600', bg: 'bg-red-100' },
  aog: { label: 'AOG', color: 'text-white', bg: 'bg-red-600' },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  reported: { label: 'Reported', variant: 'outline' },
  under_review: { label: 'Under Review', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  converted_to_wp: { label: 'Converted to WP', variant: 'secondary' },
  deferred: { label: 'Deferred', variant: 'outline' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

const DEFAULT_FORM = {
  aircraft_id: '',
  task_source: 'pilot_report' as TaskSource,
  task_description: '',
  defect_description: '',
  fault_code: '',
  priority: 'medium' as TaskPriority,
  initial_assessment: '',
  estimated_duration_hours: '',
};

export function AmroNonScheduledTaskPanel(): JSX.Element {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [refreshTick, setRefreshTick] = useState(0);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [formValue, setFormValue] = useState({ ...DEFAULT_FORM });

  // Convert to WP dialog
  const [convertCandidate, setConvertCandidate] = useState<NonScheduledTask | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [urgencyLevel, setUrgencyLevel] = useState<string>('priority');
  const [assignedTo, setAssignedTo] = useState('');

  // Selected task for detail view
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Data fetching
  const { data, isLoading, error } = useListNonScheduledTasks({
    page: 1,
    pageSize: 50,
    taskSource: sourceFilter === 'all' ? undefined : sourceFilter as TaskSource,
    status: statusFilter === 'all' ? undefined : statusFilter as TaskStatus,
    priority: priorityFilter === 'all' ? undefined : priorityFilter as TaskPriority,
  });

  const createMutation = useCreateNonScheduledTask();
  const convertMutation = useConvertNonScheduledTaskToWP();

  // Computed values
  const tasks = useMemo(() => {
    const allTasks = data?.records || [];
    if (!search) return allTasks;
    const searchLower = search.toLowerCase();
    return allTasks.filter(
      (t) =>
        t.task_description.toLowerCase().includes(searchLower) ||
        t.defect_description?.toLowerCase().includes(searchLower) ||
        t.fault_code?.toLowerCase().includes(searchLower),
    );
  }, [data?.records, search]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId],
  );

  const kpiData = useMemo(() => {
    const allTasks = data?.records || [];
    return {
      total: allTasks.length,
      reported: allTasks.filter((t) => t.status === 'reported').length,
      underReview: allTasks.filter((t) => t.status === 'under_review').length,
      converted: allTasks.filter((t) => t.status === 'converted_to_wp').length,
    };
  }, [data?.records]);

  // Handlers
  const handleRefresh = useCallback(() => {
    setRefreshTick((t) => t + 1);
    toast.success('Tasks refreshed');
  }, []);

  const handleCreate = useCallback(() => {
    setFormValue({ ...DEFAULT_FORM });
    setDialogOpen(true);
  }, []);

  const handleConvert = useCallback((task: NonScheduledTask) => {
    if (task.status === 'converted_to_wp') {
      toast.error('Task already converted to work package');
      return;
    }
    setConvertCandidate(task);
    setUrgencyLevel(task.priority === 'aog' ? 'immediate' : task.priority === 'critical' ? 'urgent' : 'priority');
    setAssignedTo('');
  }, []);

  const handleFormSubmit = useCallback(async () => {
    if (!formValue.aircraft_id || !formValue.task_description) {
      toast.error('Aircraft and description are required');
      return;
    }

    setDialogLoading(true);
    try {
      await createMutation.mutateAsync({
        aircraft_id: formValue.aircraft_id,
        task_source: formValue.task_source,
        task_description: formValue.task_description,
        defect_description: formValue.defect_description || undefined,
        fault_code: formValue.fault_code || undefined,
        priority: formValue.priority,
        initial_assessment: formValue.initial_assessment || undefined,
        estimated_duration_hours: formValue.estimated_duration_hours
          ? Number(formValue.estimated_duration_hours)
          : undefined,
      });
      toast.success('Non-scheduled task created successfully');
      setDialogOpen(false);
      setFormValue({ ...DEFAULT_FORM });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
    } finally {
      setDialogLoading(false);
    }
  }, [formValue, createMutation]);

  const handleConfirmConvert = useCallback(async () => {
    if (!convertCandidate) return;
    setConvertLoading(true);
    try {
      await convertMutation.mutateAsync({
        id: convertCandidate.id,
        urgency_level: urgencyLevel as any,
        assign_to_technician: assignedTo || undefined,
      });
      toast.success('Task converted to work package successfully');
      setConvertCandidate(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to convert task');
    } finally {
      setConvertLoading(false);
    }
  }, [convertCandidate, urgencyLevel, assignedTo, convertMutation]);

  const formatTimeAgo = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }, []);

  if (error) {
    return (
      <AmroModuleSurface>
        <AmroCrudMessageBanner
          variant="error"
          title="Failed to load tasks"
          message={error.message}
        />
        <Button onClick={handleRefresh} variant="outline" className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </AmroModuleSurface>
    );
  }

  return (
    <AmroModuleSurface>
      {/* KPI Grid */}
      <AmroKpiGrid
        kpiTiles={[
          { id: 'total', label: 'Total Tasks', value: kpiData.total, icon: 'list', trend: 'neutral' },
          { id: 'reported', label: 'Reported', value: kpiData.reported, icon: 'alert-circle', trend: 'neutral' },
          { id: 'underReview', label: 'Under Review', value: kpiData.underReview, icon: 'clock', trend: 'neutral' },
          { id: 'converted', label: 'Converted to WP', value: kpiData.converted, icon: 'check-circle', trend: 'positive' },
        ]}
      />

      {/* Toolbar */}
      <AmroStandardToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search tasks...',
        }}
        filters={{
          source: {
            value: sourceFilter,
            onChange: setSourceFilter,
            options: [
              { value: 'all', label: 'All Sources' },
              ...Object.entries(SOURCE_CONFIG).map(([key, cfg]) => ({
                value: key,
                label: cfg.label,
              })),
            ],
          },
          status: {
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'all', label: 'All Statuses' },
              ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
                value: key,
                label: cfg.label,
              })),
            ],
          },
          priority: {
            value: priorityFilter,
            onChange: setPriorityFilter,
            options: [
              { value: 'all', label: 'All Priorities' },
              ...Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => ({
                value: key,
                label: cfg.label,
              })),
            ],
          },
        }}
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={handleCreate} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </div>
        }
      />

      {/* Main Content with Split View */}
      <AmroModuleGridDetailPanel
        listTitle="Non-Scheduled Tasks"
        listContent={
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading tasks...
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <p className="text-sm">No non-scheduled tasks found</p>
                <Button onClick={handleCreate} variant="outline" size="sm" className="mt-2">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Task
                </Button>
              </div>
            ) : (
              tasks.map((task) => {
                const statusCfg = STATUS_CONFIG[task.status];
                const priorityCfg = PRIORITY_CONFIG[task.priority];
                const SourceIcon = SOURCE_CONFIG[task.task_source].icon;

                return (
                  <div
                    key={task.id}
                    className={`rounded-lg border p-4 transition-colors hover:bg-muted/50 cursor-pointer ${
                      selectedTaskId === task.id ? 'border-primary bg-muted/50' : ''
                    }`}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <SourceIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {SOURCE_CONFIG[task.task_source].label}
                          </span>
                          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${priorityCfg.bg} ${priorityCfg.color}`}>
                            {priorityCfg.label}
                          </span>
                        </div>
                        <p className="text-sm font-medium line-clamp-1">{task.task_description}</p>
                        {task.defect_description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {task.defect_description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Reported {formatTimeAgo(task.reported_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        {task.status !== 'converted_to_wp' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConvert(task);
                            }}
                          >
                            <Convert className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        }
        detailTitle={selectedTask ? 'Task Details' : 'Task Details'}
        detailContent={
          selectedTask ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={STATUS_CONFIG[selectedTask.status].variant}>
                  {STATUS_CONFIG[selectedTask.status].label}
                </Badge>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${PRIORITY_CONFIG[selectedTask.priority].bg} ${PRIORITY_CONFIG[selectedTask.priority].color}`}>
                  {PRIORITY_CONFIG[selectedTask.priority].label}
                </span>
              </div>
              <div>
                <Label className="text-muted-foreground">Source</Label>
                <p className="text-sm mt-1">{SOURCE_CONFIG[selectedTask.task_source].label}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Task Description</Label>
                <p className="text-sm mt-1">{selectedTask.task_description}</p>
              </div>
              {selectedTask.defect_description && (
                <div>
                  <Label className="text-muted-foreground">Defect Description</Label>
                  <p className="text-sm mt-1">{selectedTask.defect_description}</p>
                </div>
              )}
              {selectedTask.fault_code && (
                <div>
                  <Label className="text-muted-foreground">Fault Code</Label>
                  <p className="text-sm mt-1">{selectedTask.fault_code}</p>
                </div>
              )}
              {selectedTask.initial_assessment && (
                <div>
                  <Label className="text-muted-foreground">Initial Assessment</Label>
                  <p className="text-sm mt-1">{selectedTask.initial_assessment}</p>
                </div>
              )}
              {selectedTask.estimated_duration_hours && (
                <div>
                  <Label className="text-muted-foreground">Estimated Duration</Label>
                  <p className="text-sm mt-1">{selectedTask.estimated_duration_hours} hours</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Reported At</Label>
                <p className="text-sm mt-1">{new Date(selectedTask.reported_at).toLocaleString()}</p>
              </div>
              {selectedTask.converted_at && (
                <div>
                  <Label className="text-muted-foreground">Converted to WP At</Label>
                  <p className="text-sm mt-1">{new Date(selectedTask.converted_at).toLocaleString()}</p>
                </div>
              )}
              {selectedTask.status !== 'converted_to_wp' && (
                <Button
                  onClick={() => handleConvert(selectedTask)}
                  className="w-full mt-4"
                >
                  <Convert className="mr-2 h-4 w-4" />
                  Convert to Work Package
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Select a task to view details
            </div>
          )
        }
      />

      {/* Create Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Non-Scheduled Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="aircraft_id">Aircraft ID *</Label>
                <Input
                  id="aircraft_id"
                  value={formValue.aircraft_id}
                  onChange={(e) => setFormValue({ ...formValue, aircraft_id: e.target.value })}
                  placeholder="e.g., VT-ABC"
                  required
                />
              </div>
              <div>
                <Label htmlFor="task_source">Task Source *</Label>
                <Select
                  value={formValue.task_source}
                  onValueChange={(val) => setFormValue({ ...formValue, task_source: val as TaskSource })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="task_description">Task Description *</Label>
              <Textarea
                id="task_description"
                value={formValue.task_description}
                onChange={(e) => setFormValue({ ...formValue, task_description: e.target.value })}
                placeholder="Describe the issue..."
                required
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="defect_description">Defect Description</Label>
                <Textarea
                  id="defect_description"
                  value={formValue.defect_description}
                  onChange={(e) => setFormValue({ ...formValue, defect_description: e.target.value })}
                  placeholder="Detailed defect..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="fault_code">Fault Code</Label>
                <Input
                  id="fault_code"
                  value={formValue.fault_code}
                  onChange={(e) => setFormValue({ ...formValue, fault_code: e.target.value })}
                  placeholder="e.g., ATA 29"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formValue.priority}
                  onValueChange={(val) => setFormValue({ ...formValue, priority: val as TaskPriority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="estimated_duration_hours">Estimated Duration (hours)</Label>
                <Input
                  id="estimated_duration_hours"
                  type="number"
                  value={formValue.estimated_duration_hours}
                  onChange={(e) => setFormValue({ ...formValue, estimated_duration_hours: e.target.value })}
                  placeholder="e.g., 4"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="initial_assessment">Initial Assessment</Label>
              <Textarea
                id="initial_assessment"
                value={formValue.initial_assessment}
                onChange={(e) => setFormValue({ ...formValue, initial_assessment: e.target.value })}
                placeholder="Initial findings..."
                rows={2}
              />
            </div>
          </div>
          <AmroCrudDialogFooter
            loading={dialogLoading}
            onCancel={() => setDialogOpen(false)}
            submitLabel="Create Task"
          />
        </DialogContent>
      </Dialog>

      {/* Convert to WP Dialog */}
      <Dialog open={!!convertCandidate} onOpenChange={() => setConvertCandidate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Convert className="h-5 w-5" />
              Convert to Work Package
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">{convertCandidate?.task_description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {convertCandidate && SOURCE_CONFIG[convertCandidate.task_source].label} • {convertCandidate && PRIORITY_CONFIG[convertCandidate.priority].label} Priority
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="urgency_level">Urgency Level</Label>
                <Select value={urgencyLevel} onValueChange={setUrgencyLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="assigned_to">Assign To (optional)</Label>
                <Input
                  id="assigned_to"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="User ID"
                />
              </div>
            </div>
          </div>
          <AmroCrudDialogFooter
            loading={convertLoading}
            onCancel={() => setConvertCandidate(null)}
            submitLabel="Convert to WP"
          />
        </DialogContent>
      </Dialog>
    </AmroModuleSurface>
  );
}
