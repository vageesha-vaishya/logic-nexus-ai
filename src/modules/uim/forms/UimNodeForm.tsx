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
import { Badge } from '@/components/ui/badge';
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
import { UimStandardFormTemplate } from '@/modules/uim/components/templates/UimStandardFormTemplate';
import { UimApiError } from '@/services/uim/uimApi';
import {
  queryUimAnalyticsBiCube,
  queryUimAnalyticsEtlStatus,
  queryUimAnalyticsKpis,
  queryUimAnalyticsQaSignoff,
  queryUimAnalyticsReconciliation,
  queryUimAnalyticsSlaEvidence,
  queryUimProjectionItems,
  replayUimProjections,
  submitUimAnalyticsQaSignoff,
} from '@/services/uim/uimCoreServices';

type UimNodeFormProps = {
  node: UimNodeKey;
  existingEntity?: Record<string, unknown> | null;
};

type UimAnalyticsPhase4PrepPayload = {
  sequence: string[];
  kpi_model_definitions: Array<{
    key: string;
    label: string;
    description: string;
    formula: string;
    unit: string;
    owner_role: string;
  }>;
  semantic_dictionary?: {
    cube_name?: string;
    version?: string;
    dimensions?: Array<{
      key: string;
      source: string;
      grain: string;
      description: string;
    }>;
    measures?: Array<{
      key: string;
      source: string;
      aggregation: string;
      description: string;
    }>;
  };
  performance_targets?: {
    dashboard_latency_target_ms?: number;
    source?: string;
  };
};

type UimAnalyticsKpiResponsePayload = {
  low_stock_threshold?: number;
  kpis?: Record<string, number>;
  snapshot?: {
    replay_version?: number;
    generated_at?: string;
  };
  phase4_prep?: UimAnalyticsPhase4PrepPayload;
};

type UimAnalyticsEtlResponsePayload = {
  queue?: {
    queued?: number;
    running?: number;
    retryScheduled?: number;
    completed?: number;
    failed?: number;
  };
  telemetry?: {
    completed_runs?: number;
    failed_runs?: number;
    success_rate?: number;
  };
};

type UimAnalyticsReconciliationPayload = {
  readiness?: {
    status?: 'ready' | 'pending';
    score?: number;
    checks?: Array<{
      key: string;
      label: string;
      passed: boolean;
      details: string;
    }>;
  };
  snapshot?: {
    replay_version?: number;
    generated_at?: string;
    etl_completed_runs?: number;
    etl_failed_runs?: number;
  };
};

type UimAnalyticsBiCubePayload = {
  deployment_artifact?: {
    artifact_id?: string;
    artifact_hash?: string;
    artifact_version?: string;
    published_at?: string;
    deployment_target?: string;
  };
  data_dictionary?: {
    publication_status?: string;
    dimensions?: Array<Record<string, unknown>>;
    measures?: Array<Record<string, unknown>>;
    kpi_model_definitions?: Array<Record<string, unknown>>;
  };
};

type UimAnalyticsQaSignoffPayload = {
  latest?: {
    signoff_id?: string;
    signoff_status?: 'signed_off' | 'revoked';
    signed_off_by?: string;
    signed_off_role?: string;
    signed_off_at?: string;
  } | null;
  records?: Array<Record<string, unknown>>;
};

type UimAnalyticsSlaEvidencePayload = {
  gate?: string;
  status?: 'ready' | 'pending';
  readiness_score?: number;
  performance_targets?: {
    dashboard_latency_target_ms?: number;
  };
};

type UimAnalyticsEndpointStatus = {
  key: string;
  label: string;
  status: 'ok' | 'error';
  detail: string;
};

const ANALYTICS_PHASE4_SEQUENCE_FALLBACK = [
  'kpi-model-definitions',
  'etl-jobs',
  'dashboard-fe',
  'bi-semantic-cube-and-data-dictionary',
  'reporting-qa-and-reconciliation',
];

