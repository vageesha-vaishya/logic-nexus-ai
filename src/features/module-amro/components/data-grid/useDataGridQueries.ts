/**
 * AMRO Data Grid React Query Hooks
 *
 * CRUD hooks with:
 * - Optimistic updates
 * - Cache invalidation
 * - Error handling
 * - Loading states
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDataGridStore } from './store/useDataGridStore';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}

export interface QueryParams {
  search?: string;
  status?: string;
  type?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

// ── Mock API Service ───────────────────────────────────────────────────────────

// Mock data generator
function generateMockData(count: number): any[] {
  const statuses = ['available', 'low_stock', 'reserved', 'quarantined', 'serviceable'];
  const types = ['part', 'consumable', 'equipment', 'tool'];
  const locations = ['WH-A1', 'WH-A2', 'WH-B1', 'WH-B3', 'WH-C1', 'WH-D1'];

  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    part_number: `PN-${String(i + 1).padStart(3, '0')}-${['A320', 'B737', 'B787', 'A350'][i % 4]}`,
    description: [
      'Hydraulic Pump Assembly',
      'Landing Gear Actuator',
      'Fuel Filter Element',
      'APU Starter Motor',
      'Oxygen Generator',
      'Flight Control Computer',
      'Navigation Display Unit',
      'Cabin Pressure Valve',
    ][i % 8],
    type: types[i % types.length],
    status: statuses[i % statuses.length],
    quantity: Math.floor(Math.random() * 50),
    location: locations[i % locations.length],
    unit_cost: Math.round((Math.random() * 2000 + 100) * 100) / 100,
    updated_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

// Mock API delay
const API_DELAY = 300;

// Mock fetch function
async function mockFetchData(params: QueryParams): Promise<PaginatedResponse<any>> {
  await new Promise((resolve) => setTimeout(resolve, API_DELAY));

  let data = generateMockData(100);

  // Apply search filter
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    data = data.filter(
      (item) =>
        item.part_number.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        item.location.toLowerCase().includes(searchLower)
    );
  }

  // Apply status filter
  if (params.status && params.status !== 'all') {
    data = data.filter((item) => item.status === params.status);
  }

  // Apply type filter
  if (params.type && params.type !== 'all') {
    data = data.filter((item) => item.type === params.type);
  }

  // Apply sorting
  if (params.sort) {
    const [field, direction] = params.sort.split(':');
    data.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const totalCount = data.length;
  const page = params.page || 0;
  const limit = params.limit || 20;
  const paginatedData = data.slice(page * limit, (page + 1) * limit);

  return {
    data: paginatedData,
    totalCount,
    pageIndex: page,
    pageSize: limit,
  };
}

// Mock CRUD operations
async function mockCreateRecord(record: Record<string, any>): Promise<any> {
  await new Promise((resolve) => setTimeout(resolve, API_DELAY));
  return { ...record, id: `item-${Date.now()}`, created_at: new Date().toISOString() };
}

async function mockUpdateRecord(id: string, record: Record<string, any>): Promise<any> {
  await new Promise((resolve) => setTimeout(resolve, API_DELAY));
  return { ...record, id, updated_at: new Date().toISOString() };
}

async function mockDeleteRecord(id: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, API_DELAY));
}

// ── Query Keys ─────────────────────────────────────────────────────────────────

export const dataGridQueryKeys = {
  all: ['amro', 'data-grid'] as const,
  lists: () => [...dataGridQueryKeys.all, 'list'] as const,
  list: (params: QueryParams) => [...dataGridQueryKeys.lists(), params] as const,
  details: () => [...dataGridQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...dataGridQueryKeys.details(), id] as const,
};

// ── Data List Hook ─────────────────────────────────────────────────────────────

export function useDataGridList(params: QueryParams) {
  return useQuery({
    queryKey: dataGridQueryKeys.list(params),
    queryFn: () => mockFetchData(params),
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
  });
}

// ── Create Record Hook ─────────────────────────────────────────────────────────

export function useCreateRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mockCreateRecord,
    onMutate: async (newRecord) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: dataGridQueryKeys.lists() });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(dataGridQueryKeys.lists());

      // Optimistically update
      queryClient.setQueryData(dataGridQueryKeys.lists(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: [newRecord, ...(old.data || [])],
          totalCount: (old.totalCount || 0) + 1,
        };
      });

      return { previousData };
    },
    onError: (err, newRecord, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(dataGridQueryKeys.lists(), context.previousData);
      }
    },
    onSettled: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: dataGridQueryKeys.lists() });
    },
  });
}

// ── Update Record Hook ─────────────────────────────────────────────────────────

export function useUpdateRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      mockUpdateRecord(id, data),
    onMutate: async ({ id, ...data }) => {
      await queryClient.cancelQueries({ queryKey: dataGridQueryKeys.lists() });

      const previousData = queryClient.getQueryData(dataGridQueryKeys.lists());

      queryClient.setQueryData(dataGridQueryKeys.lists(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: (old.data || []).map((item: any) =>
            item.id === id ? { ...item, ...data, updated_at: new Date().toISOString() } : item
          ),
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(dataGridQueryKeys.lists(), context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dataGridQueryKeys.lists() });
    },
  });
}

// ── Delete Record Hook ─────────────────────────────────────────────────────────

export function useDeleteRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mockDeleteRecord,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: dataGridQueryKeys.lists() });

      const previousData = queryClient.getQueryData(dataGridQueryKeys.lists());

      queryClient.setQueryData(dataGridQueryKeys.lists(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: (old.data || []).filter((item: any) => item.id !== id),
          totalCount: (old.totalCount || 0) - 1,
        };
      });

      return { previousData };
    },
    onError: (err, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(dataGridQueryKeys.lists(), context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dataGridQueryKeys.lists() });
    },
  });
}

// ── Bulk Delete Hook ───────────────────────────────────────────────────────────

export function useBulkDeleteRecords() {
  const queryClient = useQueryClient();
  const { setBulkOperation } = useDataGridStore();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      setBulkOperation({
        type: 'delete',
        progress: 0,
        total: ids.length,
        status: 'in-progress',
        error: null,
      });

      for (let i = 0; i < ids.length; i++) {
        await mockDeleteRecord(ids[i]);
        setBulkOperation({
          type: 'delete',
          progress: i + 1,
          total: ids.length,
          status: 'in-progress',
          error: null,
        });
      }

      setBulkOperation({
        type: 'delete',
        progress: ids.length,
        total: ids.length,
        status: 'completed',
        error: null,
      });
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: dataGridQueryKeys.lists() });

      const previousData = queryClient.getQueryData(dataGridQueryKeys.lists());

      queryClient.setQueryData(dataGridQueryKeys.lists(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: (old.data || []).filter((item: any) => !ids.includes(item.id)),
          totalCount: (old.totalCount || 0) - ids.length,
        };
      });

      return { previousData };
    },
    onError: (err, ids, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(dataGridQueryKeys.lists(), context.previousData);
      }
      setBulkOperation({
        type: 'delete',
        progress: 0,
        total: ids.length,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Delete failed',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: dataGridQueryKeys.lists() });
    },
  });
}
