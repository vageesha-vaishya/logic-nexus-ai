import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCRM } from './useCRM';
import { Lead, LeadStatus } from '@/pages/dashboard/leads-data';
import { toast } from 'sonner';

/**
 * A hook to fetch leads with React Query for better caching and optimistic updates.
 */
export function useLeads(options: { 
  page?: number; 
  pageSize?: number; 
  status?: string; 
  search?: string;
  owner?: 'any' | 'unassigned' | 'me';
} = {}) {
  const { scopedDb, context } = useCRM();
  const { page = 1, pageSize = 10, status = 'all', search = '', owner = 'any' } = options;

  return useQuery({
    queryKey: ['leads', { page, pageSize, status, search, owner, tenantId: context?.tenantId }],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = scopedDb
        .from('leads')
        .select('*', { count: 'exact' });

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (owner === 'me' && context?.userId) {
        query = query.eq('owner_id', context.userId);
      } else if (owner === 'unassigned') {
        query = query.is('owner_id', null);
      }

      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { leads: data as Lead[], totalCount: count || 0 };
    },
    enabled: !!context?.tenantId || context?.isPlatformAdmin,
  });
}

/**
 * A hook for lead mutations with optimistic UI support.
 */
export function useUpdateLead() {
  const { scopedDb } = useCRM();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Lead> }) => {
      const { data, error } = await (scopedDb.from('leads') as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Lead;
    },
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['leads'] });

      // Snapshot the previous value
      const previousLeads = queryClient.getQueryData(['leads']);

      // Optimistically update the cache
      queryClient.setQueriesData({ queryKey: ['leads'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          leads: old.leads?.map((l: Lead) => l.id === id ? { ...l, ...updates } : l)
        };
      });

      return { previousLeads };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousLeads) {
        queryClient.setQueriesData({ queryKey: ['leads'] }, context.previousLeads);
      }
      toast.error('Failed to update lead');
    },
    onSettled: () => {
      // Always refetch to ensure synchronization
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onSuccess: (data) => {
      toast.success(`Lead updated`);
    }
  });
}