const AUTO_RETRY_INTERVAL_MS = 5000;
const AUTO_RETRY_MAX_ATTEMPTS = 3;
const ANALYTICS_DASHBOARD_LATENCY_TARGET_MS_FALLBACK = 2200;
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
  const [moduleColumnCatalog, setModuleColumnCatalog] = useState<Array<{ key: string; header: string; sortable?: boolean }>>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [statusValue, setStatusValue] = useState('all');
  const [lastLoadDurationMs, setLastLoadDurationMs] = useState(0);
  const [autoRetryAttempt, setAutoRetryAttempt] = useState(0);
  const [isReplayingProjection, setIsReplayingProjection] = useState(false);
  const [isOpeningRecord, setIsOpeningRecord] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsKpiPayload, setAnalyticsKpiPayload] = useState<UimAnalyticsKpiResponsePayload | null>(null);
  const [analyticsEtlPayload, setAnalyticsEtlPayload] = useState<UimAnalyticsEtlResponsePayload | null>(null);
  const [analyticsReconciliationPayload, setAnalyticsReconciliationPayload] = useState<UimAnalyticsReconciliationPayload | null>(null);
  const [analyticsBiCubePayload, setAnalyticsBiCubePayload] = useState<UimAnalyticsBiCubePayload | null>(null);
  const [analyticsQaSignoffPayload, setAnalyticsQaSignoffPayload] = useState<UimAnalyticsQaSignoffPayload | null>(null);
  const [analyticsSlaEvidencePayload, setAnalyticsSlaEvidencePayload] = useState<UimAnalyticsSlaEvidencePayload | null>(null);
  const [analyticsEndpointStatuses, setAnalyticsEndpointStatuses] = useState<UimAnalyticsEndpointStatus[]>([]);
  const [analyticsCompatibilityNotice, setAnalyticsCompatibilityNotice] = useState<string | null>(null);
  const [isQaSignoffSubmitting, setIsQaSignoffSubmitting] = useState(false);
  const [analyticsLatencyMs, setAnalyticsLatencyMs] = useState(0);
  const [analyticsLatencySamples, setAnalyticsLatencySamples] = useState<number[]>([]);
  const [templateLayoutMode, setTemplateLayoutMode] = useState<'table' | 'side-form' | 'split'>('side-form');
  const projectionBacked = PROJECTION_BACKED_NODES.includes(node);
  const analyticsNodeActive = node === 'analytics';

  const { form, isSaving, submitError, submit, reset, isEditMode, lastSavedId, clearSubmitError } = useUimNodeForm({
    config,
    existingEntity: activeRecord,
  });
  const formErrors = Object.values(form.formState.errors).map((error) => String(error?.message || '')).filter(Boolean);
  const itemIdValue = String(form.watch('item_id') || '');

  const itemOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string; available: number; reorderPoint: number }>();
    for (const record of records) {
      const id = String(record.id || '').trim();
      if (!id) continue;
      const payload = (record.payload || {}) as Record<string, unknown>;
      const label = [
        String(payload.part_number || '').trim(),
        String(payload.item_name || payload.title || '').trim(),
        String(payload.sku || '').trim(),
      ].filter(Boolean).join(' | ') || id;
      const available = Number(payload.available_quantity || payload.projected_available_quantity || payload.current_quantity || 0);
      const reorderPoint = Number(payload.reorder_point || 0);
      map.set(id, { id, label, available, reorderPoint });
    }
    return [...map.values()];
  }, [records]);

  const dynamicFields = useMemo(() => {
    const itemFieldNodes: UimNodeKey[] = ['stock-ledger', 'reservations', 'issue-consume', 'restock'];
    return config.fields.map((field) => {
      if (field.name === 'item_id' && itemFieldNodes.includes(node)) {
        return {
          ...field,
          type: 'select' as const,
          options: itemOptions.map((option) => ({
            value: option.id,
            labelKey: `uim.forms.dynamic.item.${option.id}`,
            labelDefault: option.label,
          })),
        };
      }
      return field;
    });
  }, [config.fields, itemOptions, node]);

  useEffect(() => {
    if (!itemIdValue) return;
    const selected = itemOptions.find((option) => option.id === itemIdValue);
    if (!selected) return;
    if (node === 'reservations') {
      form.setValue('available_quantity', selected.available, { shouldValidate: true, shouldDirty: true });
    }
    if (node === 'issue-consume') {
      form.setValue('available_before_issue', selected.available, { shouldValidate: true, shouldDirty: true });
    }
    if (node === 'restock') {
      form.setValue('current_quantity', selected.available, { shouldValidate: true, shouldDirty: true });
      if (Number(form.getValues('reorder_point') || 0) <= 0 && selected.reorderPoint > 0) {
        form.setValue('reorder_point', selected.reorderPoint, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [itemIdValue, itemOptions, node, form]);

  const fkValidationFailed = useMemo(() => {
    const itemFieldNodes: UimNodeKey[] = ['stock-ledger', 'reservations', 'issue-consume', 'restock'];
    if (!itemFieldNodes.includes(node)) return false;
    if (!itemIdValue) return false;
    return !itemOptions.some((option) => option.id === itemIdValue);
  }, [node, itemIdValue, itemOptions]);
  const referenceValidationMessages = useMemo(() => {
    if (!fkValidationFailed) return [];
    return ['Selected item reference is not available in current reference list options.'];
  }, [fkValidationFailed]);
  const referenceListSummary = useMemo(() => {
    const itemFieldNodes: UimNodeKey[] = ['stock-ledger', 'reservations', 'issue-consume', 'restock'];
    if (!itemFieldNodes.includes(node)) return [];
    return [{ fieldKey: 'item_id', optionCount: itemOptions.length }];
  }, [node, itemOptions.length]);

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
            if (snapshots.length > 0) {
              const projectionColumnCatalog = [
                { key: 'id', header: 'Inventory ID', sortable: true },
                { key: 'part_number', header: 'Part Number', sortable: true },
                { key: 'title', header: 'Title', sortable: true },
                { key: 'sku', header: 'SKU', sortable: true },
                { key: 'maintenance_category', header: 'Maintenance Category', sortable: true },
                { key: 'ata_chapter_code', header: 'ATA Chapter', sortable: true },
                { key: 'condition_code', header: 'Condition', sortable: true },
                { key: 'certification_status', header: 'Certification', sortable: true },
                { key: 'projected_available_quantity', header: 'Available Qty', sortable: true },
                { key: 'projected_reserved_quantity', header: 'Reserved Qty', sortable: true },
                { key: 'projected_consumed_quantity', header: 'Consumed Qty', sortable: true },
                { key: 'updated_at', header: 'Updated At', sortable: true },
              ];
              setModuleColumnCatalog(projectionColumnCatalog);
              loadedRecords = snapshots.map((row) => {
                const rowRecord = row as Record<string, unknown>;
                const partNumber = String(rowRecord.part_number || '').trim();
                const title = String(rowRecord.title || '').trim();
                const sku = String(rowRecord.sku || '').trim();
                return {
                  id: String(rowRecord.inventory_item_id || rowRecord.id || ''),
                  updated_at: rowRecord.updated_at || rowRecord.last_ledger_at || '',
                  payload: {
                    part_number: partNumber,
                    title,
                    sku,
                    maintenance_category: rowRecord.maintenance_category || '',
                    ata_chapter_code: rowRecord.ata_chapter_code || '',
                    condition_code: rowRecord.condition_code || '',
                    certification_status: rowRecord.certification_status || '',
                    aog_priority: Boolean(rowRecord.aog_priority),
                    projected_available_quantity: rowRecord.projected_available_quantity || 0,
                    projected_reserved_quantity: rowRecord.projected_reserved_quantity || 0,
                    projected_consumed_quantity: rowRecord.projected_consumed_quantity || 0,
                    replay_version: rowRecord.replay_version || 0,
                    summary: partNumber || title || sku || '',
                    status: readStatusValueFromProjection(rowRecord),
                  },
                  projection: rowRecord,
                };
              });
            } else {
              // Fallback to form-record source when franchise-scoped snapshots are not available yet.
              const response = await listUimEntities(node, 200, 0);
              setModuleColumnCatalog(response?.output?.column_catalog || []);
              loadedRecords = Array.isArray(response?.output?.records) ? response.output.records : [];
            }
          } else {
            const response = await listUimEntities(node, 200, 0);
            setModuleColumnCatalog(response?.output?.column_catalog || []);
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

  const loadAnalytics = useCallback(async () => {
    if (!analyticsNodeActive) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    setAnalyticsCompatibilityNotice(null);
    const startedAt = performance.now();
    try {
      const [kpisResponse, etlResponse, reconciliationResponse, biCubeResponse, qaSignoffResponse, slaEvidenceResponse] = await Promise.allSettled([
        queryUimAnalyticsKpis(),
        queryUimAnalyticsEtlStatus(),
        queryUimAnalyticsReconciliation(),
        queryUimAnalyticsBiCube(),
        queryUimAnalyticsQaSignoff(),
        queryUimAnalyticsSlaEvidence(),
      ]);
      const nextKpiPayload = kpisResponse.status === 'fulfilled'
        ? (kpisResponse.value?.output || null) as UimAnalyticsKpiResponsePayload | null
        : null;
      const nextEtlPayload = etlResponse.status === 'fulfilled'
        ? (etlResponse.value?.output || null) as UimAnalyticsEtlResponsePayload | null
        : null;
      const nextReconciliationPayload = reconciliationResponse.status === 'fulfilled'
        ? (reconciliationResponse.value?.output || null) as UimAnalyticsReconciliationPayload | null
        : null;
      const nextBiCubePayload = biCubeResponse.status === 'fulfilled'
        ? (biCubeResponse.value?.output || null) as UimAnalyticsBiCubePayload | null
        : null;
      const nextQaSignoffPayload = qaSignoffResponse.status === 'fulfilled'
        ? (qaSignoffResponse.value?.output || null) as UimAnalyticsQaSignoffPayload | null
        : null;
      const nextSlaEvidencePayload = slaEvidenceResponse.status === 'fulfilled'
        ? (slaEvidenceResponse.value?.output || null) as UimAnalyticsSlaEvidencePayload | null
        : null;
      const toEndpointStatus = (
        key: string,
        label: string,
        result: PromiseSettledResult<unknown>,
      ): UimAnalyticsEndpointStatus => {
        if (result.status === 'fulfilled') {
          return {
            key,
            label,
            status: 'ok',
            detail: 'Loaded successfully',
          };
        }
        const reason = result.reason;
        if (reason instanceof UimApiError) {
          return {
            key,
            label,
            status: 'error',
            detail: `HTTP ${reason.status}: ${reason.message || 'Request failed'}`,
          };
        }
        if (reason instanceof TypeError && String(reason.message || '').toLowerCase().includes('fetch')) {
          return {
            key,
            label,
            status: 'error',
            detail: 'Network fetch failed',
          };
        }
        return {
          key,
          label,
          status: 'error',
          detail: String((reason as { message?: unknown } | null)?.message || reason || 'Unknown error'),
        };
      };
      setAnalyticsEndpointStatuses([
        toEndpointStatus('kpis', 'KPI', kpisResponse),
        toEndpointStatus('etl', 'ETL', etlResponse),
        toEndpointStatus('reconciliation', 'Reconciliation', reconciliationResponse),
        toEndpointStatus('bi-cube', 'BI Cube', biCubeResponse),
        toEndpointStatus('qa-signoff', 'QA Sign-off', qaSignoffResponse),
        toEndpointStatus('sla-evidence', 'SLA Evidence', slaEvidenceResponse),
      ]);

      // Keep UI usable even when one analytics endpoint is temporarily unavailable.
      setAnalyticsKpiPayload(nextKpiPayload || {
        low_stock_threshold: 0,
        kpis: {},
        snapshot: {
          replay_version: 0,
          generated_at: '',
        },
        phase4_prep: {
          sequence: ANALYTICS_PHASE4_SEQUENCE_FALLBACK,
          kpi_model_definitions: [],
          semantic_dictionary: {
            cube_name: '',
            version: '',
            dimensions: [],
            measures: [],
          },
          performance_targets: {
            dashboard_latency_target_ms: ANALYTICS_DASHBOARD_LATENCY_TARGET_MS_FALLBACK,
            source: 'fallback',
          },
        },
      });
      setAnalyticsEtlPayload(nextEtlPayload || {
        queue: {
          queued: 0,
          running: 0,
          retryScheduled: 0,
          completed: 0,
          failed: 0,
        },
        telemetry: {
          completed_runs: 0,
          failed_runs: 0,
          success_rate: 0,
        },
      });
      setAnalyticsReconciliationPayload(nextReconciliationPayload || {
        readiness: {
          status: 'pending',
          score: 0,
          checks: [],
        },
        snapshot: {
          replay_version: 0,
          generated_at: '',
          etl_completed_runs: 0,
          etl_failed_runs: 0,
        },
      });
      setAnalyticsBiCubePayload(nextBiCubePayload || {
        deployment_artifact: {
          artifact_id: '',
          artifact_hash: '',
          artifact_version: '',
          published_at: '',
          deployment_target: '',
        },
        data_dictionary: {
          publication_status: 'pending',
          dimensions: [],
          measures: [],
          kpi_model_definitions: [],
        },
      });
      setAnalyticsQaSignoffPayload(nextQaSignoffPayload || {
        latest: null,
        records: [],
      });
      setAnalyticsSlaEvidencePayload(nextSlaEvidencePayload || {
        gate: 'v0.8-phase-4-exit',
        status: 'pending',
        readiness_score: 0,
        performance_targets: {
          dashboard_latency_target_ms: ANALYTICS_DASHBOARD_LATENCY_TARGET_MS_FALLBACK,
        },
      });

      const rejectionReasons = [
        kpisResponse,
        etlResponse,
        reconciliationResponse,
        biCubeResponse,
        qaSignoffResponse,
        slaEvidenceResponse,
      ]
        .filter((result) => result.status === 'rejected')
        .map((result) => (result as PromiseRejectedResult).reason);
      const allRejectedAre404 = rejectionReasons.length === 6
        && rejectionReasons.every((reason) => reason instanceof UimApiError && reason.status === 404);

      const resolveAnalyticsErrorMessage = (reasons: unknown[]): string => {
        if (reasons.some((reason) => reason instanceof UimApiError && (reason.status === 401 || reason.status === 403))) {
          return 'Analytics endpoints are reachable, but your session is unauthorized for this module. Re-authenticate and retry.';
        }
        if (reasons.some((reason) => reason instanceof UimApiError && reason.status === 404)) {
          return 'Some analytics endpoints are not deployed in this environment yet. Deploy `/api/v2/uim/analytics/*` routes and retry.';
        }
        if (reasons.some((reason) => reason instanceof TypeError && String(reason.message || '').toLowerCase().includes('fetch'))) {
          return 'Unable to reach UIM analytics service. Check network connectivity and API base URL configuration.';
        }
        return 'Analytics endpoints are currently unavailable; showing fallback metadata.';
      };

      if (!nextKpiPayload && !nextEtlPayload && !nextReconciliationPayload && !nextBiCubePayload && !nextQaSignoffPayload && !nextSlaEvidencePayload) {
        if (allRejectedAre404) {
          setAnalyticsCompatibilityNotice('Running in compatibility mode: this backend profile does not expose advanced analytics routes yet. Fallback metadata is active.');
          setAnalyticsError(null);
        } else {
          setAnalyticsError(resolveAnalyticsErrorMessage(rejectionReasons));
        }
      } else if (!nextKpiPayload || !nextEtlPayload || !nextReconciliationPayload || !nextBiCubePayload || !nextQaSignoffPayload || !nextSlaEvidencePayload) {
        setAnalyticsError('Partial analytics metadata loaded. Some readiness fields are temporarily unavailable.');
      }
    } catch (error) {
      setAnalyticsKpiPayload({
        low_stock_threshold: 0,
        kpis: {},
        snapshot: {
          replay_version: 0,
          generated_at: '',
        },
        phase4_prep: {
          sequence: ANALYTICS_PHASE4_SEQUENCE_FALLBACK,
          kpi_model_definitions: [],
          semantic_dictionary: {
            cube_name: '',
            version: '',
            dimensions: [],
            measures: [],
          },
          performance_targets: {
            dashboard_latency_target_ms: ANALYTICS_DASHBOARD_LATENCY_TARGET_MS_FALLBACK,
            source: 'fallback',
          },
        },
      });
      setAnalyticsEtlPayload({
        queue: {
          queued: 0,
          running: 0,
          retryScheduled: 0,
          completed: 0,
          failed: 0,
        },
        telemetry: {
          completed_runs: 0,
          failed_runs: 0,
          success_rate: 0,
        },
      });
      setAnalyticsReconciliationPayload({
        readiness: {
          status: 'pending',
          score: 0,
          checks: [],
        },
        snapshot: {
          replay_version: 0,
          generated_at: '',
          etl_completed_runs: 0,
          etl_failed_runs: 0,
        },
      });
      setAnalyticsBiCubePayload({
        deployment_artifact: {
          artifact_id: '',
          artifact_hash: '',
          artifact_version: '',
          published_at: '',
          deployment_target: '',
        },
        data_dictionary: {
          publication_status: 'pending',
          dimensions: [],
          measures: [],
          kpi_model_definitions: [],
        },
      });
      setAnalyticsQaSignoffPayload({
        latest: null,
        records: [],
      });
      setAnalyticsSlaEvidencePayload({
        gate: 'v0.8-phase-4-exit',
        status: 'pending',
        readiness_score: 0,
        performance_targets: {
          dashboard_latency_target_ms: ANALYTICS_DASHBOARD_LATENCY_TARGET_MS_FALLBACK,
        },
      });
      setAnalyticsEndpointStatuses([
        { key: 'kpis', label: 'KPI', status: 'error', detail: 'Fallback mode active' },
        { key: 'etl', label: 'ETL', status: 'error', detail: 'Fallback mode active' },
        { key: 'reconciliation', label: 'Reconciliation', status: 'error', detail: 'Fallback mode active' },
        { key: 'bi-cube', label: 'BI Cube', status: 'error', detail: 'Fallback mode active' },
        { key: 'qa-signoff', label: 'QA Sign-off', status: 'error', detail: 'Fallback mode active' },
        { key: 'sla-evidence', label: 'SLA Evidence', status: 'error', detail: 'Fallback mode active' },
      ]);
      setAnalyticsError('Analytics endpoints are currently unavailable; showing fallback metadata.');
    } finally {
      const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt));
      setAnalyticsLatencyMs(elapsedMs);
      setAnalyticsLatencySamples((current) => {
        const next = [...current, elapsedMs];
        return next.slice(-5);
      });
      setAnalyticsLoading(false);
    }
  }, [analyticsNodeActive]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (!lastSavedId) return;
    void loadAnalytics();
  }, [lastSavedId, loadAnalytics]);

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

  const readPayloadPathValue = (payload: Record<string, unknown>, path: string): unknown => {
    if (!path.includes('.')) return payload[path];
    const parts = path.split('.');
    let current: unknown = payload;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
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

  const listColumns = useMemo<UimDataListColumn<Record<string, unknown>>[]>(() => {
    const baseColumns: UimDataListColumn<Record<string, unknown>>[] = [{
      key: 'id',
      header: 'Record ID',
      sortable: true,
      widthClassName: 'w-[140px]',
      render: (record) => String(record.id || '').slice(0, 8),
    }];
    const fromCatalog = (moduleColumnCatalog || []).filter((column) => {
      if (column.key === 'id' || column.key === 'updated_at') return false;
      if (column.key === 'status') return true;
      return true;
    }).map<UimDataListColumn<Record<string, unknown>>>((column) => ({
      key: column.key,
      header: column.header,
      sortable: column.sortable !== false,
      render: (record) => {
        if (column.key === 'updated_at') return String(record.updated_at || '-');
        if (column.key === 'status') return readStatusValue(record);
        const payload = (record.payload || {}) as Record<string, unknown>;
        const value = readPayloadPathValue(payload, column.key);
        if (value === null || value === undefined || value === '') return '-';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      },
    }));

    const statusAndUpdated = [
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        widthClassName: 'w-[140px]',
        render: (record: Record<string, unknown>) => readStatusValue(record),
      },
      {
        key: 'updated_at',
        header: 'Updated',
        sortable: true,
        widthClassName: 'w-[220px]',
        render: (record: Record<string, unknown>) => String(record.updated_at || '-'),
      },
    ].filter((column) => !fromCatalog.some((entry) => entry.key === column.key));

    const fallbackSummary: UimDataListColumn<Record<string, unknown>>[] = fromCatalog.length > 0
      ? []
      : [{
        key: 'summary',
        header: 'Summary',
        sortable: false,
        render: (record) => {
          const payload = (record.payload || {}) as Record<string, unknown>;
          const display = Object.values(payload).find((value) => String(value || '').trim().length > 0);
          return String(display || '-');
        },
      }];

    return [...baseColumns, ...statusAndUpdated, ...fromCatalog, ...fallbackSummary];
  }, [records, moduleColumnCatalog]);

  const defaultVisibleColumnKeys = useMemo(() => {
    const keys = listColumns.map((column) => column.key);
    const has = (key: string) => keys.includes(key);
    const moduleDefaults: Record<UimNodeKey, string[]> = {
      overview: ['module_name', 'owner_email', 'rollout_phase', 'target_go_live_date', 'status', 'updated_at'],
      'item-master': ['sku', 'part_number', 'item_name', 'category', 'status', 'updated_at'],
      'stock-ledger': ['item_id', 'transaction_type', 'quantity_delta', 'referenced_module', 'status', 'updated_at'],
      reservations: ['reservation_token', 'item_id', 'requested_quantity', 'reservation_status', 'expected_use_date', 'updated_at'],
      'issue-consume': ['item_id', 'transaction_type', 'quantity_delta', 'reference', 'status', 'updated_at'],
      restock: ['item_id', 'transaction_type', 'quantity_delta', 'reference', 'status', 'updated_at'],
      locations: ['location_code', 'location_name', 'location_type', 'quantity', 'status', 'updated_at'],
      analytics: ['report_name', 'metric_group', 'catalog_items', 'inventory_items', 'projection_snapshots', 'updated_at'],
    };
    const configured = (moduleDefaults[node] || []).filter(has);
    if (configured.length >= 6) return configured.slice(0, 6);
    const append = keys.filter((key) => !configured.includes(key));
    return [...configured, ...append].slice(0, Math.min(6, keys.length));
  }, [listColumns, node]);

  const analyticsPhase4Prep = analyticsKpiPayload?.phase4_prep || null;
  const analyticsSequence = analyticsPhase4Prep?.sequence || [];
  const analyticsKpiDefinitions = analyticsPhase4Prep?.kpi_model_definitions || [];
  const analyticsDimensions = analyticsPhase4Prep?.semantic_dictionary?.dimensions || [];
  const analyticsMeasures = analyticsPhase4Prep?.semantic_dictionary?.measures || [];
  const analyticsDashboardLatencyTargetMs = Number(
    analyticsPhase4Prep?.performance_targets?.dashboard_latency_target_ms
      || ANALYTICS_DASHBOARD_LATENCY_TARGET_MS_FALLBACK,
  );
  const analyticsLatencyTargetSource = String(
    analyticsPhase4Prep?.performance_targets?.source || 'fallback',
  );
  const analyticsCubeName = String(analyticsPhase4Prep?.semantic_dictionary?.cube_name || '');
  const analyticsCubeVersion = String(analyticsPhase4Prep?.semantic_dictionary?.version || '');
  const analyticsSnapshotVersion = Number(analyticsKpiPayload?.snapshot?.replay_version || 0);
  const analyticsQueue = analyticsEtlPayload?.queue || {};
  const analyticsTelemetry = analyticsEtlPayload?.telemetry || {};
  const analyticsReconciliationStatus = String(analyticsReconciliationPayload?.readiness?.status || 'pending');
  const analyticsReconciliationScore = Number(analyticsReconciliationPayload?.readiness?.score || 0);
  const analyticsReconciliationChecks = analyticsReconciliationPayload?.readiness?.checks || [];
  const analyticsReconciliationReady = analyticsReconciliationStatus === 'ready';
  const analyticsLatencyAverageMs = analyticsLatencySamples.length > 0
    ? Math.round(analyticsLatencySamples.reduce((acc, value) => acc + value, 0) / analyticsLatencySamples.length)
    : 0;
  const analyticsLatencyWithinTarget = analyticsLatencyAverageMs > 0
    ? analyticsLatencyAverageMs <= analyticsDashboardLatencyTargetMs
    : analyticsLatencyMs <= analyticsDashboardLatencyTargetMs;
  const analyticsApiBase = import.meta.env.VITE_UIM_API_BASE_URL || '/api/v2/uim';
  const analyticsHealthUrl = `${analyticsApiBase}/health`;
  const analyticsContractsUrl = `${analyticsApiBase}/integration-contracts`;
  const analyticsOpenApiUrl = `${analyticsApiBase}/contracts/openapi-3.1.yaml`;
  const analyticsBiArtifactId = String(analyticsBiCubePayload?.deployment_artifact?.artifact_id || '-');
  const analyticsDictionaryPublished = String(analyticsBiCubePayload?.data_dictionary?.publication_status || 'pending') === 'published';
  const analyticsQaSignoffLatest = analyticsQaSignoffPayload?.latest || null;
  const analyticsQaSignoffDone = String(analyticsQaSignoffLatest?.signoff_status || '') === 'signed_off';
  const analyticsSlaGate = String(analyticsSlaEvidencePayload?.gate || 'v0.8-phase-4-exit');
  const analyticsSlaReadiness = Number(analyticsSlaEvidencePayload?.readiness_score || 0);
  const analyticsSlaStatus = String(analyticsSlaEvidencePayload?.status || 'pending');

  const handleQaSignoff = async () => {
    setIsQaSignoffSubmitting(true);
    try {
      await submitUimAnalyticsQaSignoff({
        signoff_status: 'signed_off',
        signed_off_by: 'system.user@uim.local',
        signed_off_role: 'qa_lead',
        reconciliation_verified: analyticsReconciliationReady,
        latency_target_met: analyticsLatencyWithinTarget,
        data_dictionary_published: analyticsDictionaryPublished,
        bi_cube_deployed: analyticsBiArtifactId !== '-',
        notes: 'Phase 4 QA sign-off submitted from analytics workspace.',
      });
      await loadAnalytics();
      toast({
        title: 'QA sign-off submitted',
        description: 'Reporting QA reconciliation workflow has been updated.',
      });
    } catch (error) {
      toast({
        title: 'QA sign-off failed',
        description: 'Unable to submit QA sign-off right now.',
        variant: 'destructive',
      });
    } finally {
      setIsQaSignoffSubmitting(false);
    }
  };

  const handleCreate = () => {
    clearSubmitError();
    setActiveRecord(null);
    reset();
  };

  const handleSelectRecord = async (
    recordId: string,
    record?: Record<string, unknown>,
    openMode: 'single' | 'double' = 'single',
  ) => {
    if (openMode === 'double') setIsOpeningRecord(true);
    if (projectionBacked && record) {
      const payload = (record.payload || {}) as Record<string, unknown>;
      setActiveRecord({
        ...payload,
        inventory_item_id: record.id || '',
      });
      if (openMode === 'double') {
        toast({
          title: 'Record opened in edit mode',
          description: 'The selected record is ready for updates.',
        });
      }
      setIsOpeningRecord(false);
      return;
    }
    try {
      const response = await getUimEntity(node, recordId);
      const selected = (response.output || {}) as Record<string, unknown>;
      const payload = (selected.payload || {}) as Record<string, unknown>;
      setActiveRecord({ id: selected.id, ...payload });
      if (openMode === 'double') {
        toast({
          title: 'Record opened in edit mode',
          description: 'The selected record is ready for updates.',
        });
      }
    } catch (error) {
      setRecordsError('Unable to open selected record.');
    } finally {
      setIsOpeningRecord(false);
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

  const itemMasterFormSlot = (
    <div className="space-y-4">
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
            {dynamicFields.map((fieldConfig) => (
              <FieldRenderer key={fieldConfig.name} fieldConfig={fieldConfig} control={form.control} t={t} />
            ))}
          </div>

          {config.includesDimensionBlock ? <DimensionBlock control={form.control} /> : null}
          {config.includesAddressBlock ? <AddressBlock control={form.control} /> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSaving || fkValidationFailed}>
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
    </div>
  );

  const analyticsTemplateFooter = analyticsNodeActive ? (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Phase 4 Sequence</CardTitle>
              <CardDescription>Implementation order from design specification.</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void loadAnalytics();
              }}
              disabled={analyticsLoading}
              aria-label="Retry analytics metadata"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              {analyticsLoading ? 'Refreshing...' : 'Retry Analytics Metadata'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {analyticsSequence.length > 0 ? (
            <ol className="list-decimal space-y-1 pl-4">
              {analyticsSequence.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">Phase sequence metadata is not available yet.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Reconciliation readiness: {analyticsReconciliationReady ? 'ready' : 'pending'} ({analyticsReconciliationScore}%)
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">KPI Model Definitions</CardTitle>
          <CardDescription>Formulas and ownership for analytics KPIs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {analyticsKpiDefinitions.length > 0 ? (
            <div className="space-y-2">
              {analyticsKpiDefinitions.map((definition) => (
                <div key={definition.key} className="rounded-md border border-border/70 p-2">
                  <p className="font-medium">{definition.label} ({definition.key})</p>
                  <p className="text-xs text-muted-foreground">{definition.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">KPI metadata is not available yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">BI Semantic Cube</CardTitle>
          <CardDescription>Cube and dictionary metadata for downstream BI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Cube: {analyticsCubeName || '-'}</p>
          <p>Version: {analyticsCubeVersion || '-'}</p>
          <p>Artifact: {analyticsBiArtifactId}</p>
          <p className="text-xs text-muted-foreground">
            Dimensions: {analyticsDimensions.length} | Measures: {analyticsMeasures.length}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">ETL and Reconciliation Status</CardTitle>
          <CardDescription>Phase 4 reporting QA readiness indicators.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Queue - queued: {Number(analyticsQueue.queued || 0)}, running: {Number(analyticsQueue.running || 0)}, retry: {Number(analyticsQueue.retryScheduled || 0)}, completed: {Number(analyticsQueue.completed || 0)}, failed: {Number(analyticsQueue.failed || 0)}
          </p>
          <p>
            Telemetry - completed runs: {Number(analyticsTelemetry.completed_runs || 0)}, failed runs: {Number(analyticsTelemetry.failed_runs || 0)}, success rate: {Number(analyticsTelemetry.success_rate || 0)}
          </p>
          <p className="text-xs text-muted-foreground">
            Dashboard latency target: ≤ {analyticsDashboardLatencyTargetMs} ms
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href={analyticsHealthUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Open API Health
            </a>
            <a
              href={analyticsContractsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Open API Contracts
            </a>
            <a
              href={analyticsOpenApiUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Open OpenAPI YAML
            </a>
          </div>
          <Button
            type="button"
            size="sm"
            variant={analyticsQaSignoffDone ? 'secondary' : 'default'}
            onClick={() => {
              void handleQaSignoff();
            }}
            disabled={isQaSignoffSubmitting || analyticsLoading}
          >
            {isQaSignoffSubmitting
              ? 'Submitting QA Sign-off...'
              : analyticsQaSignoffDone
                ? 'QA Sign-off Submitted'
                : 'Submit QA Sign-off'}
          </Button>
          {analyticsError ? <p className="text-xs text-destructive">{analyticsError}</p> : null}
          <details className="rounded-md border border-border/70 p-2 text-xs">
            <summary className="cursor-pointer font-medium">Error Details</summary>
            <div className="mt-2 space-y-1">
              {analyticsEndpointStatuses.map((endpoint) => (
                <p key={endpoint.key}>
                  {endpoint.status === 'ok' ? 'OK' : 'ERR'} - {endpoint.label}: {endpoint.detail}
                </p>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  ) : null;

  if (
    node === 'overview'
    || node === 'item-master'
    || node === 'stock-ledger'
    || node === 'reservations'
    || node === 'issue-consume'
    || node === 'restock'
    || node === 'locations'
    || node === 'analytics'
  ) {
    const templateState = recordsError
      ? 'error'
      : isLoadingRecords
        ? 'loading'
        : filteredRecords.length === 0
          ? 'empty'
          : 'ready';
    const breadcrumbByNode: Record<UimNodeKey, string[]> = {
      overview: ['UIM', 'Forms', 'Overview'],
      'item-master': ['UIM', 'Forms', 'Item Master'],
      'stock-ledger': ['UIM', 'Forms', 'Stock Ledger'],
      reservations: ['UIM', 'Forms', 'Reservations'],
      'issue-consume': ['UIM', 'Forms', 'Issue & Consume'],
      restock: ['UIM', 'Forms', 'Restock'],
      locations: ['UIM', 'Forms', 'Locations'],
      analytics: ['UIM', 'Forms', 'Analytics'],
    };

    return (
      <UimStandardFormTemplate
        moduleTitle={t(config.titleKey, { defaultValue: config.titleDefault })}
        moduleDescription={t(config.subtitleKey, { defaultValue: config.subtitleDefault })}
        moduleKey={node}
        mode={isEditMode ? 'edit' : 'create'}
        state={templateState}
        statusBadge={records.some((record) => {
          const metadata = ((record.metadata || {}) as Record<string, unknown>);
          return String(metadata.mode || '') === 'derived-canonical';
        }) ? 'Derived from canonical inventory' : undefined}
        breadcrumbs={breadcrumbByNode[node]}
        layoutMode={templateLayoutMode}
        onLayoutModeChange={setTemplateLayoutMode}
        availableLayoutModes={['table', 'side-form']}
        referenceValidation={{
          status: fkValidationFailed ? 'error' : 'ok',
          messages: referenceValidationMessages,
        }}
        referenceListSummary={referenceListSummary}
        list={{
          records: filteredRecords,
          total: records.length,
          columns: listColumns,
          exportFileName: `uim-${node}-records.csv`,
          defaultVisibleColumnKeys,
          showFieldSelector: true,
          searchValue,
          onSearchChange: setSearchValue,
          statusValue,
          onStatusChange: setStatusValue,
          onClearFilters: () => {
            setSearchValue('');
            setStatusValue('all');
          },
          onRowClick: (record) => handleSelectRecord(String(record.id || ''), record),
          onRowDoubleClick: (record) => handleSelectRecord(String(record.id || ''), record, 'double'),
        }}
        onCreate={handleCreate}
        onReplayNow={projectionBacked ? handleReplayNow : undefined}
        replayLoading={isReplayingProjection}
        formSlot={itemMasterFormSlot}
        sidePanelSlot={(
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>List load latency: {Math.round(lastLoadDurationMs)} ms</p>
            {isOpeningRecord ? <Progress value={45} aria-label="Opening record" /> : null}
          </div>
        )}
        footerSlot={analyticsTemplateFooter}
      />
    );
  }

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
          onRowDoubleClick={(record) => handleSelectRecord(String(record.id || ''), record, 'double')}
          columns={listColumns}
          exportFileName={`uim-${node}-records.csv`}
          defaultVisibleColumnKeys={defaultVisibleColumnKeys}
          modeBadgeLabel={projectionBacked ? 'Projection Mode' : undefined}
          onReplayNow={projectionBacked ? handleReplayNow : undefined}
          replayLoading={isReplayingProjection}
        />
        <p className="text-xs text-muted-foreground">
          List load latency: {Math.round(lastLoadDurationMs)} ms
        </p>
        {isOpeningRecord ? <Progress value={45} aria-label="Opening record" /> : null}
        {records.some((record) => {
          const metadata = ((record.metadata || {}) as Record<string, unknown>);
          return String(metadata.mode || '') === 'derived-canonical';
        }) ? (
          <Badge variant="secondary">Derived from canonical inventory</Badge>
        ) : null}

        {analyticsNodeActive ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Phase 4 Sequence</CardTitle>
                    <CardDescription>Implementation order from design specification.</CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void loadAnalytics();
                    }}
                    disabled={analyticsLoading}
                    aria-label="Retry analytics metadata"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {analyticsLoading ? 'Refreshing...' : 'Retry Analytics Metadata'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {analyticsSequence.length > 0 ? (
                  <ol className="list-decimal space-y-1 pl-4">
                    {analyticsSequence.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted-foreground">Phase sequence metadata is not available yet.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Reconciliation readiness: {analyticsReconciliationReady ? 'ready' : 'pending'} ({analyticsReconciliationScore}%)
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Dashboard latency target: ≤ {analyticsDashboardLatencyTargetMs} ms</span>
                  <Badge variant={analyticsLatencyWithinTarget ? 'secondary' : 'destructive'}>
                    {analyticsLatencyWithinTarget ? 'Latency: within target' : 'Latency: above target'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Latency target source: {analyticsLatencyTargetSource}</p>
                <p className="text-xs text-muted-foreground">
                  Replay version: {analyticsSnapshotVersion || 0} | ETL failed runs: {Number(analyticsQueue.failed || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  SLA Gate: {analyticsSlaGate} | Status: {analyticsSlaStatus} ({analyticsSlaReadiness}%)
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <a
                    href={analyticsHealthUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Open API Health
                  </a>
                  <a
                    href={analyticsContractsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Open API Contracts
                  </a>
                  <a
                    href={analyticsOpenApiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Open OpenAPI YAML
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">KPI Model Definitions</CardTitle>
                <CardDescription>Formulas and ownership for analytics KPIs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {analyticsKpiDefinitions.length > 0 ? (
                  <div className="space-y-2">
                    {analyticsKpiDefinitions.map((definition) => (
                      <div key={definition.key} className="rounded-md border border-border/70 p-2">
                        <p className="font-medium">{definition.label} ({definition.key})</p>
                        <p className="text-xs text-muted-foreground">{definition.description}</p>
                        <p className="text-xs">Formula: {definition.formula}</p>
                        <p className="text-xs">Unit: {definition.unit} | Owner: {definition.owner_role}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">KPI metadata is not available yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">BI Semantic Cube</CardTitle>
                <CardDescription>Cube and dictionary metadata for downstream BI.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Cube: {analyticsCubeName || '-'}</p>
                <p>Version: {analyticsCubeVersion || '-'}</p>
                <p>Artifact: {analyticsBiArtifactId}</p>
                <p className="text-xs text-muted-foreground">
                  Dictionary publication: {analyticsDictionaryPublished ? 'published' : 'pending'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Dimensions: {analyticsDimensions.length} | Measures: {analyticsMeasures.length}
                </p>
                <div className="space-y-1">
                  {analyticsDimensions.slice(0, 4).map((dimension) => (
                    <p key={`dim-${dimension.key}`} className="text-xs">
                      Dimension {dimension.key}: {dimension.source} ({dimension.grain})
                    </p>
                  ))}
                  {analyticsMeasures.slice(0, 4).map((measure) => (
                    <p key={`measure-${measure.key}`} className="text-xs">
                      Measure {measure.key}: {measure.source} [{measure.aggregation}]
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">ETL and Reconciliation Status</CardTitle>
                <CardDescription>Phase 4 reporting QA readiness indicators.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Queue - queued: {Number(analyticsQueue.queued || 0)}, running: {Number(analyticsQueue.running || 0)}, retry: {Number(analyticsQueue.retryScheduled || 0)}, completed: {Number(analyticsQueue.completed || 0)}, failed: {Number(analyticsQueue.failed || 0)}
                </p>
                <p>
                  Telemetry - completed runs: {Number(analyticsTelemetry.completed_runs || 0)}, failed runs: {Number(analyticsTelemetry.failed_runs || 0)}, success rate: {Number(analyticsTelemetry.success_rate || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last analytics refresh: {analyticsLatencyMs} ms | rolling avg (last {analyticsLatencySamples.length || 1}): {analyticsLatencyAverageMs || analyticsLatencyMs} ms
                </p>
                <div className="space-y-1">
                  {analyticsReconciliationChecks.slice(0, 5).map((check) => (
                    <p key={check.key} className="text-xs">
                      {check.passed ? 'PASS' : 'PENDING'} - {check.label}: {check.details}
                    </p>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Low stock threshold: {Number(analyticsKpiPayload?.low_stock_threshold || 0)}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={analyticsQaSignoffDone ? 'secondary' : 'default'}
                    onClick={() => {
                      void handleQaSignoff();
                    }}
                    disabled={isQaSignoffSubmitting || analyticsLoading}
                  >
                    {isQaSignoffSubmitting
                      ? 'Submitting QA Sign-off...'
                      : analyticsQaSignoffDone
                        ? 'QA Sign-off Submitted'
                        : 'Submit QA Sign-off'}
                  </Button>
                  {analyticsQaSignoffLatest ? (
                    <p className="text-xs text-muted-foreground">
                      Latest by {String(analyticsQaSignoffLatest.signed_off_by || 'unknown')}
                    </p>
                  ) : null}
                </div>
                {analyticsLoading ? <p className="text-xs text-muted-foreground">Refreshing analytics metadata...</p> : null}
                {analyticsError ? <p className="text-xs text-destructive">{analyticsError}</p> : null}
                {analyticsCompatibilityNotice ? <p className="text-xs text-muted-foreground">{analyticsCompatibilityNotice}</p> : null}
                <details className="rounded-md border border-border/70 p-2 text-xs">
                  <summary className="cursor-pointer font-medium">Error Details</summary>
                  <div className="mt-2 space-y-1">
                    {analyticsEndpointStatuses.map((endpoint) => (
                      <p key={endpoint.key}>
                        {endpoint.status === 'ok' ? 'OK' : 'ERR'} - {endpoint.label}: {endpoint.detail}
                      </p>
                    ))}
                  </div>
                </details>
              </CardContent>
            </Card>
          </div>
        ) : null}

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
              {dynamicFields.map((fieldConfig) => (
                <FieldRenderer key={fieldConfig.name} fieldConfig={fieldConfig} control={form.control} t={t} />
              ))}
            </div>

            {config.includesDimensionBlock ? <DimensionBlock control={form.control} /> : null}
            {config.includesAddressBlock ? <AddressBlock control={form.control} /> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving || fkValidationFailed}>
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
