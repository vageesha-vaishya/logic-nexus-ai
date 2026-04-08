import type { PartInventoryStatus } from './mockPartsInventoryData';
import type { PartsMutationPayload } from './livePartsCatalogApi';

export type PartsFormFieldKey = keyof PartsMutationPayload;
export type PartsFormControlType = 'text' | 'textarea' | 'number' | 'select';

export type PartsFormFieldSchema = {
  key: PartsFormFieldKey;
  label: string;
  control: PartsFormControlType;
  colSpan?: 1 | 2;
  options?: readonly string[];
};

export const PARTS_STATUS_FILTER_OPTIONS = [
  'all',
  'available',
  'low_stock',
  'reserved',
  'quarantined',
  'unserviceable',
] as const;

export const PARTS_STATUS_FORM_OPTIONS: PartInventoryStatus[] = [
  'available',
  'reserved',
  'low_stock',
  'quarantined',
  'unserviceable',
];

export const PARTS_LIFECYCLE_FORM_OPTIONS = [
  'serviceable',
  'inspection_due',
  'needs_repair',
  'repair_in_progress',
  'ready_for_install',
  'replaced',
  'retired',
  'quarantined',
] as const;

export const PARTS_FORM_REQUIRED_KEYS: PartsFormFieldKey[] = [
  'part_number',
  'status',
  'lifecycle_status',
  'quantity_on_hand',
  'quantity_reserved',
  'warehouse_location',
];

export const PARTS_FORM_CORE_FIELDS: PartsFormFieldSchema[] = [
  { key: 'part_number', label: 'Part Number', control: 'text' },
  { key: 'serial_number', label: 'Serial Number', control: 'text' },
  { key: 'description', label: 'Description', control: 'textarea', colSpan: 2 },
  { key: 'status', label: 'Status', control: 'select', options: PARTS_STATUS_FORM_OPTIONS },
  { key: 'lifecycle_status', label: 'Lifecycle Status', control: 'select', options: PARTS_LIFECYCLE_FORM_OPTIONS },
  { key: 'quantity_on_hand', label: 'Quantity On Hand', control: 'number' },
  { key: 'quantity_reserved', label: 'Quantity Reserved', control: 'number' },
  { key: 'warehouse_location', label: 'Warehouse Location', control: 'text' },
];

export const PARTS_FORM_ADVANCED_FIELDS: PartsFormFieldSchema[] = [];

export const PARTS_DETAIL_REQUIRED_KEYS = [
  'part_number',
  'warehouse_location',
  'quantity_on_hand',
  'quantity_reserved',
  'status',
] as const;

export const PARTS_DETAIL_DEFAULT_VISIBLE_KEYS = [
  'id',
  'part_number',
  'serial_number',
  'description',
  'item_type',
  'warehouse_location',
  'quantity_on_hand',
  'quantity_reserved',
  'quantity_available',
  'status',
  'updated_at',
] as const;

export const PARTS_DETAIL_HIDDEN_KEYS = [
  'metadata',
  'supplier_name',
  'ata_chapter',
  'reorder_level',
  'reorder_quantity',
  'min_serviceable_qty',
  'unit_cost',
  'currency',
  'certification_expiry_date',
  'expiry_date',
] as const;
