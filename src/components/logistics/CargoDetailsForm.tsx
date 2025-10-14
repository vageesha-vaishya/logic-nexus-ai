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
import { useCRM } from "@/hooks/useCRM";
import { toast } from "sonner";

const cargoDetailsSchema = z.object({
  service_type: z.string().min(1, "Service type is required"),
  service_id: z.string().min(1, "Service is required"),
  cargo_type_id: z.string().optional(),
  commodity_description: z.string().optional(),
  hs_code: z.string().optional(),
  package_count: z.coerce.number().int().nonnegative().default(0),
  total_weight_kg: z.coerce.number().optional(),
  total_volume_cbm: z.coerce.number().optional(),
  dimensions: z.any().optional(),
  hazmat: z.boolean().default(false),
  hazmat_class: z.string().optional(),
  temperature_controlled: z.boolean().default(false),
  requires_special_handling: z.boolean().default(false),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

export type CargoDetailsFormData = z.infer<typeof cargoDetailsSchema> & { id?: string };

export function CargoDetailsForm({ initialData, onSuccess }: { initialData?: Partial<CargoDetailsFormData>; onSuccess?: () => void }) {
  const { supabase, context } = useCRM();
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [cargoTypes, setCargoTypes] = useState<any[]>([]);

  const form = useForm<CargoDetailsFormData>({
    resolver: zodResolver(cargoDetailsSchema),
    defaultValues: {
      service_type: initialData?.service_type || "",
      service_id: initialData?.service_id || "",
      cargo_type_id: initialData?.cargo_type_id || "",
      commodity_description: initialData?.commodity_description || "",
      hs_code: initialData?.hs_code || "",
      package_count: (initialData?.package_count as any) ?? 0,
      total_weight_kg: (initialData?.total_weight_kg as any) ?? undefined,
      total_volume_cbm: (initialData?.total_volume_cbm as any) ?? undefined,
      dimensions: initialData?.dimensions || {},
      hazmat: !!initialData?.hazmat,
      hazmat_class: initialData?.hazmat_class || "",
      temperature_controlled: !!initialData?.temperature_controlled,
      requires_special_handling: !!initialData?.requires_special_handling,
      notes: initialData?.notes || "",
      is_active: initialData?.is_active ?? true,
    },
  });

  const selectedType = form.watch("service_type");

  useEffect(() => {
    // Load service types (publicly viewable per migration)
    (async () => {
      const { data } = await supabase.from("service_types").select("name, description, is_active");
      const values = (data || []).filter((t: any) => t.is_active !== false);
      // Fallback to known values if empty
      setServiceTypes(values.length > 0 ? values : [
        { name: "ocean" }, { name: "air" }, { name: "trucking" }, { name: "courier" }, { name: "moving" }, { name: "railway_transport" },
      ]);
    })();
  }, [supabase]);

  useEffect(() => {
    // Load cargo types for tenant
    (async () => {
      if (!context.tenantId) return;
      const { data, error } = await supabase
        .from("cargo_types")
        .select("id, cargo_type_name, is_active")
        .eq("tenant_id", context.tenantId);
      if (!error) setCargoTypes((data || []).filter((c: any) => c.is_active));
    })();
  }, [supabase, context.tenantId]);

  useEffect(() => {
    // Load services for tenant filtered by service_type
    (async () => {
      if (!context.tenantId) return;
      let query = supabase
        .from("services")
        .select("id, service_name, service_type, service_code, is_active")
        .eq("tenant_id", context.tenantId);
      if (selectedType) {
        query = query.eq("service_type", selectedType);
      }
      const { data, error } = await query;
      if (!error) setServices((data || []).filter((s: any) => s.is_active));
    })();
  }, [supabase, context.tenantId, selectedType]);

  async function handleSubmit(values: CargoDetailsFormData) {
    try {
      const payload: any = {
        ...values,
        tenant_id: context.tenantId!,
      };
      if (initialData?.id) {
        const { error } = await supabase.from("cargo_details").update(payload as any).eq("id", initialData.id);
        if (error) throw error;
        toast.success("Cargo details updated");
      } else {
        const { error } = await supabase.from("cargo_details").insert(payload as any);
        if (error) throw error;
        toast.success("Cargo details created");
        form.reset();
      }
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to save cargo details");
    }
  }

  const serviceOptions = useMemo(() => services, [services]);

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
                    {serviceTypes.map((t: any) => (
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
                    {serviceOptions.map((svc: any) => (
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
                    {cargoTypes.map((ct: any) => (
                      <SelectItem key={ct.id} value={String(ct.id)}>{ct.cargo_type_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hs_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>HS Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 9403.20" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="package_count"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Package Count</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} />
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="hazmat"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <FormLabel>Hazmat</FormLabel>
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
          <FormField
            control={form.control}
            name="requires_special_handling"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <FormLabel>Special Handling</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {form.watch("hazmat") && (
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

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <FormLabel>Active</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
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