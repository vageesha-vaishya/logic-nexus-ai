
import { useQuery } from '@tanstack/react-query';
import { useCRM } from '@/hooks/useCRM';
import { formatContainerSize, deriveContainerSizeLabel } from '@/lib/container-utils';

export interface ContainerType {
  id: string;
  name: string;
  code: string;
}

export interface ContainerSize {
  id: string;
  name: string;
  iso_code: string;
  type_id?: string;
  container_type_id?: string;
}

const FALLBACK_TYPES: ContainerType[] = [
  { id: 'dry', name: 'Dry Standard', code: 'DRY' },
  { id: 'reefer', name: 'Reefer', code: 'RF' },
  { id: 'opentop', name: 'Open Top', code: 'OT' },
  { id: 'flat_rack', name: 'Flat Rack', code: 'FR' },
];

const FALLBACK_SIZES: ContainerSize[] = [
  { id: '20ft', name: '20ft', iso_code: '22G1', type_id: 'dry', container_type_id: 'dry' },
  { id: '40ft', name: '40ft', iso_code: '42G1', type_id: 'dry', container_type_id: 'dry' },
  { id: '40hc', name: '40ft High Cube', iso_code: '45G1', type_id: 'dry', container_type_id: 'dry' },
  { id: '45ft', name: '45ft', iso_code: 'L5G1', type_id: 'dry', container_type_id: 'dry' },
];

export function useContainerRefs() {
  const { scopedDb, context } = useCRM();
  const tenantId = context?.tenantId || '';

  const { data: containerTypes = FALLBACK_TYPES, isLoading: loadingTypes } = useQuery({
    queryKey: ['container_types', tenantId],
    queryFn: async () => {
      const { data, error } = await scopedDb.from('container_types').select('id, name, code').order('name');
      if (error || !data?.length) return FALLBACK_TYPES;
      return data as ContainerType[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
  });

  const { data: containerSizes = FALLBACK_SIZES, isLoading: loadingSizes, error: containerError, refetch } = useQuery({
    queryKey: ['container_sizes', tenantId],
    queryFn: async () => {
      // container_sizes has no name/iso_code/type_id column at all -- only
      // dimensional data (length_ft/is_high_cube/is_pallet_wide). Derive a
      // label from those instead of selecting columns that don't exist.
      const { data, error } = await scopedDb
        .from('container_sizes', true)
        .select('id, container_type_id, length_ft, is_high_cube, is_pallet_wide')
        .order('length_ft');
      if (error || !data?.length) return FALLBACK_SIZES;
      return (data as any[]).map((row) => ({
        id: row.id,
        name: deriveContainerSizeLabel(row),
        iso_code: '',
        type_id: row.container_type_id ?? undefined,
        container_type_id: row.container_type_id ?? undefined,
      })) as ContainerSize[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 2,
  });

  return {
    containerTypes,
    containerSizes,
    loading: loadingTypes || loadingSizes,
    error: containerError ? 'Failed to load container metadata' : null,
    retry: refetch,
    formatSize: formatContainerSize
  };
}
