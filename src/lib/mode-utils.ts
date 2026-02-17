export type ModeCarrierTypeMap = Record<string, string[]>;

export function normalizeModeCode(value: string): string {
  const v = (value || '').toLowerCase().trim();
  if (!v) return '';
  if (v.includes('ocean') || v.includes('sea') || v.includes('maritime')) return 'ocean';
  if (v.includes('air')) return 'air';
  if (v.includes('rail') || v.includes('train') || v.includes('railway')) return 'rail';
  if (v.includes('truck') || v.includes('road') || v.includes('inland') || v.includes('ground')) {
    return 'road';
  }
  if (v.includes('courier') || v.includes('express') || v.includes('parcel')) return 'courier';
  if (v.includes('move') || v.includes('mover') || v.includes('packer')) return 'movers_packers';
  return v;
}

export const DEFAULT_MODE_CARRIER_TYPE_MAP: ModeCarrierTypeMap = {
  ocean: ['ocean'],
  air: ['air_cargo'],
  rail: ['rail'],
  road: ['trucking'],
  courier: ['courier'],
  movers_packers: ['movers_packers'],
};

export function getCarrierTypesForMode(
  mode: string,
  modeCarrierMap: ModeCarrierTypeMap = DEFAULT_MODE_CARRIER_TYPE_MAP
): string[] {
  const normalized = normalizeModeCode(mode);
  return modeCarrierMap[normalized] || [];
}

export const carrierValidationMessages = {
  carrierModeMismatch: (
    name: string,
    type: string | null | undefined,
    normalizedMode: string,
    allowedTypes: string[]
  ): string =>
    `Carrier "${name}" (type: ${type || 'unknown'}) does not serve ${normalizedMode} transport. Expected types: ${allowedTypes.join(', ')}`,

  duplicateCarrierAcrossLegs: (name: string, legNo: number): string =>
    `Carrier "${name}" is already assigned to Leg ${legNo}`,

  noPreferredCarriersForMode: (mode: string): string =>
    `No preferred carriers found for ${mode}. Showing all carriers.`,
};
