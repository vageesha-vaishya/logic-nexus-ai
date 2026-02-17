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

interface CarriersByModeMap {
  [modeCode: string]: CarrierOption[];
}

export function useCarriersByMode() {
  const { data: carrierMap = {}, isLoading, error } = useQuery<CarriersByModeMap>({
    queryKey: ['carriers_by_mode'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_carriers_grouped_by_mode');
      if (error) throw error;
      return (data as CarriersByModeMap) || {};
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
  };
}

