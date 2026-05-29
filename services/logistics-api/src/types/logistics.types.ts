// Phase 5 logistics-api — domain types.
// ErrorResponse is duplicated per the duplicate-then-reconcile pattern;
// each service owns its type identity.

export type ShipmentStatus =
  | 'draft'
  | 'confirmed'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'customs'
  | 'on_hold'
  | 'cancelled';

export interface ShipmentRecord {
  id: string;
  tenant_id: string;
  franchise_id: string | null;
  shipment_number: string;
  status: ShipmentStatus;
  account_id: string | null;
  contact_id: string | null;
  carrier_id: string | null;
  vendor_id: string | null;
  quote_id: string | null;
  booking_id: string | null;
  origin_address: Record<string, unknown> | null;
  destination_address: Record<string, unknown> | null;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  total_weight_kg: number | null;
  total_volume_cbm: number | null;
  total_packages: number | null;
  declared_value: number | null;
  total_charges: number | null;
  currency: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateShipmentRequest {
  shipment_number?: string;
  status?: ShipmentStatus;
  account_id?: string | null;
  contact_id?: string | null;
  carrier_id?: string | null;
  vendor_id?: string | null;
  quote_id?: string | null;
  booking_id?: string | null;
  origin_address?: Record<string, unknown> | null;
  destination_address?: Record<string, unknown> | null;
  pickup_date?: string | null;
  estimated_delivery_date?: string | null;
  total_weight_kg?: number | null;
  total_volume_cbm?: number | null;
  total_packages?: number | null;
  declared_value?: number | null;
  total_charges?: number | null;
  currency?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type UpdateShipmentRequest = Partial<CreateShipmentRequest>;

export interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  path?: string;
  requestId?: string | null;
}
