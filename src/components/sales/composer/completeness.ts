export interface ComposerCompletenessInput {
  quoteData: any;
  legs: any[];
  charges: any[];
}

export function computeComposerCompleteness(input: ComposerCompletenessInput): number {
  let total = 0;
  let filled = 0;

  const fields = [
    input.quoteData?.account_id,
    input.quoteData?.contact_id,
    input.quoteData?.trade_direction_id,
    input.quoteData?.origin_port_id,
    input.quoteData?.destination_port_id,
    input.quoteData?.incoterm_id,
    input.quoteData?.service_level,
    input.quoteData?.currencyId,
    input.quoteData?.total_weight,
    input.quoteData?.total_volume,
  ];

  fields.forEach((f) => {
    total += 1;
    if (f !== null && typeof f !== "undefined" && f !== "") {
      filled += 1;
    }
  });

  const legsPresent = Array.isArray(input.legs) && input.legs.length > 0;
  total += 1;
  if (legsPresent) filled += 1;

  const hasSellCharges = Array.isArray(input.charges) && input.charges.length > 0;
  total += 1;
  if (hasSellCharges) filled += 1;

  if (total === 0) return 0;
  const ratio = (filled / total) * 100;
  return Math.round(ratio);
}

