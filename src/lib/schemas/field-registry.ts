export const FIELD_MAP = {
  port: {
    name: 'location_name',
    code: 'location_code',
    id: 'id',
  },
  option: {
    isPrimary: 'is_selected',
    currency: 'currency_id',
  },
  leg: {
    mode: 'mode',
    carrier: 'carrier_id',
    transitTime: 'transit_time_hours',
  },
  charge: {
    side: 'charge_side_id',
    option: 'quote_option_id',
    category: 'category_id',
  },
  quote: {
    incoterms: 'incoterm_id',
  },
} as const;

export function dbField<E extends keyof typeof FIELD_MAP>(
  entity: E,
  field: keyof (typeof FIELD_MAP)[E]
): string {
  return FIELD_MAP[entity][field] as string;
}
