import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useCRM } from "@/hooks/useCRM";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter, Layers, Settings, CheckSquare, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SwimLane } from "@/components/kanban/SwimLane";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Quote, QuoteStatus, statusConfig, stages } from "./quotes-data";
import { QuickQuoteModal } from "@/components/sales/quick-quote/QuickQuoteModal";
import { QuotesKanbanBoard } from "@/components/sales/kanban/QuotesKanbanBoard";
import { QuotesList } from "@/components/sales/QuotesList";
import { QuoteAnalytics } from "@/components/sales/analytics/QuoteAnalytics";
import { Badge } from "@/components/ui/badge";
import { ViewToggle, ViewMode } from "@/components/ui/view-toggle";
import * as XLSX from 'xlsx';

export default function QuotesPipeline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { scopedDb, supabase } = useCRM();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<'none' | 'value' | 'margin' | 'account' | 'priority' | 'service' | 'region'>('none');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('quotesViewMode') as ViewMode) || 'board';
  });
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [franchiseFilter, setFranchiseFilter] = useState<string>("all");

  useEffect(() => {
    localStorage.setItem('quotesViewMode', viewMode);
  }, [viewMode]);

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

  const [selectedStages, setSelectedStages] = useState<QuoteStatus[]>([]);

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
          opportunities:opportunity_id(name),
          service_types:service_type_id(name),
          franchises:franchise_id(name)
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

  const deleteQuotes = async (quoteIds: string[]) => {
    if (!quoteIds.length) return;
    setLoading(true);

    try {
      // Use RPC for cascade delete to handle all dependent tables
      const { error } = await supabase.rpc('delete_quotes_cascade', {
        quote_ids: quoteIds
      });

      if (error) throw error;

      setQuotes(prev => prev.filter(q => !quoteIds.includes(q.id)));
      
      // Clear selection if any of the deleted quotes were selected
      setSelectedQuotes(prev => {
        const newSet = new Set(prev);
        quoteIds.forEach(id => newSet.delete(id));
        return newSet;
      });

      toast({
        title: "Success",
        description: `Successfully deleted ${quoteIds.length} quote(s)`,
      });
    } catch (err: any) {
        console.error('Delete failed:', err);
        toast({
          title: "Error",
          description: "Failed to delete quotes",
          variant: "destructive",
        });
    } finally {
        setLoading(false);
    }
  };

  const handlePurgeDrafts = () => {
    const draftIds = quotes.filter(q => (q.status || '').toLowerCase() === 'draft').map(q => q.id);
    if (draftIds.length === 0) {
        toast({
          title: "Info",
          description: "No draft quotes found to purge",
        });
        return;
    }
    if (confirm(`Are you sure you want to delete all ${draftIds.length} draft quotes? This action cannot be undone.`)) {
        deleteQuotes(draftIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQuotes.size === 0) return;
    await deleteQuotes(Array.from(selectedQuotes));
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
      setBulkMode(false);

      toast({
        title: "Success",
        description: `Updated ${selectedQuotes.size} quotes to ${statusConfig[newStatus].label}`,
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedQuotes(new Set(filteredQuotes.map(q => q.id)));
    } else {
      setSelectedQuotes(new Set());
    }
  };

  const handleExport = () => {
    const dataToExport = filteredQuotes.map(q => ({
      'Quote Number': q.quote_number,
      'Title': q.title,
      'Status': statusConfig[q.status]?.label || q.status,
      'Account': q.accounts?.name || 'N/A',
      'Value': q.sell_price,
      'Margin': q.margin_amount,
      'Margin %': q.margin_percentage,
      'Priority': q.priority || 'Medium',
      'Created At': new Date(q.created_at).toLocaleDateString(),
      'Valid Until': q.valid_until ? new Date(q.valid_until).toLocaleDateString() : 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quotes");
    XLSX.writeFile(wb, `quotes_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const swimLanes = (() => {
    if (groupBy === 'none') {
      return [{
        id: 'all',
        title: 'All Quotes',
        quotes: filteredQuotes
      }];
    }
    
    if (groupBy === 'account') {
      const groups: Record<string, Quote[]> = {};
      filteredQuotes.forEach(q => {
        const key = q.accounts?.name || 'Unknown Account';
        if (!groups[key]) groups[key] = [];
        groups[key].push(q);
      });
      return Object.entries(groups).map(([name, quotes]) => ({
        id: name,
        title: name,
        quotes
      }));
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

    if (groupBy === 'priority') {
      return [
        { id: 'high', title: 'High Priority', quotes: filteredQuotes.filter(q => q.priority === 'high') },
        { id: 'medium', title: 'Medium Priority', quotes: filteredQuotes.filter(q => !q.priority || q.priority === 'medium') },
        { id: 'low', title: 'Low Priority', quotes: filteredQuotes.filter(q => q.priority === 'low') },
      ].filter(lane => lane.quotes.length > 0);
    }

    if (groupBy === 'service') {
      const groups: Record<string, Quote[]> = {};
      filteredQuotes.forEach(q => {
        const key = q.service_types?.name || 'Other Services';
        if (!groups[key]) groups[key] = [];
        groups[key].push(q);
      });
      return Object.entries(groups).map(([name, quotes]) => ({
        id: name,
        title: name,
        quotes
      }));
    }

    if (groupBy === 'region') {
      const groups: Record<string, Quote[]> = {};
      filteredQuotes.forEach(q => {
        const key = q.franchises?.name || 'Headquarters';
        if (!groups[key]) groups[key] = [];
        groups[key].push(q);
      });
      return Object.entries(groups).map(([name, quotes]) => ({
        id: name,
        title: name,
        quotes
      }));
    }
    
    // Default fallback
    return [{
      id: 'all',
      title: 'All Quotes',
      quotes: filteredQuotes
    }];
  })();

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-4 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Quotes Pipeline</h2>
              <p className="text-muted-foreground">Manage your quote lifecycle</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle value={viewMode} onChange={setViewMode} modes={['board', 'list', 'analytics']} />
            <QuickQuoteModal />
          </div>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="flex items-center gap-2 flex-1 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search quotes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Filter className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-4">
                      <h4 className="font-medium">Filters</h4>
                      <div className="space-y-2">
                        <Label>Account</Label>
                        <Select value={accountFilter} onValueChange={setAccountFilter}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Account" />
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
                      </div>
                      {/* Add more filters as needed */}
                    </div>
                  </PopoverContent>
                </Popover>

                <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)} disabled={viewMode === 'list' || viewMode === 'analytics'}>
                  <SelectTrigger className="w-[180px]">
                    <Layers className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Group By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="service">Product / Service</SelectItem>
                    <SelectItem value="region">Region / Franchise</SelectItem>
                    <SelectItem value="value">Value Tier</SelectItem>
                    <SelectItem value="margin">Margin Tier</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button variant="outline" size="icon" onClick={handleExport} title="Export to Excel">
                    <Download className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 border-destructive/50" 
                  onClick={handlePurgeDrafts}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Purge Drafts
                </Button>

                <Button
                  variant={bulkMode ? "secondary" : "outline"}
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

                {viewMode === 'board' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Customize
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
                        <h4 className="font-medium">Visible Columns</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {stages.map(stage => (
                            <div key={stage} className="flex items-center space-x-2">
                              <Checkbox
                                id={`col-${stage}`}
                                checked={selectedStages.length === 0 || selectedStages.includes(stage)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedStages(prev => [...prev, stage]);
                                  } else {
                                    setSelectedStages(prev => prev.filter(s => s !== stage));
                                  }
                                }}
                              />
                              <Label htmlFor={`col-${stage}`} className="text-xs truncate">
                                {statusConfig[stage].label}
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
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Content */}
        {loading ? (
          <div className="text-center py-12">Loading quotes...</div>
        ) : viewMode === 'analytics' ? (
          <QuoteAnalytics quotes={filteredQuotes} />
        ) : viewMode === 'list' ? (
          <QuotesList
            quotes={filteredQuotes}
            selectedQuotes={selectedQuotes}
            onToggleSelection={toggleQuoteSelection}
            onSelectAll={handleSelectAll}
            bulkMode={bulkMode}
          />
        ) : (
          <div className="space-y-4">
            {swimLanes.map((lane) => {
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
                  <QuotesKanbanBoard
                    quotes={lane.quotes}
                    onStatusChange={handleStatusChange}
                    wipLimits={wipLimits}
                    bulkMode={bulkMode}
                    selectedQuotes={selectedQuotes}
                    onToggleSelection={toggleQuoteSelection}
                    onQuoteClick={(id) => navigate(`/dashboard/quotes/${id}`)}
                    visibleStages={selectedStages}
                    showFields={showFields}
                    className="flex flex-col gap-8 min-h-[800px]"
                  />
                </SwimLane>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
