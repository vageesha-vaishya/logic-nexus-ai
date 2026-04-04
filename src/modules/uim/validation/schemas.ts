import { z } from 'zod';

const baseEntitySchema = z.object({
  id: z.string().uuid().optional(),
});

const skuPattern = /^[A-Z0-9_-]{3,32}$/;

export const overviewSchema = baseEntitySchema.extend({
  module_name: z.string().min(3).max(80),
  owner_email: z.string().email(),
  rollout_phase: z.enum(['phase_1', 'phase_2', 'phase_3', 'phase_4']),
  target_go_live_date: z.string().min(1),
  notes: z.string().max(500).optional().or(z.literal('')),
});

export const itemMasterSchema = baseEntitySchema.extend({
  item_name: z.string().min(3).max(120),
  sku: z.string().regex(skuPattern, 'SKU must be 3-32 chars using A-Z, 0-9, _ or -'),
  sku_is_unique: z.boolean().refine((value) => value, {
    message: 'SKU must be unique before saving',
  }),
  category: z.string().min(2).max(64),
  uom: z.enum(['EA', 'KG', 'LB', 'L', 'BOX']),
  reorder_point: z.number().min(0).max(100000),
  safety_stock: z.number().min(0).max(100000),
  length_cm: z.number().min(0).max(10000),
  width_cm: z.number().min(0).max(10000),
  height_cm: z.number().min(0).max(10000),
  weight_kg: z.number().min(0).max(100000),
}).superRefine((value, ctx) => {
  if (value.reorder_point < value.safety_stock) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reorder point must be greater than or equal to safety stock',
      path: ['reorder_point'],
    });
  }
});

export const stockLedgerSchema = baseEntitySchema.extend({
  item_id: z.string().min(1),
  transaction_type: z.enum(['RECEIVE', 'RESERVE', 'RELEASE', 'CONSUME', 'ADJUST']),
  quantity_delta: z.number().min(0),
  resulting_quantity: z.number().min(0),
  transaction_at: z.string().min(1),
  reference: z.string().max(120).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.resulting_quantity < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Resulting quantity cannot be negative',
      path: ['resulting_quantity'],
    });
  }
});

export const reservationsSchema = baseEntitySchema.extend({
  item_id: z.string().min(1),
  requested_quantity: z.number().min(1).max(100000),
  available_quantity: z.number().min(0).max(100000),
  reservation_status: z.enum(['active', 'fulfilled', 'cancelled']),
  expected_use_date: z.string().min(1),
  consumer_reference: z.string().max(120).optional().or(z.literal('')),
}).superRefine((value, ctx) => {
  if (value.requested_quantity > value.available_quantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Requested quantity exceeds available quantity',
      path: ['requested_quantity'],
    });
  }
});

export const issueConsumeSchema = baseEntitySchema.extend({
  item_id: z.string().min(1),
  issue_quantity: z.number().min(1).max(100000),
  available_before_issue: z.number().min(0).max(100000),
  consume_immediately: z.boolean(),
  technician_id: z.string().min(2).max(64),
  issued_at: z.string().min(1),
}).superRefine((value, ctx) => {
  if (value.issue_quantity > value.available_before_issue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Issue quantity cannot exceed available quantity',
      path: ['issue_quantity'],
    });
  }
});

export const restockSchema = baseEntitySchema.extend({
  item_id: z.string().min(1),
  current_quantity: z.number().min(0),
  reorder_point: z.number().min(0),
  recommended_restock_qty: z.number().min(0).max(100000),
  supplier_id: z.string().min(2).max(64),
  due_date: z.string().min(1),
}).superRefine((value, ctx) => {
  if (value.current_quantity > value.reorder_point && value.recommended_restock_qty > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Restock should be zero when current quantity is above reorder point',
      path: ['recommended_restock_qty'],
    });
  }
});

export const locationsSchema = baseEntitySchema.extend({
  location_code: z.string().min(2).max(24),
  location_name: z.string().min(3).max(120),
  address_line_1: z.string().min(3).max(160),
  address_line_2: z.string().max(160).optional().or(z.literal('')),
  city: z.string().min(2).max(80),
  state_region: z.string().min(2).max(80),
  postal_code: z.string().min(3).max(16),
  country_code: z.string().length(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const analyticsSchema = baseEntitySchema.extend({
  report_name: z.string().min(3).max(120),
  date_from: z.string().min(1),
  date_to: z.string().min(1),
  metric_group: z.enum(['inventory_health', 'reservation_efficiency', 'consumption_velocity']),
  include_archived: z.boolean(),
}).superRefine((value, ctx) => {
  if (new Date(value.date_from).getTime() > new Date(value.date_to).getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Date from cannot be later than date to',
      path: ['date_from'],
    });
  }
});

export type UimSchemas = {
  overview: typeof overviewSchema;
  'item-master': typeof itemMasterSchema;
  'stock-ledger': typeof stockLedgerSchema;
  reservations: typeof reservationsSchema;
  'issue-consume': typeof issueConsumeSchema;
  restock: typeof restockSchema;
  locations: typeof locationsSchema;
  analytics: typeof analyticsSchema;
};

export const uimValidationSchemas: UimSchemas = {
  overview: overviewSchema,
  'item-master': itemMasterSchema,
  'stock-ledger': stockLedgerSchema,
  reservations: reservationsSchema,
  'issue-consume': issueConsumeSchema,
  restock: restockSchema,
  locations: locationsSchema,
  analytics: analyticsSchema,
};
