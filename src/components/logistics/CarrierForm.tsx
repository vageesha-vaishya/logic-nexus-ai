import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
});

export function CarrierForm({ carrierId, onSuccess }: { carrierId?: string; onSuccess?: () => void }) {
  const { context, supabase } = useCRM();
  const { roles } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    },
  });

  const onSubmit = async (values: z.infer<typeof carrierSchema>) => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;

    if (!tenantId) {
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
        address: {
          street: values.street || '',
          city: values.city || '',
          state: values.state || '',
          country: values.country || '',
          postal_code: values.postal_code || '',
        },
        tenant_id: tenantId,
      };

      const { error } = await supabase.from('carriers').insert([carrierData]);

      if (error) throw error;

      toast.success('Carrier created successfully');
      onSuccess?.();
      form.reset();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create carrier');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Carrier'}
        </Button>
      </form>
    </Form>
  );
}
