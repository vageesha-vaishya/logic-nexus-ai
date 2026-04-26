import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Cog, Download, FileText, Link2, Wrench } from 'lucide-react';
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
import { AmroModuleSurface } from '@/features/module-amro/components/parts/AmroPartsUiStandards';
import { AmroUnifiedGridRecordDetailShell } from '@/features/module-amro/components/parts/AmroUnifiedGridRecordDetailShell';
import type { GridColumnDefinition } from '@/features/module-amro/components/templates/AmroInventoryDataGridTemplate';
import {
  useAtaCodeOptions,
  useAssemblyModelOptions,
  useAssemblyTypeOptions,
  useCreateMpd,
  useDeleteMpd,
  useListMpd,
  useMpdActions,
  useTaskCategoryOptions,
  useUploadMpdAttachment,
  type UploadedMpdAttachment,
  useUpdateMpd,
  type MpdRecord,
  type MpdUpsertInput,
} from '@/features/module-amro/components/mpd/useMpdState';
import { formatThresholdFrequency } from '@/features/module-amro/components/mpd/frequencyFormatter';

type MpdGridRow = MpdRecord & Record<string, unknown>;

type MpdCreateFormState = MpdUpsertInput & {
  inspection_type: string;
  zone: string;
  area: string;
  note: string;
  estimated_man_hours_hms: string;
  frequency_hours: number | null;
  frequency_hours_hms: string;
  frequency_hobbs: number | null;
  frequency_days: number | null;
  frequency_months: number | null;
  frequency_years: number | null;
  frequency_cycles: number | null;
  frequency_rins: number | null;
  frequency_landings: number | null;
  other_tools: string;
  other_spares: string;
  other_task_cards: string;
  other_linked_activities: string;
  attachment: UploadedMpdAttachment | null;
};

const CREATE_DEFAULTS: MpdCreateFormState = {
  mpd_code: '',
  ata_code: '',
  reference_amp: '',
  description: '',
  category_code: '',
  estimated_man_hours: null,
  revision_status: null,
  interval_hours: null,
  interval_cycles: null,
  interval_months: null,
  threshold_cycles: null,
  is_mandatory: true,
  assembly_model_id: '',
  loc_json: [],
  other_details_json: [],
  task_template_detail_json: [],
  task_template_scope_json: [],
  inspection_type: '',
  zone: '',
  area: '',
  note: '',
  estimated_man_hours_hms: '',
  frequency_hours: null,
  frequency_hours_hms: '',
  frequency_hobbs: null,
  frequency_days: null,
  frequency_months: null,
  frequency_years: null,
  frequency_cycles: null,
  frequency_rins: null,
  frequency_landings: null,
  other_tools: '',
  other_spares: '',
  other_task_cards: '',
  other_linked_activities: '',
  attachment: null,
};

function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseHoursHmsToNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  return hours + (minutes / 60) + (seconds / 3600);
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
    threshold_cycles: record.threshold_cycles === null || record.threshold_cycles === undefined
      ? null
      : Number(record.threshold_cycles),
    is_mandatory: Boolean(record.is_mandatory),
    assembly_model_id: String(record.assembly_model_id || '').trim() || null,
    loc_json: Array.isArray(record.loc_json) ? record.loc_json : [],
    other_details_json: Array.isArray(record.other_details_json) ? record.other_details_json : [],
    task_template_detail_json: Array.isArray(record.task_template_detail_json) ? record.task_template_detail_json : [],
    task_template_scope_json: Array.isArray(record.task_template_scope_json) ? record.task_template_scope_json : [],
  };
}

