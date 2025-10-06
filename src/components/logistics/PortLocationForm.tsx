import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const portLocationSchema = z.object({
  location_name: z.string().min(1, 'Location name is required'),
  location_code: z.string().optional(),
  location_type: z.enum(['seaport', 'airport', 'inland_port', 'warehouse', 'terminal']).optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  state_province: z.string().optional(),
  postal_code: z.string().optional(),
  operating_hours: z.string().optional(),
  customs_available: z.boolean().default(false),
  notes: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
});

export function PortLocationForm({ locationId, onSuccess }: { locationId?: string; onSuccess?: () => void }) {
  const { context, supabase } = useCRM();
  const { roles } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof portLocationSchema>>({
    resolver: zodResolver(portLocationSchema),
    defaultValues: {
      location_name: '',
      location_code: '',
      country: '',
      city: '',
      state_province: '',
      postal_code: '',
      operating_hours: '',
      customs_available: false,
      notes: '',
      latitude: '',
      longitude: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof portLocationSchema>) => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;

    if (!tenantId) {
      toast.error('No tenant selected');
      return;
    }

    setIsSubmitting(true);
    try {
      const locationData: any = {
        location_name: values.location_name,
        location_code: values.location_code || null,
        location_type: values.location_type || null,
        country: values.country || null,
        city: values.city || null,
        state_province: values.state_province || null,
        postal_code: values.postal_code || null,
        operating_hours: values.operating_hours || null,
        customs_available: values.customs_available,
        notes: values.notes || null,
        coordinates: {
          latitude: values.latitude || '',
          longitude: values.longitude || '',
        },
        tenant_id: tenantId,
      };

      const { error } = await supabase.from('ports_locations').insert([locationData]);

      if (error) throw error;

      toast.success('Port/Location created successfully');
      onSuccess?.();
      form.reset();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create port/location');
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
            name="location_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., Port of Singapore" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location Code</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., SGSIN, JPTYO" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="location_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="seaport">Seaport</SelectItem>
                  <SelectItem value="airport">Airport</SelectItem>
                  <SelectItem value="inland_port">Inland Port</SelectItem>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="terminal">Terminal</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
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
            name="state_province"
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
        </div>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="latitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Latitude</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., 1.2897" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="longitude"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Longitude</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g., 103.8501" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="operating_hours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Operating Hours</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., Mon-Fri 8AM-6PM" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="customs_available"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Customs Available</FormLabel>
              </div>
            </FormItem>
          )}
        />

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
          {isSubmitting ? 'Creating...' : 'Create Port/Location'}
        </Button>
      </form>
    </Form>
  );
}
