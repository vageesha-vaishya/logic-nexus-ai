import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCRM } from "@/hooks/useCRM";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Search, Filter, Layers, Settings, CheckSquare, Square, AlertCircle, LayoutGrid, Download } from "lucide-react";
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

type AccountStage = 'new_account' | 'kyc_pending' | 'active' | 'vip' | 'payment_issues' | 'inactive' | 'blocked';
type AccountType = 'prospect' | 'customer' | 'partner' | 'vendor';
type AccountStatusDB = 'active' | 'inactive' | 'pending';

interface Account {
  id: string;
  name: string;
  account_type: AccountType | null;
  status: AccountStatusDB | null;
  industry: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  franchise_id: string | null;
}

const stageLabels: Record<AccountStage, string> = {
  new_account: '🆕 New Account',
  kyc_pending: '🔐 KYC Pending',
  active: '✅ Active',
  vip: '🌟 VIP/Premium',
  payment_issues: '⚠️ Payment Issues',
  inactive: '🛌 Inactive',
  blocked: '🚫 Blocked',
};

const stageColors: Record<AccountStage, string> = {
  new_account: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  kyc_pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  active: 'bg-green-500/10 text-green-700 dark:text-green-300',
  vip: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  payment_issues: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  inactive: 'bg-gray-500/10 text-gray-700 dark:text-gray-300',
  blocked: 'bg-red-500/10 text-red-700 dark:text-red-300',
};

const stages: AccountStage[] = ['new_account','kyc_pending','active','vip','payment_issues','inactive','blocked'];

