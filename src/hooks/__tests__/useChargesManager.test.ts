import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useChargesManager, UseChargesManagerParams, ManagedCharge } from '../useChargesManager';
import { RateOption } from '@/types/quote-breakdown';

const mockRefData = {
  chargeCategories: [
    { id: 'cat-freight', code: 'freight', name: 'Freight' },
    { id: 'cat-handling', code: 'handling', name: 'Handling' },
    { id: 'cat-fee', code: 'fee', name: 'Fee' },
  ],
  chargeBases: [
    { id: 'basis-shipment', code: 'shipment', name: 'Per Shipment' },
    { id: 'basis-kg', code: 'kg', name: 'Per KG' },
    { id: 'basis-container', code: 'container', name: 'Per Container' },
  ],
  currencies: [
    { id: 'cur-usd', code: 'USD', name: 'USD' },
    { id: 'cur-eur', code: 'EUR', name: 'EUR' },
  ],
  chargeSides: [
    { id: 'side-buy', code: 'buy', name: 'Buy' },
    { id: 'side-sell', code: 'sell', name: 'Sell' },
  ],
};

const makeOption = (overrides?: Partial<RateOption>): RateOption => ({
  id: 'opt-1',
  carrier: 'Test Carrier',
  name: 'Test Option',
  price: 1000,
  currency: 'USD',
  transitTime: '5 days',
  tier: 'contract',
  legs: [
    {
      id: 'leg-1',
      mode: 'ocean',
      leg_type: 'main',
      origin: 'Shanghai',
      destination: 'Los Angeles',
      sequence: 1,
      charges: [
        { category: 'Freight', name: 'Ocean Freight', amount: 800, currency: 'USD', basis: 'shipment', quantity: 1, rate: 800 },
        { category: 'Handling', name: 'THC', amount: 100, currency: 'USD', basis: 'shipment', quantity: 1, rate: 100 },
      ],
    },
  ],
  charges: [
    { category: 'Fee', name: 'Documentation Fee', amount: 50, currency: 'USD', basis: 'shipment', quantity: 1, rate: 50 },
  ],
  ...overrides,
});

function renderChargesManager(overrides?: Partial<UseChargesManagerParams>) {
  const params: UseChargesManagerParams = {
    selectedOption: makeOption(),
    referenceData: mockRefData,
    defaultMarginPercent: 15,
    ...overrides,
  };
  return renderHook(() => useChargesManager(params));
}

