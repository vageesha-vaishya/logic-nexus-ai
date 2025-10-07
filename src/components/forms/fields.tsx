import * as React from "react";
import { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

type BaseFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>;
  name: TName;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function TextField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  className,
}: BaseFieldProps<TFieldValues, TName> & { type?: React.InputHTMLAttributes<HTMLInputElement>["type"] }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Input {...field} placeholder={placeholder} disabled={disabled} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function NumberField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  className,
}: BaseFieldProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Input {...field} placeholder={placeholder} disabled={disabled} type="number" />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextareaField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  className,
}: BaseFieldProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Textarea {...field} placeholder={placeholder} disabled={disabled} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export type SelectOption = { value: string; label: string };

export function SelectField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  className,
  options,
}: BaseFieldProps<TFieldValues, TName> & { options: SelectOption[] }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SwitchField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  className,
}: BaseFieldProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cnToggleContainer(className)}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CheckboxField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  className,
}: BaseFieldProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cnToggleContainer(className)}>
          <div className="flex items-center gap-2">
            <FormControl>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            {label && <FormLabel className="!mt-0">{label}</FormLabel>}
          </div>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function cnToggleContainer(className?: string) {
  return ["space-y-0", className].filter(Boolean).join(" ");
}