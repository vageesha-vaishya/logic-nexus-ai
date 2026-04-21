import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AmroCrudMessageBanner } from '@/features/module-amro/components/parts/AmroCrudPrimitives';
import { AmroKpiGrid, AmroModuleSurface } from '@/features/module-amro/components/parts/AmroPartsUiStandards';
import { AmroUnifiedGridRecordDetailShell } from '@/features/module-amro/components/parts/AmroUnifiedGridRecordDetailShell';
import type { GridColumnDefinition } from '@/features/module-amro/components/templates/AmroInventoryDataGridTemplate';
import {
  useCreateMpd,
  useDeleteMpd,
  useListMpd,
  useMpdActions,
  useUpdateMpd,
  type MpdRecord,
  type MpdUpsertInput,
} from '@/features/module-amro/components/mpd/useMpdState';

type MpdGridRow = MpdRecord & Record<string, unknown>;

const CREATE_DEFAULTS: MpdUpsertInput = {
  mpd_code: '',
  ata_code: '',
  reference_amp: '',
  description: '',
  category_code: '',
  estimated_man_hours: null,
  revision_status: '',
  interval_hours: null,
  interval_cycles: null,
  interval_months: null,
  is_mandatory: true,
  assembly_model_id: '',
  task_template_detail_json: [],
  task_template_scope_json: [],
};

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toUpsertPayload(record: MpdGridRow): MpdUpsertInput {
  return {
    mpd_code: String(record.mpd_code || '').trim() || null,
    ata_code: String(record.ata_code || '').trim() || null,
    reference_amp: String(record.reference_amp || '').trim() || null,
    description: String(record.description || '').trim() || null,
    category_code: String(record.category_code || '').trim() || null,
    estimated_man_hours: record.estimated_man_hours === null || record.estimated_man_hours === undefined
      ? null
      : Number(record.estimated_man_hours),
    revision_status: String(record.revision_status || '').trim() || null,
    interval_hours: record.interval_hours === null || record.interval_hours === undefined
      ? null
      : Number(record.interval_hours),
    interval_cycles: record.interval_cycles === null || record.interval_cycles === undefined
      ? null
      : Number(record.interval_cycles),
    interval_months: record.interval_months === null || record.interval_months === undefined
      ? null
      : Number(record.interval_months),
    is_mandatory: Boolean(record.is_mandatory),
    assembly_model_id: String(record.assembly_model_id || '').trim() || null,
    task_template_detail_json: Array.isArray(record.task_template_detail_json) ? record.task_template_detail_json : [],
    task_template_scope_json: Array.isArray(record.task_template_scope_json) ? record.task_template_scope_json : [],
  };
}

