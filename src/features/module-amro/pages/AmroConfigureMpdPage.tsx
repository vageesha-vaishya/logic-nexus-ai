import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AmroCrudMessageBanner } from '@/features/module-amro/components/parts/AmroCrudPrimitives';
import { AmroModuleSurface } from '@/features/module-amro/components/parts/AmroPartsUiStandards';
import { AmroUnifiedGridRecordDetailShell } from '@/features/module-amro/components/parts/AmroUnifiedGridRecordDetailShell';
import type { GridColumnDefinition } from '@/features/module-amro/components/templates/AmroInventoryDataGridTemplate';
import {
  useConfigureMpdActions,
  useConfigureMpdAircraftOptions,
  useConfigureMpdOptions,
  useListConfigureMpdConfigured,
  useListConfigureMpdNonConfigured,
  type ConfigureMpdConfiguredRecord,
} from '@/features/module-amro/components/mpd/useConfigureMpdState';
import type { MpdRecord } from '@/features/module-amro/components/mpd/useMpdState';
import { formatThresholdFrequency } from '@/features/module-amro/components/mpd/frequencyFormatter';

type ConfigureTab = 'non-configured' | 'configured';
type NonConfiguredGridRow = MpdRecord & Record<string, unknown>;
type ConfiguredGridRow = ConfigureMpdConfiguredRecord & Record<string, unknown>;

function isWithinDateRange(value: string | null, fromDate: string, toDate: string): boolean {
  if (!fromDate && !toDate) return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (fromDate) {
    const from = new Date(fromDate);
    if (!Number.isNaN(from.getTime()) && date < from) return false;
  }
  if (toDate) {
    const to = new Date(toDate);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      if (date > to) return false;
    }
  }
  return true;
}

