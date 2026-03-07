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
        mode: 'multimodal',
        equipmentColumns: [...MGL_DEFAULT_EQUIPMENT_COLUMNS],
        legs: [
          { id: '1', sequenceNo: 1, mode: 'ocean', originCode: 'CNSHA', destinationCode: 'USLAX' },
          { id: '2', sequenceNo: 2, mode: 'road', originCode: 'USLAX', destinationCode: 'USLGB' },
        ],
        chargeRows: [buildRow(2000)],
      },
      {
        id: 'msc',
        carrierName: 'MSC',
        mode: 'multimodal',
        equipmentColumns: [...MGL_DEFAULT_EQUIPMENT_COLUMNS],
        legs: [
          { id: '1', sequenceNo: 1, mode: 'ocean', originCode: 'CNSHA', destinationCode: 'USLAX' },
          { id: '2', sequenceNo: 2, mode: 'road', originCode: 'USLAX', destinationCode: 'USLGB' },
        ],
        chargeRows: [buildRow(1800)],
      },
    ];

    const results = calculateMglQuotation(options);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.validation.valid)).toBe(true);
    expect(results[0].calculated.totalsByEquipment.standard_20).toBe(2000);
    expect(results[1].calculated.totalsByEquipment.standard_20).toBe(1800);
  });
});
