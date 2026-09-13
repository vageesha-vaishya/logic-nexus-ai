import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Building2, User } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { logger } from "@/lib/logger";
import { useAutoSaveForm } from '@/hooks/useAutoSaveForm';
import { FormSection, FormGrid, FormItem as LayoutItem } from '@/components/forms/FormLayout';

// --- Zod Schemas ---

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
});

// Combined schema for flexibility
const partnerSchema = z.object({
  // Common / Meta
  type: z.enum(['company', 'individual']),
  tenant_id: z.string().optional(),

  // Company Fields
  name: z.string().min(1, "Company name is required").optional().or(z.literal('')),
  account_type: z.string().optional(),
  industry: z.string().optional(),
  annual_revenue: z.string().optional(), // Input as string, convert to number
  employee_count: z.string().optional(), // Input as string, convert to number
  vat_number: z.string().optional(),
  parent_account_id: z.string().optional(),

  // Individual Fields
  first_name: z.string().min(1, "First name is required").optional().or(z.literal('')),
  last_name: z.string().min(1, "Last name is required").optional().or(z.literal('')),
  job_title: z.string().optional(),
  account_id: z.string().optional(), // Link to company
  department: z.string().optional(),
  mobile: z.string().optional(),
  lifecycle_stage: z.string().optional(),

  // Shared Contact Info
  email: z.string().email("Invalid email").optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal('')), // Website or LinkedIn

  // Address (Shared structure)
  address: addressSchema.optional(),

  // Misc
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  if (data.type === 'company') {
    if (!data.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Company name is required",
        path: ["name"],
      });
    }
  } else {
    if (!data.first_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "First name is required",
        path: ["first_name"],
      });
    }
    if (!data.last_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Last name is required",
        path: ["last_name"],
      });
    }
  }
});

type PartnerFormData = z.infer<typeof partnerSchema>;

