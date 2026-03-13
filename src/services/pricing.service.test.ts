import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingService, type MarginRule } from './pricing.service';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('PricingService', () => {
  beforeEach(() => {
    PricingService.clearCache();
  });

  it('caches margin rules and reuses cached result inside TTL window', async () => {
    const rules: MarginRule[] = [
      {
        id: 'rule-1',
        name: 'Air Premium',
        condition_json: { mode: 'air' },
        adjustment_type: 'percent',
        adjustment_value: 12,
        priority: 10,
      },
    ];

    const order = vi.fn().mockResolvedValue({ data: rules, error: null });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as unknown as SupabaseClient;

    const service = new PricingService(supabase);
    const first = await service.getMarginRules();
    const second = await service.getMarginRules();

    expect(first).toEqual(rules);
    expect(second).toEqual(rules);
    expect(from).toHaveBeenCalledTimes(1);
    expect(order).toHaveBeenCalledWith('priority', { ascending: false });
  });

  it('resolves only rules matching full condition set', async () => {
    const rules: MarginRule[] = [
      {
        id: 'rule-air-fr',
        name: 'Air France',
        condition_json: { mode: 'air', country: 'FR' },
        adjustment_type: 'percent',
        adjustment_value: 8,
        priority: 5,
      },
      {
        id: 'rule-ocean',
        name: 'Ocean Default',
        condition_json: { mode: 'ocean' },
        adjustment_type: 'fixed',
        adjustment_value: 40,
        priority: 3,
      },
    ];

    const order = vi.fn().mockResolvedValue({ data: rules, error: null });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    const service = new PricingService({ from } as unknown as SupabaseClient);

    const matched = await service.resolveMarginRules({ mode: 'air', country: 'FR', lane: 'CDG-JFK' });
    expect(matched.map((rule) => rule.id)).toEqual(['rule-air-fr']);
  });

  it('calculates sell-based and cost-based financial models', async () => {
    const service = new PricingService({ from: vi.fn() } as unknown as SupabaseClient);

    const costBased = await service.calculateFinancials(100, 20, true);
    expect(costBased.buyPrice).toBe(100);
    expect(costBased.sellPrice).toBe(125);
    expect(costBased.marginAmount).toBe(25);
    expect(costBased.marginPercent).toBe(20);

    const sellBased = await service.calculateFinancials(1000, 10, false);
    expect(sellBased.sellPrice).toBe(1000);
    expect(sellBased.buyPrice).toBe(900);
    expect(sellBased.marginAmount).toBe(100);
    expect(sellBased.marginPercent).toBe(10);
  });

  it('falls back to client-side pricing when RPC fails after retries', async () => {
    const rpc = vi.fn().mockRejectedValue(new Error('RPC unavailable'));
    const single = vi.fn().mockResolvedValue({
      data: { base_price: 100, pricing_config: { model: 'tiered' } },
      error: null,
    });
    const servicePricingLimit = vi.fn().mockResolvedValue({
      data: [
        {
          min_quantity: 5,
          max_quantity: 100,
          unit_price: 80,
        },
      ],
      error: null,
    });
    const servicePricingOrder = vi.fn().mockReturnValue({ limit: servicePricingLimit });
    const servicePricingLte = vi.fn().mockReturnValue({ order: servicePricingOrder });
    const servicePricingEq = vi.fn().mockReturnValue({ lte: servicePricingLte });
    const servicePricingSelect = vi.fn().mockReturnValue({ eq: servicePricingEq });

    const servicesEq = vi.fn().mockReturnValue({ single });
    const servicesSelect = vi.fn().mockReturnValue({ eq: servicesEq });
    const from = vi.fn((table: string) => {
      if (table === 'services') {
        return { select: servicesSelect };
      }
      if (table === 'service_pricing_tiers') {
        return { select: servicePricingSelect };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const service = new PricingService({ rpc, from } as unknown as SupabaseClient);
    const result = await service.calculatePrice({ service_id: 'svc-1', quantity: 12, currency: 'USD' }, 1);

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(result.unit_price).toBe(80);
    expect(result.total_price).toBe(960);
    expect(result.pricing_model).toBe('tiered');
    expect(result.warnings).toEqual(['Calculated client-side (RPC unavailable)']);
    expect(servicePricingLte).toHaveBeenCalledWith('min_quantity', 12);
  });
});
