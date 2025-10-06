import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Safely convert Supabase JSON/text to an object record
const toRecord = (value: any): Record<string, any> => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') return value as Record<string, any>;
  return {};
};
const consigneeSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  contact_person: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  tax_id: z.string().optional(),
  customs_id: z.string().optional(),
  notes: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postal_code: z.string().optional(),
});

export function ConsigneeForm({ consigneeId, onSuccess }: { consigneeId?: string; onSuccess?: () => void }) {
  const { context, supabase } = useCRM();
  const { roles } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof consigneeSchema>>({
    resolver: zodResolver(consigneeSchema),
    defaultValues: {
      company_name: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      tax_id: '',
      customs_id: '',
      notes: '',
      street: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
    },
  });

  useEffect(() => {
    const loadConsignee = async () => {
      if (!consigneeId) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('consignees')
          .select('*')
          .eq('id', consigneeId)
          .single();
        if (error) throw error;
        if (data) {
          const addr = toRecord(data.address);
          form.reset({
            company_name: data.company_name || '',
            contact_person: data.contact_person || '',
            contact_email: data.contact_email || '',
            contact_phone: data.contact_phone || '',
            tax_id: data.tax_id || '',
            customs_id: data.customs_id || '',
            notes: data.notes || '',
            street: typeof addr.street === 'string' ? addr.street : '',
            city: typeof addr.city === 'string' ? addr.city : '',
            state: typeof addr.state === 'string' ? addr.state : '',
            country: typeof addr.country === 'string' ? addr.country : '',
            postal_code: typeof addr.postal_code === 'string' ? addr.postal_code : '',
          });
        }
      } catch (e: any) {
        toast.error(e.message || 'Failed to load consignee');
      } finally {
        setIsLoading(false);
      }
    };
    loadConsignee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consigneeId]);

  const onSubmit = async (values: z.infer<typeof consigneeSchema>) => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;

    if (!tenantId) {
      toast.error('No tenant selected');
      return;
    }

    setIsSubmitting(true);
    try {
      const consigneeData: any = {
        company_name: values.company_name,
        contact_person: values.contact_person || null,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
        tax_id: values.tax_id || null,
        customs_id: values.customs_id || null,
        notes: values.notes || null,
        address: {
          street: values.street || '',
          city: values.city || '',
          state: values.state || '',
          country: values.country || '',
          postal_code: values.postal_code || '',
        },
        tenant_id: tenantId,
      };

      if (consigneeId) {
        const { error } = await supabase
          .from('consignees')
          .update(consigneeData)
          .eq('id', consigneeId);
        if (error) throw error;
        toast.success('Consignee updated successfully');
      } else {
        const { error } = await supabase.from('consignees').insert([consigneeData]);
        if (error) throw error;
        toast.success('Consignee created successfully');
        form.reset();
      }
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create consignee');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="company_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contact_person"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contact_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Phone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tax_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax ID</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="customs_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customs ID</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <h3 className="font-medium">Address</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="street"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Street</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State/Province</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postal_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting || isLoading}>
          {isSubmitting ? (consigneeId ? 'Updating...' : 'Creating...') : (consigneeId ? 'Update Consignee' : 'Create Consignee')}
        </Button>
      </form>
    </Form>
  );
}
