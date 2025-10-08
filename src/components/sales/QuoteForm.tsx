import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CarrierQuotesSection } from './CarrierQuotesSection';
import { Plus, Trash2 } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const quoteSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  service_type: z.enum(['ocean', 'air', 'trucking', 'courier', 'moving', 'railway_transport']).optional(),
  service_id: z.string().optional(),
  incoterms: z.string().optional(),
  trade_direction: z.enum(['import', 'export']).optional(),
  carrier_id: z.string().optional(),
  consignee_id: z.string().optional(),
  origin_port_id: z.string().optional(),
  destination_port_id: z.string().optional(),
  account_id: z.string().optional(),
  contact_id: z.string().optional(),
  opportunity_id: z.string().optional(),
  status: z.string(),
  valid_until: z.string().optional(),
  tax_percent: z.string().optional(),
  shipping_amount: z.string().optional(),
  terms_conditions: z.string().optional(),
  notes: z.string().optional(),
});

type QuoteItem = {
  line_number: number;
  product_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
};

type Charge = {
  type: string;
  amount: number;
  currency: string;
  note?: string;
};

type CarrierQuote = {
  carrier_id: string;
  mode?: string;
  buying_charges: Charge[];
  selling_charges: Charge[];
};

export function QuoteForm({ quoteId, onSuccess }: { quoteId?: string; onSuccess?: (quoteId: string) => void }) {
  const { context, supabase, user } = useCRM();
  const { roles } = useAuth();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<QuoteItem[]>([
    { line_number: 1, product_name: '', quantity: 1, unit_price: 0, discount_percent: 0 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [consignees, setConsignees] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [carrierQuotes, setCarrierQuotes] = useState<CarrierQuote[]>([]);
  const [quoteNumberPreview] = useState<string>(() => `QUO-${Date.now()}`);
  

  const form = useForm<z.infer<typeof quoteSchema>>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      status: 'draft',
      opportunity_id: searchParams.get('opportunityId') || undefined,
    },
  });

  useEffect(() => {
    if (context.tenantId || roles?.[0]?.tenant_id) {
      fetchData();
    }
  }, [context.tenantId, roles]);

  const fetchData = async () => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;
    if (!tenantId) return;

    try {
      const [servicesRes, carriersRes, consigneesRes, portsRes, accountsRes, contactsRes, opportunitiesRes] = await Promise.all([
        supabase.from('services').select('*').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('carriers').select('*').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('consignees').select('*').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('ports_locations').select('*').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('accounts').select('id, name').eq('tenant_id', tenantId),
        supabase.from('contacts').select('id, first_name, last_name').eq('tenant_id', tenantId),
        supabase.from('opportunities').select('id, name').eq('tenant_id', tenantId),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (carriersRes.error) throw carriersRes.error;
      if (consigneesRes.error) throw consigneesRes.error;
      if (portsRes.error) throw portsRes.error;
      if (accountsRes.error) throw accountsRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (opportunitiesRes.error) throw opportunitiesRes.error;

      setServices(servicesRes.data || []);
      setCarriers(carriersRes.data || []);
      setConsignees(consigneesRes.data || []);
      setPorts(portsRes.data || []);
      setAccounts(accountsRes.data || []);
      setContacts(contactsRes.data || []);
      setOpportunities(opportunitiesRes.data || []);
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
    }
  };


  const addItem = () => {
    setItems([
      ...items,
      { line_number: items.length + 1, product_name: '', quantity: 1, unit_price: 0, discount_percent: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // Carrier quotations helpers
  const addCarrierQuote = () => {
    setCarrierQuotes([
      ...carrierQuotes,
      {
        carrier_id: '',
        mode: selectedServiceType || undefined,
        buying_charges: [],
        selling_charges: [],
      },
    ]);
  };

  const removeCarrierQuote = (index: number) => {
    setCarrierQuotes(carrierQuotes.filter((_, i) => i !== index));
  };

  const updateCarrierField = (index: number, field: keyof CarrierQuote, value: any) => {
    const next = [...carrierQuotes];
    next[index] = { ...next[index], [field]: value };
    setCarrierQuotes(next);
  };

  const addCharge = (index: number, side: 'buy' | 'sell') => {
    const next = [...carrierQuotes];
    const targetList = side === 'buy' ? next[index].buying_charges : next[index].selling_charges;
    targetList.push({ type: 'freight', amount: 0, currency: 'USD' });
    setCarrierQuotes(next);
  };

  const updateCharge = (
    index: number,
    side: 'buy' | 'sell',
    chargeIndex: number,
    field: keyof Charge,
    value: any,
  ) => {
    const next = [...carrierQuotes];
    const targetList = side === 'buy' ? next[index].buying_charges : next[index].selling_charges;
    targetList[chargeIndex] = { ...targetList[chargeIndex], [field]: value } as Charge;
    setCarrierQuotes(next);
  };

  const removeCharge = (index: number, side: 'buy' | 'sell', chargeIndex: number) => {
    const next = [...carrierQuotes];
    const targetList = side === 'buy' ? next[index].buying_charges : next[index].selling_charges;
    next[index] = {
      ...next[index],
      [side === 'buy' ? 'buying_charges' : 'selling_charges']:
        targetList.filter((_, i) => i !== chargeIndex),
    } as CarrierQuote;
    setCarrierQuotes(next);
  };

  const totalCharges = (charges: Charge[]) => charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unit_price;
      const discount = lineTotal * (item.discount_percent / 100);
      return sum + (lineTotal - discount);
    }, 0);

    const taxPercent = parseFloat(form.getValues('tax_percent') || '0');
    const shippingAmount = parseFloat(form.getValues('shipping_amount') || '0');
    const taxAmount = subtotal * (taxPercent / 100);
    const total = subtotal + taxAmount + shippingAmount;

    return { subtotal, taxAmount, total };
  };

  const onSubmit = async (values: z.infer<typeof quoteSchema>) => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;
    const franchiseId = context.franchiseId || roles?.[0]?.franchise_id || null;

    if (!tenantId) {
      toast.error('No tenant selected. Please ensure your account is linked to a tenant.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { subtotal, taxAmount, total } = calculateTotals();
      
      const quoteNumber = `QUO-${Date.now()}`;
      
      const regulatory: any = {};
      if (values.trade_direction) regulatory.trade_direction = values.trade_direction;
      if (selectedServiceType) regulatory.transport_mode = selectedServiceType;
      if (carrierQuotes.length > 0) {
        regulatory.carrier_quotes = carrierQuotes.map((cq) => ({
          carrier_id: cq.carrier_id,
          mode: cq.mode || selectedServiceType || null,
          buying_charges: cq.buying_charges,
          selling_charges: cq.selling_charges,
          total_buy: totalCharges(cq.buying_charges),
          total_sell: totalCharges(cq.selling_charges),
        }));
      }

      const quoteData: any = {
        quote_number: quoteNumber,
        title: values.title,
        description: values.description || null,
        service_type: values.service_type || null,
        service_id: values.service_id || null,
        incoterms: values.incoterms || null,
        regulatory_data: Object.keys(regulatory).length ? regulatory : null,
        carrier_id: values.carrier_id || null,
        consignee_id: values.consignee_id || null,
        origin_port_id: values.origin_port_id || null,
        destination_port_id: values.destination_port_id || null,
        account_id: values.account_id || null,
        contact_id: values.contact_id || null,
        opportunity_id: values.opportunity_id || null,
        status: values.status,
        valid_until: values.valid_until || null,
        tenant_id: tenantId,
        franchise_id: franchiseId,
        owner_id: user?.id || null,
        created_by: user?.id || null,
        subtotal,
        tax_amount: taxAmount,
        tax_percent: parseFloat(values.tax_percent || '0'),
        shipping_amount: parseFloat(values.shipping_amount || '0'),
        total_amount: total,
        terms_conditions: values.terms_conditions || null,
        notes: values.notes || null,
        compliance_status: 'pending',
      };

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert([quoteData])
        .select()
        .single();

      if (quoteError) throw quoteError;

      const itemsData = items.map((item) => ({
        quote_id: quote.id,
        ...item,
        line_total: item.quantity * item.unit_price * (1 - item.discount_percent / 100),
      }));

      const { error: itemsError } = await supabase.from('quote_items').insert(itemsData);

      if (itemsError) throw itemsError;

      toast.success('Quote created successfully');
      onSuccess?.(quote.id);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create quote');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Quote Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account</FormLabel>
                      <FormDescription>Select account</FormDescription>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                          {accounts.length === 0 && (
                            <SelectItem disabled value="__no_accounts__">No accounts found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormItem>
                  <FormLabel>Quotation Number</FormLabel>
                  <FormDescription>Auto-generated on save</FormDescription>
                  <FormControl>
                    <Input value={quoteNumberPreview} readOnly />
                  </FormControl>
                </FormItem>
              </div>

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="contact_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact</FormLabel>
                      <FormDescription>Select contact</FormDescription>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select contact" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.first_name} {contact.last_name}
                            </SelectItem>
                          ))}
                          {contacts.length === 0 && (
                            <SelectItem disabled value="__no_contacts__">No contacts found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="opportunity_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opportunity Number</FormLabel>
                      <FormDescription>Select opportunity</FormDescription>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select opportunity" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {opportunities.map((opp) => (
                            <SelectItem key={opp.id} value={opp.id}>
                              {opp.name}
                            </SelectItem>
                          ))}
                          {opportunities.length === 0 && (
                            <SelectItem disabled value="__no_opportunities__">No opportunities found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valid_until"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid Until</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="service_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        setSelectedServiceType(value);
                      }} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select service type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ocean">Ocean Freight</SelectItem>
                        <SelectItem value="air">Air Freight</SelectItem>
                        <SelectItem value="trucking">Trucking</SelectItem>
                        <SelectItem value="courier">Courier</SelectItem>
                        <SelectItem value="moving">Moving & Packing</SelectItem>
                        <SelectItem value="railway_transport">Railways</SelectItem>
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
                    <FormLabel>Service</FormLabel>
                    <FormDescription>Select service</FormDescription>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {services
                          .filter(s => !selectedServiceType || s.service_type === selectedServiceType)
                          .map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.service_name}
                            </SelectItem>
                          ))}
                        {services.length === 0 && (
                          <SelectItem disabled value="__no_services__">No services found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="trade_direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Import/Export</FormLabel>
                    <FormDescription>Select trade direction</FormDescription>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select direction" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="import">Import</SelectItem>
                        <SelectItem value="export">Export</SelectItem>
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
                name="carrier_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select carrier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {carriers.map((carrier) => (
                          <SelectItem key={carrier.id} value={carrier.id}>
                            {carrier.carrier_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="consignee_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consignee</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select consignee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {consignees.map((consignee) => (
                          <SelectItem key={consignee.id} value={consignee.id}>
                            {consignee.company_name}
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
                name="origin_port_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origin Port/Location</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select origin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ports.map((port) => (
                          <SelectItem key={port.id} value={port.id}>
                            {port.location_name} ({port.location_code || 'N/A'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destination_port_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination Port/Location</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ports.map((port) => (
                          <SelectItem key={port.id} value={port.id}>
                            {port.location_name} ({port.location_code || 'N/A'})
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
                name="incoterms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Incoterms</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select incoterms" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="FOB">FOB - Free On Board</SelectItem>
                        <SelectItem value="CIF">CIF - Cost, Insurance & Freight</SelectItem>
                        <SelectItem value="EXW">EXW - Ex Works</SelectItem>
                        <SelectItem value="FCA">FCA - Free Carrier</SelectItem>
                        <SelectItem value="CPT">CPT - Carriage Paid To</SelectItem>
                        <SelectItem value="CIP">CIP - Carriage & Insurance Paid</SelectItem>
                        <SelectItem value="DAP">DAP - Delivered At Place</SelectItem>
                        <SelectItem value="DDP">DDP - Delivered Duty Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </div>

            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Carrier quotations section */}
        <CarrierQuotesSection
          carriers={carriers}
          selectedServiceType={selectedServiceType}
          carrierQuotes={carrierQuotes}
          setCarrierQuotes={setCarrierQuotes}
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button type="button" onClick={addItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <span className="font-medium">Item {index + 1}</span>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="Product Name"
                    value={item.product_name}
                    onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                  />
                  <Input
                    placeholder="Description"
                    value={item.description || ''}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Quantity"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Unit Price"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Discount %"
                    value={item.discount_percent}
                    onChange={(e) => updateItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                  />
                  <div className="flex items-center">
                    <span className="text-sm font-medium">
                      Total: ${(item.quantity * item.unit_price * (1 - item.discount_percent / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals & Additional Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tax_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax %</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shipping_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">${calculateTotals().subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span className="font-medium">${calculateTotals().taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping:</span>
                <span className="font-medium">${parseFloat(form.watch('shipping_amount') || '0').toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>${calculateTotals().total.toFixed(2)}</span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="terms_conditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms & Conditions</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Quote'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
