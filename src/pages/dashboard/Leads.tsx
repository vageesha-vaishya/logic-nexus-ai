import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, UserPlus, Filter, TrendingUp, Users as UsersIcon, Trash2, ArrowLeft, MoreHorizontal, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import { matchText, TextOp } from '@/lib/utils';
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

export default function Leads() {
  usePerformanceMonitor('Leads Module');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
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
  } = viewState.workspace;

  const [totalCount, setTotalCount] = useState(0);

  // Local state for debounced search
  const [localSearch, setLocalSearch] = useState(searchQuery);
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

  const viewMode = (viewState.view === 'pipeline' ? 'card' : viewState.view) as ViewMode;
  const selectedIds = new Set(viewState.selection.selectedIds);
  const currentTheme = viewState.theme;

  const [searchParams, setSearchParams] = useSearchParams();

  // Sync view state to URL
  useEffect(() => {
    if (!viewState.hydrated) return;
    
    const params = new URLSearchParams(searchParams);
    
    if (searchQuery) params.set('q', searchQuery); else params.delete('q');
    if (statusFilter !== 'all') params.set('status', statusFilter); else params.delete('status');
    if (ownerFilter !== 'any') params.set('owner', ownerFilter); else params.delete('owner');
    if (page > 1) params.set('page', String(page)); else params.delete('page');
    
    // Only update if changed to avoid loops
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [searchQuery, statusFilter, ownerFilter, page, viewState.hydrated]);

  // Sync URL to view state on initial hydration
  useEffect(() => {
    if (!viewState.hydrated) return;
    
    const q = searchParams.get('q');
    const status = searchParams.get('status');
    const owner = searchParams.get('owner');
    const p = searchParams.get('page');
    
    const patch: any = {};
    if (q !== null && q !== searchQuery) patch.searchQuery = q;
    if (status !== null && status !== statusFilter) patch.statusFilter = status;
    if (owner !== null && owner !== ownerFilter) patch.ownerFilter = owner;
    if (p !== null && Number(p) !== page) patch.page = Number(p);
    
    if (Object.keys(patch).length > 0) {
      setWorkspace(patch);
    }
  }, [viewState.hydrated]);

  const setSearchQuery = (val: string) => setWorkspace({ searchQuery: val, page: 1 });
  const setStatusFilter = (val: string) => setWorkspace({ statusFilter: val, page: 1 });
  const setScoreFilter = (val: string) => setWorkspace({ scoreFilter: val, page: 1 });
  const setOwnerFilter = (val: 'any' | 'unassigned' | 'me') => setWorkspace({ ownerFilter: val, page: 1 });
  const setNameQuery = (val: string) => setWorkspace({ nameQuery: val, page: 1 });
  const setNameOp = (val: TextOp) => setWorkspace({ nameOp: val, page: 1 });
  const setValueMin = (val: string) => setWorkspace({ valueMin: val, page: 1 });
  const setValueMax = (val: string) => setWorkspace({ valueMax: val, page: 1 });
  const setPage = (val: number) => setWorkspace({ page: val });
  const setPageSize = (val: number) => setWorkspace({ pageSize: val, page: 1 });
  const setSorting = (field: string, direction: 'asc' | 'desc') => setWorkspace({ sortField: field, sortDirection: direction });

  // KPI Stats
  const stats = {
    total: totalCount,
    won: leads.filter(l => l.status === 'won').length, // This only counts visible page, ideally needs a count query
    contacted: leads.filter(l => l.status === 'contacted').length,
    highScore: leads.filter(l => (l.lead_score || 0) >= 70).length
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
    try {
      setLoading(true);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = scopedDb
        .from('leads')
        .select('*', { count: 'exact' });

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply owner filter
      if (ownerFilter === 'me' && context?.userId) {
        query = query.eq('owner_id', context.userId);
      } else if (ownerFilter === 'unassigned') {
        query = query.is('owner_id', null);
      }

      // Apply search query (simple text search)
      if (searchQuery) {
        query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      // Apply sorting
      query = query.order(sortField, { ascending: sortDirection === 'asc' });

      // Apply range for pagination
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      setLeads(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error(t('leads.messages.fetchFailed', 'Failed to fetch leads'));
    } finally {
      setLoading(false);
    }
  }, [scopedDb, page, pageSize, sortField, sortDirection, statusFilter, ownerFilter, searchQuery, context?.userId, t]);

  useEffect(() => {
    if (!viewState.hydrated) return;
    fetchLeads();
  }, [fetchLeads, viewState.hydrated]);

  const allVisibleSelected = leads.length > 0 && leads.every((lead) => selectedIds.has(lead.id));
  const partiallyVisibleSelected = leads.some((lead) => selectedIds.has(lead.id)) && !allVisibleSelected;
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
    if (field === 'actions') return 'w-[50px]';
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
                const params = new URLSearchParams();
                params.set('from', 'workspace');
                params.set('view', viewMode);
                if (searchQuery) params.set('q', searchQuery);
                if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
                if (scoreMin) params.set('scoreMin', scoreMin);
                if (scoreMax) params.set('scoreMax', scoreMax);
                if (createdStart) params.set('createdFrom', createdStart);
                if (createdEnd) params.set('createdTo', createdEnd);
                navigate(`/dashboard/leads/import-export?${params.toString()}`);
              }}
            />
          }
        >
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="transition-colors shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{t('leads.kpi.totalLeads', 'Total Leads')}</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800">
                {t('leads.kpi.totalLeads', 'Total Leads')}
              </Badge>
            </CardContent>
          </Card>
          <Card className="transition-colors shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{t('leads.kpi.wonDeals', 'Won Deals')}</CardDescription>
              <CardTitle className="text-2xl">{stats.won}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                {t('leads.kpi.wonDeals', 'Won Deals')}
              </Badge>
            </CardContent>
          </Card>
          <Card className="transition-colors shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{t('leads.kpi.contacted', 'Contacted')}</CardDescription>
              <CardTitle className="text-2xl">{stats.contacted}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800">
                {t('leads.kpi.contacted', 'Contacted')}
              </Badge>
            </CardContent>
          </Card>
          <Card className="transition-colors shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{t('leads.kpi.highScore', 'High Score')}</CardDescription>
              <CardTitle className="text-2xl">{stats.highScore}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                {t('leads.kpi.highScore', 'High Score')}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[260px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('leads.filters.search')}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] bg-background">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={t('leads.filters.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('leads.filters.allStatuses')}</SelectItem>
                <SelectItem value="new">{t('leads.filters.statusOptions.new')}</SelectItem>
                <SelectItem value="contacted">{t('leads.filters.statusOptions.contacted')}</SelectItem>
                <SelectItem value="qualified">{t('leads.filters.statusOptions.qualified')}</SelectItem>
                <SelectItem value="proposal">{t('leads.filters.statusOptions.proposal')}</SelectItem>
                <SelectItem value="negotiation">{t('leads.filters.statusOptions.negotiation')}</SelectItem>
                <SelectItem value="won">{t('leads.filters.statusOptions.won')}</SelectItem>
                <SelectItem value="lost">{t('leads.filters.statusOptions.lost')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ownerFilter} onValueChange={(v) => setOwnerFilter(v as 'any' | 'unassigned' | 'me')}>
              <SelectTrigger className="w-full sm:w-[160px] bg-background">
                <UsersIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={t('leads.filters.owner')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('leads.filters.anyOwner')}</SelectItem>
                <SelectItem value="me">{t('leads.filters.ownerOptions.me')}</SelectItem>
                <SelectItem value="unassigned">{t('leads.filters.ownerOptions.unassigned')}</SelectItem>
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Fields
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 max-h-96 overflow-y-auto">
                <DropdownMenuLabel>Visible Fields</DropdownMenuLabel>
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
          </div>

          <div className="flex flex-wrap gap-4 items-center">
             <div className="flex flex-wrap items-center gap-2">
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger className="w-full sm:w-[160px] bg-background">
                    <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder={t('leads.filters.score')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('leads.filters.allScores')}</SelectItem>
                    <SelectItem value="high">{t('leads.filters.scoreOptions.high')}</SelectItem>
                    <SelectItem value="medium">{t('leads.filters.scoreOptions.medium')}</SelectItem>
                    <SelectItem value="low">{t('leads.filters.scoreOptions.low')}</SelectItem>
                  </SelectContent>
                </Select>
             </div>
             
             <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  placeholder={t('leads.filters.valueMin')}
                  value={valueMin}
                  onChange={(e) => setValueMin(e.target.value)}
                  className="w-full sm:w-[120px] bg-background"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  placeholder={t('leads.filters.valueMax')}
                  value={valueMax}
                  onChange={(e) => setValueMax(e.target.value)}
                  className="w-full sm:w-[120px] bg-background"
                />
             </div>
             
             {/* Name Filter */}
             <div className="flex flex-wrap items-center gap-2">
                <Select value={nameOp} onValueChange={(v) => setNameOp(v as TextOp)}>
                  <SelectTrigger className="w-full sm:w-[130px] bg-background">
                    <SelectValue placeholder="Name Op" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">{t('leads.filters.ops.contains')}</SelectItem>
                    <SelectItem value="equals">{t('leads.filters.ops.equals')}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={t('leads.filters.name')}
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  className="w-full sm:w-[150px] bg-background"
                />
             </div>
          </div>
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
          <>
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
                    <TableHead className="w-[200px] py-1">
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
                    </TableHead>
                    {visibleColumnFields.map((field) => {
                      const sortableBy = SORT_FIELD_MAP[field.key];
                      const isSorted = sortableBy && sortField === sortableBy;
                      if (!sortableBy) {
                        return (
                          <TableHead key={field.key} className={`${getHeaderClass(field.key) || ''} py-1`}>
                            {field.label}
                          </TableHead>
                        );
                      }
                      return (
                        <TableHead key={field.key} className={`${getHeaderClass(field.key) || ''} py-1`}>
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
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id} className="h-8 hover:bg-slate-50/50">
                      <TableCell className="py-1">
                        <Checkbox
                          checked={selectedIds.has(lead.id)}
                          onCheckedChange={() => toggleSelection(lead.id)}
                        />
                      </TableCell>
                      <TableCell className="py-1 font-medium">
                        <div className="flex flex-col leading-tight">
                          <span className="text-sm leading-tight">{lead.first_name} {lead.last_name}</span>
                          {visibleFieldSet.has('email_under_name') && (
                            <span className="text-xs text-muted-foreground leading-tight">{lead.email || '-'}</span>
                          )}
                        </div>
                      </TableCell>
                      {visibleColumnFields.map((field) => (
                        <TableCell key={`${lead.id}-${field.key}`} className={`py-1 ${getFieldCellClass(field.key) || ''}`}>
                          {renderFieldCell(lead, field.key)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
              <div className="flex-1 text-sm text-muted-foreground">
                {selectedIds.size} of {totalCount} row(s) selected.
              </div>
              <div className="space-x-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * pageSize >= totalCount}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
                selected={selectedIds.has(lead.id)}
                onSelect={() => toggleSelection(lead.id)}
                onDelete={() => handleDelete(lead.id)}
                onEdit={() => navigate(`/dashboard/leads/${lead.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
                selected={selectedIds.has(lead.id)}
                onSelect={() => toggleSelection(lead.id)}
                onDelete={() => handleDelete(lead.id)}
                onEdit={() => navigate(`/dashboard/leads/${lead.id}`)}
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
