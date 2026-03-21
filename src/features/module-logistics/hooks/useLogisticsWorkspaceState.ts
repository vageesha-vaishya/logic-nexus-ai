import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import {
  applyOptimisticConnectorRetry,
  type CarrierConnectorDiagnostic,
  LOGISTICS_MODE_FIELD_SCHEMA,
  type LogisticsLegDraft,
  shouldRollbackConnectorRetry,
  validateLegDraft,
} from '../workspace/logisticsWorkspaceModel';

type ShipmentOption = {
  id: string;
  shipmentNumber: string;
  franchiseId: string | null;
  containerNumber: string | null;
  containerType: string | null;
};

type TrackingEvent = {
  id: string;
  eventType: string;
  eventDate: string;
  description: string | null;
  locationName: string | null;
  franchiseId: string | null;
};

type OperationalException = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'resolving' | 'resolved';
};

const initialDiagnostics: CarrierConnectorDiagnostic[] = [
  { id: 'carrier-p44', connector: 'Project44', status: 'healthy', lastHeartbeat: new Date().toISOString(), retryAttempts: 0, pendingJobs: 2 },
  { id: 'carrier-vizion', connector: 'Vizion', status: 'degraded', lastHeartbeat: new Date().toISOString(), retryAttempts: 1, pendingJobs: 5 },
  { id: 'carrier-freightos', connector: 'Freightos', status: 'down', lastHeartbeat: new Date().toISOString(), retryAttempts: 2, pendingJobs: 8 },
];

const initialExceptions: OperationalException[] = [
  { id: 'ex-delay', title: 'Transit SLA breach risk', severity: 'high', status: 'open' },
  { id: 'ex-docs', title: 'Missing customs manifest attachment', severity: 'medium', status: 'open' },
  { id: 'ex-gate', title: 'Gate-in timestamp not confirmed', severity: 'low', status: 'open' },
];

const initialLegs: LogisticsLegDraft[] = [
  {
    id: 'leg-1',
    mode: 'ocean',
    origin: 'Shanghai',
    destination: 'Long Beach',
    carrier: 'COSCO',
    departureAt: '2026-03-22T09:00:00.000Z',
    arrivalAt: '2026-04-09T14:00:00.000Z',
    vesselName: 'COSCO STAR',
    voyageNumber: 'CS-221',
    flightNumber: '',
    truckReference: '',
    railServiceCode: '',
  },
  {
    id: 'leg-2',
    mode: 'trucking',
    origin: 'Long Beach',
    destination: 'Phoenix',
    carrier: 'Prime Trucking',
    departureAt: '2026-04-10T09:00:00.000Z',
    arrivalAt: '2026-04-11T17:00:00.000Z',
    vesselName: '',
    voyageNumber: '',
    flightNumber: '',
    truckReference: 'TRK-9902',
    railServiceCode: '',
  },
];

