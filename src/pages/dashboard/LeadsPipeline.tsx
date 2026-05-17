import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { KanbanBoard, ColumnType } from '@/components/kanban/KanbanBoard';
import { KanbanItem } from '@/components/kanban/KanbanCard';
import { KanbanFunnel } from '@/components/kanban/KanbanFunnel';
import { KanbanFilters } from '@/components/kanban/KanbanFilters';
import { PipelineAnalytics } from '@/components/analytics/PipelineAnalytics';
import { toast } from 'sonner';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Lead, LeadStatus, stages, statusConfig } from './leads-data';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { themeStyleFromPreset } from '@/lib/theme-utils';
import { DashboardOverview, ContactsSection, TasksSection, DashboardStats, CreateTaskDialog } from '@/components/crm/LeadsPipelineComponents';
import { Task } from '@/components/crm/TaskScheduler';
import { useLeadsViewState, LeadsPrimaryView } from '@/hooks/useLeadsViewState';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/react';
import { Skeleton } from '@/components/ui/skeleton';
import { PipelineService } from '@/services/pipeline-service';
import type { CrmApiFallbackTelemetry, LeadApiFallbackReason } from '@/services/pipeline-service';
import { CRM_HEADER_PRIMARY_CONTROL_SEQUENCE, CRMModuleHeaderNavigation } from '@/components/crm/CRMModuleHeaderNavigation';
import { resolveLeadsFallbackBannerCopy } from './leadsListUtils';

const stageBarColor: Record<LeadStatus, string> = {
  new: 'bg-red-500/80',
  contacted: 'bg-red-500/80',
  qualified: 'bg-red-500/80',
  proposal: 'bg-red-500/80',
  negotiation: 'bg-red-500/80',
  won: 'bg-red-500/80',
  lost: 'bg-red-500/80',
  converted: 'bg-red-500/80',
};

export function parseSelectedPipelineStages(statusParam: string | null): LeadStatus[] {
  if (!statusParam) return [];
  return statusParam
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is LeadStatus => stages.includes(entry as LeadStatus));
}

export function getVisiblePipelineStages(selected: LeadStatus[]): LeadStatus[] {
  if (selected.length === 0) return stages;
  return stages.filter((stage) => selected.includes(stage));
}

