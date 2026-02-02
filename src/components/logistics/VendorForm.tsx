import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

const vendorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  type: z.enum([
    'carrier', 'agent', 'broker', 'warehouse', 'technology', 
    'manufacturing', 'retail', '3pl', 'freight_forwarder', 'courier',
    'ocean_carrier', 'air_carrier', 'trucker', 'rail_carrier', 
    'customs_broker', 'wholesaler', 'consulting', 'other'
  ]),
  status: z.enum(['active', 'inactive', 'pending']),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  address_street: z.string().optional(),
  address_city: z.string().optional(),
  address_state: z.string().optional(),
  address_zip: z.string().optional(),
  address_country: z.string().optional(),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

interface VendorFormProps {
  initialData?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function VendorForm({ initialData, onSuccess, onCancel }: VendorFormProps) {
  const { supabase } = useCRM();
  const [loading, setLoading] = useState(false);

  // Helper to safely get address fields
  const getAddressField = (field: string) => {
    if (!initialData?.contact_info?.address) return '';
    if (typeof initialData.contact_info.address === 'string') return ''; // Or parse string if possible?
    return initialData.contact_info.address[field] || '';
  };

  const defaultValues: Partial<VendorFormValues> = {
    name: initialData?.name || '',
    code: initialData?.code || '',
    type: initialData?.type || 'carrier',
    status: initialData?.status || 'active',
    email: initialData?.contact_info?.email || '',
    phone: initialData?.contact_info?.phone || '',
    website: initialData?.contact_info?.website || '',
    address_street: getAddressField('street'),
    address_city: getAddressField('city'),
    address_state: getAddressField('state'),
    address_zip: getAddressField('zip'),
    address_country: getAddressField('country'),
  };

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues,
  });

  const onSubmit = async (data: VendorFormValues) => {
    setLoading(true);
    try {
      // Construct address object if any address fields are provided
      const hasAddress = data.address_street || data.address_city || data.address_state || data.address_zip || data.address_country;
      const address = hasAddress ? {
        street: data.address_street,
        city: data.address_city,
        state: data.address_state,
        zip: data.address_zip,
        country: data.address_country,
      } : undefined;

      const contact_info = {
        email: data.email,
        phone: data.phone,
        website: data.website,
        address,
      };

      const payload = {
        name: data.name,
        code: data.code,
        type: data.type,
        status: data.status,
        contact_info,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from('vendors')
          .update(payload)
          .eq('id', initialData.id);
        if (error) throw error;
        toast.success('Vendor updated successfully');
      } else {
        const { error } = await supabase
          .from('vendors')
          .insert(payload);
        if (error) throw error;
        toast.success('Vendor created successfully');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Error saving vendor:', error);
      toast.error(error.message || 'Failed to save vendor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Maersk Line" {...field} />
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
                <FormLabel>Vendor Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. MAEU" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="carrier">Carrier (General)</SelectItem>
                    <SelectItem value="ocean_carrier">Ocean Carrier</SelectItem>
                    <SelectItem value="air_carrier">Air Carrier</SelectItem>
                    <SelectItem value="trucker">Trucking Company</SelectItem>
                    <SelectItem value="rail_carrier">Rail Carrier</SelectItem>
                    <SelectItem value="freight_forwarder">Freight Forwarder</SelectItem>
                    <SelectItem value="courier">Courier / Express</SelectItem>
                    <SelectItem value="3pl">3PL Provider</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="customs_broker">Customs Broker</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="broker">Broker</SelectItem>
                    <SelectItem value="technology">Technology Provider</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="wholesaler">Wholesaler</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4 rounded-md border p-4">
          <h4 className="text-sm font-medium">Contact Information</h4>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="contact@vendor.com" {...field} />
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
                    <Input placeholder="+1 234 567 890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder="https://vendor.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4 pt-2 border-t mt-4">
            <h5 className="text-sm font-medium text-muted-foreground">Address</h5>
            <FormField
              control={form.control}
              name="address_street"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Street Address</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Logistics Way" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="address_city"
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
                name="address_state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State / Province</FormLabel>
                    <FormControl>
                      <Input placeholder="NY" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="address_zip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP / Postal Code</FormLabel>
                    <FormControl>
                      <Input placeholder="10001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address_country"
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
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : initialData ? 'Update Vendor' : 'Create Vendor'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
