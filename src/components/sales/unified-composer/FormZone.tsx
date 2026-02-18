import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Plane, Ship, Truck, Train, Timer, Sparkles, ChevronDown, Save, Settings2 } from 'lucide-react';
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

// --- Zod Schema (reused from QuickQuoteModalContent) ---

const baseSchema = z.object({
  mode: z.enum(['air', 'ocean', 'road', 'rail']),
  origin: z.string().min(2, 'Origin is required'),
  destination: z.string().min(2, 'Destination is required'),
  commodity: z.string().min(2, 'Commodity is required'),
  preferredCarriers: z.array(z.string()).optional(),
  weight: z.string().optional().refine((val) => {
    if (!val) return true;
    const n = Number(val);
    return !isNaN(n) && n >= 0;
  }, { message: 'Weight must be a non-negative number' }),
  volume: z.string().optional().refine((val) => {
    if (!val) return true;
    const n = Number(val);
    return !isNaN(n) && n >= 0;
  }, { message: 'Volume must be a non-negative number' }),
  unit: z.enum(['kg', 'lb', 'cbm']).optional(),
  containerType: z.string().optional(),
  containerSize: z.string().optional(),
  containerQty: z.string().optional(),
});

export const formZoneSchema = baseSchema.superRefine((data, ctx) => {
  if (data.mode === 'air') {
    if (!data.weight || isNaN(Number(data.weight)) || Number(data.weight) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid weight is required for Air', path: ['weight'] });
    }
  }
  if (data.mode === 'ocean' || data.mode === 'rail') {
    const qtyNum = Number(data.containerQty || '');
    if (!data.containerType) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Container type is required', path: ['containerType'] });
    if (!data.containerSize) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Container size is required', path: ['containerSize'] });
    if (isNaN(qtyNum) || qtyNum <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Container quantity must be > 0', path: ['containerQty'] });
  }
  if (data.origin.trim().toLowerCase() === data.destination.trim().toLowerCase()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Origin and Destination cannot be the same', path: ['destination'] });
  }
});

export type FormZoneValues = z.infer<typeof baseSchema>;

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
  initialValues?: Partial<FormZoneValues>;
  initialExtended?: Partial<ExtendedFormData>;
}

