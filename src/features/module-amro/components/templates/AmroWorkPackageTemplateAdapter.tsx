import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
  const [aircraftModelOptions, setAircraftModelOptions] = useState<Array<{ value: string; label: string; modelCode: string }>>([]);
  const [aircraftModelOptionsLoading, setAircraftModelOptionsLoading] = useState(false);
  const [aircraftModelOptionsError, setAircraftModelOptionsError] = useState('');

  useEffect(() => {
    const loadAircraftModels = async () => {
      if (
        !props.scopedDb
        || typeof (props.scopedDb as any).from !== 'function'
        || !props.scope?.tenantId
      ) {
        setAircraftModelOptions([]);
        setAircraftModelOptionsError('');
        return;
      }
      setAircraftModelOptionsLoading(true);
      setAircraftModelOptionsError('');
      try {
        let query = (props.scopedDb as any)
          .from('assembly_models')
          .select('id,name,model_code,is_active,tenant_id,franchise_id')
          .eq('tenant_id', props.scope.tenantId);
        if (!props.scope.isTenantAdmin && props.scope.franchiseId) {
          query = query.eq('franchise_id', props.scope.franchiseId);
        } else if (!props.scope.isTenantAdmin) {
          query = query.is('franchise_id', null);
        }
        const { data, error } = await query.order('name', { ascending: true });
        if (error) throw new Error(String(error.message || 'Failed to load aircraft models'));
        const options = (Array.isArray(data) ? data : [])
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
  }, [props.scopedDb, props.scope?.franchiseId, props.scope?.isTenantAdmin, props.scope?.tenantId]);

  const messages = Object.values(formErrors || {}).filter(Boolean).map((value) => String(value));
  const validation: AmroTemplateValidationState = messages.length > 0
    ? { level: 'error', messages }
    : { level: 'ok', messages: [] };
  const selectedAircraftModelId = String(props.formValues.model_id ?? '').trim();
  const selectedAircraftModelLabel = useMemo(() => {
    const option = aircraftModelOptions.find((entry) => entry.value === selectedAircraftModelId);
    return option?.label || String(props.formValues.aircraft_model ?? '').trim();
  }, [aircraftModelOptions, props.formValues.aircraft_model, selectedAircraftModelId]);

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
                  {['line', 'base', 'hangar', 'shop'].map((option) => (
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
                value={selectedAircraftModelId}
                onValueChange={(nextValue) => {
                  const option = aircraftModelOptions.find((entry) => entry.value === nextValue);
                  props.setFieldValue('model_id', nextValue);
                  props.setFieldValue('aircraft_model', option?.modelCode || option?.label || nextValue);
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
                  {aircraftModelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAircraftModelLabel && mode === 'update' ? (
                <p className="text-[11px] text-muted-foreground">Resolved Model: {selectedAircraftModelLabel}</p>
              ) : null}
              {!aircraftModelOptionsLoading && !aircraftModelOptionsError && aircraftModelOptions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No aircraft models available</p>
              ) : null}
              {aircraftModelOptionsError ? <p className="mdm-template-danger">{aircraftModelOptionsError}</p> : null}
              {modelError ? <p className="mdm-template-danger">{modelError}</p> : null}
              {mode === 'update' && !selectedAircraftModelId ? (
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
          <p>Model Options: {aircraftModelOptionsLoading ? 'loading...' : String(aircraftModelOptions.length)}</p>
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
