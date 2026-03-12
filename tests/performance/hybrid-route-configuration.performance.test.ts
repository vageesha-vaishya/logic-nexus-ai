import { describe, expect, it } from 'vitest';
import { buildHybridRouteConfiguration } from '../../src/services/quotation/hybrid-route-configuration';
import type { RateOption } from '../../src/types/quote-breakdown';

describe('hybrid-route-configuration performance', () => {
  it('keeps p95 quote generation under 2 seconds for batch requests', async () => {
    const baseOption: RateOption = {
      id: 'perf-opt',
      carrier: 'Unknown Carrier',
      name: 'Perf Option',
      price: 2200,
      total_amount: 2200,
      currency: 'USD',
      transitTime: '14 days',
      tier: 'best_value',
      transport_mode: 'multimodal',
      legs: [
        { id: 'leg-1', mode: 'road', origin: 'Factory A', destination: 'Port A' },
        { id: 'leg-2', mode: 'ocean', origin: 'Port A', destination: 'Port B' },
        { id: 'leg-3', mode: 'road', origin: 'Port B', destination: 'Warehouse Z' },
      ],
    };

    const carrierProfiles = [
      { carrier_name: 'Carrier A', carrier_type: 'trucking', pricing_index: 0.96, reliability_score: 0.88 },
      { carrier_name: 'Carrier B', carrier_type: 'ocean', pricing_index: 1.01, reliability_score: 0.92 },
      { carrier_name: 'Carrier C', carrier_type: 'trucking', pricing_index: 1.04, reliability_score: 0.9 },
      { carrier_name: 'Carrier D', carrier_type: 'ocean', pricing_index: 0.98, reliability_score: 0.86 },
      { carrier_name: 'Carrier E', carrier_type: 'ocean', pricing_index: 1.06, reliability_score: 0.94 },
    ];

    const samples = 120;
    const durations: number[] = [];

    for (let index = 0; index < samples; index += 1) {
      const start = performance.now();
      await buildHybridRouteConfiguration({
        options: [{ ...baseOption, id: `perf-opt-${index}` }],
        routeInput: {
          origin: 'Factory A',
          destination: 'Warehouse Z',
          mode: 'multimodal',
          requested_departure_date: '2026-07-01',
          preferred_carriers: ['Carrier B'],
          max_options: 5,
        },
        carrierProfiles,
      });
      durations.push(performance.now() - start);
    }

    const sorted = [...durations].sort((left, right) => left - right);
    const p95Index = Math.floor(sorted.length * 0.95) - 1;
    const p95 = sorted[Math.max(p95Index, 0)];
    expect(p95).toBeLessThan(2000);
  });
});
