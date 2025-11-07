import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Droppable } from "@/components/kanban/Droppable";
import { Draggable } from "@/components/kanban/Draggable";
import { SwimLane } from "@/components/kanban/SwimLane";
import { useSort } from "@/hooks/useSort";

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'converted' | 'lost';
type DatabaseLeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'converted' | 'lost' | 'negotiation' | 'won';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: DatabaseLeadStatus;
  estimated_value: number | null;
  lead_score: number | null;
  created_at: string;
  owner_id: string | null;
}

const statusConfig: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  contacted: { label: "Contacted", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  qualified: { label: "Qualified", color: "bg-green-500/10 text-green-700 dark:text-green-300" },
  proposal: { label: "Proposal", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" },
  converted: { label: "Converted", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  lost: { label: "Lost", color: "bg-red-500/10 text-red-700 dark:text-red-300" },
};

const stages: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'converted', 'lost'];

export default function LeadsPipeline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'score' | 'value' | 'owner'>('none');
  const [users, setUsers] = useState<Array<{ id: string; email: string }>>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchLeads();
    fetchUsers();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast({
        title: "Error",
        description: "Failed to fetch leads",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Get unique owner_ids from leads first
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("owner_id")
        .not("owner_id", "is", null);

      if (leadsError) throw leadsError;
      
      const ownerIds = Array.from(new Set(leadsData?.map(l => l.owner_id).filter(Boolean)));
      
      if (ownerIds.length === 0) {
        setUsers([]);
        return;
      }

      // Get user_roles to get email info
      const { data: userRolesData, error: userRolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", ownerIds);

      if (userRolesError) throw userRolesError;

      // For now, use user_id as display name since we can't access auth.users
      const uniqueUsers = ownerIds.map(id => ({
        id,
        email: id // Using ID as email until we have a profiles table
      }));
      
      setUsers(uniqueUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);

      if (error) throw error;

      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );

      toast({
        title: "Success",
        description: "Lead status updated",
      });
    } catch (error) {
      console.error("Error updating lead status:", error);
      toast({
        title: "Error",
        description: "Failed to update lead status",
        variant: "destructive",
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    handleStatusChange(leadId, newStatus);
  };

  const filteredLeads = leads.filter((lead) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      lead.first_name.toLowerCase().includes(searchLower) ||
      lead.last_name.toLowerCase().includes(searchLower) ||
      lead.company?.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower);

    const matchesScore =
      scoreFilter === "all" ||
      (scoreFilter === "high" && (lead.lead_score || 0) >= 70) ||
      (scoreFilter === "medium" && (lead.lead_score || 0) >= 40 && (lead.lead_score || 0) < 70) ||
      (scoreFilter === "low" && (lead.lead_score || 0) < 40);

    const matchesOwner = ownerFilter === "all" || lead.owner_id === ownerFilter;

    return matchesSearch && matchesScore && matchesOwner;
  });

  const groupedLeads = stages.reduce((acc, stage) => {
    acc[stage] = filteredLeads.filter((lead) => lead.status === stage as DatabaseLeadStatus);
    return acc;
  }, {} as Record<LeadStatus, Lead[]>);

  // Group leads by swim lane
  const getSwimLanes = () => {
    if (groupBy === 'none') {
      return [{ id: 'all', title: 'All Leads', leads: filteredLeads }];
    }

    if (groupBy === 'score') {
      return [
        { 
          id: 'high', 
          title: 'High Score (70+)', 
          leads: filteredLeads.filter(l => (l.lead_score || 0) >= 70) 
        },
        { 
          id: 'medium', 
          title: 'Medium Score (40-69)', 
          leads: filteredLeads.filter(l => (l.lead_score || 0) >= 40 && (l.lead_score || 0) < 70) 
        },
        { 
          id: 'low', 
          title: 'Low Score (<40)', 
          leads: filteredLeads.filter(l => (l.lead_score || 0) < 40) 
        },
      ];
    }

    if (groupBy === 'value') {
      return [
        { 
          id: 'high-value', 
          title: 'High Value ($50K+)', 
          leads: filteredLeads.filter(l => (l.estimated_value || 0) >= 50000) 
        },
        { 
          id: 'mid-value', 
          title: 'Mid Value ($10K-$50K)', 
          leads: filteredLeads.filter(l => (l.estimated_value || 0) >= 10000 && (l.estimated_value || 0) < 50000) 
        },
        { 
          id: 'low-value', 
          title: 'Low Value (<$10K)', 
          leads: filteredLeads.filter(l => (l.estimated_value || 0) > 0 && (l.estimated_value || 0) < 10000) 
        },
        { 
          id: 'no-value', 
          title: 'No Value Set', 
          leads: filteredLeads.filter(l => !l.estimated_value) 
        },
      ];
    }

    if (groupBy === 'owner') {
      const unassigned = { 
        id: 'unassigned', 
        title: 'Unassigned', 
        leads: filteredLeads.filter(l => !l.owner_id) 
      };
      
      const ownerGroups = users.map(user => ({
        id: user.id,
        title: user.email,
        leads: filteredLeads.filter(l => l.owner_id === user.id)
      })).filter(g => g.leads.length > 0);

      return [unassigned, ...ownerGroups];
    }

    return [{ id: 'all', title: 'All Leads', leads: filteredLeads }];
  };

  const swimLanes = getSwimLanes();

  const { sorted: sortedLeads } = useSort(filteredLeads, {
    initialField: "created_at",
    initialDirection: "desc",
  });

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leads Pipeline</h1>
            <p className="text-muted-foreground">Manage leads through stages</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/leads")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </div>
      <div className="space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Lead Score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scores</SelectItem>
                  <SelectItem value="high">High (70+)</SelectItem>
                  <SelectItem value="medium">Medium (40-69)</SelectItem>
                  <SelectItem value="low">Low (&lt;40)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Layers className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Group By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="score">By Score</SelectItem>
                  <SelectItem value="value">By Value</SelectItem>
                  <SelectItem value="owner">By Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">Loading leads...</div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="space-y-4">
              {swimLanes.map((lane) => {
                const laneGroupedLeads = stages.reduce((acc, stage) => {
                  acc[stage] = lane.leads.filter((lead) => lead.status === stage as DatabaseLeadStatus);
                  return acc;
                }, {} as Record<LeadStatus, Lead[]>);

                const totalValue = lane.leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
                const avgScore = lane.leads.length > 0
                  ? Math.round(lane.leads.reduce((sum, lead) => sum + (lead.lead_score || 0), 0) / lane.leads.length)
                  : 0;

                return (
                  <SwimLane
                    key={lane.id}
                    id={lane.id}
                    title={lane.title}
                    count={lane.leads.length}
                    metrics={[
                      { label: 'Total Value', value: formatCurrency(totalValue) },
                      { label: 'Avg Score', value: avgScore },
                    ]}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                      {stages.map((stage) => (
                        <Droppable key={stage} id={stage}>
                          <Card className="h-full">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span>{statusConfig[stage].label}</span>
                                <Badge variant="secondary" className={statusConfig[stage].color}>
                                  {laneGroupedLeads[stage].length}
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {laneGroupedLeads[stage].map((lead) => (
                                <Draggable key={lead.id} id={lead.id}>
                                  <Card
                                    className="cursor-pointer hover:shadow-md transition-shadow"
                                    onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
                                  >
                                    <CardContent className="p-3 space-y-2">
                                      <div className="font-medium text-sm">
                                        {lead.first_name} {lead.last_name}
                                      </div>
                                      {lead.company && (
                                        <div className="text-xs text-muted-foreground">{lead.company}</div>
                                      )}
                                      {lead.estimated_value && (
                                        <div className="text-xs font-semibold text-primary">
                                          {formatCurrency(lead.estimated_value)}
                                        </div>
                                      )}
                                      {lead.lead_score !== null && (
                                        <Badge
                                          variant="outline"
                                          className={
                                            lead.lead_score >= 70
                                              ? "bg-green-500/10"
                                              : lead.lead_score >= 40
                                              ? "bg-yellow-500/10"
                                              : "bg-red-500/10"
                                          }
                                        >
                                          Score: {lead.lead_score}
                                        </Badge>
                                      )}
                                    </CardContent>
                                  </Card>
                                </Draggable>
                              ))}
                              {laneGroupedLeads[stage].length === 0 && (
                                <div className="text-xs text-muted-foreground text-center py-4">
                                  No leads in this stage
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </Droppable>
                      ))}
                    </div>
                  </SwimLane>
                );
              })}
            </div>
            <DragOverlay>
              {activeLead ? (
                <Card className="w-64 shadow-lg rotate-3">
                  <CardContent className="p-3 space-y-2">
                    <div className="font-medium text-sm">
                      {activeLead.first_name} {activeLead.last_name}
                    </div>
                    {activeLead.company && (
                      <div className="text-xs text-muted-foreground">{activeLead.company}</div>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
      </div>
    </DashboardLayout>
  );
}
