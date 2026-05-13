/**
 * Unified Work Packages list page following AMRO design system standards.
 * Uses AmroModuleSurface, AmroStandardToolbar, AmroKpiGrid, and advanced template grid shell
 * to match the Item Master Catalog pattern.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AmroKpiGrid, AmroModuleSurface } from '@/features/module-amro/components/parts/AmroPartsUiStandards';
import { AmroCrudMessageBanner } from '@/features/module-amro/components/parts/AmroCrudPrimitives';
import { AmroUnifiedGridRecordDetailShell } from '@/features/module-amro/components/parts/AmroUnifiedGridRecordDetailShell';
import type { GridColumnDefinition } from '@/features/module-amro/components/templates/AmroInventoryDataGridTemplate';
import { AmroRecordWizard } from '@/features/module-amro/components/data-grid/AmroRecordWizard';
import {
  useCreateWorkOrder,
  useListWorkOrders,
  useDeleteWorkOrder,
  useUpdateWorkOrder,
  useWorkOrderActions,
  type WorkOrderListItem,
  type WorkOrderStatus,
  type WorkOrderPriority,
  type MaintenanceType,
} from './useWorkOrderState';
import { useAircraftOptions } from './useAircraftState';
import { useWorkOrderTemplateOptions } from './useWorkOrderTemplates';
import { buildWorkOrderWizardSteps, getWorkOrderWizardInitialData } from './workOrderWizardConfig';
import { useAuth } from '@/hooks/useAuth';
import { useCRM } from '@/hooks/useCRM';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkOrderStatus, { label: string; badge: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  planning: { label: 'Planning', badge: 'outline' },
  approved: { label: 'Approved', badge: 'secondary' },
  scheduled: { label: 'Scheduled', badge: 'default' },
  in_progress: { label: 'In Progress', badge: 'default' },
  on_hold: { label: 'On Hold', badge: 'destructive' },
  blocked: { label: 'Blocked', badge: 'destructive' },
  completed: { label: 'Completed', badge: 'secondary' },
  closed: { label: 'Closed', badge: 'outline' },
  cancelled: { label: 'Cancelled', badge: 'destructive' },
};

const PRIORITY_CONFIG: Record<WorkOrderPriority, { label: string; color: string }> = {
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
  work_order_title_id: '',
  template_version_id: '',
};

function cloneFormValue(record?: WorkOrderListItem | null) {
  if (!record) return { ...DEFAULT_FORM };
  return {
    title: record.title || '',
    description: '',
    maintenance_type: record.maintenance_type || 'line',
    priority: String(record.priority || 3),
    planned_start_date: record.planned_start_date || '',
    planned_end_date: record.planned_end_date || '',
    assigned_to: record.assigned_to || '',
    notes: '',
    aircraft_id: record.aircraft_id || '',
    work_order_title_id: '',
    template_version_id: '',
  };
}

type WorkOrderGridRow = WorkOrderListItem & Record<string, unknown>;

// ── Main Component ───────────────────────────────────────────────────────────

export function AmroWorkOrdersListPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { scopedDb, context } = useCRM();
  const [records, setRecords] = useState<WorkOrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wizardMode, setWizardMode] = useState<'create' | 'edit'>('create');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValue, setFormValue] = useState(DEFAULT_FORM);
  const [deleteCandidate, setDeleteCandidate] = useState<WorkOrderListItem | null>(null);
  const [titleOptions, setTitleOptions] = useState<Array<{ value: string; label: string; title: string; wp_title: string }>>([]);
  const [titleOptionsLoading, setTitleOptionsLoading] = useState(false);

  const { invalidate } = useWorkOrderActions();
  const createMutation = useCreateWorkOrder();
  const updateMutation = useUpdateWorkOrder();
  const deleteMutation = useDeleteWorkOrder();
  const { options: aircraftOptions } = useAircraftOptions(wizardOpen);
  const { options: templateOptions } = useWorkOrderTemplateOptions(wizardOpen);
  const loadTitleOptions = useCallback(async () => {
    if (!wizardOpen) return;
    setTitleOptionsLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const mapOptions = (items: any[]) =>
        items
          .map((item: any) => ({
            value: String(item.id || '').trim(),
            label: `${String(item.title || '').trim()} (${String(item.wp_title || '').trim()})`,
            title: String(item.title || '').trim(),
            wp_title: String(item.wp_title || '').trim(),
          }))
          .filter((option: { value: string; label: string }) => option.value && option.label);

      let mapped: Array<{ value: string; label: string; title: string; wp_title: string }> = [];
      try {
        const response = await fetch('/api/v2/amro/work-order-titles', { method: 'GET', headers });
        if (!response.ok) {
          throw new Error(`Failed to load work package titles: ${response.status}`);
        }
        const json = await response.json();
        const items = Array.isArray(json?.output?.items) ? json.output.items : [];
        mapped = mapOptions(items);
      } catch {
        // Fallback for environments where new endpoint is not yet routed/restarted.
        let query = (scopedDb as any)
          .from('work_orders_title', Boolean(context.isPlatformAdmin))
          .select('id,title,wp_title,tenant_id,franchise_id')
          .order('title', { ascending: true });

        if (context.tenantId) {
          query = query.eq('tenant_id', context.tenantId);
        }

        if (!context.isPlatformAdmin && context.franchiseId) {
          query = query.or(`franchise_id.is.null,franchise_id.eq.${context.franchiseId}`);
        }

        const { data, error } = await query;
        if (error) {
          throw new Error(String(error.message || 'Failed to load title options'));
        }
        mapped = mapOptions(Array.isArray(data) ? data : []);
      }

      setTitleOptions(mapped);
    } catch (err) {
      setTitleOptions([]);
      toast.error(err instanceof Error ? err.message : 'Failed to load title dropdown');
    } finally {
      setTitleOptionsLoading(false);
    }
  }, [context.franchiseId, context.isPlatformAdmin, context.tenantId, scopedDb, session?.access_token, wizardOpen]);

  useEffect(() => {
    if (!wizardOpen) return;
    void loadTitleOptions();
  }, [loadTitleOptions, wizardOpen]);
  const wizardSteps = useMemo(
    () => buildWorkOrderWizardSteps({
      aircraftOptions,
      templateOptions,
      assignmentOptions: [],
      assignmentOptionsLoading: false,
      assignmentOptionsError: null,
      titleOptions,
      titleOptionsLoading,
    }),
    [aircraftOptions, templateOptions, titleOptions, titleOptionsLoading],
  );

  const { data, isLoading, isError, error: listError } = useListWorkOrders({
    page: 1,
    pageSize: 50,
  });

  useEffect(() => {
    if (data?.records) {
      setRecords(data.records);
    }
    if (isError) {
      setError(listError instanceof Error ? listError.message : 'Failed to load work packages');
    } else {
      setError(null);
    }
    setLoading(isLoading);
  }, [data, isError, isLoading, listError]);

  const openCreateDialog = useCallback(() => {
    setWizardMode('create');
    setEditingId(null);
    setFormValue({ ...DEFAULT_FORM });
    setWizardOpen(true);
  }, []);

  const openEditDialog = useCallback((id: string) => {
    setWizardMode('edit');
    setEditingId(id);
    setFormValue(cloneFormValue(records.find((r) => r.id === id)));
    setWizardOpen(true);
  }, [records]);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Work package deleted successfully');
        invalidate();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to delete work package');
      },
    });
  }, [deleteMutation, invalidate]);

  const handleView = useCallback((id: string) => {
    navigate(`/dashboard/amro/work-orders/${id}`);
  }, [navigate]);
  const handleWizardSubmit = useCallback(async (payload: Record<string, any>) => {
    if (wizardMode === 'edit') {
      toast.info('Work package edit workflow is routed via Settings module.');
      setWizardOpen(false);
      return;
    }
    const selectedTitle = titleOptions.find((option) => option.value === String(payload.work_order_title_id || '').trim());
    await createMutation.mutateAsync({
      aircraft_id: String(payload.aircraft_id || '').trim() || undefined,
      title: selectedTitle?.title || String(payload.title || '').trim(),
      work_order_title_id: String(payload.work_order_title_id || '').trim() || undefined,
      description: String(payload.description || '').trim() || undefined,
      maintenance_type: (String(payload.maintenance_type || 'line').trim() as MaintenanceType),
      priority: Number(payload.priority || 3) as WorkOrderPriority,
      planned_start_date: String(payload.planned_start_date || '').trim() || undefined,
      planned_end_date: String(payload.planned_end_date || '').trim() || undefined,
      work_order_template_id: String(payload.template_version_id || '').trim() || undefined,
    });
    toast.success('Work package created successfully');
    setWizardOpen(false);
    invalidate();
  }, [createMutation, invalidate, titleOptions, wizardMode]);
  const handleInlineSave = useCallback(async (record: WorkOrderGridRow) => {
    await updateMutation.mutateAsync({
      id: String(record.id),
      title: String(record.title || '').trim() || undefined,
      description: String(record.description || '').trim() || undefined,
      maintenance_type: String(record.maintenance_type || '').trim() as MaintenanceType,
      priority: Number(record.priority || 3) as WorkOrderPriority,
      planned_start_date: String(record.planned_start_date || '').trim() || undefined,
      planned_end_date: String(record.planned_end_date || '').trim() || undefined,
      assigned_to: String(record.assigned_to || '').trim() || undefined,
      notes: String(record.notes || '').trim() || undefined,
      status: String(record.status || '').trim() as WorkOrderStatus,
    });
    toast.success('Work package updated');
    invalidate();
  }, [invalidate, updateMutation]);
  const gridRecords = useMemo<WorkOrderGridRow[]>(() => records as WorkOrderGridRow[], [records]);

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
        title="Work Packages"
        subtitle="Manage and track aircraft maintenance work packages with a unified advanced grid workspace."
        moduleId="amro.work-orders"
        status={error ? 'warning' : loading ? 'loading' : 'ready'}
      >
        <AmroKpiGrid
          items={[
            { label: 'Total Work Packages', value: String(stats.total) },
            { label: 'Active', value: String(stats.active), tone: stats.active > 0 ? 'success' : 'default' },
            { label: 'In Progress', value: String(stats.inProgress), tone: stats.inProgress > 0 ? 'warning' : 'default' },
            { label: 'Overdue', value: String(stats.overdue), tone: stats.overdue > 0 ? 'critical' : 'default' },
          ]}
        />

        <AmroCrudMessageBanner message={error} tone="error" />

        <AmroUnifiedGridRecordDetailShell
          title="Work Package Records"
          subtitle="Single workspace for search, filters, layout, and inline side-form editing."
          records={gridRecords}
          columns={[
            { key: 'work_order_number', header: 'Work Package #', sortable: true, filterable: true, groupable: true, resizable: true, width: 170 },
            { key: 'title', header: 'Title', sortable: true, filterable: true, groupable: false, resizable: true, width: 260 },
            { key: 'status', header: 'Status', sortable: true, filterable: true, groupable: true, resizable: true, width: 130 },
            { key: 'priority', header: 'Priority', sortable: true, filterable: true, groupable: true, resizable: true, width: 110, dataType: 'numeric' },
            { key: 'maintenance_type', header: 'Type', sortable: true, filterable: true, groupable: true, resizable: true, width: 140 },
            { key: 'aircraft_registration', header: 'Aircraft', sortable: true, filterable: true, groupable: true, resizable: true, width: 130 },
            { key: 'planned_start_date', header: 'Planned Start', sortable: true, filterable: true, groupable: false, resizable: true, width: 130, dataType: 'date' },
            { key: 'planned_end_date', header: 'Planned End', sortable: true, filterable: true, groupable: false, resizable: true, width: 130, dataType: 'date' },
          ] satisfies GridColumnDefinition<WorkOrderGridRow>[]}
          viewMode="grid-with-right-form"
          persistKey="amro-work-order-advanced-grid"
          ariaLabel="Work package advanced grid"
          enableDetailPanelToggle={false}
          onCreateRecord={openCreateDialog}
          onReadRecord={(record) => handleView(String(record.id))}
          onDeleteRecord={(record) => setDeleteCandidate(record as WorkOrderListItem)}
          onSaveRecord={(record) => { void handleInlineSave(record); }}
          onCancelRecord={() => {
            toast.info('Inline edits cancelled');
          }}
          requiredDetailFieldKeys={['title', 'maintenance_type', 'priority']}
          defaultVisibleDetailFieldKeys={[
            'title',
            'description',
            'status',
            'maintenance_type',
            'priority',
            'planned_start_date',
            'planned_end_date',
            'assigned_to',
            'notes',
          ]}
          hiddenDetailFieldKeys={[
            'id',
            'work_order_number',
            'work_order_number',
            'aircraft_id',
            'aircraft_registration',
            'created_at',
            'actual_start_date',
            'actual_end_date',
            'estimated_cost',
            'actual_cost',
            'source',
          ]}
        />
      </AmroModuleSurface>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Package?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete work package {deleteCandidate?.work_order_number || deleteCandidate?.work_order_number}.
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

      {/* Template Wizard (create/edit) */}
      {wizardOpen ? (
        <AmroRecordWizard
          mode={wizardMode}
          steps={wizardSteps}
          initialData={{ ...getWorkOrderWizardInitialData(), ...formValue }}
          onClose={() => setWizardOpen(false)}
          onSubmit={async (data) => {
            await handleWizardSubmit(data);
          }}
          onDraftSave={async () => {
            toast.info('Draft saved locally for this wizard session.');
          }}
        />
      ) : null}
    </div>
  );
}
