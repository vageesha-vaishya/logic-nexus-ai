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
import { AmroModuleSurface } from '@/features/module-amro/components/parts/AmroPartsUiStandards';
import { AmroUnifiedGridRecordDetailShell } from '@/features/module-amro/components/parts/AmroUnifiedGridRecordDetailShell';
import type { GridColumnDefinition } from '@/features/module-amro/components/templates/AmroInventoryDataGridTemplate';
import {
  useAtaCodeOptions,
  useAssemblyModelOptions,
  useAssemblyTypeOptions,
  useCreateDirective,
  useDeleteDirective,
  useDirectiveTypeOptions,
  useDirectivesActions,
  useListDirectives,
  useUpdateDirective,
  useUploadDirectiveAttachment,
  type DirectiveRecord,
  type DirectiveUpsertInput,
  type UploadedDirectiveAttachment,
} from '@/features/module-amro/components/mpd/useDirectivesState';
import { formatThresholdFrequency } from '@/features/module-amro/components/mpd/frequencyFormatter';

type DirectiveGridRow = DirectiveRecord & Record<string, unknown>;

type DirectiveCreateFormState = DirectiveUpsertInput & {
  directive_type_id: string;
  zone: string;
  area: string;
  note: string;
  frequency_hours: number | null;
  frequency_days: number | null;
  frequency_cycles: number | null;
  frequency_landings: number | null;
  other_tools: string;
  other_spares: string;
  other_task_cards: string;
  other_linked_activities: string;
  attachment: UploadedDirectiveAttachment | null;
};

const CREATE_DEFAULTS: DirectiveCreateFormState = {
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
  directives_type_id: null,
  loc_json: [],
  other_details_json: [],
  task_template_detail_json: [],
  task_template_scope_json: [],
  directive_type_id: '',
  zone: '',
  area: '',
  note: '',
  frequency_hours: null,
  frequency_days: null,
  frequency_cycles: null,
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

function toUpsertPayload(record: DirectiveGridRow): DirectiveUpsertInput {
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
    directives_type_id: String(record.directives_type_id || '').trim() || null,
    loc_json: Array.isArray(record.loc_json) ? record.loc_json : [],
    other_details_json: Array.isArray(record.other_details_json) ? record.other_details_json : [],
    task_template_detail_json: Array.isArray(record.task_template_detail_json) ? record.task_template_detail_json : [],
    task_template_scope_json: Array.isArray(record.task_template_scope_json) ? record.task_template_scope_json : [],
  };
}

