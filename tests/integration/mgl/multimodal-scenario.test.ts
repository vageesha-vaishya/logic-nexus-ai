import { describe, expect, it } from 'vitest';
import { calculateMglQuotation, MGL_DEFAULT_EQUIPMENT_COLUMNS } from '../../../src/services/quotation/mgl/engine';
import type { MglRateOption } from '../../../src/services/quotation/mgl/types';

describe('MGL multimodal scenario integration', () => {
  it('processes multiple carriers and multi-leg options', () => {
    const keys = MGL_DEFAULT_EQUIPMENT_COLUMNS.map((c) => c.key);

    const buildRow = (amount: number) => ({
      id: crypto.randomUUID(),
      rowName: 'Ocean Freight',
      currency: 'USD',
      valuesByEquipment: Object.fromEntries(keys.map((k) => [k, amount])),
    });

    const options: MglRateOption[] = [
      {
        id: 'zim',
        carrierName: 'ZIM',
        rateType: 'spot',
        rateValidUntil: '2099-01-01T00:00:00.000Z',
        mode: 'multimodal',
        equipmentColumns: [...MGL_DEFAULT_EQUIPMENT_COLUMNS],
        legs: [
          { id: '1', sequenceNo: 1, mode: 'ocean', originCode: 'USNYC', destinationCode: 'USLAX' },
          { id: '2', sequenceNo: 2, mode: 'air', originCode: 'USLAX', destinationCode: 'INDED' },
        ],
        chargeRows: [buildRow(2000)],
        containerType: 'standard',
        containerSize: "20'",
        commodityType: 'general',
        originCode: 'USNYC',
        destinationCode: 'INDED',
        standaloneMode: true,
        optionOrdinal: 1,
      },
      {
        id: 'msc',
        carrierName: 'MSC',
        rateType: 'contract',
        rateValidUntil: '2099-01-01T00:00:00.000Z',
        mode: 'multimodal',
        equipmentColumns: [...MGL_DEFAULT_EQUIPMENT_COLUMNS],
        legs: [
          { id: '1', sequenceNo: 1, mode: 'ocean', originCode: 'USNYC', destinationCode: 'USLAX' },
          { id: '2', sequenceNo: 2, mode: 'air', originCode: 'USLAX', destinationCode: 'INDED' },
        ],
        chargeRows: [buildRow(1800)],
        containerType: 'standard',
        containerSize: "20'",
        commodityType: 'general',
        originCode: 'USNYC',
        destinationCode: 'INDED',
        standaloneMode: true,
        optionOrdinal: 2,
      },
      {
        id: 'maersk',
        carrierName: 'MAERSK',
        rateType: 'market',
        rateValidUntil: '2099-01-01T00:00:00.000Z',
        mode: 'multimodal',
        equipmentColumns: [...MGL_DEFAULT_EQUIPMENT_COLUMNS],
        legs: [
          { id: '1', sequenceNo: 1, mode: 'ocean', originCode: 'USNYC', destinationCode: 'USLAX' },
          { id: '2', sequenceNo: 2, mode: 'air', originCode: 'USLAX', destinationCode: 'INDED' },
        ],
        chargeRows: [buildRow(2200)],
        containerType: 'standard',
        containerSize: "20'",
        commodityType: 'general',
        originCode: 'USNYC',
        destinationCode: 'INDED',
        standaloneMode: true,
        optionOrdinal: 3,
      },
      {
        id: 'hapag',
        carrierName: 'HAPAG',
        rateType: 'negotiated',
        rateValidUntil: '2099-01-01T00:00:00.000Z',
        mode: 'multimodal',
        equipmentColumns: [...MGL_DEFAULT_EQUIPMENT_COLUMNS],
        legs: [
          { id: '1', sequenceNo: 1, mode: 'ocean', originCode: 'USNYC', destinationCode: 'USLAX' },
          { id: '2', sequenceNo: 2, mode: 'air', originCode: 'USLAX', destinationCode: 'INDED' },
        ],
        chargeRows: [buildRow(2400)],
        containerType: 'standard',
        containerSize: "20'",
        commodityType: 'general',
        originCode: 'USNYC',
        destinationCode: 'INDED',
        standaloneMode: true,
        optionOrdinal: 4,
      },
    ];

    const results = calculateMglQuotation(options);

    expect(results).toHaveLength(4);
    expect(results.every((r) => r.validation.valid)).toBe(true);
    expect(results[0].calculated.totalsByEquipment.standard_20).toBe(2000);
    expect(results[1].calculated.totalsByEquipment.standard_20).toBe(1800);
  });
});
