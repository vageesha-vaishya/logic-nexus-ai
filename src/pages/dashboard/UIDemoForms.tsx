import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { FormSection, FormGrid } from "@/components/forms/FormLayout";
import { TextField, NumberField, TextareaField, SelectField, SwitchField, CheckboxField } from "@/components/forms/fields";
import { toast } from "sonner";

const schema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  serviceType: z.enum(["ocean", "air", "trucking", "courier", "moving"]).optional(),
  shipmentType: z.enum([
    "ocean_freight",
    "air_freight",
    "trucking_freight",
    "courier_delivery",
    "moving_service",
  ]).optional(),
  basePrice: z.coerce.number().optional(),
  pricingUnit: z.enum(["per_shipment", "per_kg", "per_cbm", "flat_fee"]).optional(),
  isFragile: z.boolean().default(false),
  insuranceRequired: z.boolean().default(false),
  notes: z.string().optional(),
});

type Schema = z.infer<typeof schema>;

export default function UIDemoForms() {
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "",
      email: "",
      phone: "",
      serviceType: undefined,
      shipmentType: undefined,
      basePrice: undefined,
      pricingUnit: undefined,
      isFragile: false,
      insuranceRequired: false,
      notes: "",
    },
  });

  const copySnippet = async (snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Snippet copied to clipboard");
    } catch (e) {
      toast.error("Failed to copy snippet");
    }
  };

  const basicInfoSnippet = `// Basic Information section\n<FormGrid>\n  <TextField name="companyName" label="Company Name" />\n  <TextField name="email" label="Email" />\n  <TextField name="phone" label="Phone" />\n  <SelectField name="serviceType" label="Service Type" />\n  <SelectField name="shipmentType" label="Shipment Type" />\n</FormGrid>`;

  const pricingSnippet = `// Pricing & Options section\n<FormGrid>\n  <NumberField name="basePrice" label="Base Price" />\n  <SelectField name="pricingUnit" label="Pricing Unit" />\n  <SwitchField name="isFragile" label="Fragile Handling" />\n  <CheckboxField name="insuranceRequired" label="Insurance Required" />\n</FormGrid>`;

  const notesSnippet = `// Notes section\n<TextareaField name="notes" label="Internal Notes" />`;

  const onSubmit = (values: Schema) => {
    toast.success("Form submitted", { description: JSON.stringify(values, null, 2) });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">UI Templates: Forms</h1>
          <p className="text-muted-foreground">Phase 1–2: foundational fields, layout, and validation</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormSection
              title="Basic Information"
              description="Core identifiers and contact details"
              actions={
                <Button variant="outline" size="sm" onClick={() => copySnippet(basicInfoSnippet)}>
                  Copy snippet
                </Button>
              }
            >
              <FormGrid>
                <TextField control={form.control} name="companyName" label="Company Name" placeholder="Acme Logistics" />
                <TextField control={form.control} name="email" label="Email" placeholder="ops@acme.com" />
                <TextField control={form.control} name="phone" label="Phone" placeholder="+1 (555) 555-1234" />
                <SelectField
                  control={form.control}
                  name="serviceType"
                  label="Service Type"
                  placeholder="Select a service"
                  options={[
                    { value: "ocean", label: "Ocean" },
                    { value: "air", label: "Air" },
                    { value: "trucking", label: "Trucking" },
                    { value: "courier", label: "Courier" },
                    { value: "moving", label: "Moving" },
                  ]}
                />
                <SelectField
                  control={form.control}
                  name="shipmentType"
                  label="Shipment Type"
                  placeholder="Select a shipment type"
                  options={[
                    { value: "ocean_freight", label: "Ocean Freight" },
                    { value: "air_freight", label: "Air Freight" },
                    { value: "trucking_freight", label: "Trucking Freight" },
                    { value: "courier_delivery", label: "Courier Delivery" },
                    { value: "moving_service", label: "Moving Service" },
                  ]}
                />
              </FormGrid>
            </FormSection>

            <FormSection
              title="Pricing & Options"
              description="Commercial terms and handling preferences"
              actions={
                <Button variant="outline" size="sm" onClick={() => copySnippet(pricingSnippet)}>
                  Copy snippet
                </Button>
              }
            >
              <FormGrid>
                <NumberField control={form.control} name="basePrice" label="Base Price" placeholder="1000" />
                <SelectField
                  control={form.control}
                  name="pricingUnit"
                  label="Pricing Unit"
                  placeholder="Select unit"
                  options={[
                    { value: "per_shipment", label: "Per Shipment" },
                    { value: "per_kg", label: "Per KG" },
                    { value: "per_cbm", label: "Per CBM" },
                    { value: "flat_fee", label: "Flat Fee" },
                  ]}
                />
                <SwitchField control={form.control} name="isFragile" label="Fragile Handling" description="Flag if cargo needs special care" />
                <CheckboxField control={form.control} name="insuranceRequired" label="Insurance Required" description="Require shipment insurance" />
              </FormGrid>
            </FormSection>

            <FormSection
              title="Notes"
              description="Additional instructions or context"
              actions={
                <Button variant="outline" size="sm" onClick={() => copySnippet(notesSnippet)}>
                  Copy snippet
                </Button>
              }
            >
              <TextareaField control={form.control} name="notes" label="Internal Notes" placeholder="Anything relevant for operations" />
            </FormSection>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => form.reset()}>Reset</Button>
              <Button type="submit">Submit</Button>
            </div>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}