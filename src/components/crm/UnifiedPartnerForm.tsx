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
import { cn } from '@/lib/utils';

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
  onCancel: () => void;
  isLoading?: boolean;
}

export function UnifiedPartnerForm({ 
  initialData, 
  entityType, 
  mode = 'create', 
  onSubmit, 
  onCancel,
  isLoading = false
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
          .from('accounts')
          .select('id, name')
          .order('name');
        
        if (error) throw error;
        setAccounts(data || []);
      } catch (err) {
        console.error('Error fetching accounts:', err);
      }
    }
    fetchAccounts();
  }, [scopedDb]);

  // Enterprise Input Style Helper
  const inputStyle = "border-0 border-b border-gray-300 rounded-none focus-visible:ring-0 focus-visible:border-[#714B67] px-0 h-9 placeholder:text-gray-300";
  const labelStyle = "text-xs font-semibold text-gray-500 mb-1";

  return (
    <div className="w-full max-w-5xl mx-auto p-6 bg-white shadow-sm border border-gray-100 rounded-sm">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          {/* Platform Admin: Tenant Selector */}
          {mode === 'create' && context?.isPlatformAdmin && (
            <div className="mb-6">
                <FormField
                    control={form.control}
                    name="tenant_id"
                    render={({ field }) => (
                    <FormItem className="max-w-md">
                        <FormLabel className={labelStyle}>Tenant</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger className={inputStyle}>
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
            </div>
          )}

          {/* Top Bar: Type Selector */}
          {mode === 'create' && !entityType && (
            <div className="flex items-center space-x-6 pb-6 border-b border-gray-100">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-8"
                      >
                        <FormItem className="flex items-center space-x-2 space-y-0 cursor-pointer">
                          <FormControl>
                            <RadioGroupItem value="company" id="r-company" className="text-[#714B67] border-gray-300" />
                          </FormControl>
                          <FormLabel htmlFor="r-company" className="font-medium text-base cursor-pointer flex items-center gap-2 text-gray-700">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            Company
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0 cursor-pointer">
                          <FormControl>
                            <RadioGroupItem value="individual" id="r-individual" className="text-[#714B67] border-gray-300" />
                          </FormControl>
                          <FormLabel htmlFor="r-individual" className="font-medium text-base cursor-pointer flex items-center gap-2 text-gray-700">
                            <User className="w-4 h-4 text-gray-400" />
                            Individual
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Main Form Content - Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            
            {/* Left Column: Avatar & Main Identity */}
            <div className="md:col-span-12 lg:col-span-8 space-y-8">
              
              {/* Name Section */}
              <div className="flex gap-6 items-start">
                 {/* Placeholder for Avatar */}
                 <div className="w-24 h-24 bg-gray-50 border border-gray-200 rounded-sm flex items-center justify-center text-gray-300 shrink-0 shadow-inner">
                    {partnerType === 'company' ? <Building2 size={40} /> : <User size={40} />}
                 </div>
                 
                 <div className="flex-1 space-y-4 pt-1">
                    {partnerType === 'company' ? (
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                <Input 
                                    placeholder="e.g. Lumber Inc" 
                                    className="text-3xl font-bold h-12 px-0 border-0 border-b border-gray-300 rounded-none focus-visible:ring-0 focus-visible:border-[#714B67] placeholder:text-gray-300" 
                                    {...field} 
                                />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    ) : (
                        <div className="flex gap-4">
                            <FormField
                                control={form.control}
                                name="first_name"
                                render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                    <Input 
                                        placeholder="First Name" 
                                        className="text-3xl font-bold h-12 px-0 border-0 border-b border-gray-300 rounded-none focus-visible:ring-0 focus-visible:border-[#714B67] placeholder:text-gray-300" 
                                        {...field} 
                                    />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="last_name"
                                render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                    <Input 
                                        placeholder="Last Name" 
                                        className="text-3xl font-bold h-12 px-0 border-0 border-b border-gray-300 rounded-none focus-visible:ring-0 focus-visible:border-[#714B67] placeholder:text-gray-300" 
                                        {...field} 
                                    />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    )}

                    {/* Sub-fields under name */}
                    {partnerType === 'individual' && (
                        <div className="flex gap-4 items-center max-w-lg">
                            <FormField
                                control={form.control}
                                name="job_title"
                                render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                    <Input placeholder="Job Position" className={inputStyle} {...field} />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                            <span className="text-gray-400 text-sm">at</span>
                            <FormField
                                control={form.control}
                                name="account_id"
                                render={({ field }) => (
                                <FormItem className="flex-1">
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className={cn(inputStyle, "flex w-full items-center justify-between bg-transparent text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50")}>
                                            <SelectValue placeholder="Company" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {accounts.map((acc) => (
                                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                </FormItem>
                                )}
                            />
                        </div>
                    )}
                 </div>
              </div>

              {/* Address & Contact Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6 pt-2">
                  {/* Left Column: Address */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-400 border-b border-gray-100 pb-2 mb-4">Address</h3>
                    
                    <div className="space-y-2">
                        <FormField
                            control={form.control}
                            name="address.street"
                            render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                <Input placeholder="Street..." className={inputStyle} {...field} />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                        <div className="flex gap-2">
                            <FormField
                                control={form.control}
                                name="address.city"
                                render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                    <Input placeholder="City" className={inputStyle} {...field} />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="address.state"
                                render={({ field }) => (
                                <FormItem className="w-24">
                                    <FormControl>
                                    <Input placeholder="State" className={inputStyle} {...field} />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex gap-2">
                            <FormField
                                control={form.control}
                                name="address.postal_code"
                                render={({ field }) => (
                                <FormItem className="w-32">
                                    <FormControl>
                                    <Input placeholder="ZIP" className={inputStyle} {...field} />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="address.country"
                                render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                    <Input placeholder="Country" className={inputStyle} {...field} />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                        </div>
                    </div>
                    
                    {partnerType === 'company' && (
                         <div className="pt-6 space-y-4">
                             <h3 className="text-sm font-bold uppercase tracking-wide text-gray-400 border-b border-gray-100 pb-2 mb-2">Tax ID</h3>
                            <FormField
                                control={form.control}
                                name="vat_number"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={labelStyle}>Tax ID / VAT</FormLabel>
                                    <FormControl>
                                    <Input placeholder="e.g. US123456789" className={inputStyle} {...field} />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                         </div>
                    )}
                  </div>

                  {/* Right Column: Communication */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-gray-400 border-b border-gray-100 pb-2 mb-4">Communication</h3>
                    
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className={labelStyle}>Phone</FormLabel>
                            <FormControl>
                            <Input placeholder="+1..." className={inputStyle} {...field} />
                            </FormControl>
                        </FormItem>
                        )}
                    />
                    
                    {partnerType === 'individual' && (
                        <FormField
                            control={form.control}
                            name="mobile"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className={labelStyle}>Mobile</FormLabel>
                                <FormControl>
                                <Input placeholder="+1..." className={inputStyle} {...field} />
                                </FormControl>
                            </FormItem>
                            )}
                        />
                    )}

                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className={labelStyle}>Email</FormLabel>
                            <FormControl>
                            <Input placeholder="name@example.com" className={inputStyle} {...field} />
                            </FormControl>
                        </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="website"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className={labelStyle}>Website / LinkedIn</FormLabel>
                            <FormControl>
                            <Input placeholder="https://..." className={inputStyle} {...field} />
                            </FormControl>
                        </FormItem>
                        )}
                    />

                    {/* Company Specific Details */}
                    {partnerType === 'company' && (
                        <>
                            <div className="pt-4 border-t border-gray-100 mt-4 mb-2">
                                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-400 pb-2">Company Details</h3>
                            </div>
                            <FormField
                                control={form.control}
                                name="account_type"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={labelStyle}>Account Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className={cn(inputStyle, "flex w-full items-center justify-between bg-transparent text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50")}>
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
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="industry"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className={labelStyle}>Industry</FormLabel>
                                    <FormControl>
                                    <Input placeholder="e.g. Manufacturing" className={inputStyle} {...field} />
                                    </FormControl>
                                </FormItem>
                                )}
                            />
                            <div className="flex gap-4">
                                <FormField
                                    control={form.control}
                                    name="annual_revenue"
                                    render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel className={labelStyle}>Annual Revenue</FormLabel>
                                        <FormControl>
                                        <Input type="number" placeholder="0.00" className={inputStyle} {...field} />
                                        </FormControl>
                                    </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="employee_count"
                                    render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel className={labelStyle}>Employees</FormLabel>
                                        <FormControl>
                                        <Input type="number" placeholder="0" className={inputStyle} {...field} />
                                        </FormControl>
                                    </FormItem>
                                    )}
                                />
                            </div>
                        </>
                    )}

                    {/* Contact Specific Details */}
                    {partnerType === 'individual' && (
                        <FormField
                            control={form.control}
                            name="lifecycle_stage"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className={labelStyle}>Lifecycle Stage</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className={cn(inputStyle, "flex w-full items-center justify-between bg-transparent text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50")}>
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
                            </FormItem>
                            )}
                        />
                    )}

                    <FormField
                        control={form.control}
                        name="tags"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className={labelStyle}>Tags</FormLabel>
                            <FormControl>
                             <Input 
                                placeholder="e.g. Prospect, Vendor" 
                                className={inputStyle} 
                                {...field} 
                                value={Array.isArray(field.value) ? field.value.join(', ') : field.value || ''}
                                onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))}
                             />
                            </FormControl>
                        </FormItem>
                        )}
                    />
                  </div>
              </div>
            </div>

            {/* Right Sidebar / Tabbed Area for Extra Info */}
            <div className="md:col-span-12 lg:col-span-12 pt-6">
                <div className="border-t border-gray-100 pt-6">
                     <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-sm font-semibold text-gray-700">Internal Notes</FormLabel>
                            <FormControl>
                            <Textarea 
                                placeholder="Add internal notes..." 
                                className="min-h-[100px] border-gray-200 resize-none bg-yellow-50/20 focus-visible:ring-[#714B67]" 
                                {...field} 
                            />
                            </FormControl>
                        </FormItem>
                        )}
                    />
                </div>
            </div>

          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onCancel} className="border-gray-300">
              Discard
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-[#714B67] hover:bg-[#5e3d55] text-white">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create Partner' : 'Save Changes'}
            </Button>
          </div>

        </form>
      </Form>
    </div>
  );
}
