import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export interface AvailabilityItem {
  part_number: string;
  serial_number: string | null;
  description: string | null;
  available_qty: number;
  quantity_on_hand: number;
  reserved_qty: number;
  warehouse_location: string | null;
  status: 'available' | 'limited' | 'out_of_stock';
  inventory_status: string | null;
  criticality: string | null;
  item_type: string | null;
  ata_chapter: string | null;
  supplier_name: string | null;
  reorder_level: number;
}

export interface AvailabilitySummary {
  total_items: number;
  available_items: number;
  limited_items: number;
  out_of_stock_items: number;
}

export interface AvailabilityResponse {
  version: string;
  interface: string;
  correlationId: string;
  output: {
    tenant_id: string;
    franchise_id: string | null;
    station_code: string | null;
    part_numbers_requested: string[] | null;
    checked_at: string;
    summary: AvailabilitySummary;
    items: AvailabilityItem[];
  };
}

interface UseAvailabilityParams {
  partNumbers?: string[];
  stationCode?: string;
  enabled?: boolean;
  refetchInterval?: number | false;
}

const AVAILABILITY_QUERY_KEY = ['amro', 'inventory', 'availability'] as const;

async function fetchAvailability(
  partNumbers?: string[],
  stationCode?: string,
): Promise<AvailabilityResponse> {
  const params = new URLSearchParams();

  if (partNumbers && partNumbers.length > 0) {
    params.set('part_numbers', partNumbers.join(','));
  }
  if (stationCode) {
    params.set('station_code', stationCode);
  }

  const url = `/api/v2/amro/inventory/availability?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Availability check failed: ${response.status} ${response.statusText} — ${errorText}`,
    );
  }

  return response.json();
}

export function useAvailability(params: UseAvailabilityParams = {}) {
  const { partNumbers, stationCode, enabled = true, refetchInterval = false } = params;

  return useQuery({
    queryKey: [...AVAILABILITY_QUERY_KEY, partNumbers?.join(',') || 'all', stationCode || 'all'] as const,
    queryFn: () => fetchAvailability(partNumbers, stationCode),
    enabled,
    refetchInterval,
    staleTime: 30_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });
}

export function useAvailabilityActions() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(
    (params?: { partNumbers?: string[]; stationCode?: string }) => {
      return queryClient.invalidateQueries({
        queryKey: [
          ...AVAILABILITY_QUERY_KEY,
          params?.partNumbers?.join(',') || 'all',
          params?.stationCode || 'all',
        ],
      });
    },
    [queryClient],
  );

  return { invalidate };
}
