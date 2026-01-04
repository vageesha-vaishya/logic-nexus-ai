import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { DateField, CurrencyField, ComboboxField, FileUploadField } from '@/components/forms/AdvancedFields';

import { normalizeShipmentType } from '@/pages/dashboard/shipments-data';

const shipmentSchema = z.object({
  shipment_number: z.string().min(1, 'Shipment number is required'),
  shipment_type: z.enum(['ocean', 'air', 'inland_trucking', 'rail', 'courier', 'movers_packers']),
  status: z.enum(['draft', 'confirmed', 'in_transit', 'customs', 'out_for_delivery', 'delivered', 'cancelled', 'on_hold', 'returned']),
  origin_address: z.string().min(1, 'Origin address is required'),
  destination_address: z.string().min(1, 'Destination address is required'),
  pickup_date: z.date().optional(),
  estimated_delivery_date: z.date().optional(),
  total_weight_kg: z.string().optional(),
  total_volume_cbm: z.string().optional(),
  total_packages: z.string().optional(),
  container_type: z.enum(['20ft_standard', '40ft_standard', '40ft_high_cube', '45ft_high_cube', 'reefer', 'open_top', 'flat_rack', 'tank']).optional(),
  container_number: z.string().optional(),
  declared_value: z.coerce.number().optional(),
  service_level: z.string().optional(),
  priority_level: z.enum(['low', 'normal', 'high', 'urgent']),
  special_instructions: z.string().optional(),
  customs_required: z.boolean().default(false),
  insurance_required: z.boolean().default(false),
  reference_number: z.string().optional(),
  account_id: z.string().optional(),
  tenant_id: z.string().optional(),
  franchise_id: z.string().optional(),
  attachments: z.array(z.any()).default([]),
});

type ShipmentFormData = z.infer<typeof shipmentSchema>;

interface ShipmentFormProps {
  initialData?: Partial<ShipmentFormData> & { id?: string };
  onSubmit: (data: ShipmentFormData) => Promise<void>;
  onCancel: () => void;
}

export function ShipmentForm({ initialData, onSubmit, onCancel }: ShipmentFormProps) {
  const { supabase, context } = useCRM();
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  
  const form = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      shipment_number: initialData?.shipment_number || '',
      shipment_type: initialData?.shipment_type ? normalizeShipmentType(initialData.shipment_type) : 'courier',
      status: initialData?.status || 'draft',
      origin_address: initialData?.origin_address || '',
      destination_address: initialData?.destination_address || '',
      pickup_date:
        typeof initialData?.pickup_date === 'string'
          ? new Date(initialData.pickup_date)
          : (initialData?.pickup_date as Date | undefined),
      estimated_delivery_date:
        typeof initialData?.estimated_delivery_date === 'string'
          ? new Date(initialData.estimated_delivery_date)
          : (initialData?.estimated_delivery_date as Date | undefined),
      total_weight_kg: initialData?.total_weight_kg || '',
      total_volume_cbm: initialData?.total_volume_cbm || '',
      total_packages: initialData?.total_packages || '',
      container_number: initialData?.container_number || '',
      declared_value:
        typeof initialData?.declared_value === 'number'
          ? initialData.declared_value
          : (typeof initialData?.declared_value === 'string'
              ? Number(initialData.declared_value)
              : undefined),
      service_level: initialData?.service_level || '',
      priority_level: initialData?.priority_level || 'normal',
      special_instructions: initialData?.special_instructions || '',
      customs_required: initialData?.customs_required || false,
      insurance_required: initialData?.insurance_required || false,
      reference_number: initialData?.reference_number || '',
      account_id: initialData?.account_id || '',
      tenant_id: initialData?.tenant_id || '',
      franchise_id: initialData?.franchise_id || '',
      attachments: [],
    },
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('accounts').select('id, name').order('name');
      if (data) setAccounts(data as { id: string; name: string }[]);
    })();
  }, [supabase]);

  const { isSubmitting } = form.formState;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="shipment_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shipment Number *</FormLabel>
                <FormControl>
                  <Input placeholder="SH-2025-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="shipment_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shipment Type *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ocean">Ocean Freight</SelectItem>
                    <SelectItem value="air">Air Freight</SelectItem>
                    <SelectItem value="inland_trucking">Inland Trucking</SelectItem>
                    <SelectItem value="rail">Railway Transport</SelectItem>
                    <SelectItem value="courier">Courier</SelectItem>
                    <SelectItem value="movers_packers">Movers & Packers</SelectItem>
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
                <FormLabel>Status *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="customs">Customs</SelectItem>
                    <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priority_level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <ComboboxField
            control={form.control}
            name="account_id"
            label="Customer Account"
            className="col-span-2"
            placeholder="Select account"
            options={accounts.map((a) => ({ label: a.name, value: a.id }))}
          />

          <FormField
            control={form.control}
            name="origin_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origin Address *</FormLabel>
                <FormControl>
                  <Textarea placeholder="Full pickup address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="destination_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Destination Address *</FormLabel>
                <FormControl>
                  <Textarea placeholder="Full delivery address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DateField
            control={form.control}
            name="pickup_date"
            label="Pickup Date"
          />

          <DateField
            control={form.control}
            name="estimated_delivery_date"
            label="Estimated Delivery"
          />

          <FormField
            control={form.control}
            name="total_weight_kg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Weight (kg)</FormLabel>
                <FormControl>
                  <Input placeholder="1000" type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="total_volume_cbm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Volume (m³)</FormLabel>
                <FormControl>
                  <Input placeholder="50" type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="total_packages"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Packages</FormLabel>
                <FormControl>
                  <Input placeholder="10" type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <CurrencyField
            control={form.control}
            name="declared_value"
            label="Declared Value"
            placeholder="0.00"
            className="col-span-2"
          />

          <FormField
            control={form.control}
            name="reference_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reference Number</FormLabel>
                <FormControl>
                  <Input placeholder="REF-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="special_instructions"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Special Instructions</FormLabel>
                <FormControl>
                  <Textarea placeholder="Any special handling requirements..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FileUploadField
            control={form.control}
            name="attachments"
            label="Attachments"
            description="Upload related documents (invoices, BOLs, etc.)"
            className="col-span-2"
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData?.id ? 'Update Shipment' : 'Create Shipment'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
