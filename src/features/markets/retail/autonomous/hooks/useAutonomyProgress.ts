import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { marketsKeys } from '../../../hooks/queryKeys';
import type { AutonomyProgress } from '../types';

const BASE = '/api/markets/v1/execution';

export function useAutonomyProgress() {
  const { session } = useSession();
  return useQuery<AutonomyProgress>({
    queryKey: marketsKeys.retail.autonomous.progress(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/progress`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useAdvancePhase() {
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/advance-phase`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.autonomous.progress() }),
  });
}
