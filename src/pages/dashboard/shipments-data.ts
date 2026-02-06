export type ShipmentStatus = 
  | 'draft'
  | 'confirmed'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'customs'
  | 'cancelled'
  | 'on_hold'
  | 'returned';

export type ShipmentType =
  | 'ocean'
  | 'air'
  | 'inland_trucking'
  | 'rail'
  | 'courier'
  | 'movers_packers';

export interface Shipment {
  id: string;
  shipment_number: string;
  shipment_type: ShipmentType;
  reference_number?: string | null;
  special_instructions?: string | null;
  status: ShipmentStatus;
  origin_address: Address | null;
  destination_address: Address | null;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  total_weight_kg: number | null;
  total_packages: number | null;
  total_charges: number | null;
  currency: string | null;
  current_location: Address | null;
  priority_level: string | null;
  created_at: string;
  pod_received?: boolean;
  pod_received_at?: string | null;
  account_id?: string | null;
  accounts?: { name: string } | null;
  contacts?: { first_name: string; last_name: string; email: string } | null;
  tenant_id?: string | null;
  franchise_id?: string | null;
  aes_itn?: string | null;
  incoterms?: string | null;
  vessel_name?: string | null;
  voyage_number?: string | null;
  port_of_loading?: string | null;
  port_of_discharge?: string | null;
  place_of_receipt?: string | null;
  place_of_delivery?: string | null;
}

export interface Address {
  city?: string | null;
  country?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

export interface Carrier {
  id: string;
  carrier_name: string;
}

export const statusConfig: Record<ShipmentStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-500/10 text-gray-700 dark:text-gray-300" },
  confirmed: { label: "Confirmed", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  in_transit: { label: "In Transit", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  out_for_delivery: { label: "Out for Delivery", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" },
  delivered: { label: "Delivered", color: "bg-green-500/10 text-green-700 dark:text-green-300" },
  customs: { label: "Customs", color: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-700 dark:text-red-300" },
  on_hold: { label: "On Hold", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  returned: { label: "Returned", color: "bg-pink-500/10 text-pink-700 dark:text-pink-300" },
};

export const stages: ShipmentStatus[] = [
  'draft', 
  'confirmed', 
  'in_transit', 
  'out_for_delivery', 
  'delivered', 
  'customs', 
  'cancelled', 
  'on_hold', 
  'returned'
];

export const normalizeShipmentType = (name: string): ShipmentType => {
  const n = String(name || '').trim().toLowerCase();
  const map: Record<string, ShipmentType> = {
    ocean: 'ocean',
    'ocean_freight': 'ocean',
    sea: 'ocean',
    'sea_freight': 'ocean',
    'sea_cargo': 'ocean',
    air: 'air',
    'air_freight': 'air',
    'air_cargo': 'air',
    trucking: 'inland_trucking',
    'inland_trucking': 'inland_trucking',
    road: 'inland_trucking',
    'road_transport': 'inland_trucking',
    ground: 'inland_trucking',
    courier: 'courier',
    express: 'courier',
    'express_delivery': 'courier',
    parcel: 'courier',
    moving: 'movers_packers',
    'movers_packers': 'movers_packers',
    'packers_and_movers': 'movers_packers',
    rail: 'rail',
    railway: 'rail',
    'railway_transport': 'rail',
    'rail_transport': 'rail',
  };
  return map[n] || (String(name) as ShipmentType);
};

export const formatShipmentType = (type: string) => {
  const t = normalizeShipmentType(type);
  const labels: Record<string, string> = {
    ocean: 'Ocean',
    air: 'Air',
    inland_trucking: 'Inland Trucking',
    rail: 'Rail',
    courier: 'Courier',
    movers_packers: 'Movers & Packers',
  };
  return labels[t] || type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
