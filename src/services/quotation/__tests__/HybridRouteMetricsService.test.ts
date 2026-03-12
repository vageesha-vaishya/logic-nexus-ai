import { describe, expect, it, vi } from 'vitest';
import { HybridRouteMetricsService } from '@/services/quotation/HybridRouteMetricsService';

describe('HybridRouteMetricsService', () => {
  it('records quote generation metrics', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const db = {
      from: vi.fn(() => ({ insert })),
    } as any;
    const service = new HybridRouteMetricsService(db);

    await service.record({
      tenant_id: 'tenant-1',
      request_id: 'req-1',
      mode: 'ocean',
      smart_mode: true,
      duration_ms: 932,
      total_options: 3,
      issues_count: 0,
      unknown_carrier_count: 0,
      route_gap_count: 0,
      status: 'success',
      timeline: [{ stage: 'request_started', elapsed_ms: 2 }],
    });

    expect(db.from).toHaveBeenCalledWith('quote_generation_metrics');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        request_id: 'req-1',
        smart_mode: true,
      })
    );
  });

  it('returns zero summary when no metrics are present', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const gte = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ gte }));
    const select = vi.fn(() => ({ eq }));
    const db = {
      from: vi.fn(() => ({ select })),
    } as any;
    const service = new HybridRouteMetricsService(db);

    const summary = await service.getSummary('tenant-1');

    expect(summary.totalRequests).toBe(0);
    expect(summary.successRate).toBe(0);
    expect(summary.p95DurationMs).toBe(0);
    expect(summary.averageOptions).toBe(0);
  });

  it('computes p95 and incident totals from metrics rows', async () => {
    const rows = [
      { duration_ms: 950, total_options: 2, status: 'success', unknown_carrier_count: 0, route_gap_count: 0 },
      { duration_ms: 1100, total_options: 3, status: 'success', unknown_carrier_count: 1, route_gap_count: 0 },
      { duration_ms: 1800, total_options: 4, status: 'success', unknown_carrier_count: 0, route_gap_count: 1 },
      { duration_ms: 2200, total_options: 1, status: 'failure', unknown_carrier_count: 2, route_gap_count: 2 },
      { duration_ms: 1400, total_options: 5, status: 'success', unknown_carrier_count: 0, route_gap_count: 0 },
    ];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const gte = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ gte }));
    const select = vi.fn(() => ({ eq }));
    const db = {
      from: vi.fn(() => ({ select })),
    } as any;
    const service = new HybridRouteMetricsService(db);

    const summary = await service.getSummary('tenant-1');

    expect(summary.totalRequests).toBe(5);
    expect(summary.successfulRequests).toBe(4);
    expect(summary.failedRequests).toBe(1);
    expect(summary.successRate).toBe(80);
    expect(summary.p95DurationMs).toBe(1800);
    expect(summary.p50DurationMs).toBe(1100);
    expect(summary.unknownCarrierIncidents).toBe(3);
    expect(summary.routeGapIncidents).toBe(3);
  });
});
