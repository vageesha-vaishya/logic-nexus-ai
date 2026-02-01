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
  type: z.enum(['carrier', 'agent', 'broker', 'warehouse', 'technology', 'other']),
  status: z.enum(['active', 'inactive', 'pending']),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
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

  const defaultValues: Partial<VendorFormValues> = {
    name: initialData?.name || '',
    code: initialData?.code || '',
    type: initialData?.type || 'carrier',
    status: initialData?.status || 'active',
    email: initialData?.contact_info?.email || '',
    phone: initialData?.contact_info?.phone || '',
    website: initialData?.contact_info?.website || '',
  };

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues,
  });

  const onSubmit = async (data: VendorFormValues) => {
    setLoading(true);
    try {
      const contact_info = {
        email: data.email,
        phone: data.phone,
        website: data.website,
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
                    <SelectItem value="carrier">Carrier</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="broker">Broker</SelectItem>
                    <SelectItem value="warehouse">Warehouse</SelectItem>
                    <SelectItem value="technology">Technology</SelectItem>
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
