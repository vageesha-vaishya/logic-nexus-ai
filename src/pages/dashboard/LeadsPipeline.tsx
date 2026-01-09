import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowLeft, Filter, RefreshCw, Calendar, Tag, Plus } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { KanbanBoard, ColumnType } from '@/components/kanban/KanbanBoard';
import { KanbanItem } from '@/components/kanban/KanbanCard';
import { KanbanFunnel } from '@/components/kanban/KanbanFunnel';
import { KanbanFilters, FilterOption } from '@/components/kanban/KanbanFilters';
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
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';
import { useLeadsViewState } from '@/hooks/useLeadsViewState';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/react';

export default function LeadsPipeline() {
  usePerformanceMonitor('Leads Pipeline');
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { supabase, context } = useCRM();
  const { state: viewState, setTheme, setView, setPipeline, setWorkspace } = useLeadsViewState();
  const currentTheme = viewState.theme;
  const isNavigatingAwayFromPipeline = useRef(false);
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isSavingDefault, setIsSavingDefault] = useState(false);

  // URL State
  const searchQuery = searchParams.get('q') || '';
  const selectedStages = useMemo(() => {
    const s = searchParams.get('status');
    return s ? (s.split(',') as LeadStatus[]).filter(x => stages.includes(x)) : [];
  }, [searchParams]);
  const currentView = searchParams.get('view') || 'board'; // 'board' | 'analytics'

  const handleSetDefaultView = async () => {
    try {
      setIsSavingDefault(true);
      const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      try {
        localStorage.setItem('leadsViewMode', 'pipeline');
        localStorage.setItem('leadsTheme', viewState.theme);
      } catch {
        void 0;
      }
      if (context?.userId) {
        const userViewKey = `user:${context.userId}:leads.default_view`;
        const userThemeKey = `user:${context.userId}:leads.default_theme`;
        const [{ error: vErr }, { error: tErr }] = await Promise.all([
          dao.setSystemSetting(userViewKey, 'pipeline'),
          dao.setSystemSetting(userThemeKey, viewState.theme),
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
  };

  useEffect(() => {
    const loadThemeDefault = async () => {
        if (!viewState.hydrated || !context?.userId) return;
        if (viewState.hydrationSource !== 'default') return;
        try {
            const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
            const userThemeKey = `user:${context.userId}:leads.default_theme`;
            const { data: themeData } = await dao.getSystemSetting(userThemeKey);
            const defaultTheme = themeData?.setting_value;
            
            if (defaultTheme && typeof defaultTheme === 'string' && defaultTheme !== viewState.theme) {
                setTheme(defaultTheme);
            }
        } catch {
            return;
        }
    };
    loadThemeDefault();
  }, [context?.userId, viewState.hydrated, viewState.theme, setTheme, supabase, context]);

  const handleThemeChange = (val: string) => {
    setTheme(val);
    try {
      localStorage.setItem('leadsTheme', val);
    } catch {
      return;
    }
  };

  useEffect(() => {
    if (!viewState.hydrated) return;
    if (isNavigatingAwayFromPipeline.current) return;
    if (viewState.view !== 'pipeline') setView('pipeline');
  }, [setView, viewState.hydrated, viewState.view]);

  useEffect(() => {
    if (!viewState.hydrated) return;
    const tab = currentView === 'analytics' ? 'analytics' : 'board';
    setPipeline({ q: searchQuery, status: selectedStages, tab });
  }, [currentView, searchQuery, selectedStages, setPipeline, viewState.hydrated]);

  const handleSearchChange = (val: string) => {
    setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        if (val) newParams.set('q', val);
        else newParams.delete('q');
        return newParams;
    }, { replace: true });
  };

  const handleViewChange = (view: string) => {
    setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.set('view', view);
        return newParams;
    });
  };

  const handleStageFilterChange = (values: string[]) => {
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        if (values.length > 0) newParams.set('status', values.join(','));
        else newParams.delete('status');
        return newParams;
      });
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const dataAccess = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      const { data, error } = await dataAccess
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Validate and cast data
      const safeLeads = ((data as any[]) || []).map(d => ({
        ...d,
        status: stages.includes(d.status as LeadStatus) ? (d.status as LeadStatus) : 'new'
      })) as Lead[];

      setLeads(safeLeads);
    } catch (error) {
      logger.error('Failed to fetch leads (pipeline)', {
        q: searchQuery,
        status: selectedStages,
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [supabase, context, searchQuery, selectedStages]);

  const fetchTasks = useCallback(async () => {
    if (!context) return;
    try {
      const dataAccess = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      const { data, error } = await (dataAccess.from('activities') as any)
        .select('*')
        .eq('activity_type', 'task')
        .order('due_date', { ascending: true });
      
      if (error) throw error;
      
      const mappedTasks: Task[] = (data || []).map((d: any) => ({
         id: d.id,
         title: d.title || 'Untitled Task',
         due_date: d.due_date,
         status: d.status === 'completed' ? 'completed' : 'pending',
         priority: d.priority || 'medium',
         assigned_to: { name: 'User' }, // Placeholder as we'd need a join to get real name
         related_to: d.related_to ? { type: 'lead', id: d.related_to, name: 'Lead' } : undefined
      }));
      setTasks(mappedTasks);
    } catch (e) {
      console.error('Error fetching tasks', e);
    }
  }, [supabase, context]);

  useEffect(() => {
    fetchLeads();
    fetchTasks();

    // Real-time subscription
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
            const newLead = payload.new as Lead;
            // Validate status
            const safeLead: Lead = {
               ...newLead,
               status: stages.includes(newLead.status) ? newLead.status : 'new'
            };
            setLeads((prev) => [safeLead, ...prev]);
            toast.info(`New lead: ${newLead.first_name} ${newLead.last_name}`);
          } 
          else if (payload.eventType === 'UPDATE') {
            const updatedLead = payload.new as Lead;
            // Validate status
            const safeLead: Lead = {
               ...updatedLead,
               status: stages.includes(updatedLead.status) ? updatedLead.status : 'new'
            };
            
            setLeads((prev) => prev.map((l) => 
                l.id === safeLead.id ? safeLead : l
            ));
          } 
          else if (payload.eventType === 'DELETE') {
             setLeads((prev) => prev.filter((l) => l.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, context, fetchLeads, fetchTasks]);

  const handleTaskComplete = async (taskId: string) => {
    // Optimistic update
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    if (!context) return;

    try {
      const dataAccess = new ScopedDataAccess(supabase as any, context as unknown as DataAccessContext);
      const { error } = await (dataAccess.from('activities') as any)
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;
      toast.success(`Task marked as ${newStatus}`);
    } catch (error) {
      console.error('Failed to update task', error);
      toast.error('Failed to update task status');
      // Revert
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
    }
  };

  const handleAddTask = () => {
    setIsCreateTaskOpen(true);
  };

  const handleSaveTask = async (taskData: { title: string; due_date: string; priority: 'low' | 'medium' | 'high' }) => {
    if (!context) return;
    setIsSavingTask(true);
    try {
      const dataAccess = new ScopedDataAccess(supabase as any, context as unknown as DataAccessContext);
      const { data, error } = await (dataAccess.from('activities') as any).insert({
          title: taskData.title,
          due_date: taskData.due_date,
          priority: taskData.priority,
          activity_type: 'task',
          status: 'pending',
          tenant_id: context.tenantId
        })
        .select()
        .single();

      if (error) throw error;

      const newTask: Task = {
        id: (data as any).id,
        title: (data as any).title,
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
  };

  const stats: DashboardStats = useMemo(() => ({
    totalLeads: leads.length,
    wonDeals: leads.filter(l => l.status === 'won').length,
    contacted: leads.filter(l => ['contacted', 'qualified', 'proposal'].includes(l.status)).length,
    highScore: Math.max(...leads.map(l => l.lead_score || 0), 0)
  }), [leads]);

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

    if (!context) return;

    try {
      const dataAccess = new ScopedDataAccess(supabase as any, context as unknown as DataAccessContext);
      const { error } = await (dataAccess.from('leads') as any).update({ status: newStatus }).eq('id', leadId);

      if (error) throw error;
      toast.success(`Lead moved to ${statusConfig[newStatus].label}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
      fetchLeads(); // Revert on error
    }
  };

  const handleItemUpdate = async (id: string, updates: Partial<KanbanItem>) => {
    // Map KanbanItem fields back to Lead fields
    const leadUpdates: Partial<Lead> = {};
    
    if (updates.title) {
        // Assume title is "First Last", try to split
        const parts = updates.title.split(' ');
        if (parts.length > 0) {
            leadUpdates.first_name = parts[0];
            leadUpdates.last_name = parts.slice(1).join(' ') || '';
        }
    }

    if (updates.value !== undefined) {
        leadUpdates.estimated_value = updates.value;
    }

    // Optimistic Update
    setLeads(prev => prev.map(l => {
        if (l.id === id) {
            return { ...l, ...leadUpdates };
        }
        return l;
    }));

    try {
        const { error } = await supabase
            .from('leads')
            .update(leadUpdates as any)
            .eq('id', id);

        if (error) throw error;
        toast.success("Lead updated");
    } catch (error) {
        console.error('Error updating lead:', error);
        toast.error('Failed to update lead');
        fetchLeads(); // Revert
    }
  };

  const onDragEnd = (activeId: string, overId: string, newStatus: string) => {
    // The KanbanBoard passes the column ID as newStatus.
    // We check if it's a valid LeadStatus before updating.
    if (stages.includes(newStatus as LeadStatus)) {
      handleStatusChange(activeId, newStatus as LeadStatus);
    }
  };

  // Filter logic
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

  // Funnel Data Preparation
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

  // Kanban Data Preparation
  const columns: ColumnType[] = useMemo(() => {
    const visibleStages = selectedStages.length > 0 ? selectedStages : stages;
    return visibleStages.map(stage => ({
      id: stage,
      title: statusConfig[stage].label,
      color: statusConfig[stage].color,
    }));
  }, [selectedStages]);

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
              <ViewToggle
                value="pipeline"
                modes={['pipeline', 'card', 'grid', 'list']}
                onChange={(mode) => {
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
                }}
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
                  {t('leads.tabs.board')}
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {t('leads.tabs.analytics')}
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
                                label: t('leads.filters.status'),
                                options: stages.map(s => ({
                                  label: t(`leads.filters.statusOptions.${s}`),
                                  value: s,
                                }))
                              }
                            ]}
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 pb-1">
                            <Filter className="h-3 w-3" />
                            <span>{t('leads.pipeline.found', { count: filteredLeads.length })}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Kanban Board */}
                  <div className="flex-1 min-h-[500px] overflow-hidden bg-muted/20 rounded-lg border">
                    {loading && items.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        {t('leads.pipeline.loading')}
                      </div>
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
