import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useCRM } from "@/hooks/useCRM";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

const formSchema = z.object({
  cargo_type_name: z.string().min(1, "Cargo type name is required"),
  cargo_code: z.string().optional(),
  hazmat_class: z.string().optional(),
  temperature_controlled: z.boolean().default(false),
  requires_special_handling: z.boolean().default(false),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

interface CargoTypeFormProps {
  onSuccess?: () => void;
}

export function CargoTypeForm({ onSuccess }: CargoTypeFormProps) {
  const { scopedDb, context } = useCRM();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cargo_type_name: "",
      cargo_code: "",
      hazmat_class: "",
      temperature_controlled: false,
      requires_special_handling: false,
      description: "",
      is_active: true,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const payload: Database["public"]["Tables"]["cargo_types"]["Insert"] = {
        cargo_type_name: values.cargo_type_name,
        tenant_id: context.tenantId!,
        cargo_code: values.cargo_code || null,
        hazmat_class: values.hazmat_class || null,
        temperature_controlled: values.temperature_controlled,
        requires_special_handling: values.requires_special_handling,
        description: values.description || null,
        is_active: values.is_active,
      };
      const { error } = await supabase.from("cargo_types").insert(payload);

      if (error) throw error;

      toast.success("Cargo type created successfully");
      form.reset();
      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message || "Failed to create cargo type");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cargo_type_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cargo Type Name</FormLabel>
                <FormControl>
                  <Input placeholder="General Cargo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cargo_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cargo Code</FormLabel>
                <FormControl>
                  <Input placeholder="GEN" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter description..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="requires_special_handling"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <FormLabel>Requires Special Handling</FormLabel>
                </div>
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
                <div>
                  <FormLabel>Temperature Controlled</FormLabel>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <FormLabel>Active</FormLabel>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          Create Cargo Type
        </Button>
      </form>
    </Form>
  );
}
