import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { ChevronsUpDown, Check, Loader2, Plus } from "lucide-react";
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
  onCreate?: () => void;
  createLabel?: string;
}

export function AsyncCombobox({
  value,
  displayValue,
  onChange,
  loader,
  placeholder = "Select...",
  className,
  disabled,
  onCreate,
  createLabel = "Create new",
}: AsyncComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<ComboOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Use a ref to store the latest options to avoid stale closures in the initial display logic
  const optionsRef = React.useRef<ComboOption[]>([]);
  // Track if we have performed the initial load
  const initialLoadDone = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    const fetchOptions = async () => {
      // Only set loading if we are actually fetching
      // If closed and not searching, we might want to skip, 
      // BUT if we want to preload, we should fetch.
      // Given the requirement: "display a default list ... when the dropdown is first opened"
      // We can fetch on mount OR on open.
      // Fetching on mount is safer for "instant" feel, but "on open" saves resources.
      
      // If not open and no search, and we haven't loaded yet, we can skip until open?
      // Or we can fetch once.
      // Let's stick to the current logic but ensure it works.
      
      setLoading(true);
      try {
        const opts = await loader(search);
        if (!cancelled) {
          setOptions(opts);
          optionsRef.current = opts;
          initialLoadDone.current = true;
        }
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
          className={cn("w-full justify-between overflow-hidden", className)}
          disabled={disabled}
        >
          <span className={cn("truncate text-left flex-1", !displayValue && !selected && "text-muted-foreground")}>
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
            {!loading && options.length === 0 && (
              <CommandEmpty>
                No results.
                {onCreate && (
                   <Button 
                    variant="ghost" 
                    className="mt-2 w-full justify-start text-primary h-auto py-1.5 px-2"
                    onClick={() => {
                      onCreate();
                      setOpen(false);
                    }}
                   >
                    <Plus className="mr-2 h-4 w-4" />
                    {createLabel}
                   </Button>
                )}
              </CommandEmpty>
            )}
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
            {onCreate && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="create-new-entry-action"
                    onSelect={() => {
                      onCreate();
                      setOpen(false);
                    }}
                    className="cursor-pointer text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {createLabel}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
