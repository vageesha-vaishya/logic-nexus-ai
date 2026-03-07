import type {
  MglCalculatedOption,
  MglRateOption,
  MglValidationIssue,
  MglValidationResult,
  TransportMode,
} from './types';

export const MGL_DEFAULT_EQUIPMENT_COLUMNS = [
  { key: 'standard_20', label: "Standard - 20'" },
  { key: 'open_top_40', label: "Open Top - 40'" },
  { key: 'flat_rack_40', label: "Flat Rack - 40'" },
  { key: 'flat_rack_collapsible_20', label: "Flat Rack collapsible - 20'" },
  { key: 'platform_20', label: "Platform - 20'" },
  { key: 'high_cube_45', label: 'High Cube - 45' },
] as const;

const ALLOWED_MULTI_LEG_TRANSITIONS: Record<TransportMode, TransportMode[]> = {
  air: ['road', 'air'],
  ocean: ['road', 'rail', 'ocean'],
  road: ['air', 'ocean', 'rail', 'road'],
  rail: ['road', 'ocean', 'rail'],
};

export function validateMglRateOption(option: MglRateOption): MglValidationResult {
  const errors: MglValidationIssue[] = [];
  const warnings: MglValidationIssue[] = [];

  if (!Array.isArray(option.legs) || option.legs.length === 0) {
    errors.push({
      code: 'EMPTY_LEGS',
      message: 'At least one transport leg is required.',
    });
  }

  const sortedLegs = [...(option.legs || [])].sort((a, b) => a.sequenceNo - b.sequenceNo);

  sortedLegs.forEach((leg, index) => {
    if (leg.sequenceNo !== index + 1) {
      errors.push({
        code: 'LEG_SEQUENCE_INVALID',
        message: `Leg ${leg.id} has sequence ${leg.sequenceNo}, expected ${index + 1}.`,
        legId: leg.id,
      });
    }

    if (index > 0) {
      const prev = sortedLegs[index - 1];
      if (
        String(prev.destinationCode || '').trim().toUpperCase() !==
        String(leg.originCode || '').trim().toUpperCase()
      ) {
        errors.push({
          code: 'LEG_ROUTE_BREAK',
          message: `Route break between legs ${prev.id} and ${leg.id}.`,
          legId: leg.id,
        });
      }

      const allowed = ALLOWED_MULTI_LEG_TRANSITIONS[prev.mode] || [];
      if (!allowed.includes(leg.mode)) {
        errors.push({
          code: 'UNSUPPORTED_MODE_COMBINATION',
          message: `Unsupported transport transition from ${prev.mode} to ${leg.mode}.`,
          legId: leg.id,
        });
      }
    }
  });

  for (const row of option.chargeRows || []) {
    for (const [equipmentKey, value] of Object.entries(row.valuesByEquipment || {})) {
      if (Number(value) < 0) {
        errors.push({
          code: 'NEGATIVE_CHARGE',
          message: `Charge row ${row.rowName} contains negative amount for ${equipmentKey}.`,
          rowId: row.id,
        });
      }
    }
  }

  if ((option.chargeRows || []).length === 0) {
    warnings.push({
      code: 'NEGATIVE_CHARGE',
      message: 'No charge rows configured for this option.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function calculateMglRateOption(option: MglRateOption): MglCalculatedOption {
  const totalsByEquipment: Record<string, number> = {};
  const rowTotals: Array<{ rowId: string; rowName: string; total: number }> = [];

  const equipmentKeys = (option.equipmentColumns || []).map((c) => c.key);
  for (const key of equipmentKeys) totalsByEquipment[key] = 0;

  for (const row of option.chargeRows || []) {
    let rowTotal = 0;
    const include = row.includeInTotal !== false;

    for (const key of equipmentKeys) {
      const amount = Number(row.valuesByEquipment?.[key] ?? 0);
      if (include) {
        totalsByEquipment[key] = Number((totalsByEquipment[key] + amount).toFixed(2));
      }
      rowTotal += amount;
    }

    rowTotals.push({
      rowId: row.id,
      rowName: row.rowName,
      total: Number(rowTotal.toFixed(2)),
    });
  }

  const grandTotal = Number(
    Object.values(totalsByEquipment)
      .reduce((sum, value) => sum + Number(value || 0), 0)
      .toFixed(2),
  );

  return {
    optionId: option.id,
    totalsByEquipment,
    grandTotal,
    rowTotals,
  };
}

export function calculateMglQuotation(options: MglRateOption[]) {
  return options.map((option) => {
    const validation = validateMglRateOption(option);
    const calculated = calculateMglRateOption(option);
    return {
      option,
      validation,
      calculated,
    };
  });
}
