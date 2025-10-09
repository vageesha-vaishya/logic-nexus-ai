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
import { Plus, Trash2, Search } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import OpportunitySelectDialogList from '@/components/crm/OpportunitySelectDialogList';
import AccountSelectDialogList from '@/components/crm/AccountSelectDialogList';
import ContactSelectDialogList from '@/components/crm/ContactSelectDialogList';

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
  const isEditMode = !!quoteId;
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
  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(null);
  const [resolvedTenantName, setResolvedTenantName] = useState<string | null>(null);
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [carrierQuotes, setCarrierQuotes] = useState<CarrierQuote[]>([]);
  // Display-only hint; actual quote_number is generated in DB
  const [quoteNumberPreview, setQuoteNumberPreview] = useState<string>('Auto-generated on save');
  

  const form = useForm<z.infer<typeof quoteSchema>>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      status: 'draft',
      opportunity_id: searchParams.get('opportunityId') || '',
    },
  });

  // Watch selected account to enable contact filtering
  const accountId = form.watch('account_id');

  useEffect(() => {
    if (context.tenantId || roles?.[0]?.tenant_id) {
      fetchData();
    }
  }, [context.tenantId, roles]);

  // Load existing quote for edit mode independent of tenant context
  useEffect(() => {
    if (!quoteId) return;
    (async () => {
      try {
        const { data: quote, error: quoteErr } = await supabase
          .from('quotes')
          .select('*')
          .eq('id', quoteId)
          .maybeSingle();
        if (quoteErr) throw quoteErr;
        if (!quote) return;

        form.reset({
          title: (quote as any).title || '',
          description: (quote as any).description || '',
          service_type: (quote as any).service_type || undefined,
          service_id: (quote as any).service_id || undefined,
          incoterms: (quote as any).incoterms || undefined,
          trade_direction: (quote as any).regulatory_data?.trade_direction || undefined,
          carrier_id: (quote as any).carrier_id || undefined,
          consignee_id: (quote as any).consignee_id || undefined,
          origin_port_id: (quote as any).origin_port_id || undefined,
          destination_port_id: (quote as any).destination_port_id || undefined,
          account_id: (quote as any).account_id ? String((quote as any).account_id) : undefined,
          contact_id: (quote as any).contact_id ? String((quote as any).contact_id) : undefined,
          opportunity_id: (quote as any).opportunity_id ? String((quote as any).opportunity_id) : undefined,
          status: (quote as any).status || 'draft',
          valid_until: (quote as any).valid_until || undefined,
          tax_percent: (quote as any).tax_percent != null ? String((quote as any).tax_percent) : undefined,
          shipping_amount: (quote as any).shipping_amount != null ? String((quote as any).shipping_amount) : undefined,
          terms_conditions: (quote as any).terms_conditions || undefined,
          notes: (quote as any).notes || undefined,
        });
        setSelectedServiceType((quote as any).service_type || '');
        setQuoteNumberPreview((quote as any).quote_number || '—');

        // Load items; tolerate RLS issues by falling back to empty
        const { data: itemsRes, error: itemsErr } = await supabase
          .from('quote_items')
          .select('line_number, product_name, description, quantity, unit_price, discount_percent')
          .eq('quote_id', quoteId)
          .order('line_number', { ascending: true });
        if (!itemsErr && Array.isArray(itemsRes)) {
          setItems(
            itemsRes.map((it: any) => ({
              line_number: it.line_number,
              product_name: it.product_name || '',
              description: it.description || '',
              quantity: Number(it.quantity) || 0,
              unit_price: Number(it.unit_price) || 0,
              discount_percent: Number(it.discount_percent) || 0,
            }))
          );
        }

        // Restore carrier quotes if present
        try {
          const rq = (quote as any).regulatory_data?.carrier_quotes;
          if (Array.isArray(rq)) {
            setCarrierQuotes(
              rq.map((cq: any) => ({
                carrier_id: cq.carrier_id || '',
                mode: cq.mode || (quote as any).service_type || undefined,
                buying_charges: Array.isArray(cq.buying_charges) ? cq.buying_charges : [],
                selling_charges: Array.isArray(cq.selling_charges) ? cq.selling_charges : [],
              }))
            );
          }
        } catch {}
      } catch (err: any) {
        console.error('Failed to load existing quote:', err?.message || err);
        toast.error('Failed to load existing quote', { description: err?.message });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  const fetchData = async () => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;
    if (!tenantId) return;

    try {
      const [servicesRes, carriersRes, consigneesRes, portsRes, accountsRes, contactsRes, opportunitiesRes] = await Promise.all([
        supabase.from('services').select('*').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('carriers').select('*').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('consignees').select('*').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('ports_locations').select('*').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('accounts').select('id, name, tenant_id').eq('tenant_id', tenantId),
        supabase.from('contacts').select('id, first_name, last_name, account_id').eq('tenant_id', tenantId),
        supabase.from('opportunities').select('id, name, account_id, contact_id, tenant_id').eq('tenant_id', tenantId),
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

      // Seed resolved tenant from current context
      setResolvedTenantId(tenantId);

      // If an opportunity is preselected (e.g. via URL), auto-fill account/contact
      try {
        const preselectedOppId = form.getValues('opportunity_id');
        if (preselectedOppId) {
          const opp = (opportunitiesRes.data || []).find((o: any) => String(o.id) === String(preselectedOppId));
          if (opp) {
            if (opp.account_id) form.setValue('account_id', String(opp.account_id), { shouldDirty: true });
            if (opp.contact_id) form.setValue('contact_id', String(opp.contact_id), { shouldDirty: true });
          }
        }
      } catch {}

    } catch (error: any) {
      console.error('Failed to fetch data:', error);
    }
  };

  // Preview next quote number via RPC when context becomes available
  useEffect(() => {
    const tenantId = context.tenantId || roles?.[0]?.tenant_id;
    const franchiseId = context.franchiseId || roles?.[0]?.franchise_id || null;
    if (!tenantId) return;
    // In edit mode, use existing quote number preview and skip RPC
    if (quoteId) return;
    const preview = async () => {
      try {
        const { data, error } = await (supabase as any).rpc('preview_next_quote_number', {
          p_tenant_id: tenantId,
          p_franchise_id: franchiseId,
        });
        if (error) throw error;
        setQuoteNumberPreview(typeof data === 'string' ? data : 'Auto-generated on save');
      } catch (err) {
        // Keep default hint on any error
        console.warn('Preview quote number failed:', err);
      }
    };
    preview();
  }, [context.tenantId, context.franchiseId]);

  // When account changes, clear contact if it no longer belongs to the selected account
  useEffect(() => {
    if (!accountId) return;
    if (!Array.isArray(contacts) || contacts.length === 0) return; // wait until contacts load
    const currentContactId = form.getValues('contact_id');
    const isValid = contacts.some(
      (c: any) => String(c.id) === String(currentContactId) && String(c.account_id) === String(accountId)
    );
    if (!isValid) {
      form.setValue('contact_id', undefined, { shouldDirty: true });
    }
  }, [accountId, contacts]);

  // Resolve tenant from selected account or context
  useEffect(() => {
    let nextTenantId: string | null = context.tenantId || roles?.[0]?.tenant_id || null;
    const acc = accounts.find((a: any) => String(a.id) === String(accountId));
    if (acc?.tenant_id) nextTenantId = acc.tenant_id;
    setResolvedTenantId(nextTenantId);
  }, [accountId, accounts, context.tenantId, roles]);

  // Fetch tenant name for hint when resolved tenant changes
  useEffect(() => {
    (async () => {
      try {
        if (!resolvedTenantId) { setResolvedTenantName(null); return; }
        const { data, error } = await supabase.from('tenants').select('name').eq('id', resolvedTenantId).maybeSingle();
        if (!error) setResolvedTenantName((data as any)?.name ?? null);
      } catch {}
    })();
  }, [resolvedTenantId, supabase]);


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

  // Opportunity selection dialog state
  const [oppDialogOpen, setOppDialogOpen] = useState(false);
  const [accDialogOpen, setAccDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const handleSelectOpportunity = (opp: any) => {
    try {
      if (opp?.id) form.setValue('opportunity_id', String(opp.id), { shouldDirty: true });
      if (opp?.account_id) form.setValue('account_id', String(opp.account_id), { shouldDirty: true });
      if (opp?.contact_id) form.setValue('contact_id', String(opp.contact_id), { shouldDirty: true });
      // Ensure selected opportunity appears in the dropdown options
      setOpportunities((prev) => {
        const exists = prev.some((o: any) => String(o.id) === String(opp.id));
        return exists ? prev : [opp, ...prev];
      });
      // If the dialog provided nested account/contact, ensure they appear in respective dropdowns
      if (opp?.accounts?.id) {
        setAccounts((prev) => {
          const exists = prev.some((a: any) => String(a.id) === String(opp.accounts.id));
          return exists ? prev : [{ id: opp.accounts.id, name: opp.accounts.name || opp.accounts.account_name || 'Account' }, ...prev];
        });
      }
      if (opp?.contacts?.id) {
        setContacts((prev) => {
          const exists = prev.some((c: any) => String(c.id) === String(opp.contacts.id));
          return exists ? prev : [{ id: opp.contacts.id, first_name: opp.contacts.first_name || '', last_name: opp.contacts.last_name || '', account_id: opp.contacts.account_id }, ...prev];
        });
      }
    } catch {}
  };

  const handleSelectAccount = (account: any) => {
    try {
      if (account?.id) form.setValue('account_id', String(account.id), { shouldDirty: true });
      // If currently selected contact does not belong, clear it
      const currentContactId = form.getValues('contact_id');
      const belongs = contacts.some((c: any) => String(c.id) === String(currentContactId) && String(c.account_id) === String(account.id));
      if (!belongs) form.setValue('contact_id', '', { shouldDirty: true });
      setAccounts((prev) => {
        const exists = prev.some((a: any) => String(a.id) === String(account.id));
        return exists ? prev : [account, ...prev];
      });
    } catch {}
  };

  const handleSelectContact = (contact: any) => {
    try {
      if (contact?.id) form.setValue('contact_id', String(contact.id), { shouldDirty: true });
      if (contact?.account_id) form.setValue('account_id', String(contact.account_id), { shouldDirty: true });
      setContacts((prev) => {
        const exists = prev.some((c: any) => String(c.id) === String(contact.id));
        return exists ? prev : [contact, ...prev];
      });
    } catch {}
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
    // Resolve tenant_id from context/role, and fall back to selected account/opportunity
    let tenantId = context.tenantId || roles?.[0]?.tenant_id;
    if (!tenantId && values.account_id) {
      try {
        const { data: acc } = await supabase
          .from('accounts')
          .select('tenant_id')
          .eq('id', values.account_id)
          .maybeSingle();
        tenantId = acc?.tenant_id || tenantId;
      } catch {}
    }
    // As an additional fallback, infer from opportunity if provided
    if (!tenantId && values.opportunity_id) {
      try {
        const { data: opp } = await supabase
          .from('opportunities')
          .select('tenant_id, account_id')
          .eq('id', values.opportunity_id)
          .maybeSingle();
        tenantId = (opp as any)?.tenant_id || tenantId;
        // Backfill account_id from opportunity if missing
        if (!values.account_id && (opp as any)?.account_id) {
          form.setValue('account_id', String((opp as any).account_id), { shouldDirty: true });
        }
      } catch {}
    }
    const franchiseId = context.franchiseId || roles?.[0]?.franchise_id || null;

    if (!tenantId) {
      toast.error('No tenant selected. Please ensure your account is linked to a tenant.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { subtotal, taxAmount, total } = calculateTotals();
      
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

      // Only generate a quote number for new quotes
      let quoteNumber: string | null = null;
      if (!quoteId) {
        const { data: genNumber, error: genError } = await (supabase as any).rpc('generate_quote_number', {
          p_tenant_id: tenantId,
          p_franchise_id: franchiseId,
        });
        quoteNumber = genError || !genNumber ? null : (typeof genNumber === 'string' ? genNumber : String(genNumber));
      }

      const quoteData: any = {
        ...(quoteNumber ? { quote_number: quoteNumber } : {}),
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

      let quote: any = null;
      if (quoteId) {
        const { data: updated, error: updateErr } = await supabase
          .from('quotes')
          .update(quoteData)
          .eq('id', quoteId)
          .select()
          .maybeSingle();
        if (updateErr) throw updateErr;
        quote = updated || { id: quoteId };
      } else {
        const { data: created, error: quoteError } = await supabase
          .from('quotes')
          .insert([quoteData])
          .select()
          .single();
        if (quoteError) throw quoteError;
        quote = created;
      }

      const itemsData = items.map((item) => ({
        quote_id: quote.id,
        ...item,
        line_total: item.quantity * item.unit_price * (1 - item.discount_percent / 100),
      }));

      // Replace existing items on edit; insert on create
      if (quoteId) {
        const { error: delErr } = await supabase
          .from('quote_items')
          .delete()
          .eq('quote_id', quoteId);
        if (delErr) throw delErr;
      }
      const { error: itemsError } = await supabase.from('quote_items').insert(itemsData);

      if (itemsError) throw itemsError;

      toast.success(quoteId ? 'Quote updated successfully' : 'Quote created successfully');
      onSuccess?.(quote.id);
    } catch (error: any) {
      toast.error(error.message || (quoteId ? 'Failed to update quote' : 'Failed to create quote'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Quote Information
              {isEditMode && (
                <span className="ml-2 text-xs text-muted-foreground">Edit Mode</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            {/* Quotation and Opportunity row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quotation Number */}
              <FormItem>
                <FormLabel>Quotation Number</FormLabel>
                <FormDescription>{isEditMode ? 'Existing number' : 'Auto-generated on save'}</FormDescription>
                <FormControl>
                  <Input readOnly value={quoteNumberPreview} />
                </FormControl>
              </FormItem>

              {/* Opportunity Number */}
              <FormField
                control={form.control}
                name="opportunity_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opportunity Number</FormLabel>
                    <FormDescription>Select opportunity</FormDescription>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        const opp = opportunities.find((o) => String(o.id) === value);
                        if (opp) {
                          if (opp.account_id) form.setValue('account_id', String(opp.account_id), { shouldDirty: true });
                          if (opp.contact_id) form.setValue('contact_id', String(opp.contact_id), { shouldDirty: true });
                        }
                      }} 
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select opportunity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {opportunities.map((opp) => (
                          <SelectItem key={opp.id} value={String(opp.id)}>
                            {opp.name}
                          </SelectItem>
                        ))}
                        {opportunities.length === 0 && (
                          <SelectItem disabled value="__no_opportunities__">No opportunities found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <div className="mt-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setOppDialogOpen(true)}>
                        <Search className="h-4 w-4 mr-2" /> Browse opportunities
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="account_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account</FormLabel>
                      <FormDescription>Select account</FormDescription>
                      <Select onValueChange={(v) => field.onChange(v)} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.name}
                            </SelectItem>
                          ))}
                          {accounts.length === 0 && (
                            <SelectItem disabled value="__no_accounts__">No accounts found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <div className="mt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setAccDialogOpen(true)}>
                          <Search className="h-4 w-4 mr-2" /> Browse accounts
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {resolvedTenantId ? (
                          <>Tenant: {resolvedTenantName ?? 'Resolving…'}</>
                        ) : (
                          <>Tenant: Not resolved</>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Quotation Number moved above next to Opportunity */}
              </div>

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="contact_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact</FormLabel>
                      <FormDescription>Select contact</FormDescription>
                      <Select onValueChange={(v) => field.onChange(v)} value={field.value ?? ''}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select contact" />
                          </SelectTrigger>
                        </FormControl>
                      <SelectContent>
                          {(accountId ? contacts.filter((c: any) => String(c.account_id) === String(accountId)) : contacts).map((contact) => (
                            <SelectItem key={contact.id} value={String(contact.id)}>
                              {contact.first_name} {contact.last_name}
                            </SelectItem>
                          ))}
                          {contacts.length === 0 && (
                            <SelectItem disabled value="__no_contacts__">No contacts found</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <div className="mt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setContactDialogOpen(true)}>
                          <Search className="h-4 w-4 mr-2" /> Browse contacts
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Opportunity field moved above next to Quotation */}

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
                      value={field.value ?? ''}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full" disabled={isEditMode}>
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
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
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
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
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
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
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
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
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
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
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
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
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
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger className="w-full">
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
                        <SelectTrigger className="w-full">
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
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

        {/* Opportunity selection dialog */}
        <OpportunitySelectDialogList
          open={oppDialogOpen}
          onOpenChange={setOppDialogOpen}
          onSelect={handleSelectOpportunity}
        />

        {/* Account selection dialog */}
        <AccountSelectDialogList
          open={accDialogOpen}
          onOpenChange={setAccDialogOpen}
          onSelect={handleSelectAccount}
        />

        {/* Contact selection dialog */}
        <ContactSelectDialogList
          open={contactDialogOpen}
          onOpenChange={setContactDialogOpen}
          onSelect={handleSelectContact}
        />

        {/* Sticky totals footer for mobile */}
        {typeof window !== 'undefined' && (localStorage.getItem('quoteStickyTotalsVisible') ?? 'true') === 'true' && (
          <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4" data-sticky-totals>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium">${calculateTotals().subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span className="font-medium">${calculateTotals().taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>${calculateTotals().total.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={(e) => { localStorage.setItem('quoteStickyTotalsVisible', 'false'); const wrapper = (e.currentTarget.closest('[data-sticky-totals]') as HTMLElement | null); if (wrapper) wrapper.remove(); }}>Dismiss</Button>
                <Button type="submit" disabled={isSubmitting} size="sm">
                  {isSubmitting ? 'Creating...' : 'Create Quote'}
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Sticky totals footer for tablet (md to xl) */}
        {typeof window !== 'undefined' && (localStorage.getItem('quoteStickyTotalsVisible') ?? 'true') === 'true' && (
        <div className="hidden md:block 2xl:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4" data-sticky-totals>
          <div className="flex items-center justify-between gap-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium">${calculateTotals().subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="font-medium">${parseFloat(form.watch('shipping_amount') || '0').toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="font-medium">${calculateTotals().taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>${calculateTotals().total.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" onClick={(e) => { localStorage.setItem('quoteStickyTotalsVisible', 'false'); const wrapper = (e.currentTarget.closest('[data-sticky-totals]') as HTMLElement | null); if (wrapper) wrapper.remove(); }}>Dismiss</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Quote'}
            </Button>
            </div>
          </div>
        </div>
        )}
      </form>
    </Form>
  );
}
