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
    reference_number: row.reference_number || null,
    special_instructions: row.special_instructions || null,
    status: normalizeStatus(row.status || null),
    origin_address: toAddress(row.origin_address || null),
    destination_address: toAddress(row.destination_address || null),
    pickup_date: row.pickup_date || null,
    estimated_delivery_date: row.estimated_delivery_date || null,
    actual_delivery_date: row.actual_delivery_date || null,
    total_weight_kg: row.total_weight_kg ?? null,
    total_packages: row.total_packages ?? null,
    total_charges: row.total_charges ?? null,
    currency: row.currency || null,
    current_location: null, // Not present in DB row
    priority_level: row.priority_level || null,
    created_at: String(row.created_at || new Date().toISOString()),
    pod_received: false, // Not in DB schema
    pod_received_at: null, // Not in DB schema
    account_id: row.account_id || null,
    accounts: null, // Join field, handled separately if needed
  };
};

export const appShipmentToDbInsert = (app: Partial<AppShipment>): Partial<DbShipmentRow> => {
  const db: Partial<DbShipmentRow> = {};
  
  if (app.shipment_number) db.shipment_number = app.shipment_number;
  if (app.shipment_type) db.shipment_type = app.shipment_type as any;
  if (app.reference_number) db.reference_number = app.reference_number;
  if (app.special_instructions) db.special_instructions = app.special_instructions;
  if (app.status) db.status = app.status;
  
  if (app.origin_address) {
    db.origin_address = app.origin_address as unknown as any;
  }
  
  if (app.destination_address) {
    db.destination_address = app.destination_address as unknown as any;
  }
  
  if (app.pickup_date) db.pickup_date = app.pickup_date;
  if (app.estimated_delivery_date) db.estimated_delivery_date = app.estimated_delivery_date;
  if (app.actual_delivery_date) db.actual_delivery_date = app.actual_delivery_date;
  
  if (app.total_weight_kg !== undefined) db.total_weight_kg = app.total_weight_kg;
  if (app.total_packages !== undefined) db.total_packages = app.total_packages;
  if (app.total_charges !== undefined) db.total_charges = app.total_charges;
  if (app.currency) db.currency = app.currency;
  if (app.priority_level) db.priority_level = app.priority_level;
  
  if (app.account_id) db.account_id = app.account_id;
  
  return db;
};


export const dbRowsToAppShipments = (rows: DbShipmentRow[]): AppShipment[] => {
  return (rows || []).map(dbRowToAppShipment);
};
