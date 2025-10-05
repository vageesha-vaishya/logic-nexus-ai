import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

const vehicleSchema = z.object({
  vehicle_number: z.string().min(1, 'Vehicle number is required'),
  vehicle_type: z.string().min(1, 'Vehicle type is required'),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.string().optional(),
  capacity_kg: z.string().optional(),
  capacity_cbm: z.string().optional(),
  status: z.enum(['available', 'in_use', 'maintenance', 'out_of_service']),
  is_active: z.boolean().default(true),
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface VehicleFormProps {
  initialData?: Partial<VehicleFormData> & { id?: string };
  onSubmit: (data: VehicleFormData) => Promise<void>;
  onCancel: () => void;
}

export function VehicleForm({ initialData, onSubmit, onCancel }: VehicleFormProps) {
  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicle_number: initialData?.vehicle_number || '',
      vehicle_type: initialData?.vehicle_type || '',
      make: initialData?.make || '',
      model: initialData?.model || '',
      year: initialData?.year || '',
      capacity_kg: initialData?.capacity_kg || '',
      capacity_cbm: initialData?.capacity_cbm || '',
      status: initialData?.status || 'available',
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
            name="vehicle_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Number *</FormLabel>
                <FormControl>
                  <Input placeholder="TRK-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vehicle_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Type *</FormLabel>
                <FormControl>
                  <Input placeholder="Truck, Van, Container, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="make"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Make</FormLabel>
                <FormControl>
                  <Input placeholder="Volvo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <FormControl>
                  <Input placeholder="FH16" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year</FormLabel>
                <FormControl>
                  <Input placeholder="2024" type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="in_use">In Use</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="out_of_service">Out of Service</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity_kg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity (kg)</FormLabel>
                <FormControl>
                  <Input placeholder="20000" type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity_cbm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity (m³)</FormLabel>
                <FormControl>
                  <Input placeholder="80" type="number" {...field} />
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
            {initialData?.id ? 'Update Vehicle' : 'Create Vehicle'}
          </Button>
        </div>
      </form>
    </Form>
  );
}