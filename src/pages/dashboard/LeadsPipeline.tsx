import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Filter, RefreshCw, Plus, Download } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { KanbanBoard, ColumnType } from '@/components/kanban/KanbanBoard';
import { KanbanItem } from '@/components/kanban/KanbanCard';
import { KanbanFunnel } from '@/components/kanban/KanbanFunnel';
import { KanbanFilters } from '@/components/kanban/KanbanFilters';
import { PipelineAnalytics } from '@/components/analytics/PipelineAnalytics';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutGrid, BarChart3 } from "lucide-react";
import { Lead, LeadStatus, stages, statusConfig } from './leads-data';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { THEME_PRESETS } from '@/theme/themes';
import { themeStyleFromPreset } from '@/lib/theme-utils';
import { Palette } from 'lucide-react';
import { ViewToggle } from '@/components/ui/view-toggle';
import { DashboardOverview, ContactsSection, TasksSection, DashboardStats, CreateTaskDialog } from '@/components/crm/LeadsPipelineComponents';
import { Task } from '@/components/crm/TaskScheduler';
import { useLeadsViewState } from '@/hooks/useLeadsViewState';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/react';
import { Skeleton } from '@/components/ui/skeleton';

// Loading skeleton for the pipeline
function PipelineSkeleton() {
  return (
    <div className="flex h-full gap-3 pb-4 overflow-x-auto">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="w-[300px] flex-shrink-0 flex flex-col gap-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <div className="flex-1 space-y-2">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-28 w-full rounded-lg" />
            ))}
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

  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isSavingDefault, setIsSavingDefault] = useState(false);

  // URL State - memoized to prevent recalculation
  const searchQuery = searchParams.get('q') || '';
  const selectedStages = useMemo(() => {
    const s = searchParams.get('status');
    return s ? (s.split(',') as LeadStatus[]).filter(x => stages.includes(x)) : [];
  }, [searchParams]);
  const currentView = searchParams.get('view') || 'board';

  // Stable context check
  const isContextReady = Boolean(context?.tenantId || context?.isPlatformAdmin);

  const handleSetDefaultView = useCallback(async () => {
    if (!context) return;
    try {
      setIsSavingDefault(true);
      try {
        localStorage.setItem('leadsViewMode', 'pipeline');
        localStorage.setItem('leadsTheme', viewState.theme);
      } catch {
        void 0;
      }
      if (context.userId) {
        const userViewKey = `user:${context.userId}:leads.default_view`;
        const userThemeKey = `user:${context.userId}:leads.default_theme`;
        const [{ error: vErr }, { error: tErr }] = await Promise.all([
          scopedDb.setSystemSetting(userViewKey, 'pipeline'),
          scopedDb.setSystemSetting(userThemeKey, viewState.theme),
        ]);
        if (vErr || tErr) throw (vErr || tErr);
      }
      toast.success(t('leads.messages.defaultSet', 'Default saved'));
    } catch (error) {
      logger.error('Failed to set pipeline as default view', {
        view: 'pipeline',
        theme: viewState.theme,
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error);
      toast.error(t('leads.messages.defaultSetFailed', 'Failed to save default'));
    } finally {
      setIsSavingDefault(false);
    }
  }, [context, supabase, viewState.theme, t]);

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

  // Stable fetch function - no dependencies on filter state
  const fetchLeads = useCallback(async () => {
    if (!isContextReady) return;
    
    setLoading(true);
    try {
      const { data, error } = await scopedDb
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const safeLeads = ((data as any[]) || []).map(d => ({
        ...d,
        status: stages.includes(d.status as LeadStatus) ? (d.status as LeadStatus) : 'new'
      })) as Lead[];

      setLeads(safeLeads);
    } catch (error) {
      logger.error('Failed to fetch leads (pipeline)', {
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  }, [supabase, context, isContextReady]);

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
      console.error('Error fetching tasks', e);
    }
  }, [supabase, context, isContextReady]);

  // Fetch whenever scope changes (tenant / franchise / override)
  useEffect(() => {
    if (!isContextReady) return;
    fetchLeads();
    fetchTasks();
  }, [isContextReady, (context as any)?._version, fetchLeads, fetchTasks]);

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
      console.error('Failed to update task', error);
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
      console.error('Failed to create task', error);
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
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

    if (!isContextReady) return;

    try {
      const { error } = await (scopedDb.from('leads') as any).update({ status: newStatus }).eq('id', leadId);

      if (error) throw error;
      toast.success(`Lead moved to ${statusConfig[newStatus].label}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
      fetchLeads();
    }
  }, [supabase, context, isContextReady, fetchLeads]);

  const handleItemUpdate = useCallback(async (id: string, updates: Partial<KanbanItem>) => {
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

    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...leadUpdates } : l));

    try {
      const { error } = await (scopedDb.from('leads') as any)
        .update(leadUpdates)
        .eq('id', id);

      if (error) throw error;
      toast.success("Lead updated");
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Failed to update lead');
      fetchLeads();
    }
  }, [supabase, fetchLeads]);

  const onDragEnd = useCallback((activeId: string, overId: string, newStatus: string) => {
    if (stages.includes(newStatus as LeadStatus)) {
      handleStatusChange(activeId, newStatus as LeadStatus);
    }
  }, [handleStatusChange]);

  // Filter logic - memoized
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch = 
        searchQuery === '' || 
        `${lead.first_name} ${lead.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.company || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStage = selectedStages.length === 0 || selectedStages.includes(lead.status);

      return matchesSearch && matchesStage;
    });
  }, [leads, searchQuery, selectedStages]);

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

  // Kanban columns - memoized
  const columns: ColumnType[] = useMemo(() => {
    const visibleStages = selectedStages.length > 0 ? selectedStages : stages;
    return visibleStages.map(stage => ({
      id: stage,
      title: statusConfig[stage].label,
      color: statusConfig[stage].color,
    }));
  }, [selectedStages]);

  // Kanban items - memoized
  const items: KanbanItem[] = useMemo(() => {
    return filteredLeads.map(lead => ({
      id: lead.id,
      title: `${lead.first_name} ${lead.last_name}`,
      subtitle: lead.company || undefined,
      status: lead.status,
      priority: (lead.lead_score || 0) >= 70 ? 'high' : (lead.lead_score || 0) < 40 ? 'low' : 'medium',
      value: lead.estimated_value || undefined,
      updatedAt: lead.created_at,
      assignee: lead.owner_id ? { name: "User" } : undefined,
      tags: [lead.email].filter(Boolean) as string[],
    }));
  }, [filteredLeads]);

  const handleNavigateAway = useCallback((mode: string) => {
    if (mode !== 'pipeline') {
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
    }
  }, [setView, setWorkspace, searchQuery, selectedStages, navigate]);

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
              <h1 className="text-3xl font-bold tracking-tight">{t('leads.title', 'Leads Pipeline')}</h1>
              <p className="text-muted-foreground">{t('leads.subtitle', 'Manage and track your lead progression')}</p>
            </div>
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
              <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t('leads.actions.refresh', 'Refresh')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (searchQuery) params.set('q', searchQuery);
                  if (selectedStages.length > 0) params.set('status', selectedStages.join(','));
                  params.set('from', 'pipeline');
                  navigate(`/dashboard/leads/import-export?${params.toString()}`);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('leads.actions.importExport', 'Import/Export')}
              </Button>
              <ViewToggle
                value="pipeline"
                modes={['pipeline', 'card', 'grid', 'list']}
                onChange={handleNavigateAway}
              />
              {context?.isPlatformAdmin && (
                <Button variant="outline" size="sm" onClick={handleSetDefaultView} disabled={isSavingDefault}>
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
          </div>

          {/* Funnel */}
          <div className={currentView === 'analytics' ? 'hidden' : 'block'}>
            <KanbanFunnel
              stages={stages}
              labels={funnelData.labelMap}
              colors={funnelData.colorMap}
              counts={funnelData.counts}
              total={leads.length}
              activeStages={selectedStages}
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
        </div>

        {/* View Toggle */}
        <div className="flex-none px-1">
          <Tabs value={currentView} onValueChange={handleViewChange} className="w-full">
            <div className="flex items-center justify-between mb-2">
              <TabsList>
                <TabsTrigger value="board" className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  {t('leads.tabs.board', 'Board')}
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {t('leads.tabs.analytics', 'Analytics')}
                </TabsTrigger>
              </TabsList>
            </div>
            
            {/* Analytics Content */}
            <TabsContent value="analytics" className="mt-0">
              <PipelineAnalytics leads={filteredLeads} />
            </TabsContent>

            {/* Board Content */}
            <TabsContent value="board" className="mt-0 flex flex-col gap-6 h-full">
              <div className="flex-none">
                <DashboardOverview stats={stats} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                <div className="lg:col-span-3 flex flex-col gap-4 h-full min-h-0">
                  {/* Filters */}
                  <div className="flex-none">
                    <Card className="rounded-md border-muted">
                      <CardContent className="p-2">
                        <KanbanFilters
                          searchQuery={searchQuery}
                          onSearchChange={handleSearchChange}
                          filters={{ status: selectedStages }}
                          onFilterChange={(key, values) => {
                            if (key === 'status') handleStageFilterChange(values);
                          }}
                          availableFilters={[
                            {
                              id: 'status',
                              label: t('leads.filters.status', 'Status'),
                              options: stages.map(s => ({
                                label: t(`leads.filters.statusOptions.${s}`, statusConfig[s].label),
                                value: s,
                              }))
                            }
                          ]}
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 pb-1">
                          <Filter className="h-3 w-3" />
                          <span>{filteredLeads.length} {t('leads.pipeline.leadsFound', 'leads found')}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Kanban Board */}
                  <div className="flex-1 min-h-[500px] overflow-hidden bg-muted/20 rounded-lg border">
                    {loading && items.length === 0 ? (
                      <PipelineSkeleton />
                    ) : (
                      <KanbanBoard 
                        columns={columns} 
                        items={items} 
                        onDragEnd={onDragEnd} 
                        onItemUpdate={handleItemUpdate}
                        onItemClick={(id) => navigate(`/dashboard/leads/${id}`)}
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
