import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';
import { CrudFormLayout } from '@/components/system/CrudFormLayout';
import { FormSection } from '@/components/system/FormSection';
import { FormStepper } from '@/components/system/FormStepper';
import { invokeFunction } from '@/lib/supabase-functions';

const parsePositiveInteger = (value?: string | number | null) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const franchiseSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters'),
  tenant_id: z.string().min(1, 'Tenant is required'),
  manager_id: z.string().optional(),
  user_limit: z.string().optional().or(z.literal('')),
  is_active: z.boolean().default(true),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    website: z.string().optional(),
    communication: z.object({
      whatsapp: z.string().optional(),
      telegram: z.string().optional(),
      preferred: z.string().optional(),
    }).optional(),
    demographics: z.object({
      founded_year: z.string().optional(),
      employee_count: z.string().optional(),
      languages: z.string().optional(),
      revenue_range: z.string().optional(),
    }).optional(),
  }).optional(),
}).superRefine((data, ctx) => {
  if (!data.user_limit) return;
  const parsed = parsePositiveInteger(data.user_limit);
  if (!parsed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'User limit must be greater than 0',
      path: ['user_limit'],
    });
  }
});

type FranchiseFormValues = z.infer<typeof franchiseSchema>;

interface FranchiseFormProps {
  franchise?: any;
  onSuccess?: () => void;
}

