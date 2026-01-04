import type { Database } from "@/integrations/supabase/types";

export type DbShipmentRow = Database["public"]["Tables"]["shipments"]["Row"];

export type AppShipmentStatus =
  | "draft"
  | "confirmed"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "customs"
  | "cancelled"
  | "on_hold"
  | "returned";

export type AppShipmentType =
  | "ocean"
  | "air"
  | "inland_trucking"
  | "rail"
  | "courier"
  | "movers_packers";

export type AppAddress = {
  city?: string | null;
  country?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
} | null;

export interface AppShipment {
  id: string;
  shipment_number: string;
  shipment_type: AppShipmentType;
  reference_number?: string | null;
  special_instructions?: string | null;
  status: AppShipmentStatus;
  origin_address: AppAddress;
  destination_address: AppAddress;
  pickup_date: string | null;
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  total_weight_kg: number | null;
  total_packages: number | null;
  total_charges: number | null;
  currency: string | null;
  current_location: AppAddress;
  priority_level: string | null;
  created_at: string;
  pod_received?: boolean;
  pod_received_at?: string | null;
  account_id?: string | null;
  accounts?: { name: string } | null;
}

