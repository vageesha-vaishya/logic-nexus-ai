import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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

export default function LeadsPipeline() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { supabase, context } = useCRM();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // URL State
  const searchQuery = searchParams.get('q') || '';
  const selectedStages = useMemo(() => {
    const s = searchParams.get('status');
    return s ? (s.split(',') as LeadStatus[]).filter(x => stages.includes(x)) : [];
  }, [searchParams]);
  const currentView = searchParams.get('view') || 'board'; // 'board' | 'analytics'

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

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Validate and cast data
      const safeLeads = (data || []).map(d => ({
        ...d,
        status: stages.includes(d.status as LeadStatus) ? (d.status as LeadStatus) : 'new'
      })) as Lead[];

      setLeads(safeLeads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();

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
          console.log('Realtime update:', payload);
          
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
  }, [supabase]);

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);

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

  // Debug Logs
  if (process.env.NODE_ENV === 'development') {
    console.log('Current View:', currentView);
    console.log('Filtered Leads:', filteredLeads.length);
    console.log('Kanban Items:', items.length);
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
        
        {/* Header */}
        <div className="flex-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Leads Pipeline</h1>
              <p className="text-muted-foreground">Manage and track your lead progression</p>
            </div>
            <div className="flex items-center gap-2">
               <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate("/dashboard/leads")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                List View
              </Button>
              <Button asChild size="sm">
                <Link to="/dashboard/leads/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Lead
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
                  Kanban Board
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </TabsTrigger>
              </TabsList>
            </div>
            
            {/* Analytics Content */}
            <TabsContent value="analytics" className="mt-0">
               <PipelineAnalytics leads={filteredLeads} />
            </TabsContent>

            {/* Board Content */}
            <TabsContent value="board" className="mt-0 flex flex-col gap-6 h-full">
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
                              label: 'Status',
                              options: stages.map(s => ({
                                label: statusConfig[s].label,
                                value: s,
                              }))
                            }
                          ]}
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 pb-1">
                          <Filter className="h-3 w-3" />
                          <span>{filteredLeads.length} leads found</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Kanban Board */}
                <div className="flex-1 min-h-[500px] overflow-hidden bg-muted/20 rounded-lg border">
                  {loading && items.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Loading pipeline...
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
            </TabsContent>
          </Tabs>
        </div>

      </div>
    </DashboardLayout>
  );
}
