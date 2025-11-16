import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Filter, Layers, Settings, CheckSquare, Square, Trash2, UserPlus, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Droppable } from "@/components/kanban/Droppable";
import { Draggable } from "@/components/kanban/Draggable";
import { SwimLane } from "@/components/kanban/SwimLane";
import { useSort } from "@/hooks/useSort";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { KanbanFunnel } from "@/components/kanban/KanbanFunnel";

type LeadStatus = 'new' | 'contacted' | 'negotiation' | 'proposal' | 'qualified' | 'lost' | 'won';
type DatabaseLeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

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
  new: { label: "🔍 New Inquiry", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  contacted: { label: "📞 Contact Attempted", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  negotiation: { label: "💬 In Discussion", color: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" },
  proposal: { label: "📋 Requirements Gathering", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" },
  qualified: { label: "🎯 Qualified Lead", color: "bg-green-500/10 text-green-700 dark:text-green-300" },
  lost: { label: "❌ Disqualified", color: "bg-red-500/10 text-red-700 dark:text-red-300" },
  won: { label: "✅ Converted to Opportunity", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
};

const stages: LeadStatus[] = ['new', 'contacted', 'negotiation', 'proposal', 'qualified', 'lost', 'won'];

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
  
  // Advanced filters
  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  
  // WIP limits
  const [wipLimits, setWipLimits] = useState<Record<LeadStatus, number>>({
    new: 20,
    contacted: 15,
    negotiation: 12,
    proposal: 10,
    qualified: 8,
    lost: 999,
    won: 999,
  });
  
  // Card customization
  const [showFields, setShowFields] = useState({
    company: true,
    value: true,
    score: true,
    email: false,
    phone: false,
  });
  
  // Bulk operations
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

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
      // Normalize incoming lead records to our UI Lead type.
      // Some databases may use a 'converted' status; map it to 'won' for the UI.
      const normalized = (data || []).map((l: any) => {
        const status = l.status === 'converted' ? 'won' : l.status;
        return {
          id: l.id,
          first_name: l.first_name,
          last_name: l.last_name,
          company: l.company ?? null,
          email: l.email ?? null,
          phone: l.phone ?? null,
          status: status as DatabaseLeadStatus,
          estimated_value: l.estimated_value ?? null,
          lead_score: l.lead_score ?? null,
          created_at: l.created_at,
          owner_id: l.owner_id ?? null,
        } as Lead;
      });
      setLeads(normalized);
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
    
    // Value range filter
    const leadValue = lead.estimated_value || 0;
    const matchesMinValue = !minValue || leadValue >= parseFloat(minValue);
    const matchesMaxValue = !maxValue || leadValue <= parseFloat(maxValue);
    
    // Date range filter
    const leadDate = new Date(lead.created_at);
    const matchesDateFrom = !dateFrom || leadDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || leadDate <= new Date(dateTo);

    return matchesSearch && matchesScore && matchesOwner && matchesMinValue && matchesMaxValue && matchesDateFrom && matchesDateTo;
  });
  
  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };
  
  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return;
    
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .in("id", Array.from(selectedLeads));
        
      if (error) throw error;
      
      setLeads(prev => prev.filter(l => !selectedLeads.has(l.id)));
      setSelectedLeads(new Set());
      
      toast({
        title: "Success",
        description: `Deleted ${selectedLeads.size} lead(s)`,
      });
    } catch (error) {
      console.error("Error deleting leads:", error);
      toast({
        title: "Error",
        description: "Failed to delete leads",
        variant: "destructive",
      });
    }
  };
  
  const handleBulkStatusChange = async (newStatus: LeadStatus) => {
    if (selectedLeads.size === 0) return;
    
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .in("id", Array.from(selectedLeads));
        
      if (error) throw error;
      
      setLeads(prev => prev.map(l => 
        selectedLeads.has(l.id) ? { ...l, status: newStatus } : l
      ));
      setSelectedLeads(new Set());
      
      toast({
        title: "Success",
        description: `Updated ${selectedLeads.size} lead(s)`,
      });
    } catch (error) {
      console.error("Error updating leads:", error);
      toast({
        title: "Error",
        description: "Failed to update leads",
        variant: "destructive",
      });
    }
  };

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

  // Multi-stage selection with deep-linking via `stage` query param
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStagesParam = searchParams.get('stage');
  const initialSelectedStages = (initialStagesParam ? initialStagesParam.split(',') : [])
    .filter((s): s is LeadStatus => (stages as string[]).includes(s));
  const [selectedStages, setSelectedStages] = useState<LeadStatus[]>(initialSelectedStages);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedStages.length > 0) {
      next.set('stage', selectedStages.join(','));
    } else {
      next.delete('stage');
    }
    setSearchParams(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStages]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leads Pipeline</h1>
            <p className="text-muted-foreground">
              Manage leads through stages
              {(() => {
                const selectedTotal = selectedStages.length
                  ? selectedStages.reduce((acc, s) => acc + (groupedLeads[s]?.length || 0), 0)
                  : filteredLeads.length;
                const fullTotal = filteredLeads.length;
                return (
                  <span className="ml-2 text-xs">
                    {selectedStages.length > 0 ? `Selected: ${selectedTotal} of ${fullTotal}` : `Total: ${fullTotal}`}
                  </span>
                );
              })()}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/leads")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </div>
              <div className="space-y-4">
                {(() => {
                  const labelMap: Record<LeadStatus, string> = Object.fromEntries(
                    stages.map((s) => [s, statusConfig[s].label])
                  ) as Record<LeadStatus, string>;
                  const colorMap: Record<LeadStatus, string> = Object.fromEntries(
                    stages.map((s) => [s, statusConfig[s].color])
                  ) as Record<LeadStatus, string>;
                  const baseCountMap: Record<LeadStatus, number> = Object.fromEntries(
                    stages.map((s) => [s, (groupedLeads[s]?.length || 0)])
                  ) as Record<LeadStatus, number>;
                  const countMap: Record<LeadStatus, number> = selectedStages.length > 0
                    ? Object.fromEntries(stages.map((s) => [s, selectedStages.includes(s) ? baseCountMap[s] : 0])) as Record<LeadStatus, number>
                    : baseCountMap;
                  const totalCount = selectedStages.length > 0
                    ? selectedStages.reduce((acc, s) => acc + baseCountMap[s], 0)
                    : filteredLeads.length;

                  return (
                    <KanbanFunnel
                      stages={stages}
                      labels={labelMap}
                      colors={colorMap}
                      counts={countMap}
                      total={totalCount}
                      activeStages={selectedStages}
                      onStageClick={(s) => {
                        setSelectedStages((prev) => {
                          const exists = prev.includes(s);
                          const nextSel = exists ? prev.filter((x) => x !== s) : [...prev, s];
                          return nextSel.sort((a, b) => stages.indexOf(a) - stages.indexOf(b));
                        });
                      }}
                      onClearStage={() => setSelectedStages([])}
                    />
                  );
                })()}
        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Main Filters */}
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
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <UserPlus className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Owners</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.email}
                      </SelectItem>
                    ))}
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
              
              {/* Advanced Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Min Value ($)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={minValue}
                    onChange={(e) => setMinValue(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max Value ($)</Label>
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={maxValue}
                    onChange={(e) => setMaxValue(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Date To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
              
              {/* Actions Bar */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant={bulkMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setBulkMode(!bulkMode);
                      setSelectedLeads(new Set());
                    }}
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    {bulkMode ? "Cancel Selection" : "Bulk Select"}
                  </Button>
                  
                  {bulkMode && selectedLeads.size > 0 && (
                    <>
                      <Badge variant="secondary">{selectedLeads.size} selected</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkDelete}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                      <Select onValueChange={handleBulkStatusChange}>
                        <SelectTrigger className="w-[180px] h-9">
                          <SelectValue placeholder="Change Status" />
                        </SelectTrigger>
                        <SelectContent>
{(selectedStages.length ? selectedStages : stages).map(stage => (
                            <SelectItem key={stage} value={stage}>
                              {statusConfig[stage].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Customize Cards
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-4">
                      <h4 className="font-medium">Card Fields</h4>
                      <div className="space-y-3">
                        {Object.entries(showFields).map(([field, show]) => (
                          <div key={field} className="flex items-center space-x-2">
                            <Checkbox
                              id={field}
                              checked={show}
                              onCheckedChange={(checked) =>
                                setShowFields(prev => ({ ...prev, [field]: !!checked }))
                              }
                            />
                            <Label htmlFor={field} className="capitalize">
                              {field}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <h4 className="font-medium">WIP Limits</h4>
                      <div className="space-y-2">
                        {stages.slice(0, 5).map(stage => (
                          <div key={stage} className="flex items-center justify-between">
                            <Label className="text-xs">{statusConfig[stage].label}</Label>
                            <Input
                              type="number"
                              min="0"
                              value={wipLimits[stage]}
                              onChange={(e) => setWipLimits(prev => ({
                                ...prev,
                                [stage]: parseInt(e.target.value) || 0
                              }))}
                              className="w-20 h-8"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
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
{(selectedStages.length ? selectedStages : stages).map((stage) => (
                        <Droppable key={stage} id={stage}>
                          <Card className="h-full transition-all duration-200 hover:shadow-md">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span>{statusConfig[stage].label}</span>
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant="secondary" 
                                    className={`${statusConfig[stage].color} transition-all duration-200`}
                                  >
                                    {laneGroupedLeads[stage].length}
                                  </Badge>
                                  {wipLimits[stage] < 999 && laneGroupedLeads[stage].length >= wipLimits[stage] && (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                  )}
                                </div>
                              </CardTitle>
                              {wipLimits[stage] < 999 && (
                                <div className="text-xs text-muted-foreground">
                                  Limit: {wipLimits[stage]} 
                                  {laneGroupedLeads[stage].length > wipLimits[stage] && (
                                    <span className="text-destructive ml-1">
                                      (+{laneGroupedLeads[stage].length - wipLimits[stage]} over)
                                    </span>
                                  )}
                                </div>
                              )}
                            </CardHeader>
                            <CardContent className="space-y-2 min-h-[200px]">
                              {laneGroupedLeads[stage].map((lead) => (
                                <Draggable key={lead.id} id={lead.id}>
                                  <Card
                                    className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 animate-fade-in relative"
                                    onClick={(e) => {
                                      if (bulkMode) {
                                        e.stopPropagation();
                                        toggleLeadSelection(lead.id);
                                      } else {
                                        navigate(`/dashboard/leads/${lead.id}`);
                                      }
                                    }}
                                  >
                                    <CardContent className="p-3 space-y-2">
                                      {bulkMode && (
                                        <div className="absolute top-2 right-2 z-10">
                                          {selectedLeads.has(lead.id) ? (
                                            <CheckSquare className="h-4 w-4 text-primary" />
                                          ) : (
                                            <Square className="h-4 w-4 text-muted-foreground" />
                                          )}
                                        </div>
                                      )}
                                      <div className="font-medium text-sm">
                                        {lead.first_name} {lead.last_name}
                                      </div>
                                      {showFields.company && lead.company && (
                                        <div className="text-xs text-muted-foreground">{lead.company}</div>
                                      )}
                                      {showFields.email && lead.email && (
                                        <div className="text-xs text-muted-foreground">{lead.email}</div>
                                      )}
                                      {showFields.phone && lead.phone && (
                                        <div className="text-xs text-muted-foreground">{lead.phone}</div>
                                      )}
                                      {showFields.value && lead.estimated_value && (
                                        <div className="text-xs font-semibold text-primary">
                                          {formatCurrency(lead.estimated_value)}
                                        </div>
                                      )}
                                      {showFields.score && lead.lead_score !== null && (
                                        <Badge
                                          variant="outline"
                                          className={`transition-all duration-200 ${
                                            lead.lead_score >= 70
                                              ? "bg-green-500/10 hover:bg-green-500/20"
                                              : lead.lead_score >= 40
                                              ? "bg-yellow-500/10 hover:bg-yellow-500/20"
                                              : "bg-red-500/10 hover:bg-red-500/20"
                                          }`}
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
                <Card className="w-64 shadow-2xl rotate-3 scale-105 border-2 border-primary animate-scale-in">
                  <CardContent className="p-3 space-y-2 bg-gradient-to-br from-background to-muted">
                    <div className="font-medium text-sm">
                      {activeLead.first_name} {activeLead.last_name}
                    </div>
                    {activeLead.company && (
                      <div className="text-xs text-muted-foreground">{activeLead.company}</div>
                    )}
                    {activeLead.estimated_value && (
                      <div className="text-xs font-semibold text-primary">
                        {formatCurrency(activeLead.estimated_value)}
                      </div>
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
