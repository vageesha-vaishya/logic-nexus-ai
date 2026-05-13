import { useCallback, useEffect, useMemo, useRef, type RefObject, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AsyncCombobox } from '@/components/ui/async-combobox';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type WorkOrderTaskSortColumn =
  | 'task_id'
  | 'code_form_no'
  | 'ata_code'
  | 'reference_amp'
  | 'description'
  | 'category_code'
  | 'estimated_man_hours'
  | 'is_mandatory';

type SortDirection = 'asc' | 'desc';

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  modelCode?: string;
};

type ScopeContext = {
  tenantId: string;
  franchiseId: string;
  isTenantAdmin?: boolean;
  isFranchiseAdmin?: boolean;
  isPlatformAdmin?: boolean;
};

type WorkOrderTemplateCreateSectionProps = {
  formValues: Record<string, unknown>;
  formErrors: Record<string, string>;
  setFieldValue: (fieldKey: string, value: unknown) => void;
  firstFieldRef: RefObject<HTMLInputElement>;
  modalOpen: boolean;
  modalMode: 'create' | 'update';
  selectedTemplateId: string | null;
  scopedDb: unknown;
  scope: ScopeContext;
  hideCoreDetailsSection?: boolean;
  embeddedInStandardTemplate?: boolean;
  hideScopeAndTasksJsonSections?: boolean;
  hideSelectedTasksSection?: boolean;
};

const MAINTENANCE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'inspection', label: 'inspection' },
  { value: 'service', label: 'service' },
  { value: 'line', label: 'line' },
  { value: 'base', label: 'base' },
  { value: 'component', label: 'component' },
  { value: 'overhaul', label: 'overhaul' },
  { value: 'repair', label: 'repair' },
  { value: 'upgrade', label: 'upgrade' },
  { value: 'modification', label: 'modification' },
];

