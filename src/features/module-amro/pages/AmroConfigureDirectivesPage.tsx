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
  useConfigureDirectivesActions,
  useConfigureDirectivesAircraftOptions,
  useConfigureDirectivesOptions,
  useListConfigureDirectivesConfigured,
  useListConfigureDirectivesNonConfigured,
  type ConfigureDirectivesConfiguredRecord,
} from '@/features/module-amro/components/mpd/useConfigureDirectivesState';
import type { DirectiveRecord } from '@/features/module-amro/components/mpd/useDirectivesState';
import { formatThresholdFrequency } from '@/features/module-amro/components/mpd/frequencyFormatter';

type ConfigureTab = 'non-configured' | 'configured';
type NonConfiguredGridRow = DirectiveRecord & Record<string, unknown>;
type ConfiguredGridRow = ConfigureDirectivesConfiguredRecord & Record<string, unknown>;

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

export function AmroConfigureDirectivesPage() {
  const [activeTab, setActiveTab] = useState<ConfigureTab>('non-configured');
  const [selectedDirectiveIds, setSelectedDirectiveIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState({
    assemblyType: '',
    model: '',
    aircraftId: '',
    search: '',
    directiveNo: '',
    directiveType: 'all',
    ata: 'all',
    status: 'all',
    fromDate: '',
    toDate: '',
  });

  const listEnabled = Boolean(advancedFilters.assemblyType && advancedFilters.model && advancedFilters.aircraftId);
  const { assemblyTypeOptionsQuery, assemblyModelOptionsQuery, ataCodeOptionsQuery, directiveTypeOptionsQuery } = useConfigureDirectivesOptions(true);
  const aircraftOptionsQuery = useConfigureDirectivesAircraftOptions(advancedFilters.model || undefined, Boolean(advancedFilters.model));

  const nonConfiguredQuery = useListConfigureDirectivesNonConfigured({
    page: 1,
    pageSize: 500,
    modelId: advancedFilters.model || undefined,
    aircraftId: advancedFilters.aircraftId || undefined,
    search: advancedFilters.search || undefined,
    ataCode: advancedFilters.ata !== 'all' ? advancedFilters.ata : undefined,
    directivesTypeId: advancedFilters.directiveType !== 'all' ? advancedFilters.directiveType : undefined,
    enabled: listEnabled,
  });

  const configuredQuery = useListConfigureDirectivesConfigured({
    page: 1,
    pageSize: 500,
    aircraftId: advancedFilters.aircraftId || undefined,
    search: advancedFilters.search || undefined,
    enabled: listEnabled && Boolean(advancedFilters.aircraftId),
  });

  const actions = useConfigureDirectivesActions();
  const isBusy = actions.configure.isPending
    || actions.updateConfiguredTask.isPending
    || actions.deleteConfiguredTask.isPending
    || actions.updateNonConfiguredDirective.isPending
    || actions.deleteNonConfiguredDirective.isPending;

  const assemblyTypeOptions = useMemo(() => assemblyTypeOptionsQuery.data || [], [assemblyTypeOptionsQuery.data]);
  const modelOptions = useMemo(() => {
    const source = assemblyModelOptionsQuery.data || [];
    if (!advancedFilters.assemblyType) return [];
    return source.filter((model) => model.assembly_type_id === advancedFilters.assemblyType);
  }, [advancedFilters.assemblyType, assemblyModelOptionsQuery.data]);
  const aircraftOptions = useMemo(() => aircraftOptionsQuery.data || [], [aircraftOptionsQuery.data]);
  const ataOptions = useMemo(() => ataCodeOptionsQuery.data || [], [ataCodeOptionsQuery.data]);
  const directiveTypeOptions = useMemo(() => directiveTypeOptionsQuery.data || [], [directiveTypeOptionsQuery.data]);

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
        if (advancedFilters.directiveNo) {
          const code = String(record.mpd_code || '').toLowerCase();
          if (!code.includes(advancedFilters.directiveNo.toLowerCase())) return false;
        }
        return true;
      })
      .map((record) => ({
        ...(record as NonConfiguredGridRow),
        frequency_display: formatThresholdFrequency(record),
      }));
  }, [advancedFilters.directiveNo, advancedFilters.fromDate, advancedFilters.toDate, nonConfiguredQuery.data?.records]);

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
    setSelectedDirectiveIds((current) => {
      if (current.size === 0) return current;
      const validIds = new Set(nonConfiguredRecords.map((record) => record.id));
      const next = new Set(Array.from(current).filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [nonConfiguredRecords]);

  useEffect(() => {
    if (!listEnabled) {
      setErrorMessage('Select Assembly Type, Model, and Aircraft to load Configure Directives records');
      return;
    }
    const activeError = activeTab === 'non-configured' ? nonConfiguredQuery.error : configuredQuery.error;
    const isError = activeTab === 'non-configured' ? nonConfiguredQuery.isError : configuredQuery.isError;
    if (isError) {
      setErrorMessage(activeError instanceof Error ? activeError.message : 'Failed to load Configure Directives records');
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
  const mandatoryCount = nonConfiguredRecords.filter((r) => r.is_mandatory).length;
  const intervalDrivenCount = nonConfiguredRecords.filter((r) => r.interval_hours || r.interval_cycles || r.interval_months).length;
  const optionalCount = nonConfiguredRecords.filter((r) => !r.is_mandatory).length;

  const handleToggleSelected = useCallback((directiveId: string, checked: boolean) => {
    setSelectedDirectiveIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(directiveId);
      } else {
        next.delete(directiveId);
      }
      return next;
    });
  }, []);

  const handleConfigureDirectives = useCallback(async (directiveIds: string[]) => {
    if (!advancedFilters.aircraftId) {
      toast.error('Aircraft selection is required to configure directives');
      return;
    }
    if (!directiveIds.length) {
      toast.error('Select at least one directive to configure');
      return;
    }
    try {
      const payload = await actions.configure.mutateAsync({
        aircraftId: advancedFilters.aircraftId,
        directiveIds,
      });
      const output = payload.output && typeof payload.output === 'object'
        ? payload.output as Record<string, unknown>
        : {};
      const configured = Number(output.configured_count || 0);
      const skipped = Number(output.skipped_count || 0);
      toast.success(`Configured ${configured} directive(s)${skipped > 0 ? `, skipped ${skipped}` : ''}`);
      setSelectedDirectiveIds(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to configure directives');
    }
  }, [actions.configure, advancedFilters.aircraftId]);

  const handleBulkConfigure = useCallback(() => {
    void handleConfigureDirectives(Array.from(selectedDirectiveIds));
  }, [handleConfigureDirectives, selectedDirectiveIds]);

  const handleExport = useCallback(async () => {
    try {
      const dateToken = new Date().toISOString().slice(0, 10);
      const blob = activeTab === 'non-configured'
        ? await actions.exportNonConfiguredCsv({
            modelId: advancedFilters.model || undefined,
            aircraftId: advancedFilters.aircraftId || undefined,
            search: advancedFilters.search || undefined,
            ataCode: advancedFilters.ata !== 'all' ? advancedFilters.ata : undefined,
            directivesTypeId: advancedFilters.directiveType !== 'all' ? advancedFilters.directiveType : undefined,
          })
        : await actions.exportConfiguredCsv({
            aircraftId: advancedFilters.aircraftId || undefined,
            search: advancedFilters.search || undefined,
          });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `configure-directives-${activeTab}-${dateToken}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      toast.success('Configure Directives export downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export Configure Directives records');
    }
  }, [actions, activeTab, advancedFilters.aircraftId, advancedFilters.ata, advancedFilters.directiveType, advancedFilters.model, advancedFilters.search]);

  const handleSaveNonConfigured = useCallback(async (row: NonConfiguredGridRow) => {
    try {
      await actions.updateNonConfiguredDirective.mutateAsync({
        directiveId: String(row.id),
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
          directives_type_id: row.directives_type_id,
        },
      });
      toast.success('Directive record updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update directive record');
    }
  }, [actions.updateNonConfiguredDirective]);

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
      toast.success('Configured directive task updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update configured directive task');
    }
  }, [actions.updateConfiguredTask]);

  const handleDeleteNonConfigured = useCallback(async (record: NonConfiguredGridRow) => {
    try {
      await actions.deleteNonConfiguredDirective.mutateAsync(String(record.id));
      setSelectedDirectiveIds((current) => {
        if (!current.has(record.id)) return current;
        const next = new Set(current);
        next.delete(record.id);
        return next;
      });
      toast.success('Directive record deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete directive record');
    }
  }, [actions.deleteNonConfiguredDirective]);

  const handleDeleteConfigured = useCallback(async (record: ConfiguredGridRow) => {
    try {
      await actions.deleteConfiguredTask.mutateAsync(String(record.task_id || record.id));
      toast.success('Configured directive task deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete configured directive task');
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
          checked={selectedDirectiveIds.has(record.id)}
          onChange={(event) => handleToggleSelected(record.id, event.currentTarget.checked)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select directive ${record.mpd_code || record.id}`}
        />
      ),
    },
    { key: 'mpd_sequence', header: 'Directive Seq', sortable: true, filterable: true, groupable: true, resizable: true, width: 130, dataType: 'numeric' },
    { key: 'mpd_code', header: 'Code/Form', sortable: true, filterable: true, groupable: true, resizable: true, width: 160 },
    { key: 'ata_code', header: 'ATA Code', sortable: true, filterable: true, groupable: true, resizable: true, width: 120 },
    { key: 'reference_amp', header: 'Reference AMP', sortable: true, filterable: true, groupable: true, resizable: true, width: 180 },
    { key: 'description', header: 'Description', sortable: true, filterable: true, groupable: false, resizable: true, width: 280 },
    { key: 'directives_type_label', header: 'Directive Type', sortable: true, filterable: true, groupable: true, resizable: true, width: 140 },
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
          disabled={isBusy || !advancedFilters.aircraftId}
          onClick={(event) => {
            event.stopPropagation();
            void handleConfigureDirectives([record.id]);
          }}
        >
          Configure
        </Button>
      ),
    },
  ], [advancedFilters.aircraftId, handleConfigureDirectives, handleToggleSelected, isBusy, selectedDirectiveIds]);

  const configuredColumns = useMemo<GridColumnDefinition<ConfiguredGridRow>[]>(() => [
    { key: 'task_number', header: 'Task Number', sortable: true, filterable: true, groupable: true, resizable: true, width: 180 },
    { key: 'task_status', header: 'Task Status', sortable: true, filterable: true, groupable: true, resizable: true, width: 130 },
    { key: 'task_title', header: 'Task Title', sortable: true, filterable: true, groupable: true, resizable: true, width: 210 },
    { key: 'task_category', header: 'Task Category', sortable: true, filterable: true, groupable: true, resizable: true, width: 150 },
    { key: 'task_assigned_to', header: 'Assigned To', sortable: true, filterable: true, groupable: true, resizable: true, width: 150 },
    { key: 'task_created_at', header: 'Task Created', sortable: true, filterable: true, groupable: true, resizable: true, width: 130, dataType: 'date' },
    { key: 'mpd_sequence', header: 'Directive Seq', sortable: true, filterable: true, groupable: true, resizable: true, width: 130, dataType: 'numeric' },
    { key: 'mpd_code', header: 'Code/Form', sortable: true, filterable: true, groupable: true, resizable: true, width: 160 },
    { key: 'ata_code', header: 'ATA Code', sortable: true, filterable: true, groupable: true, resizable: true, width: 120 },
    { key: 'description', header: 'Description', sortable: true, filterable: true, groupable: false, resizable: true, width: 280 },
    { key: 'frequency_display', header: 'Frequency', sortable: true, filterable: true, groupable: true, resizable: true, width: 240 },
    { key: 'created_at', header: 'Created', sortable: true, filterable: true, groupable: true, resizable: true, width: 130, dataType: 'date' },
  ], []);

  const taskStatuses = useMemo(() => {
    const values = configuredRecords
      .map((record) => String(record.task_status || '').trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }, [configuredRecords]);

  const statusOptions = activeTab === 'configured' ? taskStatuses : [];
  const selectedAircraftLabel = aircraftOptions.find((item) => item.id === advancedFilters.aircraftId)?.label || advancedFilters.aircraftId;

  return (
    <DashboardLayout>
      <div className="space-y-3 p-4 lg:p-6">
        <AmroModuleSurface
          title="Configure Directives"
          subtitle="Directives workspace with table and record-detail CRUD controls."
          moduleId="amro.directives"
          status={errorMessage ? 'warning' : nonConfiguredQuery.isLoading || configuredQuery.isLoading ? 'loading' : 'ready'}
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeTab === 'non-configured' ? (
              <Button
                onClick={handleBulkConfigure}
                disabled={!selectedDirectiveIds.size || isBusy || !listEnabled || !advancedFilters.aircraftId}
              >
                Bulk Configure ({selectedDirectiveIds.size})
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => void handleExport()} disabled={isBusy || !listEnabled}>
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
                <Label>Directive No.</Label>
                <Input
                  value={advancedFilters.directiveNo}
                  onChange={(event) => setAdvancedFilters((current) => ({ ...current, directiveNo: event.target.value }))}
                  placeholder="Filter by directive no."
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
              <div className="space-y-1 md:col-span-1">
                <Label>Search</Label>
                <Input
                  value={advancedFilters.search}
                  onChange={(event) => setAdvancedFilters((current) => ({ ...current, search: event.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-1">
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
            <span className="font-medium">Mandatory: {mandatoryCount}</span>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium">Interval-driven: {intervalDrivenCount}</span>
            <span className="text-muted-foreground">|</span>
            <span className="font-medium">Optional: {optionalCount}</span>
          </div>

          <AmroCrudMessageBanner message={errorMessage} tone="error" />

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ConfigureTab)}>
            <TabsList>
              <TabsTrigger value="non-configured">
                Non-Configured Directives ({nonConfiguredCount})
              </TabsTrigger>
              <TabsTrigger value="configured">
                Configured Tasks ({configuredCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="non-configured">
              <AmroUnifiedGridRecordDetailShell
                title="Directives Records"
                subtitle="Work Packages-style data grid with right-side Record Detail panel and in-panel CRUD actions."
                records={nonConfiguredRecords}
                columns={nonConfiguredColumns}
                viewMode="grid-with-right-form"
                persistKey="amro-configure-directives-tab1-grid"
                ariaLabel="Configure Directives non-configured grid"
                enableColumnFilters
                enableDetailPanelToggle
                onReadRecord={() => toast.info('Directive details are visible in Record Detail panel')}
                onSaveRecord={(record) => { void handleSaveNonConfigured(record); }}
                onDeleteRecord={(record) => { void handleDeleteNonConfigured(record); }}
                onCancelRecord={() => toast.info('Inline directive edits cancelled')}
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
                  'directives_type_id',
                  'directives_type_label',
                ]}
                hiddenDetailFieldKeys={['id', 'tenant_id', 'franchise_id', 'created_at', 'updated_at', 'mpd_sequence', 'select_row', 'configure_action', 'frequency_display']}
                crudPermissions={{ create: false }}
              />
            </TabsContent>

            <TabsContent value="configured">
              <AmroUnifiedGridRecordDetailShell
                title="Configured Directive Tasks"
                subtitle="Latest configured tasks mapped per directive for selected aircraft."
                records={configuredRecords}
                columns={configuredColumns}
                viewMode="grid-with-right-form"
                persistKey="amro-configure-directives-tab2-grid"
                ariaLabel="Configure Directives configured tasks grid"
                enableColumnFilters
                enableDetailPanelToggle
                onReadRecord={() => toast.info('Configured directive task details are visible in Record Detail panel')}
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
                  'directive_id',
                  'work_order_id',
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

export default AmroConfigureDirectivesPage;
