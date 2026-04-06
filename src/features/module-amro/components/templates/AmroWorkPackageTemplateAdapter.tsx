import type { ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const messages = Object.values(formErrors || {}).filter(Boolean).map((value) => String(value));
  const validation: AmroTemplateValidationState = messages.length > 0
    ? { level: 'error', messages }
    : { level: 'ok', messages: [] };
  const standardFields: AmroTemplateFieldDefinition[] = [
    { key: 'template_code', label: 'Template Code (Standard)', required: true },
    { key: 'template_name', label: 'Template Name (Standard)', required: true },
    { key: 'version', label: 'Version (Standard)', required: true },
    { key: 'maintenance_type', label: 'Maintenance Type (Standard)', required: true },
    { key: 'policy_snapshot_id', label: 'Policy Snapshot ID (Standard)' },
    { key: 'active', label: 'Active (Standard)' },
  ];
  const standardSections: AmroTemplateSection[] = [
    {
      id: 'core',
      title: 'Standardized Core Fields',
      description: 'Adapter-managed standard fields (feature-flag path).',
      fieldKeys: ['template_code', 'template_name', 'version', 'maintenance_type', 'policy_snapshot_id', 'active'],
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
      formBodySlot={(
        <div className="space-y-2" data-testid="amro-wpt-standard-template">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Legacy handlers preserved</Badge>
            <span>All API and mutation logic remains in existing section component.</span>
          </div>
          <WorkPackageTemplateCreateSection
            {...props}
            formErrors={formErrors}
          />
        </div>
      )}
    />
  );
}

export default AmroWorkPackageTemplateAdapter;
