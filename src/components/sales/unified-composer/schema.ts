import * as z from 'zod';

export const quoteComposerSchema = z.object({
  // Phase 0: General Info
  accountId: z.string().optional(),
  contactId: z.string().optional(),
  quoteTitle: z.string().optional(),
  opportunityId: z.string().optional(),
  quoteNumber: z
    .string()
    .max(32, 'Quote number too long')
    .regex(/^[A-Za-z0-9._-]*$/, 'Only letters, numbers, dot, dash and underscore allowed')
    .optional(),
  standalone: z.boolean().default(false),
  // Standalone guest fields
  guestCompany: z.string().optional(),
  guestName: z.string().optional(),
  guestEmail: z.string().email('Invalid email format').optional(),
  guestPhone: z.string().optional(),
  customerPo: z.string().optional(),
  vendorRef: z.string().optional(),
  projectCode: z.string().optional(),
  termsConditions: z.string().optional(),
  notesText: z.string().optional(),

  // Phase 1: FormZone fields
  mode: z.enum(['air', 'ocean', 'road', 'rail']),
  origin: z.string().min(2, 'Origin is required'),
  destination: z.string().min(2, 'Destination is required'),
  commodity: z.string().min(2, 'Commodity is required'),
  preferredCarriers: z.array(z.string()).optional(),
  weight: z.string().optional().refine((val) => {
    if (!val) return true;
    const n = Number(val);
    return !isNaN(n) && n >= 0;
  }, { message: 'Weight must be a non-negative number' }),
  volume: z.string().optional().refine((val) => {
    if (!val) return true;
    const n = Number(val);
    return !isNaN(n) && n >= 0;
  }, { message: 'Volume must be a non-negative number' }),
  unit: z.enum(['kg', 'lb', 'cbm']).optional(),
  
  // Extended fields (formerly in extendedData state)
  containerType: z.string().optional(),
  containerSize: z.string().optional(),
  containerQty: z.string().optional(),
  htsCode: z.string().optional(),
  dangerousGoods: z.boolean().default(false),
  pickupDate: z.string().optional(),
  deliveryDeadline: z.string().optional(),
  incoterms: z.string().optional(),
  
  // Phase 2: Results & Finalize fields
  selectedOptionId: z.string().optional(),
  notes: z.string().optional(),
  marginPercent: z.number().default(15),
  autoMargin: z.boolean().default(true),
  
  // Charges (will use useFieldArray)
  charges: z.array(z.object({
    id: z.string(),
    legId: z.string().nullable(),
    category_id: z.string(),
    basis_id: z.string(),
    currency_id: z.string(),
    buy: z.object({
      quantity: z.number(),
      rate: z.number(),
      amount: z.number(),
    }),
    sell: z.object({
      quantity: z.number(),
      rate: z.number(),
      amount: z.number(),
    }),
    note: z.string().optional(),
  })).optional(),
}).superRefine((data, ctx) => {
  if (data.mode === 'air') {
    if (!data.weight || isNaN(Number(data.weight)) || Number(data.weight) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid weight is required for Air', path: ['weight'] });
    }
  }
  if (data.mode === 'ocean' || data.mode === 'rail') {
    const qtyNum = Number(data.containerQty || '');
    if (!data.containerType) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Container type is required', path: ['containerType'] });
    if (!data.containerSize) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Container size is required', path: ['containerSize'] });
    if (isNaN(qtyNum) || qtyNum <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Container quantity must be > 0', path: ['containerQty'] });
  }
  if (data.origin.trim().toLowerCase() === data.destination.trim().toLowerCase()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Origin and Destination cannot be the same', path: ['destination'] });
  }
  if (data.standalone) {
    if (!data.guestCompany || data.guestCompany.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Company is required in standalone mode', path: ['guestCompany'] });
    }
    if (!data.guestName || data.guestName.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Contact name is required in standalone mode', path: ['guestName'] });
    }
    if (!data.guestEmail || data.guestEmail.trim().length < 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Contact email is required in standalone mode', path: ['guestEmail'] });
    }
  } else {
    if (!data.opportunityId && !data.accountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select an Opportunity or Account', path: ['opportunityId'] });
    }
  }
});

export type QuoteComposerValues = z.infer<typeof quoteComposerSchema>;
export type FormZoneValues = QuoteComposerValues;
