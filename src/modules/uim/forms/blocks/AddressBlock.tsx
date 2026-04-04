import { useTranslation } from 'react-i18next';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { Control, FieldValues } from 'react-hook-form';

type AddressBlockProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  prefix?: string;
};

function field(prefix: string | undefined, name: string): string {
  return prefix ? `${prefix}.${name}` : name;
}

export function AddressBlock<TFieldValues extends FieldValues>({ control, prefix }: AddressBlockProps<TFieldValues>) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[
        ['address_line_1', 'Address line 1', 'street-address'],
        ['address_line_2', 'Address line 2', 'address-line2'],
        ['city', 'City', 'address-level2'],
        ['state_region', 'State/Region', 'address-level1'],
        ['postal_code', 'Postal code', 'postal-code'],
        ['country_code', 'Country code (ISO-2)', 'country'],
      ].map(([name, label, autoComplete]) => (
        <FormField
          key={name}
          control={control}
          name={field(prefix, name) as any}
          render={({ field: fieldProps }) => (
            <FormItem>
              <FormLabel>{t(`uim.forms.address.${name}.label`, { defaultValue: label })}</FormLabel>
              <FormControl>
                <Input
                  {...fieldProps}
                  autoComplete={autoComplete}
                  aria-label={t(`uim.forms.address.${name}.ariaLabel`, { defaultValue: label })}
                />
              </FormControl>
              <FormDescription>
                {t(`uim.forms.address.${name}.description`, { defaultValue: `Enter ${String(label).toLowerCase()}` })}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}
