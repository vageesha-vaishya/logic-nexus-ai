/**
 * useBehavioralEvents + mutations — list / log / acknowledge rows in
 * markets.behavioral_events via the markets-worker behavioral router.
 *
 * Same auth pattern as useMarketStress / useRetailSignals: pull a fresh
 * session token at request time so a stale React-state copy can't poison
 * the call.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { marketsKeys } from '../../hooks/queryKeys';
import type {
  BehavioralEvent,
  BehavioralEventType,
  BehavioralSeverity,
} from './types';

const WORKER_URL = import.meta.env.VITE_MARKETS_WORKER_URL ?? 'http://localhost:8001';

async function authToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return token;
}

export function useBehavioralEvents() {
  return useQuery({
    queryKey: marketsKeys.retail.behavioral.events(),
    staleTime: 30_000,
    queryFn: async (): Promise<BehavioralEvent[]> => {
      const token = await authToken();
      const resp = await fetch(`${WORKER_URL}/v1/retail/behavioral/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`behavioral-events: ${resp.status}`);
      return (await resp.json()) as BehavioralEvent[];
    },
  });
}

export interface LogBehavioralEventInput {
  event_type: BehavioralEventType;
  severity:   BehavioralSeverity;
  metadata?:  Record<string, unknown>;
}

export function useLogBehavioralEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogBehavioralEventInput) => {
      const token = await authToken();
      const resp = await fetch(`${WORKER_URL}/v1/retail/behavioral/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata: {}, ...input }),
      });
      if (!resp.ok) throw new Error(`log-event: ${resp.status}`);
      return resp.json();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: marketsKeys.retail.behavioral.events() }),
  });
}

export function useAcknowledgeBehavioralEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const token = await authToken();
      const resp = await fetch(
        `${WORKER_URL}/v1/retail/behavioral/events/${eventId}/acknowledge`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resp.ok) throw new Error(`ack-event: ${resp.status}`);
      return resp.json();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: marketsKeys.retail.behavioral.events() }),
  });
}

/**
 * Derive the set of education_ids that have been "seen" by the user from
 * a list of behavioral events. Used by SignalCard to suppress education
 * cards the user has already dismissed on another device.
 */
export function getSeenEducationIds(events: BehavioralEvent[]): Set<string> {
  const seen = new Set<string>();
  for (const e of events) {
    if (e.event_type !== 'education_shown') continue;
    const id = e.metadata?.education_id;
    if (typeof id === 'string') seen.add(id);
  }
  return seen;
}
