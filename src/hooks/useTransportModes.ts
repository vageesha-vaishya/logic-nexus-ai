import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Ship, Plane, Truck, Train } from 'lucide-react';
import type { ComponentType } from 'react';

export interface TransportMode {
  id: string;
  code: string;
  name: string;
  icon_name?: string | null;
  color?: string | null;
}

export function useTransportModes() {
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['transport_modes'],
    queryFn: async (): Promise<TransportMode[]> => {
      const { data, error } = await supabase
        .from('transport_modes')
        .select('id, code, name, icon_name, color')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) return [];
      return data || [];
    },
    staleTime: 1000 * 60 * 60,
  });

  return { modes: data, loading: isLoading, error, refetch };
}

export function getTransportModeIcon(iconName?: string | null) {
  const key = String(iconName || '').toLowerCase();
  const Icon: ComponentType<{ className?: string }> =
    key.includes('plane') || key.includes('air') ? Plane :
    key.includes('truck') || key.includes('road') ? Truck :
    key.includes('train') || key.includes('rail') ? Train :
    Ship;
  return Icon;
}