const DEFAULT_WORK_PACKAGE_TASK_FILTERS: Record<WorkOrderTaskSortColumn, string> = {
  task_id: '',
  code_form_no: '',
  ata_code: '',
  reference_amp: '',
  description: '',
  category_code: '',
  estimated_man_hours: '',
  is_mandatory: '',
};

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function WorkOrderTemplateCreateSection({
  formValues,
  formErrors,
  setFieldValue,
  firstFieldRef,
  modalOpen,
  modalMode,
  selectedTemplateId,
  scopedDb,
  scope,
  hideCoreDetailsSection = false,
  embeddedInStandardTemplate = false,
  hideScopeAndTasksJsonSections = false,
  hideSelectedTasksSection = false,
}: WorkOrderTemplateCreateSectionProps) {
  const activeTenantId = String(formValues.tenant_id ?? scope.tenantId ?? '').trim();
  const activeFranchiseId = String(formValues.franchise_id ?? scope.franchiseId ?? '').trim();
  const canEditTenant = Boolean(scope.isPlatformAdmin);
  const canEditFranchise = (Boolean(scope.isTenantAdmin) || Boolean(scope.isPlatformAdmin)) && !scope.isFranchiseAdmin;
  const setFieldValueRef = useRef(setFieldValue);
  useEffect(() => {
    setFieldValueRef.current = setFieldValue;
  }, [setFieldValue]);
  const applyFranchiseScope = useCallback((query: any) => {
    if (scope.isTenantAdmin) {
      return query;
    }
    if (activeFranchiseId) {
      if (typeof query?.or === 'function') {
        return query.or(`franchise_id.eq.${activeFranchiseId},franchise_id.is.null`);
      }
      if (typeof query?.eq === 'function') {
        return query.eq('franchise_id', activeFranchiseId);
      }
      return query;
    }
    if (typeof query?.is === 'function') {
      return query.is('franchise_id', null);
    }
    return query;
  }, [activeFranchiseId, scope.isTenantAdmin]);
  const [workOrderTemplateTaskTemplates, setWorkOrderTemplateTaskTemplates] = useState<Record<string, unknown>[]>([]);
  const [workOrderTemplateTaskTemplatesLoading, setWorkOrderTemplateTaskTemplatesLoading] = useState(false);
  const [workOrderTemplateTaskTemplatesError, setWorkOrderTemplateTaskTemplatesError] = useState('');
  const taskTemplateOptionsCacheRef = useRef(new Map<string, Record<string, unknown>[]>());
  const selectedTaskHydrationKeyRef = useRef('');
  const [workOrderTemplateAircraftModelOptions, setWorkOrderTemplateAircraftModelOptions] = useState<SelectOption[]>([]);
  const [workOrderTemplateAircraftModelOptionsLoading, setWorkOrderTemplateAircraftModelOptionsLoading] = useState(false);
  const [workOrderTemplateAircraftModelOptionsError, setWorkOrderTemplateAircraftModelOptionsError] = useState('');
  const [tenantOptions, setTenantOptions] = useState<SelectOption[]>([]);
  const [tenantOptionsLoading, setTenantOptionsLoading] = useState(false);
  const [tenantOptionsError, setTenantOptionsError] = useState('');
  const [franchiseOptions, setFranchiseOptions] = useState<SelectOption[]>([]);
  const [franchiseOptionsLoading, setFranchiseOptionsLoading] = useState(false);
  const [franchiseOptionsError, setFranchiseOptionsError] = useState('');
  const [workOrderTemplateSelectedTaskIds, setWorkOrderTemplateSelectedTaskIds] = useState<string[]>([]);
  const [workOrderTemplateSelectionInitialized, setWorkOrderTemplateSelectionInitialized] = useState(false);
  const [workOrderTemplateTaskSortColumn, setWorkOrderTemplateTaskSortColumn] = useState<WorkOrderTaskSortColumn>('task_id');
  const [workOrderTemplateTaskSortDirection, setWorkOrderTemplateTaskSortDirection] = useState<SortDirection>('asc');

  const buildAuthHeaders = useCallback(async (franchiseOverride?: string, tenantOverride?: string) => {
    const headers: Record<string, string> = {};
    const { data } = await supabase.auth.getSession();
    const token = String(data.session?.access_token || '').trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const resolvedTenantId = String(tenantOverride ?? scope.tenantId ?? '').trim();
    if (resolvedTenantId) {
      headers['x-tenant-id'] = resolvedTenantId;
    }
    const resolvedFranchiseId = String(franchiseOverride ?? scope.franchiseId ?? '').trim();
    if (resolvedFranchiseId) {
      headers['x-franchise-id'] = resolvedFranchiseId;
    }
    return headers;
  }, [scope.franchiseId, scope.tenantId]);
  const [workOrderTemplateTaskFilters, setWorkOrderTemplateTaskFilters] = useState<Record<WorkOrderTaskSortColumn, string>>(
    DEFAULT_WORK_PACKAGE_TASK_FILTERS,
  );
  const resolveWorkOrderTaskTemplateId = useCallback((taskTemplate: Record<string, unknown>): string => {
    const primaryId = String(taskTemplate.id || '').trim();
    if (primaryId) {
      return primaryId;
    }
    const fallbackId = String(taskTemplate.task_template_id || '').trim();
    if (fallbackId) {
      return fallbackId;
    }
    const sequenceId = String(taskTemplate.tt_sequence || taskTemplate.task_id || '').trim();
    return sequenceId;
  }, []);

  const resolveWorkOrderTaskTemplateKeys = useCallback((taskTemplate: Record<string, unknown>): string[] => {
    const values = [
      String(taskTemplate.id || '').trim(),
      String(taskTemplate.task_template_id || '').trim(),
      String(taskTemplate.tt_sequence || '').trim(),
      String(taskTemplate.task_id || '').trim(),
    ];
    return Array.from(new Set(values.filter((value) => value.length > 0)));
  }, []);

  const parseTaskTemplateIdsFromTasksJson = useCallback((raw: unknown): string[] => {
    const normalized = (() => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return [];
        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    })();
    return Array.from(
      new Set(
        normalized
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return '';
            const row = entry as Record<string, unknown>;
            return String(row.task_template_id || row.taskTemplateId || row.id || row.tt_sequence || '').trim();
          })
          .filter((value) => value.length > 0),
      ),
    );
  }, []);

  const loadTenantAndFranchiseOptions = useCallback(async () => {
    if (!scope.tenantId || !scopedDb) {
      setTenantOptions(scope.tenantId ? [{ value: scope.tenantId, label: scope.tenantId }] : []);
      setTenantOptionsError('');
      setFranchiseOptions([]);
      setFranchiseOptionsError('');
      return;
    }
    setTenantOptionsLoading(true);
    setTenantOptionsError('');
    setFranchiseOptionsLoading(true);
    setFranchiseOptionsError('');
    try {
      let tenantQuery = (scopedDb as any)
        .from('tenants', Boolean(scope.isPlatformAdmin))
        .select('id,name,is_active')
        .order('name', { ascending: true });
      if (!scope.isPlatformAdmin) {
        tenantQuery = tenantQuery.eq('id', scope.tenantId).limit(1);
      } else {
        tenantQuery = tenantQuery.eq('is_active', true);
      }
      const { data: tenantRows, error: tenantError } = await tenantQuery;
      if (tenantError) {
        throw new Error(String(tenantError.message || 'Failed to load tenant'));
      }
      const tenantSelectOptions = (Array.isArray(tenantRows) ? tenantRows : [])
        .map((row) => {
          const record = row as Record<string, unknown>;
          return { value: String(record.id || ''), label: String(record.name || '') };
        })
        .filter((option) => option.value && option.label);
      setTenantOptions(tenantSelectOptions);
      setTenantOptionsError('');

      const { data: franchiseRows, error: franchiseError } = await (scopedDb as any)
        .from('franchises', Boolean(scope.isTenantAdmin || scope.isPlatformAdmin))
        .select('id,name,is_active,tenant_id')
        .eq('tenant_id', activeTenantId || scope.tenantId)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (franchiseError) {
        throw new Error(String(franchiseError.message || 'Failed to load franchise options'));
      }
      const options = (Array.isArray(franchiseRows) ? franchiseRows : [])
        .map((row) => {
          const record = row as Record<string, unknown>;
          return { value: String(record.id || ''), label: String(record.name || '') };
        })
        .filter((option) => option.value && option.label);
      setFranchiseOptions(options);
      setFranchiseOptionsError('');
    } catch (error) {
      setTenantOptions(scope.tenantId ? [{ value: scope.tenantId, label: scope.tenantId }] : []);
      setTenantOptionsError(String((error as Error).message || 'Failed to load tenant options'));
      setFranchiseOptions([]);
      setFranchiseOptionsError(String((error as Error).message || 'Failed to load franchise options'));
    } finally {
      setTenantOptionsLoading(false);
      setFranchiseOptionsLoading(false);
    }
  }, [activeTenantId, scope.isPlatformAdmin, scope.isTenantAdmin, scope.tenantId, scopedDb]);

  const loadWorkOrderTemplateTaskTemplates = useCallback(async (aircraftModelId: string) => {
    const normalizedModelId = String(aircraftModelId || '').trim();
    if (!activeTenantId || !normalizedModelId) {
      setWorkOrderTemplateTaskTemplates([]);
      setWorkOrderTemplateTaskTemplatesError('');
      return;
    }
    const cacheKey = `${activeTenantId}:${activeFranchiseId || 'franchise-null'}:${normalizedModelId}`;
    const cachedRows = taskTemplateOptionsCacheRef.current.get(cacheKey);
    if (cachedRows) {
      setWorkOrderTemplateTaskTemplates(cachedRows);
      setWorkOrderTemplateTaskTemplatesError('');
      return;
    }
    setWorkOrderTemplateTaskTemplatesLoading(true);
    setWorkOrderTemplateTaskTemplatesError('');
    try {
      const query = new URLSearchParams({
        tenant_id: activeTenantId,
        aircraft_model_id: normalizedModelId,
      });
      if (activeFranchiseId) {
        query.set('franchise_id', activeFranchiseId);
      }
      const response = await fetch(`/api/v2/amro/work-order-templates/task-template-options?${query.toString()}`, {
        method: 'GET',
        headers: await buildAuthHeaders(activeFranchiseId, activeTenantId),
      });
      if (!response.ok) {
        throw new Error(`Failed to load task templates (status ${response.status})`);
      }
      const payload = (await response.json()) as Record<string, unknown>;
      const output = payload.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : {};
      const rows = (() => {
        if (Array.isArray(output.records)) {
          return output.records as Record<string, unknown>[];
        }
        if (Array.isArray(payload.data)) {
          return payload.data as Record<string, unknown>[];
        }
        if (Array.isArray(payload.records)) {
          return payload.records as Record<string, unknown>[];
        }
        return [];
      })();
      taskTemplateOptionsCacheRef.current.set(cacheKey, rows);
      setWorkOrderTemplateTaskTemplates(rows);
      setWorkOrderTemplateTaskTemplatesError('');
    } catch (error) {
      setWorkOrderTemplateTaskTemplates([]);
      setWorkOrderTemplateTaskTemplatesError(String((error as Error).message || 'Failed to load task templates'));
    } finally {
      setWorkOrderTemplateTaskTemplatesLoading(false);
    }
  }, [activeFranchiseId, activeTenantId, buildAuthHeaders]);

  const loadWorkOrderTemplateAircraftModelOptions = useCallback(async () => {
    if (!activeTenantId) {
      setWorkOrderTemplateAircraftModelOptions([]);
      setWorkOrderTemplateAircraftModelOptionsError('');
      return;
    }
    setWorkOrderTemplateAircraftModelOptionsLoading(true);
    setWorkOrderTemplateAircraftModelOptionsError('');
    try {
      const query = new URLSearchParams({
        tenant_id: activeTenantId,
      });
      if (activeFranchiseId) {
        query.set('franchise_id', activeFranchiseId);
      }
      const response = await fetch(`/api/v2/amro/work-order-templates/model-options?${query.toString()}`, {
        method: 'GET',
        headers: await buildAuthHeaders(activeFranchiseId, activeTenantId),
      });
      if (!response.ok) {
        throw new Error(`Failed to load aircraft models (status ${response.status})`);
      }
      const payload = (await response.json()) as Record<string, unknown>;
      const records = Array.isArray(payload.data)
        ? (payload.data as Record<string, unknown>[])
        : payload.output && typeof payload.output === 'object' && Array.isArray((payload.output as Record<string, unknown>).records)
          ? ((payload.output as Record<string, unknown>).records as Record<string, unknown>[])
          : [];
      const options = records
        .map((record) => {
          const modelId = String(record.id || '').trim();
          const value = modelId;
          if (!value) {
            return null;
          }
          const name = String(record.name || '').trim();
          const code = String(record.model_code || '').trim();
          const label = name && code && name !== code ? `${name} (${code})` : name || code || value;
          const active = String(record.is_active ?? 'true').toLowerCase() !== 'false';
          if (!active) {
            return null;
          }
          return { value, label, modelCode: code || name || modelId };
        })
        .filter(Boolean) as SelectOption[];
      setWorkOrderTemplateAircraftModelOptions(options);
    } catch (error) {
      setWorkOrderTemplateAircraftModelOptions([]);
      setWorkOrderTemplateAircraftModelOptionsError(String((error as Error).message || 'Failed to load aircraft models'));
    } finally {
      setWorkOrderTemplateAircraftModelOptionsLoading(false);
    }
  }, [activeFranchiseId, activeTenantId, buildAuthHeaders]);

  const previousTenantIdRef = useRef(activeTenantId);
  const previousFranchiseIdRef = useRef(activeFranchiseId);

  useEffect(() => {
    if (!modalOpen) {
      selectedTaskHydrationKeyRef.current = '';
      return;
    }
    if (!String(formValues.tenant_id || '').trim() && scope.tenantId) {
      setFieldValue('tenant_id', scope.tenantId);
    }
    if (!String(formValues.franchise_id || '').trim() && scope.franchiseId) {
      setFieldValue('franchise_id', scope.franchiseId);
    }
  }, [formValues.franchise_id, formValues.tenant_id, modalOpen, scope.franchiseId, scope.tenantId, setFieldValue]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    void loadTenantAndFranchiseOptions();
  }, [loadTenantAndFranchiseOptions, modalOpen]);

  useEffect(() => {
    if (!modalOpen) {
      previousTenantIdRef.current = activeTenantId;
      return;
    }
    if (previousTenantIdRef.current === activeTenantId) {
      return;
    }
    previousTenantIdRef.current = activeTenantId;
    setFieldValue('franchise_id', '');
    setFieldValue('model_id', '');
    setFieldValue('aircraft_model', '');
    setFieldValue('selected_task_template_ids', []);
    setFieldValue('tasks_json', '[]');
    setFranchiseOptions([]);
    taskTemplateOptionsCacheRef.current.clear();
    setWorkOrderTemplateTaskTemplates([]);
    setWorkOrderTemplateSelectedTaskIds([]);
    void loadTenantAndFranchiseOptions();
  }, [activeTenantId, loadTenantAndFranchiseOptions, modalOpen, setFieldValue]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    if (activeFranchiseId) {
      return;
    }
    const preferred = scope.franchiseId && franchiseOptions.some((item) => item.value === scope.franchiseId)
      ? scope.franchiseId
      : (franchiseOptions[0]?.value || '');
    if (preferred) {
      setFieldValue('franchise_id', preferred);
    }
  }, [activeFranchiseId, franchiseOptions, modalOpen, scope.franchiseId, setFieldValue]);

  useEffect(() => {
    if (!modalOpen) {
      previousFranchiseIdRef.current = activeFranchiseId;
      return;
    }
    if (previousFranchiseIdRef.current === activeFranchiseId) {
      return;
    }
    previousFranchiseIdRef.current = activeFranchiseId;
    setFieldValue('model_id', '');
    setFieldValue('aircraft_model', '');
    setFieldValue('selected_task_template_ids', []);
    setFieldValue('tasks_json', '[]');
    taskTemplateOptionsCacheRef.current.clear();
    setWorkOrderTemplateTaskTemplates([]);
    setWorkOrderTemplateSelectedTaskIds([]);
  }, [activeFranchiseId, modalOpen, setFieldValue]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    void loadWorkOrderTemplateAircraftModelOptions();
  }, [loadWorkOrderTemplateAircraftModelOptions, modalOpen]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    const currentModelId = String(formValues.model_id ?? '').trim();
    if (!currentModelId) {
      setWorkOrderTemplateTaskTemplates([]);
      setWorkOrderTemplateTaskTemplatesError('');
      return;
    }
    void loadWorkOrderTemplateTaskTemplates(currentModelId);
  }, [formValues.model_id, loadWorkOrderTemplateTaskTemplates, modalOpen]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    const bootstrapSelectionFromForm = () => {
      const fromTasksJson = parseTaskTemplateIdsFromTasksJson(formValues.tasks_json);
      const fromSelectedList = (() => {
        const raw = formValues.selected_task_template_ids;
        if (!Array.isArray(raw)) return [] as string[];
        return raw
          .map((value) => String(value || '').trim())
          .filter((value) => value.length > 0);
      })();
      const nextSelection = Array.from(new Set([...fromSelectedList, ...fromTasksJson]));
      setWorkOrderTemplateSelectedTaskIds(nextSelection);
      setWorkOrderTemplateSelectionInitialized(true);
    };

    if (modalMode !== 'update' || !selectedTemplateId || !scope.tenantId || !scopedDb) {
      selectedTaskHydrationKeyRef.current = '';
      bootstrapSelectionFromForm();
      return;
    }

    if (!activeFranchiseId && scope.franchiseId) {
      return;
    }

    const hydrationKey = [
      modalMode,
      selectedTemplateId,
      scope.tenantId,
      scope.isTenantAdmin ? 'tenant-admin' : 'scoped',
      activeFranchiseId || 'franchise-null',
    ].join(':');
    if (selectedTaskHydrationKeyRef.current === hydrationKey) {
      return;
    }
    selectedTaskHydrationKeyRef.current = hydrationKey;

    let cancelled = false;
    const loadSelectedTaskTemplateIds = async () => {
      try {
        let query = (scopedDb as any)
          .from('work_order_template_task_templates')
          .select('task_template_id,model_id')
          .eq('tenant_id', scope.tenantId)
          .eq('work_order_template_id', selectedTemplateId);
        query = applyFranchiseScope(query);
        const { data, error } = await query;
        if (error) {
          throw new Error(String(error.message || 'Failed to load selected task templates'));
        }
        const relationIds = (Array.isArray(data) ? data : [])
          .map((row) => String((row as Record<string, unknown>).task_template_id || '').trim())
          .filter((value) => value.length > 0);
        const relationModelIds = Array.from(new Set(
          (Array.isArray(data) ? data : [])
            .map((row) => String((row as Record<string, unknown>).model_id || '').trim())
            .filter((value) => value.length > 0),
        ));
        const relationModelId = relationModelIds.length === 1 ? relationModelIds[0] : '';
        const fallbackIds = parseTaskTemplateIdsFromTasksJson(formValues.tasks_json);
        const currentModelId = String(formValues.model_id ?? '').trim();
        const modelChangedFromRelation = Boolean(currentModelId && relationModelId && currentModelId !== relationModelId);
        const nextSelection = modelChangedFromRelation
          ? Array.from(new Set([...fallbackIds]))
          : Array.from(new Set([...relationIds, ...fallbackIds]));
        if (!cancelled) {
          if (!currentModelId && relationModelId) {
            const mappedOption = workOrderTemplateAircraftModelOptions.find((option) => option.value === relationModelId);
            setFieldValue('model_id', relationModelId);
            if (!String(formValues.aircraft_model ?? '').trim()) {
              setFieldValue('aircraft_model', mappedOption?.modelCode || mappedOption?.label || relationModelId);
            }
          }
          setWorkOrderTemplateSelectedTaskIds(nextSelection);
          setWorkOrderTemplateSelectionInitialized(true);
        }
      } catch {
        if (!cancelled) {
          bootstrapSelectionFromForm();
        }
      }
    };
    void loadSelectedTaskTemplateIds();
    return () => {
      cancelled = true;
    };
  }, [
    activeFranchiseId,
    formValues.aircraft_model,
    formValues.model_id,
    formValues.tasks_json,
    modalMode,
    modalOpen,
    parseTaskTemplateIdsFromTasksJson,
    scope.franchiseId,
    scope.isTenantAdmin,
    scope.tenantId,
    scopedDb,
    selectedTemplateId,
    setFieldValue,
    workOrderTemplateAircraftModelOptions,
    applyFranchiseScope,
  ]);

  const workOrderTemplateAircraftModelSelectOptions = useMemo<SelectOption[]>(() => {
    const selectedModelId = String(formValues.model_id ?? '').trim();
    const selectedModelToken = String(formValues.aircraft_model ?? '').trim();
    if (!selectedModelId && !selectedModelToken) {
      return workOrderTemplateAircraftModelOptions;
    }
    if (selectedModelId && workOrderTemplateAircraftModelOptions.some((option) => option.value === selectedModelId)) {
      return workOrderTemplateAircraftModelOptions;
    }
    const matchByToken = selectedModelToken
      ? workOrderTemplateAircraftModelOptions.find((option) => {
        const optionCode = String(option.modelCode || '').trim().toLowerCase();
        const optionLabel = String(option.label || '').trim().toLowerCase();
        const normalizedToken = selectedModelToken.toLowerCase();
        return optionCode === normalizedToken || optionLabel === normalizedToken;
      })
      : null;
    if (matchByToken) {
      return workOrderTemplateAircraftModelOptions;
    }
    const fallbackValue = selectedModelId || selectedModelToken;
    return [{ value: fallbackValue, label: selectedModelToken || selectedModelId, modelCode: selectedModelToken || selectedModelId }, ...workOrderTemplateAircraftModelOptions];
  }, [formValues.aircraft_model, formValues.model_id, workOrderTemplateAircraftModelOptions]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    const currentModelId = String(formValues.model_id ?? '').trim();
    if (currentModelId) {
      return;
    }
    const currentModelToken = String(formValues.aircraft_model ?? '').trim().toLowerCase();
    if (currentModelToken) {
      const resolvedOption = workOrderTemplateAircraftModelSelectOptions.find((option) => {
        const optionId = String(option.value || '').trim().toLowerCase();
        const optionCode = String(option.modelCode || '').trim().toLowerCase();
        const optionLabel = String(option.label || '').trim().toLowerCase();
        return optionId === currentModelToken || optionCode === currentModelToken || optionLabel === currentModelToken;
      });
      if (resolvedOption?.value) {
        setFieldValue('model_id', resolvedOption.value);
        if (!String(formValues.aircraft_model ?? '').trim()) {
          setFieldValue('aircraft_model', resolvedOption.modelCode || resolvedOption.label || resolvedOption.value);
        }
        return;
      }
      if (modalMode === 'update') {
        return;
      }
    }
    if (modalMode === 'update') {
      return;
    }
    const firstOption = workOrderTemplateAircraftModelSelectOptions[0];
    if (!firstOption?.value) {
      return;
    }
    setFieldValue('model_id', firstOption.value);
    setFieldValue('aircraft_model', firstOption.modelCode || firstOption.label || firstOption.value);
  }, [formValues.aircraft_model, formValues.model_id, modalMode, modalOpen, setFieldValue, workOrderTemplateAircraftModelSelectOptions]);

  const selectedWorkOrderAircraftModelTaskItems = useMemo(() => {
    return workOrderTemplateTaskTemplates;
  }, [workOrderTemplateTaskTemplates]);

  const selectedWorkOrderAircraftModelTaskRows = useMemo(() => {
    const filtered = selectedWorkOrderAircraftModelTaskItems.filter((taskTemplate) => {
      const resolveValue = (column: WorkOrderTaskSortColumn): string => {
        if (column === 'is_mandatory') {
          return typeof taskTemplate.is_mandatory === 'boolean' ? String(taskTemplate.is_mandatory) : '';
        }
        if (column === 'task_id') {
          return String(taskTemplate.tt_sequence ?? taskTemplate.task_template_id ?? taskTemplate.task_id ?? '').toLowerCase();
        }
        return String(taskTemplate[column] ?? '').toLowerCase();
      };
      return (Object.entries(workOrderTemplateTaskFilters) as Array<[WorkOrderTaskSortColumn, string]>).every(([column, rawFilter]) => {
        const normalizedFilter = rawFilter.trim().toLowerCase();
        if (!normalizedFilter) {
          return true;
        }
        return resolveValue(column).includes(normalizedFilter);
      });
    });
    return [...filtered].sort((left, right) => {
      const leftId = resolveWorkOrderTaskTemplateId(left);
      const rightId = resolveWorkOrderTaskTemplateId(right);
      const leftSelected = leftId.length > 0 && workOrderTemplateSelectedTaskIds.includes(leftId);
      const rightSelected = rightId.length > 0 && workOrderTemplateSelectedTaskIds.includes(rightId);
      if (leftSelected !== rightSelected) {
        return leftSelected ? -1 : 1;
      }
      const leftValue = workOrderTemplateTaskSortColumn === 'is_mandatory'
        ? String(typeof left.is_mandatory === 'boolean' ? left.is_mandatory : '').toLowerCase()
        : workOrderTemplateTaskSortColumn === 'task_id'
          ? String(left.tt_sequence ?? left.task_template_id ?? left.task_id ?? '').toLowerCase()
          : String(left[workOrderTemplateTaskSortColumn] ?? '').toLowerCase();
      const rightValue = workOrderTemplateTaskSortColumn === 'is_mandatory'
        ? String(typeof right.is_mandatory === 'boolean' ? right.is_mandatory : '').toLowerCase()
        : workOrderTemplateTaskSortColumn === 'task_id'
          ? String(right.tt_sequence ?? right.task_template_id ?? right.task_id ?? '').toLowerCase()
          : String(right[workOrderTemplateTaskSortColumn] ?? '').toLowerCase();
      if (leftValue === rightValue) {
        return 0;
      }
      const result = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: 'base' });
      return workOrderTemplateTaskSortDirection === 'asc' ? result : -result;
    });
  }, [
    resolveWorkOrderTaskTemplateId,
    selectedWorkOrderAircraftModelTaskItems,
    workOrderTemplateSelectedTaskIds,
    workOrderTemplateTaskFilters,
    workOrderTemplateTaskSortColumn,
    workOrderTemplateTaskSortDirection,
  ]);

  const selectedWorkOrderAircraftModelTaskRowIds = useMemo(
    () => selectedWorkOrderAircraftModelTaskRows
      .map((taskTemplate) => resolveWorkOrderTaskTemplateId(taskTemplate))
      .filter((value) => value.length > 0),
    [resolveWorkOrderTaskTemplateId, selectedWorkOrderAircraftModelTaskRows],
  );

  const allWorkOrderTemplateTasksSelected = selectedWorkOrderAircraftModelTaskRowIds.length > 0
    && selectedWorkOrderAircraftModelTaskRowIds.every((id) => workOrderTemplateSelectedTaskIds.includes(id));

  const someWorkOrderTemplateTasksSelected = selectedWorkOrderAircraftModelTaskRowIds.some((id) => workOrderTemplateSelectedTaskIds.includes(id))
    && !allWorkOrderTemplateTasksSelected;

  const toggleWorkOrderTemplateTaskSort = useCallback((column: WorkOrderTaskSortColumn) => {
    if (workOrderTemplateTaskSortColumn === column) {
      setWorkOrderTemplateTaskSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setWorkOrderTemplateTaskSortColumn(column);
    setWorkOrderTemplateTaskSortDirection('asc');
  }, [workOrderTemplateTaskSortColumn]);

  const setWorkOrderTemplateTaskFilterValue = useCallback((column: WorkOrderTaskSortColumn, value: string) => {
    setWorkOrderTemplateTaskFilters((previous) => ({ ...previous, [column]: value }));
  }, []);

  const getWorkOrderTaskSortAriaLabel = useCallback((column: WorkOrderTaskSortColumn, label: string) => {
    const state = workOrderTemplateTaskSortColumn === column ? workOrderTemplateTaskSortDirection : 'none';
    return `Sort ${label} (${state})`;
  }, [workOrderTemplateTaskSortColumn, workOrderTemplateTaskSortDirection]);

  const taskTemplateById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    workOrderTemplateTaskTemplates.forEach((taskTemplate) => {
      const canonicalId = resolveWorkOrderTaskTemplateId(taskTemplate);
      const keys = resolveWorkOrderTaskTemplateKeys(taskTemplate);
      if (canonicalId) {
        map.set(canonicalId, taskTemplate);
      }
      keys.forEach((key) => {
        if (!map.has(key)) {
          map.set(key, taskTemplate);
        }
      });
    });
    return map;
  }, [resolveWorkOrderTaskTemplateId, resolveWorkOrderTaskTemplateKeys, workOrderTemplateTaskTemplates]);

  const taskTemplateAliasToId = useMemo(() => {
    const map = new Map<string, string>();
    workOrderTemplateTaskTemplates.forEach((taskTemplate) => {
      const canonicalId = resolveWorkOrderTaskTemplateId(taskTemplate);
      if (!canonicalId) {
        return;
      }
      resolveWorkOrderTaskTemplateKeys(taskTemplate).forEach((key) => {
        map.set(key, canonicalId);
      });
    });
    return map;
  }, [resolveWorkOrderTaskTemplateId, resolveWorkOrderTaskTemplateKeys, workOrderTemplateTaskTemplates]);

  useEffect(() => {
    if (!workOrderTemplateSelectionInitialized) {
      return;
    }
    const validIds = new Set(taskTemplateById.keys());
    if (validIds.size === 0) {
      return;
    }
    setWorkOrderTemplateSelectedTaskIds((previous) => {
      const nextSelectedIds = previous.filter((id) => validIds.has(id));
      if (nextSelectedIds.length === previous.length) {
        return previous;
      }
      return nextSelectedIds;
    });
  }, [taskTemplateById, workOrderTemplateSelectionInitialized]);

  useEffect(() => {
    if (!workOrderTemplateSelectionInitialized || taskTemplateAliasToId.size === 0) {
      return;
    }
    setWorkOrderTemplateSelectedTaskIds((previous) => {
      const remapped = previous.map((id) => taskTemplateAliasToId.get(id) || id);
      const next = Array.from(new Set(remapped.filter((id) => id.length > 0)));
      if (next.length === previous.length && next.every((id, index) => id === previous[index])) {
        return previous;
      }
      return next;
    });
  }, [taskTemplateAliasToId, workOrderTemplateSelectionInitialized]);

  const resolveSelectedWorkOrderTaskPayload = useCallback((selectedIds: string[]) => {
    return selectedIds
      .map((id) => String(id || '').trim())
      .filter((id) => id.length > 0)
      .map((id) => {
        const taskTemplate = taskTemplateById.get(id);
        if (!taskTemplate) {
          return {
            task_template_id: id,
          };
        }
        return {
          task_template_id: id,
          task_id: taskTemplate.tt_sequence ?? taskTemplate.task_template_id ?? taskTemplate.task_id ?? null,
          code_form_no: taskTemplate.code_form_no ?? null,
          ata_code: taskTemplate.ata_code ?? null,
          reference_amp: taskTemplate.reference_amp ?? null,
          description: taskTemplate.description ?? null,
        };
      });
  }, [taskTemplateById]);

  const toggleWorkOrderTemplateTaskSelection = useCallback((rowId: string, checked: boolean) => {
    setWorkOrderTemplateSelectedTaskIds((previous) => {
      return checked
        ? (previous.includes(rowId) ? previous : [...previous, rowId])
        : previous.filter((id) => id !== rowId);
    });
  }, []);

  const toggleWorkOrderTemplateSelectAllTasks = useCallback((checked: boolean) => {
    setWorkOrderTemplateSelectedTaskIds((previous) => {
      return checked
        ? Array.from(new Set([...previous, ...selectedWorkOrderAircraftModelTaskRowIds]))
        : previous.filter((id) => !selectedWorkOrderAircraftModelTaskRowIds.includes(id));
    });
  }, [selectedWorkOrderAircraftModelTaskRowIds]);

  useEffect(() => {
    setFieldValueRef.current('tasks_json', JSON.stringify(resolveSelectedWorkOrderTaskPayload(workOrderTemplateSelectedTaskIds)));
    setFieldValueRef.current('selected_task_template_ids', workOrderTemplateSelectedTaskIds);
  }, [resolveSelectedWorkOrderTaskPayload, workOrderTemplateSelectedTaskIds]);

  const selectedWorkOrderTaskPayload = useMemo(() => {
    return resolveSelectedWorkOrderTaskPayload(workOrderTemplateSelectedTaskIds);
  }, [resolveSelectedWorkOrderTaskPayload, workOrderTemplateSelectedTaskIds]);

  useEffect(() => {
    if (!workOrderTemplateSelectionInitialized) {
      return;
    }
    const nextValue = JSON.stringify(selectedWorkOrderTaskPayload);
    const currentValue = (() => {
      const raw = formValues.tasks_json;
      if (typeof raw === 'string') {
        return raw.trim();
      }
      if (Array.isArray(raw) || (raw && typeof raw === 'object')) {
        try {
          return JSON.stringify(raw);
        } catch {
          return '';
        }
      }
      return '';
    })();
    if (nextValue !== currentValue) {
      setFieldValue('tasks_json', nextValue);
    }
    const existingSelectedIds = (() => {
      const raw = formValues.selected_task_template_ids;
      if (!Array.isArray(raw)) {
        return [];
      }
      return raw
        .map((item) => String(item || '').trim())
        .filter((item) => item.length > 0);
    })();
    const existingSignature = existingSelectedIds.join('|');
    const nextSignature = workOrderTemplateSelectedTaskIds.join('|');
    if (existingSignature !== nextSignature) {
      setFieldValue('selected_task_template_ids', workOrderTemplateSelectedTaskIds);
    }
  }, [formValues.selected_task_template_ids, formValues.tasks_json, selectedWorkOrderTaskPayload, setFieldValue, workOrderTemplateSelectionInitialized, workOrderTemplateSelectedTaskIds]);

  useEffect(() => {
    if (!modalOpen) {
      setWorkOrderTemplateSelectedTaskIds([]);
      setWorkOrderTemplateSelectionInitialized(false);
      setWorkOrderTemplateTaskSortColumn('task_id');
      setWorkOrderTemplateTaskSortDirection('asc');
      setWorkOrderTemplateTaskFilters(DEFAULT_WORK_PACKAGE_TASK_FILTERS);
    }
  }, [modalOpen]);

  return (
    <div className={cn(
      'space-y-3 text-[12px]',
      embeddedInStandardTemplate ? '' : 'rounded-md bg-[#08a8bd] p-3',
    )}>
      {!embeddedInStandardTemplate ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-white">
          <p className="font-semibold">Work Package Template Registry</p>
          <div className="flex items-center gap-2 text-[11px]">
            <Users className="h-3.5 w-3.5" />
            <span>Template authoring mode</span>
            <span>CRUD active</span>
          </div>
        </div>
      ) : null}
      <div className="grid gap-3">
        {!hideCoreDetailsSection ? (
        <section className="overflow-hidden rounded bg-white">
          <div className="border-b border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700">Work Package Details</div>
          <div className="grid gap-2 p-3 lg:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="wpt-tenant-id" className="text-[12px] font-medium text-slate-700">Tenant</Label>
              <Select
                value={activeTenantId}
                onValueChange={(value) => setFieldValue('tenant_id', value)}
                disabled={!canEditTenant || tenantOptionsLoading}
              >
                <SelectTrigger id="wpt-tenant-id" className={cn('h-8 border-slate-300 px-2 text-[12px] text-slate-800', !canEditTenant && 'bg-slate-100')}>
                  <SelectValue placeholder={tenantOptionsLoading ? 'Loading tenants...' : 'Select tenant'} />
                </SelectTrigger>
                <SelectContent>
                  {tenantOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tenantOptionsError ? <p className="mdm-template-danger">{tenantOptionsError}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="wpt-franchise-id" className="text-[12px] font-medium text-slate-700">Franchise</Label>
              <AsyncCombobox
                value={activeFranchiseId}
                displayValue={franchiseOptions.find((item) => item.value === activeFranchiseId)?.label || ''}
                onChange={(value) => setFieldValue('franchise_id', value)}
                disabled={!canEditFranchise || franchiseOptionsLoading}
                placeholder={franchiseOptionsLoading ? 'Loading franchises...' : 'Select franchise'}
                loader={async (search: string) => {
                  const token = search.trim().toLowerCase();
                  return franchiseOptions
                    .filter((item) => !token || item.label.toLowerCase().includes(token))
                    .map((item) => ({ label: item.label, value: item.value }));
                }}
              />
              {franchiseOptionsError ? <p className="mdm-template-danger">{franchiseOptionsError}</p> : null}
              {!activeFranchiseId ? <p className="mdm-template-danger">Franchise is required</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="wpt-template-code" className="text-[12px] font-medium text-slate-700">Template Code</Label>
              <Input
                id="wpt-template-code"
                ref={firstFieldRef}
                value={String(formValues.template_code ?? '')}
                onChange={(event) => setFieldValue('template_code', event.target.value)}
                className={cn('h-8 border-slate-300 bg-white px-2 text-[12px] text-slate-800', formErrors.template_code && 'border-destructive')}
                aria-invalid={Boolean(formErrors.template_code)}
                placeholder="WP-LINE-001"
              />
              {formErrors.template_code ? <p className="mdm-template-danger">{formErrors.template_code}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="wpt-template-name" className="text-[12px] font-medium text-slate-700">Template Name</Label>
              <Input
                id="wpt-template-name"
                value={String(formValues.template_name ?? '')}
                onChange={(event) => setFieldValue('template_name', event.target.value)}
                className={cn('h-8 border-slate-300 bg-white px-2 text-[12px] text-slate-800', formErrors.template_name && 'border-destructive')}
                aria-invalid={Boolean(formErrors.template_name)}
                placeholder="Line Check Package"
              />
              {formErrors.template_name ? <p className="mdm-template-danger">{formErrors.template_name}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="wpt-version" className="text-[12px] font-medium text-slate-700">Version</Label>
              <Input
                id="wpt-version"
                type="number"
                min={1}
                value={String(formValues.version ?? '')}
                onChange={(event) => setFieldValue('version', event.target.value)}
                className={cn('h-8 border-slate-300 bg-white px-2 text-[12px] text-slate-800', formErrors.version && 'border-destructive')}
                aria-invalid={Boolean(formErrors.version)}
                placeholder="1"
              />
              {formErrors.version ? <p className="mdm-template-danger">{formErrors.version}</p> : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="wpt-aircraft-model" className="text-[12px] font-medium text-slate-700">Aircraft Model</Label>
              <select
                id="wpt-aircraft-model"
                value={String(formValues.model_id ?? '')}
                onChange={(event) => {
                  const selectedModelId = String(event.target.value || '').trim();
                  const option = workOrderTemplateAircraftModelSelectOptions.find((entry) => entry.value === selectedModelId);
                  const currentModelId = String(formValues.model_id ?? '').trim();
                  const isModelChanged = currentModelId !== selectedModelId;
                  setFieldValue('model_id', selectedModelId);
                  setFieldValue('aircraft_model', option?.modelCode || option?.label || selectedModelId);
                  if (isModelChanged) {
                    // Reset selected tasks when model changes to avoid cross-model validation errors on save.
                    setWorkOrderTemplateSelectedTaskIds([]);
                    setFieldValue('tasks_json', '[]');
                    setFieldValue('selected_task_template_ids', []);
                  }
                }}
                className={cn(
                  'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-800',
                  (formErrors.aircraft_model || formErrors.model_id) && 'border-destructive',
                )}
                aria-invalid={Boolean(formErrors.aircraft_model || formErrors.model_id)}
                disabled={workOrderTemplateAircraftModelOptionsLoading}
              >
                <option value="" hidden />
                {workOrderTemplateAircraftModelSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {workOrderTemplateAircraftModelOptionsLoading ? <p className="text-[11px] text-slate-500">Loading aircraft models...</p> : null}
              {!workOrderTemplateAircraftModelOptionsLoading && !workOrderTemplateAircraftModelOptionsError && workOrderTemplateAircraftModelSelectOptions.length === 0 ? (
                <p className="text-[11px] text-slate-500">No aircraft models available</p>
              ) : null}
              {workOrderTemplateAircraftModelOptionsError ? <p className="mdm-template-danger">{workOrderTemplateAircraftModelOptionsError}</p> : null}
              {formErrors.aircraft_model ? <p className="mdm-template-danger">{formErrors.aircraft_model}</p> : null}
              {formErrors.model_id ? <p className="mdm-template-danger">{formErrors.model_id}</p> : null}
              {modalMode === 'update' && !String(formValues.model_id ?? '').trim() ? (
                <p className="mdm-template-danger">Aircraft Model could not be resolved for this template.</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="wpt-maintenance-type" className="text-[12px] font-medium text-slate-700">Maintenance Type</Label>
              <Select value={String(formValues.maintenance_type ?? '')} onValueChange={(value) => setFieldValue('maintenance_type', value)}>
                <SelectTrigger
                  id="wpt-maintenance-type"
                  className={cn(
                    'h-8 border-slate-300 bg-white px-2 text-[12px] text-slate-800',
                    formErrors.maintenance_type && 'border-destructive',
                  )}
                  aria-invalid={Boolean(formErrors.maintenance_type)}
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {MAINTENANCE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.maintenance_type ? <p className="mdm-template-danger">{formErrors.maintenance_type}</p> : null}
            </div>
            <div className="flex items-end">
              <div className="flex h-8 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 text-[12px] text-slate-700">
                <Checkbox
                  id="wpt-active"
                  checked={Boolean(formValues.active)}
                  onCheckedChange={(value) => setFieldValue('active', Boolean(value))}
                />
                <Label htmlFor="wpt-active" className="text-[12px] font-medium text-slate-700">Active</Label>
              </div>
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label htmlFor="wpt-policy-snapshot-id" className="text-[12px] font-medium text-slate-700">Policy Snapshot ID</Label>
              <Input
                id="wpt-policy-snapshot-id"
                value={String(formValues.policy_snapshot_id ?? '')}
                onChange={(event) => setFieldValue('policy_snapshot_id', event.target.value)}
                className="h-8 border-slate-300 bg-white px-2 text-[12px] text-slate-800"
                placeholder="POLICY-2026-001"
              />
            </div>
          </div>
        </section>
        ) : null}
        {!hideSelectedTasksSection ? (
        <section className="overflow-hidden rounded bg-white">
          <div className="border-b border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700">Selected Tasks</div>
          <div className="space-y-2 p-3">
            <div className="overflow-x-auto border border-slate-200">
              <table className="w-full text-[12px]">
                <thead className="bg-slate-50 text-left text-slate-700">
                  <tr className="border-b border-slate-200" data-testid="wpt-selected-tasks-header-row">
                    <th className="px-2 py-1.5 font-semibold">
                      <Checkbox
                        checked={allWorkOrderTemplateTasksSelected ? true : someWorkOrderTemplateTasksSelected ? 'indeterminate' : false}
                        onCheckedChange={(checked) => toggleWorkOrderTemplateSelectAllTasks(Boolean(checked))}
                        aria-label="Select all selected tasks rows"
                      />
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        onClick={() => toggleWorkOrderTemplateTaskSort('task_id')}
                        aria-label={getWorkOrderTaskSortAriaLabel('task_id', 'Task ID')}
                      >
                        Task ID
                        {workOrderTemplateTaskSortColumn === 'task_id' ? (
                          workOrderTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        onClick={() => toggleWorkOrderTemplateTaskSort('code_form_no')}
                        aria-label={getWorkOrderTaskSortAriaLabel('code_form_no', 'Code Form No')}
                      >
                        Code Form No
                        {workOrderTemplateTaskSortColumn === 'code_form_no' ? (
                          workOrderTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        onClick={() => toggleWorkOrderTemplateTaskSort('ata_code')}
                        aria-label={getWorkOrderTaskSortAriaLabel('ata_code', 'ATA Code')}
                      >
                        ATA Code
                        {workOrderTemplateTaskSortColumn === 'ata_code' ? (
                          workOrderTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        onClick={() => toggleWorkOrderTemplateTaskSort('reference_amp')}
                        aria-label={getWorkOrderTaskSortAriaLabel('reference_amp', 'Reference AMP')}
                      >
                        Reference AMP
                        {workOrderTemplateTaskSortColumn === 'reference_amp' ? (
                          workOrderTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        onClick={() => toggleWorkOrderTemplateTaskSort('description')}
                        aria-label={getWorkOrderTaskSortAriaLabel('description', 'Description')}
                      >
                        Description
                        {workOrderTemplateTaskSortColumn === 'description' ? (
                          workOrderTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        onClick={() => toggleWorkOrderTemplateTaskSort('category_code')}
                        aria-label={getWorkOrderTaskSortAriaLabel('category_code', 'Category Code')}
                      >
                        Category Code
                        {workOrderTemplateTaskSortColumn === 'category_code' ? (
                          workOrderTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        onClick={() => toggleWorkOrderTemplateTaskSort('estimated_man_hours')}
                        aria-label={getWorkOrderTaskSortAriaLabel('estimated_man_hours', 'Estimated Man Hours')}
                      >
                        Estimated Man Hours
                        {workOrderTemplateTaskSortColumn === 'estimated_man_hours' ? (
                          workOrderTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
                        onClick={() => toggleWorkOrderTemplateTaskSort('is_mandatory')}
                        aria-label={getWorkOrderTaskSortAriaLabel('is_mandatory', 'Is Mandatory')}
                      >
                        Is Mandatory
                        {workOrderTemplateTaskSortColumn === 'is_mandatory' ? (
                          workOrderTemplateTaskSortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : <ArrowUpDown className="h-3 w-3" />}
                      </button>
                    </th>
                    <th className="px-2 py-1.5 font-semibold">JSON_Details</th>
                  </tr>
                  <tr className="border-t border-slate-200 bg-slate-100/60" data-testid="wpt-selected-tasks-filter-row">
                    <th className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filter</th>
                    <th className="px-2 py-1.5"><Input value={workOrderTemplateTaskFilters.task_id} onChange={(event) => setWorkOrderTemplateTaskFilterValue('task_id', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Task ID" aria-label="Filter Task ID" /></th>
                    <th className="px-2 py-1.5"><Input value={workOrderTemplateTaskFilters.code_form_no} onChange={(event) => setWorkOrderTemplateTaskFilterValue('code_form_no', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Code" /></th>
                    <th className="px-2 py-1.5"><Input value={workOrderTemplateTaskFilters.ata_code} onChange={(event) => setWorkOrderTemplateTaskFilterValue('ata_code', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter ATA" /></th>
                    <th className="px-2 py-1.5"><Input value={workOrderTemplateTaskFilters.reference_amp} onChange={(event) => setWorkOrderTemplateTaskFilterValue('reference_amp', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Reference" /></th>
                    <th className="px-2 py-1.5"><Input value={workOrderTemplateTaskFilters.description} onChange={(event) => setWorkOrderTemplateTaskFilterValue('description', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Description" /></th>
                    <th className="px-2 py-1.5"><Input value={workOrderTemplateTaskFilters.category_code} onChange={(event) => setWorkOrderTemplateTaskFilterValue('category_code', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Category" /></th>
                    <th className="px-2 py-1.5"><Input value={workOrderTemplateTaskFilters.estimated_man_hours} onChange={(event) => setWorkOrderTemplateTaskFilterValue('estimated_man_hours', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="Filter Hours" /></th>
                    <th className="px-2 py-1.5"><Input value={workOrderTemplateTaskFilters.is_mandatory} onChange={(event) => setWorkOrderTemplateTaskFilterValue('is_mandatory', event.target.value)} className="h-7 border-slate-300 px-1.5 text-[11px]" placeholder="true / false" /></th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {selectedWorkOrderAircraftModelTaskRows.length ? selectedWorkOrderAircraftModelTaskRows.map((taskTemplate) => {
                    const rowId = resolveWorkOrderTaskTemplateId(taskTemplate);
                    if (!rowId) {
                      return null;
                    }
                    const selected = workOrderTemplateSelectedTaskIds.includes(rowId);
                    return (
                    <tr key={rowId} className={cn('border-t border-slate-100 text-slate-700', selected && 'bg-sky-50/60')}>
                      <td className="px-2 py-1.5">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(checked) => toggleWorkOrderTemplateTaskSelection(rowId, Boolean(checked))}
                          aria-label={`Select task row ${String(taskTemplate.tt_sequence || taskTemplate.task_template_id || taskTemplate.task_id || rowId)}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="inline-flex items-center gap-1">
                          <span>{String(taskTemplate.tt_sequence || taskTemplate.task_template_id || taskTemplate.task_id || '-')}</span>
                          {selected ? <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Selected</Badge> : null}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">{String(taskTemplate.code_form_no || '-')}</td>
                      <td className="px-2 py-1.5">{String(taskTemplate.ata_code || '-')}</td>
                      <td className="px-2 py-1.5">{String(taskTemplate.reference_amp || '-')}</td>
                      <td className="px-2 py-1.5">{String(taskTemplate.description || '-')}</td>
                      <td className="px-2 py-1.5">{String(taskTemplate.category_code || '-')}</td>
                      <td className="px-2 py-1.5">{String(taskTemplate.estimated_man_hours || '-')}</td>
                      <td className="px-2 py-1.5">{typeof taskTemplate.is_mandatory === 'boolean' ? String(taskTemplate.is_mandatory) : '-'}</td>
                      <td className="px-2 py-1.5">{typeof taskTemplate.task_template_detail_json === 'object' && taskTemplate.task_template_detail_json !== null ? JSON.stringify(taskTemplate.task_template_detail_json) : String(taskTemplate.task_template_detail_json || '-')}</td>
                    </tr>
                    );
                  }) : (
                    <tr>
                      <td className="px-2 py-2 text-slate-500" colSpan={10}>{workOrderTemplateTaskTemplatesLoading ? 'Loading task templates…' : 'No task rows available for selected aircraft model'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-slate-500" data-testid="wpt-selected-tasks-summary">
              Selection Summary: Checked {workOrderTemplateSelectedTaskIds.length} | Records: {selectedWorkOrderAircraftModelTaskRows.length}
            </div>
            {workOrderTemplateTaskTemplatesError ? <p className="mdm-template-danger">{workOrderTemplateTaskTemplatesError}</p> : null}
          </div>
        </section>
        ) : null}
      </div>
      {!hideScopeAndTasksJsonSections ? (
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="overflow-hidden rounded bg-white">
          <div className="border-b border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700">Scope Definition</div>
          <div className="p-3">
            <Label htmlFor="wpt-scope-json" className="sr-only">Scope JSON</Label>
            <Textarea
              id="wpt-scope-json"
              value={String(formValues.scope_json ?? '')}
              onChange={(event) => setFieldValue('scope_json', event.target.value)}
              className={cn(
                'min-h-[118px] border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-800',
                formErrors.scope_json && 'border-destructive',
              )}
              aria-invalid={Boolean(formErrors.scope_json)}
              placeholder='[{"phase":"inspection"}]'
            />
            {formErrors.scope_json ? <p className="mt-1 mdm-template-danger">{formErrors.scope_json}</p> : null}
          </div>
        </section>
        <section className="overflow-hidden rounded bg-white">
          <div className="border-b border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700">Tasks JSON</div>
          <div className="p-3">
            <Label htmlFor="wpt-tasks-json" className="sr-only">Tasks JSON</Label>
            <Textarea
              id="wpt-tasks-json"
              value={String(formValues.tasks_json ?? '')}
              onChange={(event) => setFieldValue('tasks_json', event.target.value)}
              className={cn(
                'min-h-[118px] border-slate-300 bg-white px-2 py-1.5 text-[12px] text-slate-800',
                formErrors.tasks_json && 'border-destructive',
              )}
              aria-invalid={Boolean(formErrors.tasks_json)}
              placeholder='[{"task_number":"05-20","description":"Scheduled Maintenance Checks"}]'
            />
            {formErrors.tasks_json ? <p className="mt-1 mdm-template-danger">{formErrors.tasks_json}</p> : null}
          </div>
        </section>
      </div>
      ) : null}
    </div>
  );
}
