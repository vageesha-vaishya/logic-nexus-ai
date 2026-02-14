import * as React from "react";
import { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar as CalendarIcon, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useVirtualizer } from "@tanstack/react-virtual";

type BaseFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> = {
  control: Control<TFieldValues>;
  name: TName;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

// Date picker field using shadcn Calendar + Popover. Stores Date in form state.
export function DateField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  placeholder = "Pick a date",
  disabled,
  className,
  emitString = false,
}: BaseFieldProps<TFieldValues, TName> & { emitString?: boolean }) {
  const [open, setOpen] = React.useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                  disabled={disabled}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value ? (new Date(field.value as any).toLocaleDateString()) : placeholder}
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <Calendar
                mode="single"
                selected={field.value ? new Date(field.value as any) : undefined}
                onSelect={(date) => {
                  const value = emitString && date 
                    ? date.toISOString().split('T')[0] 
                    : date;
                  field.onChange(value || undefined);
                  setOpen(false);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Currency field with a prefixed currency code, stores numeric amount.
export function CurrencyField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  placeholder = "0.00",
  disabled,
  className,
  currencyCode = "USD",
}: BaseFieldProps<TFieldValues, TName> & { currencyCode?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencyCode}</span>
              <Input
                type="number"
                step="0.01"
                placeholder={placeholder}
                className="pl-14"
                disabled={disabled}
                value={field.value ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  field.onChange(val === "" ? undefined : Number(val));
                }}
              />
            </div>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Combobox field using Command + Popover. Supports static options.
export type ComboOption = { label: string; value: string };

export function ComboboxField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  placeholder = "Select option",
  disabled,
  className,
  options,
}: BaseFieldProps<TFieldValues, TName> & { options: ComboOption[] }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected = options.find((o) => o.value === field.value);
        const displayLabel = selected ? selected.label : placeholder;
        return (
          <FormItem className={className}>
            {label && <FormLabel>{label}</FormLabel>}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled}
                  >
                    <span className={cn(!selected && "text-muted-foreground")}>{displayLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search..." value={search} onValueChange={setSearch} />
                  <CommandList>
                    <CommandEmpty>No results.</CommandEmpty>
                    <CommandGroup>
                      {options
                        .filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
                        .map((o) => (
                          <CommandItem
                            key={o.value}
                            value={o.value}
                            onSelect={() => {
                              field.onChange(o.value);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                field.value === o.value ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {o.label}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

// File upload field storing File[]; shows selected file names.
export function FileUploadField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  className,
  multiple = true,
}: BaseFieldProps<TFieldValues, TName> & { multiple?: boolean }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <div className="space-y-2">
              <Input
                type="file"
                multiple={multiple}
                disabled={disabled}
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  field.onChange(files);
                }}
              />
              {Array.isArray(field.value) && field.value.length > 0 && (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {field.value.map((f: File, idx: number) => (
                    <li key={idx}>{f.name}</li>
                  ))}
                </ul>
              )}
            </div>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Async combobox with Supabase loader and virtualized dropdown
export type AsyncComboLoader = (search: string) => Promise<ComboOption[]>;

export function AsyncComboboxField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  placeholder = "Search services...",
  disabled,
  className,
  loader,
}: BaseFieldProps<TFieldValues, TName> & { loader?: AsyncComboLoader }) {
  const defaultLoader: AsyncComboLoader = React.useCallback(async (search: string) => {
    let query = supabase
      .from("services")
      .select("id, name")
      .order("name")
      .limit(500);
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }
    const { data } = await query;
    return (data || []).map((r: any) => ({ label: r.name, value: r.id }));
  }, []);

  const actualLoader = loader ?? defaultLoader;
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<ComboOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const opts = await actualLoader(search);
        if (!cancelled) setOptions(opts);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actualLoader, search]);

  // Virtualizer setup
  const parentRef = React.useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 8,
  });

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const selected = options.find((o) => o.value === field.value);
        const displayLabel = selected ? selected.label : placeholder;
        return (
          <FormItem className={className}>
            {label && <FormLabel>{label}</FormLabel>}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled}
                  >
                    <span className={cn(!selected && "text-muted-foreground")}>{displayLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search..." value={search} onValueChange={setSearch} />
                  <CommandList>
                    {loading && <CommandEmpty>Loading...</CommandEmpty>}
                    {!loading && options.length === 0 && <CommandEmpty>No results.</CommandEmpty>}
                    <CommandGroup>
                      <div
                        ref={parentRef}
                        style={{ height: 240, overflow: "auto", position: "relative" }}
                      >
                        <div
                          style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: "100%",
                            position: "relative",
                          }}
                        >
                          {rowVirtualizer.getVirtualItems().map((vi) => {
                            const o = options[vi.index];
                            return (
                              <div
                                key={o.value}
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  transform: `translateY(${vi.start}px)`,
                                }}
                              >
                                <CommandItem
                                  value={o.value}
                                  onSelect={() => {
                                    field.onChange(o.value);
                                    setOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === o.value ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  {o.label}
                                </CommandItem>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

export default {};