export function useLogisticsWorkspaceState() {
  const { scopedDb, supabase, context } = useCRM();
  const [shipments, setShipments] = useState<ShipmentOption[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>('');
  const [franchiseFilter, setFranchiseFilter] = useState<string>(context.franchiseId ?? 'all');
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [legs, setLegs] = useState<LogisticsLegDraft[]>(initialLegs);
  const [legErrors, setLegErrors] = useState<Record<string, string[]>>({});
  const [diagnostics, setDiagnostics] = useState<CarrierConnectorDiagnostic[]>(initialDiagnostics);
  const [exceptions, setExceptions] = useState<OperationalException[]>(initialExceptions);
  const [actionState, setActionState] = useState<Record<string, 'idle' | 'pending' | 'rolled_back' | 'completed'>>({});

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoadingShipments(true);
      const { data, error } = await scopedDb
        .from('shipments')
        .select('id, shipment_number, franchise_id, container_number, container_type')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!active) return;
      if (error) {
        setShipments([]);
        setLoadingShipments(false);
        return;
      }
      const normalized: ShipmentOption[] = (data || []).map((row: any) => ({
        id: row.id,
        shipmentNumber: row.shipment_number,
        franchiseId: row.franchise_id ?? null,
        containerNumber: row.container_number ?? null,
        containerType: row.container_type ?? null,
      }));
      setShipments(normalized);
      if (normalized.length > 0) {
        setSelectedShipmentId((prev) => prev || normalized[0].id);
      }
      setLoadingShipments(false);
    };
    run();
    return () => {
      active = false;
    };
  }, [scopedDb]);

  useEffect(() => {
    if (!context.franchiseId) return;
    setFranchiseFilter(context.franchiseId);
  }, [context.franchiseId]);

  const fetchTrackingEvents = useCallback(async () => {
    if (!selectedShipmentId) {
      setTrackingEvents([]);
      return;
    }
    setTrackingLoading(true);
    let query = scopedDb
      .from('tracking_events')
      .select('id, event_type, event_date, description, location_name, franchise_id')
      .eq('shipment_id', selectedShipmentId)
      .order('event_date', { ascending: false })
      .limit(200);
    if (franchiseFilter !== 'all') {
      query = query.eq('franchise_id', franchiseFilter);
    }
    const { data, error } = await query;
    if (error) {
      setTrackingEvents([]);
      setTrackingLoading(false);
      return;
    }
    setTrackingEvents(
      (data || []).map((row: any) => ({
        id: row.id,
        eventType: row.event_type,
        eventDate: row.event_date,
        description: row.description ?? null,
        locationName: row.location_name ?? null,
        franchiseId: row.franchise_id ?? null,
      }))
    );
    setTrackingLoading(false);
  }, [franchiseFilter, scopedDb, selectedShipmentId]);

  useEffect(() => {
    fetchTrackingEvents();
  }, [fetchTrackingEvents]);

  useEffect(() => {
    if (!selectedShipmentId) return;
    const channel = supabase
      .channel(`logistics-tracking-stream-${selectedShipmentId}-${franchiseFilter}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tracking_events',
          filter: `shipment_id=eq.${selectedShipmentId}`,
        },
        (payload: any) => {
          const incoming = payload?.new;
          if (!incoming?.id) return;
          if (franchiseFilter !== 'all' && incoming.franchise_id !== franchiseFilter) return;
          const nextItem: TrackingEvent = {
            id: incoming.id,
            eventType: incoming.event_type,
            eventDate: incoming.event_date,
            description: incoming.description ?? null,
            locationName: incoming.location_name ?? null,
            franchiseId: incoming.franchise_id ?? null,
          };
          setTrackingEvents((prev) => {
            const idx = prev.findIndex((event) => event.id === nextItem.id);
            if (idx === -1) return [nextItem, ...prev].sort((a, b) => b.eventDate.localeCompare(a.eventDate));
            const copy = [...prev];
            copy[idx] = nextItem;
            return copy.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [franchiseFilter, selectedShipmentId, supabase]);

  const saveLeg = useCallback(async (legId: string) => {
    const target = legs.find((leg) => leg.id === legId);
    if (!target) return false;
    const validation = validateLegDraft(target);
    if (!validation.isValid) {
      setLegErrors((prev) => ({ ...prev, [legId]: validation.missingFields.map((field) => String(field)) }));
      return false;
    }
    setLegErrors((prev) => ({ ...prev, [legId]: [] }));
    return true;
  }, [legs]);

  const updateLegField = useCallback((legId: string, field: keyof LogisticsLegDraft, value: string) => {
    setLegs((prev) => prev.map((leg) => (leg.id === legId ? { ...leg, [field]: value } : leg)));
  }, []);

  const retryCarrierConnector = useCallback(async (connectorId: string) => {
    const current = diagnostics.find((item) => item.id === connectorId);
    if (!current) return;
    const before = current;
    const optimistic = applyOptimisticConnectorRetry(current);
    setActionState((prev) => ({ ...prev, [connectorId]: 'pending' }));
    setDiagnostics((prev) => prev.map((item) => (item.id === connectorId ? optimistic : item)));
    await Promise.resolve();
    if (shouldRollbackConnectorRetry(before)) {
      setDiagnostics((prev) => prev.map((item) => (item.id === connectorId ? before : item)));
      setActionState((prev) => ({ ...prev, [connectorId]: 'rolled_back' }));
      return;
    }
    setActionState((prev) => ({ ...prev, [connectorId]: 'completed' }));
  }, [diagnostics]);

  const resolveException = useCallback(async (exceptionId: string) => {
    const previous = exceptions.find((item) => item.id === exceptionId);
    if (!previous) return;
    setActionState((prev) => ({ ...prev, [exceptionId]: 'pending' }));
    setExceptions((prev) => prev.map((item) => (item.id === exceptionId ? { ...item, status: 'resolving' } : item)));
    await Promise.resolve();
    if (previous.severity === 'high') {
      setExceptions((prev) => prev.map((item) => (item.id === exceptionId ? previous : item)));
      setActionState((prev) => ({ ...prev, [exceptionId]: 'rolled_back' }));
      return;
    }
    setExceptions((prev) => prev.map((item) => (item.id === exceptionId ? { ...item, status: 'resolved' } : item)));
    setActionState((prev) => ({ ...prev, [exceptionId]: 'completed' }));
  }, [exceptions]);

  const selectedShipment = useMemo(
    () => shipments.find((shipment) => shipment.id === selectedShipmentId) ?? null,
    [selectedShipmentId, shipments]
  );

  const availableFranchises = useMemo(() => {
    const ids = shipments.map((item) => item.franchiseId).filter((value): value is string => Boolean(value));
    return Array.from(new Set(ids));
  }, [shipments]);

  const routeValidationSummary = useMemo(() => {
    const results = legs.map((leg) => validateLegDraft(leg));
    return {
      total: results.length,
      valid: results.filter((result) => result.isValid).length,
      invalid: results.filter((result) => !result.isValid).length,
    };
  }, [legs]);

  return {
    loadingShipments,
    shipments,
    selectedShipmentId,
    setSelectedShipmentId,
    selectedShipment,
    franchiseFilter,
    setFranchiseFilter,
    availableFranchises,
    trackingEvents,
    trackingLoading,
    legs,
    legErrors,
    updateLegField,
    saveLeg,
    modeSchema: LOGISTICS_MODE_FIELD_SCHEMA,
    diagnostics,
    retryCarrierConnector,
    exceptions,
    resolveException,
    actionState,
    routeValidationSummary,
  };
}
