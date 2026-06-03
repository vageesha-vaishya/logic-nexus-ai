// Phase 7 UIM Step 4b.12 — AMRO ↔ UIM record mappers.
//
// Lifted verbatim from src/modules/uim/integration/uimAmroMapper.ts
// so the external-mro-pipeline route can run inside uim-api without
// depending on the frontend tree. Behavior matches the legacy mapper
// byte-for-byte — the AMRO availability response shape is part of
// the contract surface the connector-manifests registry advertises
// to external consumers.

export type UimAvailabilityRecord = {
  inventory_item_id: string;
  catalog_item_id: string;
  sku: string;
  part_number: string;
  title: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  status: string;
  location_type: string | null;
  maintenance_category: string | null;
  ata_chapter_code: string | null;
  condition_code: string | null;
  certification_status: string | null;
  aog_priority: boolean;
};

function numberValue(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

export function mapUimAvailabilityRowToAmro(record: Record<string, unknown>): UimAvailabilityRecord {
  const quantityOnHand = numberValue(record.quantity || record.projected_available_quantity);
  const quantityReserved = numberValue(record.projected_reserved_quantity);
  return {
    inventory_item_id: String(record.inventory_item_id || record.id || ''),
    catalog_item_id: String(record.catalog_item_id || ''),
    sku: String(record.sku || ''),
    part_number: String(record.part_number || ''),
    title: String(record.title || ''),
    quantity_on_hand: quantityOnHand,
    quantity_reserved: quantityReserved,
    quantity_available: Math.max(0, quantityOnHand - quantityReserved),
    status: String(record.status || 'available'),
    location_type: record.location_type ? String(record.location_type) : null,
    maintenance_category: record.maintenance_category ? String(record.maintenance_category) : null,
    ata_chapter_code: record.ata_chapter_code ? String(record.ata_chapter_code) : null,
    condition_code: record.condition_code ? String(record.condition_code) : null,
    certification_status: record.certification_status ? String(record.certification_status) : null,
    aog_priority: Boolean(record.aog_priority),
  };
}

export function mapAmroPayloadToUimMetadata(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    amro_reference: payload.amro_reference || null,
    maintenance_order_id: payload.maintenance_order_id || null,
    work_order_id: payload.work_order_id || null,
    task_id: payload.task_id || null,
    requested_by: payload.requested_by || null,
    source: 'amro',
  };
}
