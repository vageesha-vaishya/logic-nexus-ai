// src/features/markets/retail/behavioral/useBehavioralEvents.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { marketsKeys } from '../../hooks/queryKeys';
import type { BehavioralEvent, BehavioralEventType } from './types';

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? 'http://localhost:8001';

export function useBehavioralEvents() {
  const { session } = useAuth();

  return useQuery({
    queryKey: marketsKeys.retail.behavioral.events(),
    enabled: Boolean(session?.access_token),
    staleTime: 30_000,
    queryFn: async (): Promise<BehavioralEvent[]> => {
      const token = session?.access_token;
      if (!token) throw new Error('behavioral-events: unauthenticated');
      const resp = await fetch(`${WORKER_URL}/v1/retail/behavioral/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`behavioral-events: ${resp.status}`);
      return resp.json();
    },
  });
}

export function useLogBehavioralEvent() {
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      event_type: BehavioralEventType;
      severity: 'info' | 'warning' | 'critical';
      metadata?: Record<string, unknown>;
    }) => {
      const token = session?.access_token;
      if (!token) throw new Error('log-event: unauthenticated');
      const resp = await fetch(`${WORKER_URL}/v1/retail/behavioral/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...payload, metadata: payload.metadata ?? {} }),
      });
      if (!resp.ok) throw new Error(`log-event: ${resp.status}`);
      return resp.json();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: marketsKeys.retail.behavioral.events() }),
  });
}

export function useAcknowledgeBehavioralEvent() {
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const token = session?.access_token;
      if (!token) throw new Error('ack-event: unauthenticated');
      const resp = await fetch(
        `${WORKER_URL}/v1/retail/behavioral/events/${eventId}/acknowledge`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!resp.ok) throw new Error(`ack-event: ${resp.status}`);
      return resp.json();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: marketsKeys.retail.behavioral.events() }),
  });
}
