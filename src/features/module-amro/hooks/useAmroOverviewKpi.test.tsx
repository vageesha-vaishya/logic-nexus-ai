import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAmroOverviewKpi } from './useAmroOverviewKpi';

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

    const { result } = renderHook(() => useAmroOverviewKpi());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v2/amro/overview-kpi?');
    expect(String(fetchMock.mock.calls[0][0])).toContain('interface=load-kpi-dashboard');
    expect(String(fetchMock.mock.calls[1][0])).toContain('interface=load-operational-trends');
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
});
