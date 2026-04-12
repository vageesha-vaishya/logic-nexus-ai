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
  serial_number: string | null;
  aircraft_model: string | null;
  aircraft_type: string | null;
  manufacturer_id: string | null;
  manufacturer_name: string | null;
  engine_type: string | null;
  base_location: string | null;
  owner_name: string | null;
  line_number: string | null;
  variable_number: string | null;
  status: string;
  is_active: boolean;
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
  
  // Handle various API response formats
  const records = json.output?.records || json.output?.aircraft || json.data || [];
  
  return {
    records: Array.isArray(records) ? records : [],
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
        label: `${ac.registration} - ${ac.aircraft_model || ac.aircraft_type || 'Unknown'}`,
        registration: ac.registration,
        type: ac.aircraft_model || ac.aircraft_type,
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
