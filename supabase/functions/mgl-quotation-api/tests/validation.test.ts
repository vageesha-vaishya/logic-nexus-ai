import { describe, expect, it } from 'vitest';
import { validatePayload, type RateOptionPayload } from '../validation.ts';

function buildPayload(overrides: Partial<RateOptionPayload> = {}): RateOptionPayload {
  return {
    quoteId: 'quote-1',
    quoteVersionId: 'version-1',
    carrierName: 'Carrier One',
    rateType: 'spot',
    rateValidUntil: '2099-01-01T00:00:00.000Z',
    mode: 'multimodal',
    equipmentColumns: [{ key: "standard-40'", label: "40'" }],
    containerType: 'reefer',
    containerSize: "40'",
    commodityType: 'perishable',
    temperatureControlMinC: 2,
    temperatureControlMaxC: 8,
    originCode: 'NYC',
    destinationCode: 'DED',
    standaloneMode: true,
    optionOrdinal: 1,
    legs: [
      {
        sequenceNo: 1,
        mode: 'ocean',
        originCode: 'NYC',
        destinationCode: 'INMUM',
      },
      {
        sequenceNo: 2,
        mode: 'air',
        originCode: 'INMUM',
        destinationCode: 'DED',
      },
    ],
    chargeRows: [
      {
        rowName: 'Freight',
        valuesByEquipment: { "standard-40'": 1000 },
      },
    ],
    ...overrides,
  };
}

describe('mgl-quotation-api payload validation', () => {
  it('accepts all configured rate methodologies', () => {
    const rateTypes: Array<RateOptionPayload['rateType']> = ['spot', 'contract', 'market', 'negotiated'];

    rateTypes.forEach((rateType) => {
      const errors = validatePayload(buildPayload({ rateType }));
      expect(errors).toEqual([]);
    });
  });

  it('accepts valid standalone NYC to Dehra Dun payload', () => {
    const errors = validatePayload(buildPayload());
    expect(errors).toEqual([]);
  });

  it('rejects incompatible commodity and container pairing', () => {
    const errors = validatePayload(
      buildPayload({
        commodityType: 'perishable',
        containerType: 'standard',
      }),
    );

    expect(errors).toContain('perishable is not allowed with standard');
  });

  it('rejects out-of-scope route', () => {
    const errors = validatePayload(
      buildPayload({
        originCode: 'LAX',
        destinationCode: 'DEL',
        legs: [
          {
            sequenceNo: 1,
            mode: 'ocean',
            originCode: 'LAX',
            destinationCode: 'DEL',
          },
        ],
      }),
    );

    expect(errors).toContain('Route must start from New York City and end at Dehra Dun Airport');
  });

  it('rejects unsupported leg transition', () => {
    const errors = validatePayload(
      buildPayload({
        legs: [
          {
            sequenceNo: 1,
            mode: 'air',
            originCode: 'NYC',
            destinationCode: 'DXB',
          },
          {
            sequenceNo: 2,
            mode: 'ocean',
            originCode: 'DXB',
            destinationCode: 'DED',
          },
        ],
      }),
    );

    expect(errors).toContain('Unsupported transport transition from air to ocean');
  });

  it('rejects leg connections with unknown transit point', () => {
    const errors = validatePayload(
      buildPayload({
        legs: [
          {
            id: 'leg-1',
            sequenceNo: 1,
            mode: 'ocean',
            originCode: 'NYC',
            destinationCode: 'INMUM',
          },
          {
            id: 'leg-2',
            sequenceNo: 2,
            mode: 'air',
            originCode: 'INMUM',
            destinationCode: 'DED',
          },
        ],
        transitPoints: [
          {
            id: 'tp-1',
            code: 'INMUM',
            mode: 'air',
          },
        ],
        legConnections: [
          {
            fromLegId: 'leg-1',
            toLegId: 'leg-2',
            transitPointId: 'tp-2',
            dwellHours: 4,
          },
        ],
      }),
    );

    expect(errors).toContain('legConnections transitPointId must reference existing transit points');
  });

  it('requires standalone option ordinal in standalone mode', () => {
    const errors = validatePayload(
      buildPayload({
        optionOrdinal: undefined,
      }),
    );

    expect(errors).toContain('optionOrdinal is required when standaloneMode is true');
  });

  it('rejects unknown rate type values', () => {
    const errors = validatePayload(
      buildPayload({
        rateType: 'promo' as any,
      }),
    );

    expect(errors).toContain('rateType must be one of spot, contract, market, negotiated');
  });

  it('requires multimodalRuleConfig to be an object', () => {
    const errors = validatePayload(
      buildPayload({
        multimodalRuleConfig: [] as any,
      }),
    );

    expect(errors).toContain('multimodalRuleConfig must be an object');
  });

  it('requires IMDG class for hazardous cargo', () => {
    const errors = validatePayload(
      buildPayload({
        commodityType: 'hazardous',
        containerType: 'standard',
        imdgClass: undefined,
      }),
    );

    expect(errors).toContain('imdgClass is required for hazardous cargo');
  });

  it('requires reefer temperature range for perishable cargo', () => {
    const errors = validatePayload(
      buildPayload({
        commodityType: 'perishable',
        containerType: 'reefer',
        temperatureControlMinC: undefined,
        temperatureControlMaxC: undefined,
      }),
    );

    expect(errors).toContain('temperatureControlMinC and temperatureControlMaxC are required for reefer cargo');
  });

  it('rejects reefer temperature values outside supported range', () => {
    const errors = validatePayload(
      buildPayload({
        commodityType: 'pharmaceutical',
        containerType: 'reefer',
        temperatureControlMinC: -60,
        temperatureControlMaxC: 35,
      }),
    );

    expect(errors).toContain('Minimum temperature must be between -50°C and 30°C');
    expect(errors).toContain('Maximum temperature must be between -20°C and 30°C');
  });

  it('rejects oversized payload without valid dimensions', () => {
    const errors = validatePayload(
      buildPayload({
        commodityType: 'oversized',
        containerType: 'flat_rack',
        oversizedLengthCm: 0,
        oversizedWidthCm: 700,
        oversizedHeightCm: 0,
      }),
    );

    expect(errors).toContain('Length must be between 1cm and 2000cm');
    expect(errors).toContain('Width must be between 1cm and 500cm');
    expect(errors).toContain('Height must be between 1cm and 500cm');
  });
});
