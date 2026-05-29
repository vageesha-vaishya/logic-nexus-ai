
import { memo, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Package, Ship, Plane, Train, Truck } from 'lucide-react';
import { CarrierSelect } from './CarrierSelect';
import { LocationAutocomplete } from '@/components/common/LocationAutocomplete';
import { Leg } from './store/types';
import { getSafeName } from './utils';
import { normalizeModeCode } from '@/lib/mode-utils';

interface LegCardProps {
  leg: Leg;
  index: number;
  onUpdateLeg: (id: string, updates: Partial<Leg>) => void;
  onRemoveLeg: (id: string) => void;
  validationErrors: string[];
  serviceTypes: any[];
  serviceCategories: any[];
  ports: any[];
}

export const LegCard = memo(({
  leg,
  index,
  onUpdateLeg,
  onRemoveLeg,
  validationErrors,
  serviceTypes,
  serviceCategories,
  ports
}: LegCardProps) => {
  // Normalize legType for UI display - treat everything that isn't explicitly 'service' as 'transport'
  // This handles legacy types like 'pickup', 'delivery', etc.
  const legType = leg.legType === 'service' ? 'service' : 'transport';
  const isServiceLeg = legType === 'service';
  
  const legErrors = useMemo(() => {
    const prefix = `Leg ${index + 1}:`;
    return validationErrors
      .filter(error => error.startsWith(prefix))
      .map(error => error.replace(prefix, '').trim());
  }, [validationErrors, index]);

  const hasError = legErrors.length > 0;
  
  const serviceTypeError = legErrors.find(e => e.includes('Service Type'));

  // Stable Handlers
  const handleLegTypeChange = useCallback((val: string) => {
      onUpdateLeg(leg.id, { 
        legType: val as 'transport' | 'service',
        // Clear fields when switching types
        ...(val === 'service' ? { origin: '', destination: '', serviceTypeId: '' } : { serviceOnlyCategory: '' })
      });
  }, [leg.id, onUpdateLeg]);

  const handleServiceCategoryChange = useCallback((val: string) => {
      onUpdateLeg(leg.id, { serviceOnlyCategory: val });
  }, [leg.id, onUpdateLeg]);

  const handleCarrierChange = useCallback((id: string | null, name?: string | null) => {
      onUpdateLeg(leg.id, {
        carrierId: id || undefined,
        carrierName: name || undefined,
      });
  }, [leg.id, onUpdateLeg]);

  const handleServiceTypeChange = useCallback((val: string) => {
      onUpdateLeg(leg.id, { serviceTypeId: val });
  }, [leg.id, onUpdateLeg]);

  const handleOriginChange = useCallback((val: string) => {
      onUpdateLeg(leg.id, { origin: val });
  }, [leg.id, onUpdateLeg]);

  const handleDestinationChange = useCallback((val: string) => {
      onUpdateLeg(leg.id, { destination: val });
  }, [leg.id, onUpdateLeg]);

  const handleRemoveLeg = useCallback(() => {
      onRemoveLeg(leg.id);
  }, [leg.id, onRemoveLeg]);

  // Memoized Filtered Service Types
  const filteredServiceTypes = useMemo(() => {
    return serviceTypes.filter((st) => {
      if (!st.is_active) return false;
      const transportMode = (st as any).transport_modes;
      const currentMode = normalizeModeCode(leg.mode || '');
      
      // Robust check for transport mode match
      if (transportMode?.code) {
        const tmCode = normalizeModeCode(transportMode.code);
        return tmCode === currentMode;
      }
      
      // Fallback to mode_id check if available
      return st.mode_id === leg.mode;
    });
  }, [serviceTypes, leg.mode]);

  return (
    <Card className={`border-2 ${hasError ? 'border-destructive/50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isServiceLeg ? (
              <Package className="h-4 w-4 text-muted-foreground" />
            ) : (
              (() => {
                const m = normalizeModeCode(leg.mode || '');
                if (m === 'ocean') return <Ship className="h-4 w-4 text-muted-foreground" />;
                if (m === 'air') return <Plane className="h-4 w-4 text-muted-foreground" />;
                if (m === 'rail') return <Train className="h-4 w-4 text-muted-foreground" />;
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
            onClick={handleRemoveLeg}
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
            onValueChange={handleLegTypeChange}
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
              onValueChange={handleServiceCategoryChange}
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
              <CarrierSelect
                mode={leg.mode}
                value={leg.carrierId || null}
                onChange={handleCarrierChange}
                placeholder="Select carrier"
                showPreferred
              />
            </div>

            <div>
              <Label className={`text-sm font-medium mb-2 block ${serviceTypeError ? 'text-destructive' : ''}`}>Service Type *</Label>
              <Select
                value={leg.serviceTypeId}
                onValueChange={handleServiceTypeChange}
              >
                <SelectTrigger className={`w-full ${serviceTypeError ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {filteredServiceTypes.map((st) => (
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
                onChange={handleOriginChange}
                placeholder="e.g., Shanghai Port"
                preloadedLocations={ports}
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Destination *</Label>
              <LocationAutocomplete
                value={leg.destination}
                onChange={handleDestinationChange}
                placeholder="e.g., Los Angeles Port"
                preloadedLocations={ports}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
