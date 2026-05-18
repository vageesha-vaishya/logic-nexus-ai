import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { marketsKeys } from '../../../hooks/queryKeys';
import type { KillSwitchLevel } from '../types';

const BASE = '/api/markets/v1/execution';

export function useKillSwitch() {
  const { session } = useSession();
  return useQuery<{ kill_switch_level: KillSwitchLevel; current_phase: string }>({
    queryKey: marketsKeys.retail.autonomous.killSwitch(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/kill-switch`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useSetKillSwitch() {
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (level: KillSwitchLevel) => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/kill-switch/${level}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: marketsKeys.retail.autonomous.killSwitch() });
      qc.invalidateQueries({ queryKey: marketsKeys.retail.autonomous.progress() });
    },
  });
}
