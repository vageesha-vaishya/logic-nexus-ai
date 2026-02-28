import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizeModeCode } from '@/lib/mode-utils';

export interface CarrierOption {
  id: string;
  carrier_name: string;
  carrier_code: string | null;
  carrier_type: string;
  scac: string | null;
  iata: string | null;
  mc_dot: string | null;
  mode: string | null;
  is_preferred: boolean;
  service_types: string[];
}

export interface CarriersByModeMap {
  [modeCode: string]: CarrierOption[];
}

export function useCarriersByMode() {
  const { data: carrierMap = {}, isLoading, error, refetch } = useQuery<CarriersByModeMap>({
    queryKey: ['carriers_by_mode'],
    queryFn: async () => {
      // Fetch directly from carriers table instead of RPC to avoid schema dependency issues
      const { data, error } = await supabase
        .from('carriers')
        .select('id, carrier_name, carrier_code, carrier_type, scac, iata, mc_dot, mode, is_active')
        .eq('is_active', true)
        .order('carrier_name');

      if (error) throw error;

      // Group by mode manually
      const grouped: CarriersByModeMap = {};
      
      data?.forEach((carrier) => {
        // Map to CarrierOption interface
        const option: CarrierOption = {
          id: carrier.id,
          carrier_name: carrier.carrier_name,
          carrier_code: carrier.carrier_code,
          carrier_type: carrier.carrier_type,
          scac: carrier.scac,
          iata: carrier.iata,
          mc_dot: carrier.mc_dot,
          mode: carrier.mode,
          is_preferred: false, // Default since we're not fetching preferences yet
          service_types: [],   // Default empty array
        };

        const modeKey = carrier.mode ? normalizeModeCode(carrier.mode) : 'unknown';
        if (!grouped[modeKey]) {
          grouped[modeKey] = [];
        }
        grouped[modeKey].push(option);
      });

      return grouped;
    },
    staleTime: 1000 * 60 * 30,
    retry: 2,
  });

  const getCarriersForMode = (modeCode: string): CarrierOption[] => {
    if (!modeCode) return [];
    const normalized = normalizeModeCode(modeCode);
    return carrierMap[normalized] || [];
  };

  const getAllCarriers = (): CarrierOption[] => {
    return Object.values(carrierMap).flat();
  };

  const hasCarriersForMode = (modeCode: string): boolean => {
    return getCarriersForMode(modeCode).length > 0;
  };

  return {
    carrierMap,
    getCarriersForMode,
    getAllCarriers,
    hasCarriersForMode,
    isLoading,
    error,
    refetch,
  };
}

