import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { marketsKeys } from '../../../hooks/queryKeys';
import type { ExecutionRule } from '../types';

const BASE = '/api/markets/v1/execution';

export function useExecutionRules() {
  const { session } = useSession();
  return useQuery<ExecutionRule[]>({
    queryKey: marketsKeys.retail.autonomous.rules(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/rules`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.rules ?? [];
    },
  });
}

export function useCreateExecutionRule() {
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<ExecutionRule, 'id' | 'is_active' | 'created_at'>) => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/rules`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.autonomous.rules() }),
  });
}
