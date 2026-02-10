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
  pickup_date: z.string().optional(),
  delivery_deadline: z.string().optional(),
  vehicle_type: z.string().optional(),
  special_handling: z.string().optional(),
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
  options: z.array(z.object({
    id: z.string().optional(),
    is_primary: z.boolean().default(false),
    total_amount: z.coerce.number().optional(),
    currency: z.string().default('USD'),
    transit_time_days: z.number().optional(),
    legs: z.array(z.object({
      id: z.string().optional(),
      sequence_number: z.number(),
      transport_mode: z.enum(['ocean', 'air', 'road', 'rail']),
      carrier_id: z.string().optional(),
      origin_location_id: z.string().optional(),
      destination_location_id: z.string().optional(),
      origin_location_name: z.string().optional(),
      destination_location_name: z.string().optional(),
      transit_time: z.string().optional(),
      transit_time_days: z.coerce.number().min(0, "Transit days cannot be negative").optional(),
      voyage_number: z.string().optional(),
      flight_number: z.string().optional(),
      arrival_date: z.string().optional(),
      departure_date: z.string().optional(),
    }).refine((data) => {
        if (data.departure_date && data.arrival_date) {
            return new Date(data.arrival_date) > new Date(data.departure_date);
        }
        return true;
    }, {
        message: "Arrival date must be after departure date",
        path: ["arrival_date"]
    }).refine((data) => {
        if (data.transport_mode === 'air' && data.flight_number && !/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/i.test(data.flight_number)) {
            return false;
        }
        return true;
    }, {
        message: "Invalid flight number format (e.g. EK202)",
        path: ["flight_number"]
    })).optional().default([]),
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

// --- Reference-data option types (used by useQuoteRepository) ---

export interface PortOption {
  id: string;
  name: string;
  code: string;
  country_code: string;
}

export interface CarrierOption {
  id: string;
  carrier_name: string;
  scac: string;
  carrier_type: string;
}

export interface AccountOption {
  id: string;
  name: string;
}

export interface ContactOption {
  id: string;
  first_name: string;
  last_name: string;
  account_id: string | null;
}

export interface OpportunityOption {
  id: string;
  name: string;
  account_id: string | null;
  contact_id: string | null;
  stage?: string;
  amount?: number;
  probability?: number;
}

export interface ServiceOption {
  id: string;
  service_name: string;
  service_type_id: string;
  is_default: boolean;
  priority: number;
}

export interface ServiceTypeOption {
  id: string;
  code: string;
  name: string;
}
