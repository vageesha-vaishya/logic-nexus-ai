import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TransportMode {
  id: string;
  code: string;
  name: string;
  icon_name: string;
  color: string;
  display_order: number;
  is_active: boolean;
}

export const useTransportModes = () => {
  return useQuery({
    queryKey: ['transport-modes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transport_modes')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data as TransportMode[];
    }
  });
};
