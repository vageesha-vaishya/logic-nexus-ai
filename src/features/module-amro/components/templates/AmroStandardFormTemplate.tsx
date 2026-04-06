import { type ReactNode, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type AmroTemplateState = 'ready' | 'loading' | 'error' | 'success';
export type AmroTemplateMode = 'create' | 'edit' | 'readonly';

export type AmroTemplateFieldDefinition = {
  key: string;
  label: string;
  required?: boolean;
  group?: string;
  span?: 1 | 2;
  visibleWhen?: (values: Record<string, unknown>) => boolean;
  helperText?: string;
};

export type AmroTemplateSection = {
  id: string;
  title: string;
  description?: string;
  fieldKeys: string[];
};

export type AmroTemplateWorkflowStep = {
  id: string;
  title: string;
  description?: string;
  completed?: boolean;
};

export type AmroTemplateValidationState = {
  level: 'ok' | 'warning' | 'error';
  messages: string[];
};

export type AmroTemplateAction = {
  id: string;
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  onClick: () => void;
};

export type AmroTemplateListSlot = {
  title: string;
  description?: string;
  content: ReactNode;
};

export type AmroStandardFormTemplateProps = {
  moduleKey: string;
  title: string;
  subtitle?: string;
  mode: AmroTemplateMode;
  state: AmroTemplateState;
  breadcrumbs?: string[];
  statusBadges?: string[];
  steps?: AmroTemplateWorkflowStep[];
  activeStepId?: string;
  onStepChange?: (stepId: string) => void;
  values: Record<string, unknown>;
  fields: AmroTemplateFieldDefinition[];
  sections: AmroTemplateSection[];
  renderField: (field: AmroTemplateFieldDefinition) => ReactNode;
  formBodySlot?: ReactNode;
  validation?: AmroTemplateValidationState;
  listSlot?: AmroTemplateListSlot;
  sidePanelSlot?: ReactNode;
  footerSlot?: ReactNode;
  primaryActions?: AmroTemplateAction[];
  secondaryActions?: AmroTemplateAction[];
  successMessage?: string;
  errorMessage?: string;
  loadingMessage?: string;
};

export function AmroStandardFormTemplate({
  moduleKey,
  title,
  subtitle,
  mode,
  state,
  breadcrumbs = [],
  statusBadges = [],
  steps = [],
  activeStepId,
  onStepChange,
  values,
  fields,
  sections,
  renderField,
  formBodySlot,
  validation = { level: 'ok', messages: [] },
  listSlot,
  sidePanelSlot,
  footerSlot,
  primaryActions = [],
  secondaryActions = [],
  successMessage = 'Saved successfully.',
  errorMessage = 'Unable to save form state.',
  loadingMessage = 'Loading form data...',
}: AmroStandardFormTemplateProps) {
  const visibleFields = useMemo(() => fields.filter((field) => field.visibleWhen ? field.visibleWhen(values) : true), [fields, values]);
  const visibleFieldSet = useMemo(() => new Set(visibleFields.map((field) => field.key)), [visibleFields]);

  const sectionMap = useMemo(
    () => sections.map((section) => ({
      ...section,
      fields: section.fieldKeys
        .map((key) => visibleFields.find((field) => field.key === key) || null)
        .filter((field): field is AmroTemplateFieldDefinition => Boolean(field)),
    })).filter((section) => section.fields.length > 0),
    [sections, visibleFields],
  );

  const uncategorizedFields = useMemo(
    () => visibleFields.filter((field) => !sections.some((section) => section.fieldKeys.includes(field.key))),
    [visibleFields, sections],
  );

  return (
    <div className="space-y-4" data-testid="amro-standard-form-template">
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>{title}</CardTitle>
              <CardDescription>{subtitle || `AMRO standardized template for ${moduleKey}`}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Mode: {mode}</Badge>
              {statusBadges.map((badge) => (
                <Badge key={badge} variant="outline">{badge}</Badge>
              ))}
            </div>
          </div>
          {breadcrumbs.length > 0 ? <p className="text-xs text-muted-foreground">{breadcrumbs.join(' / ')}</p> : null}
        </CardHeader>
      </Card>

      {steps.length > 0 ? (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="AMRO workflow steps">
              {steps.map((step) => {
                const isActive = step.id === activeStepId;
                return (
                  <Button
                    key={step.id}
                    type="button"
                    size="sm"
                    variant={isActive ? 'default' : 'outline'}
                    onClick={() => onStepChange?.(step.id)}
                    role="tab"
                    aria-selected={isActive}
                    aria-label={step.title}
                    className={cn(step.completed && !isActive ? 'border-emerald-500 text-emerald-700' : '')}
                  >
                    {step.completed ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : null}
                    {step.title}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {state === 'loading' ? (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Loading</AlertTitle>
          <AlertDescription>{loadingMessage}</AlertDescription>
        </Alert>
      ) : null}

      {state === 'error' ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {state === 'success' ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {validation.level !== 'ok' && validation.messages.length > 0 ? (
        <Alert variant={validation.level === 'error' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{validation.level === 'error' ? 'Validation Errors' : 'Validation Warnings'}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {validation.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Form</CardTitle>
            <CardDescription>Standardized AMRO form sections</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formBodySlot ? (
              <div>{formBodySlot}</div>
            ) : (
              <>
                {sectionMap.map((section) => (
                  <section key={section.id} className="space-y-2">
                    <div>
                      <h3 className="text-sm font-semibold">{section.title}</h3>
                      {section.description ? <p className="text-xs text-muted-foreground">{section.description}</p> : null}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {section.fields.map((field) => (
                        <div key={field.key} className={cn(field.span === 2 ? 'md:col-span-2' : undefined)}>
                          {renderField(field)}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}

                {uncategorizedFields.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">Additional Fields</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {uncategorizedFields.map((field) => (
                        <div key={field.key} className={cn(field.span === 2 ? 'md:col-span-2' : undefined)}>
                          {renderField(field)}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            )}

            <div className="flex flex-wrap gap-2">
              {primaryActions.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  variant={action.variant || 'default'}
                  disabled={action.disabled}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
              {secondaryActions.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  variant={action.variant || 'outline'}
                  disabled={action.disabled}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {listSlot ? (
            <Card>
              <CardHeader>
                <CardTitle>{listSlot.title}</CardTitle>
                {listSlot.description ? <CardDescription>{listSlot.description}</CardDescription> : null}
              </CardHeader>
              <CardContent>{listSlot.content}</CardContent>
            </Card>
          ) : null}
          {sidePanelSlot ? (
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>{sidePanelSlot}</CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {footerSlot}

      {/* Hidden semantics helper to keep accessibility contract visible to tests */}
      <div className="sr-only" role="status" aria-live="polite">
        {visibleFieldSet.size} visible fields rendered.
      </div>
    </div>
  );
}

export default AmroStandardFormTemplate;
