import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      }),
    },
  },
}));

import {
  useBehavioralEvents,
  useLogBehavioralEvent,
  useAcknowledgeBehavioralEvent,
  getSeenEducationIds,
} from './useBehavioralEvents';
import type { BehavioralEvent } from './types';

const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useBehavioralEvents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches the list of unacknowledged events', async () => {
    const rows: BehavioralEvent[] = [
      {
        id: 'ev1',
        user_id: 'u1',
        event_type: 'yellow_alert',
        severity: 'warning',
        metadata: {},
        acknowledged_at: null,
        created_at: '2026-05-18T10:00:00Z',
      },
    ];
    (global as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => rows });

    const { result } = renderHook(() => useBehavioralEvents(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe('useLogBehavioralEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs the event payload with auth + JSON content-type', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'ev1' }) });
    (global as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = fetchMock;

    const { result } = renderHook(() => useLogBehavioralEvent(), { wrapper: wrapper() });
    await result.current.mutateAsync({
      event_type: 'yellow_alert',
      severity: 'warning',
      metadata: { drawdown_pct: 7.2 },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/retail\/behavioral\/events$/);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer tok');
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      metadata: { drawdown_pct: 7.2 },
      event_type: 'yellow_alert',
      severity: 'warning',
    });
  });
});

describe('useAcknowledgeBehavioralEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PATCHes the ack endpoint with the event id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    (global as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = fetchMock;

    const { result } = renderHook(() => useAcknowledgeBehavioralEvent(), {
      wrapper: wrapper(),
    });
    await result.current.mutateAsync('ev1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/v1\/retail\/behavioral\/events\/ev1\/acknowledge$/);
    expect(init.method).toBe('PATCH');
  });
});

describe('getSeenEducationIds', () => {
  it('collects education_id values from education_shown events only', () => {
    const events: BehavioralEvent[] = [
      {
        id: '1', user_id: 'u', event_type: 'education_shown', severity: 'info',
        metadata: { education_id: 'high_conviction_signal' },
        acknowledged_at: null, created_at: '',
      },
      {
        id: '2', user_id: 'u', event_type: 'yellow_alert', severity: 'warning',
        metadata: { education_id: 'should_be_ignored' },
        acknowledged_at: null, created_at: '',
      },
      {
        id: '3', user_id: 'u', event_type: 'education_shown', severity: 'info',
        metadata: { education_id: 'first_sip' },
        acknowledged_at: null, created_at: '',
      },
    ];

    const seen = getSeenEducationIds(events);
    expect(seen).toEqual(new Set(['high_conviction_signal', 'first_sip']));
  });

  it('returns empty set when no events match', () => {
    expect(getSeenEducationIds([])).toEqual(new Set());
  });
});
