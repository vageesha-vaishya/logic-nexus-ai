import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useRelatedData } from "@/hooks/useRelatedData"

interface SearchableSelectProps {
  table: string;
  label: string;
  placeholder?: string;
  value?: string | null;
  onChange: (value: string | null, item?: any) => void;
  displayField: string;
  searchFields: string[];
  extraFields?: string[];
  renderOption?: (item: any) => React.ReactNode;
}

export function SearchableSelect({
  table,
  label,
  placeholder = "Select...",
  value,
  onChange,
  displayField,
  searchFields,
  extraFields,
  renderOption
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  // Debounce search query to prevent excessive API calls
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState(searchQuery);

  React.useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { 
    data, 
    loading, 
    loadingMore, 
    hasMore, 
    loadMore, 
    search 
  } = useRelatedData<any>({
    table,
    displayField,
    searchFields,
    extraFields,
    pageSize: 50
  });

  // Trigger search when debounced query changes
  React.useEffect(() => {
    search(debouncedSearchQuery);
  }, [debouncedSearchQuery, search]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (!loadingMore && hasMore) {
        loadMore();
      }
    }
  };

  const selectedItem = data.find(item => item.id === value);
  const displayText = selectedItem ? (renderOption ? renderOption(selectedItem) : selectedItem[displayField]) : (value ? "Loading..." : placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedItem ? (
            <span className="truncate">
               {renderOption ? renderOption(selectedItem) : selectedItem[displayField]}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={`Search ${label.toLowerCase()}...`} 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList onScroll={handleScroll} className="max-h-[300px] overflow-auto">
            {loading && data.length === 0 ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      onChange(null);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        !value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    None
                  </CommandItem>
                  {data.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={(currentValue) => {
                        onChange(currentValue === value ? null : currentValue, item)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === item.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {renderOption ? renderOption(item) : item[displayField]}
                    </CommandItem>
                  ))}
                  {loadingMore && (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
