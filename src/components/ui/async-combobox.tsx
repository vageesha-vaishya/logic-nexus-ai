import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboOption = { label: string; value: string; original?: any };
export type AsyncComboLoader = (search: string) => Promise<ComboOption[]>;

interface AsyncComboboxProps {
  value?: string;
  displayValue?: string;
  onChange: (value: string, option?: ComboOption) => void;
  loader: AsyncComboLoader;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AsyncCombobox({
  value,
  displayValue,
  onChange,
  loader,
  placeholder = "Select...",
  className,
  disabled,
}: AsyncComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<ComboOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const fetchOptions = async () => {
      setLoading(true);
      try {
        const opts = await loader(search);
        if (!cancelled) setOptions(opts);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(fetchOptions, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loader, search]);

  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          <span className={cn("truncate", !displayValue && !selected && "text-muted-foreground")}>
            {selected ? selected.label : (displayValue || placeholder)}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search..." value={search} onValueChange={setSearch} />
          <CommandList>
            {loading && <div className="p-2 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2"/>Loading...</div>}
            {!loading && options.length === 0 && <CommandEmpty>No results.</CommandEmpty>}
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={() => {
                    onChange(o.value, o);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === o.value ? "opacity-100" : "opacity-0"
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
  );
}
