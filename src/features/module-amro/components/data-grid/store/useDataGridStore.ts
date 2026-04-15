/**
 * AMRO Data Grid State Store
 *
 * Zustand store for managing advanced data grid state including:
 * - Pagination
 * - Multi-column sorting
 * - Filtering with search history
 * - Row selection
 * - Column management (visibility, order, sizes)
 * - UI preferences (density, view mode)
 * - Record detail panel state
 * - Wizard form state
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GridDensity = 'compact' | 'normal' | 'comfortable';
export type GridViewMode = 'table' | 'card';
export type DetailViewMode = 'none' | 'modal' | 'panel';

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
  order: number; // For multi-sort ordering
}

export interface ColumnConfig {
  id: string;
  label: string;
  accessor: string | ((row: any) => any);
  sortable?: boolean;
  searchable?: boolean;
  resizable?: boolean;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  visible?: boolean;
  format?: 'text' | 'number' | 'currency' | 'date' | 'badge' | 'actions';
}

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount?: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, any>;
  createdAt: number;
}

export interface DataGridFilters {
  search: string;
  status: string | null;
  type: string | null;
  dateFrom?: string;
  dateTo?: string;
  [key: string]: any;
}

export interface BulkOperation {
  type: 'delete' | 'export' | 'import' | 'status-change';
  progress: number;
  total: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  error: string | null;
}

export interface ImportState {
  isOpen: boolean;
  file: File | null;
  preview: any[] | null;
  validation: {
    total: number;
    valid: number;
    invalid: number;
    errors: Array<{ row: number; field: string; message: string }>;
  } | null;
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  valid: boolean;
}

export interface WizardState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  currentStep: number;
  steps: WizardStep[];
  draft: Record<string, any> | null;
  draftSavedAt: number | null;
  recordId: string | null;
}

interface DataGridState {
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
  addSort: (field: string, direction: 'asc' | 'desc', multi?: boolean) => void;
  removeSort: (field: string) => void;
  clearSort: () => void;

  // Filtering
  filters: DataGridFilters;
  setFilters: (filters: Partial<DataGridFilters>) => void;
  resetFilters: () => void;

  // Search History
  searchHistory: SearchHistoryItem[];
  addToSearchHistory: (query: string, resultCount?: number) => void;
  clearSearchHistory: () => void;

  // Saved Searches
  savedSearches: SavedSearch[];
  saveSearch: (name: string, query: string, filters: Record<string, any>) => void;
  deleteSavedSearch: (id: string) => void;
  loadSavedSearch: (search: SavedSearch) => void;

  // Selection
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  setSelection: (ids: Set<string>) => void;

  // Column Management
  columns: ColumnConfig[];
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizes: Record<string, number>;
  setColumns: (columns: ColumnConfig[]) => void;
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
  toggleColumnVisibility: (columnId: string) => void;
  setColumnOrder: (order: string[]) => void;
  setColumnSize: (columnId: string, size: number) => void;
  resetColumnPreferences: () => void;

  // UI State
  density: GridDensity;
  viewMode: GridViewMode;
  detailViewMode: DetailViewMode;
  setDensity: (density: GridDensity) => void;
  setViewMode: (mode: GridViewMode) => void;
  setDetailViewMode: (mode: DetailViewMode) => void;

  // Record Detail
  selectedRecord: Record<string, any> | null;
  isDetailOpen: boolean;
  detailMode: 'view' | 'edit';
  openRecordDetail: (record: Record<string, any>, mode?: 'view' | 'edit') => void;
  closeRecordDetail: () => void;
  setDetailMode: (mode: 'view' | 'edit') => void;

  // Wizard
  wizard: WizardState;
  openWizard: (mode: 'create' | 'edit', recordId?: string) => void;
  closeWizard: () => void;
  setWizardStep: (step: number) => void;
  completeWizardStep: (stepId: string) => void;
  setWizardDraft: (draft: Record<string, any>) => void;
  saveWizardDraft: () => void;

  // Bulk Operations
  bulkOperation: BulkOperation | null;
  setBulkOperation: (operation: BulkOperation | null) => void;

  // Import
  importState: ImportState;
  setImportState: (state: Partial<ImportState>) => void;
  openImport: () => void;
  closeImport: () => void;

  // Loading States
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // State Management
  resetState: () => void;
}

// ── Default Values ─────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'select', label: '', accessor: 'id', sortable: false, resizable: false, visible: true, defaultWidth: 48 },
  { id: 'part_number', label: 'Part Number', accessor: 'part_number', sortable: true, searchable: true, resizable: true, visible: true, defaultWidth: 150, minWidth: 100, maxWidth: 300 },
  { id: 'description', label: 'Description', accessor: 'description', sortable: true, searchable: true, resizable: true, visible: true, defaultWidth: 250, minWidth: 150, maxWidth: 500 },
  { id: 'type', label: 'Type', accessor: 'type', sortable: true, searchable: true, resizable: true, visible: true, format: 'badge', defaultWidth: 100, minWidth: 80, maxWidth: 200 },
  { id: 'status', label: 'Status', accessor: 'status', sortable: true, resizable: true, visible: true, format: 'badge', defaultWidth: 120, minWidth: 80, maxWidth: 200 },
  { id: 'quantity', label: 'Qty', accessor: 'quantity', sortable: true, resizable: true, visible: true, format: 'number', defaultWidth: 80, minWidth: 60, maxWidth: 150 },
  { id: 'location', label: 'Location', accessor: 'location', sortable: true, searchable: true, resizable: true, visible: true, defaultWidth: 120, minWidth: 80, maxWidth: 200 },
  { id: 'unit_cost', label: 'Unit Cost', accessor: 'unit_cost', sortable: true, resizable: true, visible: false, format: 'currency', defaultWidth: 120, minWidth: 80, maxWidth: 200 },
  { id: 'updated_at', label: 'Updated', accessor: 'updated_at', sortable: true, resizable: true, visible: false, format: 'date', defaultWidth: 120, minWidth: 80, maxWidth: 200 },
  { id: 'actions', label: 'Actions', accessor: 'id', sortable: false, resizable: false, visible: true, format: 'actions', defaultWidth: 100 },
];

const DEFAULT_FILTERS: DataGridFilters = {
  search: '',
  status: null,
  type: null,
};

const DEFAULT_WIZARD_STEPS: WizardStep[] = [
  { id: 'identity', title: 'Identity', description: 'Part identification details', completed: false, valid: false },
  { id: 'specifications', title: 'Specifications', description: 'Technical specifications', completed: false, valid: false },
  { id: 'inventory', title: 'Inventory', description: 'Stock and location details', completed: false, valid: false },
  { id: 'review', title: 'Review', description: 'Confirm and submit', completed: false, valid: false },
];

// ── Store Creation ─────────────────────────────────────────────────────────────

export const useDataGridStore = create<DataGridState>()(
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
      addSort: (field, direction, multi = false) => {
        const { sort } = get();
        if (multi) {
          const existing = sort.findIndex(s => s.field === field);
          if (existing >= 0) {
            const newSort = [...sort];
            const currentDir = newSort[existing].direction;
            if (currentDir === 'asc') {
              newSort[existing] = { ...newSort[existing], direction: 'desc' };
            } else if (currentDir === 'desc') {
              newSort.splice(existing, 1);
            }
            set({ sort: newSort });
          } else {
            set({ sort: [...sort, { field, direction, order: sort.length + 1 }] });
          }
        } else {
          if (sort.length === 1 && sort[0].field === field) {
            if (sort[0].direction === 'asc') {
              set({ sort: [{ field, direction: 'desc', order: 1 }] });
            } else {
              set({ sort: [] });
            }
          } else {
            set({ sort: [{ field, direction, order: 1 }] });
          }
        }
      },
      removeSort: (field) => {
        const { sort } = get();
        set({ sort: sort.filter(s => s.field !== field).map((s, i) => ({ ...s, order: i + 1 })) });
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

      // Search History
      searchHistory: [],
      addToSearchHistory: (query, resultCount) => {
        if (!query.trim()) return;
        const { searchHistory } = get();
        const newHistory = [
          { query, timestamp: Date.now(), resultCount },
          ...searchHistory.filter(h => h.query !== query).slice(0, 9),
        ];
        set({ searchHistory: newHistory });
      },
      clearSearchHistory: () => set({ searchHistory: [] }),

      // Saved Searches
      savedSearches: [],
      saveSearch: (name, query, filters) => {
        const { savedSearches } = get();
        const newSearch: SavedSearch = {
          id: `search-${Date.now()}`,
          name,
          query,
          filters,
          createdAt: Date.now(),
        };
        set({ savedSearches: [...savedSearches, newSearch] });
      },
      deleteSavedSearch: (id) => {
        const { savedSearches } = get();
        set({ savedSearches: savedSearches.filter(s => s.id !== id) });
      },
      loadSavedSearch: (search) => {
        set({
          filters: { ...DEFAULT_FILTERS, search: search.query, ...search.filters },
        });
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
      selectAll: (ids) => set({ selectedIds: new Set(ids) }),
      deselectAll: () => set({ selectedIds: new Set() }),
      setSelection: (ids) => set({ selectedIds: ids }),

      // Column Management
      columns: DEFAULT_COLUMNS,
      columnVisibility: Object.fromEntries(DEFAULT_COLUMNS.filter(c => c.visible !== false).map(c => [c.id, true])),
      columnOrder: DEFAULT_COLUMNS.map(c => c.id),
      columnSizes: {},
      setColumns: (columns) => {
        set({ columns });
        set({ columnVisibility: Object.fromEntries(columns.filter(c => c.visible !== false).map(c => [c.id, true])) });
        set({ columnOrder: columns.map(c => c.id) });
      },
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
          columnVisibility: Object.fromEntries(DEFAULT_COLUMNS.filter(c => c.visible !== false).map(c => [c.id, true])),
          columnOrder: DEFAULT_COLUMNS.map(c => c.id),
          columnSizes: {},
        });
      },

      // UI State
      density: 'normal',
      viewMode: 'table',
      detailViewMode: 'modal',
      setDensity: (density) => set({ density }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setDetailViewMode: (mode) => set({ detailViewMode: mode }),

      // Record Detail
      selectedRecord: null,
      isDetailOpen: false,
      detailMode: 'view',
      openRecordDetail: (record, mode = 'view') => set({ selectedRecord: record, isDetailOpen: true, detailMode: mode }),
      closeRecordDetail: () => set({ selectedRecord: null, isDetailOpen: false, detailMode: 'view' }),
      setDetailMode: (mode) => set({ detailMode: mode }),

      // Wizard
      wizard: {
        isOpen: false,
        mode: 'create',
        currentStep: 0,
        steps: DEFAULT_WIZARD_STEPS,
        draft: null,
        draftSavedAt: null,
        recordId: null,
      },
      openWizard: (mode, recordId) => set({
        wizard: {
          isOpen: true,
          mode,
          currentStep: 0,
          steps: DEFAULT_WIZARD_STEPS.map(s => ({ ...s, completed: false, valid: false })),
          draft: null,
          draftSavedAt: null,
          recordId: recordId || null,
        },
      }),
      closeWizard: () => set({
        wizard: {
          isOpen: false,
          mode: 'create',
          currentStep: 0,
          steps: DEFAULT_WIZARD_STEPS,
          draft: null,
          draftSavedAt: null,
          recordId: null,
        },
      }),
      setWizardStep: (step) => {
        const { wizard } = get();
        set({ wizard: { ...wizard, currentStep: step } });
      },
      completeWizardStep: (stepId) => {
        const { wizard } = get();
        set({
          wizard: {
            ...wizard,
            steps: wizard.steps.map(s =>
              s.id === stepId ? { ...s, completed: true, valid: true } : s
            ),
          },
        });
      },
      setWizardDraft: (draft) => {
        const { wizard } = get();
        set({ wizard: { ...wizard, draft } });
      },
      saveWizardDraft: () => {
        const { wizard } = get();
        set({ wizard: { ...wizard, draftSavedAt: Date.now() } });
      },

      // Bulk Operations
      bulkOperation: null,
      setBulkOperation: (operation) => set({ bulkOperation: operation }),

      // Import
      importState: {
        isOpen: false,
        file: null,
        preview: null,
        validation: null,
      },
      setImportState: (state) => {
        const { importState } = get();
        set({ importState: { ...importState, ...state } });
      },
      openImport: () => set({
        importState: { isOpen: true, file: null, preview: null, validation: null },
      }),
      closeImport: () => set({
        importState: { isOpen: false, file: null, preview: null, validation: null },
      }),

      // Loading States
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      // State Management
      resetState: () => {
        set({
          pageIndex: 0,
          pageSize: 20,
          totalCount: 0,
          sort: [],
          filters: { ...DEFAULT_FILTERS },
          selectedIds: new Set(),
          columnVisibility: Object.fromEntries(DEFAULT_COLUMNS.filter(c => c.visible !== false).map(c => [c.id, true])),
          columnOrder: DEFAULT_COLUMNS.map(c => c.id),
          columnSizes: {},
          density: 'normal',
          viewMode: 'table',
          detailViewMode: 'modal',
          selectedRecord: null,
          isDetailOpen: false,
          detailMode: 'view',
          wizard: {
            isOpen: false,
            mode: 'create',
            currentStep: 0,
            steps: DEFAULT_WIZARD_STEPS,
            draft: null,
            draftSavedAt: null,
            recordId: null,
          },
          bulkOperation: null,
          importState: { isOpen: false, file: null, preview: null, validation: null },
          isLoading: false,
          searchHistory: [],
          savedSearches: [],
        });
      },
    }),
    {
      name: 'amro-data-grid-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pageSize: state.pageSize,
        sort: state.sort,
        columnVisibility: state.columnVisibility,
        columnOrder: state.columnOrder,
        columnSizes: state.columnSizes,
        density: state.density,
        viewMode: state.viewMode,
        detailViewMode: state.detailViewMode,
        savedSearches: state.savedSearches,
      }),
    }
  )
);

// ── Utility Hooks ──────────────────────────────────────────────────────────────

/**
 * Hook to get visible columns based on visibility and order
 */
export function useVisibleColumns() {
  const { columns, columnVisibility, columnOrder } = useDataGridStore();

  return columnOrder
    .filter(columnId => columnVisibility[columnId])
    .map(id => columns.find(c => c.id === id))
    .filter(Boolean) as ColumnConfig[];
}

/**
 * Hook to get sort parameters as API query string
 */
export function useSortQueryString() {
  const { sort } = useDataGridStore();

  if (sort.length === 0) return '';

  return sort.map(s => `${s.field}:${s.direction}`).join(',');
}

/**
 * Hook to get filter parameters as API query object
 */
export function useFilterQueryParams() {
  const { filters } = useDataGridStore();

  const params: Record<string, any> = {};

  if (filters.search) {
    params.search = filters.search;
  }

  if (filters.status && filters.status !== 'all') {
    params.status = filters.status;
  }

  if (filters.type && filters.type !== 'all') {
    params.type = filters.type;
  }

  if (filters.dateFrom) {
    params.date_from = filters.dateFrom;
  }

  if (filters.dateTo) {
    params.date_to = filters.dateTo;
  }

  return params;
}
