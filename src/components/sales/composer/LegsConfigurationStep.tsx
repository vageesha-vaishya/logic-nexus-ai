import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, MapPin, Package, Truck, Loader2 } from 'lucide-react';
import { TransportModeSelector } from './TransportModeSelector';
import { HelpTooltip } from './HelpTooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Leg {
  id: string;
  mode: string;
  serviceTypeId: string;
  origin: string;
  destination: string;
  charges: any[];
  legType?: 'transport' | 'service';
  serviceOnlyCategory?: string;
  carrierName?: string;
}

interface LegsConfigurationStepProps {
  legs: Leg[];
  serviceTypes: any[];
  onAddLeg: (mode: string) => void;
  onUpdateLeg: (legId: string, updates: Partial<Leg>) => void;
  onRemoveLeg: (legId: string) => void;
  validationErrors?: string[];
}

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

export function LegsConfigurationStep({
  legs,
  serviceTypes,
  onAddLeg,
  onUpdateLeg,
  onRemoveLeg,
  validationErrors = []
}: LegsConfigurationStepProps) {
  // Fetch service leg categories
  const { data: serviceCategories } = useQuery({
    queryKey: ['service-leg-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_leg_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data || [];
    }
  });

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
              
              const originError = legErrors.find(e => e.includes('Origin'));
              const destError = legErrors.find(e => e.includes('Destination'));
              const serviceTypeError = legErrors.find(e => e.includes('Service Type'));
              const serviceCategoryError = legErrors.find(e => e.includes('Service Category'));
              
              return (
                <Card key={leg.id} className={`border-2 ${hasError ? 'border-destructive/50' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isServiceLeg ? (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Truck className="h-4 w-4 text-muted-foreground" />
                        )}
                        <CardTitle className="text-base">
                          {isServiceLeg ? 'Service' : 'Leg'} {index + 1} - {
                            isServiceLeg 
                              ? (serviceCategories?.find((c) => c.code === leg.serviceOnlyCategory)?.name || 'Service')
                              : (serviceTypes.find((st) => st.id === leg.serviceTypeId)?.name || leg.carrierName || leg.mode.toUpperCase())
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
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {serviceCategories?.find((c) => c.code === leg.serviceOnlyCategory)?.description}
                        </p>
                      </div>
                    ) : (
                      // Transport Leg Fields
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                  if (transportMode?.code) {
                                    return transportMode.code.toLowerCase() === currentMode;
                                  }
                                  return st.mode_id === leg.mode;
                                })
                                .map((st) => (
                                  <SelectItem key={st.id} value={st.id}>
                                    {st.name}
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
