import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { WorkPackageTemplateCreateSection } from '@/features/module-amro/settings/pages/amro-settings-master-data/components/WorkPackageTemplateCreateSection';
import {
  AmroStandardFormTemplate,
  type AmroTemplateFieldDefinition,
  type AmroTemplateSection,
  type AmroTemplateValidationState,
} from './AmroStandardFormTemplate';

type WorkPackageTemplateCreateSectionProps = ComponentProps<typeof WorkPackageTemplateCreateSection>;

export type AmroWorkPackageTemplateAdapterProps = WorkPackageTemplateCreateSectionProps & {
  mode: 'create' | 'update';
  loading?: boolean;
};

export function AmroWorkPackageTemplateAdapter({
  mode,
  loading = false,
  formErrors,
  ...props
}: AmroWorkPackageTemplateAdapterProps) {
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
  const [modelHydrationDebug, setModelHydrationDebug] = useState('idle');
  const [resolvedModelDisplayLabel, setResolvedModelDisplayLabel] = useState('');

  const buildAuthHeaders = async () => {
    const headers: Record<string, string> = {};
    const scopeIsTenantAdmin = Boolean((props.scope as Record<string, unknown>)?.isTenantAdmin);
    const { data } = await supabase.auth.getSession();
    const token = String(data.session?.access_token || '').trim();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (props.scope?.tenantId) {
      headers['x-tenant-id'] = props.scope.tenantId;
    }
    if (props.scope?.franchiseId && !scopeIsTenantAdmin) {
      headers['x-franchise-id'] = props.scope.franchiseId;
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

  useEffect(() => {
    const loadAircraftModels = async () => {
      if (!props.modalOpen) {
        return;
      }
      if (!props.scope?.tenantId) {
        setAircraftModelOptions([]);
        setAircraftModelOptionsError('');
        return;
      }
      setAircraftModelOptionsLoading(true);
      setAircraftModelOptionsError('');
      try {
        const response = await fetch('/api/v2/amro/work-package-templates/model-options', {
          method: 'GET',
          headers: await buildAuthHeaders(),
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
  }, [props.modalOpen, props.scope?.franchiseId, props.scope?.tenantId, (props.scope as Record<string, unknown>)?.isTenantAdmin]);

  useEffect(() => {
    if (mode !== 'update') {
      return;
    }
    const currentModelId = String(props.formValues.model_id ?? '').trim();
    const currentModelText = String(props.formValues.aircraft_model ?? '').trim();
    if (currentModelId || !currentModelText) {
      return;
    }
    const normalizedText = currentModelText.toLowerCase();
    const matchedOption = aircraftModelOptions.find((entry) => {
      const byCode = String(entry.modelCode || '').trim().toLowerCase();
      const byLabel = String(entry.label || '').trim().toLowerCase();
      return byCode === normalizedText || byLabel === normalizedText;
    });
    if (!matchedOption?.value) {
      return;
    }
    props.setFieldValue('model_id', matchedOption.value);
    props.setFieldValue('aircraft_model', matchedOption.modelCode || currentModelText);
  }, [aircraftModelOptions, mode, props.formValues.aircraft_model, props.formValues.model_id, props.setFieldValue]);

  const messages = Object.values(formErrors || {}).filter(Boolean).map((value) => String(value));
  const validation: AmroTemplateValidationState = messages.length > 0
    ? { level: 'error', messages }
    : { level: 'ok', messages: [] };
  const selectedAircraftModelId = String(props.formValues.model_id ?? '').trim();
  const selectedAircraftModelText = String(props.formValues.aircraft_model ?? '').trim();

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
          const response = await fetch('/api/v2/amro/work-package-templates/model-options', {
            method: 'GET',
            headers: await buildAuthHeaders(),
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
    const shouldHydrate =
      mode === 'update'
      && Boolean(props.selectedTemplateId)
      && !selectedAircraftModelId
      && !selectedAircraftModelText
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
            .from('work_package_templates')
            .select('model_id,aircraft_model')
            .eq('id', props.selectedTemplateId)
            .maybeSingle();
          if (data && typeof data === 'object') {
            hydratedRecord = data as Record<string, unknown>;
            setModelHydrationDebug('hydrate:scopedDb-hit');
          }
        }
        if (!hydratedRecord) {
          // scopedDb can miss records under franchise scope mismatch; fallback to API by id.
          const response = await fetch(`/api/v2/amro/work-package-templates/${props.selectedTemplateId}`, {
            method: 'GET',
            headers: await buildAuthHeaders(),
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
          setModelHydrationDebug(`hydrate:resolved model_id=${modelId || 'none'} aircraft_model=${aircraftModel || 'none'}`);
          if (modelId) {
            props.setFieldValue('model_id', modelId);
          }
          if (aircraftModel) {
            props.setFieldValue('aircraft_model', aircraftModel);
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
    selectedAircraftModelId,
    selectedAircraftModelText,
  ]);

  const effectiveAircraftModelId = selectedAircraftModelId || (selectedAircraftModelText ? `legacy:${selectedAircraftModelText}` : '');
  const effectiveAircraftModelOptions = useMemo(() => {
    const dedupeOptions = (options: Array<{ value: string; label: string; modelCode: string }>) => {
      const byValue = new Map<string, { value: string; label: string; modelCode: string }>();
      options.forEach((option) => {
        if (!byValue.has(option.value)) {
          byValue.set(option.value, option);
        }
      });
      return Array.from(byValue.values());
    };
    if (!selectedAircraftModelText) {
      if (selectedAircraftModelId && resolvedModelDisplayLabel) {
        const existingOption = aircraftModelOptions.find((entry) => entry.value === selectedAircraftModelId);
        if (existingOption) {
          return dedupeOptions(
            aircraftModelOptions.map((entry) => (
              entry.value === selectedAircraftModelId
                ? { ...entry, label: resolvedModelDisplayLabel }
                : entry
            )),
          );
        }
        return [
          {
            value: selectedAircraftModelId,
            label: resolvedModelDisplayLabel,
            modelCode: resolvedModelDisplayLabel,
          },
          ...dedupeOptions(aircraftModelOptions),
        ];
      }
      return dedupeOptions(aircraftModelOptions);
    }
    if (!selectedAircraftModelId) {
      return dedupeOptions([
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
          ? { ...entry, label: `${preferredDisplayLabel} (current)` }
          : entry
      ));
    }
    const exists = Boolean(existingOption);
    if (exists) {
      return dedupeOptions(aircraftModelOptions);
    }
    return dedupeOptions([
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
      fieldKeys: ['template_code', 'template_name', 'version', 'model_id', 'maintenance_type', 'policy_snapshot_id', 'active'],
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
      moduleKey="work_package_templates"
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
                  {['line', 'base', 'component', 'inspection', 'overhaul', 'repair', 'upgrade', 'modification'].map((option) => (
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
                  className={cn(modelError && 'border-destructive')}
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
          <WorkPackageTemplateCreateSection
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

export default AmroWorkPackageTemplateAdapter;
