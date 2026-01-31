import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AsyncComboboxField } from "@/components/forms/AdvancedFields";
import { useCRM } from "@/hooks/useCRM";
import { toast } from "sonner";
import type { Database, Json } from "@/integrations/supabase/types";

const cargoDetailsSchema = z.object({
  service_type: z.string().min(1, "Service type is required"),
  service_id: z.string().min(1, "Service is required"),
  cargo_type_id: z.string().optional(),
  commodity_description: z.string().optional(),
  aes_hts_id: z.string().uuid().optional().or(z.literal('')),
  hs_code: z.string().optional(),
  total_weight_kg: z.coerce.number().optional(),
  total_volume_cbm: z.coerce.number().optional(),
  dimensions: z.any().optional(),
  is_hazardous: z.boolean().default(false),
  hazmat_class: z.string().optional(),
  temperature_controlled: z.boolean().default(false),
  notes: z.string().optional(),
});

export type CargoDetailsFormData = z.infer<typeof cargoDetailsSchema> & { id?: string };

export function CargoDetailsForm({ initialData, onSuccess }: { initialData?: Partial<CargoDetailsFormData>; onSuccess?: () => void }) {
  const { scopedDb } = useCRM();
  type ServiceTypeOption = Pick<Database["public"]["Tables"]["service_types"]["Row"], "name" | "description" | "is_active">;
  type ServiceOption = Pick<Database["public"]["Tables"]["services"]["Row"], "id" | "service_name" | "service_type" | "service_code" | "is_active">;
  type CargoTypeOption = { id: string; cargo_type_name: string; is_active: boolean | null };
  const [serviceTypes, setServiceTypes] = useState<ServiceTypeOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [cargoTypes, setCargoTypes] = useState<CargoTypeOption[]>([]);

  const form = useForm<CargoDetailsFormData>({
    resolver: zodResolver(cargoDetailsSchema),
    defaultValues: {
      service_type: initialData?.service_type || "",
      service_id: initialData?.service_id || "",
      cargo_type_id: initialData?.cargo_type_id || "",
      commodity_description: initialData?.commodity_description || "",
      aes_hts_id: initialData?.aes_hts_id || "",
      hs_code: initialData?.hs_code || "",
      total_weight_kg: initialData?.total_weight_kg ?? undefined,
      total_volume_cbm: initialData?.total_volume_cbm ?? undefined,
      dimensions: (initialData?.dimensions as Json) || {},
      is_hazardous: !!initialData?.is_hazardous,
      hazmat_class: initialData?.hazmat_class || "",
      temperature_controlled: !!initialData?.temperature_controlled,
      notes: initialData?.notes || "",
    },
  });

  const selectedType = form.watch("service_type");

  const htsLoader = async (search: string) => {
    if (!search) return [];
    const { data, error } = await scopedDb
      .from('aes_hts_codes', true)
      .select('id, hts_code, description')
      .or(`hts_code.ilike.%${search}%,description.ilike.%${search}%`)
      .limit(20);
    
    if (error) {
      console.error(error);
      return [];
    }
    
    return data.map((item: any) => ({
      label: `${item.hts_code} - ${item.description}`,
      value: item.id
    }));
  };

  useEffect(() => {
    // Load service types (publicly viewable per migration)
    (async () => {
      const { data } = await scopedDb.from("service_types", true).select("name, description, is_active");
      const values = (data || []).filter((t) => (t as ServiceTypeOption).is_active !== false) as ServiceTypeOption[];
      // Fallback to known values if empty
      setServiceTypes(
        values.length > 0
          ? values
          : [
              { name: "ocean", description: null, is_active: true },
              { name: "air", description: null, is_active: true },
              { name: "trucking", description: null, is_active: true },
              { name: "courier", description: null, is_active: true },
              { name: "moving", description: null, is_active: true },
              { name: "railway_transport", description: null, is_active: true },
            ]
      );
    })();
  }, [scopedDb]);

  useEffect(() => {
    // Load cargo types for tenant
    (async () => {
      const { data, error } = await scopedDb
        .from("cargo_types")
        .select("id, cargo_type_name, is_active");
      if (!error && data) {
        const rows = data.filter((c) => c.is_active !== false).map(c => ({
          id: c.id,
          cargo_type_name: c.cargo_type_name,
          is_active: c.is_active
        }));
        setCargoTypes(rows);
      }
    })();
  }, [scopedDb]);

  useEffect(() => {
    // Load services for tenant filtered by service_type
    (async () => {
      let query = scopedDb
        .from("services")
        .select("id, service_name, service_type, service_code, is_active");
      if (selectedType) {
        query = query.eq("service_type", selectedType);
      }
      const { data, error } = await query;
      if (!error) {
        const rows = (data || []) as ServiceOption[];
        setServices(rows.filter((s) => s.is_active !== false));
      }
    })();
  }, [scopedDb, selectedType]);

  async function handleSubmit(values: CargoDetailsFormData) {
    try {
      if (initialData?.id) {
        const updatePayload: Omit<Database["public"]["Tables"]["cargo_details"]["Update"], "tenant_id"> = {
          service_type: values.service_type,
          service_id: values.service_id,
          cargo_type_id: values.cargo_type_id,
          commodity_description: values.commodity_description,
          aes_hts_id: values.aes_hts_id || null,
          hs_code: values.hs_code,
          dimensions_cm: values.dimensions as Json,
          is_hazardous: values.is_hazardous,
          hazmat_class: values.hazmat_class,
          temperature_controlled: values.temperature_controlled,
          notes: values.notes,
          weight_kg: values.total_weight_kg,
          volume_cbm: values.total_volume_cbm,
        };
        const { error } = await scopedDb.from("cargo_details").update(updatePayload as any).eq("id", initialData.id);
        if (error) throw error;
        toast.success("Cargo details updated");
      } else {
        const insertPayload: Omit<Database["public"]["Tables"]["cargo_details"]["Insert"], "tenant_id"> = {
          service_type: values.service_type,
          service_id: values.service_id,
          cargo_type_id: values.cargo_type_id,
          commodity_description: values.commodity_description,
          aes_hts_id: values.aes_hts_id || null,
          hs_code: values.hs_code,
          dimensions_cm: values.dimensions as Json,
          is_hazardous: values.is_hazardous,
          hazmat_class: values.hazmat_class,
          temperature_controlled: values.temperature_controlled,
          notes: values.notes,
          weight_kg: values.total_weight_kg,
          volume_cbm: values.total_volume_cbm,
        };
        const { error } = await scopedDb.from("cargo_details").insert(insertPayload as any);
        if (error) throw error;
        toast.success("Cargo details created");
        form.reset();
      }
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message || "Failed to save cargo details");
    }
  }

  const serviceOptions = useMemo<ServiceOption[]>(() => services, [services]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="service_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Type *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {serviceTypes.map((t) => (
                      <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="service_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {serviceOptions.map((svc) => (
                      <SelectItem key={svc.id} value={String(svc.id)}>
                        {svc.service_name} {svc.service_code ? `(${svc.service_code})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cargo_type_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cargo Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select cargo type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cargoTypes.map((ct) => (
                      <SelectItem key={ct.id} value={String(ct.id)}>{ct.cargo_type_name}</SelectItem>
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
              <FormLabel>Commodity Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe the cargo..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="total_weight_kg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Weight (kg)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.001" {...field} />
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
                <FormLabel>Total Volume (cbm)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="is_hazardous"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <FormLabel>Hazardous</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="temperature_controlled"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <FormLabel>Temperature Controlled</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {form.watch("is_hazardous") && (
          <FormField
            control={form.control}
            name="hazmat_class"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hazmat Class</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Class 3 - Flammable Liquids" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Internal notes..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          {initialData?.id ? "Update Cargo Details" : "Create Cargo Details"}
        </Button>
      </form>
    </Form>
  );
}
