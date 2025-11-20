import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, MapPin, Package, Truck } from 'lucide-react';
import { TransportModeSelector } from './TransportModeSelector';
import { HelpTooltip } from './HelpTooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Leg {
  id: string;
  mode: string;
  serviceTypeId: string;
  origin: string;
  destination: string;
  charges: any[];
  legType?: 'transport' | 'service';
  serviceOnlyCategory?: string;
}

interface LegsConfigurationStepProps {
  legs: Leg[];
  serviceTypes: any[];
  onAddLeg: (mode: string) => void;
  onUpdateLeg: (legId: string, updates: Partial<Leg>) => void;
  onRemoveLeg: (legId: string) => void;
}

export function LegsConfigurationStep({
  legs,
  serviceTypes,
  onAddLeg,
  onUpdateLeg,
  onRemoveLeg
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
              const legType = leg.legType || 'transport';
              const isServiceLeg = legType === 'service';
              
              return (
                <Card key={leg.id} className="border-2">
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
                              : (serviceTypes.find((st) => st.id === leg.serviceTypeId)?.name || leg.mode.toUpperCase())
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
                          <Label className="text-sm font-medium mb-2 block">Service Type *</Label>
                          <Select
                            value={leg.serviceTypeId}
                            onValueChange={(val) => onUpdateLeg(leg.id, { serviceTypeId: val })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select service type" />
                            </SelectTrigger>
                            <SelectContent>
                              {serviceTypes
                                .filter((st) => st.is_active && st.mode_id === leg.mode)
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
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              value={leg.origin}
                              onChange={(e) => onUpdateLeg(leg.id, { origin: e.target.value })}
                              placeholder="e.g., Shanghai Port"
                              className="pl-9"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium mb-2 block">Destination *</Label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              value={leg.destination}
                              onChange={(e) => onUpdateLeg(leg.id, { destination: e.target.value })}
                              placeholder="e.g., Los Angeles Port"
                              className="pl-9"
                            />
                          </div>
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
