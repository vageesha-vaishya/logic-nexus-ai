import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';

const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  title: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  linkedin_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  department: z.string().optional(),
  lifecycle_stage: z.enum(['subscriber', 'lead', 'mql', 'sql', 'customer', 'evangelist', 'other']).optional(),
  lead_source: z.string().optional(),
  social_profiles: z.string().optional(),
  custom_fields: z.string().optional(),
  account_id: z.string().optional(),
  is_primary: z.boolean().default(false),
  notes: z.string().optional(),
  tenant_id: z.string().optional(),
  franchise_id: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  initialData?: any;
  onSubmit: (data: ContactFormData) => Promise<void>;
  onCancel: () => void;
}

export function ContactForm({ initialData, onSubmit, onCancel }: ContactFormProps) {
  const { supabase, context, scopedDb } = useCRM();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<ContactFormData | null>(null);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: initialData?.first_name || '',
      last_name: initialData?.last_name || '',
      title: initialData?.title || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      mobile: initialData?.mobile || '',
      linkedin_url: initialData?.linkedin_url || '',
      department: initialData?.department || '',
      reports_to: initialData?.reports_to || 'none',
      lifecycle_stage: initialData?.lifecycle_stage || 'lead',
      lead_source: initialData?.lead_source || '',
      social_profiles: initialData?.social_profiles ? JSON.stringify(initialData.social_profiles, null, 2) : '',
      custom_fields: initialData?.custom_fields ? JSON.stringify(initialData.custom_fields, null, 2) : '',
      account_id: initialData?.account_id || '',
      is_primary: initialData?.is_primary || false,
      notes: initialData?.notes || '',
      tenant_id: initialData?.tenant_id || context.tenantId || '',
      franchise_id: initialData?.franchise_id || context.franchiseId || '',
    },
  });

  const fetchAccounts = async () => {
    const { data } = await scopedDb
      .from('accounts')
      .select('id, name')
      .order('name');
    if (data) setAccounts(data as any[]);
  };

  useEffect(() => {
    fetchAccounts();
    if (context.isPlatformAdmin) {
      fetchTenants();
    }
    if (context.isPlatformAdmin || context.isTenantAdmin) {
      fetchFranchises();
    }
  }, [context]);

  const fetchTenants = async () => {
    const { data } = await scopedDb
      .from('tenants', true)
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (data) setTenants(data as any[]);
  };

  const fetchFranchises = async () => {
    let query = scopedDb
      .from('franchises')
      .select('id, name, code')
      .eq('is_active', true);
    
    const { data } = await query.order('name');
    if (data) setFranchises(data as any[]);
  };

  const { isSubmitting } = form.formState;

  const handleFormSubmit = (data: ContactFormData) => {
    setPendingData(data);
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    if (pendingData) {
      setShowConfirmDialog(false);
      await onSubmit(pendingData);
      setPendingData(null);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Sales Manager" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <FormControl>
                  <Input placeholder="Sales" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lifecycle_stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lifecycle Stage</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
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

          <FormField
            control={form.control}
            name="lead_source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead Source</FormLabel>
                <FormControl>
                  <Input placeholder="Referral, Website, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="john.doe@example.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mobile"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 987-6543" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="linkedin_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>LinkedIn URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://linkedin.com/in/username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_primary"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Primary Contact</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Mark as the main contact for this account
                  </p>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional notes..."
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="social_profiles"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Social Profiles (JSON)</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder='{"twitter": "https://twitter.com/jdoe", "facebook": "..."}' 
                    className="font-mono text-xs"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="custom_fields"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Custom Fields (JSON)</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder='{"hobby": "fishing", "vip_status": true}' 
                    className="font-mono text-xs"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {context.isPlatformAdmin && (
            <FormField
              control={form.control}
              name="tenant_id"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Tenant *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tenant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {(context.isPlatformAdmin || context.isTenantAdmin) && franchises.length > 0 && (
            <FormField
              control={form.control}
              name="franchise_id"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Franchise (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select franchise" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {franchises.map((franchise) => (
                        <SelectItem key={franchise.id} value={franchise.id}>
                          {franchise.code} - {franchise.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData?.id ? 'Update Contact' : 'Create Contact'}
          </Button>
        </div>
      </form>
    </Form>

    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm {initialData?.id ? 'Update' : 'Create'}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to {initialData?.id ? 'update' : 'create'} this contact?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}