export function AmroDirectivesManagementPage() {
  const [records, setRecords] = useState<DirectiveRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<DirectiveRecord | null>(null);
  const [createForm, setCreateForm] = useState<DirectiveCreateFormState>(CREATE_DEFAULTS);
  const [advancedFilters, setAdvancedFilters] = useState({
    assemblyType: '',
    model: '',
    directiveNo: '',
    directiveType: 'all',
    ata: 'all',
  });

  const listEnabled = Boolean(advancedFilters.assemblyType && advancedFilters.model);
  const { data, isLoading, isError, error } = useListDirectives({
    page: 1,
    pageSize: 500,
    search: advancedFilters.directiveNo || undefined,
    modelId: advancedFilters.model || undefined,
    ataCode: advancedFilters.ata !== 'all' ? advancedFilters.ata : undefined,
    directivesTypeId: advancedFilters.directiveType !== 'all' ? advancedFilters.directiveType : undefined,
    enabled: listEnabled,
  });
  const assemblyTypeOptionsQuery = useAssemblyTypeOptions(true);
  const assemblyModelOptionsQuery = useAssemblyModelOptions(true);
  const createMutation = useCreateDirective();
  const uploadAttachmentMutation = useUploadDirectiveAttachment();
  const updateMutation = useUpdateDirective();
  const deleteMutation = useDeleteDirective();
  const { invalidate, exportCsv } = useDirectivesActions();
  const ataCodeOptionsQuery = useAtaCodeOptions(true);
  const directiveTypeOptionsQuery = useDirectiveTypeOptions(true);

  useEffect(() => {
    if (data?.records) setRecords(data.records);
    if (!listEnabled) {
      setErrorMessage('Select Assembly Type and Model to load directives records');
      setRecords([]);
      return;
    }
    if (isError) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load directives records');
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

  const handleCreate = useCallback(async () => {
    if (!advancedFilters.model) {
      toast.error('Model selection is required');
      return;
    }
    if (!createForm.description || !createForm.ata_code || !createForm.directive_type_id) {
      toast.error('Description, ATA Code, and Directive Type are required');
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
    try {
      await createMutation.mutateAsync({
        ...createForm,
        directives_type_id: createForm.directive_type_id,
        assembly_model_id: advancedFilters.model,
        reference_amp: createForm.reference_amp || null,
        interval_hours: createForm.frequency_hours,
        interval_cycles: createForm.frequency_cycles,
        threshold_cycles: createForm.frequency_landings,
        loc_json: locJson,
        other_details_json: otherDetailsJson,
      });
      toast.success('Directives record created');
      setCreateOpen(false);
      setCreateForm(CREATE_DEFAULTS);
      invalidate();
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Failed to create directives record');
    }
  }, [advancedFilters.model, createForm, createMutation, invalidate]);

  const handleSelectAttachment = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const attachment = await uploadAttachmentMutation.mutateAsync(file);
      setCreateForm((current) => ({ ...current, attachment }));
      toast.success('Attachment uploaded');
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : 'Failed to upload attachment');
    }
  }, [uploadAttachmentMutation]);

  const handleInlineSave = useCallback(async (row: DirectiveGridRow) => {
    try {
      await updateMutation.mutateAsync({ id: String(row.id), input: toUpsertPayload(row) });
      toast.success('Directives record updated');
      invalidate();
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : 'Failed to update directives record');
    }
  }, [invalidate, updateMutation]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Directives record deleted');
      setDeleteCandidate(null);
      invalidate();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : 'Failed to delete directives record');
    }
  }, [deleteMutation, invalidate]);

  const handleExport = useCallback(async () => {
    try {
      const blob = await exportCsv();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `directives-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      toast.success('Directives export downloaded');
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : 'Failed to export directives records');
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

  const directiveTypeOptions = useMemo(() => directiveTypeOptionsQuery.data || [], [directiveTypeOptionsQuery.data]);
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

  const gridRecords = useMemo<DirectiveGridRow[]>(
    () =>
      records.map((record) => ({
        ...(record as DirectiveGridRow),
        frequency_display: formatThresholdFrequency(record),
      })),
    [records],
  );

  return (
    <DashboardLayout>
      <div className="space-y-3 p-4 lg:p-6">
        <AmroModuleSurface
          title="Directives Management"
          subtitle="Directives workspace with table and record-detail CRUD controls."
          moduleId="amro.directives"
          status={errorMessage ? 'warning' : isLoading ? 'loading' : 'ready'}
        >
          <div className="flex items-center justify-end">
            <Button variant="outline" onClick={() => void handleExport()}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <div className="rounded-md border border-cyan-300 bg-cyan-50/20 p-3">
            <h3 className="mb-3 text-xl font-semibold">Directives Advanced Filters</h3>
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
                <Label>Directive No.</Label>
                <Input
                  value={advancedFilters.directiveNo}
                  onChange={(event) => setAdvancedFilters((current) => ({ ...current, directiveNo: event.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Directive Type</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2"
                  value={advancedFilters.directiveType}
                  onChange={(event) => setAdvancedFilters((current) => ({ ...current, directiveType: event.target.value }))}
                >
                  <option value="all">(All)</option>
                  {directiveTypeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
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
            <span className="font-medium">Total Directives Records: {records.length}</span>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium text-amber-700">Mandatory: {stats.mandatory}</span>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium text-emerald-700">Interval-driven: {stats.withIntervals}</span>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium">Optional: {stats.custom}</span>
          </div>

          <AmroCrudMessageBanner message={errorMessage} tone="error" />

          <AmroUnifiedGridRecordDetailShell
            title="Directives Records"
            subtitle="Work Packages-style data grid with right-side Record Detail panel and in-panel CRUD actions."
            records={gridRecords}
            columns={[
              { key: 'mpd_sequence', header: 'Directive Seq', sortable: true, filterable: true, groupable: true, resizable: true, width: 110, dataType: 'numeric' },
              { key: 'mpd_code', header: 'Code/Form', sortable: true, filterable: true, groupable: true, resizable: true, width: 140 },
              { key: 'ata_code', header: 'ATA Code', sortable: true, filterable: true, groupable: true, resizable: true, width: 120 },
              { key: 'reference_amp', header: 'Reference AMP', sortable: true, filterable: true, groupable: true, resizable: true, width: 180 },
              { key: 'description', header: 'Description', sortable: true, filterable: true, groupable: false, resizable: true, width: 280 },
              { key: 'directives_type_label', header: 'Directive Type', sortable: true, filterable: true, groupable: true, resizable: true, width: 180 },
              { key: 'estimated_man_hours', header: 'Man Hours', sortable: true, filterable: true, groupable: true, resizable: true, width: 120, dataType: 'numeric' },
              { key: 'frequency_display', header: 'Frequency', sortable: true, filterable: true, groupable: true, resizable: true, width: 220 },
              { key: 'is_mandatory', header: 'Mandatory', sortable: true, filterable: true, groupable: true, resizable: true, width: 120, dataType: 'boolean' },
              { key: 'created_at', header: 'Created', sortable: true, filterable: true, groupable: true, resizable: true, width: 130, dataType: 'date' },
            ] satisfies GridColumnDefinition<DirectiveGridRow>[]}
            viewMode="grid-with-right-form"
            persistKey="amro-directives-advanced-grid"
            ariaLabel="Directives advanced grid"
            enableColumnFilters
            enableDetailPanelToggle
            onCreateRecord={() => setCreateOpen(true)}
            onReadRecord={() => {
              toast.info('Directives details are visible in Record Detail panel');
            }}
            onDeleteRecord={(record) => setDeleteCandidate(record as DirectiveRecord)}
            onSaveRecord={(record) => { void handleInlineSave(record); }}
            onCancelRecord={() => {
              toast.info('Inline directives edits cancelled');
            }}
            requiredDetailFieldKeys={['ata_code', 'description']}
            defaultVisibleDetailFieldKeys={[
              'mpd_code',
              'ata_code',
              'reference_amp',
              'description',
              'directives_type_id',
              'directives_type_label',
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Create Directives Record for model {selectedModelName || 'Selected Model'}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="directive-code">Code / Form No</Label>
                <Input
                  id="directive-code"
                  value={createForm.mpd_code || ''}
                  onChange={(event) => setCreateForm((current) => ({ ...current, mpd_code: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ata-code">ATA Chapter *</Label>
                <select
                  id="ata-code"
                  className="h-10 w-full rounded-md border bg-background px-2"
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
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reference-amp">Reference</Label>
                <Textarea
                  id="reference-amp"
                  value={createForm.reference_amp || ''}
                  onChange={(event) => setCreateForm((current) => ({ ...current, reference_amp: event.target.value }))}
                  rows={2}
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
                <Label htmlFor="directive-type">Directive Type *</Label>
                <select
                  id="directive-type"
                  className="h-10 w-full rounded-md border bg-background px-2"
                  value={createForm.directive_type_id}
                  onChange={(event) => setCreateForm((current) => ({ ...current, directive_type_id: event.target.value }))}
                >
                  <option value="">(SELECT)</option>
                  {directiveTypeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone">Zone</Label>
                <Input
                  id="zone"
                  value={createForm.zone}
                  onChange={(event) => setCreateForm((current) => ({ ...current, zone: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area">Area</Label>
                <Input
                  id="area"
                  value={createForm.area}
                  onChange={(event) => setCreateForm((current) => ({ ...current, area: event.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  value={createForm.note}
                  onChange={(event) => setCreateForm((current) => ({ ...current, note: event.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interval-hours">Hours</Label>
                <Input
                  id="interval-hours"
                  type="number"
                  value={createForm.frequency_hours ?? ''}
                  onChange={(event) => setCreateForm((current) => ({ ...current, frequency_hours: toNullableNumber(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interval-days">Days</Label>
                <Input
                  id="interval-days"
                  type="number"
                  value={createForm.frequency_days ?? ''}
                  onChange={(event) => setCreateForm((current) => ({ ...current, frequency_days: toNullableNumber(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interval-cycles">Interval Cycles</Label>
                <Input
                  id="interval-cycles"
                  type="number"
                  value={createForm.frequency_cycles ?? ''}
                  onChange={(event) => setCreateForm((current) => ({ ...current, frequency_cycles: toNullableNumber(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold-cycles">Landings</Label>
                <Input
                  id="threshold-cycles"
                  type="number"
                  value={createForm.frequency_landings ?? ''}
                  onChange={(event) => setCreateForm((current) => ({ ...current, frequency_landings: toNullableNumber(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated-man-hours">Estd. Man Hours</Label>
                <Input
                  id="estimated-man-hours"
                  type="number"
                  value={createForm.estimated_man_hours ?? ''}
                  onChange={(event) => setCreateForm((current) => ({ ...current, estimated_man_hours: toNullableNumber(event.target.value) }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Attach File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
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
              <div className="space-y-2 md:col-span-2">
                <Label>Other Details</Label>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Input
                    placeholder="Tools"
                    value={createForm.other_tools}
                    onChange={(event) => setCreateForm((current) => ({ ...current, other_tools: event.target.value }))}
                  />
                  <Input
                    placeholder="Spares"
                    value={createForm.other_spares}
                    onChange={(event) => setCreateForm((current) => ({ ...current, other_spares: event.target.value }))}
                  />
                  <Input
                    placeholder="Task Cards"
                    value={createForm.other_task_cards}
                    onChange={(event) => setCreateForm((current) => ({ ...current, other_task_cards: event.target.value }))}
                  />
                  <Input
                    placeholder="Link Maint. Activity"
                    value={createForm.other_linked_activities}
                    onChange={(event) => setCreateForm((current) => ({ ...current, other_linked_activities: event.target.value }))}
                  />
                </div>
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
                {createMutation.isPending ? 'Creating...' : 'Create Directives'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Directives Record?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete directives record {deleteCandidate?.mpd_sequence || deleteCandidate?.mpd_code || deleteCandidate?.id}.
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

export default AmroDirectivesManagementPage;
