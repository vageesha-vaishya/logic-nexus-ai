/**
 * Grid Toolbar Component for Work Package Templates
 * 
 * Features:
 * - Search input with debounce
 * - Filter bar (maintenance type, status, aircraft model)
 * - Action buttons (New Template, Bulk Actions, Export)
 * - View controls (density, view mode, column visibility)
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Download, Filter, LayoutGrid, List, MoreHorizontal, Plus, RefreshCw,
  Settings, Table2, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTemplateGridStore, GridDensity, GridViewMode } from '../store/useTemplateGridStore';
import { WorkOrderTemplate } from '../AmroWorkOrderTemplatesPage';

// ── Types ──────────────────────────────────────────────────────────────────────

interface GridToolbarProps {
  onNewTemplate: () => void;
  onBulkDelete: () => void;
  onExport: (format: 'csv' | 'xlsx' | 'pdf') => void;
  onRefresh: () => void;
  isLoading: boolean;
  aircraftModels: Array<{ id: string; name: string; code: string }>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MAINTENANCE_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'line', label: 'Line Maintenance' },
  { value: 'base', label: 'Base Maintenance' },
  { value: 'component', label: 'Component Maintenance' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'overhaul', label: 'Overhaul' },
  { value: 'repair', label: 'Repair' },
  { value: 'upgrade', label: 'Upgrade' },
  { value: 'modification', label: 'Modification' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'deprecated', label: 'Deprecated' },
  { value: 'archived', label: 'Archived' },
];

const DENSITY_OPTIONS: Array<{ value: GridDensity; label: string; icon: any }> = [
  { value: 'compact', label: 'Compact', icon: Table2 },
  { value: 'normal', label: 'Normal', icon: LayoutGrid },
  { value: 'comfortable', label: 'Comfortable', icon: List },
];

const EXPORT_FORMATS: Array<{ value: 'csv' | 'xlsx' | 'pdf'; label: string; extension: string }> = [
  { value: 'csv', label: 'CSV', extension: '.csv' },
  { value: 'xlsx', label: 'Excel', extension: '.xlsx' },
  { value: 'pdf', label: 'PDF', extension: '.pdf' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function GridToolbar({
  onNewTemplate,
  onBulkDelete,
  onExport,
  onRefresh,
  isLoading,
  aircraftModels,
}: GridToolbarProps) {
  const {
    filters,
    setFilters,
    selectedIds,
    deselectAll,
    density,
    setDensity,
    viewMode,
    setViewMode,
    columnVisibility,
    toggleColumnVisibility,
    columnOrder,
    resetColumnPreferences,
  } = useTemplateGridStore();

  const [searchValue, setSearchValue] = useState(filters.search);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      const timeoutId = setTimeout(() => {
        setFilters({ search: value });
      }, 300);
      
      return () => clearTimeout(timeoutId);
    },
    [setFilters]
  );

  // Handle search input change
  const onSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleSearchChange(e.target.value);
    },
    [handleSearchChange]
  );

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchValue('');
    setFilters({ search: '' });
  }, [setFilters]);

  // Selected count
  const selectedCount = selectedIds.size;

  // Visible columns count
  const visibleColumnsCount = useMemo(
    () => Object.values(columnVisibility).filter(Boolean).length,
    [columnVisibility]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Top Row: Search and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="flex-1 w-full sm:max-w-sm">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search templates..."
              value={searchValue}
              onChange={onSearchInputChange}
              className="pr-8"
              aria-label="Search work package templates"
            />
            {searchValue && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh templates"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Bulk Actions */}
          {selectedCount > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="w-4 h-4 mr-2" />
                  Bulk Actions ({selectedCount})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onBulkDelete} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onExport('csv')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Selected (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {EXPORT_FORMATS.map((format) => (
                <DropdownMenuItem key={format.value} onClick={() => onExport(format.value)}>
                  Export as {format.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* New Template */}
          <Button onClick={onNewTemplate} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        
        {/* Maintenance Type Filter */}
        <Select
          value={filters.maintenanceType || 'all'}
          onValueChange={(value) => setFilters({ maintenanceType: value === 'all' ? null : value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Maintenance Type" />
          </SelectTrigger>
          <SelectContent>
            {MAINTENANCE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onValueChange={(value) => setFilters({ status: value === 'all' ? null : value })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Active Filters */}
        {filters.search && (
          <Badge variant="secondary" className="gap-1">
            Search: "{filters.search}"
            <button onClick={clearSearch} className="ml-1 hover:text-foreground">×</button>
          </Badge>
        )}
        {filters.aircraftModels.length > 0 && (
          <Badge variant="secondary" className="gap-1">
            Models: {filters.aircraftModels.length}
            <button onClick={() => setFilters({ aircraftModels: [] })} className="ml-1 hover:text-foreground">×</button>
          </Badge>
        )}

        {/* Clear Filters */}
        {(filters.search || filters.maintenanceType || filters.status || filters.aircraftModels.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearSearch();
              setFilters({ maintenanceType: null, status: null, aircraftModels: [] });
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Bottom Row: View Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Density Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Density
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {DENSITY_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setDensity(option.value)}
                  className={density === option.value ? 'bg-accent' : ''}
                >
                  <option.icon className="w-4 h-4 mr-2" />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Mode Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="rounded-r-none"
              aria-label="Table view"
            >
              <Table2 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className="rounded-l-none"
              aria-label="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                Columns ({visibleColumnsCount})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {columnOrder.map((columnId) => (
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
    </div>
  );
}
