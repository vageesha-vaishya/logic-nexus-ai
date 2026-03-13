import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuoteOptionService } from './QuoteOptionService';
import { PricingService } from './pricing.service';
import type { SupabaseClient } from '@supabase/supabase-js';

const UUID = {
  option: '11111111-1111-4111-8111-111111111111',
  legRoad: '22222222-2222-4222-8222-222222222222',
  legAir: '33333333-3333-4333-8333-333333333333',
  currency: '44444444-4444-4444-8444-444444444444',
  serviceRoad: '55555555-5555-4555-8555-555555555555',
  serviceAir: '66666666-6666-4666-8666-666666666666',
  provider: '77777777-7777-4777-8777-777777777777',
  modeRoad: '88888888-8888-4888-8888-888888888888',
  modeAir: '99999999-9999-4999-8999-999999999999',
  buySide: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  sellSide: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  category: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  basis: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
};

vi.mock('@/lib/quote-mapper', () => ({
  mapOptionToQuote: vi.fn((rate) => rate),
}));

vi.mock('@/lib/charge-bifurcation', () => ({
  matchLegForCharge: vi.fn((chargeKey: string, legs: Array<{ id: string }>) => {
    if (chargeKey.toLowerCase().includes('delivery')) {
      return legs[legs.length - 1];
    }
    return legs[0];
  }),
}));

vi.mock('@/lib/services/quote-transform.service', () => ({
  QuoteTransformService: {
    resolveServiceTypeId: vi.fn((mode: string) => (mode === 'air' ? UUID.serviceAir : UUID.serviceRoad)),
    resolveCarrierId: vi.fn(() => UUID.provider),
    validateCarrierMode: vi.fn(() => ({ valid: true })),
    resolvePortId: vi.fn(() => null),
  },
}));

vi.mock('@/lib/transit-time', () => ({
  parseTransitTimeToDays: vi.fn(() => 5),
  parseTransitTimeToHours: vi.fn(() => 120),
}));

