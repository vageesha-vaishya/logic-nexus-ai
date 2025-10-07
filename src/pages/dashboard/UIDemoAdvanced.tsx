import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { FormSection, FormGrid } from "@/components/forms/FormLayout";
import { FormPage, FormPageSection } from "@/components/forms/FormPage";
import { DateField, CurrencyField, ComboboxField, FileUploadField, AsyncComboboxField } from "@/components/forms/AdvancedFields";
import { TextField, SelectField, SwitchField } from "@/components/forms/fields";
import { Switch } from "@/components/ui/switch";
import * as React from "react";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

const schema = z.object({
  shipmentName: z.string().min(1, "Required"),
  shipmentDate: z.date({ required_error: "Pick a date" }),
  amount: z.coerce.number().min(0, "Must be positive"),
  currency: z.enum(["USD", "EUR", "GBP", "JPY", "CNY"]).default("USD"),
  destinationCountry: z.string().min(1, "Choose a country"),
  isHazardous: z.boolean().optional(),
  attachments: z.array(z.any()).default([]),
  serviceId: z.string().optional(),
});

type Schema = z.infer<typeof schema>;

export default function UIDemoAdvanced() {
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: {
      shipmentName: "",
      shipmentDate: new Date(),
      amount: 0,
      currency: "USD",
      destinationCountry: "",
      isHazardous: false,
      attachments: [],
      serviceId: undefined,
    },
  });

  const countryOptions = [
    { label: "United States", value: "US" },
    { label: "United Kingdom", value: "GB" },
    { label: "Germany", value: "DE" },
    { label: "Japan", value: "JP" },
    { label: "China", value: "CN" },
    { label: "France", value: "FR" },
    { label: "Canada", value: "CA" },
  ];

  const attachments = form.watch("attachments");
  const [signedUrlEnabled, setSignedUrlEnabled] = React.useState(false);

  const copySnippet = async (snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Snippet copied to clipboard");
    } catch (e) {
      toast.error("Failed to copy snippet");
    }
  };

  const shipmentSnippet = `// Advanced fields example\n<FormGrid columns={2}>\n  <TextField control={form.control} name=\"shipmentName\" label=\"Shipment Name\" />\n  <DateField control={form.control} name=\"shipmentDate\" label=\"Shipment Date\" />\n  <CurrencyField control={form.control} name=\"amount\" label=\"Amount\" />\n  <SelectField control={form.control} name=\"currency\" label=\"Currency\" options={[{ label: 'USD', value: 'USD' }]} />\n  <AsyncComboboxField control={form.control} name=\"serviceId\" label=\"Service\" placeholder=\"Search services...\" />\n  <ComboboxField control={form.control} name=\"destinationCountry\" label=\"Destination Country\" options={countryOptions} />\n  <SwitchField control={form.control} name=\"isHazardous\" label=\"Hazardous Cargo\" />\n</FormGrid>`;

  const attachmentsSnippet = `// Signed URL toggle demo (Supabase Storage)\n// Assume files are uploaded to a \`documents\` bucket under paths derived from file names\nconst enableSignedUrl = true;\nif (enableSignedUrl) {\n  // Example: create a 60-minute signed URL for a stored file\n  const { data, error } = await supabase.storage.from('documents').createSignedUrl('invoices/INV-123.pdf', 3600);\n  if (!error) {\n    console.log('Signed URL:', data.signedUrl);\n  }\n}`;

  const onSubmit = (values: Schema) => {
    toast.success("Advanced form submitted", {
      description: JSON.stringify(
        {
          ...values,
          shipmentDate: values.shipmentDate?.toISOString(),
          attachments: Array.isArray(values.attachments) ? values.attachments.map((f: any) => f?.name) : [],
        },
        null,
        2,
      ),
    });
  };

  return (
    <DashboardLayout>
      <FormPage
        title="UI Demo – Advanced Fields"
        description="Phase 3–5: Date, currency, combobox, and attachments"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => form.reset()}>Reset</Button>
            <Button onClick={form.handleSubmit(onSubmit)}>Save</Button>
          </div>
        }
      >
        <Form {...form}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <FormSection
                title="Shipment Overview"
                description="Key shipment details and preferences"
                actions={
                  <Button variant="outline" size="sm" onClick={() => copySnippet(shipmentSnippet)}>
                    Copy snippet
                  </Button>
                }
              >
                <FormGrid columns={2}>
                  <TextField control={form.control} name="shipmentName" label="Shipment Name" placeholder="e.g. Ocean Import #123" />
                  <DateField control={form.control} name="shipmentDate" label="Shipment Date" />
                  <CurrencyField control={form.control} name="amount" label="Amount" placeholder="0.00" />
                  <SelectField
                    control={form.control}
                    name="currency"
                    label="Currency"
                    placeholder="Select currency"
                    options={[
                      { label: "USD", value: "USD" },
                      { label: "EUR", value: "EUR" },
                      { label: "GBP", value: "GBP" },
                      { label: "JPY", value: "JPY" },
                      { label: "CNY", value: "CNY" },
                    ]}
                  />
                  <AsyncComboboxField
                    control={form.control}
                    name="serviceId"
                    label="Service"
                    placeholder="Search services..."
                  />
                  <ComboboxField
                    control={form.control}
                    name="destinationCountry"
                    label="Destination Country"
                    placeholder="Select country"
                    options={countryOptions}
                  />
                  <SwitchField control={form.control} name="isHazardous" label="Hazardous Cargo" />
                </FormGrid>
              </FormSection>

              <FormSection
                title="Attachments"
                description="Upload related documents (invoices, BOLs, etc.)"
                actions={
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Switch checked={signedUrlEnabled} onCheckedChange={setSignedUrlEnabled} id="signed-url" />
                      <label htmlFor="signed-url" className="text-sm">Signed URL</label>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copySnippet(attachmentsSnippet)}>
                      Copy snippet
                    </Button>
                  </div>
                }
              >
                <FormGrid columns={1}>
                  <FileUploadField control={form.control} name="attachments" label="Attachments" />
                </FormGrid>
              </FormSection>

              {/* Phase 4–5 demo: preview selected files and metadata */}
              <Card>
                <CardHeader>
                  <CardTitle>Attachments Preview</CardTitle>
                  <CardDescription>Shows selected files, type, and size</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {attachments && attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map((f: File, idx: number) => (
                        <div key={`${f.name}-${idx}`} className="flex items-center justify-between text-sm">
                          <div className="truncate">
                            <span className="font-medium">{f.name}</span>
                            <span className="text-muted-foreground"> • {f.type || 'unknown'}</span>
                          </div>
                          <div className="text-muted-foreground">
                            {(f.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      ))}
                      {signedUrlEnabled && (
                        <p className="text-xs text-muted-foreground">
                          Signed URL enabled: in production, generate secure file links via Supabase Storage.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No files selected yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  <p>This sidebar can summarize selections or show contextual help.</p>
                  <ul className="mt-2 list-disc pl-4">
                    <li>Date picker supports keyboard focus</li>
                    <li>Combobox allows quick searching</li>
                    <li>Currency input keeps numeric value</li>
                    <li>File upload lists selected file names</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </Form>
      </FormPage>
    </DashboardLayout>
  );
}