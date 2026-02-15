import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Incoterm {
  id: string;
  incoterm_code: string;
  incoterm_name: string;
  description?: string | null;
}

export function useIncoterms() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['incoterms'],
    queryFn: async (): Promise<Incoterm[]> => {
      const { data, error } = await supabase
        .from('incoterms')
        .select('id, incoterm_code, incoterm_name, description')
        .order('incoterm_code');
      if (error) return [];
      return data || [];
    },
    staleTime: 1000 * 60 * 60,
  });

  return { incoterms: data, loading: isLoading, error };
}
