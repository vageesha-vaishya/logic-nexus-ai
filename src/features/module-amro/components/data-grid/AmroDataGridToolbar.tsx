/**
 * AMRO Data Grid Toolbar
 *
 * Unified toolbar with:
 * - Global search with debounce and history
 * - Action buttons (New, Export, Import, Refresh, Filter)
 * - Saved searches management
 * - View controls (density, column visibility)
 * - Bulk actions when rows selected
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  RefreshCw,
  Settings,
  Table2,
  LayoutGrid,
  List,
  Save,
  Clock,
  Trash2,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  useDataGridStore,
  GridDensity,
  SearchHistoryItem,
  SavedSearch,
} from './store/useDataGridStore';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AmroDataGridToolbarProps {
  /** On new record click */
  onNew?: () => void;
  /** On export click */
  onExport?: (format: 'csv' | 'xlsx' | 'pdf') => void;
  /** On import click */
  onImport?: () => void;
  /** On refresh click */
  onRefresh?: () => void;
  /** On filter change */
  onFilterChange?: (filters: Record<string, any>) => void;
  /** Is loading */
  isLoading?: boolean;
  /** Filter options for dropdowns */
  filterOptions?: {
    status?: Array<{ value: string; label: string }>;
    type?: Array<{ value: string; label: string }>;
  };
  /** Custom action buttons */
  customActions?: Array<{
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  }>;
  /** CSS class name */
  className?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DENSITY_OPTIONS: Array<{ value: GridDensity; label: string; icon: React.ElementType }> = [
  { value: 'compact', label: 'Compact', icon: Table2 },
  { value: 'normal', label: 'Normal', icon: LayoutGrid },
  { value: 'comfortable', label: 'Comfortable', icon: List },
];

