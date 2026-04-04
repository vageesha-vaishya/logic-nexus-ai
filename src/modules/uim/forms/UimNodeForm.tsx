import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RotateCcw, Save } from 'lucide-react';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { UimNodeKey, UimFieldConfig } from './types';
import { uimNodeConfigs } from './config';
import { useUimNodeForm } from './useUimNodeForm';
import { AddressBlock } from './blocks/AddressBlock';
import { DimensionBlock } from './blocks/DimensionBlock';

type UimNodeFormProps = {
  node: UimNodeKey;
  existingEntity?: Record<string, unknown> | null;
};

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
  const { form, isSaving, submitError, submit, reset, isEditMode } = useUimNodeForm({ config, existingEntity });
  const formErrors = Object.values(form.formState.errors).map((error) => String(error?.message || '')).filter(Boolean);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">{t(config.titleKey, { defaultValue: config.titleDefault })}</CardTitle>
        <CardDescription>{t(config.subtitleKey, { defaultValue: config.subtitleDefault })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
