import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter, Package, MapPin, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Droppable } from "@/components/kanban/Droppable";
import { Draggable } from "@/components/kanban/Draggable";
import { SwimLane } from "@/components/kanban/SwimLane";

type ShipmentStatus = 'draft' | 'confirmed' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'customs' | 'cancelled' | 'on_hold' | 'returned';

interface Shipment {
  id: string;
  shipment_number: string;
  status: ShipmentStatus;
  origin_address: any;
  destination_address: any;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  total_weight_kg: number | null;
  total_packages: number | null;
  total_charges: number | null;
  currency: string | null;
  current_location: any;
  priority_level: string | null;
  created_at: string;
}

interface Carrier {
  id: string;
  carrier_name: string;
}

const statusConfig: Record<ShipmentStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-500/10 text-gray-700 dark:text-gray-300" },
  confirmed: { label: "Confirmed", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  in_transit: { label: "In Transit", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  out_for_delivery: { label: "Out for Delivery", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" },
  delivered: { label: "Delivered", color: "bg-green-500/10 text-green-700 dark:text-green-300" },
  customs: { label: "Customs", color: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-700 dark:text-red-300" },
  on_hold: { label: "On Hold", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  returned: { label: "Returned", color: "bg-pink-500/10 text-pink-700 dark:text-pink-300" },
};

const stages: ShipmentStatus[] = ['draft', 'confirmed', 'in_transit', 'out_for_delivery', 'delivered', 'customs', 'cancelled', 'on_hold'];

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch shipments
      const { data: shipmentsData, error: shipmentsError } = await supabase
        .from("shipments")
        .select("*")
        .order("created_at", { ascending: false });

      if (shipmentsError) throw shipmentsError;
      setShipments(shipmentsData || []);

      // Fetch carriers
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
  };

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

  const getLocationString = (address: any): string => {
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

    return matchesSearch && matchesOrigin && matchesDestination && matchesPriority;
  });

  const groupedShipments = stages.reduce((acc, stage) => {
    acc[stage] = filteredShipments.filter((shipment) => shipment.status === stage);
    return acc;
  }, {} as Record<ShipmentStatus, Shipment[]>);

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

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
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
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
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
                      {stages.map((stage) => (
                        <Droppable key={stage} id={stage}>
                          <Card className="h-full">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span>{statusConfig[stage].label}</span>
                                <Badge variant="secondary" className={statusConfig[stage].color}>
                                  {laneGroupedShipments[stage].length}
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {laneGroupedShipments[stage].map((shipment) => (
                                <Draggable key={shipment.id} id={shipment.id}>
                                  <Card
                                    className="cursor-pointer hover:shadow-md transition-shadow"
                                    onClick={() => navigate(`/dashboard/shipments/${shipment.id}`)}
                                  >
                                    <CardContent className="p-3 space-y-2">
                                      <div className="flex items-start justify-between">
                                        <div className="font-medium text-sm">{shipment.shipment_number}</div>
                                        {shipment.priority_level && (
                                          <Badge
                                            variant="outline"
                                            className={
                                              shipment.priority_level === "high"
                                                ? "bg-red-500/10"
                                                : shipment.priority_level === "medium"
                                                ? "bg-yellow-500/10"
                                                : "bg-blue-500/10"
                                            }
                                          >
                                            {shipment.priority_level}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground space-y-1">
                                        <div className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          <span>{getLocationString(shipment.origin_address)}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          <span>{getLocationString(shipment.destination_address)}</span>
                                        </div>
                                      </div>
                                      {shipment.total_packages && (
                                        <div className="flex items-center gap-1 text-xs">
                                          <Package className="h-3 w-3" />
                                          <span>{shipment.total_packages} packages</span>
                                        </div>
                                      )}
                                      {shipment.estimated_delivery_date && (
                                        <div className="text-xs text-muted-foreground">
                                          ETA: {formatDate(shipment.estimated_delivery_date)}
                                        </div>
                                      )}
                                      {shipment.total_charges && (
                                        <div className="text-xs font-semibold text-primary">
                                          {formatCurrency(shipment.total_charges, shipment.currency)}
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
                <Card className="w-64 shadow-lg rotate-3">
                  <CardContent className="p-3 space-y-2">
                    <div className="font-medium text-sm">{activeShipment.shipment_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {getLocationString(activeShipment.origin_address)} →{" "}
                      {getLocationString(activeShipment.destination_address)}
                    </div>
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
