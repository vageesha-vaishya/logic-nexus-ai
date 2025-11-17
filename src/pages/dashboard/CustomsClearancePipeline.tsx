import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Filter, Layers, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Droppable } from "@/components/kanban/Droppable";
import { Draggable } from "@/components/kanban/Draggable";
import { SwimLane } from "@/components/kanban/SwimLane";

type CustomsStage =
  | 'documents_pending'
  | 'documents_received'
  | 'review_entry_prep'
  | 'filed_with_customs'
  | 'awaiting_clearance'
  | 'examination_required'
  | 'cleared'
  | 'released_for_delivery';

interface Shipment {
  id: string;
  shipment_number: string | null;
  customer_name: string | null;
  service_type: string | null;
  origin: string | null;
  destination: string | null;
  customs_required: boolean | null;
}

interface TrackingEvent {
  id: string;
  shipment_id: string;
  event_type: string;
  created_at: string;
  notes: string | null;
}

interface CustomsDocument {
  id: string;
  shipment_id: string;
}

const stageLabels: Record<CustomsStage, string> = {
  documents_pending: '📄 Documents Pending',
  documents_received: '📋 Documents Received',
  review_entry_prep: '🔍 Review & Entry Prep',
  filed_with_customs: '📤 Filed with Customs',
  awaiting_clearance: '⏳ Awaiting Clearance',
  examination_required: '🔍 Examination Required',
  cleared: '✅ Cleared',
  released_for_delivery: '🚚 Released for Delivery',
};

const stageColors: Record<CustomsStage, string> = {
  documents_pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  documents_received: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  review_entry_prep: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  filed_with_customs: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  awaiting_clearance: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  examination_required: 'bg-red-500/10 text-red-700 dark:text-red-300',
  cleared: 'bg-green-500/10 text-green-700 dark:text-green-300',
  released_for_delivery: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
};

const stages: CustomsStage[] = [
  'documents_pending',
  'documents_received',
  'review_entry_prep',
  'filed_with_customs',
  'awaiting_clearance',
  'examination_required',
  'cleared',
  'released_for_delivery',
];

