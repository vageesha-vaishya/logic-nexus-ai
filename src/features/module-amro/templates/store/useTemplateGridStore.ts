/**
 * Work Package Templates Enterprise Grid State Store
 * 
 * Zustand store for managing grid state including:
 * - Pagination
 * - Sorting
 * - Filtering
 * - Selection
 * - Column management
 * - UI preferences
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ── Types ──────────────────────────────────────────────────────────────────────

export type GridDensity = 'compact' | 'normal' | 'comfortable';
export type GridViewMode = 'table' | 'card';

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface TemplateFilters {
  search: string;
  maintenanceType: string | null;
  status: string | null;
  aircraftModels: string[];
  updatedAtGte?: string;
  updatedAtLte?: string;
  tasksCountGte?: number;
  tasksCountLte?: number;
}

export interface BulkOperation {
  type: 'delete' | 'status-change' | 'export';
  progress: number;
  total: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  error: string | null;
}

export interface ContextMenuState {
  x: number;
  y: number;
  rowId: string | null;
}

interface TemplateGridState {
  // Pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  setPageIndex: (index: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  resetPagination: () => void;
  
  // Sorting
  sort: SortConfig[];
  setSort: (sort: SortConfig[]) => void;
  addSort: (field: string, direction: 'asc' | 'desc') => void;
  removeSort: (field: string) => void;
  clearSort: () => void;
  
  // Filtering
  filters: TemplateFilters;
  setFilters: (filters: Partial<TemplateFilters>) => void;
  resetFilters: () => void;
  
  // Selection
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setSelection: (ids: Set<string>) => void;
  
  // Column Management
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizes: Record<string, number>;
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
  toggleColumnVisibility: (columnId: string) => void;
  setColumnOrder: (order: string[]) => void;
  setColumnSize: (columnId: string, size: number) => void;
  resetColumnPreferences: () => void;
  
  // UI State
  density: GridDensity;
  viewMode: GridViewMode;
  contextMenu: ContextMenuState;
  setDensity: (density: GridDensity) => void;
  setViewMode: (mode: GridViewMode) => void;
  setContextMenu: (menu: ContextMenuState | null) => void;
  
  // Bulk Operations
  bulkOperation: BulkOperation | null;
  setBulkOperation: (operation: BulkOperation | null) => void;
  
  // State Management
  resetState: () => void;
}

// ── Default Values ─────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS = [
  'select',
  'template_code',
  'template_name',
  'maintenance_type',
  'aircraft_model',
  'version',
  'status',
  'tasks_count',
  'updated_at',
  'actions',
];

const HIDDEN_BY_DEFAULT = [
  'description',
  'created_at',
  'created_by',
  'updated_by',
  'estimated_labor_hours',
];

const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
  select: true,
  template_code: true,
  template_name: true,
  maintenance_type: true,
  aircraft_model: true,
  version: true,
  status: true,
  tasks_count: true,
  updated_at: true,
  actions: true,
  description: false,
  created_at: false,
  created_by: false,
  updated_by: false,
  estimated_labor_hours: false,
};

const DEFAULT_COLUMN_ORDER = [...DEFAULT_COLUMNS, ...HIDDEN_BY_DEFAULT];

const DEFAULT_FILTERS: TemplateFilters = {
  search: '',
  maintenanceType: null,
  status: null,
  aircraftModels: [],
};

// ── Store Creation ─────────────────────────────────────────────────────────────

export const useTemplateGridStore = create<TemplateGridState>()(
  persist(
    (set, get) => ({
      // Pagination
      pageIndex: 0,
      pageSize: 20,
      totalCount: 0,
      setPageIndex: (index) => set({ pageIndex: index }),
      setPageSize: (size) => set({ pageSize: size, pageIndex: 0 }),
      setTotalCount: (count) => set({ totalCount: count }),
      resetPagination: () => set({ pageIndex: 0 }),
      
      // Sorting
      sort: [],
      setSort: (sort) => set({ sort }),
      addSort: (field, direction) => {
        const { sort } = get();
        const existing = sort.findIndex(s => s.field === field);
        if (existing >= 0) {
          const newSort = [...sort];
          newSort[existing] = { field, direction };
          set({ sort: newSort });
        } else {
          set({ sort: [...sort, { field, direction }] });
        }
      },
      removeSort: (field) => {
        const { sort } = get();
        set({ sort: sort.filter(s => s.field !== field) });
      },
      clearSort: () => set({ sort: [] }),
      
      // Filtering
      filters: DEFAULT_FILTERS,
      setFilters: (filters) => {
        set({ filters: { ...get().filters, ...filters } });
        get().resetPagination();
      },
      resetFilters: () => {
        set({ filters: { ...DEFAULT_FILTERS } });
        get().resetPagination();
      },
      
      // Selection
      selectedIds: new Set(),
      toggleSelection: (id) => {
        const { selectedIds } = get();
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
          newSelection.delete(id);
        } else {
          newSelection.add(id);
        }
        set({ selectedIds: newSelection });
      },
      selectAll: () => {
        // This will be called with all IDs from the parent component
        console.warn('selectAll called without IDs - use setSelection instead');
      },
      deselectAll: () => set({ selectedIds: new Set() }),
      setSelection: (ids) => set({ selectedIds: ids }),
      
      // Column Management
      columnVisibility: DEFAULT_COLUMN_VISIBILITY,
      columnOrder: DEFAULT_COLUMN_ORDER,
      columnSizes: {},
      setColumnVisibility: (visibility) => set({ columnVisibility: visibility }),
      toggleColumnVisibility: (columnId) => {
        const { columnVisibility } = get();
        set({
          columnVisibility: {
            ...columnVisibility,
            [columnId]: !columnVisibility[columnId],
          },
        });
      },
      setColumnOrder: (order) => set({ columnOrder: order }),
      setColumnSize: (columnId, size) => {
        const { columnSizes } = get();
        set({ columnSizes: { ...columnSizes, [columnId]: size } });
      },
      resetColumnPreferences: () => {
        set({
          columnVisibility: DEFAULT_COLUMN_VISIBILITY,
          columnOrder: DEFAULT_COLUMN_ORDER,
          columnSizes: {},
        });
      },
      
      // UI State
      density: 'normal',
      viewMode: 'table',
      contextMenu: { x: 0, y: 0, rowId: null },
      setDensity: (density) => set({ density }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setContextMenu: (menu) => set({ contextMenu: menu }),
      
      // Bulk Operations
      bulkOperation: null,
      setBulkOperation: (operation) => set({ bulkOperation: operation }),
      
      // State Management
      resetState: () => {
        set({
          pageIndex: 0,
          pageSize: 20,
          totalCount: 0,
          sort: [],
          filters: { ...DEFAULT_FILTERS },
          selectedIds: new Set(),
          columnVisibility: DEFAULT_COLUMN_VISIBILITY,
          columnOrder: DEFAULT_COLUMN_ORDER,
          columnSizes: {},
          density: 'normal',
          viewMode: 'table',
          contextMenu: { x: 0, y: 0, rowId: null },
          bulkOperation: null,
        });
      },
    }),
    {
      name: 'template-grid-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pageSize: state.pageSize,
        sort: state.sort,
        columnVisibility: state.columnVisibility,
        columnOrder: state.columnOrder,
        columnSizes: state.columnSizes,
        density: state.density,
        viewMode: state.viewMode,
      }),
    }
  )
);

// ── Utility Hooks ──────────────────────────────────────────────────────────────

/**
 * Hook to get visible columns based on visibility and order
 */
