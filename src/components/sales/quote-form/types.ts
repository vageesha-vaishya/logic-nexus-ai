import * as z from 'zod';

export const quoteSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  service_type_id: z.string().optional(),
  service_id: z.string().optional(),
  incoterms: z.string().optional(),
  total_weight: z.string().optional(),
  total_volume: z.string().optional(),
  commodity: z.string().optional(),
  trade_direction: z.enum(['import', 'export']).optional(),
  carrier_id: z.string().optional(),
  consignee_id: z.string().optional(),
  origin_port_id: z.string().optional(),
  destination_port_id: z.string().optional(),
  account_id: z.string().optional(),
  contact_id: z.string().optional(),
  opportunity_id: z.string().optional(),
  status: z.string(),
  valid_until: z.string().optional(),
  tax_percent: z.string().optional(),
  shipping_amount: z.string().optional(),
  terms_conditions: z.string().optional(),
  notes: z.string().optional(),
  billing_address: z.any().optional(),
  shipping_address: z.any().optional(),
  items: z.array(z.object({
    line_number: z.number().optional(),
    // Unified Cargo Fields
    type: z.enum(['loose', 'container', 'unit']).default('loose'),
    container_type_id: z.string().optional(),
    container_size_id: z.string().optional(),
    
    product_name: z.string().min(1, 'Product name is required'),
    commodity_id: z.string().optional(),
    aes_hts_id: z.string().optional(),
    description: z.string().optional(),
    quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
    unit_price: z.coerce.number().min(0, 'Price must be non-negative'),
    discount_percent: z.coerce.number().min(0).max(100).optional(),
    package_category_id: z.string().optional(),
    package_size_id: z.string().optional(),
    attributes: z.object({
      weight: z.coerce.number().optional(),
      volume: z.coerce.number().optional(),
      length: z.coerce.number().optional(),
      width: z.coerce.number().optional(),
      height: z.coerce.number().optional(),
      hs_code: z.string().optional(),
      hazmat: z.any().optional(), // Stores full HazmatDetails object
      stackable: z.boolean().optional(),
    }).optional()
  })).optional().default([]),
  cargo_configurations: z.array(z.object({
    id: z.string().optional(),
    transport_mode: z.enum(['ocean', 'air', 'road', 'rail']),
    cargo_type: z.enum(['FCL', 'LCL', 'Breakbulk', 'RoRo']),
    container_type: z.string().optional(),
    container_size: z.string().optional(),
    container_type_id: z.string().optional(),
    container_size_id: z.string().optional(),
    quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
    unit_weight_kg: z.coerce.number().optional(),
    unit_volume_cbm: z.coerce.number().optional(),
    length_cm: z.coerce.number().optional(),
    width_cm: z.coerce.number().optional(),
    height_cm: z.coerce.number().optional(),
    is_hazardous: z.boolean().default(false),
    hazardous_class: z.string().optional(),
    un_number: z.string().optional(),
    is_temperature_controlled: z.boolean().default(false),
    temperature_min: z.coerce.number().optional(),
    temperature_max: z.coerce.number().optional(),
    temperature_unit: z.enum(['C', 'F']).default('C'),
    package_category_id: z.string().optional(),
    package_size_id: z.string().optional(),
    remarks: z.string().optional(),
  })).optional().default([]),
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;

export type QuoteItem = z.infer<typeof quoteSchema>['items'] extends (infer T)[] | undefined ? T : never;
export type CargoConfiguration = z.infer<typeof quoteSchema>['cargo_configurations'] extends (infer T)[] | undefined ? T : never;

export type Charge = {
  type: string;
  amount: number;
  currency: string;
  note?: string;
};

export type CarrierQuote = {
  carrier_rate_id?: string;
  carrier_id: string;
  mode?: string;
  buying_charges: Charge[];
  selling_charges: Charge[];
};
