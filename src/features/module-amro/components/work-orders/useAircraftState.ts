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

  // Map database columns to our interface
  const records: AircraftRecord[] = rawRecords.map((row: any) => ({
    id: String(row.aircraft_id || row.id || ''),
    tenant_id: String(row.tenant_id || ''),
    franchise_id: row.franchise_id || null,
    registration: String(row.registration || row.tail_number || ''),
    tail_number: row.tail_number || row.registration || null,
    serial_number: row.serial_number || null,
    aircraft_model: row.aircraft_model || row.engine_type || null,
    aircraft_type: row.aircraft_type || row.engine_type || null,
    engine_type: row.engine_type || null,
    base_location: row.base_location || row.home_base || null,
    home_base: row.home_base || row.base_location || null,
    owner_name: row.owner_name || null,
    status: String(row.status || 'active'),
    is_active: row.status !== 'inactive' && row.status !== 'retired' && row.status !== 'stored' && row.status !== 'grounded',
    station_code: row.station_code || null,
    is_low_utilization: Boolean(row.is_low_utilization),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  }));

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
        // Use registration/tail_number since aircraft_model doesn't exist in DB
        label: `${ac.registration} - ${ac.engine_type || ac.status || 'Aircraft'}`,
        registration: ac.registration,
        type: ac.engine_type || ac.aircraft_model,
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
