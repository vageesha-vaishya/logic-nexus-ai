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

// Issue VH-04: Column prioritization for optimal scanability
// Recommended maximum: 10 columns for optimal scanability (Nielsen Norman Group, 2024)

/**
 * Core columns - always visible (P0 priority)
 * These are the essential columns needed for basic part identification and operations
 */
export const PARTS_CORE_VISIBLE_KEYS = [
  'part_number',      // Primary identifier
  'description',      // Context
  'quantity_available', // Core metric
  'status',           // Operational state
  'item_type',        // Classification
  'warehouse_location', // Physical location
  'criticality',      // Priority indicator
  'quantity_on_hand', // Stock level
  'quantity_reserved', // Reserved stock
  'forecast_status',  // Predictive metric
] as const;

/**
 * Extended columns - hidden by default, available via "Show All Columns" toggle (P2-P3 priority)
 * These columns are useful for advanced analysis but clutter the default view
 */
export const PARTS_EXTENDED_KEYS = [
  'serial_number',      // Detail view - not needed for quick scanning
  'abc_classification', // Advanced analysis - power users only
  'expiry',            // Conditional relevance - not all parts have expiry
  'ata_chapter',       // Specialized use - maintenance teams only
] as const;

/**
 * All visible keys when "Show All Columns" is enabled
 */
export const PARTS_ALL_VISIBLE_KEYS = [
  ...PARTS_CORE_VISIBLE_KEYS,
  ...PARTS_EXTENDED_KEYS,
] as const;