describe('QuoteOptionService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('persists mode-specific legs and charge unit details for leg-level and global charges', async () => {
    const quotationOptionHeaderInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: UUID.option }, error: null }),
      }),
    });
    const quotationOptionUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const quotationLegsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: UUID.legRoad, mode_id: UUID.modeRoad, leg_type: 'transport', sort_order: 1, mode: 'road' },
          { id: UUID.legAir, mode_id: UUID.modeAir, leg_type: 'transport', sort_order: 2, mode: 'air' },
        ],
        error: null,
      }),
    });
    const quoteChargesInsert = vi.fn().mockResolvedValue({ data: [], error: null });

    const from = vi.fn((table: string) => {
      if (table === 'quotation_version_options') {
        return { insert: quotationOptionHeaderInsert, update: quotationOptionUpdate };
      }
      if (table === 'quotation_version_option_legs') {
        return { insert: quotationLegsInsert };
      }
      if (table === 'quote_charges') {
        return { insert: quoteChargesInsert };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {}, error: null }) }) }),
      };
    });

    vi.spyOn(PricingService.prototype, 'calculateFinancials').mockImplementation(async (amount: number) => ({
      sellPrice: Number(amount.toFixed(2)),
      buyPrice: Number((amount * 0.8).toFixed(2)),
      marginAmount: Number((amount * 0.2).toFixed(2)),
      marginPercent: 20,
    }));

    const service = new QuoteOptionService({ from } as unknown as SupabaseClient);
    const rateMapper = {
      getCurrId: vi.fn(() => UUID.currency),
      getServiceTypeId: vi.fn((mode: string) => (mode === 'air' ? UUID.serviceAir : UUID.serviceRoad)),
      getProviderId: vi.fn(() => UUID.provider),
      getModeId: vi.fn((mode: string) => (mode === 'air' ? UUID.modeAir : UUID.modeRoad)),
      getSideId: vi.fn((side: string) => (side === 'sell' || side === 'revenue' ? UUID.sellSide : UUID.buySide)),
      getCatId: vi.fn(() => UUID.category),
      getBasisId: vi.fn(() => UUID.basis),
    };

    const optionId = await service.addOptionToVersion({
      tenantId: 'tenant-1',
      versionId: 'version-1',
      source: 'smart_quote',
      rate: {
        carrier: 'Carrier-X',
        currency: 'USD',
        total_amount: 250,
        buyPrice: 200,
        marginAmount: 50,
        markupPercent: 25,
        mode: 'air',
        legs: [
          {
            mode: 'air',
            sequence: 2,
            charges: [{ name: 'Main Freight', amount: 100, unit: 'kg' }],
          },
          {
            mode: 'road',
            sequence: 1,
            charges: [{ name: 'Delivery Fee', amount: 50, basis: 'PER_SHIPMENT' }],
          },
        ],
        charges: [{ name: 'Documentation', amount: 100, unit: 'file' }],
      },
      rateMapper,
      context: { origin: 'Paris', destination: 'New York' },
    });

    expect(optionId).toBe(UUID.option);
    expect(quotationLegsInsert).toHaveBeenCalledTimes(1);
    const insertedLegs = quotationLegsInsert.mock.calls[0][0];
    expect(insertedLegs).toHaveLength(2);
    expect(insertedLegs[0].mode).toBe('road');
    expect(insertedLegs[1].mode).toBe('air');

    expect(quoteChargesInsert).toHaveBeenCalledTimes(1);
    const insertedCharges = quoteChargesInsert.mock.calls[0][0] as Array<{ leg_id: string; charge_side_id: string; unit?: string; amount?: number }>;
    expect(insertedCharges.length).toBeGreaterThanOrEqual(6);
    expect(insertedCharges.some((charge) => charge.unit === 'kg')).toBe(true);
    expect(insertedCharges.some((charge) => charge.unit === 'PER_SHIPMENT')).toBe(true);
    expect(insertedCharges.some((charge) => charge.unit === 'file')).toBe(true);
    expect(insertedCharges.some((charge) => charge.leg_id === UUID.legRoad)).toBe(true);
    expect(insertedCharges.some((charge) => charge.leg_id === UUID.legAir)).toBe(true);
    expect(insertedCharges.some((charge) => charge.charge_side_id === UUID.buySide)).toBe(true);
    expect(insertedCharges.some((charge) => charge.charge_side_id === UUID.sellSide)).toBe(true);
  });

  it('handles malformed mixed-version charge payloads with resilient basis and category fallback', async () => {
    const quotationOptionHeaderInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: UUID.option }, error: null }),
      }),
    });
    const quotationOptionUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const quotationLegsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: UUID.legAir, mode_id: UUID.modeAir, leg_type: 'main', sort_order: 1, mode: 'air' }],
        error: null,
      }),
    });
    const quoteChargesInsert = vi.fn().mockResolvedValue({ data: [], error: null });

    const from = vi.fn((table: string) => {
      if (table === 'quotation_version_options') {
        return { insert: quotationOptionHeaderInsert, update: quotationOptionUpdate };
      }
      if (table === 'quotation_version_option_legs') {
        return { insert: quotationLegsInsert };
      }
      if (table === 'quote_charges') {
        return { insert: quoteChargesInsert };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {}, error: null }) }) }),
      };
    });

    vi.spyOn(PricingService.prototype, 'calculateFinancials').mockImplementation(async (amount: number) => ({
      sellPrice: Number(amount.toFixed(2)),
      buyPrice: Number((amount * 0.85).toFixed(2)),
      marginAmount: Number((amount * 0.15).toFixed(2)),
      marginPercent: 15,
    }));

    const getCatId = vi.fn(() => null);
    const getBasisId = vi.fn((basis: string) => (basis === 'PER_SHIPMENT' ? UUID.basis : null));
    const rateMapper = {
      getCurrId: vi.fn(() => UUID.currency),
      getServiceTypeId: vi.fn(() => UUID.serviceAir),
      getProviderId: vi.fn(() => UUID.provider),
      getModeId: vi.fn(() => UUID.modeAir),
      getSideId: vi.fn((side: string) => (side === 'sell' || side === 'revenue' ? UUID.sellSide : UUID.buySide)),
      getCatId,
      getBasisId,
    };

    const service = new QuoteOptionService({ from } as unknown as SupabaseClient);
    const optionId = await service.addOptionToVersion({
      tenantId: 'tenant-1',
      versionId: 'version-2',
      source: 'manual',
      rate: {
        carrier: 'Carrier-Z',
        currency: 'USD',
        total_amount: 1200,
        mode: 'air',
        charges: [
          { code: 'FREIGHT', price: 1000, basis: 'PER_SHIPMENT' },
          { name: 'Documentation', amount: 120, unit: null, legacy_amount: 130 },
          { name: 'Unknown Fee', amount: 80, basis: 'PER_MYSTERY', unit: null },
        ],
      },
      rateMapper,
      context: { categories: [{ id: UUID.category }], origin: 'Paris', destination: 'New York' },
    });

    expect(optionId).toBe(UUID.option);
    expect(quoteChargesInsert).toHaveBeenCalledTimes(1);
    const insertedCharges = quoteChargesInsert.mock.calls[0][0] as Array<{
      category_id: string;
      basis_id: string | null;
      unit?: string | null;
      charge_side_id: string;
      amount: number;
      note?: string;
    }>;
    expect(insertedCharges.length).toBe(6);
    expect(insertedCharges.every((charge) => charge.category_id === UUID.category)).toBe(true);
    expect(insertedCharges.some((charge) => charge.basis_id === UUID.basis)).toBe(true);
    expect(insertedCharges.some((charge) => charge.unit === 'PER_MYSTERY')).toBe(true);
    expect(insertedCharges.some((charge) => charge.note?.toLowerCase().includes('unknown fee'))).toBe(true);
    expect(insertedCharges.some((charge) => charge.charge_side_id === UUID.buySide)).toBe(true);
    expect(insertedCharges.some((charge) => charge.charge_side_id === UUID.sellSide)).toBe(true);
    expect(getBasisId).toHaveBeenCalledWith('PER_SHIPMENT');
  });

  it('throws when carrier mode validation fails for a mapped leg carrier', async () => {
    const { QuoteTransformService } = await import('@/lib/services/quote-transform.service');
    vi.mocked(QuoteTransformService.validateCarrierMode).mockReturnValue({
      valid: false,
      error: 'Carrier mode mismatch',
    });

    const quotationOptionHeaderInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: UUID.option }, error: null }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'quotation_version_options') {
        return {
          insert: quotationOptionHeaderInsert,
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        };
      }
      if (table === 'quotation_version_option_legs') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      };
    });

    const service = new QuoteOptionService({ from } as unknown as SupabaseClient);
    const rateMapper = {
      getCurrId: vi.fn(() => UUID.currency),
      getServiceTypeId: vi.fn(() => null),
      getProviderId: vi.fn(() => UUID.provider),
      getModeId: vi.fn(() => UUID.modeRoad),
      getSideId: vi.fn(() => UUID.sellSide),
      getCatId: vi.fn(() => UUID.category),
      getBasisId: vi.fn(() => UUID.basis),
    };

    await expect(
      service.addOptionToVersion({
        tenantId: 'tenant-1',
        versionId: 'version-3',
        source: 'manual',
        rate: {
          carrier: 'Blocked Carrier',
          currency: 'USD',
          total_amount: 400,
          mode: 'road',
          legs: [{ mode: 'road', sequence: 1 }],
        },
        rateMapper,
        context: {
          carriers: [{ id: UUID.provider, carrier_name: 'Blocked Carrier' }],
          serviceTypes: [],
        },
      }),
    ).rejects.toThrow(/carrier/i);
  });

  it('maps nested price breakdown to explicit legs and adds balancing charge', async () => {
    const quotationOptionHeaderInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: UUID.option }, error: null }),
      }),
    });
    const quotationOptionUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const quotationOptionUpdate = vi.fn().mockReturnValue({ eq: quotationOptionUpdateEq });
    const quotationLegsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: UUID.legRoad, mode_id: UUID.modeRoad, leg_type: 'transport', sort_order: 1, mode: 'road' },
          { id: UUID.legAir, mode_id: UUID.modeAir, leg_type: 'transport', sort_order: 2, mode: 'air' },
        ],
        error: null,
      }),
    });
    const quoteChargesInsert = vi.fn().mockResolvedValue({ data: [], error: null });
    const quotationVersionSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { anomalies: [] }, error: null }),
      }),
    });
    const quotationVersionUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });

    const from = vi.fn((table: string) => {
      if (table === 'quotation_version_options') {
        return { insert: quotationOptionHeaderInsert, update: quotationOptionUpdate };
      }
      if (table === 'quotation_version_option_legs') {
        return { insert: quotationLegsInsert };
      }
      if (table === 'quote_charges') {
        return { insert: quoteChargesInsert };
      }
      if (table === 'quotation_versions') {
        return { select: quotationVersionSelect, update: quotationVersionUpdate };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      };
    });

    vi.spyOn(PricingService.prototype, 'calculateFinancials').mockImplementation(async (amount: number) => ({
      sellPrice: Number(amount.toFixed(2)),
      buyPrice: Number((amount * 0.9).toFixed(2)),
      marginAmount: Number((amount * 0.1).toFixed(2)),
      marginPercent: 10,
    }));

    const service = new QuoteOptionService({ from } as unknown as SupabaseClient);
    const rateMapper = {
      getCurrId: vi.fn(() => UUID.currency),
      getServiceTypeId: vi.fn((mode: string) => (mode === 'air' ? UUID.serviceAir : UUID.serviceRoad)),
      getProviderId: vi.fn(() => UUID.provider),
      getModeId: vi.fn((mode: string) => (mode === 'air' ? UUID.modeAir : UUID.modeRoad)),
      getSideId: vi.fn((side: string) => (side === 'sell' || side === 'revenue' ? UUID.sellSide : UUID.buySide)),
      getCatId: vi.fn(() => UUID.category),
      getBasisId: vi.fn(() => UUID.basis),
    };

    await service.addOptionToVersion({
      tenantId: 'tenant-1',
      versionId: 'version-4',
      source: 'smart_quote',
      rate: {
        carrier: 'Carrier-B',
        currency: 'USD',
        total_amount: 500,
        mode: 'road',
        legs: [{ mode: 'road', sequence: 1 }, { mode: 'air', sequence: 2 }],
        price_breakdown: {
          legs_0: { handling: { amount: 120, unit: 'kg' } },
          legs_1: { linehaul: { amount: 200, unit: 'kg', leg_index: 1 } },
        },
      },
      rateMapper,
      context: { origin: 'Paris', destination: 'New York' },
    });

    expect(quoteChargesInsert).toHaveBeenCalledTimes(1);
    const insertedCharges = quoteChargesInsert.mock.calls[0][0] as Array<{ leg_id: string; note?: string; amount?: number }>;
    expect(insertedCharges.some((charge) => charge.leg_id === UUID.legRoad)).toBe(true);
    expect(insertedCharges.some((charge) => charge.leg_id === UUID.legAir)).toBe(true);
    expect(insertedCharges.some((charge) => charge.note?.toLowerCase().includes('unitemized'))).toBe(true);
    expect(quotationOptionUpdate).toHaveBeenCalled();
    expect(quotationOptionUpdateEq).toHaveBeenCalled();
  });

  it('routes pickup and delivery breakdown charges to first and last legs', async () => {
    const { matchLegForCharge } = await import('@/lib/charge-bifurcation');
    vi.mocked(matchLegForCharge).mockReturnValue(null);

    const quotationOptionHeaderInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: UUID.option }, error: null }),
      }),
    });
    const quotationOptionUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
    const quotationLegsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: UUID.legRoad, mode_id: UUID.modeRoad, leg_type: 'transport', sort_order: 1, mode: 'road' },
          { id: UUID.legAir, mode_id: UUID.modeAir, leg_type: 'transport', sort_order: 2, mode: 'air' },
        ],
        error: null,
      }),
    });
    const quoteChargesInsert = vi.fn().mockResolvedValue({ data: [], error: null });

    const from = vi.fn((table: string) => {
      if (table === 'quotation_version_options') {
        return { insert: quotationOptionHeaderInsert, update: quotationOptionUpdate };
      }
      if (table === 'quotation_version_option_legs') {
        return { insert: quotationLegsInsert };
      }
      if (table === 'quote_charges') {
        return { insert: quoteChargesInsert };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      };
    });

    vi.spyOn(PricingService.prototype, 'calculateFinancials').mockImplementation(async (amount: number) => ({
      sellPrice: Number(amount.toFixed(2)),
      buyPrice: Number((amount * 0.9).toFixed(2)),
      marginAmount: Number((amount * 0.1).toFixed(2)),
      marginPercent: 10,
    }));

    const service = new QuoteOptionService({ from } as unknown as SupabaseClient);
    const rateMapper = {
      getCurrId: vi.fn(() => UUID.currency),
      getServiceTypeId: vi.fn(() => UUID.serviceRoad),
      getProviderId: vi.fn(() => UUID.provider),
      getModeId: vi.fn(() => UUID.modeRoad),
      getSideId: vi.fn((side: string) => (side === 'sell' || side === 'revenue' ? UUID.sellSide : UUID.buySide)),
      getCatId: vi.fn(() => UUID.category),
      getBasisId: vi.fn(() => UUID.basis),
    };

    await service.addOptionToVersion({
      tenantId: 'tenant-1',
      versionId: 'version-5',
      source: 'manual',
      rate: {
        carrier: 'Carrier-C',
        currency: 'USD',
        total_amount: 300,
        mode: 'road',
        legs: [{ mode: 'road', sequence: 1 }, { mode: 'road', sequence: 2 }],
        charges: [],
        price_breakdown: {
          total: 999,
          origin_pickup_fee: 100,
          destination_delivery_fee: 120,
        },
      },
      rateMapper,
      context: { origin: 'Lyon', destination: 'Berlin' },
    });

    const insertedCharges = quoteChargesInsert.mock.calls[0][0] as Array<{ leg_id: string; note?: string }>;
    expect(insertedCharges.some((charge) => charge.leg_id === UUID.legRoad)).toBe(true);
    expect(insertedCharges.some((charge) => charge.leg_id === UUID.legAir)).toBe(true);
    expect(insertedCharges.some((charge) => charge.note?.toLowerCase().includes('origin pickup fee'))).toBe(true);
    expect(insertedCharges.some((charge) => charge.note?.toLowerCase().includes('destination delivery fee'))).toBe(true);
  });

  it('skips insertion when charge-side mapping is invalid and resolves explicit leg index from numeric breakdown', async () => {
    const quotationOptionHeaderInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: UUID.option }, error: null }),
      }),
    });
    const quotationOptionUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
    const quotationLegsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: UUID.legRoad, mode_id: UUID.modeRoad, leg_type: 'transport', sort_order: 1, mode: 'road' },
          { id: UUID.legAir, mode_id: UUID.modeAir, leg_type: 'transport', sort_order: 2, mode: 'air' },
        ],
        error: null,
      }),
    });
    const quoteChargesInsert = vi.fn().mockResolvedValue({ data: [], error: null });

    const from = vi.fn((table: string) => {
      if (table === 'quotation_version_options') {
        return { insert: quotationOptionHeaderInsert, update: quotationOptionUpdate };
      }
      if (table === 'quotation_version_option_legs') {
        return { insert: quotationLegsInsert };
      }
      if (table === 'quote_charges') {
        return { insert: quoteChargesInsert };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      };
    });

    vi.spyOn(PricingService.prototype, 'calculateFinancials').mockImplementation(async (amount: number) => ({
      sellPrice: Number(amount.toFixed(2)),
      buyPrice: Number((amount * 0.9).toFixed(2)),
      marginAmount: Number((amount * 0.1).toFixed(2)),
      marginPercent: 10,
    }));

    const service = new QuoteOptionService({ from } as unknown as SupabaseClient);
    const invalidSideMapper = {
      getCurrId: vi.fn(() => UUID.currency),
      getServiceTypeId: vi.fn(() => UUID.serviceRoad),
      getProviderId: vi.fn(() => UUID.provider),
      getModeId: vi.fn(() => UUID.modeRoad),
      getSideId: vi.fn(() => null),
      getCatId: vi.fn(() => UUID.category),
      getBasisId: vi.fn(() => UUID.basis),
    };

    await service.addOptionToVersion({
      tenantId: 'tenant-1',
      versionId: 'version-7',
      source: 'manual',
      rate: {
        carrier: 'Carrier-E',
        currency: 'USD',
        total_amount: 200,
        mode: 'road',
        charges: [{ name: 'Impossible Side Charge', amount: 200 }],
      },
      rateMapper: invalidSideMapper,
      context: { origin: 'Rome', destination: 'Oslo' },
    });

    expect(quoteChargesInsert).not.toHaveBeenCalled();

    const validSideMapper = {
      ...invalidSideMapper,
      getSideId: vi.fn((side: string) => (side === 'sell' || side === 'revenue' ? UUID.sellSide : UUID.buySide)),
    };

    await service.addOptionToVersion({
      tenantId: 'tenant-1',
      versionId: 'version-8',
      source: 'manual',
      rate: {
        carrier: 'Carrier-F',
        currency: 'USD',
        total_amount: 90,
        mode: 'road',
        charges: [],
        price_breakdown: {
          legs_1: {
            handling_fee: 45,
          },
        },
      },
      rateMapper: validSideMapper,
      context: { origin: 'Rome', destination: 'Oslo' },
    });

    expect(quoteChargesInsert).toHaveBeenCalledTimes(1);
    const insertedCharges = quoteChargesInsert.mock.calls[0][0] as Array<{ leg_id: string; note?: string }>;
    expect(insertedCharges.some((charge) => charge.leg_id === UUID.legAir)).toBe(true);
    expect(insertedCharges.some((charge) => charge.note?.toLowerCase().includes('legs 1 handling fee'))).toBe(true);
  });

  it('records transfer mismatch anomaly when inserted sell total diverges from incoming amount', async () => {
    const quotationOptionHeaderInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: UUID.option }, error: null }),
      }),
    });
    const quotationOptionUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) });
    const quotationLegsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: UUID.legRoad, mode_id: UUID.modeRoad, leg_type: 'transport', sort_order: 1, mode: 'road' }],
        error: null,
      }),
    });
    const quoteChargesInsert = vi.fn().mockResolvedValue({ data: [], error: null });
    const quotationVersionSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { anomalies: [] }, error: null }),
      }),
    });
    const quotationVersionUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const quotationVersionUpdate = vi.fn().mockReturnValue({ eq: quotationVersionUpdateEq });

    const from = vi.fn((table: string) => {
      if (table === 'quotation_version_options') {
        return { insert: quotationOptionHeaderInsert, update: quotationOptionUpdate };
      }
      if (table === 'quotation_version_option_legs') {
        return { insert: quotationLegsInsert };
      }
      if (table === 'quote_charges') {
        return { insert: quoteChargesInsert };
      }
      if (table === 'quotation_versions') {
        return { select: quotationVersionSelect, update: quotationVersionUpdate };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        }),
      };
    });

    vi.spyOn(PricingService.prototype, 'calculateFinancials').mockImplementation(async (amount: number) => ({
      sellPrice: Number((amount * 2).toFixed(2)),
      buyPrice: Number(amount.toFixed(2)),
      marginAmount: Number(amount.toFixed(2)),
      marginPercent: 50,
    }));

    const service = new QuoteOptionService({ from } as unknown as SupabaseClient);
    const rateMapper = {
      getCurrId: vi.fn(() => UUID.currency),
      getServiceTypeId: vi.fn(() => UUID.serviceRoad),
      getProviderId: vi.fn(() => UUID.provider),
      getModeId: vi.fn(() => UUID.modeRoad),
      getSideId: vi.fn((side: string) => (side === 'sell' || side === 'revenue' ? UUID.sellSide : UUID.buySide)),
      getCatId: vi.fn(() => UUID.category),
      getBasisId: vi.fn(() => UUID.basis),
    };

    await service.addOptionToVersion({
      tenantId: 'tenant-1',
      versionId: 'version-6',
      source: 'manual',
      rate: {
        carrier: 'Carrier-D',
        currency: 'USD',
        total_amount: 150,
        mode: 'road',
        charges: [{ name: 'Flat Freight', amount: 150 }],
      },
      rateMapper,
      context: { origin: 'Rotterdam', destination: 'Madrid' },
    });

    expect(quotationVersionSelect).toHaveBeenCalled();
    expect(quotationVersionUpdate).toHaveBeenCalled();
    expect(quotationVersionUpdateEq).toHaveBeenCalledWith('id', 'version-6');
  });
});
