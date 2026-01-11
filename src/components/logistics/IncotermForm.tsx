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

const formSchema = z.object({
  incoterm_code: z.string().min(1, "Incoterm code is required"),
  incoterm_name: z.string().min(1, "Incoterm name is required"),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

interface IncotermFormProps {
  onSuccess?: () => void;
}

export function IncotermForm({ onSuccess }: IncotermFormProps) {
  const { scopedDb } = useCRM();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      incoterm_code: "",
      incoterm_name: "",
      description: "",
      is_active: true,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const { error } = await scopedDb.from("incoterms").insert({
        ...values,
      } as any);

      if (error) throw error;

      toast.success("Incoterm created successfully");
      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to create incoterm");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="incoterm_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Incoterm Code</FormLabel>
                <FormControl>
                  <Input placeholder="FOB" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="incoterm_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Incoterm Name</FormLabel>
                <FormControl>
                  <Input placeholder="Free on Board" {...field} />
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
                <Textarea placeholder="Seller delivers goods on board the vessel..." {...field} />
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
          Create Incoterm
        </Button>
      </form>
    </Form>
  );
}