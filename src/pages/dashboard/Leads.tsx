import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, UserPlus, DollarSign, Filter, TrendingUp, Users as UsersIcon, Trash2, Palette, ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { LeadCard } from '@/components/crm/LeadCard';
import { THEME_PRESETS } from '@/theme/themes';
import { themeStyleFromPreset } from '@/lib/theme-utils';
import { Lead, LeadStatus, stages, statusConfig } from './leads-data';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useLeadsViewState } from '@/hooks/useLeadsViewState';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/react';

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
  } = viewState.workspace;

  const viewMode = (viewState.view === 'pipeline' ? 'card' : viewState.view) as ViewMode;
  const selectedIds = new Set(viewState.selection.selectedIds);
  const currentTheme = viewState.theme;

  const setSearchQuery = (val: string) => setWorkspace({ searchQuery: val });
  const setStatusFilter = (val: string) => setWorkspace({ statusFilter: val });
  const setScoreFilter = (val: string) => setWorkspace({ scoreFilter: val });
  const setOwnerFilter = (val: 'any' | 'unassigned' | 'me') => setWorkspace({ ownerFilter: val });
  const setNameQuery = (val: string) => setWorkspace({ nameQuery: val });
  const setNameOp = (val: TextOp) => setWorkspace({ nameOp: val });
  const setValueMin = (val: string) => setWorkspace({ valueMin: val });
  const setValueMax = (val: string) => setWorkspace({ valueMax: val });

  // KPI Stats
  const stats = {
    total: leads.length,
    won: leads.filter(l => l.status === 'won').length,
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
      const { data, error } = await scopedDb
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Validate and cast data
      const safeLeads = (data || []).map((d: any) => ({
        ...d,
        status: stages.includes(d.status as LeadStatus) ? (d.status as LeadStatus) : 'new'
      })) as Lead[];

      setLeads(safeLeads);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to load leads');
      logger.error('Failed to fetch leads (workspace)', {
        q: searchQuery,
        statusFilter,
        scoreFilter,
        ownerFilter,
        error: message,
      });
      Sentry.captureException(error);
    } finally {
      setLoading(false);
    }
  }, [scopedDb, ownerFilter, scoreFilter, searchQuery, statusFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    const matchesScore = scoreFilter === 'all' || 
      (scoreFilter === 'high' && (lead.lead_score || 0) >= 70) ||
      (scoreFilter === 'medium' && (lead.lead_score || 0) >= 40 && (lead.lead_score || 0) < 70) ||
      (scoreFilter === 'low' && (lead.lead_score || 0) < 40);
    
    const matchesOwner =
      ownerFilter === 'any'
        ? true
        : ownerFilter === 'unassigned'
        ? !lead.owner_id
        : lead.owner_id === (context?.userId || null);

    // Advanced per-column text filters
    const fullName = `${lead.first_name} ${lead.last_name}`.trim();
    const matchesName = matchText(fullName, nameQuery, nameOp);
    const matchesCompany = matchText(lead.company ?? '', companyQuery, companyOp);
    const matchesEmail = matchText(lead.email ?? '', emailQuery, emailOp);
    const matchesPhone = matchText(lead.phone ?? '', phoneQuery, phoneOp);
    const matchesSource = matchText(lead.source ?? '', sourceQuery, sourceOp);
    const matchesQualification = matchText(lead.qualification_status ?? '', qualificationQuery, qualificationOp);

    // Numeric ranges (inclusive)
    const scoreVal = lead.lead_score ?? undefined;
    const sMin = scoreMin ? Number(scoreMin) : undefined;
    const sMax = scoreMax ? Number(scoreMax) : undefined;
    const matchesScoreRange = (
      (sMin === undefined || (scoreVal !== undefined && scoreVal >= sMin)) &&
      (sMax === undefined || (scoreVal !== undefined && scoreVal <= sMax))
    );

    const valueVal = lead.estimated_value ?? undefined;
    const vMin = valueMin ? Number(valueMin) : undefined;
    const vMax = valueMax ? Number(valueMax) : undefined;
    const matchesValueRange = (
      (vMin === undefined || (valueVal !== undefined && valueVal >= vMin)) &&
      (vMax === undefined || (valueVal !== undefined && valueVal <= vMax))
    );

    // Date range (created_at)
    const created = lead.created_at ? new Date(lead.created_at) : null;
    const cStart = createdStart ? new Date(createdStart) : null;
    const cEnd = createdEnd ? new Date(createdEnd) : null;
    const matchesCreatedRange = (
      (!cStart || (created && created >= cStart)) &&
      (!cEnd || (created && created <= cEnd))
    );

    return (
      matchesSearch &&
      matchesStatus &&
      matchesScore &&
      matchesOwner &&
      matchesName &&
      matchesCompany &&
      matchesEmail &&
      matchesPhone &&
      matchesSource &&
      matchesQualification &&
      matchesScoreRange &&
      matchesValueRange &&
      matchesCreatedRange
    );
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/10 text-blue-500',
      contacted: 'bg-purple-500/10 text-purple-500',
      qualified: 'bg-teal-500/10 text-teal-500',
      proposal: 'bg-yellow-500/10 text-yellow-500',
      negotiation: 'bg-orange-500/10 text-orange-500',
      won: 'bg-green-500/10 text-green-500',
      lost: 'bg-red-500/10 text-red-500',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500';
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(Array.from(next));
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLeads.map(l => l.id));
    }
  };

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
    if (!window.confirm(t('leads.messages.deleteConfirmSingle', 'Delete this lead?'))) return;
    
    try {
      const { error } = await scopedDb.from('leads').delete().eq('id', id);
      if (error) throw error;
      
      toast.success(t('leads.messages.deleteSuccessSingle', 'Lead deleted'));
      if (selectedIds.has(id)) toggleSelection(id);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error(t('leads.messages.deleteError'));
    }
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('leads.messages.loading')}</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-10 w-10" />}
            title={t('leads.messages.noLeads')}
            description={searchQuery ? t('leads.messages.noLeadsDescSearch') : t('leads.messages.noLeadsDescNew')}
            actionLabel={!searchQuery ? t('leads.actions.addLead') : undefined}
            onAction={!searchQuery ? () => navigate('/dashboard/leads/new') : undefined}
          />
        ) : viewMode === 'list' ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>{t('leads.allLeads')}</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>{t('leads.columns.name')}</TableHead>
                  <TableHead>{t('leads.columns.company')}</TableHead>
                  <TableHead>{t('leads.columns.email')}</TableHead>
                  <TableHead>{t('leads.columns.phone')}</TableHead>
                  <TableHead>{t('leads.columns.status')}</TableHead>
                  <TableHead>{t('leads.columns.source')}</TableHead>
                  <TableHead>{t('leads.columns.score')}</TableHead>
                  <TableHead>{t('leads.columns.value')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleSelection(lead.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {lead.first_name} {lead.last_name}
                    </TableCell>
                    <TableCell>{lead.company || '-'}</TableCell>
                    <TableCell>{lead.email || '-'}</TableCell>
                    <TableCell>{lead.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{lead.source}</Badge>
                    </TableCell>
                    <TableCell>
                      {lead.lead_score !== null ? (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          {lead.lead_score}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.estimated_value ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <DollarSign className="h-4 w-4" />
                          ${lead.estimated_value.toLocaleString()}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {filteredLeads.map((lead) => (
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
            {filteredLeads.map((lead) => (
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