export default function CustomsClearancePipeline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [docs, setDocs] = useState<CustomsDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupBy, setGroupBy] = useState<'none' | 'service_type'>('none');
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: s, error: se } = await supabase
        .from('shipments')
        .select('id, shipment_number, account_id, service_level, origin_address, destination_address, customs_required')
        .order('shipment_number', { ascending: false })
        .limit(500);
      if (se) throw se;
      const mapped = (s || []).map((ship: any) => ({
        id: ship.id,
        shipment_number: ship.shipment_number,
        customer_name: null,
        service_type: ship.service_level,
        origin: null,
        destination: null,
        customs_required: ship.customs_required
      }));
      setShipments(mapped);
      const { data: e, error: ee } = await supabase
        .from('tracking_events')
        .select('id, shipment_id, event_type, created_at, notes')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (ee) throw ee;
      setEvents((e || []) as TrackingEvent[]);
      const { data: d, error: de } = await supabase
        .from('customs_documents')
        .select('id, shipment_id')
        .limit(5000);
      if (de) throw de;
      setDocs((d || []) as CustomsDocument[]);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to fetch customs data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const eventsByShipment = useMemo(() => {
    const m = new Map<string, TrackingEvent[]>();
    for (const e of events) {
      const arr = m.get(e.shipment_id) || [];
      arr.push(e);
      m.set(e.shipment_id, arr);
    }
    for (const [id, arr] of m.entries()) arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return m;
  }, [events]);

  const hasDocs = (shipmentId: string) => docs.some(d => d.shipment_id === shipmentId);

  const latestEventOf = (shipmentId: string, type: string) => {
    const arr = eventsByShipment.get(shipmentId) || [];
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].event_type === type) return arr[i];
    }
    return null;
  };

  const hasEvent = (shipmentId: string, type: string) => !!latestEventOf(shipmentId, type);

  const computeStage = (s: Shipment): CustomsStage => {
    if (!s.customs_required) return 'released_for_delivery';
    const exam = eventsByShipment.get(s.id)?.find(e => e.event_type === 'exception' && (e.notes || '').toLowerCase().includes('exam'));
    if (!hasDocs(s.id)) return 'documents_pending';
    if (!hasEvent(s.id, 'customs_clearance')) return 'review_entry_prep';
    if (exam) return 'examination_required';
    if (hasEvent(s.id, 'customs_clearance') && !hasEvent(s.id, 'customs_released')) return 'awaiting_clearance';
    if (hasEvent(s.id, 'customs_released') && !hasEvent(s.id, 'out_for_delivery')) return 'cleared';
    if (hasEvent(s.id, 'out_for_delivery')) return 'released_for_delivery';
    return 'filed_with_customs';
  };

  const filtered = shipments.filter((s) => {
    const q = searchQuery.toLowerCase();
    const str = `${s.shipment_number || ''} ${s.customer_name || ''} ${s.origin || ''} ${s.destination || ''}`.toLowerCase();
    return !searchQuery || str.includes(q);
  });

  const grouped: Record<CustomsStage, Shipment[]> = stages.reduce((acc, stage) => {
    acc[stage] = filtered.filter((s) => computeStage(s) === stage);
    return acc;
  }, {} as Record<CustomsStage, Shipment[]>);

  const getSwimLanes = () => {
    if (groupBy === 'none') return [{ id: 'all', title: 'All Shipments', items: filtered }];
    const st = new Map<string, Shipment[]>();
    for (const s of filtered) {
      const key = s.service_type || 'unknown';
      if (!st.has(key)) st.set(key, []);
      st.get(key)!.push(s);
    }
    return Array.from(st.entries()).map(([id, items]) => ({ id, title: id.toUpperCase(), items }));
  };

  const lanes = getSwimLanes();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customs Clearance</h1>
            <p className="text-muted-foreground">Pipeline for shipments requiring customs</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/shipments')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Shipments
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search shipments..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <Layers className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Group By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Grouping</SelectItem>
                    <SelectItem value="service_type">By Service Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">Loading shipments...</div>
        ) : (
          <DndContext sensors={sensors}>
            <div className="space-y-4">
              {lanes.map(lane => {
                const laneGrouped = stages.reduce((acc, stage) => {
                  acc[stage] = lane.items.filter(s => computeStage(s) === stage);
                  return acc;
                }, {} as Record<CustomsStage, Shipment[]>);

                return (
                  <SwimLane key={lane.id} id={lane.id} title={lane.title} count={lane.items.length}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8 gap-4">
                      {stages.map((stage) => (
                        <Droppable key={stage} id={stage}>
                          <Card className="h-full transition-all duration-200 hover:shadow-md">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span>{stageLabels[stage]}</span>
                                <Badge variant="secondary" className={`${stageColors[stage]} transition-all duration-200`}>{laneGrouped[stage].length}</Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 min-h-[200px]">
                              {laneGrouped[stage].map((s) => (
                                <Draggable key={s.id} id={s.id}>
                                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 animate-fade-in" onClick={() => navigate(`/dashboard/shipments/${s.id}`)}>
                                    <CardContent className="p-3 space-y-2">
                                      <div className="font-medium text-sm">{s.shipment_number || 'N/A'}</div>
                                      <div className="text-xs text-muted-foreground">{s.origin || ''} → {s.destination || ''}</div>
                                      {s.customer_name && (<div className="text-xs text-muted-foreground">{s.customer_name}</div>)}
                                    </CardContent>
                                  </Card>
                                </Draggable>
                              ))}
                              {laneGrouped[stage].length === 0 && (
                                <div className="text-xs text-muted-foreground text-center py-4">No shipments in this stage</div>
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
            <DragOverlay />
          </DndContext>
        )}
      </div>
    </DashboardLayout>
  );
}