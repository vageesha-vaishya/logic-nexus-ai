import { useTranslation } from 'react-i18next';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { Control, FieldValues } from 'react-hook-form';

type DimensionBlockProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  prefix?: string;
};

function field(prefix: string | undefined, name: string): string {
  return prefix ? `${prefix}.${name}` : name;
}

export function DimensionBlock<TFieldValues extends FieldValues>({ control, prefix }: DimensionBlockProps<TFieldValues>) {
  const { t } = useTranslation();
  const dimensions = [
    ['length_cm', 'Length (cm)'],
    ['width_cm', 'Width (cm)'],
    ['height_cm', 'Height (cm)'],
    ['weight_kg', 'Weight (kg)'],
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {dimensions.map(([name, label]) => (
        <FormField
          key={name}
          control={control}
          name={field(prefix, name) as any}
          render={({ field: fieldProps }) => (
            <FormItem>
              <FormLabel>{t(`uim.forms.dimension.${name}.label`, { defaultValue: label })}</FormLabel>
              <FormControl>
                <Input
                  {...fieldProps}
                  type="number"
                  step="0.01"
                  min={0}
                  value={fieldProps.value ?? 0}
                  onChange={(event) => fieldProps.onChange(Number(event.target.value))}
                  aria-label={t(`uim.forms.dimension.${name}.ariaLabel`, { defaultValue: label })}
                />
              </FormControl>
              <FormDescription>
                {t(`uim.forms.dimension.${name}.description`, { defaultValue: 'Must be zero or greater' })}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}
