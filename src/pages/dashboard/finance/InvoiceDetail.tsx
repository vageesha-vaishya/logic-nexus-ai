
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Plus, Trash2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { InvoiceService } from '@/services/invoicing/InvoiceService';
import { Invoice } from '@/services/invoicing/types';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const itemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  unit_price: z.number().min(0, 'Price must be positive'),
  tax_code_id: z.string().optional(),
});

const formSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'), // In real app, this would be a lookup
  issue_date: z.string(),
  due_date: z.string(),
  currency: z.string().default('USD'),
  items: z.array(itemSchema).min(1, 'At least one item is required'),
});

type FormValues = z.infer<typeof formSchema>;

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const isNew = id === 'new';

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_id: '',
      issue_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      currency: 'USD',
      items: [{ description: 'Professional Services', quantity: 1, unit_price: 100 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    if (!isNew && id) {
      loadInvoice(id);
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadInvoice = async (invoiceId: string) => {
    try {
      const data = await InvoiceService.getInvoice(invoiceId);
      if (!data) throw new Error('Invoice not found');
      setInvoice(data);
      // Populate form if we were to support edit, but for now mostly read-only for existing
      form.reset({
        customer_id: data.customer_id,
        issue_date: format(new Date(data.issue_date), 'yyyy-MM-dd'),
        due_date: format(new Date(data.due_date), 'yyyy-MM-dd'),
        currency: data.currency,
        items: data.items?.map(i => ({
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unit_price,
            tax_code_id: i.tax_code_id || undefined
        })) || [],
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      navigate('/dashboard/finance/invoices');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!isNew) {
      toast({ title: 'Info', description: 'Editing existing invoices is not supported yet.' });
      return;
    }

    setSaving(true);
    try {
      await InvoiceService.createInvoice({
        customer_id: values.customer_id,
        issue_date: new Date(values.issue_date),
        due_date: new Date(values.due_date),
        currency: values.currency,
        // TODO: Implement address selection in UI. Using defaults for now.
        origin_address: {
            street: '123 Origin St',
            city: 'New York',
            state: 'NY',
            zip: '10001',
            country: 'US'
        },
        destination_address: {
            street: '456 Dest St',
            city: 'Los Angeles',
            state: 'CA',
            zip: '90001',
            country: 'US'
        },
        items: values.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_code_id: item.tax_code_id
        })),
      });
      toast({ title: 'Success', description: 'Invoice created successfully' });
      navigate('/dashboard/finance/invoices');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create invoice', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/finance/invoices')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                {isNew ? 'New Invoice' : `Invoice ${invoice?.invoice_number}`}
              </h2>
              <p className="text-muted-foreground">
                {isNew ? 'Create a new customer invoice' : `Status: ${invoice?.status}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isNew && (
              <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
                {saving ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save Invoice</>}
              </Button>
            )}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter Customer ID" {...field} disabled={!isNew} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isNew} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="issue_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} disabled={!isNew} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} disabled={!isNew} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                {isNew && (
                  <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}>
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Description</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {isNew && <TableHead className="w-[50px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} disabled={!isNew} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} disabled={!isNew} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`items.${index}.unit_price`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} disabled={!isNew} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right align-middle">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: form.watch('currency') }).format(
                            (form.watch(`items.${index}.quantity`) || 0) * (form.watch(`items.${index}.unit_price`) || 0)
                          )}
                        </TableCell>
                        {isNew && (
                          <TableCell>
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Totals Summary */}
                <div className="flex justify-end mt-6">
                   <div className="w-1/3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal:</span>
                        <span>
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: form.watch('currency') }).format(
                                form.watch('items').reduce((acc, item) => acc + (item.quantity * item.unit_price), 0)
                            )}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tax (Calculated on Save):</span>
                        <span>--</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total:</span>
                         <span>
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: form.watch('currency') }).format(
                                form.watch('items').reduce((acc, item) => acc + (item.quantity * item.unit_price), 0)
                            )}
                        </span>
                      </div>
                   </div>
                </div>

              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
