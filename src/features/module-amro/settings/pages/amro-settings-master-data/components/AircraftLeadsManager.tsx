import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { EditableText } from '@/components/ui/editable-text';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowDown, ArrowUp, Download, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { parseFileRows, exportCsv, exportExcel } from '@/lib/import-export';
import { themeStyleFromPreset } from '@/lib/theme-utils';
import { THEME_PRESETS } from '@/theme/themes';
import type { Lead } from '@/pages/dashboard/leads-data';
import type { ColumnType } from '@/components/kanban/KanbanBoard';
import type { KanbanItem } from '@/components/kanban/KanbanCard';
import { parseApiPayload } from '../services';

const LazyKanbanBoard = lazy(() =>
  import('@/components/kanban/KanbanBoard').then((module) => ({ default: module.KanbanBoard })),
);
const LazyPipelineAnalytics = lazy(() =>
  import('@/components/analytics/PipelineAnalytics').then((module) => ({ default: module.PipelineAnalytics })),
);

type AircraftLeadRecord = {
  id: string;
  aircraft_id: string;
  aircraft_registration: string;
  aircraft_type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  source: string;
  score: number;
  assigned_to: string;
  maintenance_due_at: string;
  next_action_due_at: string;
  compliance_state: string;
  regulatory_authority: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type SavedFilter = {
  id: string;
  name: string;
  filters: {
    status: string;
    priority: string;
    aircraftType: string;
    complianceState: string;
  };
};

type AircraftLeadsManagerProps = {
  scope: {
    tenantId: string;
    franchiseId: string;
    userId: string;
  };
  sessionAccessToken: string;
  canManage: boolean;
  canDelete: boolean;
  activeTab?: AircraftLeadsTab;
  onActiveTabChange?: (tab: AircraftLeadsTab) => void;
};

export type AircraftLeadsTab = 'pipeline' | 'list' | 'grid' | 'card' | 'analytics' | 'import_export';

const PAGE_SIZE_OPTIONS = ['25', '50', '100'];
const AIRCRAFT_LEADS_SORT_OPTIONS = [
  { label: 'Updated', value: 'updated_at' },
  { label: 'Score', value: 'score' },
  { label: 'Due Date', value: 'maintenance_due_at' },
  { label: 'Title', value: 'title' },
];
const AIRCRAFT_LEAD_IMPORT_FIELDS = [
  'title',
  'aircraft_id',
  'aircraft_registration',
  'aircraft_type',
  'status',
  'priority',
  'source',
  'assigned_to',
  'score',
  'maintenance_due_at',
  'next_action_due_at',
  'compliance_state',
  'regulatory_authority',
  'description',
  'tags',
] as const;

type LeadListColumnKey =
  | 'title'
  | 'aircraft'
  | 'aircraft_type'
  | 'status'
  | 'priority'
  | 'maintenance_due_at'
  | 'compliance_state'
  | 'assigned_to';

type LeadListColumnDefinition = {
  key: LeadListColumnKey;
  label: string;
  sortKey: string;
  defaultWidth: number;
  value: (row: AircraftLeadRecord) => string;
  render: (row: AircraftLeadRecord) => string;
};

const LEAD_LIST_COLUMNS: LeadListColumnDefinition[] = [
  {
    key: 'title',
    label: 'Title',
    sortKey: 'title',
    defaultWidth: 280,
    value: (row) => String(row.title || ''),
    render: (row) => String(row.title || '-'),
  },
  {
    key: 'aircraft',
    label: 'Aircraft',
    sortKey: 'aircraft_registration',
    defaultWidth: 170,
    value: (row) => String(row.aircraft_registration || row.aircraft_id || ''),
    render: (row) => String(row.aircraft_registration || row.aircraft_id || '-'),
  },
  {
    key: 'aircraft_type',
    label: 'Type',
    sortKey: 'aircraft_type',
    defaultWidth: 140,
    value: (row) => String(row.aircraft_type || ''),
    render: (row) => String(row.aircraft_type || '-'),
  },
  {
    key: 'status',
    label: 'Status',
    sortKey: 'status',
    defaultWidth: 140,
    value: (row) => String(row.status || ''),
    render: (row) => String(row.status || '-'),
  },
  {
    key: 'priority',
    label: 'Priority',
    sortKey: 'priority',
    defaultWidth: 140,
    value: (row) => String(row.priority || ''),
    render: (row) => String(row.priority || '-'),
  },
  {
    key: 'maintenance_due_at',
    label: 'Due',
    sortKey: 'maintenance_due_at',
    defaultWidth: 150,
    value: (row) => String(row.maintenance_due_at || '').slice(0, 10),
    render: (row) => (row.maintenance_due_at ? String(row.maintenance_due_at).slice(0, 10) : '-'),
  },
  {
    key: 'compliance_state',
    label: 'Compliance',
    sortKey: 'compliance_state',
    defaultWidth: 160,
    value: (row) => String(row.compliance_state || ''),
    render: (row) => String(row.compliance_state || '-'),
  },
  {
    key: 'assigned_to',
    label: 'Assignee',
    sortKey: 'assigned_to',
    defaultWidth: 160,
    value: (row) => String(row.assigned_to || ''),
    render: (row) => String(row.assigned_to || '-'),
  },
];

function normalizeLeadRecord(value: unknown): AircraftLeadRecord {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id: String(row.id || ''),
    aircraft_id: String(row.aircraft_id || ''),
    aircraft_registration: String(row.aircraft_registration || ''),
    aircraft_type: String(row.aircraft_type || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    status: String(row.status || 'new'),
    priority: String(row.priority || 'medium'),
    source: String(row.source || 'manual'),
    score: Number(row.score || 0),
    assigned_to: String(row.assigned_to || ''),
    maintenance_due_at: String(row.maintenance_due_at || ''),
    next_action_due_at: String(row.next_action_due_at || ''),
    compliance_state: String(row.compliance_state || 'monitoring'),
    regulatory_authority: String(row.regulatory_authority || 'DGCA'),
    tags: Array.isArray(row.tags) ? row.tags.map((item) => String(item || '')).filter(Boolean) : [],
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

export function AircraftLeadsManager({
  scope,
  sessionAccessToken,
  canManage,
  canDelete,
  activeTab: activeTabProp,
  onActiveTabChange,
}: AircraftLeadsManagerProps) {
  const [rows, setRows] = useState<AircraftLeadRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [autocompleteOptions, setAutocompleteOptions] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [aircraftTypeFilter, setAircraftTypeFilter] = useState('all');
  const [complianceStateFilter, setComplianceStateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('25');
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [internalActiveTab, setInternalActiveTab] = useState<AircraftLeadsTab>('list');
  const [gridColumns, setGridColumns] = useState<'2' | '3' | '4'>('3');
  const [activeTheme, setActiveTheme] = useState('Default Simple');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [importFileName, setImportFileName] = useState('');
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [savedFilterName, setSavedFilterName] = useState('');
  const [selectedSavedFilterId, setSelectedSavedFilterId] = useState('none');
  const [visibleListColumns, setVisibleListColumns] = useState<LeadListColumnKey[]>(() => LEAD_LIST_COLUMNS.map((column) => column.key));
  const [columnSearchFilters, setColumnSearchFilters] = useState<Partial<Record<LeadListColumnKey, string>>>({});
  const [columnWidths, setColumnWidths] = useState<Record<LeadListColumnKey, number>>(() =>
    Object.fromEntries(LEAD_LIST_COLUMNS.map((column) => [column.key, column.defaultWidth])) as Record<LeadListColumnKey, number>,
  );

  const savedFiltersStorageKey = useMemo(
    () => `amro:aircraft-leads:saved-filters:${scope.tenantId || 'tenant'}:${scope.franchiseId || 'franchise'}`,
    [scope.franchiseId, scope.tenantId],
  );
  const listColumnsStorageKey = useMemo(
    () => `amro:aircraft-leads:list-columns:${scope.tenantId || 'tenant'}:${scope.franchiseId || 'franchise'}`,
    [scope.franchiseId, scope.tenantId],
  );
  const listColumnWidthsStorageKey = useMemo(
    () => `amro:aircraft-leads:list-column-widths:${scope.tenantId || 'tenant'}:${scope.franchiseId || 'franchise'}`,
    [scope.franchiseId, scope.tenantId],
  );
  const activeTab = activeTabProp || internalActiveTab;
  const setActiveTab = useCallback((tab: AircraftLeadsTab) => {
    if (!activeTabProp) {
      setInternalActiveTab(tab);
    }
    onActiveTabChange?.(tab);
  }, [activeTabProp, onActiveTabChange]);

  const buildHeaders = useCallback(() => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'x-tenant-id': scope.tenantId || '',
      'x-franchise-id': scope.franchiseId || '',
      'x-user-id': scope.userId || '',
    });
    if (sessionAccessToken) {
      headers.set('Authorization', `Bearer ${sessionAccessToken}`);
    }
    return headers;
  }, [scope.franchiseId, scope.tenantId, scope.userId, sessionAccessToken]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by: sortBy,
        sort_dir: sortDirection,
        search,
        status: statusFilter,
        priority: priorityFilter,
        aircraft_type: aircraftTypeFilter,
        compliance_state: complianceStateFilter,
      });
      const response = await fetch(`/api/v2/amro/aircraft-leads?${query.toString()}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to load aircraft leads'));
      }
      const output = payload?.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : {};
      const nextRows = (Array.isArray(output.records) ? output.records : []).map(normalizeLeadRecord);
      setRows(nextRows);
      setTotalCount(Number(output.total_count || 0));
    } catch (fetchError) {
      setError(String((fetchError as Error).message || 'Failed to load aircraft leads'));
    } finally {
      setLoading(false);
    }
  }, [
    aircraftTypeFilter,
    buildHeaders,
    complianceStateFilter,
    page,
    pageSize,
    priorityFilter,
    search,
    sortBy,
    sortDirection,
    statusFilter,
  ]);

  const loadAutocomplete = useCallback(async () => {
    try {
      if (!search.trim()) {
        setAutocompleteOptions([]);
        return;
      }
      const query = new URLSearchParams({
        autocomplete: '1',
        search,
      });
      const response = await fetch(`/api/v2/amro/aircraft-leads?${query.toString()}`, {
        method: 'GET',
        headers: buildHeaders(),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) return;
      const output = payload?.output && typeof payload.output === 'object' ? (payload.output as Record<string, unknown>) : {};
      setAutocompleteOptions(Array.isArray(output.suggestions) ? output.suggestions.map((item: unknown) => String(item || '')) : []);
    } catch {
      setAutocompleteOptions([]);
    }
  }, [buildHeaders, search]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAutocomplete();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadAutocomplete]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(savedFiltersStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const record = item as Record<string, unknown>;
          return {
            id: String(record.id || ''),
            name: String(record.name || ''),
            filters: {
              status: String((record.filters as Record<string, unknown> | undefined)?.status || 'all'),
              priority: String((record.filters as Record<string, unknown> | undefined)?.priority || 'all'),
              aircraftType: String((record.filters as Record<string, unknown> | undefined)?.aircraftType || 'all'),
              complianceState: String((record.filters as Record<string, unknown> | undefined)?.complianceState || 'all'),
            },
          } satisfies SavedFilter;
        })
        .filter((item): item is SavedFilter => Boolean(item?.id && item?.name));
      setSavedFilters(normalized);
    } catch {
      setSavedFilters([]);
    }
  }, [savedFiltersStorageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(listColumnsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const allowed = new Set<LeadListColumnKey>(LEAD_LIST_COLUMNS.map((column) => column.key));
      const normalized = parsed
        .map((item) => String(item || ''))
        .filter((item): item is LeadListColumnKey => allowed.has(item as LeadListColumnKey));
      if (normalized.length > 0) {
        setVisibleListColumns(LEAD_LIST_COLUMNS.map((column) => column.key).filter((key) => normalized.includes(key)));
      }
    } catch {
      setVisibleListColumns(LEAD_LIST_COLUMNS.map((column) => column.key));
    }
  }, [listColumnsStorageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(listColumnWidthsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      setColumnWidths((previous) => {
        const next = { ...previous };
        LEAD_LIST_COLUMNS.forEach((column) => {
          const candidate = Number((parsed as Record<string, unknown>)[column.key]);
          if (!Number.isFinite(candidate)) return;
          next[column.key] = Math.min(640, Math.max(110, Math.round(candidate)));
        });
        return next;
      });
    } catch {
      setColumnWidths(Object.fromEntries(LEAD_LIST_COLUMNS.map((column) => [column.key, column.defaultWidth])) as Record<LeadListColumnKey, number>);
    }
  }, [listColumnWidthsStorageKey]);

  useEffect(() => {
    localStorage.setItem(listColumnsStorageKey, JSON.stringify(visibleListColumns));
  }, [listColumnsStorageKey, visibleListColumns]);

  useEffect(() => {
    localStorage.setItem(listColumnWidthsStorageKey, JSON.stringify(columnWidths));
  }, [columnWidths, listColumnWidthsStorageKey]);

  const visibleListColumnDefinitions = useMemo(
    () => LEAD_LIST_COLUMNS.filter((column) => visibleListColumns.includes(column.key)),
    [visibleListColumns],
  );

  const listRows = useMemo(
    () =>
      rows.filter((row) =>
        visibleListColumnDefinitions.every((column) => {
          const filterValue = String(columnSearchFilters[column.key] || '').trim().toLowerCase();
          if (!filterValue) return true;
          return column.value(row).toLowerCase().includes(filterValue);
        })),
    [columnSearchFilters, rows, visibleListColumnDefinitions],
  );
  const totalPages = Math.max(1, Math.ceil(totalCount / Number(pageSize || '25')));
  const allSelected = listRows.length > 0 && listRows.every((row) => selectedIds.includes(row.id));
  const themeStyle = useMemo(() => themeStyleFromPreset(activeTheme), [activeTheme]);
  const pipelineColumns = useMemo<ColumnType[]>(
    () => [
      { id: 'new', title: 'New' },
      { id: 'qualified', title: 'Qualified' },
      { id: 'in_progress', title: 'In Progress' },
      { id: 'closed', title: 'Closed' },
    ],
    [],
  );
  const pipelineItems = useMemo<KanbanItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        title: row.title || 'Untitled',
        subtitle: `${row.aircraft_registration || row.aircraft_id || '-'} · ${row.aircraft_type || '-'}`,
        status: row.status || 'new',
        priority: (row.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
        value: row.score,
        assignee: row.assigned_to ? { name: row.assigned_to } : undefined,
        tags: row.tags,
        updatedAt: row.updated_at,
      })),
    [rows],
  );
  const analyticsLeads = useMemo<Lead[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        first_name: row.title || 'Lead',
        last_name: row.aircraft_registration || row.aircraft_id || 'Aircraft',
        email: '',
        company: row.aircraft_type || '',
        status: row.status || 'new',
        source: row.source || 'manual',
        estimated_value: Number(row.score || 0),
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      })) as Lead[],
    [rows],
  );
  const rowCountByStatus = useMemo(
    () =>
      pipelineColumns.map((column) => ({
        id: column.id,
        label: column.title,
        value: rows.filter((row) => row.status === column.id).length,
      })),
    [pipelineColumns, rows],
  );

  useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadLeads();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled, loadLeads]);

  const applySavedFilters = useCallback((savedFilterId: string) => {
    if (savedFilterId === 'none') {
      return;
    }
    const savedFilter = savedFilters.find((entry) => entry.id === savedFilterId);
    if (!savedFilter) return;
    setStatusFilter(savedFilter.filters.status);
    setPriorityFilter(savedFilter.filters.priority);
    setAircraftTypeFilter(savedFilter.filters.aircraftType);
    setComplianceStateFilter(savedFilter.filters.complianceState);
    setPage(1);
    setSelectedSavedFilterId(savedFilterId);
  }, [savedFilters]);

  const handleSaveFilter = useCallback(() => {
    const name = savedFilterName.trim();
    if (!name) {
      toast.error('Filter name is required');
      return;
    }
    const entry: SavedFilter = {
      id: `${Date.now()}`,
      name,
      filters: {
        status: statusFilter,
        priority: priorityFilter,
        aircraftType: aircraftTypeFilter,
        complianceState: complianceStateFilter,
      },
    };
    const next = [...savedFilters, entry].slice(-20);
    setSavedFilters(next);
    setSavedFilterName('');
    localStorage.setItem(savedFiltersStorageKey, JSON.stringify(next));
    toast.success('Saved filter');
  }, [aircraftTypeFilter, complianceStateFilter, priorityFilter, savedFilterName, savedFilters, savedFiltersStorageKey, statusFilter]);

  const handleBulkStatusUpdate = useCallback(async (nextStatus: string) => {
    if (!canManage) {
      toast.error('You do not have permission to manage aircraft leads');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Select at least one lead');
      return;
    }
    try {
      const response = await fetch('/api/v2/amro/aircraft-leads', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          operation: 'bulk_update_status',
          ids: selectedIds,
          status: nextStatus,
        }),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to update selected leads'));
      }
      toast.success('Selected leads updated');
      setSelectedIds([]);
      await loadLeads();
    } catch (bulkError) {
      toast.error(String((bulkError as Error).message || 'Failed to update selected leads'));
    }
  }, [buildHeaders, canManage, loadLeads, selectedIds]);

  const handleBulkDelete = useCallback(async () => {
    if (!canDelete) {
      toast.error('You do not have permission to delete aircraft leads');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Select at least one lead');
      return;
    }
    try {
      const response = await fetch('/api/v2/amro/aircraft-leads', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          operation: 'bulk_delete',
          ids: selectedIds,
        }),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to delete selected leads'));
      }
      toast.success('Selected leads deleted');
      setSelectedIds([]);
      await loadLeads();
    } catch (bulkError) {
      toast.error(String((bulkError as Error).message || 'Failed to delete selected leads'));
    }
  }, [buildHeaders, canDelete, loadLeads, selectedIds]);

  const handleInlineUpdate = useCallback(
    async (row: AircraftLeadRecord, patch: Partial<AircraftLeadRecord>) => {
      if (!canManage) {
        toast.error('You do not have permission to manage aircraft leads');
        return;
      }
      const next = { ...row, ...patch };
      setRows((previous) => previous.map((item) => (item.id === row.id ? next : item)));
      try {
        const response = await fetch('/api/v2/amro/aircraft-leads', {
          method: 'PUT',
          headers: buildHeaders(),
          body: JSON.stringify({
            id: next.id,
            aircraft_id: next.aircraft_id,
            aircraft_registration: next.aircraft_registration,
            aircraft_type: next.aircraft_type,
            title: next.title,
            description: next.description,
            status: next.status,
            priority: next.priority,
            source: next.source,
            score: Number(next.score || 0),
            assigned_to: next.assigned_to,
            maintenance_due_at: next.maintenance_due_at,
            next_action_due_at: next.next_action_due_at,
            compliance_state: next.compliance_state,
            regulatory_authority: next.regulatory_authority,
            tags: next.tags,
          }),
        });
        const payload = await parseApiPayload(response);
        if (!response.ok) {
          throw new Error(String(payload.error || 'Failed to update lead'));
        }
      } catch (inlineUpdateError) {
        toast.error(String((inlineUpdateError as Error).message || 'Failed to update lead'));
        await loadLeads();
      }
    },
    [buildHeaders, canManage, loadLeads],
  );

  const handleSortChange = useCallback((nextSortBy: string) => {
    setSortBy((previousSortBy) => {
      if (previousSortBy === nextSortBy) {
        setSortDirection((previousDirection) => (previousDirection === 'asc' ? 'desc' : 'asc'));
        return previousSortBy;
      }
      setSortDirection('asc');
      return nextSortBy;
    });
  }, []);

  const handleListHeaderSort = useCallback((column: LeadListColumnDefinition) => {
    setPage(1);
    handleSortChange(column.sortKey);
  }, [handleSortChange]);

  const handleListColumnToggle = useCallback((columnKey: LeadListColumnKey, checked: boolean) => {
    setVisibleListColumns((previous) => {
      if (checked) {
        if (previous.includes(columnKey)) return previous;
        const nextSet = new Set([...previous, columnKey]);
        return LEAD_LIST_COLUMNS.map((column) => column.key).filter((key) => nextSet.has(key));
      }
      if (!previous.includes(columnKey)) return previous;
      const next = previous.filter((key) => key !== columnKey);
      if (next.length === 0) {
        toast.error('At least one column must remain visible');
        return previous;
      }
      return next;
    });
  }, []);

  const handleResetListColumns = useCallback(() => {
    setVisibleListColumns(LEAD_LIST_COLUMNS.map((column) => column.key));
    setColumnSearchFilters({});
  }, []);

  const handleClearAllColumnFilters = useCallback(() => {
    setColumnSearchFilters({});
    setPage(1);
  }, []);

  const hasActiveColumnFilters = useMemo(
    () => Object.values(columnSearchFilters).some((value) => String(value || '').trim().length > 0),
    [columnSearchFilters],
  );

  const handleAutoFitColumn = useCallback((column: LeadListColumnDefinition) => {
    const headerLength = column.label.length;
    const maxValueLength = Math.max(
      0,
      ...listRows.map((row) => column.render(row).length),
    );
    const estimatedWidth = Math.max(headerLength, maxValueLength) * 8 + 44;
    const nextWidth = Math.min(640, Math.max(110, Math.round(estimatedWidth)));
    setColumnWidths((previous) => ({ ...previous, [column.key]: nextWidth }));
  }, [listRows]);

  const handleResizeColumn = useCallback((columnKey: LeadListColumnKey, startX: number) => {
    const startWidth = columnWidths[columnKey] || LEAD_LIST_COLUMNS.find((column) => column.key === columnKey)?.defaultWidth || 160;
    const onMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - startX;
      const nextWidth = Math.min(640, Math.max(110, Math.round(startWidth + delta)));
      setColumnWidths((previous) => ({ ...previous, [columnKey]: nextWidth }));
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [columnWidths]);

  const handlePipelineDragEnd = useCallback(
    async (activeId: string, _overId: string, newStatus: string) => {
      const row = rows.find((item) => item.id === activeId);
      if (!row || row.status === newStatus) {
        return;
      }
      await handleInlineUpdate(row, { status: newStatus });
    },
    [handleInlineUpdate, rows],
  );

  const handleExport = useCallback(
    (format: 'csv' | 'excel') => {
      const headers = [...AIRCRAFT_LEAD_IMPORT_FIELDS];
      const payloadRows = rows.map((row) => ({
        ...row,
        tags: row.tags.join(', '),
      }));
      if (format === 'csv') {
        exportCsv(`aircraft-leads-${Date.now()}.csv`, headers as string[], payloadRows);
      } else {
        exportExcel(`aircraft-leads-${Date.now()}.xlsx`, headers as string[], payloadRows);
      }
      toast.success(`Aircraft leads exported to ${format.toUpperCase()}`);
    },
    [rows],
  );

  const handleImportFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const parsed = await parseFileRows(file);
      if (parsed.length < 2) {
        toast.error('Import file must include header and at least one data row');
        return;
      }
      const headers = parsed[0].map((header) => String(header || '').trim());
      const nextRows = parsed.slice(1).map((row) => {
        const record: Record<string, string> = {};
        headers.forEach((header, index) => {
          record[header] = String(row[index] || '').trim();
        });
        return record;
      });
      const guessedMapping: Record<string, string> = {};
      AIRCRAFT_LEAD_IMPORT_FIELDS.forEach((field) => {
        const normalizedField = field.toLowerCase();
        const bestHeader = headers.find((header) => header.toLowerCase().replace(/\s+/g, '_') === normalizedField);
        guessedMapping[field] = bestHeader || '';
      });
      setImportFileName(file.name);
      setImportHeaders(headers);
      setImportRows(nextRows);
      setFieldMapping(guessedMapping);
      toast.success(`Loaded ${nextRows.length} rows for mapping`);
    } catch (importError) {
      toast.error(String((importError as Error).message || 'Failed to parse import file'));
    }
  }, []);

  const handleSubmitImport = useCallback(async () => {
    if (!canManage) {
      toast.error('You do not have permission to import aircraft leads');
      return;
    }
    if (importRows.length === 0) {
      toast.error('Upload a CSV or Excel file first');
      return;
    }
    const required = ['title', 'aircraft_id'];
    const unmappedRequired = required.filter((field) => !fieldMapping[field]);
    if (unmappedRequired.length > 0) {
      toast.error(`Required mapping missing: ${unmappedRequired.join(', ')}`);
      return;
    }
    setImportSubmitting(true);
    try {
      const records = importRows.map((row) => {
        const mappedRecord: Record<string, unknown> = {};
        AIRCRAFT_LEAD_IMPORT_FIELDS.forEach((field) => {
          const sourceHeader = fieldMapping[field];
          if (!sourceHeader) {
            return;
          }
          mappedRecord[field] = row[sourceHeader] || '';
        });
        if (mappedRecord.tags && typeof mappedRecord.tags === 'string') {
          mappedRecord.tags = String(mappedRecord.tags)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        }
        return mappedRecord;
      });
      const response = await fetch('/api/v2/amro/aircraft-leads', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          operation: 'bulk_import',
          records,
        }),
      });
      const payload = await parseApiPayload(response);
      if (!response.ok) {
        throw new Error(String(payload.error || 'Failed to import aircraft leads'));
      }
      toast.success('Aircraft leads imported');
      setImportRows([]);
      setImportHeaders([]);
      setFieldMapping({});
      setImportFileName('');
      await loadLeads();
      setActiveTab('list');
    } catch (submitImportError) {
      toast.error(String((submitImportError as Error).message || 'Failed to import aircraft leads'));
    } finally {
      setImportSubmitting(false);
    }
  }, [buildHeaders, canManage, fieldMapping, importRows, loadLeads]);

  return (
    <Card className="mdm-template-panel" style={themeStyle}>
      <CardHeader className="mdm-template-panel-head">
        <CardTitle className="mdm-template-panel-title">Aircraft Leads Workspace</CardTitle>
      </CardHeader>
      <CardContent className="mdm-template-panel-body space-y-3">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AircraftLeadsTab)}>
          <div className="mt-3 grid gap-2 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Label htmlFor="aircraft-leads-theme" className="text-[11px]">Theme</Label>
              <Select value={activeTheme} onValueChange={setActiveTheme}>
                <SelectTrigger id="aircraft-leads-theme" className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THEME_PRESETS.map((theme) => (
                    <SelectItem key={theme.name} value={theme.name}>{theme.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 lg:col-span-3">
              <Switch id="aircraft-leads-auto-refresh" checked={autoRefreshEnabled} onCheckedChange={setAutoRefreshEnabled} />
              <Label htmlFor="aircraft-leads-auto-refresh" className="text-[11px]">Auto refresh (30s)</Label>
            </div>
            <div className="flex items-end gap-2 lg:col-span-5">
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => handleExport('csv')}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Export CSV
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => handleExport('excel')}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Export Excel
              </Button>
            </div>
          </div>
          <TabsContent value="pipeline" className="space-y-3 pt-3">
            {loading ? (
              <div className="grid gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={`pipeline-skeleton-${index}`} className="h-[320px] w-full" />
                ))}
              </div>
            ) : (
              <Suspense fallback={<Skeleton className="h-[360px] w-full" />}>
                <LazyKanbanBoard
                  columns={pipelineColumns}
                  items={pipelineItems}
                  onDragEnd={(activeId, overId, newStatus) => {
                    void handlePipelineDragEnd(activeId, overId, newStatus);
                  }}
                  onItemClick={(id) => {
                    setSelectedIds([id]);
                    setActiveTab('list');
                  }}
                  className="h-[460px]"
                  scrollPersistenceKey={`aircraft-leads-kanban:${scope.tenantId}:${scope.franchiseId}`}
                />
              </Suspense>
            )}
          </TabsContent>
          <TabsContent value="list" className="space-y-3 pt-3">
            <div className="grid gap-2 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <Label className="text-[11px]">Search</Label>
                <Input
                  list="aircraft-leads-autocomplete"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search title, aircraft, assignee"
                  className="h-8 text-[12px]"
                />
                <datalist id="aircraft-leads-autocomplete">
                  {autocompleteOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
              <div className="lg:col-span-2">
                <Label className="text-[11px]">Status</Label>
                <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label className="text-[11px]">Priority</Label>
                <Select value={priorityFilter} onValueChange={(value) => { setPriorityFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label className="text-[11px]">Aircraft Type</Label>
                <Input
                  value={aircraftTypeFilter === 'all' ? '' : aircraftTypeFilter}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setAircraftTypeFilter(value || 'all');
                    setPage(1);
                  }}
                  placeholder="A320, B737..."
                  className="h-8 text-[12px]"
                />
              </div>
              <div className="lg:col-span-3">
                <Label className="text-[11px]">Compliance State</Label>
                <Select value={complianceStateFilter} onValueChange={(value) => { setComplianceStateFilter(value); setPage(1); }}>
                  <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="monitoring">Monitoring</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="compliant">Compliant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <Label className="text-[11px]">Saved Filter Name</Label>
                <Input value={savedFilterName} onChange={(event) => setSavedFilterName(event.target.value)} className="h-8 text-[12px]" placeholder="My filter" />
              </div>
              <div className="flex items-end gap-2 lg:col-span-2">
                <Button type="button" size="sm" variant="outline" className="h-8" onClick={handleSaveFilter}>
                  Save Filter
                </Button>
              </div>
              <div className="lg:col-span-3">
                <Label className="text-[11px]">Apply Saved Filter</Label>
                <Select value={selectedSavedFilterId} onValueChange={applySavedFilters}>
                  <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {savedFilters.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label className="text-[11px]">Sort</Label>
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AIRCRAFT_LEADS_SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label className="text-[11px]">Rows</Label>
                <div className="flex gap-2">
                  <Select value={pageSize} onValueChange={(value) => { setPageSize(value); setPage(1); }}>
                    <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))}>
                    {sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void loadLeads()}>Refresh</Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">Columns ({visibleListColumns.length})</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {LEAD_LIST_COLUMNS.map((column) => (
                    <DropdownMenuCheckboxItem
                      key={`visible-column-${column.key}`}
                      checked={visibleListColumns.includes(column.key)}
                      onCheckedChange={(checked) => handleListColumnToggle(column.key, Boolean(checked))}
                    >
                      {column.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleResetListColumns}>Reset Columns</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedIds.length > 0 ? (
                <>
                  <Badge variant="secondary">{selectedIds.length} selected</Badge>
                  <Button size="sm" variant="outline" onClick={() => void handleBulkStatusUpdate('qualified')} disabled={!canManage}>Bulk Qualify</Button>
                  <Button size="sm" variant="outline" onClick={() => void handleBulkStatusUpdate('in_progress')} disabled={!canManage}>Bulk In Progress</Button>
                  <Button size="sm" variant="destructive" onClick={() => void handleBulkDelete()} disabled={!canDelete}>Bulk Delete</Button>
                </>
              ) : null}
            </div>

            {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div> : null}

            <div className="rounded-md border border-[hsl(var(--mdm-template-border))]">
              <Table className="table-fixed">
                <colgroup>
                  <col className="w-[44px]" />
                  {visibleListColumnDefinitions.map((column) => (
                    <col key={`list-col-${column.key}`} style={{ width: `${columnWidths[column.key]}px` }} />
                  ))}
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 z-20 w-[44px] bg-[#F8FAFC] px-2 py-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds((previous) => Array.from(new Set([...previous, ...listRows.map((row) => row.id)])));
                            return;
                          }
                          const listRowIds = new Set(listRows.map((row) => row.id));
                          setSelectedIds((previous) => previous.filter((id) => !listRowIds.has(id)));
                        }}
                      />
                    </TableHead>
                    {visibleListColumnDefinitions.map((column) => (
                      <TableHead key={`header-${column.key}`} className="group sticky top-0 z-20 bg-[#F8FAFC] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-0 text-left text-[12px] font-semibold text-[#64748B] hover:bg-transparent"
                            onClick={() => handleListHeaderSort(column)}
                          >
                            <span>{column.label}</span>
                            {sortBy === column.sortKey ? (
                              sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />
                            ) : null}
                          </Button>
                          <button
                            type="button"
                            className="h-5 w-2 cursor-col-resize rounded opacity-0 transition group-hover:opacity-100"
                            aria-label={`Resize ${column.label} column`}
                            onDoubleClick={(event) => {
                              event.preventDefault();
                              handleAutoFitColumn(column);
                            }}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              handleResizeColumn(column.key, event.clientX);
                            }}
                          />
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-[#F8FAFC] px-2 py-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1 text-[10px]"
                        onClick={handleClearAllColumnFilters}
                        disabled={!hasActiveColumnFilters}
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </Button>
                    </TableHead>
                    {visibleListColumnDefinitions.map((column) => (
                      <TableHead key={`filter-${column.key}`} className="bg-[#F8FAFC] px-2 py-1">
                        <Input
                          value={columnSearchFilters[column.key] || ''}
                          onChange={(event) => {
                            setColumnSearchFilters((previous) => ({ ...previous, [column.key]: event.target.value }));
                            setPage(1);
                          }}
                          placeholder={`${column.label} search`}
                          className="h-7 text-[11px]"
                        />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(row.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIds((previous) => [...previous, row.id]);
                              return;
                            }
                            setSelectedIds((previous) => previous.filter((id) => id !== row.id));
                          }}
                        />
                      </TableCell>
                      {visibleListColumnDefinitions.map((column) => (
                        <TableCell key={`cell-${row.id}-${column.key}`} className={column.key === 'title' ? 'text-[12px] font-medium' : 'text-[12px]'}>
                          {column.render(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {!loading && listRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleListColumnDefinitions.length + 1} className="text-center text-[12px] text-muted-foreground">
                        No leads found for current filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between text-[12px]">
              <p>
                Showing {(page - 1) * Number(pageSize) + (listRows.length > 0 ? 1 : 0)}-{Math.min(page * Number(pageSize), totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={page <= 1} onClick={() => setPage((previous) => Math.max(1, previous - 1))}>Previous</Button>
                <span>Page {page} / {totalPages}</span>
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={page >= totalPages} onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}>Next</Button>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="grid" className="space-y-3 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-[11px]">Columns</Label>
                <Select value={gridColumns} onValueChange={(value) => setGridColumns(value as '2' | '3' | '4')}>
                  <SelectTrigger className="h-8 w-[92px] text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className={gridColumns === '2' ? 'grid gap-3 md:grid-cols-2' : gridColumns === '3' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'grid gap-3 md:grid-cols-2 xl:grid-cols-4'}>
              {rows.map((row) => (
                <Card key={`grid-${row.id}`} className="border border-[hsl(var(--mdm-template-border))]">
                  <CardContent className="space-y-2 p-3 text-[12px]">
                    <EditableText value={row.title || ''} onSave={async (value) => handleInlineUpdate(row, { title: String(value) })} className="font-semibold" />
                    <p>{row.aircraft_registration || row.aircraft_id || '-'}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{row.status || 'new'}</Badge>
                      <Badge variant="outline">{row.priority || 'medium'}</Badge>
                    </div>
                    <EditableText value={row.assigned_to || ''} onSave={async (value) => handleInlineUpdate(row, { assigned_to: String(value) })} placeholder="Assignee" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="card" className="space-y-3 pt-3">
            <div className="grid gap-2">
              {rows.map((row) => (
                <div
                  key={`card-${row.id}`}
                  className="rounded-md border border-[hsl(var(--mdm-template-border))] p-3 text-left transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold">{row.title || 'Untitled'}</p>
                      <p className="text-[12px] text-muted-foreground">{row.aircraft_registration || row.aircraft_id || '-'} · {row.aircraft_type || '-'}</p>
                    </div>
                    <Badge variant="secondary">{row.status || 'new'}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[12px]">
                    <Badge variant="outline">{row.priority || 'medium'}</Badge>
                    <span>Score: {row.score}</span>
                    <span>Assignee: {row.assigned_to || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="analytics" className="space-y-3 pt-3">
            <div className="grid gap-3 md:grid-cols-4">
              {rowCountByStatus.map((metric) => (
                <Card key={`metric-${metric.id}`}>
                  <CardContent className="p-3">
                    <p className="text-[11px] text-muted-foreground">{metric.label}</p>
                    <p className="text-[18px] font-semibold">{metric.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
              <LazyPipelineAnalytics leads={analyticsLeads} />
            </Suspense>
          </TabsContent>
          <TabsContent value="import_export" className="space-y-3 pt-3">
            <div className="flex flex-wrap items-end gap-2">
              <Button size="sm" variant="outline" onClick={() => handleExport('csv')}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleExport('excel')}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Export Excel
              </Button>
              <Label htmlFor="aircraft-leads-import-file" className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-[12px]">
                <Upload className="mr-1 h-3.5 w-3.5" />
                Upload File
              </Label>
              <input id="aircraft-leads-import-file" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => void handleImportFileChange(event)} />
              <Button size="sm" onClick={() => void handleSubmitImport()} disabled={importSubmitting || importRows.length === 0 || !canManage}>
                Import Mapped Rows
              </Button>
            </div>
            {importFileName ? <p className="text-[12px] text-muted-foreground">Loaded file: {importFileName} ({importRows.length} rows)</p> : null}
            {importHeaders.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2">
                {AIRCRAFT_LEAD_IMPORT_FIELDS.map((field) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-[11px]">{field}</Label>
                    <Select
                      value={fieldMapping[field] || 'unmapped'}
                      onValueChange={(value) => {
                        setFieldMapping((previous) => ({ ...previous, [field]: value === 'unmapped' ? '' : value }));
                      }}
                    >
                      <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmapped">Unmapped</SelectItem>
                        {importHeaders.map((header) => (
                          <SelectItem key={`${field}-${header}`} value={header}>{header}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">Upload a CSV/Excel file to map fields.</p>
            )}
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
  );
}

export default AircraftLeadsManager;
