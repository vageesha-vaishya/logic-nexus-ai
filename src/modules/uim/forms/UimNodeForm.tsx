import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCcw, RotateCcw, Save, Trash2 } from 'lucide-react';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import type { UimNodeKey, UimFieldConfig } from './types';
import { uimNodeConfigs } from './config';
import { useUimNodeForm } from './useUimNodeForm';
import { AddressBlock } from './blocks/AddressBlock';
import { DimensionBlock } from './blocks/DimensionBlock';
import { deleteUimEntity, getUimEntity, listUimEntities } from '@/services/uim/uimFormAdapters';
import { UimDataList, type UimDataListColumn } from '@/modules/uim/components/UimDataList';
import { UimApiError } from '@/services/uim/uimApi';
import { queryUimProjectionItems, replayUimProjections } from '@/services/uim/uimCoreServices';

type UimNodeFormProps = {
  node: UimNodeKey;
  existingEntity?: Record<string, unknown> | null;
};

const AUTO_RETRY_INTERVAL_MS = 5000;
const AUTO_RETRY_MAX_ATTEMPTS = 3;
const PROJECTION_BACKED_NODES: UimNodeKey[] = ['item-master', 'stock-ledger', 'reservations', 'issue-consume', 'restock'];

function numberFromEvent(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function FieldRenderer({
  fieldConfig,
  control,
  t,
}: {
  fieldConfig: UimFieldConfig;
  control: any;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const descriptionId = `${fieldConfig.name}-description`;

  return (
    <FormField
      control={control}
      name={fieldConfig.name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(fieldConfig.labelKey, { defaultValue: fieldConfig.labelDefault })}</FormLabel>
          <FormControl>
            {fieldConfig.type === 'textarea' ? (
              <Textarea
                {...field}
                autoComplete={fieldConfig.autoComplete}
                aria-label={t(`${fieldConfig.labelKey}.aria`, { defaultValue: fieldConfig.labelDefault })}
                aria-describedby={descriptionId}
                maxLength={fieldConfig.max}
              />
            ) : fieldConfig.type === 'select' ? (
              <Select value={String(field.value ?? '')} onValueChange={field.onChange}>
                <SelectTrigger aria-label={t(`${fieldConfig.labelKey}.aria`, { defaultValue: fieldConfig.labelDefault })}>
                  <SelectValue placeholder={t(`${fieldConfig.labelKey}.placeholder`, { defaultValue: `Select ${fieldConfig.labelDefault}` })} />
                </SelectTrigger>
                <SelectContent>
                  {(fieldConfig.options || []).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey, { defaultValue: option.labelDefault })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : fieldConfig.type === 'checkbox' ? (
              <div className="flex items-center gap-3 pt-1">
                <Checkbox
                  checked={Boolean(field.value)}
                  onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                  aria-label={t(`${fieldConfig.labelKey}.aria`, { defaultValue: fieldConfig.labelDefault })}
                />
                <span className="text-sm text-muted-foreground">
                  {t(`${fieldConfig.labelKey}.helper`, { defaultValue: fieldConfig.labelDefault })}
                </span>
              </div>
            ) : (
              <Input
                {...field}
                type={fieldConfig.type}
                autoComplete={fieldConfig.autoComplete}
                min={fieldConfig.min}
                max={fieldConfig.max}
                step={fieldConfig.step}
                value={field.value ?? (fieldConfig.type === 'number' ? 0 : '')}
                onChange={(event) =>
                  field.onChange(fieldConfig.type === 'number' ? numberFromEvent(event.target.value) : event.target.value)
                }
                aria-label={t(`${fieldConfig.labelKey}.aria`, { defaultValue: fieldConfig.labelDefault })}
                aria-describedby={descriptionId}
              />
            )}
          </FormControl>
          <FormDescription id={descriptionId}>
            {t(
              fieldConfig.descriptionKey || `${fieldConfig.labelKey}.description`,
              { defaultValue: fieldConfig.descriptionDefault || `Provide ${fieldConfig.labelDefault.toLowerCase()}` },
            )}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function UimNodeForm({ node, existingEntity }: UimNodeFormProps) {
  const { t } = useTranslation();
  const config = useMemo(() => uimNodeConfigs[node], [node]);
  const [activeRecord, setActiveRecord] = useState<Record<string, unknown> | null>(existingEntity || null);
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [statusValue, setStatusValue] = useState('all');
  const [lastLoadDurationMs, setLastLoadDurationMs] = useState(0);
  const [autoRetryAttempt, setAutoRetryAttempt] = useState(0);
  const [isReplayingProjection, setIsReplayingProjection] = useState(false);
  const projectionBacked = PROJECTION_BACKED_NODES.includes(node);

  const { form, isSaving, submitError, submit, reset, isEditMode, lastSavedId, clearSubmitError } = useUimNodeForm({
    config,
    existingEntity: activeRecord,
  });
  const formErrors = Object.values(form.formState.errors).map((error) => String(error?.message || '')).filter(Boolean);

  const loadRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    setRecordsError(null);
    const start = performance.now();
    try {
      let loadedRecords: Array<Record<string, unknown>> | null = null;
      let lastError: unknown = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          if (projectionBacked) {
            const projectionResponse = await queryUimProjectionItems(200, 0);
            const snapshots = Array.isArray(projectionResponse?.output?.snapshots) ? projectionResponse.output.snapshots : [];
            loadedRecords = snapshots.map((row) => {
              const rowRecord = row as Record<string, unknown>;
              return {
                id: String(rowRecord.inventory_item_id || rowRecord.id || ''),
                updated_at: rowRecord.updated_at || rowRecord.last_ledger_at || '',
                payload: {
                  projected_available_quantity: rowRecord.projected_available_quantity || 0,
                  projected_reserved_quantity: rowRecord.projected_reserved_quantity || 0,
                  projected_consumed_quantity: rowRecord.projected_consumed_quantity || 0,
                  replay_version: rowRecord.replay_version || 0,
                  status: readStatusValueFromProjection(rowRecord),
                },
                projection: rowRecord,
              };
            });
          } else {
            const response = await listUimEntities(node, 200, 0);
            loadedRecords = Array.isArray(response?.output?.records) ? response.output.records : [];
          }
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
        }
      }
      if (!loadedRecords) throw lastError || new Error('Record load failed');
      setRecords(loadedRecords);
      const duration = performance.now() - start;
      setLastLoadDurationMs(duration);
      setAutoRetryAttempt(0);
    } catch (error) {
      let message = 'Unable to load records for this module.';
      if (error instanceof UimApiError) {
        const code = String((error.payload as any)?.code || '');
        if (code === 'UIM_FORM_STORAGE_NOT_READY') {
          message = 'UIM storage is not ready. Run migration 20260404212000_uim_form_records_crud.sql.';
        } else if (error.status === 404) {
          message = projectionBacked
            ? 'UIM projection API endpoint is not available. Verify /api/v2/uim/projections routes are deployed and the UIM backend is restarted.'
            : 'UIM forms API endpoint is not available. Verify /api/v2/uim/forms routes are deployed and VITE_UIM_API_BASE_URL is correct.';
        } else if (error.status === 401 || error.status === 403) {
          message = 'You do not have permission to load records for this module.';
        } else if (error.status >= 500) {
          message = 'The server is temporarily unavailable. Please retry shortly.';
        }
      } else if (error instanceof TypeError && String(error.message || '').toLowerCase().includes('fetch')) {
        message = 'Unable to reach UIM API service. Check network connectivity and API base URL configuration.';
      }
      setRecordsError(message);
      toast({
        title: 'Record load failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingRecords(false);
    }
  }, [node, projectionBacked]);

  const readStatusValueFromProjection = (row: Record<string, unknown>): string => {
    const available = Number(row.projected_available_quantity || 0);
    const reserved = Number(row.projected_reserved_quantity || 0);
    if (available <= 0 && reserved <= 0) return 'consumed';
    if (reserved > 0) return 'reserved';
    return 'available';
  };

  useEffect(() => {
    setAutoRetryAttempt(0);
    loadRecords();
  }, [node, loadRecords]);

  useEffect(() => {
    if (!lastSavedId) return;
    loadRecords();
  }, [lastSavedId, loadRecords]);

  useEffect(() => {
    if (!recordsError || isLoadingRecords) return;
    if (autoRetryAttempt >= AUTO_RETRY_MAX_ATTEMPTS) return;
    const timer = window.setTimeout(() => {
      setAutoRetryAttempt((current) => current + 1);
      void loadRecords();
    }, AUTO_RETRY_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [recordsError, isLoadingRecords, autoRetryAttempt, loadRecords]);

  const readStatusValue = (record: Record<string, unknown>): string => {
    const payload = (record.payload || {}) as Record<string, unknown>;
    const candidates = [
      payload.status,
      payload.reservation_status,
      payload.transaction_type,
      payload.rollout_phase,
      payload.metric_group,
    ];
    const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
    return String(value || 'active');
  };

  const filteredRecords = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return records.filter((record) => {
      const payload = (record.payload || {}) as Record<string, unknown>;
      const rowTokens = [
        String(record.id || ''),
        ...Object.values(payload).map((value) => String(value ?? '')),
      ];
      const matchesSearch = query.length === 0 || rowTokens.some((token) => token.toLowerCase().includes(query));
      const matchesStatus = statusValue === 'all' || readStatusValue(record).toLowerCase() === statusValue.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [records, searchValue, statusValue]);

  const listColumns = useMemo<UimDataListColumn<Record<string, unknown>>[]>(() => ([
    {
      key: 'id',
      header: 'Record ID',
      sortable: true,
      widthClassName: 'w-[140px]',
      render: (record) => String(record.id || '').slice(0, 8),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      widthClassName: 'w-[140px]',
      render: (record) => readStatusValue(record),
    },
    {
      key: 'updated_at',
      header: 'Updated',
      sortable: true,
      widthClassName: 'w-[220px]',
      render: (record) => String(record.updated_at || '-'),
    },
    {
      key: 'summary',
      header: 'Summary',
      sortable: false,
      render: (record) => {
        const payload = (record.payload || {}) as Record<string, unknown>;
        const display = Object.values(payload).find((value) => String(value || '').trim().length > 0);
        return String(display || '-');
      },
    },
  ]), []);

  const handleCreate = () => {
    clearSubmitError();
    setActiveRecord(null);
    reset();
  };

  const handleSelectRecord = async (recordId: string, record?: Record<string, unknown>) => {
    if (projectionBacked && record) {
      const payload = (record.payload || {}) as Record<string, unknown>;
      setActiveRecord({
        ...payload,
        inventory_item_id: record.id || '',
      });
      return;
    }
    try {
      const response = await getUimEntity(node, recordId);
      const selected = (response.output || {}) as Record<string, unknown>;
      const payload = (selected.payload || {}) as Record<string, unknown>;
      setActiveRecord({ id: selected.id, ...payload });
    } catch (error) {
      setRecordsError('Unable to open selected record.');
    }
  };

  const handleDelete = async () => {
    const recordId = String(activeRecord?.id || '');
    if (!recordId) return;
    try {
      await deleteUimEntity(node, recordId);
      setActiveRecord(null);
      reset();
      await loadRecords();
    } catch (error) {
      setRecordsError('Unable to delete selected record.');
    }
  };

  const handleReplayNow = async () => {
    if (!projectionBacked) return;
    setIsReplayingProjection(true);
    try {
      await replayUimProjections();
      await loadRecords();
      toast({
        title: 'Projection replay complete',
        description: 'Dense-grid snapshot data has been refreshed.',
      });
    } catch (error) {
      toast({
        title: 'Replay failed',
        description: 'Unable to replay projection snapshots right now.',
        variant: 'destructive',
      });
    } finally {
      setIsReplayingProjection(false);
    }
  };

  return (
    <Card className="mdm-template-panel border-border/70 shadow-sm" data-testid={`uim-node-form-${node}`}>
      <CardHeader className="space-y-2">
        <CardTitle className="mdm-template-panel-title text-xl">{t(config.titleKey, { defaultValue: config.titleDefault })}</CardTitle>
        <CardDescription>{t(config.subtitleKey, { defaultValue: config.subtitleDefault })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <UimDataList
          records={filteredRecords}
          total={records.length}
          loading={isLoadingRecords}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          statusValue={statusValue}
          onStatusChange={setStatusValue}
          onClearFilters={() => {
            setSearchValue('');
            setStatusValue('all');
          }}
          onCreate={handleCreate}
          onRowClick={(record) => handleSelectRecord(String(record.id || ''), record)}
          columns={listColumns}
          exportFileName={`uim-${node}-records.csv`}
          modeBadgeLabel={projectionBacked ? 'Projection Mode' : undefined}
          onReplayNow={projectionBacked ? handleReplayNow : undefined}
          replayLoading={isReplayingProjection}
        />
        <p className="text-xs text-muted-foreground">
          List load latency: {Math.round(lastLoadDurationMs)} ms
        </p>

        {recordsError ? (
          <Alert variant="destructive" aria-live="assertive" role="alert">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Records Error</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{recordsError}</p>
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAutoRetryAttempt(0);
                    void loadRecords();
                  }}
                  disabled={isLoadingRecords}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  {isLoadingRecords ? 'Reconnecting...' : 'Reconnect'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-retry: {Math.min(autoRetryAttempt, AUTO_RETRY_MAX_ATTEMPTS)}/{AUTO_RETRY_MAX_ATTEMPTS}
                {autoRetryAttempt >= AUTO_RETRY_MAX_ATTEMPTS ? ' (max attempts reached)' : ` (every ${AUTO_RETRY_INTERVAL_MS / 1000}s)`}
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        {(formErrors.length > 0 || submitError) && (
          <Alert variant="destructive" aria-live="assertive" role="alert">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('uim.forms.errorSummary.title', { defaultValue: 'Please resolve the following errors' })}</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {submitError ? <li>{submitError}</li> : null}
                {formErrors.map((errorMessage, index) => (
                  <li key={`${errorMessage}-${index}`}>{errorMessage}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {isSaving ? <Progress value={65} aria-label={t('uim.forms.saving', { defaultValue: 'Saving' })} /> : null}

        <Form {...form}>
          <form className="space-y-4" onSubmit={submit} noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              {config.fields.map((fieldConfig) => (
                <FieldRenderer key={fieldConfig.name} fieldConfig={fieldConfig} control={form.control} t={t} />
              ))}
            </div>

            {config.includesDimensionBlock ? <DimensionBlock control={form.control} /> : null}
            {config.includesAddressBlock ? <AddressBlock control={form.control} /> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isEditMode ? t('uim.forms.actions.update', { defaultValue: 'Update' }) : t('uim.forms.actions.create', { defaultValue: 'Create' })}
              </Button>
              <Button type="button" variant="outline" onClick={handleCreate} disabled={isSaving}>
                {t('uim.forms.actions.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={isSaving || !isEditMode}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t('uim.forms.actions.delete', { defaultValue: 'Delete' })}
              </Button>
              <Button type="button" variant="outline" onClick={reset} disabled={isSaving}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {t('uim.forms.actions.reset', { defaultValue: 'Reset' })}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
