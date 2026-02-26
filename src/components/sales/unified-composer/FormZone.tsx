import { useState, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { QuoteComposerValues } from './schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Plane, Ship, Truck, Train, Timer, Sparkles, ChevronDown, Save, Settings2, Building2, User, FileText, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { LocationAutocomplete } from '@/components/common/LocationAutocomplete';
import { SharedCargoInput } from '@/components/sales/shared/SharedCargoInput';
import { CommoditySelection } from '@/components/logistics/SmartCargoInput';
import { CargoItem } from '@/types/cargo';
import { useContainerRefs } from '@/hooks/useContainerRefs';
import { useIncoterms } from '@/hooks/useIncoterms';
import { carrierValidationMessages } from '@/lib/mode-utils';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { useToast } from '@/hooks/use-toast';
import { useCRM } from '@/hooks/useCRM';
import { logger } from '@/lib/logger';
import { QuotationNumberService } from '@/services/quotation/QuotationNumberService';

export type FormZoneValues = QuoteComposerValues;

export interface ExtendedFormData {
  containerType: string;
  containerSize: string;
  containerQty: string;
  containerCombos: Array<{ type: string; size: string; qty: number }>;
  htsCode: string;
  aes_hts_id: string;
  scheduleB: string;
  dims: string;
  dangerousGoods: boolean;
  specialHandling: string;
  vehicleType: string;
  pickupDate: string;
  deliveryDeadline: string;
  incoterms: string;
  originDetails: any;
  destinationDetails: any;
}

const DEFAULT_EXTENDED: ExtendedFormData = {
  containerType: '',
  containerSize: '',
  containerQty: '1',
  containerCombos: [],
  htsCode: '',
  aes_hts_id: '',
  scheduleB: '',
  dims: '',
  dangerousGoods: false,
  specialHandling: '',
  vehicleType: 'van',
  pickupDate: '',
  deliveryDeadline: '',
  incoterms: '',
  originDetails: null,
  destinationDetails: null,
};

interface FormZoneProps {
  onGetRates: (formValues: FormZoneValues, extendedData: ExtendedFormData, smartMode: boolean) => void;
  onSaveDraft?: () => void;
  loading?: boolean;
  crmLoading?: boolean;
  initialValues?: Partial<FormZoneValues>;
  initialExtended?: Partial<ExtendedFormData>;
  accounts?: any[];
  contacts?: any[];
  opportunities?: any[];
  onChange?: (values: any) => void;
}

export function FormZone({ 
  onGetRates, 
  onSaveDraft, 
  loading = false, 
  crmLoading = false,
  initialValues, 
  initialExtended,
  accounts = [],
  contacts = [],
  opportunities = [],
  onChange
}: FormZoneProps) {
  const [smartMode, setSmartMode] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [carriers, setCarriers] = useState<{ id: string; carrier_name: string; carrier_type: string }[]>([]);

  const { containerTypes, containerSizes } = useContainerRefs();
  const { incoterms, loading: incLoading } = useIncoterms();
  const { invokeAiAdvisor } = useAiAdvisor();
  const { toast } = useToast();
  const { supabase, scopedDb, context } = useCRM();

  const form = useFormContext<QuoteComposerValues>();

  const quoteNumber = form.watch('quoteNumber' as any);
  const [availability, setAvailability] = useState<'loading' | 'available' | 'unavailable' | null>(null);
  const standalone = form.watch('standalone' as any);

  useEffect(() => {
    if (!quoteNumber) {
      setAvailability(null);
      return;
    }
    setAvailability('loading');
    const timer = setTimeout(async () => {
      try {
        const isUnique = await QuotationNumberService.isUnique(scopedDb, context.tenantId || '', quoteNumber);
        setAvailability(isUnique ? 'available' : 'unavailable');
      } catch (err) {
        setAvailability('unavailable');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [quoteNumber, scopedDb, context?.tenantId]);

  const onOpportunityChange = (opportunityId: string | undefined) => {
    form.setValue('opportunityId' as any, opportunityId || '');
    if (!opportunityId) {
        // Optional: Clear account/contact if opportunity is cleared?
        // Usually better to keep them if user just wants to unlink opportunity but keep context.
        return;
    }
    
    const opp = opportunities.find(o => o.id === opportunityId);
    if (opp) {
      // 1. Set Account
      if (opp.account_id) {
        form.setValue('accountId' as any, opp.account_id);
      }
      
      // 2. Set Contact
      // Prefer the contact explicitly linked to the opportunity
      if (opp.contact_id) {
         form.setValue('contactId' as any, opp.contact_id);
      } else if (opp.account_id) {
         // Fallback: Try to find a contact for this account
         const related = contacts.filter(c => c.account_id === opp.account_id);
         if (related.length === 1) {
             // Single contact found - auto-select
             form.setValue('contactId' as any, related[0].id);
         } else {
             // Multiple or no contacts - clear to force user selection
             form.setValue('contactId' as any, '');
         }
      } else {
          // No account linked - clear contact
          form.setValue('contactId' as any, '');
      }
    }
  };

  // Propagate changes
  useEffect(() => {
    const subscription = form.watch((value) => {
      onChange?.(value);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, onChange]);

  const mode = form.watch('mode');
  const commodity = form.watch('commodity');
  const origin = form.watch('origin');
  const destination = form.watch('destination');
  const accountId = form.watch('accountId' as any);

  const filteredContacts = useMemo(() => {
    if (!accountId) return contacts;
    return contacts.filter(c => c.account_id === accountId);
  }, [contacts, accountId]);

  // Sync initial values to form context
  useEffect(() => {
    if (initialValues) {
      Object.entries(initialValues).forEach(([key, value]) => {
        if (value !== undefined) form.setValue(key as any, value);
      });
    }
    if (initialExtended) {
      Object.entries(initialExtended).forEach(([key, value]) => {
        if (value !== undefined) form.setValue(key as any, value);
      });
    }
  }, [initialValues, initialExtended, form]);

  // Auto-expand "More options" if optional fields are populated (edit mode)
  useEffect(() => {
    if (initialExtended) {
      const hasOptionalData =
        initialExtended.htsCode ||
        initialExtended.pickupDate ||
        initialExtended.deliveryDeadline ||
        initialExtended.incoterms ||
        initialExtended.dangerousGoods ||
        initialExtended.specialHandling;
      if (hasOptionalData) setMoreOpen(true);
    }
  }, [initialExtended]);

  // Load carriers
  useEffect(() => {
    const loadCarriers = async () => {
      try {
        const { data: carrierData } = await supabase
          .from('carriers')
          .select('id, carrier_name, carrier_type, tenant_id')
          .eq('is_active', true)
          .order('carrier_name');

        // Deduplicate by name, preferring tenant-specific
        const map: Record<string, any> = {};
        for (const item of carrierData || []) {
          const key = String(item.carrier_name || '').trim().toLowerCase();
          if (!key) continue;
          const existing = map[key];
          if (!existing) {
            map[key] = item;
          } else if (context?.tenantId && existing.tenant_id !== context.tenantId && item.tenant_id === context.tenantId) {
            map[key] = item;
          }
        }
        setCarriers(Object.values(map));
      } catch (e) {
        logger.error('Failed to load carriers', e);
      }
    };
    loadCarriers();
  }, [supabase]);

  const filteredCarriers = useMemo(() => {
    const modeMap: Record<string, string> = { ocean: 'ocean', air: 'air_cargo', road: 'trucking', rail: 'rail' };
    return carriers
      .filter(c => !mode || c.carrier_type === modeMap[mode])
      .map(c => ({ id: c.id, name: c.carrier_name }));
  }, [carriers, mode]);

  // Reset results on mode change
  useEffect(() => {
    form.clearErrors();
  }, [mode]);

  // Cargo item for SharedCargoInput
  const [cargoItem, setCargoItem] = useState<CargoItem>({
    id: '1',
    type: 'container',
    quantity: 1,
    dimensions: { l: 0, w: 0, h: 0, unit: 'cm' },
    weight: { value: 0, unit: 'kg' },
    stackable: false,
    containerDetails: { typeId: '', sizeId: '' },
  });

  // Sync CargoItem → form/extended
  useEffect(() => {
    if (cargoItem.commodity?.description) {
      form.setValue('commodity', cargoItem.commodity.description);
    }
    form.setValue('dangerousGoods', !!cargoItem.hazmat);

    if (mode === 'ocean' || mode === 'rail') {
      if (cargoItem.type === 'container') {
        let combos: Array<{ type: string; size: string; qty: number }> = [];
        if (cargoItem.containerCombos && cargoItem.containerCombos.length > 0) {
          combos = cargoItem.containerCombos.map(c => ({ type: c.typeId, size: c.sizeId, qty: c.quantity }));
        } else if (cargoItem.containerDetails?.typeId && cargoItem.containerDetails?.sizeId) {
          combos = [{ type: cargoItem.containerDetails.typeId, size: cargoItem.containerDetails.sizeId, qty: cargoItem.quantity }];
        }
        if (combos.length > 0) {
          form.setValue('containerType', combos[0].type);
          form.setValue('containerSize', combos[0].size);
          form.setValue('containerQty', String(cargoItem.quantity));
        }
      }
    } else {
      form.setValue('weight', String(cargoItem.weight.value));
      form.setValue('volume', String(cargoItem.volume || 0));
      form.setValue('containerQty', String(cargoItem.quantity));
    }
  }, [cargoItem, mode]);

  const handleLocationChange = (field: 'origin' | 'destination', value: string, location?: any) => {
    form.setValue(field, value);
    // Note: originDetails/destinationDetails are not currently in schema but could be added
  };

  const handleCommoditySelect = (selection: CommoditySelection) => {
    const displayValue = selection.hts_code ? `${selection.description} - ${selection.hts_code}` : selection.description;
    form.setValue('commodity', displayValue);
    if (selection.hts_code) form.setValue('htsCode', selection.hts_code);
  };

  const handleAiSuggest = async () => {
    if (!commodity || commodity.length < 3) return;
    try {
      const [unitRes, classRes] = await Promise.all([
        invokeAiAdvisor({ action: 'suggest_unit', payload: { commodity } }),
        invokeAiAdvisor({ action: 'classify_commodity', payload: { commodity } }),
      ]);
      if (unitRes.data?.unit) {
        form.setValue('unit', unitRes.data.unit);
      }
      if (classRes.data?.hts) {
        form.setValue('htsCode', classRes.data.hts);
        toast({ title: 'AI Analysis Complete', description: `Classified as ${classRes.data.type} (HTS: ${classRes.data.hts})` });
      }
    } catch (err) {
      logger.error('AI Suggest Error', err);
    }
  };

  const onSubmit = (data: QuoteComposerValues) => {
    // Pass everything in data to onGetRates
    onGetRates(data as any, data as any, smartMode);
  };

  return (
    <div className="bg-muted/30 border rounded-lg p-6">
      <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          logger.error('Form Errors:', errors);
          const firstError = Object.values(errors)[0];
          const message = (firstError as any)?.message || 'Please fix the highlighted fields.';
          toast({ title: 'Validation Error', description: String(message), variant: 'destructive' });
        })} className="space-y-5">
        
        {/* General Information */}
        <Card className={`border ${standalone ? 'border-amber-300' : 'border-blue-300'} bg-muted/10`}>
          <CardContent className="p-4 grid grid-cols-1 gap-4">
            <div className="flex items-center justify-between p-3 rounded-md border bg-background">
              <Label className="text-xs">{standalone ? 'Standalone Mode' : 'CRM-Linked Mode'}</Label>
              <Switch
                id="standalone-mode"
                checked={!!standalone}
                onCheckedChange={(checked) => {
                  form.setValue('standalone' as any, checked);
                }}
              />
            </div>

            {!standalone && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name={"opportunityId" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5" /> Opportunity
                  </FormLabel>
                  <Select onValueChange={(val) => onOpportunityChange(val)} value={field.value} disabled={crmLoading}>
                    <FormControl>
                      <SelectTrigger className="bg-background h-9 text-xs">
                        <SelectValue placeholder={crmLoading ? "Loading opportunities..." : "Select Opportunity"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {opportunities.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={"accountId" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-xs">
                    <Building2 className="h-3.5 w-3.5" /> Account
                  </FormLabel>
                  <Select onValueChange={(v) => {
                    field.onChange(v);
                    const related = contacts.filter(c => c.account_id === v);
                    // Only auto-select if there is exactly one contact
                    if (related.length === 1) {
                      form.setValue('contactId' as any, related[0].id);
                    } else {
                      form.setValue('contactId' as any, '');
                    }
                  }} value={field.value} disabled={crmLoading}>
                    <FormControl>
                      <SelectTrigger className="bg-background h-9 text-xs">
                        <SelectValue placeholder={crmLoading ? "Loading accounts..." : "Select Customer"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.length === 0 ? (
                        <SelectItem value="none" disabled>No accounts found</SelectItem>
                      ) : (
                        accounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={"contactId" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-xs">
                    <User className="h-3.5 w-3.5" /> Contact
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!accountId || crmLoading}>
                    <FormControl>
                      <SelectTrigger className="bg-background h-9 text-xs">
                        <SelectValue placeholder={crmLoading ? "Loading contacts..." : "Select Contact"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredContacts.length === 0 ? (
                        <SelectItem value="none" disabled>No contacts found</SelectItem>
                      ) : (
                        filteredContacts.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
                  control={form.control}
                  name={"quoteTitle" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-xs">
                        <FileText className="h-3.5 w-3.5" /> Quote Reference
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Q3 Shipment" className="bg-background h-9 text-xs" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            {standalone && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={"guestCompany" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Company Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Acme Corp" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"taxId" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Tax ID / VAT</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Tax Identification Number" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator className="my-2" />
                <Label className="text-xs font-semibold">Primary Contact</Label>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name={"guestName" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Full Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John Doe" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"guestEmail" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Email Address *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="john@example.com" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"guestPhone" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Phone Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+1 234 567 8900" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"guestJobTitle" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Job Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Manager" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"guestDepartment" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Department</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Logistics" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator className="my-2" />
                <Label className="text-xs font-semibold">Billing Address</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <FormField
                    control={form.control}
                    name={"billingAddress.street" as any}
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel className="text-xs">Street Address *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="123 Main St" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"billingAddress.city" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">City *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="New York" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"billingAddress.state" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">State / Province</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="NY" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"billingAddress.postalCode" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Postal Code</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="10001" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"billingAddress.country" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Country *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="USA" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Collapsible>
                  <CollapsibleTrigger asChild>
                     <Button variant="ghost" size="sm" className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground">
                        <ChevronDown className="h-3 w-3 mr-1" /> Add Shipping Address (if different)
                     </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-4">
                     <Label className="text-xs font-semibold">Shipping Address</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={"shippingAddress.street" as any}
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel className="text-xs">Street Address</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="123 Main St" className="bg-background h-9 text-xs" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={"shippingAddress.city" as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">City</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="New York" className="bg-background h-9 text-xs" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={"shippingAddress.state" as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">State / Province</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="NY" className="bg-background h-9 text-xs" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={"shippingAddress.postalCode" as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Postal Code</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="10001" className="bg-background h-9 text-xs" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={"shippingAddress.country" as any}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Country</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="USA" className="bg-background h-9 text-xs" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                  </CollapsibleContent>
                </Collapsible>
                
                <Separator className="my-2" />
                <Label className="text-xs font-semibold">References</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name={"customerPo" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Customer PO</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="PO-12345" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"vendorRef" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Vendor Reference</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"projectCode" as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Project Code</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional" className="bg-background h-9 text-xs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
            <FormField
              control={form.control}
              name={"quoteNumber" as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5" /> Quote Number (Manual Override)
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input {...field} placeholder="Auto-generated if left blank" className="bg-background h-9 text-xs pr-8" />
                      {availability === 'loading' && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                      {availability === 'available' && <CheckCircle2 className="absolute right-2 top-2.5 h-4 w-4 text-green-500" />}
                      {availability === 'unavailable' && <XCircle className="absolute right-2 top-2.5 h-4 w-4 text-destructive" />}
                    </div>
                  </FormControl>
                  {availability === 'unavailable' && <p className="text-[10px] text-destructive mt-1">This number is already taken.</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
            {standalone && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name={"termsConditions" as any}
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-xs">Terms & Conditions</FormLabel>
                      <FormControl>
                        <textarea {...field} placeholder="Enter terms and conditions" className="bg-background text-xs p-2 rounded-md border h-24 w-full" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={"internalNotes" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Internal Notes</FormLabel>
                      <FormControl>
                        <textarea {...field} placeholder="Internal comments (not visible to customer)" className="bg-background text-xs p-2 rounded-md border h-24 w-full" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={"specialInstructions" as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Special Instructions</FormLabel>
                      <FormControl>
                        <textarea {...field} placeholder="Special handling instructions" className="bg-background text-xs p-2 rounded-md border h-24 w-full" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Smart Mode Toggle */}
        <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/30 p-3 rounded-md border border-purple-100 dark:border-purple-900">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-purple-900 dark:text-purple-200">Smart Quote Mode</span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400">AI-optimized routes & pricing</span>
            </div>
          </div>
          <Switch checked={smartMode} onCheckedChange={setSmartMode} data-testid="smart-mode-switch" />
        </div>

        {/* Mode Tabs */}
        <div className="space-y-2">
          <Label>Transport Mode</Label>
          <Tabs value={mode} onValueChange={(v) => form.setValue('mode', v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="ocean"><Ship className="w-4 h-4 mr-1" />Ocean</TabsTrigger>
              <TabsTrigger value="air"><Plane className="w-4 h-4 mr-1" />Air</TabsTrigger>
              <TabsTrigger value="road"><Truck className="w-4 h-4 mr-1" />Road</TabsTrigger>
              <TabsTrigger value="rail"><Train className="w-4 h-4 mr-1" />Rail</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Origin / Destination */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex justify-between">
              Origin
              {form.formState.errors.origin && <span className="text-destructive text-xs">{form.formState.errors.origin.message}</span>}
            </Label>
            <LocationAutocomplete
              data-testid="location-origin"
              placeholder="Search origin..."
              value={origin}
              onChange={(value, location) => handleLocationChange('origin', value, location)}
            />
            <input type="hidden" {...form.register('origin')} />
          </div>
          <div className="space-y-2">
            <Label className="flex justify-between">
              Destination
              {form.formState.errors.destination && <span className="text-destructive text-xs">{form.formState.errors.destination.message}</span>}
            </Label>
            <LocationAutocomplete
              data-testid="location-destination"
              placeholder="Search destination..."
              value={destination}
              onChange={(value, location) => handleLocationChange('destination', value, location)}
            />
            <input type="hidden" {...form.register('destination')} />
          </div>
        </div>

        {/* Commodity & Cargo */}
        <div className="space-y-2">
          <Label className="flex justify-between">
            <span>Commodity & Cargo {form.formState.errors.commodity && <span className="text-destructive text-xs ml-2">{form.formState.errors.commodity.message}</span>}</span>
            <button type="button" onClick={handleAiSuggest} className="text-xs text-primary flex items-center gap-1 hover:underline">
              <Sparkles className="w-3 h-3" /> AI Analyze
            </button>
          </Label>
          <SharedCargoInput value={cargoItem} onChange={setCargoItem} errors={form.formState.errors as any} />
          <input type="hidden" {...form.register('commodity')} />
        </div>

        {/* Road-specific fields */}
        {mode === 'road' && (
          <div className="space-y-2 p-3 border rounded-md bg-background">
            <Label className="text-xs">Vehicle Type</Label>
            <Select value={form.watch('vehicleType')} onValueChange={(v) => form.setValue('vehicleType', v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="van">Dry Van</SelectItem>
                <SelectItem value="flatbed">Flatbed</SelectItem>
                <SelectItem value="reefer">Reefer Truck</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Carrier Preferences */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Preferred Carriers (Optional)</Label>
            {filteredCarriers.length > 0 && (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                {filteredCarriers.length} carriers
              </Badge>
            )}
          </div>
          {mode && filteredCarriers.length === 0 && (
            <p className="text-xs text-muted-foreground">{carrierValidationMessages.noPreferredCarriersForMode(mode)}</p>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-between text-left font-normal h-9 bg-background">
                <span className="truncate">
                  {(form.watch('preferredCarriers')?.length ?? 0) > 0
                    ? `${form.watch('preferredCarriers')?.length} Selected`
                    : 'Any Carrier'}
                </span>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>Select Carriers</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filteredCarriers.map(carrier => {
                const current = form.watch('preferredCarriers') || [];
                const isSelected = current.includes(carrier.name);
                return (
                  <DropdownMenuCheckboxItem
                    key={carrier.id}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      form.setValue('preferredCarriers', checked ? [...current, carrier.name] : current.filter(c => c !== carrier.name));
                    }}
                  >
                    {carrier.name}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Collapsible "More Options" */}
        <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="w-full justify-between text-sm text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-1"><Settings2 className="w-3.5 h-3.5" /> More Options</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-2">
            {/* Incoterms */}
            <div className="space-y-2">
              <Label className="text-xs">Incoterms</Label>
              <Select value={form.watch('incoterms')} onValueChange={(v) => form.setValue('incoterms', v)}>
                <SelectTrigger><SelectValue placeholder="Select Incoterms (Optional)" /></SelectTrigger>
                <SelectContent>
                  {incLoading ? (
                    <SelectItem value="__loading" disabled>Loading...</SelectItem>
                  ) : incoterms.length === 0 ? (
                    <SelectItem value="__empty" disabled>No Incoterms available</SelectItem>
                  ) : (
                    incoterms.map(t => (
                      <SelectItem key={t.id} value={t.incoterm_code}>{t.incoterm_code} - {t.incoterm_name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Timing */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Pickup Date</Label>
                <Input type="date" value={form.watch('pickupDate')} onChange={(e) => form.setValue('pickupDate', e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delivery Deadline</Label>
                <Input type="date" value={form.watch('deliveryDeadline')} onChange={(e) => form.setValue('deliveryDeadline', e.target.value)} className="h-8 text-xs" />
              </div>
            </div>

            {/* Customs & Compliance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">HTS Code</Label>
                <Input value={form.watch('htsCode')} onChange={(e) => form.setValue('htsCode', e.target.value)} className="h-8 text-xs" placeholder="AI Suggested" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dangerous Goods</Label>
                <div className="flex items-center space-x-2">
                  <Switch checked={form.watch('dangerousGoods')} onCheckedChange={(v) => form.setValue('dangerousGoods', v)} />
                  <Label className="text-xs font-normal">Yes</Label>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Action Row */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" className="flex-1" disabled={loading} data-testid="get-rates-btn">
            {loading ? (
              <><Timer className="w-4 h-4 mr-2 animate-spin" /> Calculating...</>
            ) : (
              smartMode ? 'Get Rates (AI Enhanced)' : 'Get Rates'
            )}
          </Button>
          {onSaveDraft && (
            <Button type="button" variant="outline" onClick={onSaveDraft} disabled={loading}>
              <Save className="w-4 h-4 mr-1" /> Draft
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
