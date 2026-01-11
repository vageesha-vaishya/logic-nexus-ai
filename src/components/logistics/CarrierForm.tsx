import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ScopedDataAccess, type DataAccessContext } from '@/lib/db/access';

const carrierSchema = z.object({
  carrier_name: z.string().min(1, 'Carrier name is required'),
  carrier_code: z.string().optional(),
  carrier_type: z.enum(['ocean', 'air', 'trucking', 'courier', 'rail']).optional(),
  contact_person: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  rating: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
  tenant_id: z.string().optional(),
});

export function CarrierForm({ carrierId, onSuccess }: { carrierId?: string; onSuccess?: () => void }) {
  const { context, supabase } = useCRM();
  const { roles } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);

  const form = useForm<z.infer<typeof carrierSchema>>({
    resolver: zodResolver(carrierSchema),
    defaultValues: {
      carrier_name: '',
      carrier_code: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      website: '',
      notes: '',
      is_active: true,
      tenant_id: context.tenantId || roles?.[0]?.tenant_id || '',
    },
  });

  // Load existing carrier in edit mode
  useEffect(() => {
    const fetchTenants = async () => {
      if (!context.isPlatformAdmin) return;
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        if (error) throw error;
        setTenants(data || []);
      } catch (err: any) {
        console.warn('Failed to fetch tenants:', err?.message || err);
      }
    };
    fetchTenants();

    const loadCarrier = async () => {
      if (!carrierId) return;
      try {
        const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
        const { data, error } = await dao
          .from('carriers')
          .select('*')
          .eq('id', carrierId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          form.reset({
            carrier_name: data.carrier_name || '',
            carrier_code: data.carrier_code || '',
            carrier_type: (data.carrier_type as any) || undefined,
            contact_person: data.contact_person || '',
            contact_email: data.contact_email || '',
            contact_phone: data.contact_phone || '',
            website: data.website || '',
            rating: data.rating != null ? String(data.rating) : '',
            notes: data.notes || '',
            is_active: !!data.is_active,
            street: (data.address as any)?.street || '',
            city: (data.address as any)?.city || '',
            state: (data.address as any)?.state || '',
            country: (data.address as any)?.country || '',
            postal_code: (data.address as any)?.postal_code || '',
            tenant_id: data.tenant_id || '',
          });
        }
      } catch (e: any) {
        toast.error(e.message || 'Failed to load carrier');
      }
    };
    loadCarrier();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrierId]);

  const onSubmit = async (values: z.infer<typeof carrierSchema>) => {
    const contextTenantId = context.tenantId || roles?.[0]?.tenant_id;
    const selectedTenantId = values.tenant_id?.trim() || '';

    // Only require tenant when creating a new carrier
    if (!carrierId && !context.isPlatformAdmin && !contextTenantId) {
      toast.error('No tenant selected');
      return;
    }

    setIsSubmitting(true);
    try {
      const carrierData: any = {
        carrier_name: values.carrier_name,
        carrier_code: values.carrier_code || null,
        carrier_type: values.carrier_type || null,
        contact_person: values.contact_person || null,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
        website: values.website || null,
        rating: values.rating ? parseFloat(values.rating) : null,
        notes: values.notes || null,
        is_active: values.is_active ?? true,
        address: {
          street: values.street || '',
          city: values.city || '',
          state: values.state || '',
          country: values.country || '',
          postal_code: values.postal_code || '',
        },
      };

      const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);

      if (carrierId) {
        // Allow platform admins to change tenant association
        if (context.isPlatformAdmin && selectedTenantId) {
          carrierData.tenant_id = selectedTenantId;
        }
        const { error } = await dao
          .from('carriers')
          .update(carrierData)
          .eq('id', carrierId);
        if (error) throw error;
        toast.success('Carrier updated successfully');
        onSuccess?.();
      } else {
        const effectiveTenantId = context.isPlatformAdmin
          ? (selectedTenantId || contextTenantId)
          : contextTenantId;
        if (!effectiveTenantId) {
          toast.error('Please select a tenant');
          setIsSubmitting(false);
          return;
        }
        const { error } = await dao.from('carriers').insert([{ ...carrierData, tenant_id: effectiveTenantId }]);
        if (error) throw error;
        toast.success('Carrier created successfully');
        onSuccess?.();
        form.reset();
      }
    } catch (error: any) {
      toast.error(error.message || (carrierId ? 'Failed to update carrier' : 'Failed to create carrier'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!carrierId) return;
    if (!confirm('Delete this carrier? This action cannot be undone.')) return;
    setIsSubmitting(true);
    try {
      const dao = new ScopedDataAccess(supabase, context as unknown as DataAccessContext);
      const { error } = await dao
        .from('carriers')
        .delete()
        .eq('id', carrierId);
      if (error) throw error;
      toast.success('Carrier deleted');
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete carrier');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {context.isPlatformAdmin && (
          <FormField
            control={form.control}
            name="tenant_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tenant</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="carrier_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carrier Name *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="carrier_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carrier Code</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., MAEU, COSCO" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="carrier_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carrier Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ocean">Ocean Freight</SelectItem>
                    <SelectItem value="air">Air Freight</SelectItem>
                    <SelectItem value="trucking">Trucking</SelectItem>
                    <SelectItem value="courier">Courier</SelectItem>
                    <SelectItem value="rail">Rail</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rating (0-5)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" min="0" max="5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contact_person"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Phone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <h3 className="font-medium">Address</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Street</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State/Province</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postal_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormLabel>Active</FormLabel>
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            {carrierId && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                Delete
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (carrierId ? 'Saving...' : 'Creating...') : (carrierId ? 'Save Changes' : 'Create Carrier')}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