export function AmroMpdManagementPage() {
  const [records, setRecords] = useState<MpdRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<MpdRecord | null>(null);
  const [createForm, setCreateForm] = useState<MpdUpsertInput>(CREATE_DEFAULTS);
  const [advancedFilters, setAdvancedFilters] = useState({
    assemblyType: 'all',
    model: 'all',
    mpdNo: '',
    monitorType: 'all',
    ata: 'all',
    description: '',
    serviceType: 'all',
  });

  const { data, isLoading, isError, error } = useListMpd({ page: 1, pageSize: 500 });
  const createMutation = useCreateMpd();
  const updateMutation = useUpdateMpd();
  const deleteMutation = useDeleteMpd();
  const { invalidate, exportCsv } = useMpdActions();

  useEffect(() => {
    if (data?.records) setRecords(data.records);
    if (isError) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load MPD records');
    } else {
      setErrorMessage(null);
    }
  }, [data, error, isError]);

  const stats = useMemo(() => {
    const mandatory = records.filter((record) => record.is_mandatory).length;
    const withIntervals = records.filter((record) =>
      record.interval_hours !== null || record.interval_cycles !== null || record.interval_months !== null,
    ).length;
    return {
      total: records.length,
      mandatory,
      withIntervals,
      custom: Math.max(records.length - mandatory, 0),
    };
  }, [records]);

  const handleCreate = useCallback(async () => {
    if (!createForm.description || !createForm.ata_code) {
      toast.error('Description and ATA Code are required');
      return;
    }
    try {
      await createMutation.mutateAsync(createForm);
      toast.success('MPD record created');
      setCreateOpen(false);
      setCreateForm(CREATE_DEFAULTS);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create MPD record');
    }
  }, [createForm, createMutation, invalidate]);

  const handleInlineSave = useCallback(async (row: MpdGridRow) => {
    try {
      await updateMutation.mutateAsync({ id: String(row.id), input: toUpsertPayload(row) });
      toast.success('MPD record updated');
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update MPD record');
    }
  }, [invalidate, updateMutation]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('MPD record deleted');
      setDeleteCandidate(null);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete MPD record');
    }
  }, [deleteMutation, invalidate]);

  const handleExport = useCallback(async () => {
    try {
      const blob = await exportCsv();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `mpd-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      toast.success('MPD export downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export MPD records');
    }
  }, [exportCsv]);

  const assemblyTypeOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((record) => String((record as Record<string, unknown>).assembly_type || '').trim()).filter(Boolean)));
    return ['all', ...values];
  }, [records]);

  const modelOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((record) => String(record.assembly_model_id || '').trim()).filter(Boolean)));
    return ['all', ...values];
  }, [records]);

  const monitorTypeOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((record) => String((record as Record<string, unknown>).monitor_type || '').trim()).filter(Boolean)));
    return ['all', ...values];
  }, [records]);

  const ataOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((record) => String(record.ata_code || '').trim()).filter(Boolean)));
    return ['all', ...values];
  }, [records]);

  const serviceTypeOptions = useMemo(() => {
    const values = Array.from(new Set(records.map((record) => String(record.category_code || '').trim()).filter(Boolean)));
    return ['all', ...values];
  }, [records]);

  const filteredRecords = useMemo(() => {
    const mpdNoQuery = advancedFilters.mpdNo.trim().toLowerCase();
    const descriptionQuery = advancedFilters.description.trim().toLowerCase();
    return records.filter((record) => {
      if (advancedFilters.assemblyType !== 'all') {
        const value = String((record as Record<string, unknown>).assembly_type || '').trim();
        if (value !== advancedFilters.assemblyType) return false;
      }
      if (advancedFilters.model !== 'all') {
        if (String(record.assembly_model_id || '').trim() !== advancedFilters.model) return false;
      }
      if (advancedFilters.monitorType !== 'all') {
        const value = String((record as Record<string, unknown>).monitor_type || '').trim();
        if (value !== advancedFilters.monitorType) return false;
      }
      if (advancedFilters.ata !== 'all') {
        if (String(record.ata_code || '').trim() !== advancedFilters.ata) return false;
      }
      if (advancedFilters.serviceType !== 'all') {
        if (String(record.category_code || '').trim() !== advancedFilters.serviceType) return false;
      }
      if (mpdNoQuery) {
        const code = String(record.mpd_code || '').toLowerCase();
        const seq = String(record.mpd_sequence || '').toLowerCase();
        if (!code.includes(mpdNoQuery) && !seq.includes(mpdNoQuery)) return false;
      }
      if (descriptionQuery) {
        const value = String(record.description || '').toLowerCase();
        if (!value.includes(descriptionQuery)) return false;
      }
      return true;
    });
  }, [advancedFilters, records]);

  const gridRecords = useMemo<MpdGridRow[]>(() => filteredRecords as MpdGridRow[], [filteredRecords]);

  return (
    <DashboardLayout>
      <div className="space-y-3 p-4 lg:p-6">
        <AmroModuleSurface
          title="MPD Management"
          subtitle="Maintenance Planning Document workspace with table and record-detail CRUD controls."
          moduleId="amro.mpd"
          status={errorMessage ? 'warning' : isLoading ? 'loading' : 'ready'}
        >
        <div className="flex items-center justify-end">
          <Button variant="outline" onClick={() => void handleExport()}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <div className="rounded-md border border-cyan-300 bg-cyan-50/20 p-3">
          <h3 className="mb-3 text-xl font-semibold">MPD Advanced Filters</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="space-y-1 md:col-span-2">
              <Label>Assembly Type</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-2"
                value={advancedFilters.assemblyType}
                onChange={(event) => setAdvancedFilters((current) => ({ ...current, assemblyType: event.target.value }))}
              >
                {assemblyTypeOptions.map((option) => <option key={option} value={option}>{option === 'all' ? '(All)' : option}</option>)}
              </select>
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>Model</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-2"
                value={advancedFilters.model}
                onChange={(event) => setAdvancedFilters((current) => ({ ...current, model: event.target.value }))}
              >
                {modelOptions.map((option) => <option key={option} value={option}>{option === 'all' ? '(All)' : option}</option>)}
              </select>
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>MPD No.</Label>
              <Input
                value={advancedFilters.mpdNo}
                onChange={(event) => setAdvancedFilters((current) => ({ ...current, mpdNo: event.target.value }))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Monitor Type</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-2"
                value={advancedFilters.monitorType}
                onChange={(event) => setAdvancedFilters((current) => ({ ...current, monitorType: event.target.value }))}
              >
                {monitorTypeOptions.map((option) => <option key={option} value={option}>{option === 'all' ? '(All)' : option}</option>)}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>ATA</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-2"
                value={advancedFilters.ata}
                onChange={(event) => setAdvancedFilters((current) => ({ ...current, ata: event.target.value }))}
              >
                {ataOptions.map((option) => <option key={option} value={option}>{option === 'all' ? '(All)' : option}</option>)}
              </select>
            </div>
            <div className="space-y-1 md:col-span-4">
              <Label>Description</Label>
              <Textarea
                rows={1}
                value={advancedFilters.description}
                onChange={(event) => setAdvancedFilters((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>Service Type</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-2"
                value={advancedFilters.serviceType}
                onChange={(event) => setAdvancedFilters((current) => ({ ...current, serviceType: event.target.value }))}
              >
                {serviceTypeOptions.map((option) => <option key={option} value={option}>{option === 'all' ? '(All)' : option}</option>)}
              </select>
            </div>
          </div>
        </div>

        <AmroKpiGrid
          items={[
            { label: 'Total MPD Records', value: String(filteredRecords.length) },
            { label: 'Mandatory', value: String(stats.mandatory), tone: stats.mandatory > 0 ? 'warning' : 'default' },
            { label: 'Interval-driven', value: String(stats.withIntervals), tone: stats.withIntervals > 0 ? 'success' : 'default' },
            { label: 'Optional', value: String(stats.custom) },
          ]}
        />

        <AmroCrudMessageBanner message={errorMessage} tone="error" />

        <AmroUnifiedGridRecordDetailShell
          title="MPD Records"
          subtitle="Work Packages-style data grid with right-side Record Detail panel and in-panel CRUD actions."
          records={gridRecords}
          columns={[
            { key: 'mpd_sequence', header: 'MPD Seq', sortable: true, filterable: true, groupable: true, resizable: true, width: 110, dataType: 'numeric' },
            { key: 'mpd_code', header: 'Code/Form', sortable: true, filterable: true, groupable: true, resizable: true, width: 140 },
            { key: 'ata_code', header: 'ATA Code', sortable: true, filterable: true, groupable: true, resizable: true, width: 120 },
            { key: 'reference_amp', header: 'Reference AMP', sortable: true, filterable: true, groupable: true, resizable: true, width: 180 },
            { key: 'description', header: 'Description', sortable: true, filterable: true, groupable: false, resizable: true, width: 280 },
            { key: 'category_code', header: 'Category', sortable: true, filterable: true, groupable: true, resizable: true, width: 120 },
            { key: 'estimated_man_hours', header: 'Man Hours', sortable: true, filterable: true, groupable: true, resizable: true, width: 120, dataType: 'numeric' },
            { key: 'is_mandatory', header: 'Mandatory', sortable: true, filterable: true, groupable: true, resizable: true, width: 120, dataType: 'boolean' },
            { key: 'created_at', header: 'Created', sortable: true, filterable: true, groupable: true, resizable: true, width: 130, dataType: 'date' },
          ] satisfies GridColumnDefinition<MpdGridRow>[]}
          viewMode="grid-with-right-form"
          persistKey="amro-mpd-advanced-grid"
          ariaLabel="MPD advanced grid"
          enableColumnFilters
          enableDetailPanelToggle
          onCreateRecord={() => setCreateOpen(true)}
          onReadRecord={() => {
            toast.info('MPD details are visible in Record Detail panel');
          }}
          onDeleteRecord={(record) => setDeleteCandidate(record as MpdRecord)}
          onSaveRecord={(record) => { void handleInlineSave(record); }}
          onCancelRecord={() => {
            toast.info('Inline MPD edits cancelled');
          }}
          requiredDetailFieldKeys={['ata_code', 'description']}
          defaultVisibleDetailFieldKeys={[
            'mpd_code',
            'ata_code',
            'reference_amp',
            'description',
            'category_code',
            'estimated_man_hours',
            'revision_status',
            'interval_hours',
            'interval_cycles',
            'interval_months',
            'is_mandatory',
            'assembly_model_id',
            'task_template_detail_json',
            'task_template_scope_json',
          ]}
          hiddenDetailFieldKeys={['id', 'tenant_id', 'franchise_id', 'created_at', 'updated_at', 'mpd_sequence']}
        />
      </AmroModuleSurface>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create MPD Record</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mpd-code">Code / Form No</Label>
              <Input
                id="mpd-code"
                value={createForm.mpd_code || ''}
                onChange={(event) => setCreateForm((current) => ({ ...current, mpd_code: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ata-code">ATA Code *</Label>
              <Input
                id="ata-code"
                value={createForm.ata_code || ''}
                onChange={(event) => setCreateForm((current) => ({ ...current, ata_code: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={createForm.description || ''}
                onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference-amp">Reference AMP</Label>
              <Input
                id="reference-amp"
                value={createForm.reference_amp || ''}
                onChange={(event) => setCreateForm((current) => ({ ...current, reference_amp: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-code">Category Code</Label>
              <Input
                id="category-code"
                value={createForm.category_code || ''}
                onChange={(event) => setCreateForm((current) => ({ ...current, category_code: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimated-man-hours">Estimated Man Hours</Label>
              <Input
                id="estimated-man-hours"
                type="number"
                value={createForm.estimated_man_hours ?? ''}
                onChange={(event) => setCreateForm((current) => ({ ...current, estimated_man_hours: toNullableNumber(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revision-status">Revision Status</Label>
              <Input
                id="revision-status"
                value={createForm.revision_status || ''}
                onChange={(event) => setCreateForm((current) => ({ ...current, revision_status: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval-hours">Interval Hours</Label>
              <Input
                id="interval-hours"
                type="number"
                value={createForm.interval_hours ?? ''}
                onChange={(event) => setCreateForm((current) => ({ ...current, interval_hours: toNullableNumber(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval-cycles">Interval Cycles</Label>
              <Input
                id="interval-cycles"
                type="number"
                value={createForm.interval_cycles ?? ''}
                onChange={(event) => setCreateForm((current) => ({ ...current, interval_cycles: toNullableNumber(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval-months">Interval Months</Label>
              <Input
                id="interval-months"
                type="number"
                value={createForm.interval_months ?? ''}
                onChange={(event) => setCreateForm((current) => ({ ...current, interval_months: toNullableNumber(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assembly-model-id">Assembly Model ID</Label>
              <Input
                id="assembly-model-id"
                value={createForm.assembly_model_id || ''}
                onChange={(event) => setCreateForm((current) => ({ ...current, assembly_model_id: event.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Mandatory Task Template
              </div>
              <Switch
                checked={Boolean(createForm.is_mandatory)}
                onCheckedChange={(checked) => setCreateForm((current) => ({ ...current, is_mandatory: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create MPD'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete MPD Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete MPD record {deleteCandidate?.mpd_sequence || deleteCandidate?.mpd_code || deleteCandidate?.id}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCandidate && void handleDelete(deleteCandidate.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </DashboardLayout>
  );
}

export default AmroMpdManagementPage;