export function useVisibleColumns() {
  const { columnVisibility, columnOrder } = useTemplateGridStore();
  
  return columnOrder.filter(columnId => columnVisibility[columnId]);
}

/**
 * Hook to get sort parameters as API query string
 */
export function useSortQueryString() {
  const { sort } = useTemplateGridStore();
  
  if (sort.length === 0) return '';
  
  return sort.map(s => `${s.field}:${s.direction}`).join(',');
}

/**
 * Hook to get filter parameters as API query object
 */
export function useFilterQueryParams() {
  const { filters } = useTemplateGridStore();
  
  const params: Record<string, any> = {};
  
  if (filters.search) {
    params.search = filters.search;
  }
  
  if (filters.maintenanceType && filters.maintenanceType !== 'all') {
    params.maintenance_type = filters.maintenanceType;
  }
  
  if (filters.status && filters.status !== 'all') {
    params.status = filters.status;
  }
  
  if (filters.aircraftModels.length > 0) {
    params.aircraft_model = filters.aircraftModels;
  }
  
  if (filters.updatedAtGte) {
    params.updated_at_gte = filters.updatedAtGte;
  }
  
  if (filters.updatedAtLte) {
    params.updated_at_lte = filters.updatedAtLte;
  }
  
  if (filters.tasksCountGte !== undefined) {
    params.tasks_count_gte = filters.tasksCountGte;
  }
  
  if (filters.tasksCountLte !== undefined) {
    params.tasks_count_lte = filters.tasksCountLte;
  }
  
  return params;
}
