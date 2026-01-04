import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Filter, Package, MapPin, Layers, Settings, CheckSquare, Square, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
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
import { Carrier, Shipment, ShipmentStatus, statusConfig, stages, Address } from "./shipments-data";

export default function ShipmentsPipeline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [originFilter, setOriginFilter] = useState<string>("");
  const [destinationFilter, setDestinationFilter] = useState<string>("");
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'priority' | 'carrier'>('none');
  const [selectedStages, setSelectedStages] = useState<ShipmentStatus[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Advanced filters
  const [minCharges, setMinCharges] = useState<string>("");
  const [maxCharges, setMaxCharges] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  
  // WIP limits
  const [wipLimits, setWipLimits] = useState<Record<ShipmentStatus, number>>({
    draft: 50,
    confirmed: 30,
    in_transit: 40,
    out_for_delivery: 20,
    delivered: 999,
    customs: 10,
    cancelled: 999,
    on_hold: 15,
    returned: 999,
  });
  
  // Card customization
  const [showFields, setShowFields] = useState({
    origin: true,
    destination: true,
    packages: true,
    weight: false,
    charges: true,
    deliveryDate: true,
  });
  
  // Bulk operations
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from("shipments")
        .select("*")
        .order("created_at", { ascending: false });

      if (shipmentsError) throw shipmentsError;
      (setShipments as any)(shipmentsData || []);

      const { data: carriersData, error: carriersError } = await supabase
        .from("carriers")
        .select("id, carrier_name")
        .eq("is_active", true);

      if (carriersError) throw carriersError;
      setCarriers(carriersData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch shipments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Initialize selected stages from URL
  useEffect(() => {
    const stagesParam = searchParams.get('stages');
    if (stagesParam) {
      const values = stagesParam
        .split(',')
        .map(s => s.trim())
        .filter((s): s is ShipmentStatus => (stages as string[]).includes(s));
      setSelectedStages(values);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist selected stages to URL
  useEffect(() => {
    if (selectedStages.length > 0) {
      setSearchParams({ stages: selectedStages.join(',') }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [selectedStages, setSearchParams]);


  const handleStatusChange = async (shipmentId: string, newStatus: ShipmentStatus) => {
    try {
      const { error } = await supabase
        .from("shipments")
        .update({ status: newStatus })
        .eq("id", shipmentId);

      if (error) throw error;

      setShipments((prev) =>
        prev.map((shipment) =>
          shipment.id === shipmentId ? { ...shipment, status: newStatus } : shipment
        )
      );

      toast({
        title: "Success",
        description: "Shipment status updated",
      });
    } catch (error) {
      console.error("Error updating shipment status:", error);
      toast({
        title: "Error",
        description: "Failed to update shipment status",
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

    const shipmentId = active.id as string;
    const newStatus = over.id as ShipmentStatus;

    const shipment = shipments.find((s) => s.id === shipmentId);
    if (!shipment || shipment.status === newStatus) return;

    handleStatusChange(shipmentId, newStatus);
  };

  const getLocationString = (address: Address | null): string => {
    if (!address) return "—";
    const city = address.city || "";
    const country = address.country || "";
    return [city, country].filter(Boolean).join(", ") || "—";
  };

  const filteredShipments = shipments.filter((shipment) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      shipment.shipment_number.toLowerCase().includes(searchLower) ||
      getLocationString(shipment.origin_address).toLowerCase().includes(searchLower) ||
      getLocationString(shipment.destination_address).toLowerCase().includes(searchLower);

    const matchesOrigin =
      !originFilter ||
      getLocationString(shipment.origin_address).toLowerCase().includes(originFilter.toLowerCase());

    const matchesDestination =
      !destinationFilter ||
      getLocationString(shipment.destination_address).toLowerCase().includes(destinationFilter.toLowerCase());

    const matchesPriority =
      priorityFilter === "all" || shipment.priority_level === priorityFilter;
    
    // Charges range filter
    const charges = shipment.total_charges || 0;
    const matchesMinCharges = !minCharges || charges >= parseFloat(minCharges);
    const matchesMaxCharges = !maxCharges || charges <= parseFloat(maxCharges);
    
    // Date range filter
    const shipmentDate = shipment.pickup_date ? new Date(shipment.pickup_date) : new Date(shipment.created_at);
    const matchesDateFrom = !dateFrom || shipmentDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || shipmentDate <= new Date(dateTo);

    return matchesSearch && matchesOrigin && matchesDestination && matchesPriority && matchesMinCharges && matchesMaxCharges && matchesDateFrom && matchesDateTo;
  });
  
  const toggleShipmentSelection = (shipmentId: string) => {
    setSelectedShipments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shipmentId)) {
        newSet.delete(shipmentId);
      } else {
        newSet.add(shipmentId);
      }
      return newSet;
    });
  };
  
  const handleBulkDelete = async () => {
    if (selectedShipments.size === 0) return;
    
    try {
      const { error } = await supabase
        .from("shipments")
        .delete()
        .in("id", Array.from(selectedShipments));
        
      if (error) throw error;
      
      setShipments(prev => prev.filter(s => !selectedShipments.has(s.id)));
      setSelectedShipments(new Set());
      
      toast({
        title: "Success",
        description: `Deleted ${selectedShipments.size} shipment(s)`,
      });
    } catch (error) {
      console.error("Error deleting shipments:", error);
      toast({
        title: "Error",
        description: "Failed to delete shipments",
        variant: "destructive",
      });
    }
  };
  
  const handleBulkStatusChange = async (newStatus: ShipmentStatus) => {
    if (selectedShipments.size === 0) return;
    
    try {
      const { error } = await supabase
        .from("shipments")
        .update({ status: newStatus })
        .in("id", Array.from(selectedShipments));
        
      if (error) throw error;
      
      setShipments(prev => prev.map(s => 
        selectedShipments.has(s.id) ? { ...s, status: newStatus } : s
      ));
      setSelectedShipments(new Set());
      
      toast({
        title: "Success",
        description: `Updated ${selectedShipments.size} shipment(s)`,
      });
    } catch (error) {
      console.error("Error updating shipments:", error);
      toast({
        title: "Error",
        description: "Failed to update shipments",
        variant: "destructive",
      });
    }
  };

  const handleBulkMarkPodReceived = async () => {
    if (selectedShipments.size === 0) return;
    try {
      const now = new Date().toISOString();
      const { error } = await (supabase as any)
        .from("shipments")
        .update({ pod_received: true, pod_received_at: now })
        .in("id", Array.from(selectedShipments));
      if (error) throw error;
      setShipments(prev => prev.map(s =>
        selectedShipments.has(s.id) ? { ...s, pod_received: true, pod_received_at: now } : s
      ));
      setSelectedShipments(new Set());
      toast({ title: "Success", description: "Marked POD received for selected shipments" });
    } catch (error) {
      console.error("Error marking POD received:", error);
      toast({ title: "Error", description: "Failed to mark POD received", variant: "destructive" });
    }
  };

  const handleMarkPodReceived = async (shipmentId: string) => {
    try {
      const now = new Date().toISOString();
      const { error } = await (supabase as any)
        .from("shipments")
        .update({ pod_received: true, pod_received_at: now })
        .eq("id", shipmentId);
      if (error) throw error;
      setShipments(prev => prev.map(s => s.id === shipmentId ? { ...s, pod_received: true, pod_received_at: now } : s));
      toast({ title: "Success", description: "POD marked received" });
    } catch (error) {
      console.error("Error marking POD received:", error);
      toast({ title: "Error", description: "Failed to mark POD received", variant: "destructive" });
    }
  };

  const groupedShipments = stages.reduce((acc, stage) => {
    acc[stage] = filteredShipments.filter((shipment) => shipment.status === stage);
    return acc;
  }, {} as Record<ShipmentStatus, Shipment[]>);

  // Maps for KanbanFunnel props
  const labelMap: Record<ShipmentStatus, string> = Object.fromEntries(
    stages.map((s) => [s, statusConfig[s].label])
  ) as Record<ShipmentStatus, string>;
  const colorMap: Record<ShipmentStatus, string> = Object.fromEntries(
    stages.map((s) => [s, statusConfig[s].color])
  ) as Record<ShipmentStatus, string>;
  const countMap: Record<ShipmentStatus, number> = Object.fromEntries(
    stages.map((s) => [
      s,
      selectedStages.length > 0
        ? (selectedStages.includes(s) ? groupedShipments[s].length : 0)
        : groupedShipments[s].length,
    ])
  ) as Record<ShipmentStatus, number>;

  type SortMode = 'default' | 'created_at' | 'pickup_date' | 'charges';

  // Per-stage sorting configuration
  const [stageSort, setStageSort] = useState<Record<ShipmentStatus, SortMode>>({
    draft: 'default',
    confirmed: 'default',
    in_transit: 'default',
    out_for_delivery: 'default',
    delivered: 'default',
    customs: 'default',
    cancelled: 'default',
    on_hold: 'default',
    returned: 'default',
  });

  // Group shipments by swim lane
  const getSwimLanes = () => {
    if (groupBy === 'none') {
      return [{ id: 'all', title: 'All Shipments', shipments: filteredShipments }];
    }

    if (groupBy === 'priority') {
      return [
        { 
          id: 'high', 
          title: 'High Priority', 
          shipments: filteredShipments.filter(s => s.priority_level === 'high') 
        },
        { 
          id: 'medium', 
          title: 'Medium Priority', 
          shipments: filteredShipments.filter(s => s.priority_level === 'medium') 
        },
        { 
          id: 'low', 
          title: 'Low Priority', 
          shipments: filteredShipments.filter(s => s.priority_level === 'low') 
        },
        { 
          id: 'no-priority', 
          title: 'No Priority Set', 
          shipments: filteredShipments.filter(s => !s.priority_level) 
        },
      ].filter(lane => lane.shipments.length > 0);
    }

    if (groupBy === 'carrier') {
      const carrierGroups = carriers.map(carrier => ({
        id: carrier.id,
        title: carrier.carrier_name,
        shipments: filteredShipments.filter(s => {
          // This would need a carrier_id field on shipments table
          // For now, we'll just group by all
          return true;
        })
      }));
      return [{ id: 'all', title: 'All Shipments', shipments: filteredShipments }];
    }

    return [{ id: 'all', title: 'All Shipments', shipments: filteredShipments }];
  };

  const swimLanes = getSwimLanes();

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (!amount) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
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

  const activeShipment = activeId ? shipments.find((s) => s.id === activeId) : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Shipments Pipeline</h1>
            <p className="text-muted-foreground">Track shipments through stages</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/shipments")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </div>

        <KanbanFunnel
          stages={stages}
          labels={labelMap}
          colors={colorMap}
          counts={countMap}
          total={filteredShipments.length}
          activeStages={selectedStages}
          onStageClick={(s) => setSelectedStages(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
          onClearStage={() => setSelectedStages([])}
        />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Main Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search shipments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter by origin..."
                    value={originFilter}
                    onChange={(e) => setOriginFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter by destination..."
                    value={destinationFilter}
                    onChange={(e) => setDestinationFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'none' | 'priority' | 'carrier')}>
                  <SelectTrigger>
                    <Layers className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Group By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="priority">By Priority</SelectItem>
                    <SelectItem value="carrier">By Carrier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Advanced Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Min Charges ($)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={minCharges}
                    onChange={(e) => setMinCharges(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Max Charges ($)</Label>
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={maxCharges}
                    onChange={(e) => setMaxCharges(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Pickup From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Pickup To</Label>
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
                      setSelectedShipments(new Set());
                    }}
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    {bulkMode ? "Cancel Selection" : "Bulk Select"}
                  </Button>
                  
                  {bulkMode && selectedShipments.size > 0 && (
                    <>
                      <Badge variant="secondary">{selectedShipments.size} selected</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkDelete}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkMarkPodReceived}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark POD Received
                      </Button>
                      <Select onValueChange={handleBulkStatusChange}>
                        <SelectTrigger className="w-[180px] h-9">
                          <SelectValue placeholder="Change Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map(stage => (
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
                        {stages.slice(0, 6).map(stage => (
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
          <div className="text-center py-12">Loading shipments...</div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="space-y-4">
              {swimLanes.map((lane) => {
                const laneGroupedShipments = stages.reduce((acc, stage) => {
                  acc[stage] = lane.shipments.filter((shipment) => shipment.status === stage);
                  return acc;
                }, {} as Record<ShipmentStatus, Shipment[]>);

                const totalCharges = lane.shipments.reduce((sum, s) => sum + (s.total_charges || 0), 0);
                const totalPackages = lane.shipments.reduce((sum, s) => sum + (s.total_packages || 0), 0);

                return (
                  <SwimLane
                    key={lane.id}
                    id={lane.id}
                    title={lane.title}
                    count={lane.shipments.length}
                    metrics={[
                      { label: 'Total Charges', value: formatCurrency(totalCharges, 'USD') },
                      { label: 'Packages', value: totalPackages },
                    ]}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
                      {(selectedStages.length > 0 ? selectedStages : stages).map((stage) => (
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
                                    {laneGroupedShipments[stage].length}
                                  </Badge>
                                  <Select value={stageSort[stage]} onValueChange={(v) => setStageSort(prev => ({ ...prev, [stage]: v as SortMode }))}>
                                    <SelectTrigger className="h-7 w-[120px] text-xs">
                                      <SelectValue placeholder="Sort" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="default">Default</SelectItem>
                                      <SelectItem value="created_at">Newest</SelectItem>
                                      <SelectItem value="pickup_date">Pickup Date</SelectItem>
                                      <SelectItem value="charges">Charges</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {wipLimits[stage] < 999 && laneGroupedShipments[stage].length >= wipLimits[stage] && (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                  )}
                                </div>
                              </CardTitle>
                              {wipLimits[stage] < 999 && (
                                <div className="text-xs text-muted-foreground">
                                  Limit: {wipLimits[stage]} 
                                  {laneGroupedShipments[stage].length > wipLimits[stage] && (
                                    <span className="text-destructive ml-1">
                                      (+{laneGroupedShipments[stage].length - wipLimits[stage]} over)
                                    </span>
                                  )}
                                </div>
                              )}
                            </CardHeader>
                            <CardContent className="space-y-2 min-h-[200px]">
                              {(() => {
                                const stageShipments = [...laneGroupedShipments[stage]];
                                const mode = stageSort[stage];
                                stageShipments.sort((a, b) => {
                                  switch (mode) {
                                    case 'pickup_date': {
                                      const ad = new Date(a.pickup_date || a.created_at).getTime();
                                      const bd = new Date(b.pickup_date || b.created_at).getTime();
                                      return ad - bd;
                                    }
                                    case 'charges': {
                                      const ac = a.total_charges || 0;
                                      const bc = b.total_charges || 0;
                                      return bc - ac; // high to low
                                    }
                                    case 'created_at': {
                                      const ac = new Date(a.created_at).getTime();
                                      const bc = new Date(b.created_at).getTime();
                                      return bc - ac; // newest first
                                    }
                                    default:
                                      return 0;
                                  }
                                });
                                return stageShipments;
                              })().map((shipment) => (
                                <Draggable key={shipment.id} id={shipment.id}>
                                  <Card
                                    className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 animate-fade-in relative"
                                    onClick={(e) => {
                                      if (bulkMode) {
                                        e.stopPropagation();
                                        toggleShipmentSelection(shipment.id);
                                      } else {
                                        navigate(`/dashboard/shipments/${shipment.id}`);
                                      }
                                    }}
                                  >
                                    <CardContent className="p-3 space-y-2">
                                      {bulkMode && (
                                        <div className="absolute top-2 right-2 z-10">
                                          {selectedShipments.has(shipment.id) ? (
                                            <CheckSquare className="h-4 w-4 text-primary" />
                                          ) : (
                                            <Square className="h-4 w-4 text-muted-foreground" />
                                          )}
                                        </div>
                                      )}
                                      <div className="flex items-start justify-between">
                                        <div className="font-medium text-sm">{shipment.shipment_number}</div>
                                        <div className="flex items-center gap-2">
                                          {!shipment.pod_received && shipment.status === 'delivered' && (
                                            <Badge className="bg-red-500/10 text-red-600">POD Pending</Badge>
                                          )}
                                          {shipment.priority_level && (
                                            <Badge
                                              variant="outline"
                                              className={`transition-all duration-200 ${
                                                shipment.priority_level === "high"
                                                  ? "bg-red-500/10 hover:bg-red-500/20"
                                                  : shipment.priority_level === "medium"
                                                  ? "bg-yellow-500/10 hover:bg-yellow-500/20"
                                                  : "bg-blue-500/10 hover:bg-blue-500/20"
                                              }`}
                                            >
                                              {shipment.priority_level}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      {showFields.origin && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          <span>{getLocationString(shipment.origin_address)}</span>
                                        </div>
                                      )}
                                      {showFields.destination && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          <span>{getLocationString(shipment.destination_address)}</span>
                                        </div>
                                      )}
                                      {showFields.packages && shipment.total_packages && (
                                        <div className="flex items-center gap-1 text-xs">
                                          <Package className="h-3 w-3" />
                                          <span>{shipment.total_packages} packages</span>
                                        </div>
                                      )}
                                      {showFields.weight && shipment.total_weight_kg && (
                                        <div className="text-xs text-muted-foreground">
                                          Weight: {shipment.total_weight_kg} kg
                                        </div>
                                      )}
                                      {showFields.charges && shipment.total_charges && (
                                        <div className="text-xs font-semibold text-primary">
                                          {formatCurrency(shipment.total_charges, shipment.currency)}
                                        </div>
                                      )}
                                      {showFields.deliveryDate && shipment.estimated_delivery_date && (
                                        <div className="text-xs text-muted-foreground">
                                          ETA: {formatDate(shipment.estimated_delivery_date)}
                                        </div>
                                      )}
                                      {shipment.total_charges && (
                                        <div className="text-xs font-semibold text-primary">
                                          {formatCurrency(shipment.total_charges, shipment.currency)}
                                        </div>
                                      )}
                                      {!shipment.pod_received && shipment.status === 'delivered' && (
                                        <div className="flex items-center justify-end">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={(e) => { e.stopPropagation(); handleMarkPodReceived(shipment.id); }}
                                          >
                                            <CheckCircle2 className="h-4 w-4 mr-1" /> Mark POD Received
                                          </Button>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                </Draggable>
                              ))}
                              {laneGroupedShipments[stage].length === 0 && (
                                <div className="text-xs text-muted-foreground text-center py-4">
                                  No shipments
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
              {activeShipment ? (
                <Card className="w-64 shadow-2xl rotate-3 scale-105 border-2 border-primary animate-scale-in">
                  <CardContent className="p-3 space-y-2 bg-gradient-to-br from-background to-muted">
                    <div className="font-medium text-sm">{activeShipment.shipment_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {getLocationString(activeShipment.origin_address)} →{" "}
                      {getLocationString(activeShipment.destination_address)}
                    </div>
                    {activeShipment.total_charges && (
                      <div className="text-xs font-semibold text-primary">
                        {formatCurrency(activeShipment.total_charges, activeShipment.currency)}
                      </div>
                    )}
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
