import { useEffect, useState } from 'react';
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
import { PortsService } from '@/services/PortsService';

// Safely convert Supabase JSON/text to an object record
const toRecord = (value: any): Record<string, any> => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return value as Record<string, any>;
  return {};
};
const portLocationSchema = z.object({
  location_name: z.string().min(1, 'Location name is required'),
  location_code: z.string().optional(),
  location_type: z.enum(['seaport', 'airport', 'inland_port', 'warehouse', 'terminal', 'railway_terminal']).optional(),
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
  const { scopedDb } = useCRM();
  const { roles } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const portsService = new PortsService(scopedDb);

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

  useEffect(() => {
    const loadLocation = async () => {
      if (!locationId) return;
      setIsLoading(true);
      try {
        const data = await portsService.getPortById(locationId);
        if (data) {
          const typeOptions = ['seaport', 'airport', 'inland_port', 'warehouse', 'terminal', 'railway_terminal'] as const;
          const typeValue = typeOptions.includes(data.location_type as any)
            ? (data.location_type as (typeof typeOptions)[number])
            : undefined;
          const coords = toRecord(data.coordinates);
          form.reset({
            location_name: data.location_name || '',
            location_code: data.location_code || '',
            location_type: typeValue,
            country: data.country || '',
            city: data.city || '',
            state_province: data.state_province || '',
            postal_code: data.postal_code || '',
            operating_hours: data.operating_hours || '',
            customs_available: !!data.customs_available,
            notes: data.notes || '',
            latitude: typeof coords.latitude === 'number' || typeof coords.latitude === 'string' ? String(coords.latitude) : '',
            longitude: typeof coords.longitude === 'number' || typeof coords.longitude === 'string' ? String(coords.longitude) : '',
          });
        }
      } catch (e: any) {
        toast.error(e.message || 'Failed to load port/location');
      } finally {
        setIsLoading(false);
      }
    };
    loadLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, scopedDb]);

  const onSubmit = async (values: z.infer<typeof portLocationSchema>) => {
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
      };

      if (locationId) {
        await portsService.updatePort(locationId, locationData);
        toast.success('Port/Location updated successfully');
      } else {
        await portsService.createPort(locationData);
        toast.success('Port/Location created successfully');
        form.reset();
      }
      onSuccess?.();
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

        <Button type="submit" disabled={isSubmitting || isLoading}>
          {isSubmitting ? (locationId ? 'Updating...' : 'Creating...') : (locationId ? 'Update Port/Location' : 'Create Port/Location')}
        </Button>
      </form>
    </Form>
  );
}
