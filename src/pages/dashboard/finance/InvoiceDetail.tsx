
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
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
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
  type: z.string().optional(),
  metadata: z.any().optional(),
});

const formSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'),
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
      
      form.reset({
        customer_id: data.customer_id || '',
        issue_date: data.issue_date ? format(new Date(data.issue_date), 'yyyy-MM-dd') : '',
        due_date: data.due_date ? format(new Date(data.due_date), 'yyyy-MM-dd') : '',
        currency: data.currency,
        items: data.invoice_line_items?.map(i => ({
          description: i.description,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          tax_code_id: undefined,
          type: i.type,
          metadata: i.metadata
        })) || [],
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      navigate('/dashboard/finance/invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!invoice?.id) return;

    try {
        const { error } = await supabase.functions.invoke('send-email', {
            body: {
                to: [invoice.customer?.email || 'test@example.com'], // Fallback for dev
                subject: `Invoice ${invoice.invoice_number}`,
                body: `<p>Please find attached invoice ${invoice.invoice_number} for ${new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(invoice.total)}.</p><p>Due Date: ${invoice.due_date}</p>`,
                // In a real app, we would generate the PDF link here
            }
        });

        if (error) throw error;
        toast({ title: 'Success', description: 'Invoice sent successfully' });
    } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!isNew) {
      toast({ title: 'Info', description: 'Editing not yet implemented' });
      return;
    }

    setSaving(true);
    try {
      await InvoiceService.createInvoice({
        customer_id: values.customer_id,
        issue_date: new Date(values.issue_date),
        due_date: new Date(values.due_date),
        currency: values.currency,
        items: values.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            tax_code_id: item.tax_code_id,
            metadata: item.metadata
        }))
      });
      toast({ title: 'Success', description: 'Invoice created successfully' });
      navigate('/dashboard/finance/invoices');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/finance/invoices')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {isNew ? 'New Invoice' : `Invoice ${invoice?.invoice_number}`}
              </h1>
              <p className="text-muted-foreground">
                {isNew ? 'Create a new invoice' : `View details for ${invoice?.invoice_number}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
                <Button variant="outline">
                    <Send className="mr-2 h-4 w-4" />
                    Send Invoice
                </Button>
            )}
            <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save Invoice'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="customer_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Select Customer" disabled={!isNew} />
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
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Line Items</h3>
                        {isNew && (
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Item
                            </Button>
                        )}
                      </div>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40%]">Description</TableHead>
                            <TableHead className="w-[15%]">Qty</TableHead>
                            <TableHead className="w-[20%]">Price</TableHead>
                            <TableHead className="w-[20%] text-right">Amount</TableHead>
                            {isNew && <TableHead className="w-[5%]"></TableHead>}
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
                                    <FormControl>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <Input {...field} disabled={!isNew} />
                                          {form.watch(`items.${index}.type`) === 'fees' && (
                                            <Badge variant="outline" className="border-amber-500 text-amber-500">Fees</Badge>
                                          )}
                                          {form.watch(`items.${index}.type`) === 'tax' && (
                                              <Badge variant="secondary">Duty</Badge>
                                          )}
                                        </div>
                                        {form.watch(`items.${index}.metadata`) && (
                                            <div className="mt-1 text-xs text-muted-foreground space-y-1">
                                                {form.watch(`items.${index}.metadata.hts_code`) && (
                                                    <div><span className="font-medium">HTS:</span> {form.watch(`items.${index}.metadata.hts_code`)}</div>
                                                )}
                                                {(form.watch(`items.${index}.metadata.rate`) || form.watch(`items.${index}.metadata.duty_rate`)) && (
                                                  <div>
                                                    <span className="font-medium">Rate:</span>{' '}
                                                    {form.watch(`items.${index}.metadata.rate`)
                                                      ? form.watch(`items.${index}.metadata.rate`)
                                                      : `${(Number(form.watch(`items.${index}.metadata.duty_rate`)) * 100).toFixed(2)}%`}
                                                  </div>
                                                )}
                                                {form.watch(`items.${index}.metadata.customs_value`) && (
                                                    <div><span className="font-medium">Value:</span> {new Intl.NumberFormat('en-US', { style: 'currency', currency: form.watch('currency') }).format(Number(form.watch(`items.${index}.metadata.customs_value`)))}</div>
                                                )}
                                                {/* MPF/HMF/Duty Breakdown for Fees */}
                                                {(form.watch(`items.${index}.type`) === 'fees' || form.watch(`items.${index}.metadata.type`) === 'fees' || form.watch(`items.${index}.metadata.mpf_amount`) !== undefined || form.watch(`items.${index}.metadata.hmf_amount`) !== undefined) && (
                                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 p-1.5 bg-muted/50 rounded-sm max-w-[200px]">
                                                    {form.watch(`items.${index}.metadata.duty_amount`) !== undefined && Number(form.watch(`items.${index}.metadata.duty_amount`)) > 0 && (
                                                      <>
                                                        <span className="text-muted-foreground">Duty:</span>
                                                        <span className="font-mono text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: form.watch('currency') }).format(Number(form.watch(`items.${index}.metadata.duty_amount`)))}</span>
                                                      </>
                                                    )}
                                                    {form.watch(`items.${index}.metadata.mpf_amount`) !== undefined && (
                                                      <>
                                                        <span className="text-muted-foreground">MPF (0.3464%):</span>
                                                        <span className="font-mono text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: form.watch('currency') }).format(Number(form.watch(`items.${index}.metadata.mpf_amount`)))}</span>
                                                      </>
                                                    )}
                                                    {form.watch(`items.${index}.metadata.hmf_amount`) !== undefined && (
                                                      <>
                                                        <span className="text-muted-foreground">HMF (0.125%):</span>
                                                        <span className="font-mono text-right">{new Intl.NumberFormat('en-US', { style: 'currency', currency: form.watch('currency') }).format(Number(form.watch(`items.${index}.metadata.hmf_amount`)))}</span>
                                                      </>
                                                    )}
                                                  </div>
                                                )}
                                                {form.watch(`items.${index}.metadata.mpf_clamped`) && (
                                                    <div className="text-amber-600 font-medium text-[10px] uppercase tracking-wider">
                                                      Includes MPF Min/Max Adjustment
                                                    </div>
                                                )}
                                                {form.watch(`items.${index}.metadata.source`) && (
                                                    <div><span className="font-medium">Source:</span> {form.watch(`items.${index}.metadata.source`)}</div>
                                                )}
                                            </div>
                                        )}
                                      </div>
                                    </FormControl>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.quantity`}
                                  render={({ field }) => (
                                    <FormControl>
                                      <Input 
                                        type="number" 
                                        {...field} 
                                        onChange={e => field.onChange(parseFloat(e.target.value))}
                                        disabled={!isNew}
                                      />
                                    </FormControl>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.unit_price`}
                                  render={({ field }) => (
                                    <FormControl>
                                      <Input 
                                        type="number" 
                                        {...field} 
                                        onChange={e => field.onChange(parseFloat(e.target.value))}
                                        disabled={!isNew}
                                      />
                                    </FormControl>
                                  )}
                                />
                              </TableCell>
                              <TableCell className="text-right font-medium">
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
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {invoice?.subtotal 
                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(invoice.subtotal)
                        : '$0.00'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">
                    {invoice?.tax_total
                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(invoice.tax_total)
                        : '$0.00'}
                  </span>
                </div>
                <div className="border-t pt-4 flex justify-between items-center">
                  <span className="font-bold">Total</span>
                  <span className="text-xl font-bold">
                    {invoice?.total
                        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(invoice.total)
                        : '$0.00'}
                  </span>
                </div>
              </CardContent>
            </Card>
            {!isNew && invoice?.invoice_line_items && invoice.invoice_line_items.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Duty Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {invoice.invoice_line_items
                  .filter((li: any) => li.type === 'tax' && li.metadata)
                  .map((li: any) => (
                    <div key={li.id} className="rounded-md border p-3">
                      <div className="flex justify-between items-start">
                        <div>
                            <div className="font-medium">{li.description}</div>
                            {li.metadata?.type === 'fees' && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    Includes Merchandise Processing Fee (MPF) and Harbor Maintenance Fee (HMF)
                                </div>
                            )}
                        </div>
                        <div className="font-mono text-right">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(Number(li.unit_price || li.amount || 0))}
                        </div>
                      </div>
                      
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground border-t pt-2">
                        {/* Standard Duty Line Metadata */}
                        {li.metadata?.hts_code && <div><span className="font-semibold text-foreground">HTS:</span> {li.metadata.hts_code}</div>}
                        {li.metadata?.rate && <div><span className="font-semibold text-foreground">Rate:</span> {Number(li.metadata.rate) < 1 ? `${(Number(li.metadata.rate) * 100).toFixed(2)}%` : li.metadata.rate}</div>}
                        {li.metadata?.rate_type && <div><span className="font-semibold text-foreground">Type:</span> {li.metadata.rate_type}</div>}
                        {li.metadata?.customs_value && (
                          <div>
                            <span className="font-semibold text-foreground">Value:</span>{' '}
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(Number(li.metadata.customs_value))}
                          </div>
                        )}

                        {/* Aggregated Fees Line Metadata */}
                        {li.metadata?.mpf_fee !== undefined && (
                            <div className="flex justify-between col-span-2 sm:col-span-1 bg-muted/30 p-1 rounded">
                                <span className="font-semibold text-foreground">MPF:</span>
                                <span>
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(Number(li.metadata.mpf_fee))}
                                    {li.metadata.mpf_clamped && <span className="ml-1 text-[10px] text-amber-600 font-medium">(Min/Max)</span>}
                                </span>
                            </div>
                        )}
                        {li.metadata?.hmf_fee !== undefined && Number(li.metadata.hmf_fee) > 0 && (
                            <div className="flex justify-between col-span-2 sm:col-span-1 bg-muted/30 p-1 rounded">
                                <span className="font-semibold text-foreground">HMF:</span>
                                <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(Number(li.metadata.hmf_fee))}</span>
                            </div>
                        )}

                        {li.metadata?.source && <div className="col-span-2 mt-1 italic text-[10px] opacity-70">Source: {li.metadata.source}</div>}
                      </div>
                    </div>
                  ))}
                {invoice.invoice_line_items.filter((li: any) => li.type === 'tax' && li.metadata).length === 0 && (
                  <div className="text-sm text-muted-foreground italic text-center py-4">No duty information available</div>
                )}
              </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
