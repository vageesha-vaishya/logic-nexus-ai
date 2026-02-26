import { z } from 'zod';

export const leadConversionSchema = z.object({
  createAccount: z.boolean(),
  accountName: z.string().min(1, 'Account Name is required').optional(),
  accountEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  accountPhone: z.string().optional(),
  accountAddress: z.string().optional(),
  accountCity: z.string().optional(),
  accountState: z.string().optional(),
  accountZip: z.string().optional(),
  accountCountry: z.string().optional(),
  accountWebsite: z.string().url('Invalid URL').optional().or(z.literal('')),
  industry: z.string().optional(),

  createContact: z.boolean(),
  firstName: z.string().min(1, 'First Name is required').optional(),
  lastName: z.string().min(1, 'Last Name is required').optional(),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  contactTitle: z.string().optional(),

  createOpportunity: z.boolean(),
  opportunityName: z.string().min(1, 'Opportunity Name is required').optional(),
  opportunityAmount: z.number().min(0).optional(),
  opportunityCloseDate: z.string().optional(),
  opportunityStage: z.string().optional(),

  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.createAccount) {
    if (!data.accountName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Account Name is required',
        path: ['accountName'],
      });
    }
  }
  if (data.createContact) {
    if (!data.firstName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'First Name is required',
        path: ['firstName'],
      });
    }
    if (!data.lastName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Last Name is required',
        path: ['lastName'],
      });
    }
  }
  if (data.createOpportunity) {
    if (!data.opportunityName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Opportunity Name is required',
        path: ['opportunityName'],
      });
    }
  }
});

export type LeadConversionValues = z.infer<typeof leadConversionSchema>;