interface UnifiedPartnerFormProps {
  initialData?: any;
  entityType?: 'account' | 'contact'; // If editing, force type
  mode?: 'create' | 'edit';
  onSubmit: (data: PartnerFormData) => Promise<void>;
  onAutoSave?: (data: PartnerFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  autoSave?: boolean;
  autoSaveDelayMs?: number;
}

export function UnifiedPartnerForm({
  initialData,
  entityType,
  mode = 'create',
  onSubmit,
  onAutoSave,
  onCancel,
  isLoading = false,
  autoSave = false,
  autoSaveDelayMs = 30000
}: UnifiedPartnerFormProps) {
  // Determine initial type
  const defaultType = entityType === 'contact' ? 'individual' : 'company';

  const form = useForm<PartnerFormData>({
    resolver: zodResolver(partnerSchema),
    defaultValues: {
      type: defaultType,
      tenant_id: initialData?.tenant_id || '',
      name: initialData?.name || '',
      first_name: initialData?.first_name || '',
      last_name: initialData?.last_name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      website: initialData?.website || initialData?.linkedin_url || '',
      job_title: initialData?.job_title || initialData?.title || '', // Map 'title' to job_title
      account_id: initialData?.account_id || '',
      vat_number: initialData?.vat_number || '',
      notes: initialData?.notes || '',
      address: {
        street: initialData?.billing_street || initialData?.shipping_street || '',
        city: initialData?.billing_city || initialData?.shipping_city || '',
        state: initialData?.billing_state || initialData?.shipping_state || '',
        postal_code: initialData?.billing_postal_code || initialData?.shipping_postal_code || '',
        country: initialData?.billing_country || initialData?.shipping_country || '',
      },
      account_type: initialData?.account_type || 'prospect',
      lifecycle_stage: initialData?.lifecycle_stage || 'lead',
      industry: initialData?.industry || '',
      annual_revenue: initialData?.annual_revenue ? String(initialData.annual_revenue) : '',
      employee_count: initialData?.employee_count ? String(initialData.employee_count) : '',
      ...initialData
    },
  });

  const partnerType = form.watch('type');
  const { scopedDb, context, supabase } = useCRM();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    async function fetchTenants() {
      if (context?.isPlatformAdmin && mode === 'create') {
        const { data } = await supabase.from('tenants').select('id, name').order('name');
        setTenants(data || []);
      }
    }
    fetchTenants();
  }, [context?.isPlatformAdmin, mode, supabase]);

  useEffect(() => {
    async function fetchAccounts() {
      if (!scopedDb) return;
      try {
        const { data, error } = await scopedDb
          .from('v_accounts')
          .select('id, name')
          .order('name');

        if (error) throw error;
        setAccounts(data || []);
      } catch (err) {
        logger.error('Error fetching accounts:', err);
      }
    }
    fetchAccounts();
  }, [scopedDb]);

  const { autoSaveError } = useAutoSaveForm({
    form,
    onAutoSave: onAutoSave ?? (async () => {}),
    enabled: autoSave && mode === 'edit' && !!onAutoSave,
    delayMs: autoSaveDelayMs,
  });

  const entityLabel = partnerType === 'company' ? 'Account' : 'Contact';

  return (
    <div className="p-6">
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {autoSave && autoSaveError ? (
          <p className="text-xs text-destructive">{autoSaveError}</p>
        ) : null}

        <FormSection
          title={mode === 'create' ? `New ${entityLabel} Details` : `${entityLabel} Details`}
          description="Core identity information"
        >
          <FormGrid columns={2} className="gap-x-4 gap-y-5">
            {mode === 'create' && context?.isPlatformAdmin && (
              <LayoutItem span={1}>
                <FormField
                  control={form.control}
                  name="tenant_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tenant</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Tenant" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tenants.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </LayoutItem>
            )}

            {mode === 'create' && !entityType && (
              <LayoutItem span={2}>
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-8"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0 cursor-pointer">
                            <FormControl>
                              <RadioGroupItem value="company" id="r-company" />
                            </FormControl>
                            <FormLabel htmlFor="r-company" className="font-normal cursor-pointer flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              Company
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0 cursor-pointer">
                            <FormControl>
                              <RadioGroupItem value="individual" id="r-individual" />
                            </FormControl>
                            <FormLabel htmlFor="r-individual" className="font-normal cursor-pointer flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              Individual
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </LayoutItem>
            )}

            {partnerType === 'company' ? (
              <LayoutItem span={2}>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Lumber Inc" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </LayoutItem>
            ) : (
              <>
                <LayoutItem span={1}>
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="First Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </LayoutItem>
                <LayoutItem span={1}>
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Last Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </LayoutItem>
                <LayoutItem span={1}>
                  <FormField
                    control={form.control}
                    name="job_title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Job Position" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </LayoutItem>
                <LayoutItem span={1}>
                  <FormField
                    control={form.control}
                    name="account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {accounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </LayoutItem>
              </>
            )}
          </FormGrid>
        </FormSection>

        <FormSection title="Address">
          <FormGrid columns={2} className="gap-x-4 gap-y-5">
            <LayoutItem span={2}>
              <FormField
                control={form.control}
                name="address.street"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street</FormLabel>
                    <FormControl>
                      <Input placeholder="Street..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </LayoutItem>
            <LayoutItem span={1}>
              <FormField
                control={form.control}
                name="address.city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </LayoutItem>
            <LayoutItem span={1}>
              <FormField
                control={form.control}
                name="address.state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="State" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </LayoutItem>
            <LayoutItem span={1}>
              <FormField
                control={form.control}
                name="address.postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP</FormLabel>
                    <FormControl>
                      <Input placeholder="ZIP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </LayoutItem>
            <LayoutItem span={1}>
              <FormField
                control={form.control}
                name="address.country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="Country" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </LayoutItem>
          </FormGrid>
        </FormSection>

        <FormSection title="Communication">
          <FormGrid columns={2} className="gap-x-4 gap-y-5">
            <LayoutItem span={1}>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </LayoutItem>
            {partnerType === 'individual' && (
              <LayoutItem span={1}>
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile</FormLabel>
                      <FormControl>
                        <Input placeholder="+1..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </LayoutItem>
            )}
            <LayoutItem span={1}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </LayoutItem>
            <LayoutItem span={1}>
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website / LinkedIn</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </LayoutItem>
          </FormGrid>
        </FormSection>

        {partnerType === 'company' ? (
          <FormSection title="Company Details">
            <FormGrid columns={2} className="gap-x-4 gap-y-5">
              <LayoutItem span={1}>
                <FormField
                  control={form.control}
                  name="account_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="prospect">Prospect</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="partner">Partner</SelectItem>
                          <SelectItem value="vendor">Vendor</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </LayoutItem>
              <LayoutItem span={1}>
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Manufacturing" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </LayoutItem>
              <LayoutItem span={1}>
                <FormField
                  control={form.control}
                  name="annual_revenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Annual Revenue</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </LayoutItem>
              <LayoutItem span={1}>
                <FormField
                  control={form.control}
                  name="employee_count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employees</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </LayoutItem>
              <LayoutItem span={1}>
                <FormField
                  control={form.control}
                  name="vat_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID / VAT</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. US123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </LayoutItem>
            </FormGrid>
          </FormSection>
        ) : (
          <FormSection title="Contact Details">
            <FormGrid columns={2} className="gap-x-4 gap-y-5">
              <LayoutItem span={1}>
                <FormField
                  control={form.control}
                  name="lifecycle_stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lifecycle Stage</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Stage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="subscriber">Subscriber</SelectItem>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="mql">MQL</SelectItem>
                          <SelectItem value="sql">SQL</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="evangelist">Evangelist</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </LayoutItem>
            </FormGrid>
          </FormSection>
        )}

        <FormSection title="Notes">
          <FormGrid columns={2} className="gap-x-4 gap-y-5">
            <LayoutItem span={2}>
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Prospect, Vendor"
                        {...field}
                        value={Array.isArray(field.value) ? field.value.join(', ') : field.value || ''}
                        onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </LayoutItem>
            <LayoutItem span={2}>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add internal notes..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </LayoutItem>
          </FormGrid>
        </FormSection>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'create' ? `Create ${entityLabel}` : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
    </div>
  );
}
