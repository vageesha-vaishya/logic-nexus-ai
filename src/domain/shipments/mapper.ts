import type { DbShipmentRow } from "./types";
import type { AppShipment, AppShipmentType, AppShipmentStatus, AppAddress } from "./types";

const normalizeShipmentType = (name: string): AppShipmentType => {
  const n = String(name || "").trim().toLowerCase();
  const map: Record<string, AppShipmentType> = {
    ocean: "ocean",
    ocean_freight: "ocean",
    sea: "ocean",
    sea_freight: "ocean",
    sea_cargo: "ocean",
    air: "air",
    air_freight: "air",
    air_cargo: "air",
    trucking: "inland_trucking",
    inland_trucking: "inland_trucking",
    road: "inland_trucking",
    road_transport: "inland_trucking",
    ground: "inland_trucking",
    courier: "courier",
    express: "courier",
    express_delivery: "courier",
    parcel: "courier",
    moving: "movers_packers",
    movers_packers: "movers_packers",
    packers_and_movers: "movers_packers",
    rail: "rail",
    railway: "rail",
    railway_transport: "rail",
    rail_transport: "rail",
  };
  return map[n] || (String(name) as AppShipmentType);
};

const normalizeStatus = (status: string | null): AppShipmentStatus => {
  const allowed: AppShipmentStatus[] = [
    "draft",
    "confirmed",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "customs",
    "cancelled",
    "on_hold",
    "returned",
  ];
  const s = String(status || "").trim().toLowerCase();
  return (allowed as string[]).includes(s) ? (s as AppShipmentStatus) : "draft";
};

const toAddress = (json: unknown): AppAddress => {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;
  return {
    city: (obj.city as string) ?? null,
    country: (obj.country as string) ?? null,
    state_province: (obj.state_province as string) ?? null,
    postal_code: (obj.postal_code as string) ?? null,
    latitude: (obj.latitude as number | string | null) ?? null,
    longitude: (obj.longitude as number | string | null) ?? null,
  };
};

export const dbRowToAppShipment = (row: DbShipmentRow): AppShipment => {
  return {
    id: String(row.id),
    shipment_number: String(row.shipment_number || row.id),
    shipment_type: normalizeShipmentType(String(row.shipment_type || "ocean")),
    reference_number: row.quote_id || null, // Mapping quote_id to reference_number as primary ref
    special_instructions: row.notes || null, // Mapping notes to special_instructions
    status: normalizeStatus(row.status || null),
    origin_address: toAddress(row.origin_location || null),
    destination_address: toAddress(row.destination_location || null),
    pickup_date: row.pickup_date || null,
    estimated_delivery_date: row.estimated_delivery || null, // mapped from estimated_delivery
    actual_delivery_date: row.actual_delivery || null,
    total_weight_kg: row.total_weight_kg ?? null,
    total_packages: null, // Not present in DB row based on types
    total_charges: row.total_cost ?? null, // Mapping total_cost to total_charges
    currency: row.currency || null,
    current_location: null, // Not present in DB row
    priority_level: null, // Not present in DB row
    created_at: String(row.created_at || new Date().toISOString()),
    pod_received: false, // Not in DB schema
    pod_received_at: null, // Not in DB schema
    account_id: row.owner_id || null, // Mapping owner_id to account_id
    accounts: null, // Join field, handled separately if needed
  };
};

export const appShipmentToDbInsert = (app: Partial<AppShipment>): Partial<DbShipmentRow> => {
  const db: Partial<DbShipmentRow> = {};
  
  if (app.shipment_number) db.shipment_number = app.shipment_number;
  if (app.shipment_type) db.shipment_type = app.shipment_type as any; // Cast as any to satisfy exact enum match if needed, though values align
  if (app.reference_number) db.quote_id = app.reference_number;
  if (app.special_instructions) db.notes = app.special_instructions;
  if (app.status) db.status = app.status;
  
  if (app.origin_address) {
    db.origin_location = app.origin_address as unknown as any; // Json type
  }
  
  if (app.destination_address) {
    db.destination_location = app.destination_address as unknown as any; // Json type
  }
  
  if (app.pickup_date) db.pickup_date = app.pickup_date;
  if (app.estimated_delivery_date) db.estimated_delivery = app.estimated_delivery_date;
  if (app.actual_delivery_date) db.actual_delivery = app.actual_delivery_date;
  
  if (app.total_weight_kg !== undefined) db.total_weight_kg = app.total_weight_kg;
  if (app.total_charges !== undefined) db.total_cost = app.total_charges;
  if (app.currency) db.currency = app.currency;
  
  if (app.account_id) db.owner_id = app.account_id;
  
  // vehicle_id, carrier_id, tenant_id etc. would need to be passed if available in AppShipment or separate context
  
  return db;
};


export const dbRowsToAppShipments = (rows: DbShipmentRow[]): AppShipment[] => {
  return (rows || []).map(dbRowToAppShipment);
};


