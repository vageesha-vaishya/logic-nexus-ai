import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { SmartCargoInput, CommoditySelection } from '@/components/logistics/SmartCargoInput';
import { AsyncComboboxField } from '@/components/forms/AdvancedFields';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

// Schema Definition
const cargoFormSchema = z.object({
  cargo_type_id: z.string().uuid({ message: "Cargo type is required" }),
  aes_hts_id: z.string().uuid({ message: "HTS code is required" }).optional().or(z.literal('')),
  commodity_description: z.string().min(3, "Description is required"),
  package_count: z.coerce.number().min(1, "At least 1 package required"),
  total_weight_kg: z.coerce.number().min(0),
  total_volume_cbm: z.coerce.number().min(0),
  hazmat: z.boolean().default(false),
  hazmat_class: z.string().optional(),
  temperature_controlled: z.boolean().default(false),
});

type CargoFormValues = z.infer<typeof cargoFormSchema>;

interface CargoFormProps {
  defaultValues?: Partial<CargoFormValues>;
  onSuccess: () => void;
  onCancel: () => void;
  cargoId?: string; // If editing
  serviceId?: string;
  serviceType?: string;
}

export function CargoForm({ defaultValues, onSuccess, onCancel, cargoId, serviceId, serviceType }: CargoFormProps) {
  const { session } = useAuth();
  
  const form = useForm<CargoFormValues>({
    resolver: zodResolver(cargoFormSchema),
    defaultValues: {
      cargo_type_id: '',
      aes_hts_id: '',
      commodity_description: '',
      package_count: 1,
      total_weight_kg: 0,
      total_volume_cbm: 0,
      hazmat: false,
      hazmat_class: '',
      temperature_controlled: false,
      ...defaultValues,
    },
  });

  // Fetch Cargo Types for Select
  const { data: cargoTypes } = useQuery({
    queryKey: ['cargo_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargo_types')
        .select('id, cargo_type_name')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const handleSmartSelect = (selection: CommoditySelection) => {
    if (selection.description) {
      form.setValue('commodity_description', selection.description);
    }
    if (selection.aes_hts_id) {
      form.setValue('aes_hts_id', selection.aes_hts_id);
    }
    if (selection.cargo_type_id) {
      form.setValue('cargo_type_id', selection.cargo_type_id);
    }
    if (selection.hazmat_class) {
      form.setValue('hazmat', true);
      form.setValue('hazmat_class', selection.hazmat_class);
    }
    if (selection.unit_value) {
      // Assuming value logic exists or will be added
    }
    toast.success("Commodity details populated");
  };

  // HTS Loader for AsyncCombobox
  const htsLoader = React.useCallback(async (search: string) => {
    if (!search) return [];
    const { data, error } = await supabase
      .from('aes_hts_codes')
      .select('id, hts_code, description')
      .or(`hts_code.ilike.%${search}%,description.ilike.%${search}%`)
      .limit(20);
    
    if (error) {
      console.error(error);
      return [];
    }
    
    return data.map(item => ({
      label: `${item.hts_code} - ${item.description}`,
      value: item.id
    }));
  }, []);

  // Submit Handler
  const onSubmit = async (values: CargoFormValues) => {
    if (!session?.user?.id) return;

    try {
      // Basic payload
      const payload: any = {
        ...values,
        // If aes_hts_id is empty string, make it null
        aes_hts_id: values.aes_hts_id || null,
      };

      if (cargoId) {
        // Update
        const { error } = await supabase
          .from('cargo_details')
          .update(payload)
          .eq('id', cargoId);
        if (error) throw error;
        toast.success("Cargo updated successfully");
      } else {
        // Create - we need tenant_id. 
        // Assuming we are in a context where we can get tenant_id or RLS handles it if we insert.
        // Usually we need to explicit set tenant_id. 
        // For this demo, let's try to get it from a helper or assume RLS/Trigger handles it if omitted, 
        // OR fetch user's tenant.
        
        // Fetch user's tenant if not in context (simplified)
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('tenant_id')
          .eq('user_id', session.user.id)
          .limit(1)
          .single();
          
        if (userRole?.tenant_id) {
          payload.tenant_id = userRole.tenant_id;
        } else {
          // Fallback or error if tenant is mandatory and not nullable
          // In this system, tenant_id is NOT NULL usually.
          console.warn("No tenant_id found for user");
        }

        // We also need service_id and service_type as they are NOT NULL in schema
        if (serviceId && serviceType) {
          payload.service_id = serviceId;
          payload.service_type = serviceType;
        } else {
          // Fallback: pick a default service if not provided via props
          // Let's assume 'freight_forwarding' as a default service for now.
          const { data: service } = await supabase
              .from('services')
              .select('id')
              .eq('slug', 'freight_forwarding') 
              .limit(1)
              .single();
              
          if (service) {
              payload.service_id = service.id;
              payload.service_type = 'freight_forwarding';
          } else {
              // Fallback: pick the first available service to satisfy constraint
               const { data: anyService } = await supabase
                  .from('services')
                  .select('id, slug')
                  .limit(1)
                  .single();
               if (anyService) {
                   payload.service_id = anyService.id;
                   payload.service_type = anyService.slug || 'ocean'; // Fallback
               }
          }
        }

        const { error } = await supabase
          .from('cargo_details')
          .insert(payload);
        if (error) throw error;
        toast.success("Cargo created successfully");
      }
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to save cargo");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        <div className="bg-slate-50 p-4 rounded-md border border-slate-200 mb-4">
          <FormLabel className="mb-2 block">Quick Add from Catalog / HTS Search</FormLabel>
          <SmartCargoInput 
            onSelect={handleSmartSelect} 
            placeholder="Search by SKU, Name, or HTS Code..."
          />
          <p className="text-xs text-muted-foreground mt-2">
            Select a commodity to auto-populate description, HTS code, and classification.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="cargo_type_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cargo Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {cargoTypes?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.cargo_type_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <AsyncComboboxField
          control={form.control}
          name="aes_hts_id"
          label="HTS / Schedule B Code"
          placeholder="Search by code or description..."
          loader={htsLoader}
          className="flex flex-col"
        />
        </div>

        <FormField
          control={form.control}
          name="commodity_description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="package_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Packages</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="total_weight_kg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight (kg)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
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
                <FormLabel>Volume (cbm)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="hazmat"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Hazardous Material</FormLabel>
                <FormDescription>
                  Requires UN number and proper classification.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        
        {form.watch('hazmat') && (
            <FormField
            control={form.control}
            name="hazmat_class"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hazmat Class</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. 3.1 Flammable Liquid" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>
          <Button type="submit">Save Cargo Details</Button>
        </div>
      </form>
    </Form>
  );
}