// Loading skeleton for the pipeline
function PipelineSkeleton() {
  return (
    <div className="flex h-full gap-3 pb-4 overflow-x-auto">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="w-[300px] flex-shrink-0 flex flex-col gap-2">
          <div className="rounded-md border border-[#e4e8f0] bg-white p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <Skeleton className="h-4 w-16 rounded-sm" />
              <Skeleton className="h-4 w-6 rounded-sm" />
            </div>
            <div className="h-0.5 w-full rounded-full bg-red-500/80" />
          </div>
          <div className="rounded-md border border-[#edf1f7] bg-white p-1.5">
            <div className="flex-1 space-y-2">
            {[1, 2, 3].map((j) => (
                <div key={j} className="relative pl-4">
                  <span className="absolute left-1.5 top-0 h-full w-[3px] rounded-full bg-[#e5e7eb]" />
                  <Skeleton className="h-28 w-full rounded-md border border-[#e7ebf2]" />
                </div>
            ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeadsPipeline() {
  usePerformanceMonitor('Leads Pipeline');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { supabase, context, scopedDb } = useCRM();
  const { state: viewState, setTheme, setView, setPipeline, setWorkspace } = useLeadsViewState();
  const currentTheme = viewState.theme;
  const isNavigatingAwayFromPipeline = useRef(false);
  const hasRestoredPipelineFiltersRef = useRef(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDbFallbackActive, setIsDbFallbackActive] = useState(false);
  const [dbFallbackReason, setDbFallbackReason] = useState<LeadApiFallbackReason | null>(null);
  const [dbFallbackTelemetry, setDbFallbackTelemetry] = useState<CrmApiFallbackTelemetry | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);

  // URL State - memoized to prevent recalculation
  const searchQuery = searchParams.get('q') || '';
  const selectedStages = useMemo(
    () => parseSelectedPipelineStages(searchParams.get('status')),
    [searchParams]
  );
  const selectedSources = useMemo(() => {
    const value = searchParams.get('source');
    if (!value) return [];
    return value.split(',').map((entry) => decodeURIComponent(entry)).filter(Boolean);
  }, [searchParams]);
  const selectedCustomFieldTokens = useMemo(() => {
    const value = searchParams.get('custom');
    if (!value) return [];
    return value.split(',').map((entry) => decodeURIComponent(entry)).filter(Boolean);
  }, [searchParams]);
  const fromDate = searchParams.get('from') || '';
  const toDate = searchParams.get('to') || '';
  const currentView = searchParams.get('view') || 'board';
  const selectedCustomFieldPairs = useMemo(() => {
    return selectedCustomFieldTokens
      .map((token) => {
        const separatorIndex = token.indexOf('::');
        if (separatorIndex <= 0) return null;
        const key = token.slice(0, separatorIndex).trim();
        const value = token.slice(separatorIndex + 2).trim();
        if (!key || !value) return null;
        return { key, value };
      })
      .filter((item): item is { key: string; value: string } => Boolean(item));
  }, [selectedCustomFieldTokens]);

  // Stable context check
  const isContextReady = Boolean(context?.tenantId || context?.isPlatformAdmin);

  // Load theme default - only once after hydration
  useEffect(() => {
    if (!viewState.hydrated || !context?.userId) return;
    if (viewState.hydrationSource !== 'default') return;
    
    const loadThemeDefault = async () => {
      try {
        const userThemeKey = `user:${context.userId}:leads.default_theme`;
        const { data: themeData } = await scopedDb.getSystemSetting(userThemeKey);
        const defaultTheme = themeData?.setting_value;
        
        if (defaultTheme && typeof defaultTheme === 'string' && defaultTheme !== viewState.theme) {
          setTheme(defaultTheme);
        }
      } catch {
        return;
      }
    };
    loadThemeDefault();
  }, [context?.userId, viewState.hydrated, viewState.hydrationSource]);

  const handleThemeChange = useCallback((val: string) => {
    setTheme(val);
    try {
      localStorage.setItem('leadsTheme', val);
    } catch {
      return;
    }
  }, [setTheme]);

  // Set view state only once on mount
  useEffect(() => {
    if (!viewState.hydrated) return;
    if (isNavigatingAwayFromPipeline.current) return;
    if (viewState.view !== 'pipeline') setView('pipeline');
  }, [viewState.hydrated]);

  // Sync URL to view state - debounced
  useEffect(() => {
    if (!viewState.hydrated) return;
    const tab = currentView === 'analytics' ? 'analytics' : 'board';
    setPipeline({ q: searchQuery, status: selectedStages, tab });
  }, [currentView, searchQuery, selectedStages.join(','), viewState.hydrated]);

  useEffect(() => {
    if (!viewState.hydrated) return;
    if (hasRestoredPipelineFiltersRef.current) return;
    if (
      searchQuery ||
      selectedStages.length > 0 ||
      selectedSources.length > 0 ||
      selectedCustomFieldTokens.length > 0 ||
      fromDate ||
      toDate
    ) {
      hasRestoredPipelineFiltersRef.current = true;
      return;
    }
    const persistedQuery = viewState.pipeline.q?.trim() || '';
    const persistedStatuses = (viewState.pipeline.status || []).filter((entry) => stages.includes(entry as LeadStatus));
    if (!persistedQuery && persistedStatuses.length === 0) {
      hasRestoredPipelineFiltersRef.current = true;
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!next.get('q') && persistedQuery) next.set('q', persistedQuery);
      if (!next.get('status') && persistedStatuses.length > 0) next.set('status', persistedStatuses.join(','));
      if (!next.get('view') && viewState.pipeline.tab) next.set('view', viewState.pipeline.tab);
      return next;
    }, { replace: true });
    hasRestoredPipelineFiltersRef.current = true;
  }, [
    viewState.hydrated,
    viewState.pipeline.q,
    viewState.pipeline.status.join(','),
    viewState.pipeline.tab,
    searchQuery,
    selectedStages.length,
    selectedSources.length,
    selectedCustomFieldTokens.length,
    fromDate,
    toDate,
    setSearchParams
  ]);

  const handleSearchChange = useCallback((val: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (val) newParams.set('q', val);
      else newParams.delete('q');
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  const handleViewChange = useCallback((view: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('view', view);
      return newParams;
    });
  }, [setSearchParams]);

  const handleStageFilterChange = useCallback((values: string[]) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (values.length > 0) newParams.set('status', values.join(','));
      else newParams.delete('status');
      return newParams;
    });
  }, [setSearchParams]);

  const handleSourceFilterChange = useCallback((values: string[]) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (values.length > 0) {
        newParams.set('source', values.map((value) => encodeURIComponent(value)).join(','));
      } else {
        newParams.delete('source');
      }
      return newParams;
    });
  }, [setSearchParams]);

  const handleCustomFieldFilterChange = useCallback((values: string[]) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (values.length > 0) {
        newParams.set('custom', values.map((value) => encodeURIComponent(value)).join(','));
      } else {
        newParams.delete('custom');
      }
      return newParams;
    });
  }, [setSearchParams]);

  const handleDateFilterChange = useCallback((key: 'from' | 'to', value: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  const handleResetFilters = useCallback(() => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('q');
      newParams.delete('status');
      newParams.delete('source');
      newParams.delete('custom');
      newParams.delete('from');
      newParams.delete('to');
      newParams.delete('franchise');
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  const currencySymbol = t('leads.pipeline.currencySymbol', ' €');
  const resolveCrmApiContext = useCallback(async () => {
    let { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) {
      const { data: refreshedSession } = await supabase.auth.refreshSession();
      sessionData = refreshedSession;
    }
    return {
      accessToken: sessionData?.session?.access_token || null,
      tenantId: context?.tenantId || null,
      franchiseId: context?.franchiseId || null,
      userId: context?.userId || null,
    };
  }, [context?.franchiseId, context?.tenantId, context?.userId, supabase.auth]);

  // Stable fetch function - no dependencies on filter state
  const fetchLeads = useCallback(async () => {
    if (!isContextReady) return;
    
    setLoading(true);
    try {
      const crmApiContext = await resolveCrmApiContext();
      const shouldUseCrmApi = Boolean(
        crmApiContext.accessToken &&
        crmApiContext.tenantId
      );
      const { data, source, fallbackReason, fallbackTelemetry } = await PipelineService.listLeads(scopedDb, {
        page: 1,
        pageSize: 2000,
        search: searchQuery || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        statuses: selectedStages,
        sources: selectedSources,
        customFieldFilters: selectedCustomFieldPairs,
      }, shouldUseCrmApi ? crmApiContext : undefined);
      const showFallback = shouldUseCrmApi && source === 'scopedDb';
      setIsDbFallbackActive(showFallback);
      setDbFallbackReason(showFallback ? fallbackReason : null);
      setDbFallbackTelemetry(showFallback ? fallbackTelemetry : null);
      
      const incomingLeads = (data as any[]) || [];
      const invalidStatusCounts = incomingLeads.reduce<Record<string, number>>((acc, lead) => {
        const status = String(lead?.status ?? '');
        if (!stages.includes(status as LeadStatus)) {
          acc[status || '(empty)'] = (acc[status || '(empty)'] || 0) + 1;
        }
        return acc;
      }, {});

      if (Object.keys(invalidStatusCounts).length > 0) {
        logger.warn('Invalid lead statuses detected in pipeline payload; remapping to new', {
          invalidStatusCounts,
          tenantId: context?.tenantId ?? null,
          franchiseId: context?.franchiseId ?? null,
          isPlatformAdmin: context?.isPlatformAdmin ?? false,
        });
      }

      const safeLeads = incomingLeads.map(d => ({
        ...d,
        status: stages.includes(d.status as LeadStatus) ? (d.status as LeadStatus) : 'new'
      })) as Lead[];

      setLeads(safeLeads);
    } catch (error) {
      setIsDbFallbackActive(false);
      setDbFallbackReason(null);
      setDbFallbackTelemetry(null);
      logger.error('Failed to fetch leads (pipeline)', {
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [
    scopedDb,
    isContextReady,
    context?.tenantId,
    context?.franchiseId,
    context?.isPlatformAdmin,
    searchQuery,
    fromDate,
    toDate,
    selectedStages.join(','),
    selectedSources.join(','),
    selectedCustomFieldTokens.join(','),
    resolveCrmApiContext,
  ]);

  const fallbackBannerText = useMemo(() => {
    const copy = resolveLeadsFallbackBannerCopy(dbFallbackReason);
    return t(copy.key);
  }, [dbFallbackReason, t]);
  const shouldShowFallbackBanner = isDbFallbackActive
    && dbFallbackReason !== 'api_5xx'
    && dbFallbackReason !== 'api_unreachable';

  useEffect(() => {
    if (!isDbFallbackActive) return;
    logger.warn('CRM API fallback activated for leads pipeline', {
      fallbackReason: dbFallbackReason,
      fallbackTelemetry: dbFallbackTelemetry,
      tenantId: context?.tenantId ?? null,
      franchiseId: context?.franchiseId ?? null,
      isPlatformAdmin: context?.isPlatformAdmin ?? false,
    });
  }, [
    isDbFallbackActive,
    dbFallbackReason,
    dbFallbackTelemetry,
    context?.tenantId,
    context?.franchiseId,
    context?.isPlatformAdmin,
  ]);

  const fetchTasks = useCallback(async () => {
    if (!isContextReady) return;
    try {
      const { data, error } = await (scopedDb.from('activities') as any)
        .select('*')
        .eq('activity_type', 'task')
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      
      const mappedTasks: Task[] = (data || []).map((d: any) => ({
        id: d.id,
        title: d.title || d.subject || 'Untitled Task',
        due_date: d.due_date,
        status: d.status === 'completed' ? 'completed' : 'pending',
        priority: d.priority || 'medium',
        assigned_to: { name: 'User' },
        related_to: d.related_to ? { type: 'lead', id: d.related_to, name: 'Lead' } : undefined
      }));
      setTasks(mappedTasks);
    } catch (e) {
      logger.error('Error fetching tasks', e);
    }
  }, [scopedDb, isContextReady]);

  // Fetch whenever scope changes (tenant / franchise / override)
  useEffect(() => {
    if (!isContextReady) return;
    fetchLeads();
    fetchTasks();
  }, [isContextReady, scopedDb, fetchLeads, fetchTasks]);

  // Real-time subscription - separate from fetch
  useEffect(() => {
    if (!isContextReady) return;

    const matchesScope = (row: any) => {
      if (!row) return false;
      // Platform Admin in Global mode sees everything
      if (context.isPlatformAdmin && !context.adminOverrideEnabled) return true;
      // Scoped views must match the effective tenant/franchise
      if (context.tenantId && row.tenant_id !== context.tenantId) return false;
      if (context.franchiseId && row.franchise_id !== context.franchiseId) return false;
      return true;
    };

    const channel = supabase
      .channel('leads-pipeline-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (!matchesScope(payload.new)) return;
            const newLead = payload.new as Lead;
            const safeLead: Lead = {
              ...newLead,
              status: stages.includes(newLead.status) ? newLead.status : 'new'
            };
            setLeads((prev) => [safeLead, ...prev]);
            toast.info(`New lead: ${newLead.first_name} ${newLead.last_name}`);
          } 
          else if (payload.eventType === 'UPDATE') {
            if (!matchesScope(payload.new)) return;
            const updatedLead = payload.new as Lead;
            const safeLead: Lead = {
              ...updatedLead,
              status: stages.includes(updatedLead.status) ? updatedLead.status : 'new'
            };
            setLeads((prev) => prev.map((l) => 
              l.id === safeLead.id ? safeLead : l
            ));
          } 
          else if (payload.eventType === 'DELETE') {
            if (!matchesScope(payload.old)) return;
            setLeads((prev) => prev.filter((l) => l.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    supabase,
    isContextReady,
    context.isPlatformAdmin,
    context.adminOverrideEnabled,
    context.tenantId,
    context.franchiseId,
  ]);

  const handleTaskComplete = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !isContextReady) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      const { error } = await (scopedDb.from('activities') as any)
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;
      toast.success(`Task marked as ${newStatus}`);
    } catch (error) {
      logger.error('Failed to update task', error);
      toast.error('Failed to update task status');
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
    }
  }, [tasks, supabase, context, isContextReady]);

  const handleAddTask = useCallback(() => {
    setIsCreateTaskOpen(true);
  }, []);

  const handleSaveTask = useCallback(async (taskData: { title: string; due_date: string; priority: 'low' | 'medium' | 'high' }) => {
    if (!isContextReady) return;
    setIsSavingTask(true);
    try {
      const { data, error } = await (scopedDb.from('activities') as any).insert({
        subject: taskData.title,
        due_date: taskData.due_date,
        priority: taskData.priority,
        activity_type: 'task',
        status: 'pending',
        tenant_id: context?.tenantId
      })
        .select()
        .single();

      if (error) throw error;

      const newTask: Task = {
        id: (data as any).id,
        title: (data as any).subject,
        due_date: (data as any).due_date,
        status: 'pending',
        priority: (data as any).priority,
        assigned_to: { name: 'User' }
      };

      setTasks(prev => [...prev, newTask]);
      toast.success('Task created successfully');
      setIsCreateTaskOpen(false);
    } catch (error) {
      logger.error('Failed to create task', error);
      toast.error('Failed to create task');
    } finally {
      setIsSavingTask(false);
    }
  }, [supabase, context, isContextReady]);

  // Memoized stats
  const stats: DashboardStats = useMemo(() => ({
    totalLeads: leads.length,
    wonDeals: leads.filter(l => l.status === 'won').length,
    contacted: leads.filter(l => ['contacted', 'qualified', 'proposal'].includes(l.status)).length,
    highScore: Math.max(...leads.map(l => l.lead_score || 0), 0)
  }), [leads]);

  const handleStatusChange = useCallback(async (leadId: string, newStatus: LeadStatus) => {
    const previousLead = leads.find((l) => l.id === leadId);
    if (!previousLead) return;

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

    if (!isContextReady) return;

    try {
      const crmApiContext = await resolveCrmApiContext();
      const result = await PipelineService.transitionLeadStage(scopedDb, {
        id: leadId,
        toStatus: newStatus,
        expectedUpdatedAt: previousLead.updated_at,
      }, crmApiContext);

      if (result.ok === false) {
        if (result.code === 'conflict') {
          if (result.current) {
            setLeads((prev) => prev.map((l) => (l.id === leadId ? result.current! : l)));
          } else {
            fetchLeads();
          }
          toast.error('Lead was updated by another user. Board has been refreshed.');
          return;
        }

        throw new Error(result.message);
      }

      setLeads((prev) => prev.map((l) => (l.id === leadId ? result.data : l)));
      toast.success(`Lead moved to ${statusConfig[newStatus].label}`);
    } catch (error) {
      logger.error('Error updating status:', error);
      toast.error('Failed to update status');
      fetchLeads();
    }
  }, [leads, isContextReady, scopedDb, fetchLeads, resolveCrmApiContext]);

  const handleItemUpdate = useCallback(async (id: string, updates: Partial<KanbanItem>) => {
    const previousLead = leads.find((lead) => lead.id === id);
    if (!previousLead) return;

    const leadUpdates: Partial<Lead> = {};
    
    if (updates.title) {
      const parts = updates.title.split(' ');
      if (parts.length > 0) {
        leadUpdates.first_name = parts[0];
        leadUpdates.last_name = parts.slice(1).join(' ') || '';
      }
    }

    if (updates.value !== undefined) {
      leadUpdates.estimated_value = updates.value;
    }

    const optimisticLead = { ...previousLead, ...leadUpdates };
    setLeads(prev => prev.map(l => l.id === id ? optimisticLead : l));

    if (!isContextReady) return;

    try {
      const crmApiContext = await resolveCrmApiContext();
      const result = await PipelineService.updateLead(scopedDb, {
        id,
        input: {
          first_name: optimisticLead.first_name,
          last_name: optimisticLead.last_name,
          company: optimisticLead.company,
          title: optimisticLead.title,
          email: optimisticLead.email,
          phone: optimisticLead.phone,
          status: optimisticLead.status,
          source: optimisticLead.source,
          estimated_value: optimisticLead.estimated_value,
          expected_close_date: optimisticLead.expected_close_date,
          description: optimisticLead.description,
          notes: optimisticLead.notes,
          tenant_id: optimisticLead.tenant_id,
          franchise_id: optimisticLead.franchise_id,
          custom_fields: optimisticLead.custom_fields,
        },
        expectedUpdatedAt: previousLead.updated_at,
      }, crmApiContext);

      if (result.ok === false) {
        if (result.code === 'conflict') {
          if (result.current) {
            setLeads((prev) => prev.map((lead) => (lead.id === id ? result.current! : lead)));
          } else {
            fetchLeads();
          }
          toast.error('Lead was updated by another user. Board has been refreshed.');
          return;
        }

        if (result.code === 'duplicate') {
          setLeads((prev) => prev.map((lead) => (lead.id === id ? previousLead : lead)));
          toast.error(result.message);
          return;
        }

        throw new Error(result.message);
      }

      setLeads((prev) => prev.map((lead) => (lead.id === id ? result.data : lead)));
      toast.success("Lead updated");
    } catch (error) {
      logger.error('Error updating lead:', error);
      toast.error('Failed to update lead');
      fetchLeads();
    }
  }, [leads, isContextReady, scopedDb, fetchLeads, resolveCrmApiContext]);

  const onDragEnd = useCallback((activeId: string, overId: string, newStatus: string) => {
    if (stages.includes(newStatus as LeadStatus)) {
      handleStatusChange(activeId, newStatus as LeadStatus);
    }
  }, [handleStatusChange]);

  const handleDeleteLead = useCallback(async (id: string) => {
    const targetLead = leads.find((lead) => lead.id === id);
    if (!targetLead) return;
    const confirmed = window.confirm(t('leads.messages.deleteSingleConfirm', 'Delete this lead?'));
    if (!confirmed) return;
    const previousLeads = leads;
    setLeads((prev) => prev.filter((lead) => lead.id !== id));
    if (!isContextReady) return;
    try {
      const crmApiContext = await resolveCrmApiContext();
      await PipelineService.deleteLead(scopedDb, id, crmApiContext);
      toast.success(t('leads.messages.deleteSingleSuccess', 'Lead deleted'));
    } catch (error) {
      logger.error('Error deleting lead:', error);
      setLeads(previousLeads);
      toast.error(t('leads.messages.deleteError', 'Failed to delete lead'));
    }
  }, [leads, isContextReady, resolveCrmApiContext, scopedDb, t]);

  const handleDeleteColumnLeads = useCallback(async (columnId: string, itemIds: string[]) => {
    if (itemIds.length === 0) return;
    const columnLabel = statusConfig[columnId as LeadStatus]?.label || columnId;
    const confirmed = window.confirm(
      t('leads.messages.deleteColumnConfirm', {
        count: itemIds.length,
        column: columnLabel,
        defaultValue: `Delete ${itemIds.length} leads from ${columnLabel}?`,
      })
    );
    if (!confirmed) return;
    const previousLeads = leads;
    setLeads((prev) => prev.filter((lead) => !itemIds.includes(lead.id)));
    if (!isContextReady) return;
    try {
      const crmApiContext = await resolveCrmApiContext();
      const deletedCount = await PipelineService.deleteLeads(scopedDb, itemIds, crmApiContext);
      toast.success(
        t('leads.messages.deleteSuccess', {
          count: deletedCount,
          defaultValue: `${deletedCount} leads deleted`,
        })
      );
    } catch (error) {
      logger.error('Error deleting leads:', error);
      setLeads(previousLeads);
      toast.error(t('leads.messages.deleteError', 'Failed to delete lead'));
    }
  }, [isContextReady, leads, resolveCrmApiContext, scopedDb, t]);

  // Filter logic - memoized
  const filteredLeads = useMemo(() => {
    const parseBoundary = (value: string, boundary: 'start' | 'end') => {
      if (!value) return null;
      const parsed = new Date(`${value}${boundary === 'start' ? 'T00:00:00.000' : 'T23:59:59.999'}`);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed;
    };
    const fromBoundary = parseBoundary(fromDate, 'start');
    const toBoundary = parseBoundary(toDate, 'end');
    return leads.filter(lead => {
      const matchesSearch = 
        searchQuery === '' || 
        `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.email || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStage = selectedStages.length === 0 || selectedStages.includes(lead.status);
      const matchesSource = selectedSources.length === 0 || selectedSources.includes(lead.source);
      const createdAt = new Date(lead.created_at);
      const matchesFromDate = !fromBoundary || createdAt >= fromBoundary;
      const matchesToDate = !toBoundary || createdAt <= toBoundary;
      const customFieldEntries = lead.custom_fields && typeof lead.custom_fields === 'object'
        ? lead.custom_fields
        : {};
      const matchesCustomFields = selectedCustomFieldPairs.length === 0 || selectedCustomFieldPairs.every(({ key, value }) => {
        const rawValue = (customFieldEntries as Record<string, unknown>)[key];
        if (Array.isArray(rawValue)) {
          return rawValue.some((item) => String(item).toLowerCase() === value.toLowerCase());
        }
        if (rawValue === null || rawValue === undefined) return false;
        return String(rawValue).toLowerCase() === value.toLowerCase();
      });

      return matchesSearch && matchesStage && matchesSource && matchesFromDate && matchesToDate && matchesCustomFields;
    });
  }, [leads, searchQuery, selectedStages, selectedSources, fromDate, toDate, selectedCustomFieldPairs]);

  // Funnel Data - memoized
  const funnelData = useMemo(() => {
    const labelMap: Record<LeadStatus, string> = Object.fromEntries(
      stages.map((s) => [s, statusConfig[s].label])
    ) as Record<LeadStatus, string>;
    
    const colorMap: Record<LeadStatus, string> = Object.fromEntries(
      stages.map((s) => [s, statusConfig[s].color])
    ) as Record<LeadStatus, string>;
    
    const counts = stages.reduce((acc, stage) => {
      acc[stage] = leads.filter(l => l.status === stage).length;
      return acc;
    }, {} as Record<LeadStatus, number>);

    return { labelMap, colorMap, counts };
  }, [leads]);

  const visibleStages = useMemo(
    () => getVisiblePipelineStages(selectedStages),
    [selectedStages.join(',')]
  );

  // Kanban columns - memoized
  const columns: ColumnType[] = useMemo(() => {
    return visibleStages.map(stage => ({
      id: stage,
      title: statusConfig[stage].label,
      color: 'bg-red-500',
    }));
  }, [visibleStages.join(',')]);

  // Kanban items - memoized
  const items: KanbanItem[] = useMemo(() => {
    return filteredLeads.map(lead => ({
      id: lead.id,
      title: `${lead.first_name} ${lead.last_name}`,
      subtitle: lead.company || undefined,
      status: lead.status,
      priority: (lead.lead_score || 0) >= 70 ? 'high' : (lead.lead_score || 0) < 30 ? 'low' : 'medium',
      probability: Math.min(100, Math.max(0, lead.lead_score || 0)),
      value: lead.estimated_value || undefined,
      currency: currencySymbol,
      updatedAt: lead.created_at,
      assignee: lead.owner_id ? { name: "User" } : undefined,
      tags: [lead.email].filter(Boolean) as string[],
    }));
  }, [filteredLeads, currencySymbol]);

  const sourceFilterOptions = useMemo(() => {
    const uniqueSources = Array.from(
      new Set(
        leads
          .map((lead) => (lead.source || '').trim())
          .filter((source) => source.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    return uniqueSources.map((source) => ({
      label: source,
      value: source,
    }));
  }, [leads]);

  const customFieldFilterOptions = useMemo(() => {
    const optionMap = new Map<string, { label: string; value: string }>();

    leads.forEach((lead) => {
      const customFields = lead.custom_fields;
      if (!customFields || typeof customFields !== 'object') return;
      Object.entries(customFields).forEach(([key, rawValue]) => {
        if (Array.isArray(rawValue)) {
          rawValue.forEach((item) => {
            if (item === null || item === undefined || typeof item === 'object') return;
            const normalizedValue = String(item).trim();
            if (!normalizedValue) return;
            const token = `${key}::${normalizedValue}`;
            if (!optionMap.has(token)) {
              optionMap.set(token, { label: `${key}: ${normalizedValue}`, value: token });
            }
          });
          return;
        }
        if (rawValue === null || rawValue === undefined || typeof rawValue === 'object') return;
        const normalizedValue = String(rawValue).trim();
        if (!normalizedValue) return;
        const token = `${key}::${normalizedValue}`;
        if (!optionMap.has(token)) {
          optionMap.set(token, { label: `${key}: ${normalizedValue}`, value: token });
        }
      });
    });

    return Array.from(optionMap.values()).sort((a, b) => a.label.localeCompare(b.label)).slice(0, 50);
  }, [leads]);

  const handleNavigateAway = useCallback((mode: Exclude<LeadsPrimaryView, 'pipeline'>) => {
    isNavigatingAwayFromPipeline.current = true;
    try {
      localStorage.setItem('leadsViewMode', mode);
    } catch {
      void 0;
    }
    setView(mode as any);
    setWorkspace({
      searchQuery,
      statusFilter: selectedStages.length === 1 ? selectedStages[0] : 'all',
    });
    navigate('/dashboard/leads');
  }, [navigate, searchQuery, selectedStages, setView, setWorkspace]);

  // Show skeleton while waiting for context or initial load
  if (!isContextReady || !initialLoadComplete) {
    return (
      <DashboardLayout>
        <div className="flex flex-col h-[calc(100vh-140px)] gap-6 p-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
          <Skeleton className="h-16 w-full" />
          <PipelineSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={themeStyleFromPreset(currentTheme)} className="flex flex-col h-[calc(100vh-140px)] gap-6 transition-colors duration-300">
        
        {/* Header */}
        <div className="flex-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('leads.title', 'Leads Workspace')}</h1>
            </div>
            <CRMModuleHeaderNavigation
              moduleLabel="Leads"
              viewMode="pipeline"
              theme={currentTheme}
              onViewModeChange={(mode) => handleNavigateAway(mode as Exclude<LeadsPrimaryView, 'pipeline'>)}
              analyticsLabel={t('leads.tabs.analytics', 'Analytics')}
              analyticsActive={currentView === 'analytics'}
              onAnalyticsClick={() => handleViewChange('analytics')}
              controlSequence={CRM_HEADER_PRIMARY_CONTROL_SEQUENCE}
              onThemeChange={handleThemeChange}
              onCreate={() => navigate('/dashboard/leads/new')}
              createLabel="New Lead"
              iconOnly
              onRefresh={fetchLeads}
              onImportExport={() => {
                const params = new URLSearchParams();
                if (searchQuery) params.set('q', searchQuery);
                if (selectedStages.length > 0) params.set('status', selectedStages.join(','));
                if (selectedSources.length > 0) params.set('source', selectedSources.map((value) => encodeURIComponent(value)).join(','));
                if (selectedCustomFieldTokens.length > 0) params.set('custom', selectedCustomFieldTokens.map((value) => encodeURIComponent(value)).join(','));
                if (fromDate) params.set('from', fromDate);
                if (toDate) params.set('to', toDate);
                params.set('origin', 'pipeline');
                navigate(`/dashboard/leads/import-export?${params.toString()}`);
              }}
            />
          </div>

        </div>

        <div className="flex-1 px-1 min-h-0">
          <Tabs value={currentView} onValueChange={handleViewChange} className="w-full h-full">
            {/* Analytics Content */}
            <TabsContent value="analytics" className="mt-0">
              <PipelineAnalytics leads={filteredLeads} />
            </TabsContent>

            {/* Board Content */}
            <TabsContent value="board" className="mt-0 flex flex-col gap-6 h-full">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                <div className="lg:col-span-3 flex flex-col gap-4 h-full min-h-0">
                  {shouldShowFallbackBanner && (
                    <div
                      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      data-fallback-reason={dbFallbackReason ?? ''}
                      data-fallback-http-status={dbFallbackTelemetry?.httpStatus ?? ''}
                      data-fallback-backend-code={dbFallbackTelemetry?.backendCode ?? ''}
                    >
                      {fallbackBannerText}
                    </div>
                  )}
                  {/* Filters */}
                  <div className="flex-none">
                    <Card className="rounded-md border-muted">
                      <CardContent className="p-2">
                        <KanbanFilters
                          searchQuery={searchQuery}
                          onSearchChange={handleSearchChange}
                          leadingContent={(
                            <>
                              <Input
                                type="date"
                                className="h-9 w-[170px]"
                                value={fromDate}
                                onChange={(event) => handleDateFilterChange('from', event.target.value)}
                                aria-label={t('leads.filters.fromDate', 'Start date')}
                                title={t('leads.filters.fromDateFormat', 'Start date (dd/mm/yyyy)')}
                              />
                              <Input
                                type="date"
                                className="h-9 w-[170px]"
                                value={toDate}
                                onChange={(event) => handleDateFilterChange('to', event.target.value)}
                                aria-label={t('leads.filters.toDate', 'End date')}
                                title={t('leads.filters.toDateFormat', 'End date (dd/mm/yyyy)')}
                              />
                            </>
                          )}
                          filters={{
                            status: selectedStages,
                            source: selectedSources,
                            custom: selectedCustomFieldTokens,
                          }}
                          onFilterChange={(key, values) => {
                            if (key === 'status') handleStageFilterChange(values);
                            if (key === 'source') handleSourceFilterChange(values);
                            if (key === 'custom') handleCustomFieldFilterChange(values);
                          }}
                          onReset={handleResetFilters}
                          availableFilters={[
                            {
                              id: 'status',
                              label: t('leads.filters.status', 'Status'),
                              options: stages.map(s => ({
                                label: t(`leads.filters.statusOptions.${s}`, statusConfig[s].label),
                                value: s,
                              }))
                            },
                            {
                              id: 'source',
                              label: t('leads.filters.source', 'Source'),
                              options: sourceFilterOptions,
                            },
                            {
                              id: 'custom',
                              label: t('leads.filters.customFields', 'Custom Fields'),
                              options: customFieldFilterOptions,
                            }
                          ]}
                        />
                        {selectedStages.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 px-2 pb-1">
                            <span className="text-xs text-muted-foreground">
                              {t('leads.filters.visibleStatuses', 'Visible statuses')}
                            </span>
                            {selectedStages.map((stage) => (
                              <Badge
                                key={`visible-stage-${stage}`}
                                variant="default"
                                className="text-[10px] tracking-wide uppercase"
                              >
                                {statusConfig[stage].label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Kanban Board */}
                  <div className="flex-1 min-h-[420px] max-h-[calc(100vh-260px)] overflow-hidden bg-white rounded-lg border border-[#e5eaf2] p-2">
                    {loading && items.length === 0 ? (
                      <PipelineSkeleton />
                    ) : columns.length === 0 ? (
                      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
                        {t('leads.pipeline.noStatusesVisible', 'No status columns selected')}
                      </div>
                    ) : items.length === 0 ? (
                      <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
                        {t('leads.pipeline.noMatchingLeads', 'No leads match the current filters')}
                      </div>
                    ) : (
                      <KanbanBoard 
                        columns={columns} 
                        items={items} 
                        onDragEnd={onDragEnd} 
                        onItemUpdate={handleItemUpdate}
                        onItemClick={(id) => navigate(`/dashboard/leads/${id}`)}
                        onItemDelete={handleDeleteLead}
                        onColumnDelete={handleDeleteColumnLeads}
                        className="h-full"
                        scrollPersistenceKey="leads-pipeline-board"
                        themeVariant="reference"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-6 overflow-y-auto pr-2">
                  <ContactsSection leads={filteredLeads} />
                  <TasksSection 
                    tasks={tasks} 
                    onCompleteTask={handleTaskComplete} 
                    onAddTask={handleAddTask}
                  />
                </div>
              </div>

              <div className="flex-none">
                <DashboardOverview stats={stats} />
              </div>

              <div className="flex-none">
                <KanbanFunnel
                  stages={stages}
                  labels={funnelData.labelMap}
                  colors={funnelData.colorMap}
                  indicatorColors={stageBarColor}
                  counts={funnelData.counts}
                  total={leads.length}
                  activeStages={selectedStages}
                  layout="single-line"
                  onStageClick={(s) => {
                    const exists = selectedStages.includes(s as LeadStatus);
                    const nextSel = exists
                      ? selectedStages.filter((x) => x !== s)
                      : [...selectedStages, s as LeadStatus];
                    handleStageFilterChange(nextSel);
                  }}
                  onClearStage={() => handleStageFilterChange([])}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <CreateTaskDialog 
        open={isCreateTaskOpen} 
        onOpenChange={setIsCreateTaskOpen} 
        onSave={handleSaveTask}
        loading={isSavingTask}
      />
    </DashboardLayout>
  );
}
