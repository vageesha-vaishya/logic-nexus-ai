import type { z } from 'zod';
import type { UimSchemas } from '@/modules/uim/validation/schemas';

export type UimNodeKey =
  | 'overview'
  | 'item-master'
  | 'stock-ledger'
  | 'reservations'
  | 'issue-consume'
  | 'restock'
  | 'locations'
  | 'analytics';

export type UimFieldType = 'text' | 'email' | 'textarea' | 'number' | 'date' | 'datetime-local' | 'select' | 'checkbox';

export type UimFieldOption = {
  value: string;
  labelKey: string;
  labelDefault: string;
};

export type UimFieldConfig = {
  name: string;
  type: UimFieldType;
  labelKey: string;
  labelDefault: string;
  descriptionKey?: string;
  descriptionDefault?: string;
  autoComplete?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: UimFieldOption[];
};

export type UimNodeConfig = {
  key: UimNodeKey;
  titleKey: string;
  titleDefault: string;
  subtitleKey: string;
  subtitleDefault: string;
  schema: z.ZodTypeAny;
  defaultValues: Record<string, unknown>;
  fields: UimFieldConfig[];
  includesAddressBlock?: boolean;
  includesDimensionBlock?: boolean;
};

export type UimSchemaInput<T extends keyof UimSchemas> = z.input<UimSchemas[T]>;
