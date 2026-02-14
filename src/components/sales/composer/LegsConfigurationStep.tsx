import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, MapPin, Package, Truck, Loader2, Train, Ship, Plane } from 'lucide-react';
import { TransportModeSelector } from './TransportModeSelector';
import { HelpTooltip } from './HelpTooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuoteStore } from './store/QuoteStore';
import { Leg } from './store/types';
import { useCRM } from '@/hooks/useCRM';

interface LegsConfigurationStepProps {}

function LocationAutocomplete({ 
  value, 
  onChange, 
  placeholder, 
  mode 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  placeholder: string; 
  mode: string; 
}) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { invokeAiAdvisor } = useAiAdvisor();

  useEffect(() => {
    if (!open || value.length < 3) return;
    
    const timer = setTimeout(async () => {
        setLoading(true);
        const { data } = await invokeAiAdvisor({
            action: 'lookup_codes', payload: { query: value, mode: mode || 'ocean' }
        });
        if (data?.suggestions) {
            setSuggestions(data.suggestions);
        }
        setLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, [value, open, mode]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10" />
            <Input
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                }}
                placeholder={placeholder}
                className="pl-9"
                onFocus={() => setOpen(true)}
            />
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[300px]" align="start">
        <Command>
            <CommandList>
                {loading && <div className="p-2 text-xs text-center text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin inline mr-1"/> Searching...</div>}
                {!loading && suggestions.length === 0 && <div className="p-2 text-xs text-center text-muted-foreground">Type to search locations...</div>}
                {suggestions.map((suggestion, i) => (
                    <CommandItem 
                        key={i} 
                        value={suggestion.label}
                        onSelect={() => {
                            onChange(suggestion.label);
                            setOpen(false);
                        }}
                        className="cursor-pointer"
                    >
                        <div className="flex flex-col">
                            <span className="font-medium">{suggestion.label}</span>
                            <span className="text-xs text-muted-foreground">{suggestion.details}</span>
                        </div>
                    </CommandItem>
                ))}
            </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function LegsConfigurationStep({}: LegsConfigurationStepProps) {
  const { state, dispatch } = useQuoteStore();
  const { legs, validationErrors, referenceData } = state;
  const { serviceTypes = [], carriers = [], serviceLegCategories: serviceCategories = [] } = referenceData || {};
  const { scopedDb } = useCRM();

  const onAddLeg = (mode: string) => {
    // Find default service type for this mode
    const defaultServiceType = serviceTypes.find(st => {
      const stMode = (st.mode || '').toLowerCase();
      const legMode = mode.toLowerCase();
      // Match mode directly or via common aliases
      if (stMode === legMode) return true;
      if (legMode === 'ocean' && stMode === 'sea') return true;
      if (legMode === 'sea' && stMode === 'ocean') return true;
      return false;
    });

    const newLeg: Leg = {
      id: crypto.randomUUID(),
      mode,
      serviceTypeId: defaultServiceType?.id || '',
      origin: legs.length === 0 ? state.quoteData.origin : '', // Default to Quote Origin for first leg
      destination: legs.length === 0 ? state.quoteData.destination : '', // Default to Quote Dest for first leg
      charges: [],
      legType: 'transport'
    };
    dispatch({ type: 'ADD_LEG', payload: newLeg });
  };

  const onUpdateLeg = (id: string, updates: Partial<Leg>) => {
    dispatch({ type: 'UPDATE_LEG', payload: { id, updates } });
  };

  const onRemoveLeg = (id: string) => {
    dispatch({ type: 'REMOVE_LEG', payload: id });
  };

  // Ensure legType is valid
  useEffect(() => {
    legs.forEach(leg => {
      if (leg.legType !== 'transport' && leg.legType !== 'service') {
        onUpdateLeg(leg.id, { legType: 'transport' });
      }
    });
  }, [legs, onUpdateLeg]);

  const getLegErrors = (index: number) => {
    if (!validationErrors) return [];
    // Expecting errors like "Leg 1: Origin is required"
    const prefix = `Leg ${index + 1}:`;
    return validationErrors
      .filter(error => error.startsWith(prefix))
      .map(error => error.replace(prefix, '').trim());
  };

  const getSafeName = (obj: any, fallback: string = '') => {
    if (obj === null || obj === undefined) return fallback;
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number') return String(obj);
    if (typeof obj === 'object') {
       return obj.name || obj.code || obj.details || obj.description || fallback;
    }
    return String(obj);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Configure Legs & Services
          <HelpTooltip content="Add transport legs (origin to destination) or service-only legs (warehousing, customs, packing, etc.) for your shipment." />
        </CardTitle>
        <CardDescription>Add transport legs or service-only providers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-base font-semibold mb-3 block">Add Transport Mode</Label>
          <TransportModeSelector selectedMode={null} onSelect={onAddLeg} />
        </div>

        {legs.length > 0 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">Your Legs ({legs.length})</Label>
            {legs.map((leg, index) => {
              // Normalize legType for UI display - treat everything that isn't explicitly 'service' as 'transport'
              // This handles legacy types like 'pickup', 'delivery', etc.
              const legType = leg.legType === 'service' ? 'service' : 'transport';
              const isServiceLeg = legType === 'service';
              const legErrors = getLegErrors(index);
              const hasError = legErrors.length > 0;
              
              const serviceTypeError = legErrors.find(e => e.includes('Service Type'));
              
              return (
                <Card key={leg.id} className={`border-2 ${hasError ? 'border-destructive/50' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isServiceLeg ? (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          (() => {
                            const m = (leg.mode || '').toLowerCase();
                            if (m.includes('ocean') || m.includes('sea')) return <Ship className="h-4 w-4 text-muted-foreground" />;
                            if (m.includes('air')) return <Plane className="h-4 w-4 text-muted-foreground" />;
                            if (m.includes('rail') || m.includes('train')) return <Train className="h-4 w-4 text-muted-foreground" />;
                            return <Truck className="h-4 w-4 text-muted-foreground" />;
                          })()
                        )}
                        <CardTitle className="text-base">
                          {isServiceLeg ? 'Service' : 'Leg'} {index + 1} - {
                            isServiceLeg 
                              ? getSafeName(serviceCategories?.find((c) => c.code === leg.serviceOnlyCategory), 'Service')
                              : (getSafeName(serviceTypes.find((st) => st.id === leg.serviceTypeId)) || leg.carrierName || leg.mode.toUpperCase())
                          }
                        </CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveLeg(leg.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Leg Type Toggle */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Leg Type</Label>
                      <Tabs 
                        value={legType} 
                        onValueChange={(val) => onUpdateLeg(leg.id, { 
                          legType: val as 'transport' | 'service',
                          // Clear fields when switching types
                          ...(val === 'service' ? { origin: '', destination: '', serviceTypeId: '' } : { serviceOnlyCategory: '' })
                        })}
                      >
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="transport" className="flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            Transport Leg
                          </TabsTrigger>
                          <TabsTrigger value="service" className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Service Only
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>

                    {/* Conditional Fields */}
                    {isServiceLeg ? (
                      // Service-Only Fields
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Service Category *</Label>
                        <Select
                          value={leg.serviceOnlyCategory || ''}
                          onValueChange={(val) => onUpdateLeg(leg.id, { serviceOnlyCategory: val })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select service category" />
                          </SelectTrigger>
                          <SelectContent>
                            {serviceCategories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.code}>
                                {getSafeName(cat)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {typeof (serviceCategories?.find((c) => c.code === leg.serviceOnlyCategory)?.description) === 'string' 
                            ? serviceCategories?.find((c) => c.code === leg.serviceOnlyCategory)?.description 
                            : ''}
                        </p>
                      </div>
                    ) : (
                      // Transport Leg Fields
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Preferred Carrier</Label>
                          <Select
                            value={leg.carrierId || ''}
                            onValueChange={(val) => {
                               const selectedCarrier = carriers?.find(c => c.id === val);
                               onUpdateLeg(leg.id, { 
                                 carrierId: val,
                                 carrierName: selectedCarrier?.carrier_name 
                               });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select carrier" />
                            </SelectTrigger>
                            <SelectContent>
                            {carriers
                              .filter(c => {
                                // Map leg mode to carrier type with robust fallback
                                const modeMap: Record<string, string> = {
                                  'ocean': 'ocean',
                                  'sea': 'ocean',
                                  'air': 'air_cargo',
                                  'air_cargo': 'air_cargo',
                                  'road': 'trucking',
                                  'truck': 'trucking',
                                  'rail': 'rail',
                                  'train': 'rail'
                                };
                                const legMode = (leg.mode || '').toLowerCase();
                                const targetType = modeMap[legMode] || legMode;
                                const carrierType = (c.carrier_type || '').toLowerCase();
                                
                                // Direct match or mapped match
                                return carrierType === targetType || carrierType === legMode;
                              })
                              .map((carrier) => (
                                  <SelectItem key={carrier.id} value={carrier.id}>
                                    {carrier.carrier_name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className={`text-sm font-medium mb-2 block ${serviceTypeError ? 'text-destructive' : ''}`}>Service Type *</Label>
                          <Select
                            value={leg.serviceTypeId}
                            onValueChange={(val) => onUpdateLeg(leg.id, { serviceTypeId: val })}
                          >
                            <SelectTrigger className={`w-full ${serviceTypeError ? 'border-destructive' : ''}`}>
                              <SelectValue placeholder="Select service type" />
                            </SelectTrigger>
                            <SelectContent>
                              {serviceTypes
                                .filter((st) => {
                                  if (!st.is_active) return false;
                                  const transportMode = (st as any).transport_modes;
                                  const currentMode = (leg.mode || '').toLowerCase();
                                  
                                  // Robust check for transport mode match
                                  if (transportMode?.code) {
                                    const tmCode = transportMode.code.toLowerCase();
                                    return tmCode === currentMode || 
                                           (currentMode === 'ocean' && (tmCode === 'sea' || tmCode === 'maritime')) ||
                                           (currentMode === 'air' && tmCode === 'air_cargo');
                                  }
                                  
                                  // Fallback to mode_id check if available
                                  return st.mode_id === leg.mode;
                                })
                                .map((st) => (
                                  <SelectItem key={st.id} value={st.id}>
                                    {getSafeName(st)}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-sm font-medium mb-2 block">Origin *</Label>
                          <LocationAutocomplete
                            value={leg.origin}
                            onChange={(val) => onUpdateLeg(leg.id, { origin: val })}
                            placeholder="e.g., Shanghai Port"
                            mode={leg.mode}
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium mb-2 block">Destination *</Label>
                          <LocationAutocomplete
                            value={leg.destination}
                            onChange={(val) => onUpdateLeg(leg.id, { destination: val })}
                            placeholder="e.g., Los Angeles Port"
                            mode={leg.mode}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {legs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No legs added yet. Select a transport mode above to begin.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
