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
  size_name: z.string().min(1, "Size name is required"),
  size_code: z.string().optional(),
  length_ft: z.coerce.number().optional(),
  width_ft: z.coerce.number().optional(),
  height_ft: z.coerce.number().optional(),
  max_weight_kg: z.coerce.number().optional(),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

interface PackageSizeFormProps {
  onSuccess?: () => void;
}

export function PackageSizeForm({ onSuccess }: PackageSizeFormProps) {
  const { supabase, context } = useCRM();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      size_name: "",
      size_code: "",
      is_active: true,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const payload: Database["public"]["Tables"]["package_sizes"]["Insert"] = {
        size_name: values.size_name,
        tenant_id: context.tenantId!,
        size_code: values.size_code,
        length_ft: values.length_ft,
        width_ft: values.width_ft,
        height_ft: values.height_ft,
        max_weight_kg: values.max_weight_kg,
        description: values.description,
        is_active: values.is_active,
      };
      const { error } = await supabase.from("package_sizes").insert(payload);

      if (error) throw error;

      toast.success("Package size created successfully");
      form.reset();
      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(message || "Failed to create package size");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="size_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Size Name</FormLabel>
                <FormControl>
                  <Input placeholder="20 Feet" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="size_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Size Code</FormLabel>
                <FormControl>
                  <Input placeholder="20'" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="length_ft"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Length (ft)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="20" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="width_ft"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Width (ft)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="8" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="height_ft"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Height (ft)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="8.5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="max_weight_kg"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Max Weight (kg)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="28000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
          Create Package Size
        </Button>
      </form>
    </Form>
  );
}
