import { describe, expect, it } from 'vitest';
import {
  MGL_DEFAULT_EQUIPMENT_COLUMNS,
  calculateMglRateOption,
  validateMglRateOption,
} from '../../../src/services/quotation/mgl/engine';
import type { MglRateOption } from '../../../src/services/quotation/mgl/types';

function makeOption(): MglRateOption {
  const keys = MGL_DEFAULT_EQUIPMENT_COLUMNS.map((c) => c.key);
  const values = Object.fromEntries(keys.map((k) => [k, 2000]));
  const trucking = Object.fromEntries(keys.map((k) => [k, 1500]));

  return {
    id: 'opt-1',
    carrierName: 'ZIM',
    mode: 'multimodal',
    equipmentColumns: [...MGL_DEFAULT_EQUIPMENT_COLUMNS],
    legs: [
      {
        id: 'leg-1',
        sequenceNo: 1,
        mode: 'ocean',
        originCode: 'CNSHA',
        destinationCode: 'USLAX',
      },
      {
        id: 'leg-2',
        sequenceNo: 2,
        mode: 'road',
        originCode: 'USLAX',
        destinationCode: 'USLGB',
      },
    ],
    chargeRows: [
      {
        id: 'row-1',
        rowName: 'Ocean Freight',
        currency: 'USD',
        valuesByEquipment: values,
      },
      {
        id: 'row-2',
        rowName: 'Trucking',
        currency: 'USD',
        valuesByEquipment: trucking,
      },
    ],
  };
}

describe('MGL engine', () => {
  it('calculates totals by equipment and grand total', () => {
    const result = calculateMglRateOption(makeOption());

    expect(result.totalsByEquipment.standard_20).toBe(3500);
    expect(result.totalsByEquipment.open_top_40).toBe(3500);
    expect(result.grandTotal).toBe(3500 * MGL_DEFAULT_EQUIPMENT_COLUMNS.length);
  });

  it('returns validation errors for route breaks and invalid sequence', () => {
    const option = makeOption();
    option.legs[1].originCode = 'USNYC';
    option.legs[1].sequenceNo = 3;

    const validation = validateMglRateOption(option);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.code === 'LEG_ROUTE_BREAK')).toBe(true);
    expect(validation.errors.some((e) => e.code === 'LEG_SEQUENCE_INVALID')).toBe(true);
  });
});
