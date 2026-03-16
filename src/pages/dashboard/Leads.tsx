import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, UserPlus, Filter, TrendingUp, Users as UsersIcon, Trash2, MoreHorizontal, ArrowUpDown, SlidersHorizontal, X } from 'lucide-react';
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
  const setSorting = (field: string, direction: 'asc' | 'desc') => setWorkspace({ sortField: field, sortDirection: direction });
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
      page: 1,
    });
  };

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

      if (nameQuery.trim()) {
        if (nameOp === 'equals') {
          query = query.or(`first_name.eq.${nameQuery.trim()},last_name.eq.${nameQuery.trim()}`);
        } else {
          query = query.or(`first_name.ilike.%${nameQuery.trim()}%,last_name.ilike.%${nameQuery.trim()}%`);
        }
      }

      if (scoreFilter === 'high') {
        query = query.gte('lead_score', 70);
      } else if (scoreFilter === 'medium') {
        query = query.gte('lead_score', 40).lte('lead_score', 69);
      } else if (scoreFilter === 'low') {
        query = query.lte('lead_score', 39);
      }

      if (scoreMin) {
        query = query.gte('lead_score', Number(scoreMin));
      }
      if (scoreMax) {
        query = query.lte('lead_score', Number(scoreMax));
      }
      if (valueMin) {
        query = query.gte('estimated_value', Number(valueMin));
      }
      if (valueMax) {
        query = query.lte('estimated_value', Number(valueMax));
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
    context?.userId,
    t,
  ]);

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

  const allVisibleSelected = leads.length > 0 && leads.every((lead) => selectedIds.has(lead.id));
  const partiallyVisibleSelected = leads.some((lead) => selectedIds.has(lead.id)) && !allVisibleSelected;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;
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
        label: `${t('leads.filters.status', 'Status')}: ${statusLabels[statusFilter as keyof typeof statusLabels] || statusFilter}`,
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
                <SelectValue placeholder={t('leads.filters.status', 'Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('leads.filters.allStatuses', 'All Statuses')}</SelectItem>
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
                {selectedIds.size} of {leads.length} row(s) selected.
              </div>
              <div className="space-x-2">
                <Button variant="outline" size="sm" disabled={!canGoPrevious} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={!canGoNext} onClick={() => setPage(page + 1)}>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
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
