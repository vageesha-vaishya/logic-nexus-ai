/**
 * React Query Hooks for AMRO Aircraft List
 * 
 * Provides hooks for fetching aircraft list from the real API
 * Used by Work Package Creation Wizard for aircraft selection
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

function useAuthHeaders(): HeadersInit | null {
  const { session } = useAuth();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export interface AircraftRecord {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  model_id: string | null;
  registration: string;
  tail_number: string | null;
  serial_number: string | null;
  aircraft_model: string | null;
  aircraft_type: string | null;
  engine_type: string | null;
  base_location: string | null;
  home_base: string | null;
  owner_name: string | null;
  status: string;
  is_active: boolean;
  station_code: string | null;
  is_low_utilization: boolean;
  created_at: string;
  updated_at: string;
}

export interface AircraftListResponse {
  records: AircraftRecord[];
  total: number;
}

const AIRCRAFT_KEY = ['amro', 'aircraft', 'list'] as const;

async function fetchAircraftList(headers: HeadersInit): Promise<AircraftListResponse> {
  const url = '/api/v2/amro/aircraft-dashboard?module=overview';
  const response = await fetch(url, { method: 'GET', headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch aircraft list: ${response.status}`);
  }

  const json = await response.json();

  // The aircraft-dashboard endpoint returns aircraft data in output.aircraft_status array
  // Each item has: { aircraft_id, registration, status, current_flight_hours, current_cycles }
  const aircraftStatusArray = json.output?.aircraft_status || json.output?.aircraft || json.data?.aircraft || json.data || [];
  const rawRecords = Array.isArray(aircraftStatusArray) ? aircraftStatusArray : [];

  let aircraftLookupById = new Map<string, Record<string, unknown>>();
  try {
    const fallbackResponse = await fetch('/api/v2/amro/master-data/aircraft?page=1&page_size=500', {
      method: 'GET',
      headers,
    });
    if (fallbackResponse.ok) {
      const fallbackJson = await fallbackResponse.json();
      const fallbackRows = fallbackJson.output?.records || fallbackJson.output?.data || fallbackJson.data || [];
      const fallbackPairs: Array<[string, Record<string, unknown>]> = (Array.isArray(fallbackRows) ? fallbackRows : [])
        .map((row: any): [string, Record<string, unknown>] => [String(row?.id || '').trim(), row as Record<string, unknown>])
        .filter(([id]: [string, Record<string, unknown>]) => id.length > 0);
      aircraftLookupById = new Map(
        fallbackPairs,
      );
    }
  } catch {
    // Best-effort fallback only. Keep dashboard response if master-data fetch fails.
  }

  const resolveModel = (dashboardRow: any, fallbackRow?: Record<string, unknown>) => {
    const fromDashboard = String(
      dashboardRow.aircraft_model
      || dashboardRow.model
      || dashboardRow.model_name
      || dashboardRow.assembly_model
      || dashboardRow.aircraftModel
      || '',
    ).trim();
    if (fromDashboard) return fromDashboard;
    const fromFallback = String(
      fallbackRow?.aircraft_model
      || fallbackRow?.model
      || fallbackRow?.model_name
      || fallbackRow?.assembly_model
      || fallbackRow?.aircraftModel
      || '',
    ).trim();
    return fromFallback || null;
  };

  // Map database columns to our interface
  const records: AircraftRecord[] = rawRecords.map((row: any) => {
    const aircraftId = String(row.aircraft_id || row.id || '').trim();
    const fallbackRow = aircraftLookupById.get(aircraftId);
    const aircraftModel = resolveModel(row, fallbackRow);
    return {
      id: aircraftId,
      tenant_id: String(row.tenant_id || fallbackRow?.tenant_id || ''),
      franchise_id: (row.franchise_id || fallbackRow?.franchise_id || null) as string | null,
      model_id: String(row.model_id || fallbackRow?.model_id || '').trim() || null,
      registration: String(row.registration || row.tail_number || fallbackRow?.registration || fallbackRow?.tail_number || ''),
      tail_number: (row.tail_number || row.registration || fallbackRow?.tail_number || fallbackRow?.registration || null) as string | null,
      serial_number: (row.serial_number || fallbackRow?.serial_number || null) as string | null,
      aircraft_model: aircraftModel,
      aircraft_type: (row.aircraft_type || fallbackRow?.aircraft_type || row.engine_type || null) as string | null,
      engine_type: (row.engine_type || fallbackRow?.engine_type || null) as string | null,
      base_location: (row.base_location || row.home_base || fallbackRow?.base_location || fallbackRow?.home_base || null) as string | null,
      home_base: (row.home_base || row.base_location || fallbackRow?.home_base || fallbackRow?.base_location || null) as string | null,
      owner_name: (row.owner_name || fallbackRow?.owner_name || null) as string | null,
      status: String(row.status || fallbackRow?.status || 'active'),
      is_active: row.status !== 'inactive' && row.status !== 'retired' && row.status !== 'stored' && row.status !== 'grounded',
      station_code: (row.station_code || fallbackRow?.station_code || null) as string | null,
      is_low_utilization: Boolean(row.is_low_utilization),
      created_at: String(row.created_at || fallbackRow?.created_at || ''),
      updated_at: String(row.updated_at || fallbackRow?.updated_at || ''),
    };
  });

  return {
    records,
    total: json.output?.total || records.length,
  };
}

export function useAircraftList(enabled = true) {
  const authHeaders = useAuthHeaders();

  return useQuery({
    queryKey: AIRCRAFT_KEY,
    queryFn: () =>
      authHeaders
        ? fetchAircraftList(authHeaders)
        : Promise.reject(new Error('Not authenticated')),
    enabled: enabled && !!authHeaders,
    staleTime: 60_000, // Aircraft data changes infrequently
    retry: 2,
  });
}

export function useAircraftOptions(enabled = true) {
  const { data, isLoading, error } = useAircraftList(enabled);

  const options = useMemo(() => {
    if (!data?.records) return [];
    return data.records
      .filter((ac) => ac.is_active !== false)
      .map((ac) => ({
        value: ac.id,
        label: `${ac.registration} - ${ac.aircraft_model || ac.engine_type || ac.status || 'Aircraft'}`,
        registration: ac.registration,
        type: ac.aircraft_model || ac.engine_type,
        ...ac,
      }));
  }, [data?.records]);

  return {
    options,
    isLoading,
    error,
  };
}

export function useAircraftById(aircraftId: string | null, enabled = true) {
  const { data, isLoading, error } = useAircraftList(enabled);

  const aircraft = useMemo(() => {
    if (!aircraftId || !data?.records) return null;
    return data.records.find((ac) => ac.id === aircraftId) || null;
  }, [aircraftId, data?.records]);

  return {
    aircraft,
    isLoading,
    error,
  };
}
