
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatContainerSize } from '@/lib/container-utils';

export interface ContainerType {
  id: string;
  name: string;
  code: string;
}

export interface ContainerSize {
  id: string;
  name: string;
  iso_code: string;
  type_id: string;
}

const FALLBACK_TYPES: ContainerType[] = [
  { id: 'dry', name: 'Dry Standard', code: 'DRY' },
  { id: 'reefer', name: 'Reefer', code: 'RF' },
  { id: 'opentop', name: 'Open Top', code: 'OT' },
  { id: 'flat_rack', name: 'Flat Rack', code: 'FR' },
];

const FALLBACK_SIZES: ContainerSize[] = [
  { id: '20ft', name: '20ft', iso_code: '22G1', type_id: 'dry' },
  { id: '40ft', name: '40ft', iso_code: '42G1', type_id: 'dry' },
  { id: '40hc', name: '40ft High Cube', iso_code: '45G1', type_id: 'dry' },
  { id: '45ft', name: '45ft', iso_code: 'L5G1', type_id: 'dry' },
];

export function useContainerRefs() {
  const { data: containerTypes = FALLBACK_TYPES, isLoading: loadingTypes } = useQuery({
    queryKey: ['container_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('container_types').select('id, name, code').order('name');
      if (error || !data?.length) return FALLBACK_TYPES;
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const { data: containerSizes = FALLBACK_SIZES, isLoading: loadingSizes } = useQuery({
    queryKey: ['container_sizes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('container_sizes').select('id, name, iso_code, type_id').order('name');
      if (error || !data?.length) return FALLBACK_SIZES;
      return data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  return {
    containerTypes,
    containerSizes,
    loading: loadingTypes || loadingSizes,
    formatSize: formatContainerSize
  };
}
