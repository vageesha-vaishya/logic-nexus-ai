import type { RateOption, TransportLeg, Charge } from '@/types/quote-breakdown';
import type { MglRateOption } from './types';
import { calculateMglRateOption } from './engine';

function toLegacyLeg(leg: MglRateOption['legs'][number]): TransportLeg {
  return {
    id: leg.id,
    mode: leg.mode,
    sequence: leg.sequenceNo,
    origin: leg.originName || leg.originCode,
    destination: leg.destinationName || leg.destinationCode,
    carrier: leg.carrierName,
    transit_time: leg.transitDays ? `${leg.transitDays} Days` : undefined,
  };
}

function toLegacyCharges(option: MglRateOption): Charge[] {
  const charges: Charge[] = [];

  option.chargeRows.forEach((row) => {
    Object.entries(row.valuesByEquipment || {}).forEach(([equipment, amount]) => {
      charges.push({
        id: `${row.id}:${equipment}`,
        category: row.rowCode || 'Service',
        name: `${row.rowName} (${equipment})`,
        amount: Number(amount || 0),
        currency: row.currency || 'USD',
        basis: 'per_equipment',
        quantity: 1,
        rate: Number(amount || 0),
        note: row.remarks,
      });
    });
  });

  return charges;
}

export function toLegacyRateOption(option: MglRateOption): RateOption {
  const calculated = calculateMglRateOption(option);
  const firstEquipment = option.equipmentColumns[0]?.key;

  return {
    id: option.id,
    carrier: option.carrierName,
    name: option.optionName || option.carrierName,
    price: firstEquipment ? Number(calculated.totalsByEquipment[firstEquipment] || 0) : 0,
    total_amount: firstEquipment ? Number(calculated.totalsByEquipment[firstEquipment] || 0) : 0,
    currency: option.chargeRows[0]?.currency || 'USD',
    transitTime: option.transitTimeDays ? `${option.transitTimeDays} Days` : 'N/A',
    tier: 'contract',
    legs: option.legs.map(toLegacyLeg),
    charges: toLegacyCharges(option),
    transport_mode: option.mode,
  };
}

export function fromLegacyRateOption(option: RateOption): MglRateOption {
  const equipmentColumns = [
    { key: 'standard_20', label: "Standard - 20'" },
    { key: 'open_top_40', label: "Open Top - 40'" },
  ];

  const rowName = option.charges?.[0]?.name || 'Ocean Freight';
  const currency = option.currency || option.charges?.[0]?.currency || 'USD';
  const amount = Number(option.total_amount ?? option.price ?? 0);

  return {
    id: option.id,
    optionName: option.name,
    carrierName: option.carrier,
    mode: option.legs && option.legs.length > 1 ? 'multimodal' : 'single',
    transitTimeDays: Number(String(option.transitTime || '').replace(/\D+/g, '')) || undefined,
    equipmentColumns,
    legs: (option.legs || []).map((leg, index) => ({
      id: leg.id,
      sequenceNo: index + 1,
      mode: (leg.mode as any) || 'ocean',
      originCode: leg.origin || '',
      destinationCode: leg.destination || '',
      originName: leg.origin,
      destinationName: leg.destination,
      carrierName: leg.carrier,
    })),
    chargeRows: [
      {
        id: `${option.id}:row-1`,
        rowCode: 'TOTAL',
        rowName,
        currency,
        includeInTotal: true,
        valuesByEquipment: {
          standard_20: amount,
          open_top_40: amount,
        },
      },
    ],
    remarks: option.recommendation_reason,
  };
}
