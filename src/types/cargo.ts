
import { z } from 'zod';

// --- Enterprise Data Model: Digital Twin Cargo ---

export const dimensionsSchema = z.object({
  l: z.number().min(0, 'Length must be positive'),
  w: z.number().min(0, 'Width must be positive'),
  h: z.number().min(0, 'Height must be positive'),
  unit: z.enum(['cm', 'in']),
});

export const weightSchema = z.object({
  value: z.number().min(0, 'Weight must be positive'),
  unit: z.enum(['kg', 'lb']),
});

export const hazmatSchema = z.object({
  unNumber: z.string().min(4, 'Invalid UN Number').max(4),
  class: z.string().min(1, 'Class is required'),
  packingGroup: z.enum(['I', 'II', 'III']),
  flashPoint: z.object({
    value: z.number(),
    unit: z.enum(['C', 'F']),
  }).optional(),
});

export const cargoItemSchema = z.object({
  id: z.string().uuid().optional(), // Optional for new items before persistence
  type: z.enum(['loose', 'container', 'unit']),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  dimensions: dimensionsSchema,
  volume: z.number().min(0, 'Volume must be positive').optional(),
  containerDetails: z.object({
    typeId: z.string().optional(),
    sizeId: z.string().optional(),
    temperature: z.number().optional(),
    ventilation: z.number().optional(),
  }).optional(),
  weight: weightSchema,
  stackable: z.boolean().default(false),
  hazmat: hazmatSchema.optional(),
  
  // Integration with Commodity Catalog
  commodity: z.object({
    description: z.string().min(1, 'Description is required'),
    hts_code: z.string().optional(),
    id: z.string().optional(), // Master Commodity ID
  }).optional(),
});

export type Dimensions = z.infer<typeof dimensionsSchema>;
export type Weight = z.infer<typeof weightSchema>;
export type HazmatDetails = z.infer<typeof hazmatSchema>;
export type CargoItem = z.infer<typeof cargoItemSchema>;

// Helper for default values
export const DEFAULT_CARGO_ITEM: Partial<CargoItem> = {
  type: 'loose',
  quantity: 1,
  dimensions: { l: 0, w: 0, h: 0, unit: 'cm' },
  weight: { value: 0, unit: 'kg' },
  stackable: false,
};
