import { z } from "zod";

// --- Configuration Schemas ---

export const MarginSchema = z.object({
  top: z.number().min(0),
  bottom: z.number().min(0),
  left: z.number().min(0),
  right: z.number().min(0),
});

export const ConfigSchema = z.object({
  page_size: z.enum(["A4", "Letter", "Legal"]).default("A4"),
  margins: MarginSchema.default({ top: 40, bottom: 40, left: 40, right: 40 }),
  font_family: z.string().default("Roboto"),
  default_locale: z.string().default("en-US"),
  compliance: z.enum(["None", "PDF/A-1b", "PDF/A-2b", "PDF/A-3b"]).default("None"),
});

// --- I18n Schemas ---

export const I18nSchema = z.object({
  labels: z.record(z.record(z.string())).optional(), // key -> locale -> string
});

// --- Section Content Schemas ---

// Static Block Content
export const StaticContentSchema = z.object({
  text: z.string().optional(),
  image_url: z.string().url().optional(),
  alignment: z.enum(["left", "center", "right"]).default("left"),
  style: z.record(z.any()).optional(), // CSS-like style object
});

// Dynamic Table Column
export const TableColumnSchema = z.object({
  field: z.string(),
  label: z.string(),
  width: z.string().or(z.number()).optional(), // "40%" or 100
  format: z.enum(["string", "currency", "date", "decimal"]).optional(),
  align: z.enum(["left", "center", "right"]).default("left"),
});

// Dynamic Table Config
export const DynamicTableConfigSchema = z.object({
  source: z.string(), // e.g., "charges", "legs"
  group_by: z.string().optional(),
  columns: z.array(TableColumnSchema),
  show_subtotals: z.boolean().default(false),
});

// Section Schema
export const SectionSchema = z.object({
  type: z.enum(["header", "footer", "static_block", "key_value_grid", "dynamic_table", "terms_block"]),
  height: z.number().optional(),
  page_break_before: z.boolean().default(false),
  visible_if: z.string().optional(), // Logic expression
  content: StaticContentSchema.optional(),
  table_config: DynamicTableConfigSchema.optional(),
  grid_fields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    format: z.string().optional()
  })).optional(),
});

// --- Root Template Schema ---

export const QuoteTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  name: z.string().min(1),
  version: z.string().default("1.0.0"),
  layout_engine: z.string().default("v2_flex_grid"),
  config: ConfigSchema,
  i18n: I18nSchema.optional(),
  sections: z.array(SectionSchema),
});

export type QuoteTemplate = z.infer<typeof QuoteTemplateSchema>;
export type TemplateSection = z.infer<typeof SectionSchema>;