export function AmroConfigureMpdPage() {
  const [activeTab, setActiveTab] = useState<ConfigureTab>('non-configured');
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState({
    assemblyType: '',
    model: '',
    aircraftId: '',
    search: '',
    category: 'all',
    ata: 'all',
    status: 'all',
    fromDate: '',
    toDate: '',
  });

  const listEnabled = Boolean(advancedFilters.assemblyType && advancedFilters.model && advancedFilters.aircraftId);
  const { assemblyTypeOptionsQuery, assemblyModelOptionsQuery, ataCodeOptionsQuery, taskCategoryOptionsQuery } = useConfigureMpdOptions(true);
  const aircraftOptionsQuery = useConfigureMpdAircraftOptions(advancedFilters.model || undefined, Boolean(advancedFilters.model));

  const nonConfiguredQuery = useListConfigureMpdNonConfigured({
    page: 1,
    pageSize: 500,
    modelId: advancedFilters.model || undefined,
    aircraftId: advancedFilters.aircraftId || undefined,
    search: advancedFilters.search || undefined,
    ataCode: advancedFilters.ata !== 'all' ? advancedFilters.ata : undefined,
    categoryCode: advancedFilters.category !== 'all' ? advancedFilters.category : undefined,
    enabled: listEnabled,
  });

  const configuredQuery = useListConfigureMpdConfigured({
    page: 1,
    pageSize: 500,
    aircraftId: advancedFilters.aircraftId || undefined,
    search: advancedFilters.search || undefined,
    enabled: listEnabled,
  });

  const actions = useConfigureMpdActions();
  const isBusy = actions.configure.isPending
    || actions.updateConfiguredTask.isPending
    || actions.deleteConfiguredTask.isPending
    || actions.updateNonConfiguredTemplate.isPending
    || actions.deleteNonConfiguredTemplate.isPending;

  const assemblyTypeOptions = useMemo(() => assemblyTypeOptionsQuery.data || [], [assemblyTypeOptionsQuery.data]);
  const modelOptions = useMemo(() => {
    const source = assemblyModelOptionsQuery.data || [];
    if (!advancedFilters.assemblyType) return [];
    return source.filter((model) => model.assembly_type_id === advancedFilters.assemblyType);
  }, [advancedFilters.assemblyType, assemblyModelOptionsQuery.data]);
  const aircraftOptions = useMemo(() => aircraftOptionsQuery.data || [], [aircraftOptionsQuery.data]);
  const ataOptions = useMemo(() => ataCodeOptionsQuery.data || [], [ataCodeOptionsQuery.data]);
  const categoryOptions = useMemo(() => taskCategoryOptionsQuery.data || [], [taskCategoryOptionsQuery.data]);

  useEffect(() => {
    if (!assemblyTypeOptions.length) return;
    const preferred = assemblyTypeOptions.find((option) => option.name.trim().toLowerCase() === 'airframe');
    if (!preferred?.id) return;
    setAdvancedFilters((current) => (
      current.assemblyType ? current : { ...current, assemblyType: preferred.id }
    ));
  }, [assemblyTypeOptions]);

  useEffect(() => {
    if (!advancedFilters.model) return;
    const exists = modelOptions.some((item) => item.id === advancedFilters.model);
    if (!exists) {
      setAdvancedFilters((current) => ({ ...current, model: '', aircraftId: '' }));
    }
  }, [advancedFilters.model, modelOptions]);

  useEffect(() => {
    if (!advancedFilters.aircraftId) return;
    const exists = aircraftOptions.some((item) => item.id === advancedFilters.aircraftId);
    if (!exists) {
      setAdvancedFilters((current) => ({ ...current, aircraftId: '' }));
    }
  }, [advancedFilters.aircraftId, aircraftOptions]);

  useEffect(() => {
    if (!advancedFilters.assemblyType || !modelOptions.length || advancedFilters.model) return;
    const firstValidModel = modelOptions.find((model) => model.id && model.name.trim());
    if (firstValidModel) {
      setAdvancedFilters((current) => ({ ...current, model: firstValidModel.id }));
    }
  }, [advancedFilters.assemblyType, advancedFilters.model, modelOptions]);

  useEffect(() => {
    if (!advancedFilters.model || !aircraftOptions.length || advancedFilters.aircraftId) return;
    const firstAircraft = aircraftOptions.find((aircraft) => aircraft.id);
    if (firstAircraft) {
      setAdvancedFilters((current) => ({ ...current, aircraftId: firstAircraft.id }));
    }
  }, [advancedFilters.aircraftId, advancedFilters.model, aircraftOptions]);

  const nonConfiguredRecords = useMemo<NonConfiguredGridRow[]>(() => {
    const source = nonConfiguredQuery.data?.records || [];
    return source
      .filter((record) => isWithinDateRange(record.created_at, advancedFilters.fromDate, advancedFilters.toDate))
      .filter((record) => {
        if (advancedFilters.status === 'all') return true;
        return String(record.revision_status || '').trim().toLowerCase() === advancedFilters.status.toLowerCase();
      })
      .map((record) => ({
        ...(record as NonConfiguredGridRow),
        frequency_display: formatThresholdFrequency(record),
      }));
  }, [advancedFilters.fromDate, advancedFilters.status, advancedFilters.toDate, nonConfiguredQuery.data?.records]);

  const configuredRecords = useMemo<ConfiguredGridRow[]>(() => {
    const source = configuredQuery.data?.records || [];
    return source
      .filter((record) => isWithinDateRange(record.task_created_at || record.created_at, advancedFilters.fromDate, advancedFilters.toDate))
      .filter((record) => {
        if (advancedFilters.status === 'all') return true;
        return String(record.task_status || '').trim().toLowerCase() === advancedFilters.status.toLowerCase();
      })
      .map((record) => ({
        ...(record as ConfiguredGridRow),
        frequency_display: formatThresholdFrequency(record),
      }));
  }, [advancedFilters.fromDate, advancedFilters.status, advancedFilters.toDate, configuredQuery.data?.records]);

  useEffect(() => {
    setSelectedTemplateIds((current) => {
      if (current.size === 0) return current;
      const validIds = new Set(nonConfiguredRecords.map((record) => record.id));
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [nonConfiguredRecords]);

  useEffect(() => {
    if (!listEnabled) {
      setErrorMessage('Select Assembly Type, Model, and Aircraft to load Configure MPD records');
      return;
    }
    const activeError = activeTab === 'non-configured' ? nonConfiguredQuery.error : configuredQuery.error;
    const isError = activeTab === 'non-configured' ? nonConfiguredQuery.isError : configuredQuery.isError;
    if (isError) {
      setErrorMessage(activeError instanceof Error ? activeError.message : 'Failed to load Configure MPD records');
      return;
    }
    setErrorMessage(null);
  }, [
    activeTab,
    configuredQuery.error,
    configuredQuery.isError,
    listEnabled,
    nonConfiguredQuery.error,
    nonConfiguredQuery.isError,
  ]);

  const configuredCount = configuredQuery.data?.total || configuredRecords.length;
  const nonConfiguredCount = nonConfiguredQuery.data?.total || nonConfiguredRecords.length;

  const handleToggleSelected = useCallback((templateId: string, checked: boolean) => {
    setSelectedTemplateIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(templateId);
      } else {
        next.delete(templateId);
      }
      return next;
    });
  }, []);

  const handleConfigureTemplates = useCallback(async (taskTemplateIds: string[]) => {
    if (!advancedFilters.aircraftId) {
      toast.error('Aircraft selection is required');
      return;
    }
    if (!taskTemplateIds.length) {
      toast.error('Select at least one template to configure');
      return;
    }
    try {
      const payload = await actions.configure.mutateAsync({
        aircraftId: advancedFilters.aircraftId,
        taskTemplateIds,
      });
      const output = payload.output && typeof payload.output === 'object'
        ? payload.output as Record<string, unknown>
        : {};
      const configured = Number(output.configured_count || 0);
      const skipped = Number(output.skipped_count || 0);
      toast.success(`Configured ${configured} template(s)${skipped > 0 ? `, skipped ${skipped}` : ''}`);
      setSelectedTemplateIds(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to configure templates');
    }
  }, [actions.configure, advancedFilters.aircraftId]);

  const handleBulkConfigure = useCallback(() => {
    void handleConfigureTemplates(Array.from(selectedTemplateIds));
  }, [handleConfigureTemplates, selectedTemplateIds]);

  const handleExport = useCallback(async () => {
    try {
      const dateToken = new Date().toISOString().slice(0, 10);
      const blob = activeTab === 'non-configured'
        ? await actions.exportNonConfiguredCsv({
            modelId: advancedFilters.model || undefined,
            aircraftId: advancedFilters.aircraftId || undefined,
            search: advancedFilters.search || undefined,
            ataCode: advancedFilters.ata !== 'all' ? advancedFilters.ata : undefined,
            categoryCode: advancedFilters.category !== 'all' ? advancedFilters.category : undefined,
          })
        : await actions.exportConfiguredCsv({
            aircraftId: advancedFilters.aircraftId || undefined,
            search: advancedFilters.search || undefined,
          });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `configure-mpd-${activeTab}-${dateToken}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      toast.success('Configure MPD export downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export Configure MPD records');
    }
  }, [actions, activeTab, advancedFilters.aircraftId, advancedFilters.ata, advancedFilters.category, advancedFilters.model, advancedFilters.search]);

  const handleSaveNonConfigured = useCallback(async (row: NonConfiguredGridRow) => {
    try {
      await actions.updateNonConfiguredTemplate.mutateAsync({
        templateId: String(row.id),
        patch: {
          mpd_code: row.mpd_code,
          ata_code: row.ata_code,
          reference_amp: row.reference_amp,
          description: row.description,
          category_code: row.category_code,
          estimated_man_hours: row.estimated_man_hours,
          revision_status: row.revision_status,
          interval_hours: row.interval_hours,
          interval_cycles: row.interval_cycles,
          interval_months: row.interval_months,
          threshold_landings: row.threshold_landings,
          threshold_rins: row.threshold_rins,
          threshold_hobbs: row.threshold_hobbs,
          is_mandatory: row.is_mandatory,
        },
      });
      toast.success('Template record updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update template record');
    }
  }, [actions.updateNonConfiguredTemplate]);

  const handleSaveConfigured = useCallback(async (row: ConfiguredGridRow) => {
    try {
      await actions.updateConfiguredTask.mutateAsync({
        taskId: String(row.task_id || row.id),
        patch: {
          task_title: row.task_title,
          task_description: row.task_description,
          task_status: row.task_status,
          task_category: row.task_category,
          task_assigned_to: row.task_assigned_to,
        },
      });
      toast.success('Configured task updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update configured task');
    }
  }, [actions.updateConfiguredTask]);

  const handleDeleteNonConfigured = useCallback(async (record: NonConfiguredGridRow) => {
    try {
      await actions.deleteNonConfiguredTemplate.mutateAsync(String(record.id));
      setSelectedTemplateIds((current) => {
        if (!current.has(record.id)) return current;
        const next = new Set(current);
        next.delete(record.id);
        return next;
      });
      toast.success('Template record deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete template record');
    }
  }, [actions.deleteNonConfiguredTemplate]);

  const handleDeleteConfigured = useCallback(async (record: ConfiguredGridRow) => {
    try {
      await actions.deleteConfiguredTask.mutateAsync(String(record.task_id || record.id));
      toast.success('Configured task deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete configured task');
    }
  }, [actions.deleteConfiguredTask]);

  const nonConfiguredColumns = useMemo<GridColumnDefinition<NonConfiguredGridRow>[]>(() => [
    {
      key: 'select_row',
      header: 'Select',
      width: 90,
      sortable: false,
      filterable: false,
      groupable: false,
      resizable: false,
      render: (record) => (
        <input
          type="checkbox"
          checked={selectedTemplateIds.has(record.id)}
          onChange={(event) => handleToggleSelected(record.id, event.currentTarget.checked)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select template ${record.mpd_code || record.id}`}
        />
      ),
    },
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
    {
      key: 'configure_action',
      header: 'Configure',
      width: 130,
      sortable: false,
      filterable: false,
      groupable: false,
      resizable: false,
      render: (record) => (
        <Button
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={(event) => {
            event.stopPropagation();
            void handleConfigureTemplates([record.id]);
          }}
        >
          Configure
        </Button>
      ),
    },
  ], [handleConfigureTemplates, handleToggleSelected, isBusy, selectedTemplateIds]);

  const configuredColumns = useMemo<GridColumnDefinition<ConfiguredGridRow>[]>(() => [
    { key: 'task_number', header: 'Task Number', sortable: true, filterable: true, groupable: true, resizable: true, width: 180 },
    { key: 'task_status', header: 'Task Status', sortable: true, filterable: true, groupable: true, resizable: true, width: 130 },
    { key: 'task_title', header: 'Task Title', sortable: true, filterable: true, groupable: true, resizable: true, width: 210 },
    { key: 'task_category', header: 'Task Category', sortable: true, filterable: true, groupable: true, resizable: true, width: 150 },
    { key: 'task_assigned_to', header: 'Assigned To', sortable: true, filterable: true, groupable: true, resizable: true, width: 150 },
    { key: 'task_created_at', header: 'Task Created', sortable: true, filterable: true, groupable: true, resizable: true, width: 130, dataType: 'date' },
    { key: 'mpd_sequence', header: 'MPD Seq', sortable: true, filterable: true, groupable: true, resizable: true, width: 110, dataType: 'numeric' },
    { key: 'mpd_code', header: 'Code/Form', sortable: true, filterable: true, groupable: true, resizable: true, width: 140 },
    { key: 'ata_code', header: 'ATA Code', sortable: true, filterable: true, groupable: true, resizable: true, width: 120 },
    { key: 'description', header: 'Description', sortable: true, filterable: true, groupable: false, resizable: true, width: 280 },
    { key: 'frequency_display', header: 'Frequency', sortable: true, filterable: true, groupable: true, resizable: true, width: 240 },
    { key: 'created_at', header: 'Created', sortable: true, filterable: true, groupable: true, resizable: true, width: 130, dataType: 'date' },
  ], []);

  const revisionStatuses = useMemo(() => {
    const values = nonConfiguredRecords
      .map((record) => String(record.revision_status || '').trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }, [nonConfiguredRecords]);

  const taskStatuses = useMemo(() => {
    const values = configuredRecords
      .map((record) => String(record.task_status || '').trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }, [configuredRecords]);

  const statusOptions = activeTab === 'non-configured' ? revisionStatuses : taskStatuses;
  const activeRecordsCount = activeTab === 'non-configured' ? nonConfiguredRecords.length : configuredRecords.length;
  const selectedAircraftLabel = aircraftOptions.find((item) => item.id === advancedFilters.aircraftId)?.label || advancedFilters.aircraftId;

  return (
    <DashboardLayout>
      <div className="space-y-3 p-4 lg:p-6">
        <AmroModuleSurface
          title="Configure MPD"
          subtitle="Two-tab Configure MPD workspace for non-configured templates and configured aircraft tasks."
          moduleId="amro.configure-mpd"
          status={errorMessage ? 'warning' : nonConfiguredQuery.isLoading || configuredQuery.isLoading ? 'loading' : 'ready'}
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeTab === 'non-configured' ? (
              <Button
                onClick={handleBulkConfigure}
                disabled={!selectedTemplateIds.size || isBusy || !listEnabled}
              >
                Bulk Configure ({selectedTemplateIds.size})
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => void handleExport()} disabled={isBusy || !listEnabled}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <div className="rounded-md border border-cyan-300 bg-cyan-50/20 p-3">
            <h3 className="mb-3 text-xl font-semibold">Configure MPD Advanced Filters</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="space-y-1 md:col-span-2">
                <Label>Assembly Type</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2"
                  value={advancedFilters.assemblyType}
                  onChange={(event) => setAdvancedFilters((current) => ({
                    ...current,
                    assemblyType: event.target.value,
                    model: '',
                    aircraftId: '',
                  }))}
                >
                  {assemblyTypeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Model</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2"
                  value={advancedFilters.model}
                  onChange={(event) => setAdvancedFilters((current) => ({ ...current, model: event.target.value, aircraftId: '' }))}
                  disabled={!modelOptions.length}
                >
                  <option value="">(Select)</option>
                  {modelOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Aircraft</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2"
                  value={advancedFilters.aircraftId}
                  onChange={(event) => setAdvancedFilters((current) => ({ ...current, aircraftId: event.target.value }))}
                  disabled={!aircraftOptions.length}
                >
                  <option value="">(Select)</option>
                  {aircraftOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Search</Label>
                <Input
                  value={advancedFilters.search}
                  onChange={(event) => setAdvancedFilters((current) => ({ ...current, search: event.target.value }))}
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
              <div className="space-y-1 md:col-span-2">
                <Label>Status</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2"
                  value={advancedFilters.status}
                  onChange={(event) => setAdvancedFilters((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="all">(All)</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 md:col-span-1">
                <Label>From</Label>
                <Input
                  type="date"
                  value={advancedFilters.fromDate}
                  onChange={(event) => setAdvancedFilters((current) => ({ ...current, fromDate: event.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-1">
                <Label>To</Label>
                <Input
                  type="date"
                  value={advancedFilters.toDate}
                  onChange={(event) => setAdvancedFilters((current) => ({ ...current, toDate: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-1.5 text-xs">
            <span className="font-medium">Aircraft: {selectedAircraftLabel || 'Not selected'}</span>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium text-amber-700">Non-Configured: {nonConfiguredCount}</span>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium text-emerald-700">Configured: {configuredCount}</span>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium">Visible in Tab: {activeRecordsCount}</span>
          </div>

          <AmroCrudMessageBanner message={errorMessage} tone="error" />

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ConfigureTab)}>
            <TabsList>
              <TabsTrigger value="non-configured">
                Non-Configured Templates ({nonConfiguredCount})
              </TabsTrigger>
              <TabsTrigger value="configured">
                Configured Tasks ({configuredCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="non-configured">
              <AmroUnifiedGridRecordDetailShell
                title="Non-Configured Task Templates"
                subtitle="MPD-parity table for task_templates with checkbox selection, per-row configure, and full record actions."
                records={nonConfiguredRecords}
                columns={nonConfiguredColumns}
                viewMode="grid-with-right-form"
                persistKey="amro-configure-mpd-tab1-grid"
                ariaLabel="Configure MPD non-configured templates grid"
                enableColumnFilters
                enableDetailPanelToggle
                onReadRecord={() => toast.info('Template details are visible in Record Detail panel')}
                onSaveRecord={(record) => { void handleSaveNonConfigured(record); }}
                onDeleteRecord={(record) => { void handleDeleteNonConfigured(record); }}
                onCancelRecord={() => toast.info('Inline template edits cancelled')}
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
                  'threshold_landings',
                  'threshold_rins',
                  'threshold_hobbs',
                  'is_mandatory',
                  'assembly_model_id',
                ]}
                hiddenDetailFieldKeys={['id', 'tenant_id', 'franchise_id', 'created_at', 'updated_at', 'mpd_sequence', 'select_row', 'configure_action', 'frequency_display']}
                crudPermissions={{ create: false }}
              />
            </TabsContent>

            <TabsContent value="configured">
              <AmroUnifiedGridRecordDetailShell
                title="Configured Tasks"
                subtitle="MPD-parity table for latest configured tasks mapped per task_template for selected aircraft."
                records={configuredRecords}
                columns={configuredColumns}
                viewMode="grid-with-right-form"
                persistKey="amro-configure-mpd-tab2-grid"
                ariaLabel="Configure MPD configured tasks grid"
                enableColumnFilters
                enableDetailPanelToggle
                onReadRecord={() => toast.info('Configured task details are visible in Record Detail panel')}
                onSaveRecord={(record) => { void handleSaveConfigured(record); }}
                onDeleteRecord={(record) => { void handleDeleteConfigured(record); }}
                onCancelRecord={() => toast.info('Inline configured-task edits cancelled')}
                requiredDetailFieldKeys={['task_number', 'task_title']}
                defaultVisibleDetailFieldKeys={[
                  'task_number',
                  'task_status',
                  'task_title',
                  'task_description',
                  'task_category',
                  'task_assigned_to',
                  'task_planned_start_date',
                  'task_planned_end_date',
                  'task_actual_start_date',
                  'task_actual_end_date',
                  'task_created_at',
                  'task_updated_at',
                  'task_template_id',
                  'work_package_id',
                  'mpd_code',
                  'ata_code',
                  'description',
                  'frequency_display',
                ]}
                hiddenDetailFieldKeys={['id', 'tenant_id', 'franchise_id', 'created_at', 'updated_at', 'mpd_sequence']}
                crudPermissions={{ create: false }}
              />
            </TabsContent>
          </Tabs>
        </AmroModuleSurface>
      </div>
    </DashboardLayout>
  );
}

export default AmroConfigureMpdPage;
