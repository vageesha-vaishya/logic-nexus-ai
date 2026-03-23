import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAmroOverviewKpi } from './useAmroOverviewKpi';

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
  },
}));

describe('useAmroOverviewKpi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads dashboard and trends from the overview KPI endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            kpi_cards: [{ key: 'open_work_packages', label: 'Open Work Packages', value: 42, trend: '+6%' }],
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

  it('exports KPI snapshot through POST interface', async () => {
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
        format: 'pdf',
        dateRange: '2026-03-01T00:00:00.000Z|2026-03-21T00:00:00.000Z',
        selectedWidgets: ['kpi_cards'],
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toContain('interface=export-kpi-snapshot');
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'POST' });
    expect(new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers).get('Content-Type')).toBe('application/json');
    expect(new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers).get('Authorization')).toBe('Bearer test-session-token');
    expect(result.current.lastExport?.export_job_id).toBe('tenant-1-kpi-export-123');
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
              kpi_cards: [{ key: 'open_work_packages', label: 'Open Work Packages', value: 5, trend: '+1%' }],
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
              kpi_cards: [{ key: 'open_work_packages', label: 'Open Work Packages', value: 4, trend: '+1%' }],
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
