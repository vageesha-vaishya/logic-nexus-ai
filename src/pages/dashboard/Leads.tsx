import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, UserPlus, DollarSign, Filter, TrendingUp, Users as UsersIcon, Trash2, Palette, ArrowLeft, Download } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ViewToggle, ViewMode } from '@/components/ui/view-toggle';
import { useCRM } from '@/hooks/useCRM';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { matchText, TextOp } from '@/lib/utils';
import { FirstScreenTemplate } from '@/components/system/FirstScreenTemplate';
import { EmptyState } from '@/components/system/EmptyState';
import { TableSkeleton } from '@/components/system/TableSkeleton';
import { LeadCard } from '@/components/crm/LeadCard';
import { DataTable, ColumnDef } from '@/components/system/DataTable';
import { THEME_PRESETS } from '@/theme/themes';
import { themeStyleFromPreset } from '@/lib/theme-utils';
import { Lead, LeadStatus, stages, statusConfig } from './leads-data';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useLeadsViewState } from '@/hooks/useLeadsViewState';
import { useDebounce } from '@/hooks/useDebounce';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/react';
import { useUndo } from '@/hooks/useUndo';

export default function Leads() {
  usePerformanceMonitor('Leads Module');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSavingDefault, setIsSavingDefault] = useState(false);
  const [didSetDefault, setDidSetDefault] = useState(false);
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
      const nextPipelineQ = searchQuery;
      const nextPipelineStatus = statusFilter !== 'all' ? [statusFilter] : [];
      setPipeline({ q: nextPipelineQ, status: nextPipelineStatus });
      const params = new URLSearchParams();
      if (nextPipelineQ) params.set('q', nextPipelineQ);
      if (nextPipelineStatus.length > 0) params.set('status', nextPipelineStatus.join(','));
      const qs = params.toString();
      navigate(qs ? `/dashboard/leads/pipeline?${qs}` : '/dashboard/leads/pipeline');
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

  const handleSetDefaultView = async () => {
    try {
      setIsSavingDefault(true);
      try {
        localStorage.setItem('leadsViewMode', viewState.view);
        localStorage.setItem('leadsTheme', viewState.theme);
      } catch {
        void 0;
      }
      if (context?.userId) {
        const userViewKey = `user:${context.userId}:leads.default_view`;
        const userThemeKey = `user:${context.userId}:leads.default_theme`;
        const [{ error: vErr }, { error: tErr }] = await Promise.all([
          scopedDb.setSystemSetting(userViewKey, viewState.view),
          scopedDb.setSystemSetting(userThemeKey, viewState.theme),
        ]);
        if (vErr || tErr) throw (vErr || tErr);
      }
      setDidSetDefault(true);
      toast.success(t('leads.messages.defaultSet', 'Default saved'));
    } catch (error) {
      logger.error('Failed to set leads default view', {
        view: viewState.view,
        theme: viewState.theme,
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error);
      toast.error(t('leads.messages.defaultSetFailed', 'Failed to save default'));
    } finally {
      setIsSavingDefault(false);
      setTimeout(() => setDidSetDefault(false), 1500);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800';
      case 'contacted': return 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800';
      case 'qualified': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'won': return 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'lost': return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default: return 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800';
    }
  };

  const columns: ColumnDef<Lead>[] = [
    {
      key: 'name',
      header: t('leads.columns.name'),
      render: (l: Lead) => `${l.first_name} ${l.last_name}`,
      sortable: true
    },
    { key: 'company', header: t('leads.columns.company'), sortable: true },
    { key: 'email', header: t('leads.columns.email'), sortable: true },
    { key: 'phone', header: t('leads.columns.phone'), sortable: true },
    {
      key: 'status',
      header: t('leads.columns.status'),
      render: (l: Lead) => <Badge className={getStatusColor(l.status)}>{l.status}</Badge>,
      sortable: true
    },
    {
      key: 'source',
      header: t('leads.columns.source'),
      render: (l: Lead) => <Badge variant="outline">{l.source}</Badge>,
      sortable: true
    },
    {
      key: 'lead_score',
      header: t('leads.columns.score'),
      render: (l: Lead) => l.lead_score !== null ? (
        <div className="flex items-center gap-1">
          <TrendingUp className="h-4 w-4 text-primary" />
          {l.lead_score}
        </div>
      ) : '-',
      sortable: true
    },
    {
      key: 'estimated_value',
      header: t('leads.columns.value'),
      render: (l: Lead) => l.estimated_value ? (
        <div className="flex items-center gap-1 text-green-600">
          <DollarSign className="h-4 w-4" />
          ${l.estimated_value.toLocaleString()}
        </div>
      ) : '-',
      sortable: true
    },
  ];

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
          description={t('leads.subtitle', 'Focus on pipeline and active contacts')}
          actionsRight={
            <div className="flex items-center gap-2">
              <Select value={currentTheme} onValueChange={handleThemeChange}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <Palette className="mr-2 h-3 w-3" />
                  <SelectValue placeholder="Theme" />
                </SelectTrigger>
                <SelectContent>
                  {THEME_PRESETS.map(theme => (
                    <SelectItem key={theme.name} value={theme.name}>
                      {theme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
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
              >
                <Download className="h-4 w-4 mr-2" />
                {t('leads.actions.importExport', 'Import/Export')}
              </Button>
              <ViewToggle 
                value={viewMode} 
                modes={['pipeline', 'card', 'grid', 'list']}
                onChange={handleViewChange} 
              />
              {context?.isPlatformAdmin && (
                <Button variant="outline" size="sm" onClick={handleSetDefaultView}>
                  {t('leads.actions.setDefault', 'Set as Default')}
                </Button>
              )}
              <Button asChild size="sm">
                <Link to="/dashboard/leads/new">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('leads.actions.newLead', 'New Lead')}
                </Link>
              </Button>
            </div>
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
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('leads.filters.search')}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-10 bg-background"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] bg-background">
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
              <SelectTrigger className="w-[160px] bg-background">
                <UsersIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={t('leads.filters.owner')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('leads.filters.anyOwner')}</SelectItem>
                <SelectItem value="me">{t('leads.filters.ownerOptions.me')}</SelectItem>
                <SelectItem value="unassigned">{t('leads.filters.ownerOptions.unassigned')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
             <div className="flex items-center gap-2">
                <Select value={scoreFilter} onValueChange={setScoreFilter}>
                  <SelectTrigger className="w-[160px] bg-background">
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
             
             <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder={t('leads.filters.valueMin')}
                  value={valueMin}
                  onChange={(e) => setValueMin(e.target.value)}
                  className="w-[120px] bg-background"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  placeholder={t('leads.filters.valueMax')}
                  value={valueMax}
                  onChange={(e) => setValueMax(e.target.value)}
                  className="w-[120px] bg-background"
                />
             </div>
             
             {/* Name Filter */}
             <div className="flex items-center gap-2">
                <Select value={nameOp} onValueChange={(v) => setNameOp(v as TextOp)}>
                  <SelectTrigger className="w-[130px] bg-background">
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
                  className="w-[150px] bg-background"
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
             <TableSkeleton columns={6} rows={8} />
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
          <Card>
            <CardContent className="pt-6">
              <DataTable
                data={leads}
                columns={columns as any}
                isLoading={loading}
                onRowClick={(lead) => navigate(`/dashboard/leads/${lead.id}`)}
                selection={{
                  selectedIds: viewState.selection.selectedIds,
                  onSelectionChange: setSelectedIds,
                  rowId: (l) => l.id
                }}
                pagination={{
                  pageIndex: page,
                  pageSize: pageSize,
                  totalCount: totalCount,
                  onPageChange: setPage,
                  onPageSizeChange: setPageSize
                }}
                sorting={{
                  field: sortField,
                  direction: sortDirection,
                  onSort: (field) => {
                    const dir = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
                    setSorting(field, dir);
                  }
                }}
                mobileTitleKey="first_name"
                mobileSubtitleKey="company"
              />
            </CardContent>
          </Card>
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
