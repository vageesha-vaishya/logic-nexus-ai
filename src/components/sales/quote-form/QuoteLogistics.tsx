import { useFormContext, useWatch } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useQuoteContext } from './QuoteContext';
import { Ship, Plane, Truck, Train, MapPin, Anchor, ArrowRight, Settings2, Package, Globe } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function QuoteLogistics() {
  const { control } = useFormContext();
  const { serviceTypes, services, carriers, ports } = useQuoteContext();
  
  const serviceTypeId = useWatch({ control, name: 'service_type_id' });

  const filteredServices = services.filter(
    (s: any) => !serviceTypeId || String(s.service_type_id) === String(serviceTypeId)
  );

  const filteredCarriers = carriers.filter((c: any) => {
    if (!serviceTypeId) return true;

    const selectedServiceType = serviceTypes.find((st: any) => String(st.id) === String(serviceTypeId));
    const serviceModeName = selectedServiceType?.name?.toLowerCase() || '';

    if (!serviceModeName) return true;
    
    if (serviceModeName.includes('ocean') || serviceModeName.includes('sea')) {
        return c.carrier_type === 'ocean';
    }
    if (serviceModeName.includes('air')) {
        return c.carrier_type === 'air_cargo';
    }
    if (serviceModeName.includes('road') || serviceModeName.includes('truck')) {
        return c.carrier_type === 'trucking';
    }
    if (serviceModeName.includes('rail')) {
        return c.carrier_type === 'rail';
    }
    return true;
  });

  const getServiceIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('air')) return <Plane className="h-4 w-4" />;
    if (n.includes('road') || n.includes('truck')) return <Truck className="h-4 w-4" />;
    if (n.includes('rail')) return <Train className="h-4 w-4" />;
    return <Ship className="h-4 w-4" />;
  };

  const getHeaderIcon = () => {
    if (!serviceTypeId) return <Ship className="h-5 w-5 text-blue-600" />;
    const selectedServiceType = serviceTypes.find((st: any) => String(st.id) === String(serviceTypeId));
    const n = selectedServiceType?.name?.toLowerCase() || '';
    
    if (n.includes('air')) return <Plane className="h-5 w-5 text-blue-600" />;
    if (n.includes('road') || n.includes('truck')) return <Truck className="h-5 w-5 text-blue-600" />;
    if (n.includes('rail')) return <Train className="h-5 w-5 text-blue-600" />;
    return <Ship className="h-5 w-5 text-blue-600" />;
  };

  return (
    <Card className="shadow-sm border-t-4 border-t-blue-500">
      <CardHeader>
        <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-full">
                {getHeaderIcon()}
            </div>
            <div>
                <CardTitle className="text-xl">Logistics Configuration</CardTitle>
                <CardDescription>Service selection and route details</CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        
        {/* Service Configuration Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/5 rounded-lg border">
          <FormField
            control={control}
            name="service_type_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    Service Type
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-background" data-testid="service-type-select-trigger">
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {serviceTypes.map((st: any) => (
                      <SelectItem key={st.id} value={st.id}>
                        <div className="flex items-center gap-2">
                            {getServiceIcon(typeof st.name === 'string' ? st.name : '')}
                            {typeof st.name === 'string' ? st.name : String(st.name || '')}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="service_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Level</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!serviceTypeId}>
                  <FormControl>
                    <SelectTrigger className="bg-background" data-testid="service-level-select-trigger">
                      <SelectValue placeholder={!serviceTypeId ? "Select Type First" : "Select Service"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredServices.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {typeof s.service_name === 'string' ? s.service_name : String(s.service_name || '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Route Details</span>
            </div>
        </div>

        {/* Route Section */}
        <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-end">
          <div className="md:col-span-5">
            <FormField
                control={control}
                name="origin_port_id"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center gap-2 text-primary">
                        <MapPin className="h-4 w-4" />
                        Origin Port / Location
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger data-testid="origin-select-trigger">
                        <SelectValue placeholder="Select origin" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {ports.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                            <div className="flex flex-col items-start">
                                <span className="font-medium">{typeof (p.name || p.location_name) === 'string' ? (p.name || p.location_name) : String(p.name || p.location_name || '')}</span>
                                <span className="text-xs text-muted-foreground">{typeof (p.code || p.location_code) === 'string' ? (p.code || p.location_code) : String(p.code || p.location_code || '')}</span>
                            </div>
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
          </div>

          <div className="hidden md:flex md:col-span-1 justify-center pb-3">
             <ArrowRight className="h-6 w-6 text-muted-foreground/50" />
          </div>

          <div className="md:col-span-5">
             <FormField
                control={control}
                name="destination_port_id"
                render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center gap-2 text-primary">
                        <Anchor className="h-4 w-4" />
                        Destination Port / Location
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger data-testid="destination-select-trigger">
                        <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {ports.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                             <div className="flex flex-col items-start">
                                <span className="font-medium">{typeof (p.name || p.location_name) === 'string' ? (p.name || p.location_name) : String(p.name || p.location_name || '')}</span>
                                <span className="text-xs text-muted-foreground">{typeof (p.code || p.location_code) === 'string' ? (p.code || p.location_code) : String(p.code || p.location_code || '')}</span>
                            </div>
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
          </div>
        </div>

        <Separator className="my-2" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={control}
            name="carrier_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                    <Ship className="h-4 w-4 text-muted-foreground" />
                    Preferred Carrier
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select carrier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredCarriers.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.carrier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="incoterms"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Incoterms
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Incoterms" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                     {['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'].map(term => (
                        <SelectItem key={term} value={term}>{term}</SelectItem>
                     ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
           
           <FormField
            control={control}
            name="trade_direction"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    Trade Direction
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
      </CardContent>
    </Card>
  );
}