export function FormZone({ onGetRates, onSaveDraft, loading = false, initialValues, initialExtended }: FormZoneProps) {
  const [smartMode, setSmartMode] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [carriers, setCarriers] = useState<{ id: string; carrier_name: string; carrier_type: string }[]>([]);
  const [extendedData, setExtendedData] = useState<ExtendedFormData>({ ...DEFAULT_EXTENDED, ...initialExtended });

  const { containerTypes, containerSizes } = useContainerRefs();
  const { incoterms, loading: incLoading } = useIncoterms();
  const { invokeAiAdvisor } = useAiAdvisor();
  const { toast } = useToast();
  const { supabase, context } = useCRM();

  const form = useForm<FormZoneValues>({
    resolver: zodResolver(formZoneSchema),
    defaultValues: {
      unit: 'kg',
      mode: 'ocean',
      commodity: 'General Cargo',
      ...initialValues,
    },
  });

  const mode = form.watch('mode');
  const commodity = form.watch('commodity');
  const origin = form.watch('origin');
  const destination = form.watch('destination');

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
  }, []);

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
    setExtendedData(prev => ({ ...prev, dangerousGoods: !!cargoItem.hazmat }));

    if (mode === 'ocean' || mode === 'rail') {
      if (cargoItem.type === 'container') {
        let combos: Array<{ type: string; size: string; qty: number }> = [];
        if (cargoItem.containerCombos && cargoItem.containerCombos.length > 0) {
          combos = cargoItem.containerCombos.map(c => ({ type: c.typeId, size: c.sizeId, qty: c.quantity }));
        } else if (cargoItem.containerDetails?.typeId && cargoItem.containerDetails?.sizeId) {
          combos = [{ type: cargoItem.containerDetails.typeId, size: cargoItem.containerDetails.sizeId, qty: cargoItem.quantity }];
        }
        if (combos.length > 0) {
          setExtendedData(prev => ({
            ...prev,
            containerType: combos[0].type,
            containerSize: combos[0].size,
            containerQty: String(cargoItem.quantity),
            containerCombos: combos,
          }));
          form.setValue('containerType', combos[0].type);
          form.setValue('containerSize', combos[0].size);
          form.setValue('containerQty', String(cargoItem.quantity));
        }
      }
    } else {
      setExtendedData(prev => ({
        ...prev,
        weight: String(cargoItem.weight.value),
        volume: String(cargoItem.volume || 0),
        containerQty: String(cargoItem.quantity),
        dims: cargoItem.dimensions ? `${cargoItem.dimensions.l}x${cargoItem.dimensions.w}x${cargoItem.dimensions.h}` : '',
      }));
      form.setValue('weight', String(cargoItem.weight.value));
      form.setValue('volume', String(cargoItem.volume || 0));
      form.setValue('containerQty', String(cargoItem.quantity));
    }
  }, [cargoItem, mode]);

  const handleLocationChange = (field: 'origin' | 'destination', value: string, location?: any) => {
    form.setValue(field, value);
    if (location) {
      setExtendedData(prev => ({
        ...prev,
        [field === 'origin' ? 'originDetails' : 'destinationDetails']: {
          name: location.location_name,
          formatted_address: [location.city, location.state_province, location.country].filter(Boolean).join(', '),
          code: location.location_code,
          type: location.location_type,
          country: location.country,
          city: location.city,
        },
      }));
    }
  };

  const handleCommoditySelect = (selection: CommoditySelection) => {
    const displayValue = selection.hts_code ? `${selection.description} - ${selection.hts_code}` : selection.description;
    form.setValue('commodity', displayValue);
    setExtendedData(prev => ({
      ...prev,
      htsCode: selection.hts_code || prev.htsCode,
      aes_hts_id: selection.aes_hts_id || prev.aes_hts_id,
    }));
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
        setExtendedData(prev => ({ ...prev, htsCode: classRes.data.hts, scheduleB: classRes.data.scheduleB || prev.scheduleB }));
        toast({ title: 'AI Analysis Complete', description: `Classified as ${classRes.data.type} (HTS: ${classRes.data.hts})` });
      }
    } catch (err) {
      logger.error('AI Suggest Error', err);
    }
  };

  const onSubmit = (data: FormZoneValues) => {
    onGetRates(data, extendedData, smartMode);
  };

  return (
    <div className="bg-muted/30 border rounded-lg p-6">
      <form onSubmit={form.handleSubmit(onSubmit, (e) => logger.error('Form Errors:', e))} className="space-y-5">
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
            <Select value={extendedData.vehicleType} onValueChange={(v) => setExtendedData(prev => ({ ...prev, vehicleType: v }))}>
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
              <Select value={extendedData.incoterms} onValueChange={(v) => setExtendedData(prev => ({ ...prev, incoterms: v }))}>
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
                <Input type="date" value={extendedData.pickupDate} onChange={(e) => setExtendedData(prev => ({ ...prev, pickupDate: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delivery Deadline</Label>
                <Input type="date" value={extendedData.deliveryDeadline} onChange={(e) => setExtendedData(prev => ({ ...prev, deliveryDeadline: e.target.value }))} className="h-8 text-xs" />
              </div>
            </div>

            {/* Customs & Compliance */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">HTS Code</Label>
                <Input value={extendedData.htsCode} onChange={(e) => setExtendedData(prev => ({ ...prev, htsCode: e.target.value }))} className="h-8 text-xs" placeholder="AI Suggested" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Schedule B</Label>
                <Input value={extendedData.scheduleB} onChange={(e) => setExtendedData(prev => ({ ...prev, scheduleB: e.target.value }))} className="h-8 text-xs" placeholder="AI Suggested" />
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
