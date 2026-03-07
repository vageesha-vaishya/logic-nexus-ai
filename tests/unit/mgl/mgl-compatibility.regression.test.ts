import { describe, expect, it } from 'vitest';
import { fromLegacyRateOption, toLegacyRateOption } from '../../../src/services/quotation/mgl/compatibility';
import type { RateOption } from '../../../src/types/quote-breakdown';

describe('MGL compatibility regression', () => {
  it('maps MGL option to legacy rate option shape', () => {
    const legacy = toLegacyRateOption({
      id: 'mgl-1',
      carrierName: 'EVERGREEN LINES',
      optionName: 'Carrier Option',
      mode: 'multimodal',
      equipmentColumns: [
        { key: 'standard_20', label: "Standard - 20'" },
        { key: 'open_top_40', label: "Open Top - 40'" },
      ],
      legs: [
        {
          id: 'leg-1',
          sequenceNo: 1,
          mode: 'ocean',
          originCode: 'CNSHA',
          destinationCode: 'USLAX',
        },
      ],
      chargeRows: [
        {
          id: 'row-1',
          rowName: 'Ocean Freight',
          currency: 'USD',
          valuesByEquipment: {
            standard_20: 2000,
            open_top_40: 2000,
          },
        },
      ],
    });

    expect(legacy.id).toBe('mgl-1');
    expect(legacy.carrier).toBe('EVERGREEN LINES');
    expect(legacy.charges?.length).toBeGreaterThan(0);
  });

  it('maps legacy option into MGL structure', () => {
    const legacy: RateOption = {
      id: 'legacy-1',
      carrier: 'MSC',
      name: 'Legacy Option',
      price: 3500,
      total_amount: 3500,
      currency: 'USD',
      transitTime: '21 Days',
      tier: 'contract',
      legs: [],
      charges: [],
    };

    const mapped = fromLegacyRateOption(legacy);

    expect(mapped.id).toBe('legacy-1');
    expect(mapped.carrierName).toBe('MSC');
    expect(mapped.chargeRows[0].valuesByEquipment.standard_20).toBe(3500);
  });
});