export function AmroMpdManagementPage() {
  const [records, setRecords] = useState<MpdRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<MpdRecord | null>(null);
  const [createForm, setCreateForm] = useState<MpdCreateFormState>(CREATE_DEFAULTS);
  const [advancedFilters, setAdvancedFilters] = useState({
    assemblyType: '',
    model: '',
    mpdNo: '',
    category: 'all',
    ata: 'all',
  });

  const listEnabled = Boolean(advancedFilters.assemblyType && advancedFilters.model);
  const { data, isLoading, isError, error } = useListMpd({
    page: 1,
    pageSize: 500,
    modelId: advancedFilters.model || undefined,
    ataCode: advancedFilters.ata !== 'all' ? advancedFilters.ata : undefined,
    categoryCode: advancedFilters.category !== 'all' ? advancedFilters.category : undefined,
    enabled: listEnabled,
  });
  const assemblyTypeOptionsQuery = useAssemblyTypeOptions(true);
  const assemblyModelOptionsQuery = useAssemblyModelOptions(true);
  const createMutation = useCreateMpd();
  const uploadAttachmentMutation = useUploadMpdAttachment();
  const updateMutation = useUpdateMpd();
  const deleteMutation = useDeleteMpd();
  const { invalidate, exportCsv } = useMpdActions();
  const ataCodeOptionsQuery = useAtaCodeOptions(true);
  const taskCategoryOptionsQuery = useTaskCategoryOptions(true);

  useEffect(() => {
    if (data?.records) setRecords(data.records);
    if (!listEnabled) {
      setErrorMessage('Select Assembly Type and Model to load MPD records');
      setRecords([]);
      return;
    }
    if (isError) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load MPD records');
    } else {
      setErrorMessage(null);
    }
  }, [data, error, isError, listEnabled]);

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

  const hasHoursValue = createForm.frequency_hours_hms.trim().length > 0;
  const hasHobbsValue = createForm.frequency_hobbs !== null;
  const hasDaysValue = createForm.frequency_days !== null;
  const hasMonthsValue = createForm.frequency_months !== null;
  const hasYearsValue = createForm.frequency_years !== null;
  const hourHobbsSelected: 'hours' | 'hobbs' | null = hasHoursValue ? 'hours' : hasHobbsValue ? 'hobbs' : null;
  const dayMonthYearSelected: 'days' | 'months' | 'years' | null = hasDaysValue
    ? 'days'
    : hasMonthsValue
      ? 'months'
      : hasYearsValue
        ? 'years'
        : null;

  const handleCreate = useCallback(async () => {
    if (!advancedFilters.model) {
      toast.error('Model selection is required');
      return;
    }
    if (!createForm.description || !createForm.ata_code || !createForm.inspection_type) {
      toast.error('Description, ATA Code, and Category are required');
      return;
    }
    const parsedIntervalHours = parseHoursHmsToNumber(createForm.frequency_hours_hms);
    if (createForm.frequency_hours_hms.trim().length > 0 && parsedIntervalHours === null) {
      toast.error('Hours must be in HH:MM:SS format. MM and SS cannot exceed 59.');
      return;
    }
    const parsedEstimatedManHours = parseHoursHmsToNumber(createForm.estimated_man_hours_hms);
    if (createForm.estimated_man_hours_hms.trim().length > 0 && parsedEstimatedManHours === null) {
      toast.error('Estd. Man Hours must be in HH:MM:SS format. MM and SS cannot exceed 59.');
      return;
    }
    const locJson = [
      {
        zone: String(createForm.zone || '').trim(),
        area: String(createForm.area || '').trim(),
        notes: String(createForm.note || '').trim(),
      },
    ];
    const otherDetailsJson = [
      {
        tools: String(createForm.other_tools || '').trim(),
        spares: String(createForm.other_spares || '').trim(),
        task_cards: String(createForm.other_task_cards || '').trim(),
        linked_activities: String(createForm.other_linked_activities || '').trim(),
        frequency_days: createForm.frequency_days,
        attachments: createForm.attachment ? [createForm.attachment] : [],
      },
    ];
    const computedIntervalMonths = (() => {
      const months = createForm.frequency_months ?? 0;
      const years = createForm.frequency_years ?? 0;
      const totalMonths = months + (years * 12);
      return totalMonths > 0 ? totalMonths : null;
    })();
    try {
      await createMutation.mutateAsync({
        ...createForm,
        assembly_model_id: advancedFilters.model,
        category_code: createForm.inspection_type || null,
        reference_amp: createForm.reference_amp || null,
        estimated_man_hours: parsedEstimatedManHours,
        interval_hours: parsedIntervalHours,
        threshold_hobbs: createForm.frequency_hobbs,
        interval_cycles: createForm.frequency_cycles,
        threshold_rins: createForm.frequency_rins,
        interval_months: computedIntervalMonths,
        threshold_cycles: createForm.frequency_cycles,
        loc_json: locJson,
        other_details_json: otherDetailsJson,
      });
      toast.success('MPD record created');
      setCreateOpen(false);
      setCreateForm(CREATE_DEFAULTS);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create MPD record');
    }
  }, [advancedFilters.model, createForm, createMutation, invalidate]);

  const handleSelectAttachment = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const attachment = await uploadAttachmentMutation.mutateAsync(file);
      setCreateForm((current) => ({ ...current, attachment }));
      toast.success('Attachment uploaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload attachment');
    }
  }, [uploadAttachmentMutation]);

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

  const assemblyTypeOptions = useMemo(
    () => assemblyTypeOptionsQuery.data || [],
    [assemblyTypeOptionsQuery.data],
  );

  const modelOptions = useMemo(() => {
    const source = assemblyModelOptionsQuery.data || [];
    if (!advancedFilters.assemblyType) return [];
    return source.filter((model) => model.assembly_type_id === advancedFilters.assemblyType);
  }, [advancedFilters.assemblyType, assemblyModelOptionsQuery.data]);
  const selectedModelName = useMemo(
    () => modelOptions.find((option) => option.id === advancedFilters.model)?.name || advancedFilters.model,
    [advancedFilters.model, modelOptions],
  );

  const categoryOptions = useMemo(() => taskCategoryOptionsQuery.data || [], [taskCategoryOptionsQuery.data]);
  const ataOptions = useMemo(() => ataCodeOptionsQuery.data || [], [ataCodeOptionsQuery.data]);

  useEffect(() => {
    if (!advancedFilters.model) return;
    const exists = modelOptions.some((item) => item.id === advancedFilters.model);
    if (!exists) {
      setAdvancedFilters((current) => ({ ...current, model: '' }));
    }
  }, [advancedFilters.model, modelOptions]);

  useEffect(() => {
    if (!assemblyTypeOptions.length) return;
    const preferred = assemblyTypeOptions.find((option) => option.name.trim().toLowerCase() === 'airframe');
    if (!preferred?.id) {
      setErrorMessage('Assembly Type "Airframe" is not available for this tenant');
      return;
    }
    const nextAssemblyType = preferred.id;
    setAdvancedFilters((current) => (
      current.assemblyType ? current : { ...current, assemblyType: nextAssemblyType }
    ));
  }, [assemblyTypeOptions]);

  useEffect(() => {
    if (!advancedFilters.assemblyType || !modelOptions.length) return;
    const hasCurrent = modelOptions.some((model) => model.id === advancedFilters.model);
    if (hasCurrent) return;
    const firstValidModel = modelOptions.find((model) => model.id && model.name.trim());
    if (!firstValidModel) {
      setErrorMessage('No valid models found for selected Assembly Type');
      return;
    }
    setAdvancedFilters((current) => ({ ...current, model: firstValidModel.id }));
  }, [advancedFilters.assemblyType, advancedFilters.model, modelOptions]);

  const gridRecords = useMemo<MpdGridRow[]>(
    () =>
      records.map((record) => ({
        ...(record as MpdGridRow),
        frequency_display: formatThresholdFrequency(record),
      })),
    [records],
  );

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
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) {
                    setErrorMessage('Assembly Type cannot be empty');
                    return;
                  }
                  setAdvancedFilters((current) => ({ ...current, assemblyType: value, model: '' }));
                }}
                required
              >
                {assemblyTypeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>Model</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-2"
                value={advancedFilters.model}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) {
                    setErrorMessage('Model cannot be empty');
                    return;
                  }
                  setAdvancedFilters((current) => ({ ...current, model: value }));
                }}
                required
                disabled={!modelOptions.length}
              >
                {modelOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
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
              <Label>Category</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-2"
                value={advancedFilters.category}
                onChange={(event) => setAdvancedFilters((current) => ({ ...current, category: event.target.value }))}
              >
                <option value="all">(All)</option>
                {categoryOptions.map((option) => (
                  <option key={option.id} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>ATA</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-2"
                value={advancedFilters.ata}
                onChange={(event) => setAdvancedFilters((current) => ({ ...current, ata: event.target.value }))}
              >
                <option value="all">(All)</option>
                {ataOptions.map((option) => (
                  <option key={option.id} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-1.5 text-xs">
          <span className="font-medium">Total MPD Records: {records.length}</span>
          <span className="text-muted-foreground">|</span>
          <span className="font-medium text-amber-700">Mandatory: {stats.mandatory}</span>
          <span className="text-muted-foreground">|</span>
          <span className="font-medium text-emerald-700">Interval-driven: {stats.withIntervals}</span>
          <span className="text-muted-foreground">|</span>
          <span className="font-medium">Optional: {stats.custom}</span>
        </div>

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
            { key: 'frequency_display', header: 'Frequency', sortable: true, filterable: true, groupable: true, resizable: true, width: 240 },
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
            'threshold_cycles',
            'is_mandatory',
            'assembly_model_id',
            'loc_json',
            'other_details_json',
            'task_template_detail_json',
            'task_template_scope_json',
          ]}
          hiddenDetailFieldKeys={['id', 'tenant_id', 'franchise_id', 'created_at', 'updated_at', 'mpd_sequence']}
        />
      </AmroModuleSurface>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-5xl border-2 border-sky-500 p-0">
          <DialogHeader>
            <DialogTitle className="bg-[#37589b] px-4 py-2 text-xl font-bold text-white">
              Create MPD Record for model {selectedModelName || 'Selected Model'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-4 pb-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_0.9fr]">
              <section className="rounded-none border border-sky-500 p-3">
                <h3 className="mb-3 text-2xl font-semibold">Inspection Details</h3>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.48fr_1fr] md:items-center">
                    <Label htmlFor="mpd-code" className="text-xl font-medium">Code/Form No</Label>
                    <Input
                      id="mpd-code"
                      className="h-10 border-2 border-black"
                      value={createForm.mpd_code || ''}
                      onChange={(event) => setCreateForm((current) => ({ ...current, mpd_code: event.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.48fr_1fr] md:items-center">
                    <Label htmlFor="ata-code" className="text-xl font-medium">ATA Chapter *</Label>
                    <select
                      id="ata-code"
                      className="h-10 w-full rounded-md border-2 border-black bg-background px-2 text-base"
                      value={createForm.ata_code || ''}
                      onChange={(event) => setCreateForm((current) => ({ ...current, ata_code: event.target.value }))}
                    >
                      <option value="">(SELECT)</option>
                      {(ataCodeOptionsQuery.data || []).map((option) => (
                        <option key={option.id} value={option.code}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.48fr_1fr] md:items-start">
                    <Label htmlFor="reference-amp" className="pt-2 text-xl font-medium">Reference</Label>
                    <Textarea
                      id="reference-amp"
                      className="min-h-20 border-2 border-black"
                      value={createForm.reference_amp || ''}
                      onChange={(event) => setCreateForm((current) => ({ ...current, reference_amp: event.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.48fr_1fr] md:items-start">
                    <Label htmlFor="description" className="pt-2 text-xl font-medium">Description *</Label>
                    <Textarea
                      id="description"
                      className="min-h-20 border-2 border-black"
                      value={createForm.description || ''}
                      onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.48fr_1fr] md:items-center">
                    <Label htmlFor="inspection-type" className="text-xl font-medium">Inspection Type *</Label>
                    <select
                      id="inspection-type"
                      className="h-10 w-full rounded-md border-2 border-black bg-background px-2 text-base"
                      value={createForm.inspection_type}
                      onChange={(event) => setCreateForm((current) => ({ ...current, inspection_type: event.target.value }))}
                    >
                      <option value="">(SELECT)</option>
                      {categoryOptions.map((option) => (
                        <option key={option.id} value={option.code}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.48fr_1fr] md:items-center">
                    <Label htmlFor="zone" className="text-xl font-medium">Zone</Label>
                    <Input
                      id="zone"
                      className="h-10 border-2 border-black"
                      value={createForm.zone}
                      onChange={(event) => setCreateForm((current) => ({ ...current, zone: event.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.48fr_1fr] md:items-center">
                    <Label htmlFor="area" className="text-xl font-medium">Area</Label>
                    <Input
                      id="area"
                      className="h-10 border-2 border-black"
                      value={createForm.area}
                      onChange={(event) => setCreateForm((current) => ({ ...current, area: event.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.48fr_1fr] md:items-start">
                    <Label htmlFor="note" className="pt-2 text-xl font-medium">Note</Label>
                    <Textarea
                      id="note"
                      className="min-h-20 border-2 border-black"
                      value={createForm.note}
                      onChange={(event) => setCreateForm((current) => ({ ...current, note: event.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.48fr_1fr] md:items-center">
                    <Label htmlFor="estimated-man-hours" className="text-xl font-medium">Estd. Man Hours</Label>
                    <Input
                      id="estimated-man-hours"
                      type="text"
                      className="h-10 border-2 border-black"
                      value={createForm.estimated_man_hours_hms}
                      placeholder="HH:MM:SS"
                      onChange={(event) => {
                        const sanitized = event.target.value.replace(/[^\d:]/g, '');
                        if (!/^\d{0,8}(?::\d{0,2}){0,2}$/.test(sanitized)) {
                          return;
                        }
                        setCreateForm((current) => ({
                          ...current,
                          estimated_man_hours_hms: sanitized,
                          estimated_man_hours: parseHoursHmsToNumber(sanitized),
                        }));
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-[0.48fr_1fr] md:items-center">
                    <Label className="text-xl font-medium">Attach File</Label>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="file"
                          className="h-10 border-2 border-black"
                          onChange={(event) => void handleSelectAttachment(event.target.files?.[0] || null)}
                          disabled={uploadAttachmentMutation.isPending}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateForm((current) => ({ ...current, attachment: null }))}
                        >
                          Remove Attachment
                        </Button>
                      </div>
                      {createForm.attachment ? (
                        <p className="text-xs text-muted-foreground">
                          Attached: {createForm.attachment.file_name}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>

              <div className="space-y-4">
                <section className="rounded-none border border-sky-500 p-3">
                  <h3 className="mb-2 text-2xl font-semibold">Frequency of Inspection</h3>
                  <div className="overflow-hidden rounded-md border-2 border-black">
                    <div className="grid grid-cols-[1fr_1fr] border-b-2 border-black bg-[#37589b] text-lg font-semibold text-white">
                      <span className="border-r-2 border-black px-2 py-1">Period</span>
                      <span className="px-2 py-1">Frequency</span>
                    </div>
                    {[
                      {
                        id: 'interval-hours',
                        label: 'Hours',
                        value: createForm.frequency_hours_hms,
                        disabled: hourHobbsSelected === 'hobbs',
                        inputType: 'text',
                        placeholder: 'HH:MM:SS',
                        onChange: (value: string) => {
                          const sanitized = value.replace(/[^\d:]/g, '');
                          if (!/^\d{0,8}(?::\d{0,2}){0,2}$/.test(sanitized)) {
                            return;
                          }
                          setCreateForm((current) => ({
                            ...current,
                            frequency_hours_hms: sanitized,
                            frequency_hours: parseHoursHmsToNumber(sanitized),
                          }));
                        },
                      },
                      {
                        id: 'interval-hobbs',
                        label: 'Hobbs',
                        value: createForm.frequency_hobbs,
                        disabled: hourHobbsSelected === 'hours',
                        onChange: (value: string) => setCreateForm((current) => ({ ...current, frequency_hobbs: toNullableNumber(value) })),
                      },
                      {
                        id: 'interval-days',
                        label: 'Days',
                        value: createForm.frequency_days,
                        disabled: dayMonthYearSelected !== null && dayMonthYearSelected !== 'days',
                        onChange: (value: string) => setCreateForm((current) => ({ ...current, frequency_days: toNullableNumber(value) })),
                      },
                      {
                        id: 'interval-months',
                        label: 'Months',
                        value: createForm.frequency_months,
                        disabled: dayMonthYearSelected !== null && dayMonthYearSelected !== 'months',
                        onChange: (value: string) => setCreateForm((current) => ({ ...current, frequency_months: toNullableNumber(value) })),
                      },
                      {
                        id: 'interval-years',
                        label: 'Years',
                        value: createForm.frequency_years,
                        disabled: dayMonthYearSelected !== null && dayMonthYearSelected !== 'years',
                        onChange: (value: string) => setCreateForm((current) => ({ ...current, frequency_years: toNullableNumber(value) })),
                      },
                      {
                        id: 'interval-cycles',
                        label: 'Cycles',
                        value: createForm.frequency_cycles,
                        disabled: false,
                        inputType: 'text',
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        onChange: (value: string) => {
                          const digitsOnly = value.replace(/\D/g, '');
                          setCreateForm((current) => ({ ...current, frequency_cycles: toNullableNumber(digitsOnly) }));
                        },
                      },
                      {
                        id: 'interval-rins',
                        label: 'RINS',
                        value: createForm.frequency_rins,
                        disabled: false,
                        inputType: 'text',
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        onChange: (value: string) => {
                          const digitsOnly = value.replace(/\D/g, '');
                          setCreateForm((current) => ({ ...current, frequency_rins: toNullableNumber(digitsOnly) }));
                        },
                      },
                      {
                        id: 'threshold-cycles',
                        label: 'Landings',
                        value: createForm.frequency_landings,
                        disabled: false,
                        inputType: 'text',
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        onChange: (value: string) => {
                          const digitsOnly = value.replace(/\D/g, '');
                          setCreateForm((current) => ({ ...current, frequency_landings: toNullableNumber(digitsOnly) }));
                        },
                      },
                    ].map((row, index, list) => (
                      <div
                        key={row.id}
                        className={`grid grid-cols-[1fr_1fr] ${index < list.length - 1 ? 'border-b border-black' : ''}`}
                      >
                        <Label htmlFor={row.id} className="border-r border-black px-2 py-1.5 text-lg font-medium">
                          {row.label}
                        </Label>
                        <div className="p-1">
                          <Input
                            id={row.id}
                            type={row.inputType || 'number'}
                            className={`h-9 border-2 border-black ${row.disabled ? 'cursor-not-allowed bg-muted text-muted-foreground' : ''}`}
                            value={row.value ?? ''}
                            placeholder={row.placeholder || undefined}
                            inputMode={row.inputMode === 'numeric' ? 'numeric' : undefined}
                            pattern={row.pattern || undefined}
                            onChange={(event) => row.onChange(event.target.value)}
                            disabled={row.disabled}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-none border border-sky-500 p-3">
                  <h3 className="mb-2 text-2xl font-semibold">Other Details</h3>
                  <div className="space-y-2">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md border border-sky-500 px-2 py-1.5 text-left text-blue-700 underline-offset-2 hover:underline"
                    >
                      <Wrench className="h-4 w-4" />
                      Tools {createForm.other_tools ? '(1 record)' : '(0 record(s))'}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md border border-sky-500 px-2 py-1.5 text-left text-blue-700 underline-offset-2 hover:underline"
                    >
                      <Cog className="h-4 w-4" />
                      Spares {createForm.other_spares ? '(1 record)' : '(0 record(s))'}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md border border-sky-500 px-2 py-1.5 text-left text-blue-700 underline-offset-2 hover:underline"
                    >
                      <ClipboardList className="h-4 w-4" />
                      Task Cards {createForm.other_task_cards ? '(1 record)' : '(0 record(s))'}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md border border-sky-500 px-2 py-1.5 text-left text-blue-700 underline-offset-2 hover:underline"
                    >
                      <Link2 className="h-4 w-4" />
                      Link Maint. Activity {createForm.other_linked_activities ? '(1 record)' : '(0 record(s))'}
                    </button>
                  </div>
                </section>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-none border border-sky-500 p-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="other-tools">Tools</Label>
                <Input
                  id="other-tools"
                  value={createForm.other_tools}
                  onChange={(event) => setCreateForm((current) => ({ ...current, other_tools: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="other-spares">Spares</Label>
                <Input
                  id="other-spares"
                  value={createForm.other_spares}
                  onChange={(event) => setCreateForm((current) => ({ ...current, other_spares: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="other-task-cards">Task Cards</Label>
                <Input
                  id="other-task-cards"
                  value={createForm.other_task_cards}
                  onChange={(event) => setCreateForm((current) => ({ ...current, other_task_cards: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="other-linked-activities">Link Maint. Activity</Label>
                <Input
                  id="other-linked-activities"
                  value={createForm.other_linked_activities}
                  onChange={(event) => setCreateForm((current) => ({ ...current, other_linked_activities: event.target.value }))}
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
          </div>

          <DialogFooter className="border-t px-4 pb-4 pt-3">
            <Button variant="outline" className="min-w-28 border-2 border-sky-500" onClick={() => setCreateOpen(false)}>
              Back
            </Button>
            <Button className="min-w-28 border-2 border-sky-500 bg-[#efefef] text-black hover:bg-[#dfdfdf]" onClick={() => void handleCreate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Save'}
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