export default function AccountsPipeline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context, scopedDb } = useCRM();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'type'>('none');
  const [franchiseFilter, setFranchiseFilter] = useState<string>('all');

  const [wipLimits, setWipLimits] = useState<Record<AccountStage, number>>({
    new_account: 50,
    kyc_pending: 50,
    active: 999,
    vip: 999,
    payment_issues: 999,
    inactive: 999,
    blocked: 999,
  });

  const [showFields, setShowFields] = useState({
    industry: true,
    phone: true,
    email: true,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await scopedDb
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAccounts((data || []) as unknown as Account[]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch accounts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const computeStage = (a: Account): AccountStage => {
    const status = (a.status || '').toLowerCase();
    const type = (a.account_type || '').toLowerCase();
    if (status === 'suspended') return 'blocked';
    if (status === 'inactive') return 'inactive';
    if (status === 'active' && type === 'customer') return 'active';
    if (status === 'active' && type === 'prospect') return 'active';
    if (status === 'pending' && type === 'prospect') return 'new_account';
    if (status === 'pending') return 'kyc_pending';
    return 'new_account';
  };

  const filtered = accounts.filter((a) => {
    const s = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || a.name.toLowerCase().includes(s) || (a.industry || '').toLowerCase().includes(s);
    const matchesType = typeFilter === 'all' || (a.account_type || '') === typeFilter;
    const matchesFranchise = franchiseFilter === 'all' || a.franchise_id === franchiseFilter;
    return matchesSearch && matchesType && matchesFranchise;
  });

  const grouped: Record<AccountStage, Account[]> = stages.reduce((acc, stage) => {
    acc[stage] = filtered.filter((a) => computeStage(a) === stage);
    return acc;
  }, {} as Record<AccountStage, Account[]>);

  const toggleSelection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleStageChange = async (accountId: string, newStage: AccountStage) => {
    const updates: { status: AccountStatusDB } = { status: 'pending' };
    if (newStage === 'blocked' || newStage === 'inactive') updates.status = 'inactive';
    else if (newStage === 'active' || newStage === 'vip') updates.status = 'active';
    else updates.status = 'pending';
    try {
      const { error } = await scopedDb.from('accounts').update(updates).eq('id', accountId);
      if (error) throw error;
      setAccounts((prev) => prev.map((a) => a.id === accountId ? { ...a, ...updates } : a));
      toast({ title: 'Success', description: 'Account stage updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update account', variant: 'destructive' });
    }
  };

  const handleBulkStageChange = async (newStage: AccountStage) => {
    if (selected.size === 0) return;
    try {
      const updates: { status: AccountStatusDB } = { status: 'pending' };
      if (newStage === 'blocked' || newStage === 'inactive') updates.status = 'inactive';
      else if (newStage === 'active' || newStage === 'vip') updates.status = 'active';
      else updates.status = 'pending';

      const { error } = await scopedDb
        .from('accounts')
        .update(updates)
        .in('id', Array.from(selected));

      if (error) throw error;

      setAccounts((prev) => prev.map((a) => selected.has(a.id) ? { ...a, ...updates } : a));
      toast({ title: 'Success', description: `${selected.size} accounts updated` });
      setSelected(new Set());
      setBulkMode(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update accounts', variant: 'destructive' });
    }
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const id = active.id as string;
    const newStage = over.id as AccountStage;
    const a = accounts.find((x) => x.id === id);
    if (!a) return;
    const currentStage = computeStage(a);
    if (currentStage === newStage) return;
    handleStageChange(id, newStage);
  };

  const activeAccount = activeId ? accounts.find((a) => a.id === activeId) : null;

  const getSwimLanes = () => {
    if (groupBy === 'none') return [{ id: 'all', title: 'All Accounts', items: filtered }];
    if (groupBy === 'type') {
      const prospect = filtered.filter(a => (a.account_type || '').toLowerCase() === 'prospect');
      const customer = filtered.filter(a => (a.account_type || '').toLowerCase() === 'customer');
      const partner = filtered.filter(a => (a.account_type || '').toLowerCase() === 'partner');
      const vendor = filtered.filter(a => (a.account_type || '').toLowerCase() === 'vendor');
      return [
        { id: 'prospect', title: 'Prospect', items: prospect },
        { id: 'customer', title: 'Customer', items: customer },
        { id: 'partner', title: 'Partner', items: partner },
        { id: 'vendor', title: 'Vendor', items: vendor },
      ].filter(l => l.items.length > 0);
    }
    return [{ id: 'all', title: 'All Accounts', items: filtered }];
  };

  const lanes = getSwimLanes();

  // Multi-stage selection with deep-linking via `stage` query param
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStagesParam = searchParams.get('stage');
  const initialSelectedStages = (initialStagesParam ? initialStagesParam.split(',') : [])
    .filter((s): s is AccountStage => (stages as string[]).includes(s));
  const [selectedStages, setSelectedStages] = useState<AccountStage[]>(initialSelectedStages);

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
    const fr = searchParams.get('franchise');
    if (fr) setFranchiseFilter(fr);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Accounts Pipeline</h1>
            <p className="text-muted-foreground">
              Lifecycle stages for customer accounts
              {(() => {
                const selectedTotal = selectedStages.length
                  ? selectedStages.reduce((acc, s) => acc + (grouped[s]?.length || 0), 0)
                  : filtered.length;
                const fullTotal = filtered.length;
                return (
                  <span className="ml-2 text-xs">
                    {selectedStages.length > 0 ? `Selected: ${selectedTotal} of ${fullTotal}` : `Total: ${fullTotal}`}
                  </span>
                );
              })()}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild className="mr-2">
            <Link to="/dashboard/accounts/import-export">
              <Download className="h-4 w-4 mr-2" />
              Import/Export
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/accounts")}> 
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {(() => {
                const labelMap: Record<AccountStage, string> = Object.fromEntries(
                  stages.map((s) => [s, stageLabels[s]])
                ) as Record<AccountStage, string>;
                const colorMap: Record<AccountStage, string> = Object.fromEntries(
                  stages.map((s) => [s, stageColors[s]])
                ) as Record<AccountStage, string>;
                const baseCountMap: Record<AccountStage, number> = Object.fromEntries(
                  stages.map((s) => [s, (grouped[s]?.length || 0)])
                ) as Record<AccountStage, number>;
                const countMap: Record<AccountStage, number> = selectedStages.length > 0
                  ? Object.fromEntries(stages.map((s) => [s, selectedStages.includes(s) ? baseCountMap[s] : 0])) as Record<AccountStage, number>
                  : baseCountMap;
                const totalCount = selectedStages.length > 0
                  ? selectedStages.reduce((acc, s) => acc + baseCountMap[s], 0)
                  : filtered.length;

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
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search accounts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <Layers className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Group By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="type">By Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Button variant={bulkMode ? "default" : "outline"} size="sm" onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    {bulkMode ? "Cancel Selection" : "Bulk Select"}
                  </Button>
                  
                  {bulkMode && selected.size > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-4">
                      <Separator orientation="vertical" className="h-6" />
                      <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                      <Select onValueChange={(v) => handleBulkStageChange(v as AccountStage)}>
                        <SelectTrigger className="w-[180px] h-8">
                          <SelectValue placeholder="Move to stage..." />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map((stage) => (
                            <SelectItem key={stage} value={stage}>{stageLabels[stage]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                            <Checkbox id={field} checked={show} onCheckedChange={(checked) => setShowFields(prev => ({ ...prev, [field]: !!checked }))} />
                            <Label htmlFor={field} className="capitalize">{field}</Label>
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <h4 className="font-medium">WIP Limits</h4>
                      <div className="space-y-2">
{(selectedStages.length ? selectedStages : stages).map(stage => (
                          <div key={stage} className="flex items-center justify-between">
                            <Label className="text-xs">{stageLabels[stage]}</Label>
                            <Input type="number" min="0" value={wipLimits[stage]} onChange={(e) => setWipLimits(prev => ({ ...prev, [stage]: parseInt(e.target.value) || 0 }))} className="w-20 h-8" />
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
          <div className="text-center py-12">Loading accounts...</div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="space-y-4">
              {lanes.map(lane => {
                const laneGrouped = stages.reduce((acc, stage) => {
                  acc[stage] = lane.items.filter(a => computeStage(a) === stage);
                  return acc;
                }, {} as Record<AccountStage, Account[]>);

                return (
                  <SwimLane key={lane.id} id={lane.id} title={lane.title} count={lane.items.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
{(selectedStages.length ? selectedStages : stages).map((stage) => (
                        <Droppable key={stage} id={stage}>
                          <Card className="h-full transition-all duration-200 hover:shadow-md">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span>{stageLabels[stage]}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className={`${stageColors[stage]} transition-all duration-200`}>{laneGrouped[stage].length}</Badge>
                                  {wipLimits[stage] < 999 && laneGrouped[stage].length >= wipLimits[stage] && (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                  )}
                                </div>
                              </CardTitle>
                              {wipLimits[stage] < 999 && (
                                <div className="text-xs text-muted-foreground">Limit: {wipLimits[stage]} {laneGrouped[stage].length > wipLimits[stage] && (<span className="text-destructive ml-1">(+{laneGrouped[stage].length - wipLimits[stage]} over)</span>)}
                                </div>
                              )}
                            </CardHeader>
                            <CardContent className="space-y-2 min-h-[200px]">
                              {laneGrouped[stage].map((a) => (
                                <Draggable key={a.id} id={a.id}>
                                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 animate-fade-in relative" onClick={() => navigate(`/dashboard/accounts/${a.id}`)}>
                                    <CardContent className="p-3 space-y-2">
                                      <div className="font-medium text-sm">{a.name}</div>
                                      {showFields.industry && a.industry && (<div className="text-xs text-muted-foreground">{a.industry}</div>)}
                                      {showFields.email && a.email && (<div className="text-xs text-muted-foreground">{a.email}</div>)}
                                      {showFields.phone && a.phone && (<div className="text-xs text-muted-foreground">{a.phone}</div>)}
                                    </CardContent>
                                  </Card>
                                </Draggable>
                              ))}
                              {laneGrouped[stage].length === 0 && (
                                <div className="text-xs text-muted-foreground text-center py-4">No accounts in this stage</div>
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
              {activeAccount ? (
                <Card className="w-64 shadow-2xl rotate-3 scale-105 border-2 border-primary animate-scale-in">
                  <CardContent className="p-3 space-y-2 bg-gradient-to-br from-background to-muted">
                    <div className="font-medium text-sm">{activeAccount.name}</div>
                    {activeAccount.industry && (<div className="text-xs text-muted-foreground">{activeAccount.industry}</div>)}
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </DashboardLayout>
  );
}