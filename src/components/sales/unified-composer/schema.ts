import * as z from 'zod';

const parseNumericInput = (val?: string | null) => {
  if (!val) return NaN;
  const normalized = String(val).trim().replace(/[, ]/g, '');
  if (!normalized) return NaN;
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return NaN;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : NaN;
};

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
  guestEmail: z.string().optional(),
  guestPhone: z.string().optional(),
  guestJobTitle: z.string().optional(),
  guestDepartment: z.string().optional(),
  
  // Addresses
  billingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  shippingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  
  // Tax & References
  taxId: z.string().optional(),
  customerPo: z.string().optional(),
  vendorRef: z.string().optional(),
  projectCode: z.string().optional(),
  
  // Notes
  termsConditions: z.string().optional(),
  internalNotes: z.string().optional(),
  specialInstructions: z.string().optional(),
  notesText: z.string().optional(), // Deprecated but kept for backward compatibility

  // Phase 1: FormZone fields
  mode: z.enum(['air', 'ocean', 'road', 'rail'], {
    required_error: "Please select a transport mode",
  }),
  origin: z.string().min(2, 'Please select a valid origin port'),
  originId: z.string().min(1, 'Please select a valid origin from the list'),
  destination: z.string().min(2, 'Please select a valid destination port'),
  destinationId: z.string().min(1, 'Please select a valid destination from the list'),
  commodity: z.string().min(1, 'Please specify the commodity details').optional(),
  preferredCarriers: z.array(z.string()).optional(),
  weight: z.string().optional().refine((val) => {
    if (!val) return true;
    const n = parseNumericInput(val);
    return !isNaN(n) && n >= 0;
  }, { message: 'Please enter a valid positive weight' }),
  volume: z.string().optional().refine((val) => {
    if (!val) return true;
    const n = parseNumericInput(val);
    return !isNaN(n) && n >= 0;
  }, { message: 'Please enter a valid positive volume' }),
  unit: z.enum(['kg', 'lb', 'cbm']).optional(),
  
  // Extended fields (formerly in extendedData state)
  containerType: z.string().optional(),
  containerSize: z.string().optional(),
  containerQty: z.string().optional(),
  containerCombos: z.array(z.object({
    type: z.string(),
    size: z.string(),
    qty: z.number(),
  })).optional(),
  attachments: z.any().array().optional(),
  htsCode: z.string().optional(),
  dangerousGoods: z.boolean().default(false),
  pickupDate: z.string().optional(),
  deliveryDeadline: z.string().optional(),
  incoterms: z.string().optional(),
  vehicleType: z.string().optional(),
  
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
  // TEMPORARILY DISABLED: Custom commodity validation for debugging
  const commodityValue = data.commodity;
  if (!commodityValue || commodityValue.trim().length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please specify the commodity details', path: ['commodity'] });
  }
  
  if (data.mode === 'air') {
    const parsedWeight = parseNumericInput(data.weight);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Air freight requires a valid weight greater than 0', path: ['weight'] });
    }
  }
  if (data.mode === 'ocean' || data.mode === 'rail') {
    const qtyNum = Number(data.containerQty || '');
    if (!data.containerType) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please select a container type', path: ['containerType'] });
    if (!data.containerSize) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please select a container size', path: ['containerSize'] });
    if (isNaN(qtyNum) || qtyNum <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Container quantity must be at least 1', path: ['containerQty'] });
  }
  if (data.origin.trim().toLowerCase() === data.destination.trim().toLowerCase()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Origin and Destination ports cannot be the same', path: ['destination'] });
  }
  const guestEmail = (data.guestEmail || '').trim();
  const isGuestEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail);
  if (data.standalone) {
    if (!data.guestCompany || data.guestCompany.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Guest company name is required', path: ['guestCompany'] });
    }
    if (!data.guestName || data.guestName.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Contact name is required', path: ['guestName'] });
    }
    if (!guestEmail || !isGuestEmailValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid email format', path: ['guestEmail'] });
    }
    // Phone validation (E.164-ish)
    if (data.guestPhone && !/^\+?[1-9]\d{1,14}$/.test(data.guestPhone.replace(/[\s-()]/g, ''))) {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please enter a valid phone number', path: ['guestPhone'] });
    }
    // Tax ID
    if (data.taxId && !/^[A-Z0-9-]{5,20}$/i.test(data.taxId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please enter a valid Tax ID', path: ['taxId'] });
    }
    
    // Billing Address Mandatory
    if (!data.billingAddress?.street?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Billing street address is required', path: ['billingAddress', 'street'] });
    if (!data.billingAddress?.city?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Billing city is required', path: ['billingAddress', 'city'] });
    if (!data.billingAddress?.country?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Billing country is required', path: ['billingAddress', 'country'] });
  } else {
    if (guestEmail && !isGuestEmailValid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid email format', path: ['guestEmail'] });
    }
    if (!data.opportunityId && !data.accountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please link this quote to an Opportunity or Account', path: ['opportunityId'] });
    }
  }
});

export type QuoteComposerValues = z.infer<typeof quoteComposerSchema>;
export type FormZoneValues = QuoteComposerValues;
