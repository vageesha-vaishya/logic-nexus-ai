import { Ship, Plane, Truck, Train } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export interface TransportMode {
  id: string;
  name: string;
  icon: any;
  color: string;
}

export const transportModes: TransportMode[] = [
  { id: 'ocean', name: 'Ocean Freight', icon: Ship, color: 'bg-blue-500' },
  { id: 'air', name: 'Air Freight', icon: Plane, color: 'bg-indigo-500' },
  { id: 'road', name: 'Road Transport', icon: Truck, color: 'bg-green-500' },
  { id: 'rail', name: 'Rail Transport', icon: Train, color: 'bg-orange-500' }
];

interface TransportModeSelectorProps {
  selectedMode: string | null;
  onSelect: (modeId: string) => void;
}

export function TransportModeSelector({ selectedMode, onSelect }: TransportModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {transportModes.map(mode => {
        const Icon = mode.icon;
        const isSelected = selectedMode === mode.id;
        
        return (
          <Card
            key={mode.id}
            className={`cursor-pointer transition-all hover:scale-105 ${
              isSelected ? 'ring-2 ring-primary shadow-lg' : ''
            }`}
            onClick={() => onSelect(mode.id)}
          >
            <div className="p-6 flex flex-col items-center gap-3">
              <div className={`${mode.color} p-3 rounded-full text-white`}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="font-medium text-sm text-center">{mode.name}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
