import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCRM } from "@/hooks/useCRM";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Filter, Layers, Settings, CheckSquare, Square, Trash2, AlertCircle, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Droppable } from "@/components/kanban/Droppable";
import { Draggable } from "@/components/kanban/Draggable";
import { SwimLane } from "@/components/kanban/SwimLane";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { KanbanFunnel } from "@/components/kanban/KanbanFunnel";
import { Opportunity, OpportunityStage as Stage, stageColors, stageLabels, stages } from "./opportunities-data";
type OpportunityStage = Stage;

export default function OpportunitiesPipeline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context } = useCRM();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [probabilityFilter, setProbabilityFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'probability' | 'value' | 'account'>('none');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [franchiseFilter, setFranchiseFilter] = useState<string>("all");
  const [createdFrom, setCreatedFrom] = useState<string>("");
  const [createdTo, setCreatedTo] = useState<string>("");

  // Advanced filters
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // WIP limits
  const [wipLimits, setWipLimits] = useState<Record<OpportunityStage, number>>({
    prospecting: 30,
    qualification: 20,
    needs_analysis: 15,
    value_proposition: 12,
    proposal: 10,
    negotiation: 8,
    closed_won: 999,
    closed_lost: 999,
  });

  // Card customization
  const [showFields, setShowFields] = useState({
    account: true,
    contact: true,
    amount: true,
    probability: true,
    closeDate: true,
  });

  // Bulk operations
  const [selectedOpportunities, setSelectedOpportunities] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchOpportunities();
    fetchAccounts();
  }, []);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("opportunities")
        .select(`
          *,
          accounts:account_id(name),
          contacts:contact_id(first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (!context.isPlatformAdmin) {
        if (context.franchiseId) query = query.eq("franchise_id", context.franchiseId);
        else if (context.tenantId) query = query.eq("tenant_id", context.tenantId as string);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOpportunities((data || []) as Opportunity[]);
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      toast({
        title: "Error",
        description: "Failed to fetch opportunities",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      let query = supabase
        .from("accounts")
        .select("id, name")
        .limit(100)
        .order("name");
      if (!context.isPlatformAdmin) {
        if (context.franchiseId) query = query.eq("franchise_id", context.franchiseId);
        else if (context.tenantId) query = query.eq("tenant_id", context.tenantId as string);
      }
      const { data, error } = await query;

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const handleStageChange = async (opportunityId: string, newStage: Stage) => {
    try {
      const { error } = await supabase
        .from("opportunities")
        .update({ stage: newStage })
        .eq("id", opportunityId);

      if (error) throw error;

      setOpportunities((prev) =>
        prev.map((opportunity) =>
          opportunity.id === opportunityId ? { ...opportunity, stage: newStage } : opportunity
        )
      );

      toast({
        title: "Success",
        description: "Opportunity stage updated",
      });
    } catch (error) {
      console.error("Error updating opportunity stage:", error);
      toast({
        title: "Error",
        description: "Failed to update opportunity stage",
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

    const opportunityId = active.id as string;
    const newStage = over.id as Stage;

    const opportunity = opportunities.find((o) => o.id === opportunityId);
    if (!opportunity || opportunity.stage === newStage) return;

    handleStageChange(opportunityId, newStage);
  };

  const filteredOpportunities = opportunities.filter((opportunity) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      opportunity.name.toLowerCase().includes(searchLower) ||
      opportunity.accounts?.name?.toLowerCase().includes(searchLower);

    const matchesProbability =
      probabilityFilter === "all" ||
      (probabilityFilter === "high" && (opportunity.probability || 0) >= 70) ||
      (probabilityFilter === "medium" && (opportunity.probability || 0) >= 40 && (opportunity.probability || 0) < 70) ||
      (probabilityFilter === "low" && (opportunity.probability || 0) < 40);

    const matchesAccount = accountFilter === "all" || opportunity.account_id === accountFilter;

    const matchesFranchise = franchiseFilter === "all" || opportunity.franchise_id === franchiseFilter;

    // Amount range filter
    const amount = opportunity.amount || 0;
    const matchesMinAmount = !minAmount || amount >= parseFloat(minAmount);
    const matchesMaxAmount = !maxAmount || amount <= parseFloat(maxAmount);

    // Date range filter
    const closeDate = opportunity.close_date ? new Date(opportunity.close_date) : null;
    const matchesDateFrom = !dateFrom || (closeDate && closeDate >= new Date(dateFrom));
    const matchesDateTo = !dateTo || (closeDate && closeDate <= new Date(dateTo));

    const createdAt = new Date(opportunity.created_at);
    const matchesCreatedFrom = !createdFrom || createdAt >= new Date(createdFrom);
    const matchesCreatedTo = !createdTo || createdAt <= new Date(createdTo);

    return matchesSearch && matchesProbability && matchesAccount && matchesFranchise && matchesMinAmount && matchesMaxAmount && matchesDateFrom && matchesDateTo && matchesCreatedFrom && matchesCreatedTo;
  });

  const toggleOpportunitySelection = (opportunityId: string) => {
    setSelectedOpportunities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(opportunityId)) {
        newSet.delete(opportunityId);
      } else {
        newSet.add(opportunityId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedOpportunities.size === 0) return;

    try {
      const { error } = await supabase
        .from("opportunities")
        .delete()
        .in("id", Array.from(selectedOpportunities));

      if (error) throw error;

      setOpportunities(prev => prev.filter(o => !selectedOpportunities.has(o.id)));
      setSelectedOpportunities(new Set());

      toast({
        title: "Success",
        description: `Deleted ${selectedOpportunities.size} opportunity(ies)`,
      });
    } catch (error) {
      console.error("Error deleting opportunities:", error);
      toast({
        title: "Error",
        description: "Failed to delete opportunities",
        variant: "destructive",
      });
    }
  };

  const handleBulkStageChange = async (newStage: Stage) => {
    if (selectedOpportunities.size === 0) return;

    try {
      const { error } = await supabase
        .from("opportunities")
        .update({ stage: newStage })
        .in("id", Array.from(selectedOpportunities));

      if (error) throw error;

      setOpportunities(prev => prev.map(o =>
        selectedOpportunities.has(o.id) ? { ...o, stage: newStage } : o
      ));
      setSelectedOpportunities(new Set());

      toast({
        title: "Success",
        description: `Updated ${selectedOpportunities.size} opportunity(ies)`,
      });
    } catch (error) {
      console.error("Error updating opportunities:", error);
      toast({
        title: "Error",
        description: "Failed to update opportunities",
        variant: "destructive",
      });
    }
  };

  const groupedOpportunities = stages.reduce((acc, stage) => {
    acc[stage] = filteredOpportunities.filter((opportunity) => opportunity.stage === stage);
    return acc;
  }, {} as Record<Stage, Opportunity[]>);

  // Group opportunities by swim lane
  const getSwimLanes = () => {
    if (groupBy === 'none') {
      return [{ id: 'all', title: 'All Opportunities', opportunities: filteredOpportunities }];
    }

    if (groupBy === 'probability') {
      return [
        {
          id: 'high',
          title: 'High Probability (70%+)',
          opportunities: filteredOpportunities.filter(o => (o.probability || 0) >= 70)
        },
        {
          id: 'medium',
          title: 'Medium Probability (40-69%)',
          opportunities: filteredOpportunities.filter(o => (o.probability || 0) >= 40 && (o.probability || 0) < 70)
        },
        {
          id: 'low',
          title: 'Low Probability (<40%)',
          opportunities: filteredOpportunities.filter(o => (o.probability || 0) < 40)
        },
      ].filter(lane => lane.opportunities.length > 0);
    }

    if (groupBy === 'value') {
      return [
        {
          id: 'high-value',
          title: 'High Value ($100K+)',
          opportunities: filteredOpportunities.filter(o => (o.amount || 0) >= 100000)
        },
        {
          id: 'mid-value',
          title: 'Mid Value ($25K-$100K)',
          opportunities: filteredOpportunities.filter(o => (o.amount || 0) >= 25000 && (o.amount || 0) < 100000)
        },
        {
          id: 'low-value',
          title: 'Low Value (<$25K)',
          opportunities: filteredOpportunities.filter(o => (o.amount || 0) < 25000)
        },
      ].filter(lane => lane.opportunities.length > 0);
    }

    if (groupBy === 'account') {
      const unassigned = {
        id: 'unassigned',
        title: 'Unassigned',
        opportunities: filteredOpportunities.filter(o => !o.account_id)
      };

      const accountGroups = accounts.map(account => ({
        id: account.id,
        title: account.name,
        opportunities: filteredOpportunities.filter(o => o.account_id === account.id)
      })).filter(g => g.opportunities.length > 0);

      return [unassigned, ...accountGroups].filter(lane => lane.opportunities.length > 0);
    }

    return [{ id: 'all', title: 'All Opportunities', opportunities: filteredOpportunities }];
  };

  const swimLanes = getSwimLanes();

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const activeOpportunity = activeId ? opportunities.find((o) => o.id === activeId) : null;

  // Multi-stage selection with deep-linking via `stage` query param
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStagesParam = searchParams.get('stage');
  const initialSelectedStages = (initialStagesParam ? initialStagesParam.split(',') : [])
    .filter((s): s is Stage => (stages as string[]).includes(s));
  const [selectedStages, setSelectedStages] = useState<Stage[]>(initialSelectedStages);

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

  useEffect(() => {
    const acc = searchParams.get('account');
    const fr = searchParams.get('franchise');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (acc) setAccountFilter(acc);
    if (fr) setFranchiseFilter(fr);
    if (from) setCreatedFrom(from);
    if (to) setCreatedTo(to);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Opportunities Pipeline</h1>
            <p className="text-muted-foreground">
              Manage opportunities through stages
              {(() => {
                const selectedTotal = selectedStages.length
                  ? selectedStages.reduce((acc, s) => acc + (groupedOpportunities[s]?.length || 0), 0)
                  : filteredOpportunities.length;
                const fullTotal = filteredOpportunities.length;
                return (
                  <span className="ml-2 text-xs">
                    {selectedStages.length > 0 ? `Selected: ${selectedTotal} of ${fullTotal}` : `Total: ${fullTotal}`}
                  </span>
                );
              })()}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/opportunities")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </div>

        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {(() => {
                  const labelMap: Record<Stage, string> = Object.fromEntries(
                    stages.map((s) => [s, stageLabels[s]])
                  ) as Record<Stage, string>;
                  const colorMap: Record<Stage, string> = Object.fromEntries(
                    stages.map((s) => [s, stageColors[s]])
                  ) as Record<Stage, string>;
                  const baseCountMap: Record<Stage, number> = Object.fromEntries(
                    stages.map((s) => [s, (groupedOpportunities[s]?.length || 0)])
                  ) as Record<Stage, number>;
                  const countMap: Record<Stage, number> = selectedStages.length > 0
                    ? Object.fromEntries(stages.map((s) => [s, selectedStages.includes(s) ? baseCountMap[s] : 0])) as Record<Stage, number>
                    : baseCountMap;
                  const totalCount = selectedStages.length > 0
                    ? selectedStages.reduce((acc, s) => acc + baseCountMap[s], 0)
                    : filteredOpportunities.length;

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
                {/* Main Filters */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search opportunities..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={probabilityFilter} onValueChange={setProbabilityFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Probability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Probabilities</SelectItem>
                      <SelectItem value="high">High (70%+)</SelectItem>
                      <SelectItem value="medium">Medium (40-69%)</SelectItem>
                      <SelectItem value="low">Low (&lt;40%)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={accountFilter} onValueChange={setAccountFilter}>
                    <SelectTrigger className="w-full md:w-[200px]">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                    <SelectTrigger className="w-full md:w-[200px]">
                      <Layers className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Group By" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Grouping</SelectItem>
                      <SelectItem value="probability">By Probability</SelectItem>
                      <SelectItem value="value">By Value</SelectItem>
                      <SelectItem value="account">By Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Advanced Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Min Amount ($)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Max Amount ($)</Label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Close From</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Close To</Label>
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
                        setSelectedOpportunities(new Set());
                      }}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      {bulkMode ? "Cancel Selection" : "Bulk Select"}
                    </Button>

                    {bulkMode && selectedOpportunities.size > 0 && (
                      <>
                        <Badge variant="secondary">{selectedOpportunities.size} selected</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleBulkDelete}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                        <Select onValueChange={handleBulkStageChange}>
                          <SelectTrigger className="w-[200px] h-9">
                            <SelectValue placeholder="Change Stage" />
                          </SelectTrigger>
                          <SelectContent>
{(selectedStages.length ? selectedStages : stages).map(stage => (
                              <SelectItem key={stage} value={stage}>
                                {stageLabels[stage]}
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
                                {field.replace(/([A-Z])/g, ' $1').trim()}
                              </Label>
                            </div>
                          ))}
                        </div>
                        <Separator />
                        <h4 className="font-medium">WIP Limits</h4>
                        <div className="space-y-2">
                          {stages.slice(0, 6).map(stage => (
                            <div key={stage} className="flex items-center justify-between">
                              <Label className="text-xs">{stageLabels[stage]}</Label>
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
            <div className="text-center py-12">Loading opportunities...</div>
          ) : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="space-y-4">
                {swimLanes.map((lane) => {
                  const laneGroupedOpportunities = stages.reduce((acc, stage) => {
                    acc[stage] = lane.opportunities.filter((opportunity) => opportunity.stage === stage);
                    return acc;
                  }, {} as Record<Stage, Opportunity[]>);

                  const totalValue = lane.opportunities.reduce((sum, opp) => sum + (opp.amount || 0), 0);
                  const avgProbability = lane.opportunities.length > 0
                    ? Math.round(lane.opportunities.reduce((sum, opp) => sum + (opp.probability || 0), 0) / lane.opportunities.length)
                    : 0;

                  return (
                    <SwimLane
                      key={lane.id}
                      id={lane.id}
                      title={lane.title}
                      count={lane.opportunities.length}
                      metrics={[
                        { label: 'Total Value', value: formatCurrency(totalValue) },
                        { label: 'Avg Probability', value: `${avgProbability}%` },
                      ]}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
{(selectedStages.length ? selectedStages : stages).map((stage) => (
                          <Droppable key={stage} id={stage}>
                            <Card className="h-full transition-all duration-200 hover:shadow-md">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center justify-between">
                                  <span>{stageLabels[stage]}</span>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="secondary"
                                      className={`${stageColors[stage]} transition-all duration-200`}
                                    >
                                      {laneGroupedOpportunities[stage].length}
                                    </Badge>
                                    {wipLimits[stage] < 999 && laneGroupedOpportunities[stage].length >= wipLimits[stage] && (
                                      <AlertCircle className="h-4 w-4 text-destructive" />
                                    )}
                                  </div>
                                </CardTitle>
                                {wipLimits[stage] < 999 && (
                                  <div className="text-xs text-muted-foreground">
                                    Limit: {wipLimits[stage]}
                                    {laneGroupedOpportunities[stage].length > wipLimits[stage] && (
                                      <span className="text-destructive ml-1">
                                        (+{laneGroupedOpportunities[stage].length - wipLimits[stage]} over)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </CardHeader>
                              <CardContent className="space-y-2 min-h-[200px]">
                                {laneGroupedOpportunities[stage].map((opportunity) => (
                                  <Draggable key={opportunity.id} id={opportunity.id}>
                                    <Card
                                      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 animate-fade-in relative"
                                      onClick={(e) => {
                                        if (bulkMode) {
                                          e.stopPropagation();
                                          toggleOpportunitySelection(opportunity.id);
                                        } else {
                                          navigate(`/dashboard/opportunities/${opportunity.id}`);
                                        }
                                      }}
                                    >
                                      <CardContent className="p-3 space-y-2">
                                        {bulkMode && (
                                          <div className="absolute top-2 right-2 z-10">
                                            {selectedOpportunities.has(opportunity.id) ? (
                                              <CheckSquare className="h-4 w-4 text-primary" />
                                            ) : (
                                              <Square className="h-4 w-4 text-muted-foreground" />
                                            )}
                                          </div>
                                        )}
                                        <div className="font-medium text-sm">{opportunity.name}</div>
                                        {showFields.account && opportunity.accounts?.name && (
                                          <div className="text-xs text-muted-foreground">{opportunity.accounts.name}</div>
                                        )}
                                        {showFields.contact && opportunity.contacts && (
                                          <div className="text-xs text-muted-foreground">
                                            {opportunity.contacts.first_name} {opportunity.contacts.last_name}
                                          </div>
                                        )}
                                        {showFields.amount && opportunity.amount && (
                                          <div className="text-xs font-semibold text-primary">
                                            {formatCurrency(opportunity.amount)}
                                          </div>
                                        )}
                                        {showFields.probability && opportunity.probability !== null && (
                                          <Badge
                                            variant="outline"
                                            className={`transition-all duration-200 ${
                                              opportunity.probability >= 70
                                                ? "bg-green-500/10 hover:bg-green-500/20"
                                                : opportunity.probability >= 40
                                                ? "bg-yellow-500/10 hover:bg-yellow-500/20"
                                                : "bg-red-500/10 hover:bg-red-500/20"
                                            }`}
                                          >
                                            {opportunity.probability}% chance
                                          </Badge>
                                        )}
                                        {showFields.closeDate && opportunity.close_date && (
                                          <div className="text-xs text-muted-foreground">
                                            Close: {formatDate(opportunity.close_date)}
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  </Draggable>
                                ))}
                                {laneGroupedOpportunities[stage].length === 0 && (
                                  <div className="text-xs text-muted-foreground text-center py-4">
                                    No opportunities in this stage
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
                {activeOpportunity ? (
                  <Card className="w-64 shadow-2xl rotate-3 scale-105 border-2 border-primary animate-scale-in">
                    <CardContent className="p-3 space-y-2 bg-gradient-to-br from-background to-muted">
                      <div className="font-medium text-sm">{activeOpportunity.name}</div>
                      {activeOpportunity.accounts?.name && (
                        <div className="text-xs text-muted-foreground">{activeOpportunity.accounts.name}</div>
                      )}
                      {activeOpportunity.amount && (
                        <div className="text-xs font-semibold text-primary">
                          {formatCurrency(activeOpportunity.amount)}
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