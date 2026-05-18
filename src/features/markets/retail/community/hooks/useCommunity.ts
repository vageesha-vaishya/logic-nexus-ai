// src/features/markets/retail/community/hooks/useCommunity.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { marketsKeys } from '../../../hooks/queryKeys';
import type { CommunityBasket, BasketHolding, MarketplaceStrategy, CreatorStatus } from '../types';

const BASE = '/api/markets/v1/community';

export function useCreatorStatus() {
  const { session } = useSession();
  return useQuery<CreatorStatus>({
    queryKey: marketsKeys.retail.community.creator(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/creator-status`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useBaskets() {
  const { session } = useSession();
  return useQuery<CommunityBasket[]>({
    queryKey: marketsKeys.retail.community.baskets(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/baskets`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.baskets ?? [];
    },
  });
}

export function useBasketHoldings(basketId: string) {
  const { session } = useSession();
  return useQuery<BasketHolding[]>({
    queryKey: marketsKeys.retail.community.basket(basketId),
    enabled: !!session && !!basketId,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/baskets/${basketId}/holdings`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.holdings ?? [];
    },
  });
}

export function useInvestInBasket() {
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ basketId, amount }: { basketId: string; amount: number }) => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/baskets/${basketId}/invest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.community.baskets() }),
  });
}

export function useStrategies() {
  const { session } = useSession();
  return useQuery<MarketplaceStrategy[]>({
    queryKey: marketsKeys.retail.community.strategies(),
    enabled: !!session,
    queryFn: async () => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/strategies`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.strategies ?? [];
    },
  });
}

export function useDeployStrategy() {
  const { session } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (strategyId: string) => {
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${BASE}/strategies/${strategyId}/deploy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: marketsKeys.retail.community.strategies() }),
  });
}
