import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ship, Plane, Truck, Train } from 'lucide-react';

interface Carrier {
  id: string;
  carrier_name: string;
  carrier_type: string;
}

interface Port {
  id: string;
  location_name?: string;
  country_id?: string;
  [key: string]: any;
}

interface QuoteLegRowProps {
  prefix: string;
  leg: any;
  index: number;
  carriers: Carrier[];
  ports: Port[];
}

export function QuoteLegRow({ prefix, leg, index, carriers, ports }: QuoteLegRowProps) {
  const { control } = useFormContext();

  // Filter carriers for this leg's mode
  const watchedMode = useWatch({ control, name: `${prefix}.transport_mode` });
  const legMode = (watchedMode || leg.transport_mode || '').toLowerCase();
  const isAir = legMode.includes('air');
  const isOcean = legMode.includes('ocean') || legMode.includes('sea');

  const legCarriers = carriers.filter((c: any) => {
    if (!legMode) return true;
    if (isOcean) return c.carrier_type === 'ocean';
    if (isAir) return c.carrier_type === 'air_cargo';
    if (legMode.includes('road') || legMode.includes('truck')) return c.carrier_type === 'trucking';
    if (legMode.includes('rail')) return c.carrier_type === 'rail';
    return true;
  });

  const departureDate = useWatch({ control, name: `${prefix}.departure_date` });
  const arrivalDate = useWatch({ control, name: `${prefix}.arrival_date` });
  const dateError = departureDate && arrivalDate && new Date(arrivalDate) <= new Date(departureDate);

  return (
    <div key={leg.id || index} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-muted/20 rounded-lg border items-start">
      {/* Mode */}
      <div className="md:col-span-2">
        <FormField
          control={control}
          name={`${prefix}.transport_mode`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Mode</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="ocean">Ocean</SelectItem>
                  <SelectItem value="air">Air</SelectItem>
                  <SelectItem value="road">Road</SelectItem>
                  <SelectItem value="rail">Rail</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      </div>

      {/* Origin */}
      <div className="md:col-span-3">
        <FormField
          control={control}
          name={`${prefix}.origin_location_id`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Origin</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Origin" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ports?.map((p: Port) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.location_name} {p.country_id ? `(${p.country_id})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      </div>

      {/* Destination */}
      <div className="md:col-span-3">
        <FormField
          control={control}
          name={`${prefix}.destination_location_id`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Destination</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Destination" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ports?.map((p: Port) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.location_name} {p.country_id ? `(${p.country_id})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      </div>

      {/* Carrier */}
      <div className="md:col-span-2">
        <FormField
          control={control}
          name={`${prefix}.carrier_id`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Carrier</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || ''}>
                <FormControl>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder="Carrier" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {legCarriers?.map((c: Carrier) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.carrier_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      </div>

      {/* Voyage/Flight */}
      <div className="md:col-span-2">
        <FormField
          control={control}
          name={`${prefix}.voyage_number`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">
                 {isAir ? 'Flight No.' : 'Voyage No.'}
              </FormLabel>
              <FormControl>
                <Input {...field} className="h-9 bg-background" placeholder={isAir ? "e.g. AA123" : "e.g. V102"} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
      
      {/* Dates Row - Full Width */}
      <div className="md:col-span-12 grid grid-cols-2 gap-4">
           <FormField
              control={control}
              name={`${prefix}.departure_date`}
              render={({ field }) => (
                  <FormItem>
                      <FormLabel className="text-xs">Departure (ETD)</FormLabel>
                      <FormControl>
                          <Input type="date" {...field} className="h-9 bg-background" />
                      </FormControl>
                  </FormItem>
              )}
           />
           <FormField
              control={control}
              name={`${prefix}.arrival_date`}
              render={({ field }) => (
                  <FormItem>
                      <FormLabel className="text-xs">Arrival (ETA)</FormLabel>
                      <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            className={`h-9 bg-background ${dateError ? 'border-red-500' : ''}`} 
                          />
                      </FormControl>
                      {dateError && <span className="text-[10px] text-red-500">ETA must be after ETD</span>}
                  </FormItem>
              )}
           />
      </div>
    </div>
  );
}
