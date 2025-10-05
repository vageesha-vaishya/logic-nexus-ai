import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

const warehouseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  code: z.string().min(1, 'Code is required').max(50),
  warehouse_type: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  contact_person: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  capacity_sqft: z.string().optional(),
  is_active: z.boolean().default(true),
});

type WarehouseFormData = z.infer<typeof warehouseSchema>;

interface WarehouseFormProps {
  initialData?: Partial<WarehouseFormData> & { id?: string };
  onSubmit: (data: WarehouseFormData) => Promise<void>;
  onCancel: () => void;
}

export function WarehouseForm({ initialData, onSubmit, onCancel }: WarehouseFormProps) {
  const form = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: initialData?.name || '',
      code: initialData?.code || '',
      warehouse_type: initialData?.warehouse_type || '',
      address: initialData?.address || '',
      contact_person: initialData?.contact_person || '',
      contact_phone: initialData?.contact_phone || '',
      contact_email: initialData?.contact_email || '',
      capacity_sqft: initialData?.capacity_sqft || '',
      is_active: initialData?.is_active !== undefined ? initialData.is_active : true,
    },
  });

  const { isSubmitting } = form.formState;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warehouse Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Main Distribution Center" {...field} />
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
                <FormLabel>Warehouse Code *</FormLabel>
                <FormControl>
                  <Input placeholder="WH-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="warehouse_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <Input placeholder="Distribution, Storage, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity_sqft"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity (sq ft)</FormLabel>
                <FormControl>
                  <Input placeholder="50000" type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Address *</FormLabel>
                <FormControl>
                  <Textarea placeholder="Full warehouse address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact_person"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact_email"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Contact Email</FormLabel>
                <FormControl>
                  <Input placeholder="warehouse@example.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData?.id ? 'Update Warehouse' : 'Create Warehouse'}
          </Button>
        </div>
      </form>
    </Form>
  );
}