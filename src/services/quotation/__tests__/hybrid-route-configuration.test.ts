import { describe, expect, it, vi } from 'vitest';
import { buildHybridRouteConfiguration, validateSmartRouteInput } from '@/services/quotation/hybrid-route-configuration';
import type { RateOption } from '@/types/quote-breakdown';

const baseOptions: RateOption[] = [
  {
    id: 'opt-1',
    carrier: 'Unknown Carrier',
    name: 'Generated Option',
    price: 1200,
    total_amount: 1200,
    currency: 'USD',
    transitTime: '12 days',
    tier: 'best_value',
    transport_mode: 'ocean',
    legs: [
      {
        id: 'leg-1',
        mode: 'ocean',
        origin: '',
        destination: '',
      },
    ],
  },
];

describe('hybrid-route-configuration', () => {
  it('validates required smart route fields', () => {
    const errors = validateSmartRouteInput({
      origin: '',
      destination: '',
      mode: '',
    });
    expect(errors).toContain('Origin is required');
    expect(errors).toContain('Destination is required');
    expect(errors).toContain('Mode is required');
  });

  it('recalculates route parameters and selects preferred compatible carrier', async () => {
    const result = await buildHybridRouteConfiguration({
      options: baseOptions,
      routeInput: {
        origin: 'Shanghai',
        destination: 'Rotterdam',
        mode: 'ocean',
        requested_departure_date: '2026-03-20',
        preferred_carriers: ['Maersk'],
        max_options: 3,
      },
      carrierProfiles: [
        { carrier_name: 'Maersk', carrier_type: 'ocean', pricing_index: 1.05, reliability_score: 0.94 },
        { carrier_name: 'Road Partner', carrier_type: 'trucking', pricing_index: 0.95, reliability_score: 0.7 },
      ],
    });

    expect(result.options.length).toBeGreaterThan(0);
    expect(result.options[0].carrier).toBe('Maersk');
    expect(result.options[0].legs?.[0]?.origin).toBe('Shanghai');
    expect(result.options[0].legs?.[0]?.destination).toBe('Rotterdam');
    expect(result.options[0].legs?.[0]?.departure_date).toBe('2026-03-20');
    expect(result.options[0].is_manual).toBe(false);
    expect(result.auditTrail.length).toBeGreaterThan(0);
  });

  it('generates multiple smart alternatives with unique carriers', async () => {
    const result = await buildHybridRouteConfiguration({
      options: baseOptions,
      routeInput: {
        origin: 'Shenzhen',
        destination: 'Hamburg',
        mode: 'ocean',
        requested_departure_date: '2026-04-10',
        max_options: 5,
      },
      carrierProfiles: [
        { carrier_name: 'MSC', carrier_type: 'ocean', pricing_index: 0.92, reliability_score: 0.86 },
        { carrier_name: 'CMA CGM', carrier_type: 'ocean', pricing_index: 0.97, reliability_score: 0.9 },
        { carrier_name: 'Hapag-Lloyd', carrier_type: 'ocean', pricing_index: 1.02, reliability_score: 0.93 },
      ],
    });

    const carriers = new Set(result.options.map((option) => option.carrier));
    expect(result.options.length).toBeGreaterThanOrEqual(3);
    expect(carriers.size).toBeGreaterThanOrEqual(3);
  });

  it('applies realtime API validation and excludes blocked options', async () => {
    const realtimeValidator = vi.fn().mockResolvedValue([
      { option_id: 'opt-1', available: false, price_valid: true, message: 'No vessel space' },
      { option_id: 'opt-1-msc-1', available: true, price_valid: true },
    ]);

    const result = await buildHybridRouteConfiguration({
      options: baseOptions,
      routeInput: {
        origin: 'Busan',
        destination: 'Los Angeles',
        mode: 'ocean',
        requested_departure_date: '2026-05-02',
        max_options: 4,
      },
      carrierProfiles: [
        { carrier_name: 'MSC', carrier_type: 'ocean', pricing_index: 1, reliability_score: 0.9 },
      ],
      realtimeValidator,
    });

    expect(realtimeValidator).toHaveBeenCalledTimes(1);
    expect(result.validationIssues.some((issue) => issue.message.includes('No vessel space'))).toBe(true);
    expect(result.options.some((option) => option.id === 'opt-1')).toBe(false);
  });

  it('returns input errors when required route values are missing', async () => {
    const result = await buildHybridRouteConfiguration({
      options: baseOptions,
      routeInput: {
        origin: '',
        destination: '',
        mode: '',
      },
    });

    expect(result.options).toEqual(baseOptions);
    expect(result.validationIssues.length).toBeGreaterThanOrEqual(3);
    expect(result.validationIssues.every((issue) => issue.severity === 'error')).toBe(true);
  });

  it('emits service and pricing validation warnings and errors', async () => {
    const result = await buildHybridRouteConfiguration({
      options: [
        {
          ...baseOptions[0],
          id: 'opt-air-1',
          carrier: 'Oceanic Carrier',
          transport_mode: 'air',
          total_amount: 0,
          price: 0,
          departure_date: '',
          legs: [
            {
              id: 'air-leg-1',
              mode: 'air',
              origin: '',
              destination: '',
              carrier: 'Oceanic Carrier',
            },
          ],
        },
      ],
      routeInput: {
        origin: 'Singapore',
        destination: 'Frankfurt',
        mode: 'air',
      },
      carrierProfiles: [
        { carrier_name: 'Oceanic Carrier', carrier_type: 'ocean', pricing_index: 1.1, reliability_score: 0.8 },
      ],
      realtimeValidator: vi.fn().mockResolvedValue([
        { option_id: 'opt-air-1', available: true, price_valid: false, message: 'Rate expired' },
      ]),
    });

    expect(result.validationIssues.some((issue) => issue.field === 'service')).toBe(true);
    expect(result.validationIssues.some((issue) => issue.field === 'price')).toBe(true);
    expect(result.options.length).toBe(0);
  });

  it('propagates multi-leg continuity when intermediate locations are missing', async () => {
    const result = await buildHybridRouteConfiguration({
      options: [
        {
          ...baseOptions[0],
          id: 'opt-multi-1',
          carrier: 'Unknown Carrier',
          legs: [
            { id: 'leg-a', mode: 'ocean', origin: 'Shanghai', destination: '' },
            { id: 'leg-b', mode: 'ocean', origin: '', destination: '' },
            { id: 'leg-c', mode: 'ocean', origin: 'Dubai', destination: 'Rotterdam' },
          ],
        },
      ],
      routeInput: {
        origin: 'Shanghai',
        destination: 'Rotterdam',
        mode: 'ocean',
        requested_departure_date: '2026-06-05',
      },
      carrierProfiles: [
        { carrier_name: 'MSC', carrier_type: 'ocean', pricing_index: 1, reliability_score: 0.9 },
      ],
    });

    expect(result.options[0].legs?.length).toBe(3);
    expect(result.options[0].legs?.[1]?.origin).toBeDefined();
    expect(result.options[0].legs?.[0]?.destination).toBeDefined();
  });

  it('uses lower pricing index as tie-breaker when carrier scores are equal', async () => {
    const result = await buildHybridRouteConfiguration({
      options: [
        {
          ...baseOptions[0],
          id: 'opt-tie-1',
          carrier: 'Unknown Carrier',
          legs: [{ id: 'tie-leg-1', mode: 'ocean', origin: 'Xiamen', destination: 'Los Angeles' }],
        },
      ],
      routeInput: {
        origin: 'Xiamen',
        destination: 'Los Angeles',
        mode: 'ocean',
        requested_departure_date: '2026-07-14',
      },
      carrierProfiles: [
        { carrier_name: 'LowPrice', carrier_type: 'ocean', pricing_index: 0.8, reliability_score: 0.8 },
        { carrier_name: 'HighPrice', carrier_type: 'ocean', pricing_index: 1.3, reliability_score: 1.0 },
      ],
    });

    expect(result.options[0].carrier).toBe('LowPrice');
  });

  it('hydrates realtime validation request payload with normalized fallback values', async () => {
    const realtimeValidator = vi.fn().mockResolvedValue([]);
    await buildHybridRouteConfiguration({
      options: [
        {
          ...baseOptions[0],
          id: 'opt-schema-1',
          carrier: '',
          currency: '',
          departure_date: '',
          transport_mode: '',
          legs: [
            {
              id: 'schema-leg-1',
              mode: '',
              origin: '',
              destination: '',
            },
          ],
        },
      ],
      routeInput: {
        origin: 'Shanghai',
        destination: 'Rotterdam',
        mode: 'ocean',
      },
      realtimeValidator,
    });

    expect(realtimeValidator).toHaveBeenCalledTimes(1);
    const request = realtimeValidator.mock.calls[0][0];
    expect(request.route.origin).toBe('Shanghai');
    expect(request.route.destination).toBe('Rotterdam');
    expect(request.route.mode).toBe('ocean');
    expect(request.route.requested_departure_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(request.options[0]).toMatchObject({
      option_id: 'opt-schema-1',
      carrier: 'Unknown Carrier',
      mode: 'ocean',
      origin: 'Shanghai',
      destination: 'Rotterdam',
      currency: 'USD',
    });
    expect(request.options[0].departure_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