const EXPORT_FORMATS: Array<{ value: 'csv' | 'xlsx' | 'pdf'; label: string; icon: React.ElementType }> = [
  { value: 'csv', label: 'CSV', icon: FileText },
  { value: 'xlsx', label: 'Excel', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF', icon: FileText },
];

// ── Search History Dropdown ────────────────────────────────────────────────────

interface SearchHistoryDropdownProps {
  history: SearchHistoryItem[];
  onSelect: (query: string) => void;
  onClear: () => void;
}

function SearchHistoryDropdown({ history, onSelect, onClear }: SearchHistoryDropdownProps) {
  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No recent searches
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-muted-foreground">Recent Searches</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onClear}>
          Clear
        </Button>
      </div>
      {history.map((item, idx) => (
        <button
          key={idx}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-left text-sm transition-colors"
          onClick={() => onSelect(item.query)}
        >
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{item.query}</span>
          {item.resultCount !== undefined && (
            <span className="text-xs text-muted-foreground">{item.resultCount} results</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Saved Searches Dropdown ────────────────────────────────────────────────────

interface SavedSearchesDropdownProps {
  searches: SavedSearch[];
  onSelect: (search: SavedSearch) => void;
  onDelete: (id: string) => void;
}

function SavedSearchesDropdown({ searches, onSelect, onDelete }: SavedSearchesDropdownProps) {
  if (searches.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No saved searches
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {searches.map((search) => (
        <div key={search.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent group transition-colors">
          <button
            className="flex-1 text-left text-sm truncate"
            onClick={() => onSelect(search)}
          >
            {search.name}
          </button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(search.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ── Save Search Dialog ─────────────────────────────────────────────────────────

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
  currentQuery: string;
}

function SaveSearchDialog({ open, onOpenChange, onSave, currentQuery }: SaveSearchDialogProps) {
  const [name, setName] = useState('');

  const handleSave = useCallback(() => {
    if (name.trim()) {
      onSave(name.trim());
      setName('');
      onOpenChange(false);
    }
  }, [name, onSave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Search</DialogTitle>
          <DialogDescription>
            Save your current search and filters for quick access later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="search-name">Search Name</Label>
            <Input
              id="search-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Low Stock Parts"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Current Query</Label>
            <div className="p-2 bg-muted rounded text-sm font-mono truncate">
              {currentQuery || 'No search query'}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            <Save className="w-4 h-4 mr-2" />
            Save Search
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Toolbar Component ─────────────────────────────────────────────────────

export function AmroDataGridToolbar({
  onNew,
  onExport,
  onImport,
  onRefresh,
  onFilterChange,
  isLoading = false,
  filterOptions,
  customActions,
  className,
}: AmroDataGridToolbarProps) {
  const {
    filters,
    setFilters,
    resetFilters,
    selectedIds,
    deselectAll,
    density,
    setDensity,
    columnVisibility,
    toggleColumnVisibility,
    columnOrder,
    resetColumnPreferences,
    searchHistory,
    addToSearchHistory,
    clearSearchHistory,
    savedSearches,
    saveSearch,
    deleteSavedSearch,
    loadSavedSearch,
  } = useDataGridStore();

  const [searchValue, setSearchValue] = useState(filters.search);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search handler
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        setFilters({ search: value });
        if (value.trim()) {
          addToSearchHistory(value);
        }
      }, 300);
    },
    [setFilters, addToSearchHistory]
  );

  const onSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleSearchChange(e.target.value);
    },
    [handleSearchChange]
  );

  const clearSearch = useCallback(() => {
    setSearchValue('');
    setFilters({ search: '' });
  }, [setFilters]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Selection info
  const selectedCount = selectedIds.size;

  // Visible columns count
  const visibleColumnsCount = useMemo(
    () => Object.values(columnVisibility).filter(Boolean).length,
    [columnVisibility]
  );

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status && filters.status !== 'all') count++;
    if (filters.type && filters.type !== 'all') count++;
    return count;
  }, [filters]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Top Row: Search and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search Input */}
        <div className="flex-1 w-full sm:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search across all columns..."
              value={searchValue}
              onChange={onSearchInputChange}
              className="pl-9 pr-8"
              aria-label="Search records"
            />
            {searchValue && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Refresh */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isLoading}
                  aria-label="Refresh data"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Saved Searches Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Save className="h-4 w-4 mr-1.5" />
                Saved
                {savedSearches.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {savedSearches.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Saved Searches
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-1 py-1">
                <SavedSearchesDropdown
                  searches={savedSearches}
                  onSelect={(search) => {
                    loadSavedSearch(search);
                  }}
                  onDelete={deleteSavedSearch}
                />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSaveDialog(true)}>
                <Save className="h-4 w-4 mr-2" />
                Save Current Search
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search History */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2">
                <Clock className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <SearchHistoryDropdown
                history={searchHistory}
                onSelect={(query) => {
                  setSearchValue(query);
                  setFilters({ search: query });
                }}
                onClear={clearSearchHistory}
              />
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Bulk Actions */}
          {selectedCount > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Trash2 className="h-4 w-4" />
                  Actions ({selectedCount})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onExport?.('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {EXPORT_FORMATS.map((format) => {
                const Icon = format.icon;
                return (
                  <DropdownMenuItem key={format.value} onClick={() => onExport?.(format.value)}>
                    <Icon className="h-4 w-4 mr-2" />
                    Export as {format.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Import */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={onImport}>
                  <Upload className="h-4 w-4 mr-1.5" />
                  Import
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import records</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* New Record */}
          {onNew && (
            <Button onClick={onNew} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New Record
            </Button>
          )}

          {/* Custom Actions */}
          {customActions?.map((action, idx) => {
            const Icon = action.icon;
            return (
              <Button key={idx} variant={action.variant || 'outline'} size="sm" onClick={action.onClick}>
                <Icon className="h-4 w-4 mr-1.5" />
                {action.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Filters Row */}
      {activeFilterCount > 0 || filterOptions ? (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />

          {/* Status Filter */}
          {filterOptions?.status && (
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => {
                setFilters({ status: value === 'all' ? null : value });
                onFilterChange?.({ status: value === 'all' ? null : value });
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {filterOptions.status.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Type Filter */}
          {filterOptions?.type && (
            <Select
              value={filters.type || 'all'}
              onValueChange={(value) => {
                setFilters({ type: value === 'all' ? null : value });
                onFilterChange?.({ type: value === 'all' ? null : value });
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {filterOptions.type.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Active Filter Badges */}
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: &quot;{filters.search}&quot;
              <button onClick={clearSearch} className="ml-1 hover:text-foreground">×</button>
            </Badge>
          )}

          {/* Clear Filters */}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetFilters();
                setSearchValue('');
              }}
            >
              Clear All Filters
            </Button>
          )}
        </div>
      ) : null}

      {/* Bottom Row: View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Density Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-1.5" />
                Density
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {DENSITY_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => setDensity(option.value)}
                    className={density === option.value ? 'bg-accent' : ''}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {option.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Columns ({visibleColumnsCount})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {columnOrder
                .filter(colId => colId !== 'select' && colId !== 'actions')
                .map((columnId) => (
                <DropdownMenuCheckboxItem
                  key={columnId}
                  checked={columnVisibility[columnId]}
                  onCheckedChange={() => toggleColumnVisibility(columnId)}
                >
                  {columnId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetColumnPreferences}>
                Reset to Default
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Selection Summary */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{selectedCount} selected</Badge>
            <Button variant="ghost" size="sm" onClick={deselectAll}>
              Clear Selection
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Save Search Dialog */}
      <SaveSearchDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={(name) => {
          saveSearch(name, filters.search, {
            status: filters.status,
            type: filters.type,
          });
        }}
        currentQuery={filters.search}
      />
    </div>
  );
}
