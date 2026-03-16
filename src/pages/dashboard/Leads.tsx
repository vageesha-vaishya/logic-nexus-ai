import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { Search, UserPlus, Filter, TrendingUp, Users as UsersIcon, Trash2, MoreHorizontal, ArrowUpDown, SlidersHorizontal, X, Pencil, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ViewMode } from '@/components/ui/view-toggle';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/react';
import { TextOp } from '@/lib/utils';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { TableSkeleton } from '@/components/system/TableSkeleton';
import { LeadCard } from '@/components/crm/LeadCard';
import { CRMModuleHeaderNavigation } from '@/components/crm/CRMModuleHeaderNavigation';
import { themeStyleFromPreset } from '@/lib/theme-utils';
import { Lead } from './leads-data';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useLeadsViewState } from '@/hooks/useLeadsViewState';
import { useDebounce } from '@/hooks/useDebounce';
import { useUndo } from '@/hooks/useUndo';
import {
  buildLeadsFilterPlan,
  buildLeadsImportExportParams,
  deserializeLeadsListUrlState,
  groupLeadsForWorkspaceDetails,
  normalizeLeadsStatusFilterValue,
  runOneTimeLeadsFilterMigration,
  serializeLeadsListUrlState,
  WorkspaceDetailsGroupBy,
} from './leadsListUtils';
import {
  classifyFetchFailure,
  describeFetchFailure,
  runWithRetry,
  DEFAULT_RETRY_POLICY,
} from '@/lib/fetch-resilience';

const LIST_FIELD_OPTIONS = [
  { key: 'email_under_name', label: 'Email under Name', tableColumn: false },
  { key: 'title', label: 'Title', tableColumn: true },
  { key: 'company', label: 'Company', tableColumn: true },
  { key: 'email', label: 'Email', tableColumn: true },
  { key: 'phone', label: 'Phone', tableColumn: true },
  { key: 'status', label: 'Status', tableColumn: true },
  { key: 'source', label: 'Source', tableColumn: true },
  { key: 'qualification_status', label: 'Qualification', tableColumn: true },
  { key: 'score', label: 'Score', tableColumn: true },
  { key: 'estimated_value', label: 'Value', tableColumn: true },
  { key: 'expected_close_date', label: 'Expected Close', tableColumn: true },
  { key: 'last_activity_date', label: 'Last Activity', tableColumn: true },
  { key: 'created_at', label: 'Created At', tableColumn: true },
  { key: 'updated_at', label: 'Updated At', tableColumn: true },
  { key: 'converted_at', label: 'Converted At', tableColumn: true },
  { key: 'owner_id', label: 'Owner', tableColumn: true },
  { key: 'description', label: 'Description', tableColumn: true },
  { key: 'notes', label: 'Notes', tableColumn: true },
  { key: 'custom_fields', label: 'Custom Fields', tableColumn: true },
  { key: 'franchise_id', label: 'Franchise', tableColumn: true },
  { key: 'tenant_id', label: 'Tenant', tableColumn: true },
  { key: 'actions', label: 'Actions', tableColumn: true },
] as const;

type ListFieldKey = (typeof LIST_FIELD_OPTIONS)[number]['key'];
type ListTableColumnKey = 'name' | Exclude<ListFieldKey, 'email_under_name'>;
type WorkspaceActivity = {
  id: string;
  activity_type: string | null;
  subject: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  created_at: string | null;
};
type LeadGroupBy = 'none' | 'status' | 'source' | 'assigned_to' | 'industry' | 'created_date';
type ActivitySortableColumn = 'subject' | 'activity_type' | 'status' | 'priority' | 'due_date' | 'created_at';
type ActivitySortDirection = 'asc' | 'desc';
const DEFAULT_LIST_FIELDS: ListFieldKey[] = ['company', 'status', 'score', 'estimated_value', 'actions', 'email_under_name'];
const SORT_FIELD_MAP: Partial<Record<ListFieldKey, string>> = {
  title: 'title',
  company: 'company',
  email: 'email',
  phone: 'phone',
  status: 'status',
  source: 'source',
  qualification_status: 'qualification_status',
  score: 'lead_score',
  estimated_value: 'estimated_value',
  expected_close_date: 'expected_close_date',
  last_activity_date: 'last_activity_date',
  created_at: 'created_at',
  updated_at: 'updated_at',
  converted_at: 'converted_at',
  owner_id: 'owner_id',
  description: 'description',
  notes: 'notes',
  franchise_id: 'franchise_id',
  tenant_id: 'tenant_id',
};
const COLUMN_WIDTH_STORAGE_KEY = 'leads.listColumnWidths.v1';
const MIN_COLUMN_WIDTH = 90;
const MAX_COLUMN_WIDTH = 520;
const LIST_DETAILS_SPLIT_STORAGE_KEY = 'leads.listDetailsSplitRatio.v1';
const LIST_PANE_MIN_HEIGHT = 260;
const DETAILS_PANE_MIN_HEIGHT = 220;
const DEFAULT_LIST_DETAILS_SPLIT_RATIO = 0.55;
const ACTIVITY_TABLE_PREFERENCES_STORAGE_KEY = 'leads.activitiesTable.preferences.v1';
const ACTIVITY_TABLE_MIN_COLUMN_WIDTH = 96;
const ACTIVITY_TABLE_MAX_COLUMN_WIDTH = 480;

