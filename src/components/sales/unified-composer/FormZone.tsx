import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { Plane, Ship, Truck, Train, Timer, Sparkles, ChevronDown, Save, Settings2, Building2, User, FileText, Loader2, CheckCircle2, XCircle, Paperclip, File as FileIcon, X, AlertCircle } from 'lucide-react';
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
import { useQuoteStore } from '@/components/sales/composer/store/QuoteStore';
import { logger } from '@/lib/logger';
import { QuotationNumberService } from '@/services/quotation/QuotationNumberService';
import { FileUpload } from '@/components/ui/file-upload';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';

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
  attachments: any[]; // New field
  cargoItem?: CargoItem | null;
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
  attachments: [],
  cargoItem: null,
};

const formatCommodityDisplay = (commodity?: { description?: string; hts_code?: string }) => {
  if (!commodity) return '';
  const description = (commodity.description || '').trim();
  const htsCode = (commodity.hts_code || '').trim();
  if (description && htsCode) {
    return `${description} - ${htsCode}`;
  }
  if (description) return description;
  return htsCode;
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
  onOpenSmartSettings?: () => void;
  onEnterComposerMode?: () => void;
  onValidationFailed?: () => void;
  smartMode?: boolean;
  onSmartModeChange?: (enabled: boolean) => void;
  showExecutionControls?: boolean;
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
  onChange,
  onOpenSmartSettings,
  onEnterComposerMode,
  onValidationFailed,
  smartMode: controlledSmartMode,
  onSmartModeChange,
  showExecutionControls = true,
}: FormZoneProps) {
  const [internalSmartMode, setInternalSmartMode] = useState(false);
  const smartMode = controlledSmartMode ?? internalSmartMode;
  const setSmartMode = useCallback((enabled: boolean) => {
    onSmartModeChange?.(enabled);
    if (controlledSmartMode === undefined) {
      setInternalSmartMode(enabled);
    }
  }, [controlledSmartMode, onSmartModeChange]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [carriers, setCarriers] = useState<{ id: string; carrier_name: string; carrier_type: string }[]>([]);

  const { containerTypes, containerSizes } = useContainerRefs();
  const { incoterms, loading: incLoading } = useIncoterms();
  const { invokeAiAdvisor } = useAiAdvisor();
  const { toast } = useToast();
  const { supabase, scopedDb, context } = useCRM();
  const { state: { referenceData } } = useQuoteStore();
  const ports = referenceData.ports || [];

  const form = useFormContext<QuoteComposerValues>();

  const getFieldError = useCallback((path: string) => {
    const keys = path.split('.');
    let current: any = form.formState.errors;
    for (const key of keys) {
      if (!current || typeof current !== 'object') return null;
      current = current[key];
    }
    return current || null;
  }, [form.formState.errors]);

  const hasFieldError = useCallback((...paths: string[]) => {
    return paths.some((path) => !!getFieldError(path));
  }, [getFieldError]);

  const getFieldErrorMessage = useCallback((...paths: string[]) => {
    for (const path of paths) {
      const message = getFieldError(path)?.message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
    return '';
  }, [getFieldError]);

  const [cargoItem, setCargoItem] = useState<CargoItem>({
    id: '1',
    type: 'container',
    quantity: 1,
    dimensions: { l: 0, w: 0, h: 0, unit: 'cm' },
    weight: { value: 0, unit: 'kg' },
    stackable: false,
    containerDetails: { typeId: '', sizeId: '' },
  });

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
        const isUnique = await QuotationNumberService.isUnique(supabase, context.tenantId || '', quoteNumber);
        setAvailability(isUnique ? 'available' : 'unavailable');
      } catch (err) {
        setAvailability('unavailable');
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [quoteNumber, supabase, context?.tenantId]);

  const onOpportunityChange = (opportunityId: string | undefined) => {
    form.setValue('opportunityId' as any, opportunityId || '', { shouldValidate: true, shouldDirty: true });
    if (!opportunityId) {
        // Optional: Clear account/contact if opportunity is cleared?
        // Usually better to keep them if user just wants to unlink opportunity but keep context.
        return;
    }
    
    const opp = opportunities.find(o => o.id === opportunityId);
    if (opp) {
      // 1. Set Account
      if (opp.account_id) {
        form.setValue('accountId' as any, opp.account_id, { shouldValidate: true, shouldDirty: true });
      }
      
      // 2. Set Contact
      // Prefer the contact explicitly linked to the opportunity
      if (opp.contact_id) {
         form.setValue('contactId' as any, opp.contact_id, { shouldValidate: true, shouldDirty: true });
      } else if (opp.account_id) {
         // Fallback: Try to find a contact for this account
         const related = contacts.filter(c => c.account_id === opp.account_id);
         if (related.length === 1) {
             // Single contact found - auto-select
             form.setValue('contactId' as any, related[0].id, { shouldValidate: true, shouldDirty: true });
         } else {
             // Multiple or no contacts - clear to force user selection
             form.setValue('contactId' as any, '', { shouldValidate: true, shouldDirty: true });
         }
      } else {
          // No account linked - clear contact
          form.setValue('contactId' as any, '', { shouldValidate: true, shouldDirty: true });
      }
    }
  };

  useEffect(() => {
    if (!onChange) return;
    const subscription = form.watch((value) => {
      onChange?.(value);
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  const mode = form.watch('mode');
  const commodity = form.watch('commodity');
  const origin = form.watch('origin');
  const destination = form.watch('destination');
  const accountId = form.watch('accountId' as any);
  const initialDataKey = useMemo(
    () => JSON.stringify({ initialValues: initialValues ?? null, initialExtended: initialExtended ?? null }),
    [initialValues, initialExtended]
  );
  const appliedInitialDataKeyRef = useRef<string | null>(null);
  const cargoInitDataKeyRef = useRef<string | null>(null);

  const filteredContacts = useMemo(() => {
    if (!accountId) return contacts;
    return contacts.filter(c => c.account_id === accountId);
  }, [contacts, accountId]);

  // Sync initial values to form context and local cargoItem state
  useEffect(() => {
    if (!initialValues && !initialExtended) return;
    if (appliedInitialDataKeyRef.current === initialDataKey) return;
    
    form.reset({
      ...form.getValues(),
      ...(initialValues || {}),
      ...(initialExtended || {}),
    } as any);
    appliedInitialDataKeyRef.current = initialDataKey;
  }, [initialValues, initialExtended, initialDataKey]);

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

  // Cargo item for SharedCargoInput (State moved to top)

  // Initialize CargoItem from props
  useEffect(() => {
    if (appliedInitialDataKeyRef.current !== initialDataKey) return;
    if (cargoInitDataKeyRef.current === initialDataKey) return;
    const initialCargo = initialExtended?.cargoItem;
    if (initialCargo && typeof initialCargo === 'object') {
      setCargoItem({
        id: initialCargo.id || 'main',
        type: initialCargo.type || 'loose',
        quantity: Number(initialCargo.quantity) > 0 ? Number(initialCargo.quantity) : 1,
        weight: {
          value: Number(initialCargo.weight?.value) || 0,
          unit: initialCargo.weight?.unit === 'lb' ? 'lb' : 'kg',
        },
        volume: Number(initialCargo.volume) || 0,
        dimensions: {
          l: Number(initialCargo.dimensions?.l) || 0,
          w: Number(initialCargo.dimensions?.w) || 0,
          h: Number(initialCargo.dimensions?.h) || 0,
          unit: initialCargo.dimensions?.unit === 'in' ? 'in' : 'cm',
        },
        commodity: initialCargo.commodity,
        hazmat: initialCargo.hazmat,
        containerCombos: initialCargo.containerCombos || [],
        containerDetails: initialCargo.containerDetails,
        stackable: !!initialCargo.stackable,
      });
    } else {
      const effectiveMode = (initialValues?.mode ?? form.getValues('mode')) as any;
      const initialQty = Number(initialExtended?.containerQty || 1);
      const safeQty = Number.isFinite(initialQty) && initialQty > 0 ? initialQty : 1;
      const initialWeight = Number(initialValues?.weight || 0);
      const initialVolume = Number(initialValues?.volume || 0);
      setCargoItem({
        id: 'main',
        type: effectiveMode === 'ocean' || effectiveMode === 'rail' ? 'container' : 'loose',
        quantity: safeQty,
        weight: { value: Number.isFinite(initialWeight) ? initialWeight : 0, unit: 'kg' },
        volume: Number.isFinite(initialVolume) ? initialVolume : 0,
        dimensions: { l: 0, w: 0, h: 0, unit: 'cm' },
        commodity: initialValues?.commodity ? {
          description: initialValues.commodity,
          hts_code: initialExtended?.htsCode || ''
        } : undefined,
        hazmat: (initialExtended?.dangerousGoods || initialValues?.dangerousGoods) ? {
          class: '',
          unNumber: '',
          packingGroup: 'II'
        } : undefined,
        containerCombos: initialExtended?.containerCombos
          ? (initialExtended.containerCombos as any[]).map((c: any) => ({
              typeId: c.type,
              sizeId: c.size,
              quantity: c.qty,
            }))
          : [],
        containerDetails: undefined,
        stackable: false
      });
    }
    cargoInitDataKeyRef.current = initialDataKey;
  }, [initialValues, initialExtended, initialDataKey]);

  // Sync CargoItem → form/extended
  useEffect(() => {
    // Sync commodity description to form, but avoid clearing a valid form value
    // during unrelated cargo updates (e.g. container combo changes).
    const displayValue = formatCommodityDisplay(cargoItem.commodity);

    const currentValue = form.getValues('commodity');
    if (displayValue && currentValue !== displayValue) {
      form.setValue('commodity', displayValue, { shouldValidate: true, shouldDirty: true });
    }
    
    // Sync HTS code if available
    if (cargoItem.commodity?.hts_code) {
        form.setValue('htsCode', cargoItem.commodity.hts_code, { shouldValidate: true, shouldDirty: true });
    }

    form.setValue('dangerousGoods', !!cargoItem.hazmat, { shouldDirty: true });
    form.setValue('cargoItem' as any, cargoItem as any, { shouldDirty: true });

    // Weight/volume are entered in SharedCargoInput for all modes, so keep form values synced always.
    form.setValue('weight', String(cargoItem.weight.value || 0), { shouldValidate: true, shouldDirty: true });
    form.setValue('volume', String(cargoItem.volume || 0), { shouldValidate: true, shouldDirty: true });

    if (mode === 'ocean' || mode === 'rail') {
      if (cargoItem.type === 'container') {
        let combos: Array<{ type: string; size: string; qty: number }> = [];
        if (cargoItem.containerCombos && cargoItem.containerCombos.length > 0) {
          combos = cargoItem.containerCombos.map(c => ({ type: c.typeId, size: c.sizeId, qty: c.quantity }));
        } else if (cargoItem.containerDetails?.typeId && cargoItem.containerDetails?.sizeId) {
          combos = [{ type: cargoItem.containerDetails.typeId, size: cargoItem.containerDetails.sizeId, qty: cargoItem.quantity }];
        }
        form.setValue('containerCombos', combos as any, { shouldValidate: true, shouldDirty: true });
        if (combos.length > 0) {
          form.setValue('containerType', combos[0].type, { shouldValidate: true });
          form.setValue('containerSize', combos[0].size, { shouldValidate: true });
          form.setValue('containerQty', String(cargoItem.quantity), { shouldValidate: true });
        }
        if (combos.length === 0) {
          form.setValue('containerType', '', { shouldValidate: true });
          form.setValue('containerSize', '', { shouldValidate: true });
          form.setValue('containerQty', '1', { shouldValidate: true });
        }
      }
    } else {
      form.setValue('containerCombos', [] as any, { shouldValidate: false, shouldDirty: true });
      form.setValue('containerQty', String(cargoItem.quantity), { shouldValidate: true });
    }
  }, [cargoItem, mode]);

  const handleLocationChange = (field: 'origin' | 'destination', value: string, location?: any) => {
    form.setValue(field, value, { shouldValidate: true, shouldDirty: true });
    // Update the corresponding ID field
    if (field === 'origin') {
      form.setValue('originId', location?.id || '', { shouldValidate: true, shouldDirty: true });
    } else {
      form.setValue('destinationId', location?.id || '', { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleCommoditySelect = (selection: CommoditySelection) => {
    const displayValue = formatCommodityDisplay({
      description: selection.description,
      hts_code: selection.hts_code,
    });

    // Set the form value directly and immediately
    form.setValue('commodity', displayValue, { shouldValidate: true, shouldDirty: true });
    
    // Also update the cargo item for consistency
    setCargoItem(prev => ({
      ...prev,
      commodity: {
        description: selection.description?.trim() || '',
        hts_code: selection.hts_code,
        id: selection.master_commodity_id,
        aes_hts_id: selection.aes_hts_id,
      },
    }));
    
    if (selection.hts_code) form.setValue('htsCode', selection.hts_code, { shouldValidate: true, shouldDirty: true });
  };

  const handleAiSuggest = async () => {
    if (!commodity || commodity.length < 3) return;
    try {
      const [unitRes, classRes] = await Promise.all([
        invokeAiAdvisor({ action: 'suggest_unit', payload: { commodity } }),
        invokeAiAdvisor({ action: 'classify_commodity', payload: { commodity } }),
      ]);
      if (unitRes.data?.unit) {
        form.setValue('unit', unitRes.data.unit, { shouldValidate: true, shouldDirty: true });
      }
      if (classRes.data?.hts) {
        form.setValue('htsCode', classRes.data.hts, { shouldValidate: true, shouldDirty: true });
        toast({ title: 'AI Analysis Complete', description: `Classified as ${classRes.data.type} (HTS: ${classRes.data.hts})` });
      }
    } catch (err) {
      logger.error('AI Suggest Error', err);
    }
  };

  const onSubmit = (data: QuoteComposerValues) => {
    const extendedData: ExtendedFormData = {
      ...(data as any),
      cargoItem,
    };
    onGetRates(data as any, extendedData, smartMode);
  };

  const attachments = form.watch('attachments' as any) || [];

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const current = form.getValues('attachments' as any) || [];
      form.setValue('attachments' as any, [...current, ...newFiles], { shouldDirty: true });
    }
  };

  const removeAttachment = (index: number) => {
    const current = form.getValues('attachments' as any) || [];
    const next = [...current];
    next.splice(index, 1);
    form.setValue('attachments' as any, next, { shouldDirty: true });
  };

  const InlineError = ({ message, compact = false }: { message: string; compact?: boolean }) => {
    if (!message) return null;
    return (
      <span className={cn("inline-flex items-center gap-1 text-destructive", compact ? "text-[10px]" : "text-xs")} role="alert" aria-live="polite">
        <AlertCircle className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden="true" />
        <span>{message}</span>
      </span>
    );
  };

  return (
    <div className="bg-muted/30 border rounded-lg p-6">
      <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          logger.error('Form Errors:', errors);
          onValidationFailed?.();
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
                  form.setValue('standalone' as any, checked, { shouldValidate: true, shouldDirty: true });
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
                  <FormLabel className={cn("flex items-center gap-2 text-xs", form.formState.errors.opportunityId && "text-destructive")}>
                    <FileText className="h-3.5 w-3.5" /> Opportunity
                  </FormLabel>
                  <Select onValueChange={(val) => onOpportunityChange(val)} value={field.value} disabled={crmLoading}>
                    <FormControl>
                      <SelectTrigger 
                        className={cn("bg-background h-9 text-xs", form.formState.errors.opportunityId && "border-destructive focus:ring-destructive")}
                        aria-invalid={!!form.formState.errors.opportunityId}
                      >
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
                  <FormLabel className={cn("flex items-center gap-2 text-xs", form.formState.errors.accountId && "text-destructive")}>
                    <Building2 className="h-3.5 w-3.5" /> Account
                  </FormLabel>
                  <Select onValueChange={(v) => {
                    field.onChange(v);
                    const related = contacts.filter(c => c.account_id === v);
                    // Only auto-select if there is exactly one contact
                    if (related.length === 1) {
                      form.setValue('contactId' as any, related[0].id, { shouldValidate: true, shouldDirty: true });
                    } else {
                      form.setValue('contactId' as any, '', { shouldValidate: true, shouldDirty: true });
                    }
                  }} value={field.value} disabled={crmLoading}>
                    <FormControl>
                      <SelectTrigger 
                        className={cn("bg-background h-9 text-xs", form.formState.errors.accountId && "border-destructive focus:ring-destructive")}
                        aria-invalid={!!form.formState.errors.accountId}
                      >
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
                  <FormLabel className={cn("flex items-center gap-2 text-xs", form.formState.errors.contactId && "text-destructive")}>
                    <User className="h-3.5 w-3.5" /> Contact
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!accountId || crmLoading}>
                    <FormControl>
                      <SelectTrigger 
                        className={cn("bg-background h-9 text-xs", form.formState.errors.contactId && "border-destructive focus:ring-destructive")}
                        aria-invalid={!!form.formState.errors.contactId}
                      >
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
                      <FormLabel className={cn("flex items-center gap-2 text-xs", form.formState.errors.quoteTitle && "text-destructive")}>
                        <FileText className="h-3.5 w-3.5" /> Quote Reference
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g. Q3 Shipment" 
                          className={cn("bg-background h-9 text-xs", form.formState.errors.quoteTitle && "border-destructive focus-visible:ring-destructive")}
                          aria-invalid={!!form.formState.errors.quoteTitle}
                        />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.guestCompany && "text-destructive")}>Company Name *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Acme Corp" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.guestCompany && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.guestCompany}
                          />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.taxId && "text-destructive")}>Tax ID / VAT</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Tax Identification Number" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.taxId && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.taxId}
                          />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.guestName && "text-destructive")}>Full Name *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="John Doe" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.guestName && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.guestName}
                          />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.guestEmail && "text-destructive")}>Email Address *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="john@example.com" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.guestEmail && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.guestEmail}
                          />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.guestPhone && "text-destructive")}>Phone Number</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="+1 234 567 8900" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.guestPhone && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.guestPhone}
                          />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.guestJobTitle && "text-destructive")}>Job Title</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Manager" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.guestJobTitle && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.guestJobTitle}
                          />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.guestDepartment && "text-destructive")}>Department</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="Logistics" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.guestDepartment && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.guestDepartment}
                          />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.billingAddress?.street && "text-destructive")}>Street Address *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="123 Main St" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.billingAddress?.street && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.billingAddress?.street}
                          />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.billingAddress?.city && "text-destructive")}>City *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="New York" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.billingAddress?.city && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.billingAddress?.city}
                          />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.billingAddress?.state && "text-destructive")}>State / Province</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="NY" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.billingAddress?.state && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.billingAddress?.state}
                          />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.billingAddress?.postalCode && "text-destructive")}>Postal Code</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="10001" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.billingAddress?.postalCode && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.billingAddress?.postalCode}
                          />
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
                        <FormLabel className={cn("text-xs", form.formState.errors.billingAddress?.country && "text-destructive")}>Country *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="USA" 
                            className={cn("bg-background h-9 text-xs", form.formState.errors.billingAddress?.country && "border-destructive focus-visible:ring-destructive")}
                            aria-invalid={!!form.formState.errors.billingAddress?.country}
                          />
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
                              <FormLabel className={cn("text-xs", form.formState.errors.shippingAddress?.street && "text-destructive")}>Street Address</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="123 Main St" 
                                  className={cn("bg-background h-9 text-xs", form.formState.errors.shippingAddress?.street && "border-destructive focus-visible:ring-destructive")}
                                  aria-invalid={!!form.formState.errors.shippingAddress?.street}
                                />
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
                              <FormLabel className={cn("text-xs", form.formState.errors.shippingAddress?.city && "text-destructive")}>City</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="New York" 
                                  className={cn("bg-background h-9 text-xs", form.formState.errors.shippingAddress?.city && "border-destructive focus-visible:ring-destructive")}
                                  aria-invalid={!!form.formState.errors.shippingAddress?.city}
                                />
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
                              <FormLabel className={cn("text-xs", form.formState.errors.shippingAddress?.state && "text-destructive")}>State / Province</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="NY" 
                                  className={cn("bg-background h-9 text-xs", form.formState.errors.shippingAddress?.state && "border-destructive focus-visible:ring-destructive")}
                                  aria-invalid={!!form.formState.errors.shippingAddress?.state}
                                />
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
                              <FormLabel className={cn("text-xs", form.formState.errors.shippingAddress?.postalCode && "text-destructive")}>Postal Code</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="10001" 
                                  className={cn("bg-background h-9 text-xs", form.formState.errors.shippingAddress?.postalCode && "border-destructive focus-visible:ring-destructive")}
                                  aria-invalid={!!form.formState.errors.shippingAddress?.postalCode}
                                />
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
                              <FormLabel className={cn("text-xs", form.formState.errors.shippingAddress?.country && "text-destructive")}>Country</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  placeholder="USA" 
                                  className={cn("bg-background h-9 text-xs", form.formState.errors.shippingAddress?.country && "border-destructive focus-visible:ring-destructive")}
                                  aria-invalid={!!form.formState.errors.shippingAddress?.country}
                                />
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
                <FormItem className={cn(hasFieldError('quoteNumber') && "rounded-md border border-destructive/40 bg-destructive/5 p-2")}>
                  <FormLabel className={cn("flex items-center gap-2 text-xs", hasFieldError('quoteNumber') && "text-destructive")}>
                    <FileText className="h-3.5 w-3.5" /> Quote Number (Manual Override)
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        placeholder="Auto-generated if left blank"
                        className={cn("bg-background h-9 text-xs pr-8", hasFieldError('quoteNumber') && "border-destructive focus-visible:ring-destructive")}
                        aria-invalid={hasFieldError('quoteNumber')}
                      />
                      {availability === 'loading' && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                      {availability === 'available' && <CheckCircle2 className="absolute right-2 top-2.5 h-4 w-4 text-green-500" />}
                      {availability === 'unavailable' && <XCircle className="absolute right-2 top-2.5 h-4 w-4 text-destructive" />}
                    </div>
                  </FormControl>
                  {availability === 'unavailable' && <InlineError compact message="This number is already taken." />}
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

        {/* Mode Tabs */}
        <div
          className={cn("space-y-2 rounded-md p-2", hasFieldError('mode') && "border border-destructive/40 bg-destructive/5 ring-1 ring-destructive/40")}
          data-field-name="mode"
          aria-invalid={hasFieldError('mode')}
        >
          <Label className={cn(hasFieldError('mode') && "text-destructive")}>
            Transport Mode {hasFieldError('mode') && <span className="ml-2"><InlineError message={getFieldErrorMessage('mode')} /></span>}
          </Label>
          <Tabs value={mode} onValueChange={(v) => form.setValue('mode', v as any, { shouldValidate: true, shouldDirty: true })} className="w-full">
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
          <div
            className={cn(
              "space-y-2 rounded-md transition-colors",
              hasFieldError('origin', 'originId') && "border border-destructive/40 bg-destructive/5 ring-1 ring-destructive/40 p-2"
            )}
            data-field-name="origin"
            aria-invalid={hasFieldError('origin', 'originId')}
          >
            <Label className="flex justify-between">
              Origin
              <InlineError message={getFieldErrorMessage('origin', 'originId')} />
            </Label>
            <LocationAutocomplete
              data-testid="location-origin"
              placeholder="Search origin..."
              value={origin}
              onChange={(value, location) => handleLocationChange('origin', value, location)}
              preloadedLocations={ports}
              error={!!(form.formState.errors.origin || form.formState.errors.originId)}
            />
            <input type="hidden" {...form.register('origin')} />
          </div>
          <div
            className={cn(
              "space-y-2 rounded-md transition-colors",
              hasFieldError('destination', 'destinationId') && "border border-destructive/40 bg-destructive/5 ring-1 ring-destructive/40 p-2"
            )}
            data-field-name="destination"
            aria-invalid={hasFieldError('destination', 'destinationId')}
          >
            <Label className="flex justify-between">
              Destination
              <InlineError message={getFieldErrorMessage('destination', 'destinationId')} />
            </Label>
            <LocationAutocomplete
              data-testid="location-destination"
              placeholder="Search destination..."
              value={destination}
              onChange={(value, location) => handleLocationChange('destination', value, location)}
              preloadedLocations={ports}
              error={!!(form.formState.errors.destination || form.formState.errors.destinationId)}
            />
            <input type="hidden" {...form.register('destination')} />
          </div>
        </div>

        {/* Commodity & Cargo */}
        <div
          className={cn(
            "space-y-2 rounded-md transition-colors",
            (hasFieldError('commodity') || hasFieldError('weight')) && "border border-destructive/40 bg-destructive/5 ring-1 ring-destructive/40 p-2"
          )}
          data-field-name="commodity"
          aria-invalid={hasFieldError('commodity') || hasFieldError('weight')}
        >
          <Label className="flex justify-between">
            <span>Commodity & Cargo {hasFieldError('commodity') && <span className="ml-2"><InlineError message={getFieldErrorMessage('commodity')} /></span>}</span>
            <button type="button" onClick={handleAiSuggest} className="text-xs text-primary flex items-center gap-1 hover:underline">
              <Sparkles className="w-3 h-3" /> AI Analyze
            </button>
          </Label>
          <SharedCargoInput
            value={cargoItem}
            onChange={setCargoItem}
            onCommodityChange={(value) => form.setValue('commodity', value, { shouldValidate: true, shouldDirty: true })}
            errors={form.formState.errors as any}
          />
          <span className="sr-only" data-field-name="containerType" aria-hidden="true" />
          <span className="sr-only" data-field-name="containerSize" aria-hidden="true" />
          <span className="sr-only" data-field-name="containerQty" aria-hidden="true" />
          {hasFieldError('containerType') && <InlineError compact message={getFieldErrorMessage('containerType')} />}
          {hasFieldError('containerSize') && <InlineError compact message={getFieldErrorMessage('containerSize')} />}
          {hasFieldError('containerQty') && <InlineError compact message={getFieldErrorMessage('containerQty')} />}
          
          {/* Backup commodity input for direct entry */}
          <div className="mt-2">
            <Input
              type="text"
              placeholder="Or enter commodity description directly..."
              data-testid="commodity-input"
              name="commodity"
              value={commodity || ''}
              className="text-sm"
              aria-invalid={!!form.formState.errors.commodity}
              onChange={(e) => {
                const value = e.target.value;
                form.setValue('commodity', value, { shouldValidate: true, shouldDirty: true });
                setCargoItem(prev => ({
                  ...prev,
                  commodity: value
                    ? {
                        description: value,
                        hts_code: prev.commodity?.hts_code || ''
                      }
                    : undefined
                }));
              }}
            />
          </div>
        </div>

        {/* Road-specific fields */}
        {mode === 'road' && (
          <div
            className={cn("space-y-2 p-3 border rounded-md bg-background", hasFieldError('vehicleType') && "border-destructive/40 bg-destructive/5")}
            data-field-name="vehicleType"
            aria-invalid={hasFieldError('vehicleType')}
          >
            <Label className={cn("text-xs", hasFieldError('vehicleType') && "text-destructive")}>Vehicle Type</Label>
            <Select value={form.watch('vehicleType')} onValueChange={(v) => form.setValue('vehicleType', v, { shouldValidate: true, shouldDirty: true })}>
              <SelectTrigger 
                className={cn("h-8", hasFieldError('vehicleType') && "border-destructive focus:ring-destructive")}
                aria-invalid={hasFieldError('vehicleType')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="van">Dry Van</SelectItem>
                <SelectItem value="flatbed">Flatbed</SelectItem>
                <SelectItem value="reefer">Reefer Truck</SelectItem>
              </SelectContent>
            </Select>
            <InlineError compact message={getFieldErrorMessage('vehicleType')} />
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
                      form.setValue('preferredCarriers', checked ? [...current, carrier.name] : current.filter(c => c !== carrier.name), { shouldValidate: true, shouldDirty: true });
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
            <div
              className={cn("space-y-2 rounded-md", hasFieldError('incoterms') && "border border-destructive/40 bg-destructive/5 p-2")}
              data-field-name="incoterms"
              aria-invalid={hasFieldError('incoterms')}
            >
              <Label className={cn("text-xs", hasFieldError('incoterms') && "text-destructive")}>Incoterms</Label>
              <Select value={form.watch('incoterms')} onValueChange={(v) => form.setValue('incoterms', v, { shouldValidate: true, shouldDirty: true })}>
                <SelectTrigger 
                  className={cn(hasFieldError('incoterms') && "border-destructive focus:ring-destructive")}
                  aria-invalid={hasFieldError('incoterms')}
                >
                  <SelectValue placeholder="Select Incoterms (Optional)" />
                </SelectTrigger>
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
              <InlineError compact message={getFieldErrorMessage('incoterms')} />
            </div>

            {/* Timing */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className={cn("space-y-1 rounded-md", hasFieldError('pickupDate') && "border border-destructive/40 bg-destructive/5 p-2")}
                data-field-name="pickupDate"
                aria-invalid={hasFieldError('pickupDate')}
              >
                <Label className={cn("text-xs", hasFieldError('pickupDate') && "text-destructive")}>Pickup Date</Label>
                <Input 
                  type="date" 
                  value={form.watch('pickupDate')} 
                  onChange={(e) => form.setValue('pickupDate', e.target.value, { shouldValidate: true, shouldDirty: true })} 
                  className={cn("h-8 text-xs", hasFieldError('pickupDate') && "border-destructive focus-visible:ring-destructive")} 
                  aria-invalid={hasFieldError('pickupDate')}
                />
                <InlineError compact message={getFieldErrorMessage('pickupDate')} />
              </div>
              <div
                className={cn("space-y-1 rounded-md", hasFieldError('deliveryDeadline') && "border border-destructive/40 bg-destructive/5 p-2")}
                data-field-name="deliveryDeadline"
                aria-invalid={hasFieldError('deliveryDeadline')}
              >
                <Label className={cn("text-xs", hasFieldError('deliveryDeadline') && "text-destructive")}>Delivery Deadline</Label>
                <Input 
                  type="date" 
                  value={form.watch('deliveryDeadline')} 
                  onChange={(e) => form.setValue('deliveryDeadline', e.target.value, { shouldValidate: true, shouldDirty: true })} 
                  className={cn("h-8 text-xs", hasFieldError('deliveryDeadline') && "border-destructive focus-visible:ring-destructive")} 
                  aria-invalid={hasFieldError('deliveryDeadline')}
                />
                <InlineError compact message={getFieldErrorMessage('deliveryDeadline')} />
              </div>
            </div>

            {/* Customs & Compliance */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className={cn("space-y-1 rounded-md", hasFieldError('htsCode') && "border border-destructive/40 bg-destructive/5 p-2")}
                data-field-name="htsCode"
                aria-invalid={hasFieldError('htsCode')}
              >
                <Label className={cn("text-xs", hasFieldError('htsCode') && "text-destructive")}>HTS Code</Label>
                <Input 
                  value={form.watch('htsCode')} 
                  onChange={(e) => form.setValue('htsCode', e.target.value, { shouldValidate: true, shouldDirty: true })} 
                  className={cn("h-8 text-xs", hasFieldError('htsCode') && "border-destructive focus-visible:ring-destructive")} 
                  placeholder="AI Suggested" 
                  aria-invalid={hasFieldError('htsCode')}
                />
                <InlineError compact message={getFieldErrorMessage('htsCode')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dangerous Goods</Label>
                <div className="flex items-center space-x-2">
                  <Switch checked={form.watch('dangerousGoods')} onCheckedChange={(v) => form.setValue('dangerousGoods', v, { shouldValidate: true, shouldDirty: true })} />
                  <Label className="text-xs font-normal">Yes</Label>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Attachments Section */}
        <div className="space-y-2 p-3 border rounded-md bg-background">
          <Label className="flex items-center gap-2 text-xs font-semibold">
            <Paperclip className="w-3.5 h-3.5" /> Attachments
          </Label>
          
          <div className="grid grid-cols-1 gap-2 mb-2">
            {attachments.map((att: any, idx: number) => (
              <div key={att.id || idx} className="flex items-center justify-between p-2 border rounded text-xs bg-muted/50">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileIcon className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{att.name || att.file_name || 'Unknown File'}</span>
                  <span className="text-muted-foreground text-[10px]">
                    {att.size ? `(${(att.size / 1024).toFixed(1)} KB)` : ''}
                  </span>
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                  onClick={() => removeAttachment(idx)}
                  data-testid={`remove-attachment-${idx}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {attachments.length === 0 && (
               <p className="text-[10px] text-muted-foreground italic">No files attached.</p>
            )}
          </div>

          <div className="border-dashed border-2 rounded-md p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/5 transition-colors relative">
             <input 
               type="file" 
               multiple 
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
               onChange={handleAddFiles}
             />
             <div className="flex flex-col items-center gap-1 pointer-events-none">
                <Paperclip className="w-6 h-6 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground">Click or drag files here to attach</span>
             </div>
          </div>
        </div>

        {showExecutionControls && (
          <>
            <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-950/30 p-3 rounded-md border border-purple-100 dark:border-purple-900">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-purple-900 dark:text-purple-200">Smart Quote Mode</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400">AI-optimized routes & pricing</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {smartMode && onOpenSmartSettings && (
                  <Button variant="ghost" size="sm" onClick={onOpenSmartSettings} className="h-6 w-6 p-0">
                    <Settings2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Switch checked={smartMode} onCheckedChange={setSmartMode} data-testid="smart-mode-switch" />
              </div>
            </div>
          </>
        )}
        <div className="flex gap-3 pt-2">
          {showExecutionControls && (
            smartMode ? (
              <Button type="submit" className="flex-1" disabled={loading} data-testid="get-rates-btn">
                {loading ? (
                  <><Timer className="w-4 h-4 mr-2 animate-spin" /> Calculating...</>
                ) : (
                  'Get Rates (AI Enhanced)'
                )}
              </Button>
            ) : (
              <Button 
                type="button" 
                className="flex-1 bg-green-600 hover:bg-green-700 text-white" 
                disabled={loading} 
                data-testid="quotation-composer-btn"
                onClick={() => onGetRates(form.getValues() as any, {} as any, false)}
              >
                {loading ? (
                  <><Timer className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" /> Quotation Composer</>
                )}
              </Button>
            )
          )}

          {onEnterComposerMode && (
            <Button 
              type="button" 
              variant="secondary" 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" 
              disabled={loading} 
              data-testid="composer-mode-btn"
              onClick={onEnterComposerMode}
            >
              <FileText className="w-4 h-4 mr-2" /> Composer Mode
            </Button>
          )}
          
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