export function FranchiseForm({ franchise, onSuccess }: FranchiseFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { context, scopedDb, supabase } = useCRM();
  const [tenants, setTenants] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<FranchiseFormValues | null>(null);

  const form = useForm<FranchiseFormValues>({
    resolver: zodResolver(franchiseSchema),
    defaultValues: {
      name: franchise?.name || '',
      code: franchise?.code || '',
      tenant_id: franchise?.tenant_id || context.tenantId || '',
      manager_id: franchise?.manager_id || '',
      user_limit: franchise?.user_limit != null ? String(franchise.user_limit) : '',
      is_active: franchise?.is_active ?? true,
      address: typeof franchise?.address === 'string' 
        ? JSON.parse(franchise.address) 
        : franchise?.address || { 
          street: '', 
          city: '', 
          state: '', 
          zip: '', 
          country: '',
          phone: '',
          email: '',
          website: '',
          communication: { whatsapp: '', telegram: '', preferred: '' },
          demographics: { founded_year: '', employee_count: '', languages: '', revenue_range: '' },
        },
    },
  });

  // Watch tenant_id to refetch managers
  const selectedTenantId = form.watch('tenant_id');

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchManagers(selectedTenantId);
    } else {
      setManagers([]);
    }
  }, [selectedTenantId]);

  const resolveTenantMaxUsers = async (tenantId: string) => {
    const { data: tenant, error: tenantError } = await scopedDb
      .from('tenants', true)
      .select('max_users')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantError) throw tenantError;
    const tenantMaxUsers = parsePositiveInteger((tenant as any)?.max_users);

    const { data: subscription, error } = await scopedDb
      .from('tenant_subscriptions')
      .select('plan_id, metadata, status, created_at')
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'trial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const requestedUsers = parsePositiveInteger((subscription?.metadata as any)?.requested_user_count);
    let planMaxUsers: number | null = null;
    if (subscription?.plan_id) {
      const { data: plan, error: planError } = await scopedDb
        .from('subscription_plans', true)
        .select('max_users, limits')
        .eq('id', subscription.plan_id)
        .maybeSingle();
      if (planError) throw planError;
      planMaxUsers = parsePositiveInteger((plan as any)?.max_users ?? (plan as any)?.limits?.users);
    }

    const limits = [tenantMaxUsers, requestedUsers, planMaxUsers].filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
    );
    return limits.length ? Math.min(...limits) : null;
  };

  const resolveTenantMaxFranchises = async (tenantId: string) => {
    const { data, error } = await scopedDb
      .from('tenants', true)
      .select('max_franchises')
      .eq('id', tenantId)
      .maybeSingle();
    if (error) throw error;
    return parsePositiveInteger((data as any)?.max_franchises);
  };

  const fetchTenants = async () => {
    // If not platform admin, we don't need to fetch tenants as we use the context one
    if (!context.isPlatformAdmin) return;
    
    // Use isGlobal=true to bypass scoping, as tenants table doesn't have tenant_id
    const { data } = await scopedDb.from('tenants', true).select('id, name').eq('is_active', true);
    setTenants(data || []);
  };

  const fetchManagers = async (tenantId: string) => {
    if (!context.isPlatformAdmin && context.tenantId && tenantId !== context.tenantId) {
      toast({
        title: 'Forbidden',
        description: 'You can only load managers from your tenant scope.',
        variant: 'destructive',
      });
      setManagers([]);
      return;
    }
    // Get users associated with this tenant
    const { data: userRoles } = await scopedDb
      .from('user_roles')
      .select('user_id')
      .eq('tenant_id', tenantId);
      
    if (userRoles && userRoles.length > 0) {
      const userIds = userRoles.map(ur => ur.user_id);
      // Remove duplicates
      const uniqueUserIds = Array.from(new Set(userIds));
      
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', uniqueUserIds);
        
      if (error) {
        console.error('Failed to fetch managers:', error);
        toast({
          title: 'Error Loading Managers',
          description: error.message,
          variant: 'destructive',
        });
      }

      setManagers(profiles || []);
    } else {
      setManagers([]);
    }
  };

  const handleFormSubmit = (values: FranchiseFormValues) => {
    setPendingData(values);
    setShowConfirmDialog(true);
  };

  const handleConfirm = async () => {
    if (!pendingData) return;
    setShowConfirmDialog(false);
    
    await onSubmit(pendingData);
    setPendingData(null);
  };

  const onSubmit = async (values: FranchiseFormValues) => {
    try {
      if (!context.isPlatformAdmin && context.tenantId && values.tenant_id !== context.tenantId) {
        throw new Error('Forbidden');
      }
      const userLimit = parsePositiveInteger(values.user_limit);
      if (userLimit) {
        const maxUsers = await resolveTenantMaxUsers(values.tenant_id);
        if (maxUsers && userLimit > maxUsers) {
          throw new Error(`User limit cannot exceed tenant max users (${maxUsers})`);
        }
      }
      if (!franchise) {
        const maxFranchises = await resolveTenantMaxFranchises(values.tenant_id);
        if (maxFranchises) {
          const { count, error: countError } = await scopedDb
            .from('franchises')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', values.tenant_id);
          if (countError) throw countError;
          const existingCount = count ?? 0;
          if (existingCount >= maxFranchises) {
            throw new Error(`Tenant franchise limit reached (${maxFranchises})`);
          }
        }
      }
      const data = {
        name: values.name,
        code: values.code,
        tenant_id: values.tenant_id,
        manager_id: values.manager_id || null,
        user_limit: userLimit ?? 0,
        is_active: values.is_active,
        address: values.address,
      };

      if (franchise) {
        const { error } = await scopedDb
          .from('franchises')
          .update(data)
          .eq('id', franchise.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Franchise updated successfully',
        });
        onSuccess?.();
      } else {
        const { data: created, error } = await invokeFunction<{ franchise: { id: string } }>('create-franchise', {
          body: data,
        });
        if (error) {
          const message = error?.message || error?.error || 'Unable to create franchise';
          throw new Error(message);
        }
        if (!created?.franchise?.id) {
          throw new Error('Franchise creation failed');
        }

        toast({
          title: 'Success',
          description: 'Franchise created successfully',
        });
        navigate('/dashboard/franchises');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Form {...form}>
        <CrudFormLayout
          title={franchise ? 'Edit Franchise' : 'New Franchise'}
          description="Branch information, contacts, channels, and demographics"
          onCancel={() => navigate('/dashboard/franchises')}
          onSave={() => form.handleSubmit(handleFormSubmit)()}
        >
          <FormStepper
            steps={[
              { id: 'details', label: 'Details' },
              { id: 'profile', label: 'Profile & Contacts' },
              { id: 'communication', label: 'Communication' },
              { id: 'demographics', label: 'Demographics' },
              { id: 'status', label: 'Status' },
            ]}
            activeId="details"
          />

          <div className="space-y-6">
            <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name *</FormLabel>
              <FormControl>
                <Input placeholder="Downtown Branch" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code *</FormLabel>
              <FormControl>
                <Input placeholder="DT-001" {...field} />
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
              <FormItem>
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

        <FormField
          control={form.control}
          name="manager_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Manager</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.first_name} {manager.last_name} ({manager.email})
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
          name="user_limit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>User Limit</FormLabel>
              <FormControl>
                <Input type="number" min="1" placeholder="e.g. 25" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormSection title="Address">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="address.street"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Street</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="New York" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input placeholder="NY" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.zip"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zip Code</FormLabel>
                  <FormControl>
                    <Input placeholder="10001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input placeholder="USA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        <FormSection title="Profile & Contacts">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="address.phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 555-123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="branch@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.website"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        <FormSection title="Communication Channels">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="address.communication.whatsapp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 555-123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.communication.telegram"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telegram</FormLabel>
                  <FormControl>
                    <Input placeholder="@handle" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.communication.preferred"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Contact Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        <FormSection title="Demographics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="address.demographics.founded_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Founded Year</FormLabel>
                  <FormControl>
                    <Input placeholder="1998" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.demographics.employee_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee Count</FormLabel>
                  <FormControl>
                    <Input placeholder="50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.demographics.languages"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Languages</FormLabel>
                  <FormControl>
                    <Input placeholder="English, Spanish" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address.demographics.revenue_range"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Revenue Range</FormLabel>
                  <FormControl>
                    <Input placeholder="$1M–$5M" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        <FormSection title="Status">
          <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Active Status</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Enable or disable this franchise
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        </FormSection>
          </div>
        </CrudFormLayout>
      </Form>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {franchise ? 'Update' : 'Create'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {franchise ? 'update' : 'create'} this franchise?
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
