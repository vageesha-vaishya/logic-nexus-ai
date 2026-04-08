export type PartInventoryStatus = 'available' | 'low_stock' | 'reserved' | 'quarantined' | 'unserviceable';
export type PartCriticality = 'critical' | 'high' | 'normal' | 'low';
export type PartItemType = 'part' | 'consumable' | 'tool' | 'equipment';

export type PartInventoryRecord = {
  id: string;
  part_number: string;
  serial_number: string | null;
  description: string;
  lifecycle_status?: 'serviceable' | 'inspection_due' | 'needs_repair' | 'repair_in_progress' | 'ready_for_install' | 'replaced' | 'retired' | 'quarantined';
  item_type: PartItemType;
  ata_chapter: string;
  warehouse_location: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_level: number;
  reorder_quantity: number;
  min_serviceable_qty: number;
  status: PartInventoryStatus;
  criticality: PartCriticality;
  supplier_name: string;
  unit_cost: number;
  currency: string;
  certification_expiry_date: string | null;
  expiry_date: string | null;
  updated_at: string;
  metadata: {
    barcode_value: string;
    rfid_tag: string;
    condition_code: 'SV' | 'AR' | 'INSP' | 'OH' | 'SCRAP' | 'QUAR';
    aog_priority: boolean;
    tags: string[];
  };
};

export type PartInventoryMetrics = {
  totalItems: number;
  lowStockItems: number;
  reservedItems: number;
  quarantineItems: number;
  criticalItems: number;
  inventoryValue: number;
};

type GeneratorOptions = {
  count?: number;
  seed?: number;
  includeExpired?: boolean;
};

const ITEM_TYPES: PartItemType[] = ['part', 'consumable', 'tool', 'equipment'];
const STATUSES: PartInventoryStatus[] = ['available', 'low_stock', 'reserved', 'quarantined', 'unserviceable'];
const CRITICALITY: PartCriticality[] = ['critical', 'high', 'normal', 'low'];
const ATA_CODES = ['21', '24', '27', '28', '29', '32', '49', '52', '71'];
const SUPPLIERS = ['AeroLink Supplies', 'SkyBridge Components', 'RotorPrime', 'AOG Express', 'LineOps Vendor Hub'];
const CONDITION_CODES: Array<PartInventoryRecord['metadata']['condition_code']> = ['SV', 'AR', 'INSP', 'OH', 'SCRAP', 'QUAR'];

function pseudoRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function asIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

export function generatePartInventoryRecords(options: GeneratorOptions = {}): PartInventoryRecord[] {
  const count = Math.max(0, options.count ?? 120);
  const rand = pseudoRandom(options.seed ?? 42);
  const records: PartInventoryRecord[] = [];

  for (let index = 0; index < count; index += 1) {
    const partNumber = `AMRO-PN-${String(100000 + index).padStart(6, '0')}`;
    const itemType = ITEM_TYPES[index % ITEM_TYPES.length];
    const status = STATUSES[Math.floor(rand() * STATUSES.length)];
    const lifecycleStatus = status === 'unserviceable'
      ? 'needs_repair'
      : status === 'quarantined'
        ? 'quarantined'
        : 'serviceable';
    const reorderLevel = Math.floor(5 + rand() * 24);
    const quantityOnHand = Math.floor(4 + rand() * 140);
    const quantityReserved = Math.min(quantityOnHand, Math.floor(rand() * 18));
    const quantityAvailable = Math.max(0, quantityOnHand - quantityReserved);
    const criticality = CRITICALITY[Math.floor(rand() * CRITICALITY.length)];
    const unitCost = Number((40 + rand() * 950).toFixed(2));

    const isSerialized = itemType === 'part' || itemType === 'tool';
    const serialNumber = isSerialized ? `SN-${String(900000 + index).padStart(8, '0')}` : null;
    const includeExpired = Boolean(options.includeExpired);
    const expiryShift = includeExpired && index % 11 === 0 ? -(index % 20) : 90 + (index % 280);

    records.push({
      id: `part-${index + 1}`,
      part_number: partNumber,
      serial_number: serialNumber,
      description: `${itemType.toUpperCase()} inventory record ${index + 1}`,
      lifecycle_status: lifecycleStatus,
      item_type: itemType,
      ata_chapter: ATA_CODES[index % ATA_CODES.length],
      warehouse_location: `WH-${String.fromCharCode(65 + (index % 6))}-${String((index % 45) + 1).padStart(3, '0')}`,
      quantity_on_hand: quantityOnHand,
      quantity_reserved: quantityReserved,
      quantity_available: quantityAvailable,
      reorder_level: reorderLevel,
      reorder_quantity: Math.floor(8 + rand() * 65),
      min_serviceable_qty: Math.floor(2 + rand() * 12),
      status,
      criticality,
      supplier_name: SUPPLIERS[index % SUPPLIERS.length],
      unit_cost: unitCost,
      currency: 'USD',
      certification_expiry_date: asIsoDate(120 + (index % 260)),
      expiry_date: asIsoDate(expiryShift),
      updated_at: asIsoDate(-(index % 19)),
      metadata: {
        barcode_value: `BAR-${String(700000 + index).padStart(8, '0')}`,
        rfid_tag: `RFID-${String(500000 + index).padStart(8, '0')}`,
        condition_code: CONDITION_CODES[index % CONDITION_CODES.length],
        aog_priority: criticality === 'critical' || (index % 9 === 0),
        tags: [
          status === 'low_stock' ? 'restock' : 'healthy',
          itemType,
          quantityAvailable <= reorderLevel ? 'at-risk' : 'stable',
        ],
      },
    });
  }

  return records;
}

export function computePartInventoryMetrics(records: PartInventoryRecord[]): PartInventoryMetrics {
  return records.reduce<PartInventoryMetrics>((accumulator, record) => {
    accumulator.totalItems += 1;
    if (record.quantity_available <= record.reorder_level || record.status === 'low_stock') accumulator.lowStockItems += 1;
    if (record.status === 'reserved' || record.quantity_reserved > 0) accumulator.reservedItems += 1;
    if (record.status === 'quarantined') accumulator.quarantineItems += 1;
    if (record.criticality === 'critical') accumulator.criticalItems += 1;
    accumulator.inventoryValue += record.quantity_on_hand * record.unit_cost;
    return accumulator;
  }, {
    totalItems: 0,
    lowStockItems: 0,
    reservedItems: 0,
    quarantineItems: 0,
    criticalItems: 0,
    inventoryValue: 0,
  });
}
