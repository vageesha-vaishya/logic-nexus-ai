import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useCRM } from "@/hooks/useCRM";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Filter, Layers, Settings, CheckSquare, Square, Trash2, AlertCircle, DollarSign } from "lucide-react";
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
import { Quote, QuoteStatus, statusConfig, stages } from "./quotes-data";

export default function QuotesPipeline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context, scopedDb } = useCRM();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'value' | 'margin' | 'account'>('none');
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [franchiseFilter, setFranchiseFilter] = useState<string>("all");

  // Advanced filters
  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");
  const [minMargin, setMinMargin] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // WIP limits
  const [wipLimits, setWipLimits] = useState<Record<QuoteStatus, number>>({
    draft: 50,
    pricing_review: 40,
    approved: 40,
    sent: 30,
    customer_reviewing: 30,
    revision_requested: 20,
    accepted: 999,
    rejected: 999,
    expired: 20,
  });

  // Card customization
  const [showFields, setShowFields] = useState({
    account: true,
    opportunity: true,
    value: true,
    margin: true,
    validUntil: true,
  });

  // Bulk operations
  const [selectedQuotes, setSelectedQuotes] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchQuotes();
    fetchAccounts();
  }, []);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await scopedDb
        .from("quotes")
        .select(`
          *,
          accounts:account_id(name),
          opportunities:opportunity_id(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuotes((data || []) as unknown as Quote[]);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      toast({
        title: "Error",
        description: "Failed to fetch quotes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const { data, error } = await scopedDb
        .from("accounts")
        .select("id, name")
        .limit(100)
        .order("name");

      if (error) throw error;
      setAccounts((data || []) as any);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const handleStatusChange = async (quoteId: string, newStatus: QuoteStatus) => {
    // Check WIP limits
    const limit = wipLimits[newStatus];
    const currentCount = quotes.filter((q) => q.status === newStatus).length;

    if (limit < 999 && currentCount >= limit) {
      toast({
        title: "WIP Limit Reached",
        description: `Cannot move to ${statusConfig[newStatus].label} (Limit: ${limit})`,
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await scopedDb
        .from("quotes")
        .update({ status: newStatus })
        .eq("id", quoteId);

      if (error) throw error;

      setQuotes((prev) =>
        prev.map((quote) =>
          quote.id === quoteId ? { ...quote, status: newStatus } : quote
        )
      );

      toast({
        title: "Success",
        description: "Quote status updated",
      });
    } catch (error) {
      console.error("Error updating quote status:", error);
      toast({
        title: "Error",
        description: "Failed to update quote status",
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

    const quoteId = active.id as string;
    const newStatus = over.id as QuoteStatus;

    const quote = quotes.find((q) => q.id === quoteId);
    if (!quote || quote.status === newStatus) return;

    handleStatusChange(quoteId, newStatus);
  };

  const filteredQuotes = quotes.filter((quote) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      quote.quote_number.toLowerCase().includes(searchLower) ||
      quote.title?.toLowerCase().includes(searchLower) ||
      quote.accounts?.name?.toLowerCase().includes(searchLower);

    const matchesAccount = accountFilter === "all" || quote.account_id === accountFilter;

    const matchesFranchise = franchiseFilter === "all" || quote.franchise_id === franchiseFilter;

    // Value range filter
    const quoteValue = quote.sell_price || 0;
    const matchesMinValue = !minValue || quoteValue >= parseFloat(minValue);
    const matchesMaxValue = !maxValue || quoteValue <= parseFloat(maxValue);

    // Margin filter
    const margin = quote.margin_amount || 0;
    const matchesMinMargin = !minMargin || margin >= parseFloat(minMargin);

    // Date range filter
    const quoteDate = new Date(quote.created_at);
    const matchesDateFrom = !dateFrom || quoteDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || quoteDate <= new Date(dateTo);


    return matchesSearch && matchesAccount && matchesFranchise && matchesMinValue && matchesMaxValue && matchesMinMargin && matchesDateFrom && matchesDateTo;
  });

  const toggleQuoteSelection = (quoteId: string) => {
    setSelectedQuotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(quoteId)) {
        newSet.delete(quoteId);
      } else {
        newSet.add(quoteId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedQuotes.size === 0) return;

    try {
      const { error } = await scopedDb
        .from("quotes")
        .delete()
        .in("id", Array.from(selectedQuotes));

      if (error) throw error;

      setQuotes(prev => prev.filter(q => !selectedQuotes.has(q.id)));
      setSelectedQuotes(new Set());

      toast({
        title: "Success",
        description: `Deleted ${selectedQuotes.size} quote(s)`,
      });
    } catch (error) {
      console.error("Error deleting quotes:", error);
      toast({
        title: "Error",
        description: "Failed to delete quotes",
        variant: "destructive",
      });
    }
  };

  const handleBulkStatusChange = async (newStatus: QuoteStatus) => {
    if (selectedQuotes.size === 0) return;

    try {
      const { error } = await scopedDb
        .from("quotes")
        .update({ status: newStatus })
        .in("id", Array.from(selectedQuotes));

      if (error) throw error;

      setQuotes(prev => prev.map(q =>
        selectedQuotes.has(q.id) ? { ...q, status: newStatus } : q
      ));
      setSelectedQuotes(new Set());

      toast({
        title: "Success",
        description: `Updated ${selectedQuotes.size} quote(s)`,
      });
    } catch (error) {
      console.error("Error updating quotes:", error);
      toast({
        title: "Error",
        description: "Failed to update quotes",
        variant: "destructive",
      });
    }
  };

  const groupedQuotes = stages.reduce((acc, stage) => {
    acc[stage] = filteredQuotes.filter((quote) => quote.status === stage);
    return acc;
  }, {} as Record<QuoteStatus, Quote[]>);

  // Group quotes by swim lane
  const getSwimLanes = () => {
    if (groupBy === 'none') {
      return [{ id: 'all', title: 'All Quotes', quotes: filteredQuotes }];
    }

    if (groupBy === 'value') {
      return [
        {
          id: 'high-value',
          title: 'High Value ($50K+)',
          quotes: filteredQuotes.filter(q => (q.sell_price || 0) >= 50000)
        },
        {
          id: 'mid-value',
          title: 'Mid Value ($10K-$50K)',
          quotes: filteredQuotes.filter(q => (q.sell_price || 0) >= 10000 && (q.sell_price || 0) < 50000)
        },
        {
          id: 'low-value',
          title: 'Low Value (<$10K)',
          quotes: filteredQuotes.filter(q => (q.sell_price || 0) > 0 && (q.sell_price || 0) < 10000)
        },
      ].filter(lane => lane.quotes.length > 0);
    }

    if (groupBy === 'margin') {
      return [
        {
          id: 'high-margin',
          title: 'High Margin (30%+)',
          quotes: filteredQuotes.filter(q => (q.margin_percentage || 0) >= 30)
        },
        {
          id: 'mid-margin',
          title: 'Mid Margin (15-30%)',
          quotes: filteredQuotes.filter(q => (q.margin_percentage || 0) >= 15 && (q.margin_percentage || 0) < 30)
        },
        {
          id: 'low-margin',
          title: 'Low Margin (<15%)',
          quotes: filteredQuotes.filter(q => (q.margin_percentage || 0) < 15)
        },
      ].filter(lane => lane.quotes.length > 0);
    }

    if (groupBy === 'account') {
      const unassigned = {
        id: 'unassigned',
        title: 'Unassigned',
        quotes: filteredQuotes.filter(q => !q.account_id)
      };

      const accountGroups = accounts.map(account => ({
        id: account.id,
        title: account.name,
        quotes: filteredQuotes.filter(q => q.account_id === account.id)
      })).filter(g => g.quotes.length > 0);

      return [unassigned, ...accountGroups].filter(lane => lane.quotes.length > 0);
    }

    return [{ id: 'all', title: 'All Quotes', quotes: filteredQuotes }];
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

  const activeQuote = activeId ? quotes.find((q) => q.id === activeId) : null;

  // Multi-stage selection with deep-linking via `stage` query param
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStagesParam = searchParams.get('stage');
  const initialSelectedStages = (initialStagesParam ? initialStagesParam.split(',') : [])
    .filter((s): s is QuoteStatus => (stages as string[]).includes(s));
  const [selectedStages, setSelectedStages] = useState<QuoteStatus[]>(initialSelectedStages);

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
    if (from) setDateFrom(from);
    if (to) setDateTo(to);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Quotes Pipeline</h1>
            <p className="text-muted-foreground">
              Manage quotes through stages
              {(() => {
                const selectedTotal = selectedStages.length
                  ? selectedStages.reduce((acc, s) => acc + (groupedQuotes[s]?.length || 0), 0)
                  : filteredQuotes.length;
                const fullTotal = filteredQuotes.length;
                return (
                  <span className="ml-2 text-xs">
                    {selectedStages.length > 0 ? `Selected: ${selectedTotal} of ${fullTotal}` : `Total: ${fullTotal}`}
                  </span>
                );
              })()}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/quotes")}>
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
                  const labelMap: Record<QuoteStatus, string> = Object.fromEntries(
                    stages.map((s) => [s, statusConfig[s].label])
                  ) as Record<QuoteStatus, string>;
                  const colorMap: Record<QuoteStatus, string> = Object.fromEntries(
                    stages.map((s) => [s, statusConfig[s].color])
                  ) as Record<QuoteStatus, string>;
                  const baseCountMap: Record<QuoteStatus, number> = Object.fromEntries(
                    stages.map((s) => [s, (groupedQuotes[s]?.length || 0)])
                  ) as Record<QuoteStatus, number>;
                  const countMap: Record<QuoteStatus, number> = selectedStages.length > 0
                    ? Object.fromEntries(stages.map((s) => [s, selectedStages.includes(s) ? baseCountMap[s] : 0])) as Record<QuoteStatus, number>
                    : baseCountMap;
                  const totalCount = selectedStages.length > 0
                    ? selectedStages.reduce((acc, s) => acc + baseCountMap[s], 0)
                    : filteredQuotes.length;

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
                      placeholder="Search quotes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={accountFilter} onValueChange={setAccountFilter}>
                    <SelectTrigger className="w-full md:w-[200px]">
                      <Filter className="h-4 w-4 mr-2" />
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
                      <SelectItem value="value">By Value</SelectItem>
                      <SelectItem value="margin">By Margin</SelectItem>
                      <SelectItem value="account">By Account</SelectItem>
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
                    <Label className="text-xs text-muted-foreground">Min Margin ($)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={minMargin}
                      onChange={(e) => setMinMargin(e.target.value)}
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
                </div>

                {/* Actions Bar */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={bulkMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setBulkMode(!bulkMode);
                        setSelectedQuotes(new Set());
                      }}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      {bulkMode ? "Cancel Selection" : "Bulk Select"}
                    </Button>

                    {bulkMode && selectedQuotes.size > 0 && (
                      <>
                        <Badge variant="secondary">{selectedQuotes.size} selected</Badge>
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
                                {field.replace(/([A-Z])/g, ' $1').trim()}
                              </Label>
                            </div>
                          ))}
                        </div>
                        <Separator />
                        <h4 className="font-medium">WIP Limits</h4>
                        <div className="space-y-2">
                          {stages.slice(0, 3).map(stage => (
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
            <div className="text-center py-12">Loading quotes...</div>
          ) : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="space-y-4">
                {swimLanes.map((lane) => {
                  const laneGroupedQuotes = stages.reduce((acc, stage) => {
                    acc[stage] = lane.quotes.filter((quote) => quote.status === stage);
                    return acc;
                  }, {} as Record<QuoteStatus, Quote[]>);

                  const totalValue = lane.quotes.reduce((sum, quote) => sum + (quote.sell_price || 0), 0);
                  const totalMargin = lane.quotes.reduce((sum, quote) => sum + (quote.margin_amount || 0), 0);

                  return (
                    <SwimLane
                      key={lane.id}
                      id={lane.id}
                      title={lane.title}
                      count={lane.quotes.length}
                      metrics={[
                        { label: 'Total Value', value: formatCurrency(totalValue) },
                        { label: 'Total Margin', value: formatCurrency(totalMargin) },
                      ]}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
                                      {laneGroupedQuotes[stage].length}
                                    </Badge>
                                    {wipLimits[stage] < 999 && laneGroupedQuotes[stage].length >= wipLimits[stage] && (
                                      <AlertCircle className="h-4 w-4 text-destructive" />
                                    )}
                                  </div>
                                </CardTitle>
                                {wipLimits[stage] < 999 && (
                                  <div className="text-xs text-muted-foreground">
                                    Limit: {wipLimits[stage]}
                                    {laneGroupedQuotes[stage].length > wipLimits[stage] && (
                                      <span className="text-destructive ml-1">
                                        (+{laneGroupedQuotes[stage].length - wipLimits[stage]} over)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </CardHeader>
                              <CardContent className="space-y-2 min-h-[200px]">
                                {laneGroupedQuotes[stage].map((quote) => (
                                  <Draggable key={quote.id} id={quote.id}>
                                    <Card
                                      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 animate-fade-in relative"
                                      onClick={(e) => {
                                        if (bulkMode) {
                                          e.stopPropagation();
                                          toggleQuoteSelection(quote.id);
                                        } else {
                                          navigate(`/dashboard/quotes/${quote.id}`);
                                        }
                                      }}
                                    >
                                      <CardContent className="p-3 space-y-2">
                                        {bulkMode && (
                                          <div className="absolute top-2 right-2 z-10">
                                            {selectedQuotes.has(quote.id) ? (
                                              <CheckSquare className="h-4 w-4 text-primary" />
                                            ) : (
                                              <Square className="h-4 w-4 text-muted-foreground" />
                                            )}
                                          </div>
                                        )}
                                        <div className="font-medium text-sm">{quote.quote_number}</div>
                                        {quote.title && (
                                          <div className="text-xs text-muted-foreground line-clamp-1">{quote.title}</div>
                                        )}
                                        {showFields.account && quote.accounts?.name && (
                                          <div className="text-xs text-muted-foreground">{quote.accounts.name}</div>
                                        )}
                                        {showFields.opportunity && quote.opportunities?.name && (
                                          <Badge variant="outline" className="text-xs">
                                            {quote.opportunities.name}
                                          </Badge>
                                        )}
                                        {showFields.value && quote.sell_price && (
                                          <div className="text-xs font-semibold text-primary flex items-center gap-1">
                                            <DollarSign className="h-3 w-3" />
                                            {formatCurrency(quote.sell_price)}
                                          </div>
                                        )}
                                        {showFields.margin && quote.margin_amount !== null && (
                                          <div className="text-xs text-muted-foreground">
                                            Margin: {formatCurrency(quote.margin_amount)}
                                            {quote.margin_percentage !== null && ` (${Math.round(quote.margin_percentage)}%)`}
                                          </div>
                                        )}
                                        {showFields.validUntil && quote.valid_until && (
                                          <div className="text-xs text-muted-foreground">
                                            Valid: {formatDate(quote.valid_until)}
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  </Draggable>
                                ))}
                                {laneGroupedQuotes[stage].length === 0 && (
                                  <div className="text-xs text-muted-foreground text-center py-4">
                                    No quotes in this stage
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
                {activeQuote ? (
                  <Card className="w-64 shadow-2xl rotate-3 scale-105 border-2 border-primary animate-scale-in">
                    <CardContent className="p-3 space-y-2 bg-gradient-to-br from-background to-muted">
                      <div className="font-medium text-sm">{activeQuote.quote_number}</div>
                      {activeQuote.title && (
                        <div className="text-xs text-muted-foreground">{activeQuote.title}</div>
                      )}
                      {activeQuote.sell_price && (
                        <div className="text-xs font-semibold text-primary">
                          {formatCurrency(activeQuote.sell_price)}
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