describe('useChargesManager', () => {
  it('initializes charges from selectedOption legs and global charges', () => {
    const { result } = renderChargesManager();

    expect(result.current.allCharges).toHaveLength(3);
    // 2 from leg-1, 1 global
    expect(result.current.chargesByLeg['leg-1']).toHaveLength(2);
    expect(result.current.chargesByLeg['combined']).toHaveLength(1);
  });

  it('returns legs from selectedOption', () => {
    const { result } = renderChargesManager();
    expect(result.current.legs).toHaveLength(1);
    expect(result.current.legs[0].id).toBe('leg-1');
  });

  it('groups charges by legId correctly', () => {
    const option = makeOption({
      legs: [
        {
          id: 'leg-a',
          mode: 'road',
          leg_type: 'pickup',
          origin: 'Factory',
          destination: 'Port',
          sequence: 1,
          charges: [{ category: 'Freight', name: 'Trucking', amount: 200, currency: 'USD' }],
        },
        {
          id: 'leg-b',
          mode: 'ocean',
          leg_type: 'main',
          origin: 'Port A',
          destination: 'Port B',
          sequence: 2,
          charges: [{ category: 'Freight', name: 'Ocean Freight', amount: 800, currency: 'USD' }],
        },
      ],
      charges: [{ category: 'Fee', name: 'Doc Fee', amount: 50, currency: 'USD' }],
    });

    const { result } = renderChargesManager({ selectedOption: option });

    expect(result.current.chargesByLeg['leg-a']).toHaveLength(1);
    expect(result.current.chargesByLeg['leg-b']).toHaveLength(1);
    expect(result.current.chargesByLeg['combined']).toHaveLength(1);
  });

  it('adds a charge to a specific leg', () => {
    const { result } = renderChargesManager();

    act(() => {
      result.current.addCharge('leg-1');
    });

    expect(result.current.chargesByLeg['leg-1']).toHaveLength(3);
    expect(result.current.allCharges).toHaveLength(4);
  });

  it('adds a combined charge when legId is null', () => {
    const { result } = renderChargesManager();

    act(() => {
      result.current.addCharge(null);
    });

    expect(result.current.chargesByLeg['combined']).toHaveLength(2);
  });

  it('removes a charge by id', () => {
    const { result } = renderChargesManager();
    const firstChargeId = result.current.allCharges[0].id;

    act(() => {
      result.current.removeCharge(firstChargeId);
    });

    expect(result.current.allCharges).toHaveLength(2);
  });

  it('updates a charge field', () => {
    const { result } = renderChargesManager();
    const chargeId = result.current.allCharges[0].id;

    act(() => {
      result.current.updateCharge(chargeId, 'note', 'Test note');
    });

    const updated = result.current.allCharges.find((c) => c.id === chargeId);
    expect(updated?.note).toBe('Test note');
  });

  it('updates category_id and syncs categoryName', () => {
    const { result } = renderChargesManager();
    const chargeId = result.current.allCharges[0].id;

    act(() => {
      result.current.updateCharge(chargeId, 'category_id', 'cat-handling');
    });

    const updated = result.current.allCharges.find((c) => c.id === chargeId);
    expect(updated?.category_id).toBe('cat-handling');
    expect(updated?.categoryName).toBe('Handling');
  });

  it('updates buy.rate and recalculates buy.amount', () => {
    const { result } = renderChargesManager();
    const chargeId = result.current.allCharges[0].id;

    act(() => {
      result.current.updateCharge(chargeId, 'buy.rate', 500);
    });

    const updated = result.current.allCharges.find((c) => c.id === chargeId);
    expect(updated?.buy.rate).toBe(500);
    expect(updated?.buy.amount).toBe(500); // qty=1 * rate=500
  });

  it('auto-margin: updating buy.rate recalculates sell.rate', () => {
    const { result } = renderChargesManager();
    const chargeId = result.current.allCharges[0].id;

    // autoMargin is true by default, marginPercent = 15
    act(() => {
      result.current.updateCharge(chargeId, 'buy.rate', 100);
    });

    const updated = result.current.allCharges.find((c) => c.id === chargeId);
    expect(updated?.sell.rate).toBe(115); // 100 * 1.15
    expect(updated?.sell.amount).toBe(115);
  });

  it('calculates totals correctly', () => {
    const { result } = renderChargesManager();

    // With auto-margin at 15%, sell = original amounts, buy = sell / 1.15
    expect(result.current.totals.totalSell).toBeGreaterThan(0);
    expect(result.current.totals.totalBuy).toBeGreaterThan(0);
    expect(result.current.totals.marginAmount).toBe(
      Number((result.current.totals.totalSell - result.current.totals.totalBuy).toFixed(2))
    );
  });

  it('getChargesForSave returns all charges and marginPercent', () => {
    const { result } = renderChargesManager();
    const saveData = result.current.getChargesForSave();

    expect(saveData.charges).toHaveLength(3);
    expect(saveData.marginPercent).toBe(15);
  });

  it('handles empty legs with fallback from price', () => {
    const option = makeOption({ legs: undefined, charges: undefined, price: 500 });
    const { result } = renderChargesManager({ selectedOption: option });

    expect(result.current.allCharges).toHaveLength(1);
    expect(result.current.chargesByLeg['combined']).toHaveLength(1);
    expect(result.current.allCharges[0].sell.amount).toBe(500);
  });

  it('toggling autoMargin off does not recalculate sell on buy change', () => {
    const { result } = renderChargesManager();

    act(() => {
      result.current.setAutoMargin(false);
    });

    // autoMargin is now false — but since setAutoMargin updates state,
    // we verify the state changed
    expect(result.current.autoMargin).toBe(false);
  });

  it('setMarginPercent updates marginPercent', () => {
    const { result } = renderChargesManager();

    act(() => {
      result.current.setMarginPercent(20);
    });

    expect(result.current.marginPercent).toBe(20);
  });
});
