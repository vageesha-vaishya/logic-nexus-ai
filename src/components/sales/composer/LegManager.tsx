import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, ArrowRight, MapPin, Calendar, Ship, Truck, Plane, Train } from 'lucide-react';
import { TransportLeg } from '@/types/quote-breakdown';
import { Badge } from '@/components/ui/badge';
import { CarrierSelect } from './CarrierSelect';
import { LocationSelect } from './LocationSelect';

interface LegManagerProps {
  legs: TransportLeg[];
  onChange: (legs: TransportLeg[]) => void;
}

export function LegManager({ legs, onChange }: LegManagerProps) {

  const addLeg = () => {
    const lastLeg = legs[legs.length - 1];
    const newLeg: TransportLeg = {
      id: crypto.randomUUID(),
      mode: 'ocean',
      origin: lastLeg ? lastLeg.destination : '', // Auto-fill origin from previous destination
      destination: '',
      carrier: '',
      voyage: '',
      service_type: 'Standard',
      transit_time: '',
      charges: [],
      departure_date: lastLeg?.arrival_date || new Date().toISOString().split('T')[0],
    };
    onChange([...legs, newLeg]);
  };

  const removeLeg = (id: string) => {
    onChange(legs.filter(l => l.id !== id));
  };

  const updateLeg = (id: string, updates: Partial<TransportLeg>) => {
    onChange(legs.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'ocean': return <Ship className="w-4 h-4" />;
      case 'air': return <Plane className="w-4 h-4" />;
      case 'road': return <Truck className="w-4 h-4" />;
      case 'rail': return <Train className="w-4 h-4" />;
      default: return <Ship className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Route Configuration
          </h3>
          <p className="text-xs text-muted-foreground">Define the multi-leg journey from origin to destination.</p>
        </div>
        <Button size="sm" onClick={addLeg} variant="outline" className="h-8">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Leg
        </Button>
      </div>

      <div className="space-y-3">
        {legs.length === 0 && (
          <div className="text-center p-8 border-2 border-dashed rounded-lg bg-muted/20">
            <p className="text-sm text-muted-foreground mb-2">No transport legs defined.</p>
            <Button size="sm" onClick={addLeg}>Start Routing</Button>
          </div>
        )}

        {legs.map((leg, index) => (
          <Card key={leg.id} className="relative group border-l-4 border-l-primary/50">
            <div className="absolute left-[-18px] top-6 w-4 h-4 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-[8px] font-bold z-10">
              {index + 1}
            </div>
            {index < legs.length - 1 && (
               <div className="absolute left-[-11px] top-10 bottom-[-20px] w-[2px] bg-border z-0" />
            )}
            
            <CardContent className="p-4 grid gap-4">
              <div className="flex flex-col lg:flex-row items-start gap-4">
                <div className="flex gap-4 w-full lg:w-auto">
                  {/* Mode Selector */}
                  <div className="w-32 flex-shrink-0">
                    <Label className="text-[10px] uppercase text-muted-foreground mb-1">Mode</Label>
                    <Select value={leg.mode} onValueChange={(v) => updateLeg(leg.id, { mode: v, carrier_id: undefined, carrier: undefined })}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ocean"><div className="flex items-center gap-2"><Ship className="w-3 h-3" /> Ocean</div></SelectItem>
                        <SelectItem value="air"><div className="flex items-center gap-2"><Plane className="w-3 h-3" /> Air</div></SelectItem>
                        <SelectItem value="road"><div className="flex items-center gap-2"><Truck className="w-3 h-3" /> Road</div></SelectItem>
                        <SelectItem value="rail"><div className="flex items-center gap-2"><Train className="w-3 h-3" /> Rail</div></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Carrier Selector */}
                  <div className="flex-1 lg:w-48 lg:flex-none min-w-0">
                    <Label className="text-[10px] uppercase text-muted-foreground mb-1">Carrier</Label>
                    <CarrierSelect
                      mode={leg.mode}
                      value={leg.carrier_id}
                      onChange={(id, name) => updateLeg(leg.id, { carrier_id: id || undefined, carrier: name || undefined })}
                      placeholder="Select carrier..."
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Route */}
                <div className="flex-1 grid grid-cols-[1fr,auto,1fr] gap-2 items-end w-full lg:w-auto min-w-0">
                  <div className="min-w-0">
                    <Label className="text-[10px] uppercase text-muted-foreground mb-1">Origin</Label>
                    <LocationSelect 
                      value={leg.origin} 
                      onChange={(val) => updateLeg(leg.id, { origin: val })}
                      className="h-8 text-xs" 
                      placeholder="City/Port"
                    />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground mb-2 flex-shrink-0" />
                  <div className="min-w-0">
                    <Label className="text-[10px] uppercase text-muted-foreground mb-1">Destination</Label>
                    <LocationSelect 
                      value={leg.destination} 
                      onChange={(val) => updateLeg(leg.id, { destination: val })}
                      className="h-8 text-xs" 
                      placeholder="City/Port"
                    />
                  </div>
                </div>

                <div className="flex gap-4 w-full lg:w-auto items-end">
                  {/* Dates */}
                  <div className="flex-1 lg:w-32 lg:flex-none">
                     <Label className="text-[10px] uppercase text-muted-foreground mb-1">Departure</Label>
                     <div className="relative">
                       <Input 
                         type="date"
                         value={leg.departure_date ? leg.departure_date.split('T')[0] : ''}
                         onChange={(e) => updateLeg(leg.id, { departure_date: e.target.value })}
                         className="h-8 text-xs pl-7"
                       />
                       <Calendar className="w-3 h-3 absolute left-2 top-2.5 text-muted-foreground" />
                     </div>
                  </div>

                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeLeg(leg.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Validation Message */}
              {index > 0 && legs[index-1].destination !== leg.origin && (
                <div className="text-[11px] text-amber-600 bg-amber-50 px-2 py-1 rounded flex items-center gap-2">
                   ⚠️ Gap detected: Previous leg ends at "{legs[index-1].destination}" but this leg starts at "{leg.origin}".
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
