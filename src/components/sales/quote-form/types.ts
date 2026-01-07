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
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;

export type QuoteItem = {
  line_number: number;
  product_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  package_category_id?: string;
  package_size_id?: string;
};

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
