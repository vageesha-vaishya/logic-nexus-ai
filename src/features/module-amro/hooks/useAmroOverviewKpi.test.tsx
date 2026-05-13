import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetAmroOverviewKpiCooldownForTests, useAmroOverviewKpi } from './useAmroOverviewKpi';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: 'test-session-token',
          },
        },
      })),
      refreshSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: 'test-session-token',
          },
        },
      })),
    },
    channel: vi.fn(() => ({
      on: vi.fn(function on() {
        return this;
      }),
      subscribe: vi.fn(() => ({ status: 'SUBSCRIBED' })),
    })),
    removeChannel: vi.fn(async () => ({ error: null })),
  },
}));

describe('useAmroOverviewKpi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    __resetAmroOverviewKpiCooldownForTests();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'test-session-token',
        },
      },
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: {
        session: {
          access_token: 'test-session-token',
        },
      },
    } as Awaited<ReturnType<typeof supabase.auth.refreshSession>>);
  });

  it('loads dashboard and trends from the overview KPI endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            kpi_cards: [{ key: 'open_work_orders', label: 'Open Work Packages', value: 42, trend: '+6%' }],
            risk_heatmap: { cells: [] },
            trend_lines: [],
            anomaly_flags: [],
            freshness_warning: null,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            time_series: [],
            variance: 2.1,
            threshold_breaches: [],
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi({
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1',
      userId: 'user-1',
      domainCode: 'AMRO',
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v2/amro/overview-kpi?');
    expect(String(fetchMock.mock.calls[0][0])).toContain('interface=load-kpi-dashboard');
    expect(String(fetchMock.mock.calls[1][0])).toContain('interface=load-operational-trends');
    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get('Authorization')).toBe('Bearer test-session-token');
    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get('x-tenant-id')).toBe('tenant-1');
    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get('x-franchise-id')).toBe('franchise-1');
    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get('x-user-id')).toBe('user-1');
    expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers).get('x-domain-id')).toBe('AMRO');
    expect(result.current.dashboard?.kpi_cards[0]?.label).toBe('Open Work Packages');
    expect(result.current.trends?.variance).toBe(2.1);
  });

  it('calls API in local mode without Authorization when Supabase session is absent', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: null,
      },
    } as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: {
        session: null,
      },
    } as Awaited<ReturnType<typeof supabase.auth.refreshSession>>);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            kpi_cards: [{ key: 'open_work_orders', label: 'Open Work Packages', value: 14, trend: '+2%' }],
            risk_heatmap: { cells: [] },
            trend_lines: [],
            anomaly_flags: [],
            freshness_warning: null,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            time_series: [],
            variance: 1.3,
            threshold_breaches: [],
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi({
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1',
      userId: 'user-1',
      domainCode: 'AMRO',
    }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const requestHeaders = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(requestHeaders.get('Authorization')).toBeNull();
    expect(requestHeaders.get('x-user-id')).toBe('user-1');
    expect(result.current.dashboard?.kpi_cards[0]?.value).toBe(14);
  });

  it('exports KPI snapshot through POST interface with excel format support', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            kpi_cards: [],
            risk_heatmap: { cells: [] },
            trend_lines: [],
            anomaly_flags: [],
            freshness_warning: null,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            time_series: [],
            variance: 0.2,
            threshold_breaches: [],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            export_job_id: 'tenant-1-kpi-export-123',
            download_url: '/api/v2/amro/overview-kpi/download/test.pdf',
            generated_at: '2026-03-21T00:00:00.000Z',
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.exportSnapshot({
        format: 'xlsx',
        dateRange: '2026-03-01T00:00:00.000Z|2026-03-21T00:00:00.000Z',
        selectedWidgets: ['kpi_cards'],
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toContain('interface=export-kpi-snapshot');
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'POST' });
    expect(String((fetchMock.mock.calls[2][1] as RequestInit).body)).toContain('"format":"xlsx"');
    expect(new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers).get('Content-Type')).toBe('application/json');
    expect(new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers).get('Authorization')).toBe('Bearer test-session-token');
    expect(result.current.lastExport?.export_job_id).toBe('tenant-1-kpi-export-123');
  });

  it('passes region filter through dashboard query params', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            kpi_cards: [{ key: 'open_work_orders', label: 'Open Work Packages', value: 42, trend: '+6%' }],
            risk_heatmap: { cells: [] },
            trend_lines: [],
            anomaly_flags: [],
            freshness_warning: null,
          },
        }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          output: {
            time_series: [],
            variance: 2.1,
            threshold_breaches: [],
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.loadDashboard({
        dateRange: '2026-03-01T00:00:00.000Z|2026-03-21T00:00:00.000Z',
        regionIds: ['EMEA'],
      });
    });

    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('region_ids=EMEA'))).toBe(true);
  });

  it('passes pagination params through dashboard and trends query params', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          output: {
            kpi_cards: [{ key: 'open_work_orders', label: 'Open Work Packages', value: 42, trend: '+6%' }],
            risk_heatmap: { cells: [] },
            trend_lines: [],
            anomaly_flags: [],
            freshness_warning: null,
            time_series: [],
            variance: 1.1,
            threshold_breaches: [],
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.loadDashboard({
        dateRange: '2026-03-01T00:00:00.000Z|2026-03-21T00:00:00.000Z',
        page: 3,
        pageSize: 10,
      });
      await result.current.loadTrends({
        metricKey: 'schedule_adherence',
        window: '30d',
        compareWindow: '30d',
        page: 2,
        pageSize: 5,
      });
    });

    const dashboardCalls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes('interface=load-kpi-dashboard'));
    const trendCalls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes('interface=load-operational-trends'));
    expect(dashboardCalls.some((url) => url.includes('page=3'))).toBe(true);
    expect(dashboardCalls.some((url) => url.includes('page_size=10'))).toBe(true);
    expect(trendCalls.some((url) => url.includes('page=2'))).toBe(true);
    expect(trendCalls.some((url) => url.includes('page_size=5'))).toBe(true);
  });

  it('propagates dashboard scope filters into trends query params', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          output: {
            kpi_cards: [{ key: 'open_work_orders', label: 'Open Work Packages', value: 42, trend: '+6%' }],
            risk_heatmap: { cells: [] },
            trend_lines: [],
            anomaly_flags: [],
            freshness_warning: null,
            time_series: [],
            variance: 1.1,
            threshold_breaches: [],
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.loadDashboard({
        dateRange: '2026-03-01T00:00:00.000Z|2026-03-21T00:00:00.000Z',
        stationIds: ['station-a'],
        fleetIds: ['fleet-a'],
        regionIds: ['EMEA'],
      });
      await result.current.loadTrends({
        metricKey: 'schedule_adherence',
        window: '30d',
        compareWindow: '30d',
      });
    });

    const trendCalls = fetchMock.mock.calls
      .map((call) => String(call[0]))
      .filter((url) => url.includes('interface=load-operational-trends'));
    expect(trendCalls.some((url) => url.includes('region_ids=EMEA'))).toBe(true);
    expect(trendCalls.some((url) => url.includes('station_ids=station-a'))).toBe(true);
    expect(trendCalls.some((url) => url.includes('fleet_ids=fleet-a'))).toBe(true);
  });

  it('surfaces API errors as hook error state', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            time_series: [],
            variance: 0,
            threshold_breaches: [],
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain('Forbidden');
    expect(result.current.dashboard?.kpi_cards[0]?.label).toBe('Open Work Packages');
    expect(result.current.dashboard?.data_issues?.some((issue) => issue.includes('AMRO KPI API error: Forbidden'))).toBe(true);
    expect(result.current.trends?.variance).toBe(0);
  });

  it('uses fallback KPI snapshot after network connectivity failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.dashboard?.kpi_cards[0]?.label).toBe('Open Work Packages');
    expect(result.current.dashboard?.data_issues?.[0]).toContain('fallback snapshot');
    expect(result.current.trends?.data_issues?.[0]).toContain('fallback trend telemetry');

    await act(async () => {
      await result.current.refreshAll();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not activate outage cooldown for auth failures and recovers on manual refresh', async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      callCount += 1;
      if (callCount <= 4) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        };
      }
      const url = String(input);
      if (url.includes('interface=load-kpi-dashboard')) {
        return {
          ok: true,
          json: async () => ({
            output: {
              kpi_cards: [{ key: 'open_work_orders', label: 'Open Work Packages', value: 33, trend: '+5%' }],
              risk_heatmap: { cells: [] },
              trend_lines: [],
              anomaly_flags: [],
              freshness_warning: null,
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          output: {
            time_series: [],
            variance: 1.8,
            threshold_breaches: [],
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dashboard?.data_issues?.some((issue) => issue.includes('Unauthorized'))).toBe(true);
    const callsAfterInitialLoad = fetchMock.mock.calls.length;

    await act(async () => {
      await result.current.refreshAll();
    });

    await waitFor(() => {
      expect(result.current.dashboard?.kpi_cards[0]?.value).toBe(33);
      expect(result.current.trends?.variance).toBe(1.8);
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterInitialLoad);
  });

  it('reuses outage cooldown across hook remounts to prevent proxy retry storms', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    const first = renderHook(() => useAmroOverviewKpi());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    first.unmount();

    const second = renderHook(() => useAmroOverviewKpi());
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.error).toBeNull();
    expect(second.result.current.dashboard?.data_issues?.[0]).toContain('fallback snapshot');
    expect(second.result.current.trends?.data_issues?.[0]).toContain('fallback trend telemetry');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps metric tiers and refreshes dashboard plus trends on demand', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('interface=load-kpi-dashboard')) {
        return {
          ok: true,
          json: async () => ({
            output: {
              kpi_cards: [{ key: 'compliance_risk', label: 'Compliance Risk', value: 2, trend: '-3%' }],
              risk_heatmap: { cells: [] },
              trend_lines: [],
              anomaly_flags: [],
              freshness_warning: null,
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          output: {
            time_series: [],
            variance: 1.4,
            threshold_breaches: [],
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.refreshCadence.criticalMs).toBe(30000);
    expect(result.current.refreshCadence.standardMs).toBe(300000);
    expect(result.current.getMetricTier('overdue_tasks')).toBe('critical');
    expect(result.current.getMetricTier('schedule_adherence')).toBe('standard');

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.current.lastDashboardRefreshAt).toBeTruthy();
    expect(result.current.lastTrendsRefreshAt).toBeTruthy();
  });

  it('retries with access_token query when backend rejects Authorization header format', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const hasAccessTokenFallback = url.includes('access_token=test-session-token');
      if (!hasAccessTokenFallback) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Missing or malformed Authorization header' }),
        };
      }
      if (url.includes('interface=load-kpi-dashboard')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            output: {
              kpi_cards: [{ key: 'open_work_orders', label: 'Open Work Packages', value: 5, trend: '+1%' }],
              risk_heatmap: { cells: [] },
              trend_lines: [],
              anomaly_flags: [],
              freshness_warning: null,
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          output: {
            time_series: [],
            variance: 0.8,
            threshold_breaches: [],
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.dashboard?.kpi_cards[0]?.label).toBe('Open Work Packages');
    expect(result.current.trends?.variance).toBe(0.8);
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.includes('access_token=test-session-token'))).toBe(true);
  });

  it('surfaces empty JSON payload as stable AMRO KPI error state', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URL(url, 'http://localhost').searchParams;
      const apiInterface = search.get('interface') || 'unknown';

      if (apiInterface === 'load-kpi-dashboard') {
        return {
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected end of JSON input');
          },
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          output: {
            time_series: [],
            variance: 0.5,
            threshold_breaches: [],
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain('Empty response payload from AMRO KPI API');
  });

  it('recovers from transient empty dashboard payload by retrying once', async () => {
    const callCountByInterface: Record<string, number> = {};
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URL(url, 'http://localhost').searchParams;
      const apiInterface = search.get('interface') || 'unknown';
      callCountByInterface[apiInterface] = (callCountByInterface[apiInterface] || 0) + 1;

      if (apiInterface === 'load-kpi-dashboard') {
        if (callCountByInterface[apiInterface] === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => {
              throw new SyntaxError('Unexpected end of JSON input');
            },
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            output: {
              kpi_cards: [{ key: 'open_work_orders', label: 'Open Work Packages', value: 4, trend: '+1%' }],
              risk_heatmap: { cells: [] },
              trend_lines: [],
              anomaly_flags: [],
              freshness_warning: null,
            },
          }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          output: {
            time_series: [],
            variance: 0.3,
            threshold_breaches: [],
          },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAmroOverviewKpi());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.dashboard?.kpi_cards[0]?.label).toBe('Open Work Packages');
    expect(callCountByInterface['load-kpi-dashboard']).toBe(2);
  });
});
