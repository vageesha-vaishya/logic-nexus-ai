import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceType {
  id: string;
  code: string;
  name: string;
  mode_id?: string | null;
}

export function useServiceTypes() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['service_types'],
    queryFn: async (): Promise<ServiceType[]> => {
      const { data, error } = await supabase
        .from('service_types')
        .select('id, code, name, mode_id')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) return [];
      return data || [];
    },
    staleTime: 1000 * 60 * 30,
  });

  return { serviceTypes: data, loading: isLoading, error };
}
