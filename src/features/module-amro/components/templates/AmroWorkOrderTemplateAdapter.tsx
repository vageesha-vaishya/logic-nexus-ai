import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AsyncCombobox } from '@/components/ui/async-combobox';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { WorkOrderTemplateCreateSection } from '@/features/module-amro/settings/pages/amro-settings-master-data/components/WorkOrderTemplateCreateSection';
import {
  AmroStandardFormTemplate,
  type AmroTemplateFieldDefinition,
  type AmroTemplateSection,
  type AmroTemplateValidationState,
} from './AmroStandardFormTemplate';

type WorkOrderTemplateCreateSectionProps = ComponentProps<typeof WorkOrderTemplateCreateSection>;

export type AmroWorkOrderTemplateAdapterProps = WorkOrderTemplateCreateSectionProps & {
  mode: 'create' | 'update';
  loading?: boolean;
};

export function AmroWorkOrderTemplateAdapter({
  mode,
  loading = false,
  formErrors,
  ...props
}: AmroWorkOrderTemplateAdapterProps) {
  const activeTenantId = String(props.formValues.tenant_id ?? props.scope?.tenantId ?? '').trim();
  const activeFranchiseId = String(props.formValues.franchise_id ?? props.scope?.franchiseId ?? '').trim();
  const canEditTenant = Boolean((props.scope as Record<string, unknown>)?.isPlatformAdmin);
  const canEditFranchise =
    (Boolean((props.scope as Record<string, unknown>)?.isTenantAdmin) || canEditTenant)
    && !(props.scope as Record<string, unknown>)?.isFranchiseAdmin;
  const isUuidLike = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
  const extractRecordsFromPayload = (payload: Record<string, unknown> | null): Record<string, unknown>[] => {
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.data)) return payload.data as Record<string, unknown>[];
    if (Array.isArray(payload.records)) return payload.records as Record<string, unknown>[];
    if (payload.output && typeof payload.output === 'object') {
      const output = payload.output as Record<string, unknown>;
      if (Array.isArray(output.records)) return output.records as Record<string, unknown>[];
      if (output.record && typeof output.record === 'object') return [output.record as Record<string, unknown>];
    }
    if (payload.data && typeof payload.data === 'object') {
      const data = payload.data as Record<string, unknown>;
      if (Array.isArray(data.records)) return data.records as Record<string, unknown>[];
      if (data.record && typeof data.record === 'object') return [data.record as Record<string, unknown>];
    }
    return [];
  };
  const extractRecordFromPayload = (payload: Record<string, unknown> | null): Record<string, unknown> | null => {
    if (!payload || typeof payload !== 'object') return null;
    const directRecord = payload.record && typeof payload.record === 'object'
      ? (payload.record as Record<string, unknown>)
      : null;
    if (directRecord) return directRecord;
    const directRecords = Array.isArray(payload.records) ? payload.records as Record<string, unknown>[] : [];
    if (directRecords[0]) return directRecords[0];
    const output = payload.output && typeof payload.output === 'object'
      ? (payload.output as Record<string, unknown>)
      : null;
    if (output) {
      const outputRecord = output.record && typeof output.record === 'object'
        ? (output.record as Record<string, unknown>)
        : null;
      if (outputRecord) return outputRecord;
      const outputRecords = Array.isArray(output.records) ? output.records as Record<string, unknown>[] : [];
      if (outputRecords[0]) return outputRecords[0];
      if (Object.prototype.hasOwnProperty.call(output, 'model_id') || Object.prototype.hasOwnProperty.call(output, 'aircraft_model')) {
        return output;
      }
    }
    const data = payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : null;
    if (data) {
      if (Object.prototype.hasOwnProperty.call(data, 'model_id') || Object.prototype.hasOwnProperty.call(data, 'aircraft_model')) {
        return data;
      }
      const dataRecord = data.record && typeof data.record === 'object'
        ? (data.record as Record<string, unknown>)
        : null;
      if (dataRecord) return dataRecord;
      const dataRecords = Array.isArray(data.records) ? data.records as Record<string, unknown>[] : [];
      if (dataRecords[0]) return dataRecords[0];
    }
    return null;
  };
  const modelHydrationAttemptedRef = useRef<string | null>(null);
  const userChangedModelRef = useRef<boolean>(false);
  const [modelHydrationDebug, setModelHydrationDebug] = useState('idle');
  const [resolvedModelDisplayLabel, setResolvedModelDisplayLabel] = useState('');
  const [hydratedModelId, setHydratedModelId] = useState('');

  const buildAuthHeaders = async (tenantOverride?: string, franchiseOverride?: string) => {
    const headers: Record<string, string> = {};
    const { data } = await supabase.auth.getSession();
    const token = String(data.session?.access_token || '').trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const resolvedTenantId = String(tenantOverride ?? props.scope?.tenantId ?? '').trim();
    if (resolvedTenantId) {
      headers['x-tenant-id'] = resolvedTenantId;
    }
    const resolvedFranchiseId = String(franchiseOverride ?? props.scope?.franchiseId ?? '').trim();
    if (resolvedFranchiseId) {
      headers['x-franchise-id'] = resolvedFranchiseId;
    }
    const scopeUserId = String((props.scope as Record<string, unknown>)?.userId || '').trim();
    if (scopeUserId) {
      headers['x-user-id'] = scopeUserId;
    }
    return headers;
  };
  const [aircraftModelOptions, setAircraftModelOptions] = useState<Array<{ value: string; label: string; modelCode: string }>>([]);
  const [aircraftModelOptionsLoading, setAircraftModelOptionsLoading] = useState(false);
  const [aircraftModelOptionsError, setAircraftModelOptionsError] = useState('');
  const [tenantOptions, setTenantOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [tenantOptionsLoading, setTenantOptionsLoading] = useState(false);
  const [tenantOptionsError, setTenantOptionsError] = useState('');
  const [franchiseOptions, setFranchiseOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [franchiseOptionsLoading, setFranchiseOptionsLoading] = useState(false);
  const [franchiseOptionsError, setFranchiseOptionsError] = useState('');
  const [templateHydrationError, setTemplateHydrationError] = useState('');

  useEffect(() => {
    const hydrateTemplateFields = async () => {
      if (mode !== 'update' || !props.modalOpen || !props.selectedTemplateId) {
        setTemplateHydrationError('');
        return;
      }
      const hasTemplateCode = String(props.formValues.template_code ?? '').trim().length > 0;
      const hasTemplateName = String(props.formValues.template_name ?? '').trim().length > 0;
      const hasModel = String(props.formValues.model_id ?? props.formValues.aircraft_model ?? '').trim().length > 0;
      const hasTenant = String(props.formValues.tenant_id ?? '').trim().length > 0;
      const hasFranchise = String(props.formValues.franchise_id ?? '').trim().length > 0;
      if (hasTemplateCode && hasTemplateName && hasModel && hasTenant && hasFranchise) {
        setTemplateHydrationError('');
        return;
      }
      try {
        let record: Record<string, unknown> | null = null;
        if (props.scopedDb && typeof (props.scopedDb as any).from === 'function') {
          const { data } = await (props.scopedDb as any)
            .from('work_order_templates')
            .select('template_code,template_name,model_id,tenant_id,franchise_id')
            .eq('id', props.selectedTemplateId)
            .maybeSingle();
          if (data && typeof data === 'object') {
            record = data as Record<string, unknown>;
          }
        }
        if (!record) {
          const response = await fetch(`/api/v2/amro/work-order-templates/${props.selectedTemplateId}`, {
            method: 'GET',
            headers: await buildAuthHeaders(activeTenantId, activeFranchiseId),
          });
          if (response.ok) {
            const payload = (await response.json()) as Record<string, unknown>;
            record = extractRecordFromPayload(payload);
          }
        }
        if (!record) {
          throw new Error('Template record was not found');
        }
        const templateCode = String(record.template_code ?? '').trim();
        const templateName = String(record.template_name ?? '').trim();
        const modelId = String(record.model_id ?? '').trim();
        const aircraftModel = String(record.aircraft_model ?? '').trim();
        const tenantId = String(record.tenant_id ?? '').trim();
        const franchiseId = String(record.franchise_id ?? '').trim();

        if (!hasTemplateCode && templateCode) props.setFieldValue('template_code', templateCode);
        if (!hasTemplateName && templateName) props.setFieldValue('template_name', templateName);
        if (!hasModel && modelId) props.setFieldValue('model_id', modelId);
        if (!hasModel && aircraftModel) props.setFieldValue('aircraft_model', aircraftModel);
        if (!hasTenant && tenantId) props.setFieldValue('tenant_id', tenantId);
        if (!hasFranchise && franchiseId) props.setFieldValue('franchise_id', franchiseId);
        setTemplateHydrationError('');
      } catch {
        setTemplateHydrationError('Unable to auto-load selected template details');
      }
    };
    void hydrateTemplateFields();
  }, [
    activeFranchiseId,
    activeTenantId,
    mode,
    props.formValues.aircraft_model,
    props.formValues.franchise_id,
    props.formValues.model_id,
    props.formValues.template_code,
    props.formValues.template_name,
    props.formValues.tenant_id,
    props.modalOpen,
    props.scopedDb,
    props.selectedTemplateId,
    props.setFieldValue,
  ]);

  useEffect(() => {
    if (!props.modalOpen) return;
    if (!String(props.formValues.tenant_id || '').trim() && props.scope?.tenantId) {
      props.setFieldValue('tenant_id', props.scope.tenantId);
    }
    if (!String(props.formValues.franchise_id || '').trim() && props.scope?.franchiseId) {
      props.setFieldValue('franchise_id', props.scope.franchiseId);
    }
  }, [props.formValues.franchise_id, props.formValues.tenant_id, props.modalOpen, props.scope?.franchiseId, props.scope?.tenantId, props.setFieldValue]);

  useEffect(() => {
    const loadTenantAndFranchiseOptions = async () => {
      if (!props.modalOpen || !props.scope?.tenantId || !props.scopedDb) {
        setTenantOptions(props.scope?.tenantId ? [{ value: props.scope.tenantId, label: props.scope.tenantId }] : []);
        setFranchiseOptions(props.scope?.franchiseId ? [{ value: props.scope.franchiseId, label: props.scope.franchiseId }] : []);
        return;
      }
      setTenantOptionsLoading(true);
      setFranchiseOptionsLoading(true);
      setTenantOptionsError('');
      setFranchiseOptionsError('');
      try {
        let tenantQuery = (props.scopedDb as any)
          .from('tenants', canEditTenant)
          .select('id,name,is_active')
          .order('name', { ascending: true });
        if (!canEditTenant) {
          tenantQuery = tenantQuery.eq('id', props.scope.tenantId).limit(1);
        } else {
          tenantQuery = tenantQuery.eq('is_active', true);
        }
        const { data: tenantRows, error: tenantError } = await tenantQuery;
        if (tenantError) throw new Error(String(tenantError.message || 'Failed to load tenants'));
        const tenants = (Array.isArray(tenantRows) ? tenantRows : [])
          .map((row) => ({ value: String((row as Record<string, unknown>).id || ''), label: String((row as Record<string, unknown>).name || '') }))
          .filter((entry) => entry.value && entry.label);
        setTenantOptions(tenants);

        const { data: franchiseRows, error: franchiseError } = await (props.scopedDb as any)
          .from('franchises', canEditFranchise || canEditTenant)
          .select('id,name,is_active,tenant_id')
          .eq('tenant_id', activeTenantId || props.scope.tenantId)
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (franchiseError) throw new Error(String(franchiseError.message || 'Failed to load franchises'));
        const franchises = (Array.isArray(franchiseRows) ? franchiseRows : [])
          .map((row) => ({ value: String((row as Record<string, unknown>).id || ''), label: String((row as Record<string, unknown>).name || '') }))
          .filter((entry) => entry.value && entry.label);
        setFranchiseOptions(franchises);
      } catch (error) {
        setTenantOptionsError(String((error as Error).message || 'Failed to load tenants'));
        setFranchiseOptionsError(String((error as Error).message || 'Failed to load franchises'));
        setTenantOptions(props.scope?.tenantId ? [{ value: props.scope.tenantId, label: props.scope.tenantId }] : []);
        setFranchiseOptions(props.scope?.franchiseId ? [{ value: props.scope.franchiseId, label: props.scope.franchiseId }] : []);
      } finally {
        setTenantOptionsLoading(false);
        setFranchiseOptionsLoading(false);
      }
    };
    void loadTenantAndFranchiseOptions();
  }, [activeTenantId, canEditFranchise, canEditTenant, props.modalOpen, props.scope?.franchiseId, props.scope?.tenantId, props.scopedDb]);

  useEffect(() => {
    if (!props.modalOpen || activeFranchiseId) return;
    const preferred = props.scope?.franchiseId && franchiseOptions.some((item) => item.value === props.scope?.franchiseId)
      ? props.scope.franchiseId
      : (franchiseOptions[0]?.value || '');
    if (preferred) {
      props.setFieldValue('franchise_id', preferred);
    }
  }, [activeFranchiseId, franchiseOptions, props.modalOpen, props.scope?.franchiseId, props.setFieldValue]);

  useEffect(() => {
    const loadAircraftModels = async () => {
      if (!activeTenantId) {
        setAircraftModelOptions([]);
        setAircraftModelOptionsError('');
        return;
      }
      setAircraftModelOptionsLoading(true);
      setAircraftModelOptionsError('');
      try {
        const query = new URLSearchParams({ tenant_id: activeTenantId });
        if (activeFranchiseId) {
          query.set('franchise_id', activeFranchiseId);
        }
        const response = await fetch(`/api/v2/amro/work-order-templates/model-options?${query.toString()}`, {
          method: 'GET',
          headers: await buildAuthHeaders(activeTenantId, activeFranchiseId),
        });
        if (!response.ok) {
          throw new Error(`Failed to load aircraft models (status ${response.status})`);
        }
        const payload = (await response.json()) as Record<string, unknown>;
        const rows = extractRecordsFromPayload(payload);

        const options = rows
          .map((record) => {
            const value = String(record.id || '').trim();
            if (!value) return null;
            const name = String(record.name || '').trim();
            const code = String(record.model_code || '').trim();
            const active = String(record.is_active ?? 'true').toLowerCase() !== 'false';
            if (!active) return null;
            return {
              value,
              label: name && code && name !== code ? `${name} (${code})` : name || code || value,
              modelCode: code || name || value,
            };
          })
          .filter(Boolean) as Array<{ value: string; label: string; modelCode: string }>;
        setAircraftModelOptions(options);
      } catch (error) {
        setAircraftModelOptions([]);
        setAircraftModelOptionsError(String((error as Error).message || 'Failed to load aircraft models'));
      } finally {
        setAircraftModelOptionsLoading(false);
      }
    };
    void loadAircraftModels();
  }, [activeFranchiseId, activeTenantId]);

  const messages = Object.values(formErrors || {}).filter(Boolean).map((value) => String(value));
  const validation: AmroTemplateValidationState = messages.length > 0
    ? { level: 'error', messages }
    : { level: 'ok', messages: [] };
  const selectedAircraftModelId = String(props.formValues.model_id ?? '').trim();
  const selectedAircraftModelText = String(props.formValues.aircraft_model ?? '').trim();

  useEffect(() => {
    userChangedModelRef.current = false;
    setHydratedModelId('');
  }, [props.selectedTemplateId]);

  useEffect(() => {
    const shouldResolveById =
      Boolean(selectedAircraftModelId)
      && (!selectedAircraftModelText || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selectedAircraftModelText));
    if (!shouldResolveById) {
      setResolvedModelDisplayLabel('');
      return;
    }
    const resolveModelLabel = async () => {
      try {
        let label = '';
        const matchedOption = aircraftModelOptions.find((entry) => entry.value === selectedAircraftModelId);
        if (matchedOption && matchedOption.label && !isUuidLike(matchedOption.label)) {
          label = matchedOption.label;
        }
        if (!label) {
          const response = await fetch('/api/v2/amro/work-order-templates/model-options', {
            method: 'GET',
            headers: await buildAuthHeaders(activeTenantId, activeFranchiseId),
          });
          if (response.ok) {
            const payload = (await response.json()) as Record<string, unknown>;
            const record = extractRecordsFromPayload(payload)
              .find((row) => String(row.id || '') === selectedAircraftModelId) || null;
            const name = String(record?.name || '').trim();
            const code = String(record?.model_code || '').trim();
            label = name && code && name !== code ? `${name} (${code})` : name || code;
          }
        }
        setResolvedModelDisplayLabel(label || '');
      } catch {
        setResolvedModelDisplayLabel('');
      }
    };
    void resolveModelLabel();
  }, [aircraftModelOptions, selectedAircraftModelId, selectedAircraftModelText]);

  useEffect(() => {
    if (
      mode === 'update'
      && !props.selectedTemplateId
      && !selectedAircraftModelId
      && !selectedAircraftModelText
    ) {
      setModelHydrationDebug('hydrate:missing-template-id');
    }
  }, [mode, props.selectedTemplateId, selectedAircraftModelId, selectedAircraftModelText]);

  useEffect(() => {
    const shouldHydrate =
      mode === 'update'
      && Boolean(props.selectedTemplateId)
      && modelHydrationAttemptedRef.current !== String(props.selectedTemplateId);
    if (!shouldHydrate) {
      return;
    }
    const hydrateModelFromTemplate = async () => {
      try {
        setModelHydrationDebug('hydrate:start');
        let hydratedRecord: Record<string, unknown> | null = null;
        if (props.scopedDb && typeof (props.scopedDb as any).from === 'function') {
          const { data } = await (props.scopedDb as any)
            .from('work_order_templates')
            .select('model_id')
            .eq('id', props.selectedTemplateId)
            .maybeSingle();
          if (data && typeof data === 'object') {
            hydratedRecord = data as Record<string, unknown>;
            setModelHydrationDebug('hydrate:scopedDb-hit');
          }
        }
        if (!hydratedRecord) {
          // scopedDb can miss records under franchise scope mismatch; fallback to API by id.
          const response = await fetch(`/api/v2/amro/work-order-templates/${props.selectedTemplateId}`, {
            method: 'GET',
            headers: await buildAuthHeaders(activeTenantId, activeFranchiseId),
          });
          if (response.ok) {
            const payload = (await response.json()) as Record<string, unknown>;
            hydratedRecord = extractRecordFromPayload(payload);
            setModelHydrationDebug(hydratedRecord ? 'hydrate:api-hit' : 'hydrate:api-empty');
          } else {
            setModelHydrationDebug(`hydrate:api-status-${response.status}`);
          }
        }
        if (hydratedRecord) {
          const modelId = String(hydratedRecord.model_id ?? '').trim();
          const aircraftModel = String(hydratedRecord.aircraft_model ?? '').trim();
          const policySnapshotId = String(hydratedRecord.policy_snapshot_id ?? '').trim();
          setModelHydrationDebug(`hydrate:resolved model_id=${modelId || 'none'} aircraft_model=${aircraftModel || 'none'}`);
          setHydratedModelId(modelId);
          if (modelId && modelId !== selectedAircraftModelId) {
            props.setFieldValue('model_id', modelId);
          }
          if (aircraftModel) {
            props.setFieldValue('aircraft_model', aircraftModel);
          } else if (modelId) {
            // Prevent stale aircraft_model tokens from prior state/rows when backend record only has model_id.
            // Keep display resolution driven by model_id + options.
            const mappedOption = aircraftModelOptions.find((option) => option.value === modelId);
            props.setFieldValue('aircraft_model', mappedOption?.modelCode || mappedOption?.label || '');
          }
          if (policySnapshotId || String(props.formValues.policy_snapshot_id ?? '').trim()) {
            props.setFieldValue('policy_snapshot_id', policySnapshotId);
          }
          if (modelId || aircraftModel) {
            modelHydrationAttemptedRef.current = String(props.selectedTemplateId);
          }
        } else if (modelHydrationDebug === 'hydrate:start' || modelHydrationDebug.endsWith('-empty')) {
          setModelHydrationDebug('hydrate:no-record');
        }
      } catch (error) {
        setModelHydrationDebug(`hydrate:error ${(error as Error).message || 'unknown'}`);
        // Keep current UX fallback behavior; unresolved warning remains if model truly absent.
      }
    };
    void hydrateModelFromTemplate();
  }, [
    mode,
    props.scopedDb,
    props.selectedTemplateId,
    props.setFieldValue,
    props.formValues.policy_snapshot_id,
    selectedAircraftModelId,
    aircraftModelOptions,
  ]);

  useEffect(() => {
    if (
      mode !== 'update'
      || !props.selectedTemplateId
      || !hydratedModelId
      || userChangedModelRef.current
    ) {
      return;
    }
    const currentModelId = String(props.formValues.model_id ?? '').trim();
    if (currentModelId === hydratedModelId) {
      return;
    }
    const mappedOption = aircraftModelOptions.find((option) => option.value === hydratedModelId);
    props.setFieldValue('model_id', hydratedModelId);
    props.setFieldValue('aircraft_model', mappedOption?.modelCode || mappedOption?.label || '');
  }, [
    aircraftModelOptions,
    hydratedModelId,
    mode,
    props.formValues.model_id,
    props.selectedTemplateId,
    props.setFieldValue,
  ]);

  const effectiveAircraftModelId = selectedAircraftModelId || (selectedAircraftModelText ? `legacy:${selectedAircraftModelText}` : '');
  const effectiveAircraftModelOptions = useMemo(() => {
    const dedupeByValue = (options: Array<{ value: string; label: string; modelCode?: string }>) => {
      const map = new Map<string, { value: string; label: string; modelCode?: string }>();
      options.forEach((entry) => {
        const key = String(entry.value || '').trim();
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, entry);
        }
      });
      return Array.from(map.values());
    };

    if (!selectedAircraftModelText) {
      if (selectedAircraftModelId && resolvedModelDisplayLabel) {
        const existing = aircraftModelOptions.find((entry) => entry.value === selectedAircraftModelId);
        if (existing) {
          return dedupeByValue(
            aircraftModelOptions.map((entry) => (
              entry.value === selectedAircraftModelId
                ? { ...entry, label: resolvedModelDisplayLabel }
                : entry
            )),
          );
        }
        return dedupeByValue([
          {
            value: selectedAircraftModelId,
            label: resolvedModelDisplayLabel,
            modelCode: resolvedModelDisplayLabel,
          },
          ...aircraftModelOptions,
        ]);
      }
      return dedupeByValue(aircraftModelOptions);
    }
    if (!selectedAircraftModelId) {
      return dedupeByValue([
        {
          value: `legacy:${selectedAircraftModelText}`,
          label: selectedAircraftModelText,
          modelCode: selectedAircraftModelText,
        },
        ...aircraftModelOptions,
      ]);
    }
    const existingOption = aircraftModelOptions.find((entry) => entry.value === selectedAircraftModelId);
    const preferredDisplayLabel = resolvedModelDisplayLabel
      || (!isUuidLike(selectedAircraftModelText) ? selectedAircraftModelText : '');
    const shouldReplaceExistingLabel =
      Boolean(existingOption)
      && Boolean(preferredDisplayLabel)
      && (isUuidLike(String(existingOption?.label || '')) || String(existingOption?.label || '').trim() === selectedAircraftModelId);
    if (shouldReplaceExistingLabel && existingOption) {
      return aircraftModelOptions.map((entry) => (
        entry.value === selectedAircraftModelId
          ? { ...entry, label: preferredDisplayLabel }
          : entry
      ));
    }
    const exists = Boolean(existingOption);
    if (exists) {
      return dedupeByValue(aircraftModelOptions);
    }
    return dedupeByValue([
      {
        value: selectedAircraftModelId,
        label: selectedAircraftModelText,
        modelCode: selectedAircraftModelText,
      },
      ...aircraftModelOptions,
    ]);
  }, [aircraftModelOptions, resolvedModelDisplayLabel, selectedAircraftModelId, selectedAircraftModelText]);

  const selectedAircraftModelLabel = useMemo(() => {
    const option = effectiveAircraftModelOptions.find((entry) => entry.value === selectedAircraftModelId);
    return option?.label || selectedAircraftModelText;
  }, [effectiveAircraftModelOptions, selectedAircraftModelId, selectedAircraftModelText]);

  const standardFields: AmroTemplateFieldDefinition[] = [
    { key: 'tenant_id', label: 'Tenant *', required: true },
    { key: 'franchise_id', label: 'Franchise *', required: true },
    { key: 'template_code', label: 'Template Code (Standard)', required: true },
    { key: 'template_name', label: 'Template Name (Standard)', required: true },
    { key: 'version', label: 'Version (Standard)', required: true },
    { key: 'model_id', label: 'Aircraft Model (Standard)', required: true },
    { key: 'maintenance_type', label: 'Maintenance Type (Standard)', required: true },
    { key: 'policy_snapshot_id', label: 'Policy Snapshot ID (Standard)' },
    { key: 'active', label: 'Active (Standard)' },
    { key: 'scope_json', label: 'Scope JSON (Standard)', span: 2 },
    { key: 'tasks_json', label: 'Tasks JSON (Standard)', span: 2 },
  ];
  const standardSections: AmroTemplateSection[] = [
    {
      id: 'core',
      title: 'Work Package Details',
      description: 'Adapter-managed standard fields (feature-flag path).',
      fieldKeys: ['tenant_id', 'franchise_id', 'template_code', 'template_name', 'version', 'model_id', 'maintenance_type', 'policy_snapshot_id', 'active'],
    },
    {
      id: 'scope',
      title: 'Scope Definition',
      description: 'Native template section bound to legacy scope handler.',
      fieldKeys: ['scope_json'],
    },
    {
      id: 'tasks-json',
      title: 'Tasks JSON',
      description: 'Native template section bound to legacy tasks handler.',
      fieldKeys: ['tasks_json'],
    },
  ];

  return (
    <AmroStandardFormTemplate
      moduleKey="work_order_templates"
      title="Work Package Templates"
      subtitle="Standard template adapter (feature-flagged rollout path)"
      mode={mode === 'create' ? 'create' : 'edit'}
      state={loading ? 'loading' : 'ready'}
      breadcrumbs={['AMRO', 'Master Data', 'Work Package Templates']}
      statusBadges={['Adapter Mode']}
      contentGridClassName="xl:grid-cols-[1fr_1.6fr]"
      values={props.formValues}
      fields={standardFields}
      sections={standardSections}
      renderField={(field) => {
        const value = props.formValues[field.key];
        const error = String(formErrors[field.key] || '');
        if (field.key === 'tenant_id') {
          return (
            <div className="space-y-1">
              <Label htmlFor="amro-wpt-standard-tenant-id">{field.label}</Label>
              <Select
                value={activeTenantId}
                onValueChange={(nextValue) => props.setFieldValue('tenant_id', nextValue)}
                disabled={!canEditTenant || tenantOptionsLoading}
              >
                <SelectTrigger id="amro-wpt-standard-tenant-id" className={cn(!canEditTenant && 'bg-muted')}>
                  <SelectValue placeholder={tenantOptionsLoading ? 'Loading tenants...' : 'Select tenant'} />
                </SelectTrigger>
                <SelectContent>
                  {tenantOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tenantOptionsError ? <p className="mdm-template-danger">{tenantOptionsError}</p> : null}
              {error ? <p className="mdm-template-danger">{error}</p> : null}
            </div>
          );
        }
        if (field.key === 'franchise_id') {
          const franchiseLabel = franchiseOptions.find((item) => item.value === activeFranchiseId)?.label || '';
          return (
            <div className="space-y-1">
              <Label htmlFor="amro-wpt-standard-franchise-id">{field.label}</Label>
              <AsyncCombobox
                value={activeFranchiseId}
                displayValue={franchiseLabel}
                onChange={(nextValue) => {
                  const current = String(props.formValues.franchise_id || '').trim();
                  const next = String(nextValue || '').trim();
                  props.setFieldValue('franchise_id', next);
                  if (current !== next) {
                    props.setFieldValue('model_id', '');
                    props.setFieldValue('aircraft_model', '');
                    props.setFieldValue('tasks_json', '[]');
                    props.setFieldValue('selected_task_template_ids', []);
                  }
                }}
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
              {error ? <p className="mdm-template-danger">{error}</p> : null}
            </div>
          );
        }
        if (field.key === 'maintenance_type') {
          return (
            <div className="space-y-1">
              <Label htmlFor="amro-wpt-standard-maintenance-type">{field.label}</Label>
              <Select value={String(value ?? '')} onValueChange={(nextValue) => props.setFieldValue('maintenance_type', nextValue)}>
                <SelectTrigger
                  id="amro-wpt-standard-maintenance-type"
                  className={cn(error && 'border-destructive')}
                  aria-invalid={Boolean(error)}
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {['line', 'base', 'component', 'inspection', 'overhaul', 'repair', 'service', 'upgrade', 'modification'].map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {error ? <p className="mdm-template-danger">{error}</p> : null}
            </div>
          );
        }
        if (field.key === 'model_id') {
          const modelError = String(formErrors.model_id || formErrors.aircraft_model || '');
          return (
            <div className="space-y-1">
              <Label htmlFor="amro-wpt-standard-aircraft-model">{field.label}</Label>
              <Select
                value={effectiveAircraftModelId}
                onValueChange={(nextValue) => {
                  if (mode === 'update') {
                    return;
                  }
                  userChangedModelRef.current = true;
                  const option = effectiveAircraftModelOptions.find((entry) => entry.value === nextValue);
                  const currentModelId = String(props.formValues.model_id ?? '').trim();
                  const nextModelId = String(nextValue || '').trim();
                  const isModelChanged = currentModelId !== nextModelId;
                  props.setFieldValue('model_id', nextValue);
                  props.setFieldValue('aircraft_model', option?.modelCode || option?.label || nextValue);
                  if (isModelChanged) {
                    // Prevent cross-model validation failures by resetting selected tasks
                    // whenever model changes in create/update flows.
                    props.setFieldValue('tasks_json', '[]');
                    props.setFieldValue('selected_task_template_ids', []);
                  }
                }}
                disabled={aircraftModelOptionsLoading || mode === 'update'}
              >
                <SelectTrigger
                  id="amro-wpt-standard-aircraft-model"
                  className={cn(modelError && 'border-destructive', mode === 'update' && 'bg-muted')}
                  aria-invalid={Boolean(modelError)}
                >
                  <SelectValue placeholder={aircraftModelOptionsLoading ? 'Loading aircraft models...' : 'Select aircraft model'} />
                </SelectTrigger>
                <SelectContent>
                  {effectiveAircraftModelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAircraftModelLabel && mode === 'update' ? (
                <p className="text-[11px] text-muted-foreground">Resolved Model: {selectedAircraftModelLabel}</p>
              ) : null}
              {!aircraftModelOptionsLoading
              && !aircraftModelOptionsError
              && effectiveAircraftModelOptions.length === 0
              && mode !== 'update' ? (
                <p className="text-[11px] text-muted-foreground">No aircraft models available</p>
              ) : null}
              {aircraftModelOptionsError ? <p className="mdm-template-danger">{aircraftModelOptionsError}</p> : null}
              {modelError ? <p className="mdm-template-danger">{modelError}</p> : null}
              {templateHydrationError ? <p className="mdm-template-danger">{templateHydrationError}</p> : null}
              {mode === 'update' ? (
                <p className="text-[11px] text-muted-foreground">Aircraft model is locked for update.</p>
              ) : null}
              {mode === 'update' && !selectedAircraftModelId && !selectedAircraftModelText ? (
                <p className="mdm-template-danger">Aircraft Model could not be resolved for this template.</p>
              ) : null}
            </div>
          );
        }
        if (field.key === 'active') {
          return (
            <div className="space-y-1">
              <Label htmlFor="amro-wpt-standard-active">{field.label}</Label>
              <div className="flex h-10 items-center gap-2 rounded-md border border-input px-3">
                <Checkbox
                  id="amro-wpt-standard-active"
                  checked={Boolean(value)}
                  onCheckedChange={(nextValue) => props.setFieldValue('active', Boolean(nextValue))}
                />
                <span className="text-xs text-muted-foreground">Toggle template active status</span>
              </div>
            </div>
          );
        }
        if (field.key === 'scope_json' || field.key === 'tasks_json') {
          const textValue = String(value ?? '');
          return (
            <div className="space-y-1">
              <Label htmlFor={`amro-wpt-standard-${field.key}`}>{field.label}</Label>
              <Textarea
                id={`amro-wpt-standard-${field.key}`}
                value={textValue}
                onChange={(event) => props.setFieldValue(field.key, event.target.value)}
                className={cn(
                  'min-h-[118px]',
                  error && 'border-destructive',
                )}
                aria-invalid={Boolean(error)}
                placeholder={field.key === 'scope_json'
                  ? '[{"phase":"inspection"}]'
                  : '[{"task_number":"05-20","description":"Scheduled Maintenance Checks"}]'}
              />
              {error ? <p className="mdm-template-danger">{error}</p> : null}
            </div>
          );
        }
        return (
          <div className="space-y-1">
            <Label htmlFor={`amro-wpt-standard-${field.key}`}>{field.label}</Label>
            <Input
              id={`amro-wpt-standard-${field.key}`}
              type={field.key === 'version' ? 'number' : 'text'}
              min={field.key === 'version' ? 1 : undefined}
              value={String(value ?? '')}
              onChange={(event) => props.setFieldValue(field.key, event.target.value)}
              className={cn(error && 'border-destructive')}
              aria-invalid={Boolean(error)}
            />
            {error ? <p className="mdm-template-danger">{error}</p> : null}
          </div>
        );
      }}
      validation={validation}
      listSlot={{
        title: 'Related Records',
        description: 'Selected Tasks (live runtime table)',
        content: (
          <WorkOrderTemplateCreateSection
            {...props}
            formErrors={formErrors}
            hideCoreDetailsSection
            embeddedInStandardTemplate
            hideScopeAndTasksJsonSections
          />
        ),
      }}
      sidePanelSlot={(
        <div className="space-y-2 text-xs">
          <p className="font-medium">Runtime Metadata</p>
          <p>Template ID: {props.selectedTemplateId || 'new-draft'}</p>
          <p>Mode: {mode}</p>
          <p>Template State: {loading ? 'loading' : 'ready'}</p>
          <p>Model Resolved: {selectedAircraftModelLabel || 'not-resolved'}</p>
          <p>Model Value (raw): {selectedAircraftModelId || selectedAircraftModelText || 'empty'}</p>
          <p>Model Options: {aircraftModelOptionsLoading ? 'loading...' : String(aircraftModelOptions.length)}</p>
          <p>Model Hydration Debug: {modelHydrationDebug}</p>
          {aircraftModelOptionsError ? <p className="text-destructive">Model Load Error: {aircraftModelOptionsError}</p> : null}
          <p>Validation Errors: {messages.length}</p>
          <p>Scope JSON Size: {String(props.formValues.scope_json ?? '').length}</p>
          <p>Tasks JSON Size: {String(props.formValues.tasks_json ?? '').length}</p>
        </div>
      )}
      formBodySlot={(
        <div className="space-y-2" data-testid="amro-wpt-standard-template">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Runtime Template Mode</Badge>
            <span>Core + JSON fields are native template sections; selected tasks render in Related Records slot.</span>
          </div>
        </div>
      )}
    />
  );
}

export default AmroWorkOrderTemplateAdapter;
