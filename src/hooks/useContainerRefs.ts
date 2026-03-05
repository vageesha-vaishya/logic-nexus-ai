
import { useQuery } from '@tanstack/react-query';
import { useCRM } from '@/hooks/useCRM';
import { formatContainerSize } from '@/lib/container-utils';
import { useAuth } from '@/hooks/useAuth';
import { fetchContainerSizesApi, fetchContainerTypesApi, logContainerMetadataError } from '@/lib/api/containerMetadata';

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
  const { user } = useAuth();
  const tenantId = context?.tenantId || '';

  const { data: containerTypes = FALLBACK_TYPES, isLoading: loadingTypes } = useQuery({
    queryKey: ['container_types', tenantId],
    queryFn: async () => {
      try {
        const apiData = await fetchContainerTypesApi(tenantId, user?.id);
        if (apiData.length) {
          return apiData
            .filter((item) => item.isActive !== false)
            .map((item) => ({
              id: item.sourceId || String(item.id),
              name: item.name,
              code: item.code || '',
            }));
        }
      } catch (apiError) {
        logContainerMetadataError('fetchContainerTypesApi', apiError);
      }

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
      try {
        const apiData = await fetchContainerSizesApi(tenantId, undefined, user?.id);
        if (apiData.length) {
          return apiData
            .filter((item) => item.isActive !== false)
            .map((row) => ({
            id: row.sourceId || String(row.id),
            name: row.name,
            iso_code: row.isoCode || '',
            type_id: row.containerTypeSourceId,
            container_type_id: row.containerTypeSourceId,
          })) as ContainerSize[];
        }
      } catch (apiError) {
        logContainerMetadataError('fetchContainerSizesApi', apiError);
      }

      const { data, error } = await scopedDb
        .from('container_sizes', true)
        .select('id, name, iso_code, container_type_id, type_id')
        .order('name');
      if (error || !data?.length) return FALLBACK_SIZES;
      return (data as any[]).map((row) => ({
        ...row,
        // Backward compatibility: ensure both keys exist
        type_id: row.type_id ?? row.container_type_id ?? undefined,
        container_type_id: row.container_type_id ?? row.type_id ?? undefined,
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
