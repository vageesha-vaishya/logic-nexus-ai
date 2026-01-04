import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterOption {
  id: string;
  label: string;
  options: { label: string; value: string; icon?: React.ElementType }[];
}

interface KanbanFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filters: Record<string, string[]>; // key -> selected values
  onFilterChange: (key: string, values: string[]) => void;
  availableFilters: FilterOption[];
  className?: string;
}

export function KanbanFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  availableFilters,
  className,
}: KanbanFiltersProps) {
  const activeFilterCount = Object.values(filters).reduce(
    (acc, curr) => acc + curr.length,
    0
  );

  const clearFilters = () => {
    availableFilters.forEach((f) => onFilterChange(f.id, []));
    onSearchChange("");
  };

  const toggleFilter = (key: string, value: string) => {
    const current = filters[key] || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFilterChange(key, next);
  };

  return (
    <div className={cn("flex items-center gap-2 p-1", className)}>
      {/* Search Bar */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search..."
          className="pl-9 bg-background h-9"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Filter Popovers */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {availableFilters.map((filter) => {
          const selected = filters[filter.id] || [];
          const isActive = selected.length > 0;

          return (
            <Popover key={filter.id}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 border-dashed",
                    isActive && "bg-secondary border-solid"
                  )}
                >
                  <Filter className="mr-2 h-3.5 w-3.5" />
                  {filter.label}
                  {isActive && (
                    <>
                      <Separator orientation="vertical" className="mx-2 h-4" />
                      <Badge
                        variant="secondary"
                        className="rounded-sm px-1 font-normal lg:hidden"
                      >
                        {selected.length}
                      </Badge>
                      <div className="hidden space-x-1 lg:flex">
                        {selected.length > 2 ? (
                          <Badge
                            variant="secondary"
                            className="rounded-sm px-1 font-normal"
                          >
                            {selected.length} selected
                          </Badge>
                        ) : (
                          filter.options
                            .filter((opt) => selected.includes(opt.value))
                            .map((opt) => (
                              <Badge
                                key={opt.value}
                                variant="secondary"
                                className="rounded-sm px-1 font-normal"
                              >
                                {opt.label}
                              </Badge>
                            ))
                        )}
                      </div>
                    </>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <div className="p-1">
                  {filter.options.map((option) => {
                    const isSelected = selected.includes(option.value);
                    return (
                      <div
                        key={option.value}
                        className={cn(
                          "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                          isSelected && "bg-accent/50"
                        )}
                        onClick={() => toggleFilter(filter.id, option.value)}
                      >
                        <div
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border border-primary/30",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                        </div>
                        {option.icon && (
                          <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                        )}
                        <span>{option.label}</span>
                      </div>
                    );
                  })}
                </div>
                {selected.length > 0 && (
                  <>
                    <Separator />
                    <div className="p-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-center text-xs h-8"
                        onClick={() => onFilterChange(filter.id, [])}
                      >
                        Clear filters
                      </Button>
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
          );
        })}

        {activeFilterCount > 0 && (
           <Button
             variant="ghost"
             size="sm"
             className="h-9 px-2 lg:px-3"
             onClick={clearFilters}
           >
             Reset
             <X className="ml-2 h-4 w-4" />
           </Button>
        )}
      </div>
    </div>
  );
}
