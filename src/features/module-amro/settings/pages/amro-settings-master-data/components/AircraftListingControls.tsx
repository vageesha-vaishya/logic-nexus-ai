import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type AircraftListingControlOption = {
  value: string;
  label: string;
};

type AircraftListingControlsProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchAriaLabel: string;
  statusValue: string;
  onStatusChange: (value: string) => void;
  statusAriaLabel: string;
  statusOptions: AircraftListingControlOption[];
  clearFiltersLabel: string;
  onClearFilters: () => void;
  createLabel: string;
  createAriaLabel: string;
  onCreate: () => void;
  createDisabled?: boolean;
  createLoading?: boolean;
  resultSummaryText: string;
};

export function AircraftListingControls({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  statusValue,
  onStatusChange,
  statusAriaLabel,
  statusOptions,
  clearFiltersLabel,
  onClearFilters,
  createLabel,
  createAriaLabel,
  onCreate,
  createDisabled = false,
  createLoading = false,
  resultSummaryText,
}: AircraftListingControlsProps) {
  return (
    <div className="border-b border-[hsl(var(--mdm-template-border))] bg-background/70 p-2">
      <div className="flex items-center gap-2 overflow-x-auto xl:flex-nowrap xl:overflow-visible">
        <div className="min-w-[260px] flex-1 shrink-0 xl:min-w-[200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8"
              aria-label={searchAriaLabel}
            />
          </div>
        </div>
        <div className="w-[160px] shrink-0 xl:w-[140px]">
          <Select value={statusValue} onValueChange={onStatusChange}>
            <SelectTrigger aria-label={statusAriaLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={`records-status-option-${option.value}`} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onClearFilters}
          className="h-9 shrink-0 px-3 xl:h-8 xl:px-2 xl:text-xs"
        >
          {clearFiltersLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={onCreate}
          disabled={createDisabled || createLoading}
          aria-label={createAriaLabel}
          aria-busy={createLoading}
          className="h-9 shrink-0 px-3 xl:h-8 xl:px-2 xl:text-xs"
        >
          {createLoading ? 'Creating…' : createLabel}
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[hsl(var(--mdm-template-muted))]">
        <span>{resultSummaryText}</span>
      </div>
    </div>
  );
}

export default AircraftListingControls;
