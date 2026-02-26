import { z } from 'zod';

// Zod Schema for Account Validation
export const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
});

export const contactSchema = z.object({
  first_name: z.string().min(1, "First Name is required"),
  last_name: z.string().min(1, "Last Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  title: z.string().optional(),
});

export const referenceSchema = z.object({
  type: z.enum(['customer_po', 'vendor_ref', 'project_code', 'other']),
  value: z.string().min(1, "Reference Value is required"),
  description: z.string().optional(),
});

export const noteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
  type: z.enum(['general', 'internal', 'instruction', 'terms']),
  is_pinned: z.boolean().optional(),
});

export const accountSchema = z.object({
  name: z.string().min(1, "Company Name is required"),
  tax_id: z.string().optional(), // Optional but validated format if present
  website: z.string().url("Invalid URL").optional().or(z.literal('')),
  email: z.string().email("Invalid email").optional().or(z.literal('')),
  phone: z.string().optional(),
  billing_address: addressSchema.optional(),
  shipping_address: addressSchema.optional(),
  primary_contact: contactSchema.optional(),
  references: z.array(referenceSchema).optional(),
  notes: z.array(noteSchema).optional(),
});

export type AccountInput = z.infer<typeof accountSchema>;

export class AccountValidationService {
  static validate(data: unknown): { success: boolean; data?: AccountInput; error?: z.ZodError } {
    const result = accountSchema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  }

  static formatTaxId(taxId: string): string {
    // Example formatter: Remove non-alphanumeric and uppercase
    return taxId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }
}
