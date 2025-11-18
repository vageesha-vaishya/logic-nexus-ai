import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, MapPin } from 'lucide-react';
import { TransportModeSelector } from './TransportModeSelector';

interface Leg {
  id: string;
  mode: string;
  serviceTypeId: string;
  origin: string;
  destination: string;
  charges: any[];
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Transport Legs</CardTitle>
        <CardDescription>Add and configure each leg of the journey</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-base font-semibold mb-3 block">Add Transport Mode</Label>
          <TransportModeSelector selectedMode={null} onSelect={onAddLeg} />
        </div>

        {legs.length > 0 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">Your Legs ({legs.length})</Label>
            {legs.map((leg, index) => (
              <Card key={leg.id} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Leg {index + 1} - {leg.mode.toUpperCase()}
                    </CardTitle>
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
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Service Type</Label>
                      <Select
                        value={leg.serviceTypeId}
                        onValueChange={(val) => onUpdateLeg(leg.id, { serviceTypeId: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceTypes.map((st) => (
                            <SelectItem key={st.id} value={st.id}>
                              {st.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Origin</Label>
                      <div className="relative">
                        <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={leg.origin}
                          onChange={(e) => onUpdateLeg(leg.id, { origin: e.target.value })}
                          placeholder="Origin location"
                          className="pl-8"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Destination</Label>
                      <div className="relative">
                        <MapPin className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={leg.destination}
                          onChange={(e) => onUpdateLeg(leg.id, { destination: e.target.value })}
                          placeholder="Destination location"
                          className="pl-8"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
