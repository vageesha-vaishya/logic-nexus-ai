import { describe, expect, it } from 'vitest';
import {
  MGL_DEFAULT_EQUIPMENT_COLUMNS,
  calculateMglQuotation,
  calculateMglRateOption,
  generateStandaloneMglRateOptions,
  validateStandaloneOptionSet,
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
    rateType: 'spot',
    rateValidUntil: '2099-01-01T00:00:00.000Z',
    mode: 'multimodal',
    equipmentColumns: [...MGL_DEFAULT_EQUIPMENT_COLUMNS],
    legs: [
      {
        id: 'leg-1',
        sequenceNo: 1,
        mode: 'ocean',
        originCode: 'USNYC',
        destinationCode: 'USLAX',
      },
      {
        id: 'leg-2',
        sequenceNo: 2,
        mode: 'air',
        originCode: 'USLAX',
        destinationCode: 'INDED',
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
    containerType: 'standard',
    containerSize: "20'",
    commodityType: 'general',
    originCode: 'USNYC',
    destinationCode: 'INDED',
    standaloneMode: true,
    optionOrdinal: 1,
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

  it('generates exactly four standalone options', () => {
    const baseOption = makeOption();
    const options = generateStandaloneMglRateOptions({
      carrierName: 'ZIM',
      containerType: 'standard',
      containerSize: "20'",
      commodityType: 'general',
      originCode: 'USNYC',
      destinationCode: 'INDED',
      rateValidUntil: '2099-01-01T00:00:00.000Z',
      legs: baseOption.legs,
      baseChargeRows: baseOption.chargeRows,
      equipmentColumns: baseOption.equipmentColumns,
    });

    expect(options).toHaveLength(4);
    expect(options.map((option) => option.rateType)).toEqual([
      'spot',
      'contract',
      'market',
      'negotiated',
    ]);
    const validation = validateStandaloneOptionSet(options);
    expect(validation.valid).toBe(true);
  });

  it('validates commodity and container compatibility', () => {
    const option = makeOption();
    option.commodityType = 'perishable';
    option.containerType = 'standard';

    const validation = validateMglRateOption(option);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.code === 'CONTAINER_COMMODITY_INCOMPATIBLE')).toBe(true);
  });

  it('validates NYC to Dehra Dun routing scope', () => {
    const option = makeOption();
    option.originCode = 'CNSHA';
    option.legs[0].originCode = 'CNSHA';

    const validation = validateMglRateOption(option);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.code === 'ROUTE_OUT_OF_SCOPE')).toBe(true);
  });

  it('validates leg connections against transit points', () => {
    const option = makeOption();
    option.transitPoints = [
      {
        id: 'tp-1',
        code: 'INMUM',
        mode: 'air',
      },
    ];
    option.legConnections = [
      {
        id: 'conn-1',
        fromLegId: 'leg-1',
        toLegId: 'leg-2',
        transitPointId: 'tp-2',
        dwellHours: 2,
      },
    ];

    const validation = validateMglRateOption(option);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.message.includes('unknown transit point'))).toBe(true);
  });

  it('flags expired rate options during quotation calculation', () => {
    const options = [1, 2, 3, 4].map((ordinal) => ({
      ...makeOption(),
      id: `opt-${ordinal}`,
      optionOrdinal: ordinal as 1 | 2 | 3 | 4,
      rateType: ['spot', 'contract', 'market', 'negotiated'][ordinal - 1] as
        | 'spot'
        | 'contract'
        | 'market'
        | 'negotiated',
      rateValidUntil: '2000-01-01T00:00:00.000Z',
    }));

    const results = calculateMglQuotation(options);
    expect(results.every((result) => result.validation.valid === false)).toBe(true);
    expect(results[0].validation.errors.some((error) => error.code === 'RATE_EXPIRED')).toBe(true);
  });
});