export default function Leads() {
  usePerformanceMonitor('Leads Module');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsTab, setDetailsTab] = useState('activities');
  const [focusedLeadId, setFocusedLeadId] = useState<string | null>(null);
  const [leadActivities, setLeadActivities] = useState<WorkspaceActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const { supabase, context, scopedDb } = useCRM();
  const {
    state: viewState,
    setView,
    setTheme,
    setWorkspace,
    setSelectedIds,
    setWorkspaceScrollY,
    setPipeline,
  } = useLeadsViewState();

  const {
    searchQuery,
    statusFilter,
    scoreFilter,
    ownerFilter,
    nameQuery,
    nameOp,
    companyQuery,
    companyOp,
    emailQuery,
    emailOp,
    phoneQuery,
    phoneOp,
    sourceQuery,
    sourceOp,
    qualificationQuery,
    qualificationOp,
    scoreMin,
    scoreMax,
    valueMin,
    valueMax,
    createdStart,
    createdEnd,
    page,
    pageSize,
    sortField,
    sortDirection,
    listVisibleFields,
    groupBy,
  } = viewState.workspace;

  const [totalCount, setTotalCount] = useState(0);
  const [columnWidths, setColumnWidths] = useState<Partial<Record<ListTableColumnKey, number>>>({});
  const [activeResizeColumn, setActiveResizeColumn] = useState<ListTableColumnKey | null>(null);
  const resizeMetaRef = useRef<{ key: ListTableColumnKey; startX: number; startWidth: number } | null>(null);
  const leadClickTimeoutRef = useRef<number | null>(null);

  // Local state for debounced search
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [pageInput, setPageInput] = useState(String(page));
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    if (debouncedSearch !== searchQuery) {
      setWorkspace({ searchQuery: debouncedSearch, page: 1 });
    }
  }, [debouncedSearch, searchQuery, setWorkspace]);

  // Sync local search when global state changes (e.g. hydration or clear)
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    runOneTimeLeadsFilterMigration(localStorage);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(LIST_DETAILS_SPLIT_STORAGE_KEY);
    if (!raw) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const clampedRatio = Math.max(0.35, Math.min(0.75, parsed));
    const containerHeight = splitContainerRef.current?.clientHeight ?? 0;
    if (!containerHeight) return;
    const calculated = Math.round(containerHeight * clampedRatio);
    setListPaneHeight(calculated);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next: Partial<Record<ListTableColumnKey, number>> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return;
        const width = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(value)));
        if (key === 'name') {
          next.name = width;
          return;
        }
        const isFieldKey = LIST_FIELD_OPTIONS.some((field) => field.key === key && field.key !== 'email_under_name');
        if (isFieldKey) next[key as Exclude<ListFieldKey, 'email_under_name'>] = width;
      });
      setColumnWidths(next);
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify(columnWidths));
    } catch {
      void 0;
    }
  }, [columnWidths]);

  useEffect(() => {
    if (!activeResizeColumn) return;
    const handleMouseMove = (event: MouseEvent) => {
      const resizeMeta = resizeMetaRef.current;
      if (!resizeMeta || resizeMeta.key !== activeResizeColumn) return;
      const delta = event.clientX - resizeMeta.startX;
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(resizeMeta.startWidth + delta)));
      setColumnWidths((prev) => {
        if (prev[resizeMeta.key] === nextWidth) return prev;
        return { ...prev, [resizeMeta.key]: nextWidth };
      });
    };
    const handleMouseUp = () => {
      setActiveResizeColumn(null);
      resizeMetaRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeResizeColumn]);

  const viewMode = (viewState.view === 'pipeline' ? 'card' : viewState.view) as ViewMode;
  const selectedIds = new Set(viewState.selection.selectedIds);
  const currentTheme = viewState.theme;

  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [detailsCollapsedGroups, setDetailsCollapsedGroups] = useState<Set<string>>(new Set());
  const [detailsGroupBy, setDetailsGroupBy] = useState<WorkspaceDetailsGroupBy>('none');
  const [listPaneHeight, setListPaneHeight] = useState(0);
  const [isResizingPane, setIsResizingPane] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [activitySortField, setActivitySortField] = useState<ActivitySortableColumn>('created_at');
  const [activitySortDirection, setActivitySortDirection] = useState<ActivitySortDirection>('desc');
  const [activityColumnWidths, setActivityColumnWidths] = useState<Partial<Record<ActivitySortableColumn | 'actions', number>>>({});
  const [activeActivityResizeColumn, setActiveActivityResizeColumn] = useState<ActivitySortableColumn | 'actions' | null>(null);
  const activityResizeMetaRef = useRef<{ key: ActivitySortableColumn | 'actions'; startX: number; startWidth: number } | null>(null);
  const hasAppliedInitialStatusDefaultRef = useRef(false);
  const hasHydratedFromUrlRef = useRef(false);
  const leadsRequestSequenceRef = useRef(0);
  const activitiesRequestSequenceRef = useRef(0);
  const leadsCacheRef = useRef<{ items: Lead[]; totalCount: number }>({ items: [], totalCount: 0 });
  const activitiesCacheRef = useRef<Record<string, WorkspaceActivity[]>>({});
  const statusDebounceRef = useRef<number | null>(null);
  const lastSerializedUrlRef = useRef('');

  // Sync URL to view state on initial hydration only
  useEffect(() => {
    if (!viewState.hydrated) return;
    if (hasHydratedFromUrlRef.current) return;
    hasHydratedFromUrlRef.current = true;
    const incoming = deserializeLeadsListUrlState(searchParams);
    const patch: Record<string, unknown> = {};
    if (incoming.searchQuery !== undefined && incoming.searchQuery !== searchQuery) patch.searchQuery = incoming.searchQuery;
    if (incoming.statusFilter !== undefined && incoming.statusFilter !== statusFilter) patch.statusFilter = incoming.statusFilter;
    if (incoming.ownerFilter !== undefined && incoming.ownerFilter !== ownerFilter) patch.ownerFilter = incoming.ownerFilter;
    if (incoming.page !== undefined && incoming.page !== page) patch.page = incoming.page;
    if (Object.keys(patch).length > 0) setWorkspace(patch);
  }, [viewState.hydrated, searchParams, searchQuery, statusFilter, ownerFilter, page, setWorkspace]);

  useEffect(() => {
    if (!viewState.hydrated) return;
    const normalized = normalizeLeadsStatusFilterValue(statusFilter);
    if (normalized !== statusFilter) setWorkspace({ statusFilter: normalized, page: 1 });
  }, [viewState.hydrated, statusFilter, setWorkspace]);

  useEffect(() => {
    if (!viewState.hydrated) return;
    if (hasAppliedInitialStatusDefaultRef.current) return;
    hasAppliedInitialStatusDefaultRef.current = true;
    const hasUrlStatus = searchParams.has('status');
    if (!hasUrlStatus && viewState.hydrationSource === 'default' && statusFilter !== 'all') {
      setWorkspace({ statusFilter: 'all', page: 1 });
    }
  }, [viewState.hydrated, viewState.hydrationSource, searchParams, statusFilter, setWorkspace]);

  useEffect(() => {
    if (!viewState.hydrated) return;
    const params = serializeLeadsListUrlState({
      searchQuery,
      statusFilter,
      ownerFilter,
      page,
    });
    const serialized = params.toString();
    if (serialized === lastSerializedUrlRef.current) return;
    lastSerializedUrlRef.current = serialized;
    if (serialized !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [searchQuery, statusFilter, ownerFilter, page, viewState.hydrated, searchParams, setSearchParams]);

  useEffect(() => {
    return () => {
      if (statusDebounceRef.current) {
        window.clearTimeout(statusDebounceRef.current);
      }
    };
  }, []);

  const setSearchQuery = (val: string) => setWorkspace({ searchQuery: val, page: 1 });
  const setStatusFilter = (val: string) => {
    const nextStatus = normalizeLeadsStatusFilterValue(val);
    if (statusDebounceRef.current) {
      window.clearTimeout(statusDebounceRef.current);
      statusDebounceRef.current = null;
    }
    statusDebounceRef.current = window.setTimeout(() => {
      setWorkspace({ statusFilter: nextStatus, page: 1 });
      statusDebounceRef.current = null;
    }, 80);
  };
  const setScoreFilter = (val: string) => setWorkspace({ scoreFilter: val, page: 1 });
  const setOwnerFilter = (val: 'any' | 'unassigned' | 'me') => setWorkspace({ ownerFilter: val, page: 1 });
  const setNameQuery = (val: string) => setWorkspace({ nameQuery: val, page: 1 });
  const setNameOp = (val: TextOp) => setWorkspace({ nameOp: val, page: 1 });
  const setValueMin = (val: string) => setWorkspace({ valueMin: val, page: 1 });
  const setValueMax = (val: string) => setWorkspace({ valueMax: val, page: 1 });
  const setPage = (val: number) => setWorkspace({ page: val });
  const setPageSize = (val: string) => {
    const parsed = Number(val);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    setWorkspace({ pageSize: parsed, page: 1 });
  };
  const setSorting = (field: string, direction: 'asc' | 'desc') => setWorkspace({ sortField: field, sortDirection: direction });
  const setGroupBy = (val: LeadGroupBy) => setWorkspace({ groupBy: val, page: 1 });
  const clearAllFilters = () => {
    setWorkspace({
      searchQuery: '',
      statusFilter: 'all',
      scoreFilter: 'all',
      ownerFilter: 'any',
      nameQuery: '',
      nameOp: 'contains',
      valueMin: '',
      valueMax: '',
      scoreMin: '',
      scoreMax: '',
      createdStart: '',
      createdEnd: '',
      companyQuery: '',
      companyOp: 'contains',
      emailQuery: '',
      emailOp: 'contains',
      phoneQuery: '',
      phoneOp: 'contains',
      sourceQuery: '',
      sourceOp: 'contains',
      qualificationQuery: '',
      qualificationOp: 'contains',
      groupBy: 'none',
      page: 1,
    });
  };

  useEffect(() => {
    if (!viewState.hydrated) return;
    if (viewState.scroll.workspaceScrollY > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, viewState.scroll.workspaceScrollY);
      });
    }
    return () => {
      setWorkspaceScrollY(window.scrollY);
    };
  }, [viewState.hydrated, viewState.scroll.workspaceScrollY, setWorkspaceScrollY]);

  useEffect(() => {
    const loadDefaults = async () => {
      if (!viewState.hydrated) return;
      
      // Sync with backend defaults if available (supports cross-device persistence)
      if (!context?.userId) return;
      if (viewState.hydrationSource !== 'default') return;
      try {
        const userViewKey = `user:${context.userId}:leads.default_view`;
        const userThemeKey = `user:${context.userId}:leads.default_theme`;
        const [{ data: viewData }, { data: themeData }] = await Promise.all([
          scopedDb.getSystemSetting(userViewKey),
          scopedDb.getSystemSetting(userThemeKey),
        ]);
        const defaultView = viewData?.setting_value;
        const defaultTheme = themeData?.setting_value;
        
        // Only apply default theme if it differs from current
        if (defaultTheme && typeof defaultTheme === 'string' && defaultTheme !== viewState.theme) {
            setTheme(defaultTheme);
        }
        
        // Only apply default view if it differs and is valid
        if (defaultView && ['pipeline', 'card', 'grid', 'list'].includes(String(defaultView)) && String(defaultView) !== viewState.view) {
          setView(String(defaultView) as any);
        }
      } catch {
        // Silent failure for defaults
        return;
      }
    };
    loadDefaults();
  }, [context?.userId, setTheme, setView, supabase, context, viewState.hydrated, viewState.theme, viewState.view]);

  const handleViewChange = (mode: ViewMode) => {
    if (mode === 'pipeline') {
      try {
        localStorage.setItem('leadsViewMode', 'pipeline');
      } catch {
        void 0;
      }
      scopedDb.logViewPreference('leads', 'pipeline');
      setView('pipeline');
      setPipeline({ q: '', status: [] });
      navigate('/dashboard/leads/pipeline');
    } else {
      try {
        localStorage.setItem('leadsViewMode', mode);
      } catch {
        void 0;
      }
      scopedDb.logViewPreference('leads', mode);
      setView(mode as any);
    }
  };

  const handleThemeChange = (val: string) => {
    setTheme(val);
    try {
      localStorage.setItem('leadsTheme', val);
    } catch {
      return;
    }
  };

  const fetchLeads = useCallback(async () => {
    const requestId = ++leadsRequestSequenceRef.current;
    try {
      if (requestId === leadsRequestSequenceRef.current) {
        setLoading(true);
      }
      const executeQuery = async () => {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        let query = scopedDb
          .from('leads')
          .select('*', { count: 'exact' });
        const filterPlan = buildLeadsFilterPlan({
          statusFilter,
          ownerFilter,
          searchQuery,
          nameQuery,
          nameOp,
          companyQuery,
          companyOp,
          emailQuery,
          emailOp,
          phoneQuery,
          phoneOp,
          sourceQuery,
          sourceOp,
          qualificationQuery,
          qualificationOp,
          scoreFilter,
          scoreMin,
          scoreMax,
          valueMin,
          valueMax,
          createdStart,
          createdEnd,
          userId: context?.userId,
        });
        filterPlan.eq.forEach(({ column, value }) => {
          query = query.eq(column, value);
        });
        filterPlan.ilike.forEach(({ column, value }) => {
          query = query.ilike(column, value);
        });
        filterPlan.gte.forEach(({ column, value }) => {
          query = query.gte(column, value);
        });
        filterPlan.lte.forEach(({ column, value }) => {
          query = query.lte(column, value);
        });
        filterPlan.isNull.forEach((column) => {
          query = query.is(column, null);
        });
        filterPlan.or.forEach((clause) => {
          query = query.or(clause);
        });
        query = query.order(sortField, { ascending: sortDirection === 'asc' });
        query = query.range(from, to);
        return query;
      };
      const { data, error, count } = await runWithRetry(
        executeQuery,
        DEFAULT_RETRY_POLICY,
        (attempt, meta) => {
          logger.warn('Leads fetch retry', {
            component: 'Leads',
            attempt,
            reason: meta.kind,
            statusCode: meta.statusCode,
          });
        },
      );
      if (error) throw error;
      if (requestId !== leadsRequestSequenceRef.current) return;
      const nextRows = data || [];
      setLeads(nextRows);
      setTotalCount(count || 0);
      leadsCacheRef.current = { items: nextRows, totalCount: count || 0 };
    } catch (error) {
      if (requestId !== leadsRequestSequenceRef.current) return;
      const meta = classifyFetchFailure(error);
      logger.error('Failed to fetch leads', {
        component: 'Leads',
        reason: meta.kind,
        statusCode: meta.statusCode,
        error: meta.message,
      });
      Sentry.captureException(error);
      if (leadsCacheRef.current.items.length > 0) {
        setLeads(leadsCacheRef.current.items);
        setTotalCount(leadsCacheRef.current.totalCount);
        toast.warning(t('leads.messages.fetchFallback', 'Showing cached leads while connection recovers'), {
          description: describeFetchFailure(meta),
        });
        return;
      }
      toast.error(t('leads.messages.fetchFailed', 'Failed to fetch leads'), {
        description: describeFetchFailure(meta),
      });
    } finally {
      if (requestId === leadsRequestSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [
    scopedDb,
    page,
    pageSize,
    sortField,
    sortDirection,
    statusFilter,
    ownerFilter,
    searchQuery,
    nameQuery,
    nameOp,
    scoreFilter,
    scoreMin,
    scoreMax,
    valueMin,
    valueMax,
    companyQuery,
    companyOp,
    emailQuery,
    emailOp,
    phoneQuery,
    phoneOp,
    sourceQuery,
    sourceOp,
    qualificationQuery,
    qualificationOp,
    createdStart,
    createdEnd,
    context?.userId,
    t,
  ]);

  const focusLeadInWorkspace = useCallback((lead: Lead) => {
    setFocusedLeadId(lead.id);
  }, []);

  const navigateToLeadEdit = useCallback((lead: Lead) => {
    navigate(`/dashboard/leads/${lead.id}`, {
      state: {
        openEdit: true,
        autoSave: true,
        returnContext: 'workspace',
        leadSnapshot: lead,
      },
    });
  }, [navigate]);

  const handleLeadSingleClick = useCallback((lead: Lead) => {
    if (leadClickTimeoutRef.current) {
      window.clearTimeout(leadClickTimeoutRef.current);
    }
    leadClickTimeoutRef.current = window.setTimeout(() => {
      focusLeadInWorkspace(lead);
      leadClickTimeoutRef.current = null;
    }, 220);
  }, [focusLeadInWorkspace]);

  const handleLeadDoubleClick = useCallback((lead: Lead) => {
    if (leadClickTimeoutRef.current) {
      window.clearTimeout(leadClickTimeoutRef.current);
      leadClickTimeoutRef.current = null;
    }
    navigateToLeadEdit(lead);
  }, [navigateToLeadEdit]);

  useEffect(() => {
    return () => {
      if (leadClickTimeoutRef.current) {
        window.clearTimeout(leadClickTimeoutRef.current);
      }
      if (statusDebounceRef.current) {
        window.clearTimeout(statusDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!viewState.hydrated) return;
    fetchLeads();
  }, [fetchLeads, viewState.hydrated]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, pageSize, totalCount]);

  useEffect(() => {
    if (leads.length === 0) {
      setFocusedLeadId(null);
      return;
    }
    const exists = focusedLeadId ? leads.some((lead) => lead.id === focusedLeadId) : false;
    if (!exists) {
      setFocusedLeadId(leads[0].id);
    }
  }, [leads, focusedLeadId]);

  const allVisibleSelected = leads.length > 0 && leads.every((lead) => selectedIds.has(lead.id));
  const partiallyVisibleSelected = leads.some((lead) => selectedIds.has(lead.id)) && !allVisibleSelected;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const recordStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const recordEnd = totalCount === 0 ? 0 : Math.min(totalCount, page * pageSize);
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
  const focusedLead = useMemo(
    () => leads.find((lead) => lead.id === focusedLeadId) || leads[0] || null,
    [leads, focusedLeadId]
  );

  const fetchLeadActivities = useCallback(async (leadId: string) => {
    const requestId = ++activitiesRequestSequenceRef.current;
    try {
      if (requestId === activitiesRequestSequenceRef.current) {
        setActivitiesLoading(true);
      }
      const executeQuery = async () => scopedDb
        .from('activities')
        .select('id, activity_type, subject, status, priority, due_date, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(25);
      const { data, error } = await runWithRetry(
        executeQuery,
        DEFAULT_RETRY_POLICY,
        (attempt, meta) => {
          logger.warn('Lead activities fetch retry', {
            component: 'Leads',
            attempt,
            leadId,
            reason: meta.kind,
            statusCode: meta.statusCode,
          });
        },
      );
      if (error) throw error;
      if (requestId !== activitiesRequestSequenceRef.current) return;
      const nextRows = (data as WorkspaceActivity[]) || [];
      setLeadActivities(nextRows);
      activitiesCacheRef.current[leadId] = nextRows;
    } catch (error) {
      if (requestId !== activitiesRequestSequenceRef.current) return;
      const meta = classifyFetchFailure(error);
      logger.error('Failed to fetch lead activities', {
        component: 'Leads',
        leadId,
        reason: meta.kind,
        statusCode: meta.statusCode,
        error: meta.message,
      });
      Sentry.captureException(error);
      const cachedActivities = activitiesCacheRef.current[leadId];
      if (cachedActivities && cachedActivities.length > 0) {
        setLeadActivities(cachedActivities);
        toast.warning(t('leads.listDetails.activities.fetchFallback', 'Showing cached activities while connection recovers'), {
          description: describeFetchFailure(meta),
        });
        return;
      }
      setLeadActivities([]);
      toast.error(t('leads.listDetails.activities.fetchFailed', 'Failed to load activities'), {
        description: describeFetchFailure(meta),
      });
    } finally {
      if (requestId === activitiesRequestSequenceRef.current) {
        setActivitiesLoading(false);
      }
    }
  }, [scopedDb, t]);

  useEffect(() => {
    if (!focusedLead?.id) {
      setLeadActivities([]);
      return;
    }
    fetchLeadActivities(focusedLead.id);
  }, [fetchLeadActivities, focusedLead?.id]);

  const activityColumns = useMemo<Array<{ key: ActivitySortableColumn | 'actions'; label: string; sortable?: boolean }>>(
    () => [
      { key: 'subject', label: t('leads.listDetails.activities.subject', 'Subject'), sortable: true },
      { key: 'activity_type', label: t('leads.listDetails.activities.type', 'Type'), sortable: true },
      { key: 'status', label: t('leads.listDetails.activities.status', 'Status'), sortable: true },
      { key: 'priority', label: t('leads.listDetails.activities.priority', 'Priority'), sortable: true },
      { key: 'due_date', label: t('leads.listDetails.activities.dueDate', 'Due Date'), sortable: true },
      { key: 'created_at', label: t('leads.listDetails.activities.createdAt', 'Created At'), sortable: true },
      { key: 'actions', label: t('leads.listDetails.activities.actions', 'Action') },
    ],
    [t],
  );

  const activityComparator = useCallback(
    (a: WorkspaceActivity, b: WorkspaceActivity, field: ActivitySortableColumn) => {
      const read = (item: WorkspaceActivity) => item[field];
      const rawA = read(a);
      const rawB = read(b);
      if (field === 'due_date' || field === 'created_at') {
        const dateA = rawA ? new Date(rawA).getTime() : 0;
        const dateB = rawB ? new Date(rawB).getTime() : 0;
        return dateA - dateB;
      }
      const textA = String(rawA || '').toLowerCase();
      const textB = String(rawB || '').toLowerCase();
      return textA.localeCompare(textB);
    },
    [],
  );

  const sortedLeadActivities = useMemo(() => {
    const list = [...leadActivities];
    list.sort((a, b) => {
      const compared = activityComparator(a, b, activitySortField);
      return activitySortDirection === 'asc' ? compared : compared * -1;
    });
    return list;
  }, [leadActivities, activityComparator, activitySortDirection, activitySortField]);

  const getDefaultActivityColumnWidth = useCallback((column: ActivitySortableColumn | 'actions') => {
    if (column === 'subject') return 220;
    if (column === 'actions') return 120;
    if (column === 'due_date' || column === 'created_at') return 140;
    return 130;
  }, []);

  const getActivityColumnWidth = useCallback(
    (column: ActivitySortableColumn | 'actions') => activityColumnWidths[column] ?? getDefaultActivityColumnWidth(column),
    [activityColumnWidths, getDefaultActivityColumnWidth],
  );

  const getActivityColumnStyle = useCallback(
    (column: ActivitySortableColumn | 'actions') => {
      const width = getActivityColumnWidth(column);
      return { width: `${width}px`, minWidth: `${width}px` };
    },
    [getActivityColumnWidth],
  );

  const startActivityColumnResize = (event: React.MouseEvent<HTMLDivElement>, column: ActivitySortableColumn | 'actions') => {
    event.preventDefault();
    event.stopPropagation();
    activityResizeMetaRef.current = {
      key: column,
      startX: event.clientX,
      startWidth: getActivityColumnWidth(column),
    };
    setActiveActivityResizeColumn(column);
  };

  const handleActivitySort = (column: ActivitySortableColumn) => {
    if (activitySortField === column) {
      setActivitySortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setActivitySortField(column);
    setActivitySortDirection('asc');
  };

  const autoFitActivityColumn = (column: ActivitySortableColumn | 'actions') => {
    const baseFromHeader = activityColumns.find((item) => item.key === column)?.label.length ?? 12;
    const sourceRows = sortedLeadActivities.slice(0, 25);
    const maxContentLength = sourceRows.reduce((max, row) => {
      if (column === 'actions') return Math.max(max, 8);
      const value = row[column] ? String(row[column]) : '';
      return Math.max(max, value.length);
    }, baseFromHeader);
    const computed = Math.max(
      ACTIVITY_TABLE_MIN_COLUMN_WIDTH,
      Math.min(ACTIVITY_TABLE_MAX_COLUMN_WIDTH, maxContentLength * 9 + 44),
    );
    setActivityColumnWidths((prev) => ({ ...prev, [column]: computed }));
  };

  const customPicklistFields = useMemo(() => {
    const keys = new Set<string>();
    leads.forEach((lead) => {
      if (!lead.custom_fields || typeof lead.custom_fields !== 'object') return;
      Object.entries(lead.custom_fields as Record<string, unknown>).forEach(([key, value]) => {
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (!trimmed) return;
        keys.add(key);
      });
    });
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const groupedWorkspaceDetails = useMemo(
    () => groupLeadsForWorkspaceDetails(leads, detailsGroupBy),
    [leads, detailsGroupBy],
  );

  const toggleDetailsGroupCollapse = (groupKey: string) => {
    setDetailsCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  useEffect(() => {
    setDetailsCollapsedGroups(new Set());
  }, [detailsGroupBy, page]);

  useEffect(() => {
    if (!context?.userId) return;
    const loadDetailsGrouping = async () => {
      const key = `user:${context.userId}:leads.workspace.details.group_by`;
      const { data } = await scopedDb.getSystemSetting(key);
      const savedValue = data?.setting_value;
      if (typeof savedValue !== 'string') return;
      if (savedValue === 'none' || savedValue === 'owner' || savedValue === 'status' || savedValue === 'created_day' || savedValue === 'created_week' || savedValue === 'created_month' || savedValue === 'source' || savedValue.startsWith('custom:')) {
        setDetailsGroupBy(savedValue as WorkspaceDetailsGroupBy);
      }
    };
    void loadDetailsGrouping();
  }, [context?.userId, scopedDb]);

  useEffect(() => {
    if (!context?.userId) return;
    const key = `user:${context.userId}:leads.workspace.details.group_by`;
    void scopedDb.setSystemSetting(key, detailsGroupBy);
  }, [context?.userId, detailsGroupBy, scopedDb]);

  useEffect(() => {
    const saved = localStorage.getItem(ACTIVITY_TABLE_PREFERENCES_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        sortField?: ActivitySortableColumn;
        sortDirection?: ActivitySortDirection;
        widths?: Partial<Record<ActivitySortableColumn | 'actions', number>>;
      };
      if (parsed.sortField) setActivitySortField(parsed.sortField);
      if (parsed.sortDirection) setActivitySortDirection(parsed.sortDirection);
      if (parsed.widths && typeof parsed.widths === 'object') {
        const next: Partial<Record<ActivitySortableColumn | 'actions', number>> = {};
        Object.entries(parsed.widths).forEach(([key, value]) => {
          if (typeof value !== 'number' || !Number.isFinite(value)) return;
          const safe = Math.max(ACTIVITY_TABLE_MIN_COLUMN_WIDTH, Math.min(ACTIVITY_TABLE_MAX_COLUMN_WIDTH, Math.round(value)));
          if (key === 'subject' || key === 'activity_type' || key === 'status' || key === 'priority' || key === 'due_date' || key === 'created_at' || key === 'actions') {
            next[key] = safe;
          }
        });
        setActivityColumnWidths(next);
      }
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => {
    const payload = {
      sortField: activitySortField,
      sortDirection: activitySortDirection,
      widths: activityColumnWidths,
    };
    try {
      localStorage.setItem(ACTIVITY_TABLE_PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      void 0;
    }
    if (!context?.userId) return;
    const settingKey = `user:${context.userId}:leads.activities.table`;
    void scopedDb.setSystemSetting(settingKey, payload);
  }, [activitySortField, activitySortDirection, activityColumnWidths, context?.userId, scopedDb]);

  useEffect(() => {
    if (!context?.userId) return;
    const loadTablePreferences = async () => {
      const settingKey = `user:${context.userId}:leads.activities.table`;
      const { data } = await scopedDb.getSystemSetting(settingKey);
      if (!data?.setting_value || typeof data.setting_value !== 'object') return;
      const value = data.setting_value as {
        sortField?: ActivitySortableColumn;
        sortDirection?: ActivitySortDirection;
        widths?: Partial<Record<ActivitySortableColumn | 'actions', number>>;
      };
      if (value.sortField) setActivitySortField(value.sortField);
      if (value.sortDirection) setActivitySortDirection(value.sortDirection);
      if (value.widths && typeof value.widths === 'object') setActivityColumnWidths(value.widths);
    };
    void loadTablePreferences();
  }, [context?.userId, scopedDb]);

  useEffect(() => {
    if (!activeActivityResizeColumn) return;
    const onMouseMove = (event: MouseEvent) => {
      const meta = activityResizeMetaRef.current;
      if (!meta || meta.key !== activeActivityResizeColumn) return;
      const delta = event.clientX - meta.startX;
      const next = Math.max(
        ACTIVITY_TABLE_MIN_COLUMN_WIDTH,
        Math.min(ACTIVITY_TABLE_MAX_COLUMN_WIDTH, Math.round(meta.startWidth + delta)),
      );
      setActivityColumnWidths((prev) => ({ ...prev, [meta.key]: next }));
    };
    const onMouseUp = () => {
      setActiveActivityResizeColumn(null);
      activityResizeMetaRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [activeActivityResizeColumn]);

  useEffect(() => {
    const container = splitContainerRef.current;
    if (!container) return;
    const syncHeight = () => {
      const fullHeight = container.clientHeight;
      if (fullHeight <= 0) return;
      const minTop = LIST_PANE_MIN_HEIGHT;
      const maxTop = fullHeight - DETAILS_PANE_MIN_HEIGHT;
      const defaultTop = Math.round(fullHeight * DEFAULT_LIST_DETAILS_SPLIT_RATIO);
      setListPaneHeight((prev) => {
        const source = prev || defaultTop;
        return Math.min(maxTop, Math.max(minTop, source));
      });
    };
    syncHeight();
    window.addEventListener('resize', syncHeight);
    return () => window.removeEventListener('resize', syncHeight);
  }, [splitContainerRef]);

  useEffect(() => {
    if (!isResizingPane) return;
    const onMove = (event: MouseEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const rawTop = event.clientY - rect.top;
      const nextTop = Math.max(LIST_PANE_MIN_HEIGHT, Math.min(rect.height - DETAILS_PANE_MIN_HEIGHT, rawTop));
      setListPaneHeight(nextTop);
      const ratio = rect.height > 0 ? nextTop / rect.height : DEFAULT_LIST_DETAILS_SPLIT_RATIO;
      localStorage.setItem(LIST_DETAILS_SPLIT_STORAGE_KEY, String(ratio));
    };
    const onUp = () => setIsResizingPane(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizingPane]);

  const commitPageInput = () => {
    const parsed = Number(pageInput);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(page));
      return;
    }
    const next = Math.max(1, Math.min(totalPages, Math.floor(parsed)));
    setPage(next);
    setPageInput(String(next));
  };
  const visibleFieldSet = useMemo(() => {
    const allowed = new Set<ListFieldKey>(LIST_FIELD_OPTIONS.map((field) => field.key));
    const fromState = Array.isArray(listVisibleFields)
      ? listVisibleFields.filter((f): f is ListFieldKey => allowed.has(f as ListFieldKey))
      : [];
    const keys = fromState.length > 0 ? fromState : DEFAULT_LIST_FIELDS;
    return new Set<ListFieldKey>(keys);
  }, [listVisibleFields]);

  const visibleFieldList = useMemo(
    () => LIST_FIELD_OPTIONS.map((item) => item.key).filter((key) => visibleFieldSet.has(key)),
    [visibleFieldSet]
  );

  const visibleColumnFields = useMemo(
    () => LIST_FIELD_OPTIONS.filter((field) => field.tableColumn && visibleFieldSet.has(field.key)),
    [visibleFieldSet]
  );
  const statusLabels = useMemo(
    () => ({
      new: t('leads.filters.statusOptions.new', 'New'),
      contacted: t('leads.filters.statusOptions.contacted', 'Contacted'),
      qualified: t('leads.filters.statusOptions.qualified', 'Qualified'),
      proposal: t('leads.filters.statusOptions.proposal', 'Proposal'),
      negotiation: t('leads.filters.statusOptions.negotiation', 'Negotiation'),
      won: t('leads.filters.statusOptions.won', 'Won'),
      lost: t('leads.filters.statusOptions.lost', 'Lost'),
    }),
    [t]
  );
  const ownerLabels = useMemo(
    () => ({
      any: t('leads.filters.anyOwner', 'Any Owner'),
      me: t('leads.filters.ownerOptions.me', 'Assigned to Me'),
      unassigned: t('leads.filters.ownerOptions.unassigned', 'Unassigned'),
    }),
    [t]
  );
  const scoreLabels = useMemo(
    () => ({
      all: t('leads.filters.allScores', 'All Scores'),
      high: t('leads.filters.scoreOptions.high', 'High'),
      medium: t('leads.filters.scoreOptions.medium', 'Medium'),
      low: t('leads.filters.scoreOptions.low', 'Low'),
    }),
    [t]
  );
  const activeFilterTags = useMemo(() => {
    const tags: Array<{ key: string; label: string; onClear: () => void }> = [];
    if (searchQuery) {
      tags.push({
        key: 'search',
        label: `${t('leads.filters.search', 'Search')}: ${searchQuery}`,
        onClear: () => setSearchQuery(''),
      });
    }
    if (statusFilter !== 'all') {
      tags.push({
        key: 'status',
        label: `${t('leads.filters.status', 'Stage')}: ${statusLabels[statusFilter as keyof typeof statusLabels] || statusFilter}`,
        onClear: () => setStatusFilter('all'),
      });
    }
    if (ownerFilter !== 'any') {
      tags.push({
        key: 'owner',
        label: `${t('leads.filters.owner', 'Owner')}: ${ownerLabels[ownerFilter] || ownerFilter}`,
        onClear: () => setOwnerFilter('any'),
      });
    }
    if (scoreFilter !== 'all') {
      tags.push({
        key: 'score-bucket',
        label: `${t('leads.filters.score', 'Score')}: ${scoreLabels[scoreFilter as keyof typeof scoreLabels] || scoreFilter}`,
        onClear: () => setScoreFilter('all'),
      });
    }
    if (nameQuery) {
      tags.push({
        key: 'name',
        label: `${t('leads.filters.name', 'Name')} (${nameOp === 'equals' ? t('leads.filters.ops.equals', 'equals') : t('leads.filters.ops.contains', 'contains')}): ${nameQuery}`,
        onClear: () => setNameQuery(''),
      });
    }
    if (valueMin || valueMax) {
      tags.push({
        key: 'value-range',
        label: `${t('leads.filters.valueRange', 'Deal Value')}: ${valueMin || t('leads.filters.range.from', 'Any')} - ${valueMax || t('leads.filters.range.to', 'Any')}`,
        onClear: () => {
          setValueMin('');
          setValueMax('');
        },
      });
    }
    return tags;
  }, [searchQuery, statusFilter, ownerFilter, scoreFilter, nameQuery, nameOp, valueMin, valueMax, t, statusLabels, ownerLabels, scoreLabels]);

  const handleFieldVisibilityChange = (field: ListFieldKey, checked: boolean | 'indeterminate') => {
    const next = new Set(visibleFieldList);
    if (checked === true) {
      next.add(field);
    } else {
      next.delete(field);
    }
    setWorkspace({
      listVisibleFields: LIST_FIELD_OPTIONS.map((item) => item.key).filter((key) => next.has(key)),
    });
  };

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const renderCustomFields = (value: Lead['custom_fields']) => {
    if (!value) return '-';
    const text = JSON.stringify(value);
    return text.length > 120 ? `${text.slice(0, 120)}...` : text;
  };

  const getLeadGroupLabel = (lead: Lead, selectedGroupBy: LeadGroupBy) => {
    if (selectedGroupBy === 'status') return lead.status || t('leads.groupBy.unknown', 'Unknown');
    if (selectedGroupBy === 'source') return lead.source || t('leads.groupBy.unknown', 'Unknown');
    if (selectedGroupBy === 'assigned_to') return lead.owner_id || t('leads.groupBy.unassigned', 'Unassigned');
    if (selectedGroupBy === 'industry') {
      const industry = (lead.custom_fields && typeof lead.custom_fields === 'object' && 'industry' in lead.custom_fields)
        ? String((lead.custom_fields as Record<string, unknown>).industry || '')
        : '';
      return industry || t('leads.groupBy.notSpecified', 'Not Specified');
    }
    if (selectedGroupBy === 'created_date') {
      if (!lead.created_at) return t('leads.groupBy.unknownDate', 'Unknown Date');
      const createdAt = new Date(lead.created_at);
      if (Number.isNaN(createdAt.getTime())) return t('leads.groupBy.unknownDate', 'Unknown Date');
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(todayStart.getDate() - todayStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      if (createdAt >= todayStart) return t('leads.groupBy.today', 'Today');
      if (createdAt >= weekStart) return t('leads.groupBy.thisWeek', 'This Week');
      if (createdAt >= monthStart) return t('leads.groupBy.thisMonth', 'This Month');
      return t('leads.groupBy.older', 'Older');
    }
    return '';
  };

  const groupedLeads = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: '', leads }];
    }
    const buckets = new Map<string, Lead[]>();
    leads.forEach((lead) => {
      const label = getLeadGroupLabel(lead, groupBy);
      const existing = buckets.get(label) || [];
      existing.push(lead);
      buckets.set(label, existing);
    });
    return Array.from(buckets.entries()).map(([label, groupLeads]) => ({
      key: `${groupBy}:${label}`,
      label,
      leads: groupLeads,
    }));
  }, [groupBy, leads, t]);

  useEffect(() => {
    setCollapsedGroups(new Set());
  }, [groupBy, page]);

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const getDefaultColumnWidth = (column: ListTableColumnKey) => {
    if (column === 'name') return 220;
    if (column === 'actions') return 76;
    if (column === 'score') return 150;
    if (column === 'estimated_value') return 140;
    if (column === 'description' || column === 'notes') return 260;
    if (column === 'custom_fields') return 280;
    return 170;
  };

  const getColumnWidth = (column: ListTableColumnKey) => columnWidths[column] ?? getDefaultColumnWidth(column);

  const getColumnStyle = (column: ListTableColumnKey) => {
    const width = getColumnWidth(column);
    return { width: `${width}px`, minWidth: `${width}px` };
  };

  const startColumnResize = (event: React.MouseEvent<HTMLDivElement>, column: ListTableColumnKey) => {
    event.preventDefault();
    event.stopPropagation();
    resizeMetaRef.current = {
      key: column,
      startX: event.clientX,
      startWidth: getColumnWidth(column),
    };
    setActiveResizeColumn(column);
  };

  const getFieldCellClass = (field: ListFieldKey) => {
    if (field === 'estimated_value') return 'text-right';
    if (field === 'description' || field === 'notes') return 'max-w-[240px] truncate';
    if (field === 'custom_fields') return 'max-w-[260px] truncate';
    return undefined;
  };

  const renderFieldCell = (lead: Lead, field: ListFieldKey) => {
    switch (field) {
      case 'title':
        return lead.title || '-';
      case 'company':
        return lead.company || '-';
      case 'email':
        return lead.email || '-';
      case 'phone':
        return lead.phone || '-';
      case 'status':
        return <Badge variant="secondary" className="capitalize">{lead.status}</Badge>;
      case 'source':
        return lead.source || '-';
      case 'qualification_status':
        return lead.qualification_status || '-';
      case 'score':
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-16 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  (lead.lead_score || 0) > 80 ? 'bg-green-500' :
                  (lead.lead_score || 0) > 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${lead.lead_score || 0}%` }}
              />
            </div>
            <span className="text-xs font-medium">{lead.lead_score ?? '-'}</span>
          </div>
        );
      case 'estimated_value':
        return formatCurrency(lead.estimated_value);
      case 'expected_close_date':
        return formatDate(lead.expected_close_date);
      case 'last_activity_date':
        return formatDate(lead.last_activity_date);
      case 'created_at':
        return formatDateTime(lead.created_at);
      case 'updated_at':
        return formatDateTime(lead.updated_at);
      case 'converted_at':
        return formatDate(lead.converted_at);
      case 'owner_id':
        return lead.owner_id || '-';
      case 'description':
        return lead.description || '-';
      case 'notes':
        return lead.notes || '-';
      case 'custom_fields':
        return renderCustomFields(lead.custom_fields);
      case 'franchise_id':
        return lead.franchise_id || '-';
      case 'tenant_id':
        return lead.tenant_id || '-';
      case 'actions':
        return (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        );
      default:
        return null;
    }
  };

  const getHeaderClass = (field: ListFieldKey) => {
    if (field === 'estimated_value') return 'text-right';
    return undefined;
  };

  const toggleSelectAllVisible = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      const next = new Set(selectedIds);
      leads.forEach((lead) => next.add(lead.id));
      setSelectedIds(Array.from(next));
      return;
    }
    const next = new Set(selectedIds);
    leads.forEach((lead) => next.delete(lead.id));
    setSelectedIds(Array.from(next));
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(Array.from(next));
  };

  const { performDeleteWithUndo } = useUndo();

  const handleBulkDelete = async () => {
    if (!window.confirm(t('leads.messages.deleteConfirm', { count: selectedIds.size }))) return;
    
    try {
      const { error } = await scopedDb.from('leads').delete().in('id', Array.from(selectedIds));
      if (error) throw error;
      
      toast.success(t('leads.messages.deleteSuccess', { count: selectedIds.size }));
      setSelectedIds([]);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting leads:', error);
      toast.error(t('leads.messages.deleteError'));
    }
  };

  const handleDelete = async (id: string) => {
    const leadToDelete = leads.find(l => l.id === id);
    if (!leadToDelete) return;

    await performDeleteWithUndo({
      table: 'leads',
      data: leadToDelete,
      label: 'Lead',
      onSuccess: () => {
        if (selectedIds.has(id)) toggleSelection(id);
        fetchLeads();
      }
    });
  };

  return (
    <DashboardLayout>
      <div style={themeStyleFromPreset(currentTheme)} className="min-h-full transition-colors duration-300">
        <FirstScreenTemplate
          title={t('leads.title', 'Leads Workspace')}
          actionsRight={
            <CRMModuleHeaderNavigation
              moduleLabel="Leads"
              viewMode={viewState.view}
              theme={currentTheme}
              onViewModeChange={(mode) => handleViewChange(mode as ViewMode)}
              analyticsLabel={t('leads.tabs.analytics', 'Analytics')}
              onAnalyticsClick={() => {
                try {
                  localStorage.setItem('leadsViewMode', 'pipeline');
                } catch {
                  void 0;
                }
                scopedDb.logViewPreference('leads', 'pipeline');
                setView('pipeline');
                setPipeline({ q: '', status: [] });
                navigate('/dashboard/leads/pipeline?view=analytics');
              }}
              controlSequence={['pipeline', 'list', 'create', 'card', 'grid', 'refresh', 'analytics', 'importExport', 'theme']}
              onThemeChange={handleThemeChange}
              onCreate={() => navigate('/dashboard/leads/new')}
              createLabel="New Lead"
              iconOnly
              layout="compact"
              onRefresh={fetchLeads}
              onImportExport={() => {
                const params = buildLeadsImportExportParams({
                  viewMode,
                  searchQuery,
                  statusFilter,
                  scoreMin,
                  scoreMax,
                  createdStart,
                  createdEnd,
                  groupBy,
                });
                navigate(`/dashboard/leads/import-export?${params.toString()}`);
              }}
            />
          }
        >
        {/* Filters */}
        <div className="flex flex-col gap-0.5 mb-1.5">
          <div className="w-full overflow-x-auto">
            <div className="flex flex-nowrap items-center gap-0.5 min-w-max">
              <div className="relative w-[280px] shrink-0">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('leads.filters.searchPlaceholder', 'Search by name, company, or email')}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="h-7 pl-8.5 bg-background"
              />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 w-[160px] shrink-0 bg-background px-1">
                <Filter className="mr-0.5 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={t('leads.filters.status', 'Stage')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('leads.filters.allStatus', 'All Status')}</SelectItem>
                <SelectItem value="new">{t('leads.filters.statusOptions.new', 'New')}</SelectItem>
                <SelectItem value="contacted">{t('leads.filters.statusOptions.contacted', 'Contacted')}</SelectItem>
                <SelectItem value="qualified">{t('leads.filters.statusOptions.qualified', 'Qualified')}</SelectItem>
                <SelectItem value="proposal">{t('leads.filters.statusOptions.proposal', 'Proposal')}</SelectItem>
                <SelectItem value="negotiation">{t('leads.filters.statusOptions.negotiation', 'Negotiation')}</SelectItem>
                <SelectItem value="won">{t('leads.filters.statusOptions.won', 'Won')}</SelectItem>
                <SelectItem value="lost">{t('leads.filters.statusOptions.lost', 'Lost')}</SelectItem>
              </SelectContent>
              </Select>

              <Select value={ownerFilter} onValueChange={(v) => setOwnerFilter(v as 'any' | 'unassigned' | 'me')}>
              <SelectTrigger className="h-7 w-[160px] shrink-0 bg-background px-1">
                <UsersIcon className="mr-0.5 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={t('leads.filters.owner', 'Owner')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('leads.filters.anyOwner', 'Any Owner')}</SelectItem>
                <SelectItem value="me">{t('leads.filters.ownerOptions.me', 'Assigned to Me')}</SelectItem>
                <SelectItem value="unassigned">{t('leads.filters.ownerOptions.unassigned', 'Unassigned')}</SelectItem>
              </SelectContent>
              </Select>

              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger className="h-7 w-[160px] shrink-0 bg-background px-1">
                  <TrendingUp className="mr-0.5 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder={t('leads.filters.score', 'Score')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('leads.filters.allScores', 'All Scores')}</SelectItem>
                  <SelectItem value="high">{t('leads.filters.scoreOptions.high', 'High')}</SelectItem>
                  <SelectItem value="medium">{t('leads.filters.scoreOptions.medium', 'Medium')}</SelectItem>
                  <SelectItem value="low">{t('leads.filters.scoreOptions.low', 'Low')}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as LeadGroupBy)}>
                <SelectTrigger className="h-7 w-[170px] shrink-0 bg-background px-1" aria-label={t('leads.filters.groupBy', 'Group By')}>
                  <SelectValue placeholder={t('leads.filters.groupBy', 'Group By')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('leads.groupBy.none', 'No Grouping')}</SelectItem>
                  <SelectItem value="status">{t('leads.groupBy.status', 'Lead Status')}</SelectItem>
                  <SelectItem value="source">{t('leads.groupBy.source', 'Lead Source')}</SelectItem>
                  <SelectItem value="assigned_to">{t('leads.groupBy.assignedTo', 'Assigned To')}</SelectItem>
                  <SelectItem value="industry">{t('leads.groupBy.industry', 'Industry')}</SelectItem>
                  <SelectItem value="created_date">{t('leads.groupBy.createdDate', 'Created Date')}</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex flex-nowrap items-center gap-0.5 shrink-0">
                <Input
                  type="number"
                  placeholder={t('leads.filters.valueMin', 'Min Value')}
                  value={valueMin}
                  onChange={(e) => setValueMin(e.target.value)}
                  className="h-7 w-[120px] bg-background"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  placeholder={t('leads.filters.valueMax', 'Max Value')}
                  value={valueMax}
                  onChange={(e) => setValueMax(e.target.value)}
                  className="h-7 w-[120px] bg-background"
                />
              </div>

              <div className="flex flex-nowrap items-center gap-0.5 shrink-0">
                <Select value={nameOp} onValueChange={(v) => setNameOp(v as TextOp)}>
                  <SelectTrigger className="h-7 w-[130px] bg-background px-1">
                    <SelectValue placeholder={t('leads.filters.nameMatch', 'Name Match')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">{t('leads.filters.ops.contains', 'Contains')}</SelectItem>
                    <SelectItem value="equals">{t('leads.filters.ops.equals', 'Equals')}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={t('leads.filters.name', 'Lead Name')}
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  className="h-7 w-[150px] bg-background"
                />
              </div>

              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-7 shrink-0 px-1.5">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  {t('leads.filters.fields', 'Fields')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 max-h-96 overflow-y-auto">
                <DropdownMenuLabel>{t('leads.filters.visibleFields', 'Visible Fields')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {LIST_FIELD_OPTIONS.map((field) => (
                  <DropdownMenuCheckboxItem
                    key={field.key}
                    checked={visibleFieldSet.has(field.key)}
                    onCheckedChange={(checked) => handleFieldVisibilityChange(field.key, checked)}
                  >
                    {field.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                className="h-7 shrink-0 px-1.5"
                disabled={activeFilterTags.length === 0}
                onClick={clearAllFilters}
              >
                {t('leads.filters.clearFilters', 'Clear Filters')}
              </Button>
            </div>
          </div>
          {activeFilterTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeFilterTags.map((tag) => (
                <Badge key={tag.key} variant="secondary" className="flex items-center gap-1 pr-1">
                  <span>{tag.label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    onClick={tag.onClear}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="h-[120px] animate-pulse">
                    <CardHeader className="pb-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-6 w-12" /></CardHeader>
                    <CardContent><Skeleton className="h-4 w-24" /></CardContent>
                  </Card>
                ))}
             </div>
             <TableSkeleton columns={Math.max(6, visibleColumnFields.length + 2)} rows={8} />
          </div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-10 w-10" />}
            title={t('leads.messages.noLeads')}
            description={searchQuery ? t('leads.messages.noLeadsDescSearch') : t('leads.messages.noLeadsDescNew')}
            actionLabel={!searchQuery ? t('leads.actions.addLead') : undefined}
            onAction={!searchQuery ? () => navigate('/dashboard/leads/new') : undefined}
          />
        ) : viewMode === 'list' ? (
          <div ref={splitContainerRef} className="flex h-[calc(100vh-260px)] min-h-[640px] flex-col overflow-hidden rounded-md border bg-background">
            <div className="overflow-auto" style={listPaneHeight > 0 ? { height: `${listPaneHeight}px` } : undefined}>
            <div className="rounded-md border bg-white overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="w-[50px] py-1">
                      <Checkbox
                        checked={allVisibleSelected ? true : partiallyVisibleSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAllVisible}
                      />
                    </TableHead>
                    <TableHead className="py-1 pr-0" style={getColumnStyle('name')}>
                      <div className="relative pr-2">
                        <Button
                          variant="ghost"
                          className="p-0 hover:bg-transparent font-medium"
                          onClick={() => {
                            const dir = sortField === 'first_name' && sortDirection === 'asc' ? 'desc' : 'asc';
                            setSorting('first_name', dir);
                          }}
                        >
                          Name <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                        <div
                          role="separator"
                          aria-label="Resize Name column"
                          className={`absolute top-0 right-0 h-full w-2 cursor-col-resize select-none ${activeResizeColumn === 'name' ? 'bg-primary/20' : 'hover:bg-muted/80'}`}
                          onMouseDown={(event) => startColumnResize(event, 'name')}
                        />
                      </div>
                    </TableHead>
                    {visibleColumnFields.map((field) => {
                      const sortableBy = SORT_FIELD_MAP[field.key];
                      const isSorted = sortableBy && sortField === sortableBy;
                      if (!sortableBy) {
                        return (
                          <TableHead key={field.key} className={`${getHeaderClass(field.key) || ''} py-1 pr-0`} style={getColumnStyle(field.key as ListTableColumnKey)}>
                            <div className="relative pr-2">
                              {field.label}
                              <div
                                role="separator"
                                aria-label={`Resize ${field.label} column`}
                                className={`absolute top-0 right-0 h-full w-2 cursor-col-resize select-none ${activeResizeColumn === field.key ? 'bg-primary/20' : 'hover:bg-muted/80'}`}
                                onMouseDown={(event) => startColumnResize(event, field.key as ListTableColumnKey)}
                              />
                            </div>
                          </TableHead>
                        );
                      }
                      return (
                        <TableHead key={field.key} className={`${getHeaderClass(field.key) || ''} py-1 pr-0`} style={getColumnStyle(field.key as ListTableColumnKey)}>
                          <div className="relative pr-2">
                            <Button
                              variant="ghost"
                              className={`p-0 hover:bg-transparent font-medium ${field.key === 'estimated_value' ? 'justify-end w-full' : ''}`}
                              onClick={() => {
                                const dir = isSorted && sortDirection === 'asc' ? 'desc' : 'asc';
                                setSorting(sortableBy, dir);
                              }}
                            >
                              {field.label}
                              <ArrowUpDown className="ml-2 h-4 w-4" />
                            </Button>
                            <div
                              role="separator"
                              aria-label={`Resize ${field.label} column`}
                              className={`absolute top-0 right-0 h-full w-2 cursor-col-resize select-none ${activeResizeColumn === field.key ? 'bg-primary/20' : 'hover:bg-muted/80'}`}
                              onMouseDown={(event) => startColumnResize(event, field.key as ListTableColumnKey)}
                            />
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedLeads.map((group) => (
                    <Fragment key={group.key}>
                      {groupBy !== 'none' && (
                        <TableRow key={`${group.key}-header`} className="h-8 bg-muted/40">
                          <TableCell colSpan={visibleColumnFields.length + 2} className="py-1">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between text-left"
                              onClick={() => toggleGroupCollapse(group.key)}
                              aria-expanded={!collapsedGroups.has(group.key)}
                            >
                              <span className="inline-flex items-center gap-2 text-sm font-medium">
                                {collapsedGroups.has(group.key) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                {group.label}
                              </span>
                              <Badge variant="secondary">{group.leads.length}</Badge>
                            </button>
                          </TableCell>
                        </TableRow>
                      )}
                      {!collapsedGroups.has(group.key) && group.leads.map((lead) => (
                        <TableRow
                          key={lead.id}
                          className={`h-8 hover:bg-slate-50/50 cursor-pointer ${focusedLead?.id === lead.id ? 'bg-slate-100/70' : ''}`}
                          onClick={() => handleLeadSingleClick(lead)}
                          onDoubleClick={() => handleLeadDoubleClick(lead)}
                        >
                          <TableCell className="py-1" onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(lead.id)}
                              onCheckedChange={() => toggleSelection(lead.id)}
                            />
                          </TableCell>
                          <TableCell className="py-1 font-medium" style={getColumnStyle('name')}>
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm leading-tight">{lead.first_name} {lead.last_name}</span>
                              {visibleFieldSet.has('email_under_name') && (
                                <span className="text-xs text-muted-foreground leading-tight">{lead.email || '-'}</span>
                              )}
                            </div>
                          </TableCell>
                          {visibleColumnFields.map((field) => (
                            <TableCell key={`${lead.id}-${field.key}`} className={`py-1 ${getFieldCellClass(field.key) || ''}`} style={getColumnStyle(field.key as ListTableColumnKey)}>
                              {renderFieldCell(lead, field.key)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                {t('leads.pagination.showingRange', 'Showing {{start}}-{{end}} of {{total}} records', {
                  start: recordStart,
                  end: recordEnd,
                  total: totalCount,
                })}
                {' • '}
                {t('leads.pagination.rowsSelected', '{{selected}} selected', {
                  selected: selectedIds.size,
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('leads.pagination.rowsPerPage', 'Rows per page')}</span>
                <Select value={String(pageSize)} onValueChange={setPageSize}>
                  <SelectTrigger className="h-8 w-[82px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">{t('leads.pagination.page', 'Page')}</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={commitPageInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="h-8 w-[68px]"
                />
                <span className="text-sm text-muted-foreground">
                  {t('leads.pagination.ofPages', 'of {{totalPages}}', { totalPages })}
                </span>
                <Button variant="outline" size="sm" disabled={!canGoPrevious} onClick={() => setPage(page - 1)}>
                  {t('leads.pagination.previous', 'Previous')}
                </Button>
                <Button variant="outline" size="sm" disabled={!canGoNext} onClick={() => setPage(page + 1)}>
                  {t('leads.pagination.next', 'Next')}
                </Button>
              </div>
            </div>
            </div>
            <div
              role="separator"
              aria-orientation="horizontal"
              className={`h-2 cursor-row-resize border-y bg-muted/60 ${isResizingPane ? 'bg-primary/20' : ''}`}
              onMouseDown={() => setIsResizingPane(true)}
            />
            <div className="min-h-0 flex-1 overflow-auto p-1.5">
            <Card className="border bg-card">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {t('leads.listDetails.title', 'Lead Workspace Details')}
                    </CardTitle>
                    <CardDescription>
                      {focusedLead
                        ? t('leads.listDetails.subtitleWithLead', 'Focused lead: {{name}}', {
                            name: `${focusedLead.first_name || ''} ${focusedLead.last_name || ''}`.trim() || focusedLead.email || '-',
                          })
                        : t('leads.listDetails.subtitle', 'Select a lead from the list to view details')}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('leads.listDetails.groupBy', 'Group by')}</span>
                    <Select value={detailsGroupBy} onValueChange={(value) => setDetailsGroupBy(value as WorkspaceDetailsGroupBy)}>
                      <SelectTrigger className="h-8 w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('leads.listDetails.groupByOptions.none', 'No Grouping')}</SelectItem>
                        <SelectItem value="owner">{t('leads.listDetails.groupByOptions.owner', 'Lead Owner')}</SelectItem>
                        <SelectItem value="status">{t('leads.listDetails.groupByOptions.status', 'Status')}</SelectItem>
                        <SelectItem value="source">{t('leads.listDetails.groupByOptions.source', 'Lead Source')}</SelectItem>
                        <SelectItem value="created_day">{t('leads.listDetails.groupByOptions.createdDay', 'Created Day')}</SelectItem>
                        <SelectItem value="created_week">{t('leads.listDetails.groupByOptions.createdWeek', 'Created Week')}</SelectItem>
                        <SelectItem value="created_month">{t('leads.listDetails.groupByOptions.createdMonth', 'Created Month')}</SelectItem>
                        {customPicklistFields.map((field) => (
                          <SelectItem key={field} value={`custom:${field}`}>
                            {t('leads.listDetails.groupByOptions.customField', 'Custom: {{field}}', { field })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={detailsTab} onValueChange={setDetailsTab}>
                  <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                    <TabsTrigger value="activities">{t('leads.listDetails.tabs.activities', 'Activities')}</TabsTrigger>
                    <TabsTrigger value="accountDetails">{t('leads.listDetails.tabs.accountDetails', 'Account Details')}</TabsTrigger>
                    <TabsTrigger value="contactsDetails">{t('leads.listDetails.tabs.contactsDetails', 'Contacts Details')}</TabsTrigger>
                    <TabsTrigger value="communication">{t('leads.listDetails.tabs.communication', 'Communication')}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="activities" className="mt-4 space-y-3">
                    <div className="relative rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {activityColumns.map((column) => {
                              const isSortable = column.sortable === true;
                              const isSortedColumn = isSortable && activitySortField === column.key;
                              return (
                                <TableHead
                                  key={column.key}
                                  className={column.key === 'actions' ? 'text-right pr-0' : 'pr-0'}
                                  style={getActivityColumnStyle(column.key)}
                                >
                                  <div className={`relative ${column.key === 'actions' ? 'text-right' : ''}`}>
                                    {isSortable ? (
                                      <Button
                                        variant="ghost"
                                        className={`h-7 px-1 text-xs ${column.key === 'actions' ? 'justify-end w-full' : ''}`}
                                        onClick={() => handleActivitySort(column.key as ActivitySortableColumn)}
                                      >
                                        {column.label}
                                        {isSortedColumn ? (
                                          activitySortDirection === 'asc' ? <ArrowUp className="ml-1 h-3.5 w-3.5" /> : <ArrowDown className="ml-1 h-3.5 w-3.5" />
                                        ) : (
                                          <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                                        )}
                                      </Button>
                                    ) : (
                                      <span className="pr-2">{column.label}</span>
                                    )}
                                    <div
                                      role="separator"
                                      aria-label={`Resize ${column.label} column`}
                                      className={`absolute top-0 right-0 h-full w-2 cursor-col-resize select-none ${activeActivityResizeColumn === column.key ? 'bg-primary/20' : 'hover:bg-muted/80'}`}
                                      onMouseDown={(event) => startActivityColumnResize(event, column.key)}
                                      onDoubleClick={() => autoFitActivityColumn(column.key)}
                                    />
                                  </div>
                                </TableHead>
                              );
                            })}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activitiesLoading && (
                            <TableRow>
                              <TableCell colSpan={activityColumns.length} className="py-6 text-center text-sm text-muted-foreground">
                                {t('leads.listDetails.activities.loading', 'Loading activities...')}
                              </TableCell>
                            </TableRow>
                          )}
                          {!activitiesLoading && leadActivities.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={activityColumns.length} className="py-6 text-center text-sm text-muted-foreground">
                                {t('leads.listDetails.activities.empty', 'No activities found for this lead')}
                              </TableCell>
                            </TableRow>
                          )}
                          {!activitiesLoading && sortedLeadActivities.map((activity) => (
                            <TableRow
                              key={activity.id}
                              className="cursor-pointer hover:bg-muted/40"
                              onClick={() => navigate(`/dashboard/activities/${activity.id}`)}
                            >
                              <TableCell className="font-medium" style={getActivityColumnStyle('subject')}>{activity.subject || '-'}</TableCell>
                              <TableCell className="capitalize" style={getActivityColumnStyle('activity_type')}>{activity.activity_type || '-'}</TableCell>
                              <TableCell className="capitalize" style={getActivityColumnStyle('status')}>{(activity.status || '-').replace(/_/g, ' ')}</TableCell>
                              <TableCell className="capitalize" style={getActivityColumnStyle('priority')}>{activity.priority || '-'}</TableCell>
                              <TableCell style={getActivityColumnStyle('due_date')}>{formatDate(activity.due_date)}</TableCell>
                              <TableCell style={getActivityColumnStyle('created_at')}>{formatDateTime(activity.created_at)}</TableCell>
                              <TableCell className="text-right" style={getActivityColumnStyle('actions')}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    navigate(`/dashboard/activities/${activity.id}`);
                                  }}
                                >
                                  <Pencil className="mr-2 h-3.5 w-3.5" />
                                  {t('leads.listDetails.activities.edit', 'Edit')}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {focusedLead && (
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">
                          {t('leads.listDetails.activities.focusedLead', 'Showing activities for {{name}}', {
                            name: `${focusedLead.first_name || ''} ${focusedLead.last_name || ''}`.trim() || focusedLead.email || '-',
                          })}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/dashboard/activities/new?leadId=${focusedLead.id}`)}
                        >
                          {t('leads.listDetails.activities.add', 'Add Activity')}
                        </Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="accountDetails" className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3 text-sm">
                        <span className="text-xs text-muted-foreground">{t('leads.listDetails.company', 'Company')}</span>
                        <p className="font-medium">{focusedLead?.company || '-'}</p>
                      </div>
                      <div className="rounded-md border p-3 text-sm">
                        <span className="text-xs text-muted-foreground">{t('leads.listDetails.owner', 'Owner')}</span>
                        <p className="font-medium">{focusedLead?.owner_id || '-'}</p>
                      </div>
                      <div className="rounded-md border p-3 text-sm">
                        <span className="text-xs text-muted-foreground">{t('leads.listDetails.estimatedValue', 'Estimated Value')}</span>
                        <p className="font-medium">{focusedLead ? formatCurrency(focusedLead.estimated_value) : '-'}</p>
                      </div>
                      <div className="rounded-md border p-3 text-sm">
                        <span className="text-xs text-muted-foreground">{t('leads.listDetails.status', 'Status')}</span>
                        <p className="font-medium capitalize">{focusedLead?.status || '-'}</p>
                      </div>
                    </div>
                    {groupedWorkspaceDetails.length > 0 && (
                      <div className="rounded-md border">
                        {groupedWorkspaceDetails.map((group) => (
                          <div key={group.key} className="border-b last:border-b-0">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between px-3 py-2 text-left"
                              aria-expanded={!detailsCollapsedGroups.has(group.key)}
                              onClick={() => toggleDetailsGroupCollapse(group.key)}
                            >
                              <span className="inline-flex items-center gap-2 text-sm font-medium">
                                {detailsCollapsedGroups.has(group.key) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                {group.label}
                              </span>
                              <Badge variant="secondary">{group.count}</Badge>
                            </button>
                            {!detailsCollapsedGroups.has(group.key) && (
                              <div className="px-3 pb-3">
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                  {group.leads.map((lead) => (
                                    <button
                                      key={lead.id}
                                      type="button"
                                      className={`rounded-md border p-2 text-left text-sm hover:bg-muted/30 ${focusedLead?.id === lead.id ? 'border-primary bg-primary/5' : ''}`}
                                      onClick={() => setFocusedLeadId(lead.id)}
                                    >
                                      <p className="font-medium">{`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email || '-'}</p>
                                      <p className="text-xs text-muted-foreground">{lead.company || '-'}</p>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="contactsDetails" className="mt-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-md border p-3 text-sm">
                        <span className="text-xs text-muted-foreground">{t('leads.listDetails.contactName', 'Contact Name')}</span>
                        <p className="font-medium">{focusedLead ? `${focusedLead.first_name || ''} ${focusedLead.last_name || ''}`.trim() || '-' : '-'}</p>
                      </div>
                      <div className="rounded-md border p-3 text-sm">
                        <span className="text-xs text-muted-foreground">{t('leads.listDetails.email', 'Email')}</span>
                        <p className="font-medium">{focusedLead?.email || '-'}</p>
                      </div>
                      <div className="rounded-md border p-3 text-sm">
                        <span className="text-xs text-muted-foreground">{t('leads.listDetails.phone', 'Phone')}</span>
                        <p className="font-medium">{focusedLead?.phone || '-'}</p>
                      </div>
                      <div className="rounded-md border p-3 text-sm">
                        <span className="text-xs text-muted-foreground">{t('leads.listDetails.qualification', 'Qualification')}</span>
                        <p className="font-medium">{focusedLead?.qualification_status || '-'}</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="communication" className="mt-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!focusedLead?.phone}
                        onClick={() => focusedLead && navigate(`/dashboard/activities/new?leadId=${focusedLead.id}&type=call`)}
                      >
                        {t('leads.listDetails.actions.call', 'Call')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!focusedLead?.email}
                        onClick={() => focusedLead && navigate(`/dashboard/activities/new?leadId=${focusedLead.id}&type=email`)}
                      >
                        {t('leads.listDetails.actions.email', 'Email')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!focusedLead}
                        onClick={() => focusedLead && navigate(`/dashboard/activities/new?leadId=${focusedLead.id}&type=meeting`)}
                      >
                        {t('leads.listDetails.actions.meeting', 'Meeting')}
                      </Button>
                    </div>
                    <div className="rounded-md border p-3 text-sm">
                      <p className="text-xs text-muted-foreground">{t('leads.listDetails.notes', 'Notes')}</p>
                      <p className="font-medium">{focusedLead?.notes || focusedLead?.description || '-'}</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={() => handleLeadSingleClick(lead)}
                onDoubleClick={() => handleLeadDoubleClick(lead)}
                selected={focusedLead?.id === lead.id}
                onSelect={() => toggleSelection(lead.id)}
                onDelete={() => handleDelete(lead.id)}
                onEdit={() => navigateToLeadEdit(lead)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={() => handleLeadSingleClick(lead)}
                onDoubleClick={() => handleLeadDoubleClick(lead)}
                selected={focusedLead?.id === lead.id}
                onSelect={() => toggleSelection(lead.id)}
                onDelete={() => handleDelete(lead.id)}
                onEdit={() => navigateToLeadEdit(lead)}
              />
            ))}
          </div>
        )}
        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-popover text-popover-foreground shadow-lg border rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in fade-in slide-in-from-bottom-4">
            <span className="font-medium text-sm">{t('leads.bulk.selected', { count: selectedIds.size })}</span>
            <div className="h-4 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              {t('leads.actions.cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('leads.actions.delete')}
            </Button>
          </div>
        )}
      </FirstScreenTemplate>
      </div>
    </DashboardLayout>
  );
}
